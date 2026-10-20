import { timingSafeEqual } from "node:crypto";
import { defaultBosses, normalizeBosses, reminderCandidates, scheduleAt, updateBoss } from "../lib/timers.js";
import { sendPush, validateSubscription } from "../lib/push.ts";
import type { PushPayload, PushResult, ValidatedSubscription, VapidEnvironment } from "../lib/push.ts";

export const ownerIdentity = "yukikiie";
export const allowedOrigin = "https://yukikiie.github.io";
export const applicationUrl = "https://yukikiie.github.io/yuki-ro-boss-timers/";

export type WorkerEnvironment = VapidEnvironment & {
  DB?: D1Database;
  OWNER_KEY_SHA256?: string;
  ALLOWED_ORIGIN?: string;
  APP_URL?: string;
};

export type ServiceDependencies = {
  now?: () => number;
  sendPush?: (subscription: ValidatedSubscription, payload: PushPayload, environment: VapidEnvironment) => Promise<PushResult>;
};

type TimerAccount = { user_id: string; bosses: string; revision: number; updated_at: number };
type SubscriptionRow = { id: string; user_id: string; subscription: string; created_at: number; tested_at: number | null };

export class ApiError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function sameOrigin(request: Request, environment: WorkerEnvironment) {
  if (environment.ALLOWED_ORIGIN !== allowedOrigin) throw new ApiError("私人計時器尚未完成連線設定。", 503);
  const origin = request.headers.get("origin");
  if (origin !== null && origin !== allowedOrigin) throw new ApiError("不允許這個網站存取私人計時器。", 403);
  if (origin === null && request.headers.has("sec-fetch-site")) throw new ApiError("缺少網站來源。", 403);
}

export async function userIdentity(request: Request, environment: WorkerEnvironment) {
  if (request.headers.has("oai-authenticated-user-id")) throw new ApiError("不支援這種登入方式。", 403);
  const expected = environment.OWNER_KEY_SHA256;
  if (!expected || !/^[a-f0-9]{64}$/.test(expected)) throw new ApiError("私人計時器尚未完成連線設定。", 503);
  const authorization = request.headers.get("authorization") || "";
  const received = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(authorization)?.[1];
  if (!received) throw new ApiError("請輸入私人連線碼。", 401);
  const hashed = await digest(received);
  const encoder = new TextEncoder();
  if (!timingSafeEqual(encoder.encode(expected), encoder.encode(hashed))) throw new ApiError("私人連線碼不正確。", 401);
  return ownerIdentity;
}

export async function bodyJson(request: Request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") || "")) throw new ApiError("請使用 JSON 請求。", 415);
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError("缺少請求內容。");
  let length = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const item = await reader.read();
    if (item.done) break;
    length += item.value.byteLength;
    if (length > 8192) {
      await reader.cancel();
      throw new ApiError("請求內容過大。", 413);
    }
    chunks.push(item.value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    const result = JSON.parse(new TextDecoder().decode(bytes));
    if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error();
    return result;
  } catch {
    throw new ApiError("請求內容不是有效的 JSON 物件。");
  }
}

export function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}

export async function api(operation: () => Promise<Response>) {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof ApiError) return json({ error: error.message }, error.status);
    console.error("Timer API operation failed", error instanceof Error ? error.name : "Error");
    return json({ error: "暫時無法完成操作，請稍後重試。" }, 500);
  }
}

export async function digest(value: string) {
  const hashed = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hashed), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createTimerService(environment: WorkerEnvironment, dependencies: ServiceDependencies = {}) {
  const clock = dependencies.now || Date.now;
  const push = dependencies.sendPush || sendPush;
  const env = { ...environment, VAPID_SUBJECT: environment.VAPID_SUBJECT || environment.APP_URL || applicationUrl };

  function database() {
    if (!env.DB) throw new ApiError("資料庫尚未就緒，請稍後重試。", 503);
    return env.DB;
  }

  async function account(userId: string, now: number) {
    const storage = database();
    await storage.prepare("INSERT OR IGNORE INTO timer_accounts (user_id,bosses,revision,updated_at) VALUES (?,?,0,?)")
      .bind(userId, JSON.stringify(defaultBosses(now)), now).run();
    const saved = await storage.prepare("SELECT user_id,bosses,revision,updated_at FROM timer_accounts WHERE user_id=?").bind(userId).first<TimerAccount>();
    if (!saved) throw new ApiError("無法讀取計時器，請重試。", 503);
    let parsed;
    try { parsed = JSON.parse(saved.bosses); } catch { parsed = defaultBosses(now); }
    return { saved, bosses: normalizeBosses(parsed, now) };
  }

  async function state(userId: string, now = clock()) {
    const storage = database();
    const current = await account(userId, now);
    const [devices, history, heartbeat] = await Promise.all([
      storage.prepare("SELECT COUNT(*) AS count FROM push_subscriptions WHERE user_id=?").bind(userId).first<{ count: number }>(),
      storage.prepare("SELECT id,title,message,status,created_at AS createdAt FROM timer_alerts WHERE user_id=? ORDER BY created_at DESC LIMIT 30").bind(userId).all(),
      storage.prepare("SELECT updated_at FROM service_status WHERE id='dispatcher'").first<{ updated_at: number }>(),
    ]);
    return {
      serverNow: now,
      schedule: scheduleAt(now),
      bosses: current.bosses,
      revision: current.saved.revision,
      alerts: history.results,
      push: {
        configured: Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT),
        publicKey: env.VAPID_PUBLIC_KEY || null,
        subscriptions: devices?.count || 0,
        schedulerReady: Boolean(heartbeat && now >= heartbeat.updated_at && now - heartbeat.updated_at < 180_000),
        lastDispatchAt: heartbeat?.updated_at || null,
      },
    };
  }

  async function mutateBosses(userId: string, input: Record<string, unknown>) {
    const now = clock();
    const current = await account(userId, now);
    let bosses;
    try { bosses = updateBoss(current.bosses, { ...input, type: input.action }, now); }
    catch (error) { throw new ApiError(error instanceof Error ? error.message : "無效的計時設定。"); }
    const changed = await database().prepare("UPDATE timer_accounts SET bosses=?,revision=revision+1,updated_at=? WHERE user_id=? AND revision=?")
      .bind(JSON.stringify(bosses), now, userId, current.saved.revision).run();
    if (!changed.meta.changes) throw new ApiError("另一個裝置剛更新了計時器，請重新整理再試。", 409);
    return state(userId);
  }

  async function subscribe(userId: string, input: unknown) {
    if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) throw new ApiError("推播服務尚未設定。", 503);
    let subscription;
    try { subscription = validateSubscription(input); }
    catch { throw new ApiError("無效的手機推播訂閱，請重新啟用通知。"); }
    const storage = database();
    const id = await digest(subscription.endpoint);
    const existing = await storage.prepare("SELECT user_id FROM push_subscriptions WHERE id=?").bind(id).first<{ user_id: string }>();
    if (existing && existing.user_id !== userId) throw new ApiError("這個裝置已連結其他使用者，請先取消舊訂閱。", 409);
    const count = await storage.prepare("SELECT COUNT(*) AS count FROM push_subscriptions WHERE user_id=?").bind(userId).first<{ count: number }>();
    if (!existing && (count?.count || 0) >= 8) throw new ApiError("最多可連結 8 個裝置。請先移除舊裝置。");
    await storage.prepare("INSERT INTO push_subscriptions (id,user_id,subscription,created_at) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET subscription=excluded.subscription")
      .bind(id, userId, JSON.stringify(subscription), clock()).run();
    return state(userId);
  }

  async function unsubscribe(userId: string, endpoint: unknown) {
    if (typeof endpoint !== "string" || endpoint.length > 4096) throw new ApiError("缺少有效的裝置識別。");
    await database().prepare("DELETE FROM push_subscriptions WHERE id=? AND user_id=?").bind(await digest(endpoint), userId).run();
    return state(userId);
  }

  async function subscriptionStatus(userId: string, endpoint: unknown) {
    if (typeof endpoint !== "string" || endpoint.length > 4096) throw new ApiError("缺少有效的裝置識別。");
    const device = await database().prepare("SELECT tested_at FROM push_subscriptions WHERE id=? AND user_id=?")
      .bind(await digest(endpoint), userId).first<{ tested_at: number | null }>();
    return { connected: Boolean(device), testedAt: device?.tested_at || null };
  }

  async function testPush(userId: string, endpoint: unknown) {
    if (typeof endpoint !== "string" || endpoint.length > 4096) throw new ApiError("請先在這個裝置啟用通知。");
    const storage = database();
    const device = await storage.prepare("SELECT * FROM push_subscriptions WHERE id=? AND user_id=?").bind(await digest(endpoint), userId).first<SubscriptionRow>();
    if (!device) throw new ApiError("請先在這個裝置啟用通知。", 404);
    const now = clock();
    if (device.tested_at && now - device.tested_at < 15_000) throw new ApiError("請等候 15 秒再發送下一則測試。", 429);
    await storage.prepare("UPDATE push_subscriptions SET tested_at=? WHERE id=?").bind(now, device.id).run();
    const result = await push(JSON.parse(device.subscription), {
      title: "Yuki RO · 通知測試",
      body: "這是一則測試通知。收到後，你的手機推播才算完成實機驗證。",
      tag: "yuki-ro-test",
    }, env);
    if (result.expired) await storage.prepare("DELETE FROM push_subscriptions WHERE id=?").bind(device.id).run();
    if (!result.ok) throw new ApiError(result.expired ? "這個裝置的訂閱已過期，請重新啟用通知。" : "推播閘道未接受測試，請稍後重試。", 502);
    await storage.prepare("INSERT INTO timer_alerts (id,user_id,title,message,status,created_at) VALUES (?,?,?,?,?,?)")
      .bind(crypto.randomUUID(), userId, "通知測試", "已送交推播服務；請在手機確認是否收到。", "accepted", now).run();
    return { ...(await state(userId)), testAccepted: true };
  }

  async function dispatchReminders(now = clock()) {
    const storage = database();
    let leaseUntil = now + 55_000;
    const deadline = now + 40_000;
    const lease = await storage.prepare("INSERT INTO dispatch_lock (id,lease_until) VALUES ('main',?) ON CONFLICT(id) DO UPDATE SET lease_until=excluded.lease_until WHERE dispatch_lock.lease_until<? RETURNING id")
      .bind(leaseUntil, now).first();
    if (!lease) return { busy: true, accepted: 0, failed: 0 };
    let accepted = 0;
    let failed = 0;
    try {
      const records = await storage.prepare("SELECT user_id,bosses,revision,updated_at FROM timer_accounts WHERE user_id=? LIMIT 1").bind(ownerIdentity).all<TimerAccount>();
      processing: for (const record of records.results) {
        if (clock() >= deadline) break;
        let parsed;
        try { parsed = JSON.parse(record.bosses); } catch { continue; }
        const bosses = normalizeBosses(parsed, now);
        const normalized = JSON.stringify(bosses);
        if (normalized !== record.bosses) await storage.prepare("UPDATE timer_accounts SET bosses=?,revision=revision+1,updated_at=? WHERE user_id=? AND revision=?")
          .bind(normalized, now, record.user_id, record.revision).run();
        const devices = await storage.prepare("SELECT * FROM push_subscriptions WHERE user_id=? LIMIT 8").bind(record.user_id).all<SubscriptionRow>();
        for (const reminder of reminderCandidates(bosses, now)) {
          const alertId = await digest(`${record.user_id}:${reminder.cycleKey}:${reminder.threshold}`);
          for (const device of devices.results) {
            const claimedAt = clock();
            if (claimedAt >= deadline) break processing;
            const renewedUntil = claimedAt + 55_000;
            const renewed = await storage.prepare("UPDATE dispatch_lock SET lease_until=? WHERE id='main' AND lease_until=? RETURNING id")
              .bind(renewedUntil, leaseUntil).first();
            if (!renewed) break processing;
            leaseUntil = renewedUntil;
            const deliveryId = await digest(`${alertId}:${device.id}`);
            const claimed = await storage.prepare("INSERT INTO push_deliveries (id,user_id,alert_id,subscription_id,status,attempts,updated_at) VALUES (?,?,?,?,'sending',1,?) ON CONFLICT(id) DO UPDATE SET status='sending',attempts=attempts+1,updated_at=excluded.updated_at WHERE push_deliveries.attempts<3 AND (push_deliveries.status='failed' OR (push_deliveries.status='sending' AND push_deliveries.updated_at<?)) RETURNING id")
              .bind(deliveryId, record.user_id, alertId, device.id, claimedAt, claimedAt - 60_000).first();
            if (!claimed) continue;
            const fresh = await storage.prepare("SELECT bosses FROM timer_accounts WHERE user_id=?").bind(record.user_id).first<{ bosses: string }>();
            const validatedAt = clock();
            const freshCandidate = fresh && reminderCandidates(normalizeBosses(JSON.parse(fresh.bosses), validatedAt), validatedAt)
              .find((candidate) => candidate.cycleKey === reminder.cycleKey && candidate.threshold === reminder.threshold);
            if (!freshCandidate) {
              await storage.prepare("UPDATE push_deliveries SET status='cancelled',updated_at=? WHERE id=?").bind(clock(), deliveryId).run();
              continue;
            }
            let result;
            try {
              result = await push(JSON.parse(device.subscription), { title: freshCandidate.title, body: freshCandidate.message, tag: alertId.slice(0, 30) }, env);
            } catch {
              result = { ok: false, status: 0, expired: false };
            }
            if (result.expired) await storage.prepare("DELETE FROM push_subscriptions WHERE id=?").bind(device.id).run();
            await storage.prepare("UPDATE push_deliveries SET status=?,updated_at=? WHERE id=?")
              .bind(result.ok ? "accepted" : result.expired ? "expired" : "failed", clock(), deliveryId).run();
            if (result.ok) accepted++; else failed++;
            await storage.prepare("INSERT INTO timer_alerts (id,user_id,title,message,status,created_at) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,message=excluded.message,status=CASE WHEN timer_alerts.status='accepted' THEN 'accepted' ELSE excluded.status END")
              .bind(alertId, record.user_id, freshCandidate.title, freshCandidate.message, result.ok ? "accepted" : "failed", now).run();
          }
        }
      }
      await storage.prepare("INSERT INTO service_status (id,updated_at) VALUES ('dispatcher',?) ON CONFLICT(id) DO UPDATE SET updated_at=excluded.updated_at").bind(clock()).run();
      await storage.prepare("DELETE FROM push_deliveries WHERE updated_at<?").bind(now - 7 * 86400_000).run();
      await storage.prepare("DELETE FROM timer_alerts WHERE created_at<?").bind(now - 7 * 86400_000).run();
      return { accepted, failed, serverNow: clock() };
    } finally {
      await storage.prepare("UPDATE dispatch_lock SET lease_until=0 WHERE id='main' AND lease_until=?").bind(leaseUntil).run();
    }
  }

  return { state, mutateBosses, subscribe, unsubscribe, subscriptionStatus, testPush, dispatchReminders };
}
