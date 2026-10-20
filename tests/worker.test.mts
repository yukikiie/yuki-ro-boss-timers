import assert from "node:assert/strict";
import { createECDH, createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import webPush from "web-push";
import worker, { handleRequest, handleScheduled } from "../worker/index.ts";
import { allowedOrigin, applicationUrl, createTimerService, digest, ownerIdentity } from "../worker/service.ts";
import type { WorkerEnvironment } from "../worker/service.ts";
import type { PushPayload, PushResult, ValidatedSubscription, VapidEnvironment } from "../lib/push.ts";

const migration = await readFile(new URL("../worker/migrations/0001_timers.sql", import.meta.url), "utf8");
const connectionKey = Buffer.alloc(32, 173).toString("base64url");
const keyHash = createHash("sha256").update(connectionKey).digest("hex");
const vapid = webPush.generateVAPIDKeys();
const receiver = createECDH("prime256v1");
const receiverKey = receiver.generateKeys().toString("base64url");
const subscription: ValidatedSubscription = {
  endpoint: "https://web.push.apple.com/test-private-endpoint",
  keys: { p256dh: receiverKey, auth: Buffer.alloc(16, 19).toString("base64url") },
  expirationTime: null,
};
const noon = Date.parse("2026-10-20T12:00:00+08:00");

function storage() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(migration);
  const queries: string[] = [];
  const database = {
    prepare(sql: string) {
      queries.push(sql);
      const prepared = sqlite.prepare(sql);
      let values: (string | number | null)[] = [];
      const statement = {
        bind(...input: (string | number | null)[]) {
          values = input;
          return statement;
        },
        async first() {
          return prepared.get(...values) || null;
        },
        async all() {
          return { results: prepared.all(...values) };
        },
        async run() {
          const result = prepared.run(...values);
          return { meta: { changes: Number(result.changes) } };
        },
      };
      return statement;
    },
  } as unknown as D1Database;
  return { sqlite, queries, database };
}

function fixture() {
  const saved = storage();
  let currentTime = noon;
  let result: PushResult = { ok: true, status: 201, expired: false };
  const pushes: { subscription: ValidatedSubscription; payload: PushPayload; environment: VapidEnvironment }[] = [];
  const environment: WorkerEnvironment = {
    DB: saved.database,
    OWNER_KEY_SHA256: keyHash,
    ALLOWED_ORIGIN: allowedOrigin,
    APP_URL: applicationUrl,
    VAPID_PUBLIC_KEY: vapid.publicKey,
    VAPID_PRIVATE_KEY: vapid.privateKey,
  };
  const dependencies = {
    now: () => currentTime,
    sendPush: async (device: ValidatedSubscription, payload: PushPayload, credentials: VapidEnvironment) => {
      pushes.push({ subscription: device, payload, environment: credentials });
      return result;
    },
  };
  async function request(pathname: string, method = "GET", input?: unknown, extraHeaders?: Record<string, string>) {
    const headers: Record<string, string> = { Origin: allowedOrigin, Authorization: `Bearer ${connectionKey}`, ...extraHeaders };
    if (input !== undefined) headers["Content-Type"] = "application/json";
    return handleRequest(new Request(`https://api.example.workers.dev${pathname}`, {
      method, headers, body: input === undefined ? undefined : JSON.stringify(input),
    }), environment, dependencies);
  }
  return {
    ...saved, environment, dependencies, pushes, request,
    now: (value: number) => { currentTime = value; },
    pushResult: (value: PushResult) => { result = value; },
    service: createTimerService(environment, dependencies),
  };
}

function assertPrivateResponse(body: string) {
  for (const secret of [connectionKey, keyHash, vapid.privateKey, subscription.endpoint, subscription.keys.auth, subscription.keys.p256dh]) {
    assert.equal(body.includes(secret), false, "a private credential or endpoint escaped the API");
  }
}

test("health is minimal and does not read private storage or require credentials", async () => {
  const current = fixture();
  const response = await handleRequest(new Request("https://api.example.workers.dev/health"), current.environment);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(current.queries.length, 0);
  assert.equal(response.headers.get("Access-Control-Allow-Credentials"), null);
  current.sqlite.close();
});

test("owner authentication requires the exact bearer key, never a Sites identity", async () => {
  const current = fixture();
  for (const authorization of ["", "Bearer wrong", `Basic ${connectionKey}`, `Bearer ${"A".repeat(43)}`, `Bearer ${connectionKey}x`]) {
    const response = await current.request("/api/state", "GET", undefined, { Authorization: authorization });
    assert.equal(response.status, 401);
    assertPrivateResponse(await response.text());
  }
  const forged = await current.request("/api/state", "GET", undefined, { "oai-authenticated-user-id": "victim" });
  assert.equal(forged.status, 403);
  assert.equal(current.queries.length, 0);
  assert.equal(await digest(connectionKey), keyHash);
  current.sqlite.close();
});

test("missing or malformed stored key hashes fail closed before database access", async () => {
  const current = fixture();
  for (const stored of [undefined, connectionKey, "0".repeat(63), keyHash.toUpperCase()]) {
    const response = await handleRequest(new Request("https://api.example.workers.dev/api/state", {
      headers: { Origin: allowedOrigin, Authorization: `Bearer ${connectionKey}` },
    }), { ...current.environment, OWNER_KEY_SHA256: stored }, current.dependencies);
    assert.equal(response.status, 503);
  }
  assert.equal(current.queries.length, 0);
  current.sqlite.close();
});

test("exact GitHub origin is enforced before authentication and database access", async () => {
  const current = fixture();
  for (const origin of ["null", "http://yukikiie.github.io", "https://yukikiie.github.io.attacker.test", "https://yukikiie.github.io/", "https://other.github.io"]) {
    const response = await current.request("/api/state", "GET", undefined, { Origin: origin });
    assert.equal(response.status, 403);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), null);
  }
  const browserWithoutOrigin = await handleRequest(new Request("https://api.example.workers.dev/api/state", {
    headers: { Authorization: `Bearer ${connectionKey}`, "Sec-Fetch-Site": "cross-site" },
  }), current.environment, current.dependencies);
  assert.equal(browserWithoutOrigin.status, 403);
  const badConfiguration = await handleRequest(new Request("https://api.example.workers.dev/api/state"), {
    ...current.environment, ALLOWED_ORIGIN: "*",
  }, current.dependencies);
  assert.equal(badConfiguration.status, 503);
  assert.equal(current.queries.length, 0);
  const legitimateCrossSite = await current.request("/api/state", "GET", undefined, { "Sec-Fetch-Site": "cross-site" });
  assert.equal(legitimateCrossSite.status, 200);
  assert.equal(legitimateCrossSite.headers.get("Access-Control-Allow-Origin"), allowedOrigin);
  assert.equal(legitimateCrossSite.headers.get("Access-Control-Allow-Credentials"), null);
  current.sqlite.close();
});

test("preflight grants only the route's methods and explicit JSON/bearer headers", async () => {
  const current = fixture();
  const request = (pathname: string, method: string, headers: string, origin = allowedOrigin) => handleRequest(new Request(`https://api.example.workers.dev${pathname}`, {
    method: "OPTIONS",
    headers: { Origin: origin, "Access-Control-Request-Method": method, "Access-Control-Request-Headers": headers },
  }), current.environment, current.dependencies);
  const response = await request("/api/push/subscribe", "DELETE", "authorization, content-type");
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), allowedOrigin);
  assert.equal(response.headers.get("Access-Control-Allow-Headers"), "Authorization, Content-Type");
  assert.equal(response.headers.get("Access-Control-Allow-Methods"), "POST, DELETE");
  assert.equal(response.headers.get("Access-Control-Allow-Credentials"), null);
  assert.equal((await request("/api/state", "DELETE", "authorization")).status, 405);
  assert.equal((await request("/api/state", "GET", "authorization, oai-authenticated-user-id")).status, 403);
  assert.equal((await request("/api/bosses", "POST", "authorization", "https://attacker.test")).status, 403);
  assert.equal((await request("/api/dispatch", "POST", "authorization")).status, 404);
  assert.equal(current.queries.length, 0);
  current.sqlite.close();
});

test("authenticated state creates only the independent owner account and excludes all secrets", async () => {
  const current = fixture();
  const response = await current.request("/api/state");
  assert.equal(response.status, 200);
  const encoded = await response.text();
  assertPrivateResponse(encoded);
  const data = JSON.parse(encoded);
  assert.equal(data.bosses.length, 18);
  assert.equal(data.push.configured, true);
  assert.equal(data.push.publicKey, vapid.publicKey);
  assert.equal(data.push.subscriptions, 0);
  assert.equal(data.push.schedulerReady, false);
  assert.equal(data.revision, 0);
  assert.deepEqual(current.sqlite.prepare("SELECT user_id FROM timer_accounts").all().map((record) => record.user_id), [ownerIdentity]);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  current.sqlite.close();
});

test("boss mutations preserve HK durations, roster, favorites, and private revision", async () => {
  const current = fixture();
  const initial = await (await current.request("/api/state")).json();
  const favorite = initial.bosses.find((boss: { favorite: boolean }) => boss.favorite);
  const response = await current.request("/api/bosses", "POST", { action: "kill", bossId: "morocc" });
  assert.equal(response.status, 200);
  const updated = await response.json();
  assert.equal(updated.bosses.length, 18);
  assert.equal(updated.bosses.find((boss: { id: string }) => boss.id === "morocc").dueAt, noon + 180 * 60_000);
  assert.equal(updated.bosses.find((boss: { id: string }) => boss.id === favorite.id).favorite, true);
  assert.equal(updated.revision, 1);
  const mini = initial.bosses.find((boss: { kind: string }) => boss.kind === "Mini");
  const miniUpdate = await (await current.request("/api/bosses", "POST", { action: "kill", bossId: mini.id })).json();
  assert.equal(miniUpdate.bosses.find((boss: { id: string }) => boss.id === mini.id).dueAt, noon + 120 * 60_000);
  current.now(Date.parse("2026-10-21T03:00:00+08:00"));
  assert.equal((await current.request("/api/bosses", "POST", { action: "kill", bossId: "morocc" })).status, 400);
  current.sqlite.close();
});

test("JSON validation and the 8192-byte limit run before any database operations", async () => {
  const current = fixture();
  for (const [content, type, status] of [
    ["{", "application/json", 400],
    ["[]", "application/json", 400],
    ["null", "application/json", 400],
    ["{}", "application/jsonx", 415],
    [JSON.stringify({ ignored: "字".repeat(8192) }), "application/json", 413],
  ] as const) {
    const response = await handleRequest(new Request("https://api.example.workers.dev/api/bosses", {
      method: "POST", headers: { Origin: allowedOrigin, Authorization: `Bearer ${connectionKey}`, "Content-Type": type }, body: content,
    }), current.environment, current.dependencies);
    assert.equal(response.status, status);
  }
  assert.equal(current.queries.length, 0);
  assert.equal((await current.request("/api/state", "DELETE")).status, 405);
  assert.equal((await current.request("/api/dispatch", "POST", {})).status, 404);
  current.sqlite.close();
});

test("subscribe/status/test/unsubscribe keep endpoint keys private and support fixed app VAPID subject", async () => {
  const current = fixture();
  assert.equal((await current.request("/api/push/subscribe", "POST", { ...subscription, endpoint: "https://localhost/internal" })).status, 400);
  const subscribed = await current.request("/api/push/subscribe", "POST", subscription);
  assert.equal(subscribed.status, 200);
  const encoded = await subscribed.text();
  assertPrivateResponse(encoded);
  assert.equal(JSON.parse(encoded).push.subscriptions, 1);
  assert.deepEqual(await (await current.request("/api/push/status", "POST", { endpoint: subscription.endpoint })).json(), { connected: true, testedAt: null });
  const tested = await current.request("/api/push/test", "POST", { endpoint: subscription.endpoint });
  assert.equal(tested.status, 200);
  const testState = await tested.text();
  assertPrivateResponse(testState);
  assert.equal(JSON.parse(testState).testAccepted, true);
  assert.equal(current.pushes.length, 1);
  assert.equal(current.pushes[0].environment.VAPID_SUBJECT, applicationUrl);
  assert.equal((await current.request("/api/push/test", "POST", { endpoint: subscription.endpoint })).status, 429);
  current.now(noon + 16_000);
  current.pushResult({ ok: false, status: 410, expired: true });
  assert.equal((await current.request("/api/push/test", "POST", { endpoint: subscription.endpoint })).status, 502);
  assert.equal((await current.request("/api/state")).status, 200);
  assert.deepEqual(await (await current.request("/api/push/status", "POST", { endpoint: subscription.endpoint })).json(), { connected: false, testedAt: null });
  await current.request("/api/push/subscribe", "POST", subscription);
  const removed = await current.request("/api/push/subscribe", "DELETE", { endpoint: subscription.endpoint });
  assert.equal(removed.status, 200);
  assert.equal((await removed.json()).push.subscriptions, 0);
  current.sqlite.close();
});

test("minute scheduled dispatch works without a browser, deduplicates, and expires its heartbeat after 180 seconds", async () => {
  const current = fixture();
  await current.request("/api/push/subscribe", "POST", subscription);
  await current.request("/api/bosses", "POST", { action: "countdown", bossId: "morocc", seconds: 590 });
  const first = await handleScheduled(current.environment, current.dependencies);
  assert.equal(first.accepted, 1);
  assert.equal(current.pushes.length, 1);
  assert.match(current.pushes[0].payload.title, /10 分鐘提醒/);
  const repeated = await handleScheduled(current.environment, current.dependencies);
  assert.equal(repeated.accepted, 0);
  assert.equal(current.pushes.length, 1);
  current.now(noon + 179_999);
  assert.equal((await current.service.state(ownerIdentity)).push.schedulerReady, true);
  current.now(noon + 180_000);
  assert.equal((await current.service.state(ownerIdentity)).push.schedulerReady, false);
  current.now(noon + 300_000);
  assert.equal((await handleScheduled(current.environment, current.dependencies)).accepted, 1);
  assert.match(current.pushes[1].payload.title, /5 分鐘提醒/);
  current.now(noon + 590_000);
  assert.equal((await handleScheduled(current.environment, current.dependencies)).accepted, 1);
  assert.match(current.pushes[2].payload.title, /重生時間到/);
  assert.equal((await handleScheduled(current.environment, current.dependencies)).accepted, 0);
  current.sqlite.close();
});

test("scheduled push retries failed deliveries at most three times and removes expired gateways", async () => {
  const current = fixture();
  await current.request("/api/push/subscribe", "POST", subscription);
  await current.request("/api/bosses", "POST", { action: "countdown", bossId: "morocc", seconds: 590 });
  current.pushResult({ ok: false, status: 503, expired: false });
  for (let attempt = 0; attempt < 4; attempt++) {
    await handleScheduled(current.environment, current.dependencies);
    current.now(noon + (attempt + 1) * 60_000);
  }
  assert.equal(current.pushes.length, 3);
  const delivery = current.sqlite.prepare("SELECT status,attempts FROM push_deliveries").get();
  assert.equal(delivery?.status, "failed");
  assert.equal(delivery?.attempts, 3);
  await current.request("/api/bosses", "POST", { action: "countdown", bossId: "morocc", seconds: 500 });
  current.pushResult({ ok: false, status: 410, expired: true });
  await handleScheduled(current.environment, current.dependencies);
  assert.equal((await current.service.state(ownerIdentity)).push.subscriptions, 0);
  current.sqlite.close();
});

test("scheduled lease prevents concurrent dispatch and invalidated timers do not send", async () => {
  const current = fixture();
  await current.request("/api/push/subscribe", "POST", subscription);
  await current.request("/api/bosses", "POST", { action: "countdown", bossId: "morocc", seconds: 590 });
  current.sqlite.prepare("INSERT INTO dispatch_lock(id,lease_until) VALUES ('main',?)").run(noon + 55_000);
  const busy = await handleScheduled(current.environment, current.dependencies);
  assert.equal("busy" in busy && busy.busy, true);
  assert.equal(current.pushes.length, 0);
  await current.request("/api/bosses", "POST", { action: "clear", bossId: "morocc" });
  current.now(noon + 60_000);
  assert.equal((await handleScheduled(current.environment, current.dependencies)).accepted, 0);
  assert.equal(current.pushes.length, 0);
  current.sqlite.close();
});

test("Worker scheduled handler registers the server dispatch promise with waitUntil", async () => {
  const current = fixture();
  const pending: Promise<unknown>[] = [];
  worker.scheduled({} as ScheduledController, current.environment, {
    waitUntil(promise: Promise<unknown>) { pending.push(promise); },
  } as ExecutionContext);
  assert.equal(pending.length, 1);
  await Promise.all(pending);
  assert.equal(current.queries.some((query) => query.includes("dispatch_lock")), true);
  current.sqlite.close();
});

test("database errors return generic private errors without leaking SQL or credential values", async () => {
  const current = fixture();
  const previous = console.error;
  const logs: unknown[][] = [];
  console.error = (...values) => { logs.push(values); };
  try {
    const response = await handleRequest(new Request("https://api.example.workers.dev/api/state", {
      headers: { Origin: allowedOrigin, Authorization: `Bearer ${connectionKey}` },
    }), {
      ...current.environment,
      DB: { prepare() { throw new Error(`${subscription.endpoint} ${vapid.privateKey}`); } } as unknown as D1Database,
    }, current.dependencies);
    assert.equal(response.status, 500);
    assertPrivateResponse(await response.text());
    assert.equal(JSON.stringify(logs).includes(subscription.endpoint), false);
    assert.equal(JSON.stringify(logs).includes(vapid.privateKey), false);
  } finally {
    console.error = previous;
    current.sqlite.close();
  }
});
