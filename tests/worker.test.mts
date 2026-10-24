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
import { updateBoss } from "../lib/timers.js";

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

function fixture(environmentOverrides: Partial<WorkerEnvironment> = {}) {
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
    ...environmentOverrides,
  };
  const dependencies = {
    now: () => currentTime,
    sendPush: async (device: ValidatedSubscription, payload: PushPayload, credentials: VapidEnvironment) => {
      pushes.push({ subscription: device, payload, environment: credentials });
      return result;
    },
  };
  async function request(pathname: string, method = "GET", input?: unknown, extraHeaders?: Record<string, string | null>) {
    const headers = new Headers({ Origin: allowedOrigin, Authorization: `Bearer ${connectionKey}` });
    for (const [name, value] of Object.entries(extraHeaders || {})) {
      if (value === null) headers.delete(name);
      else headers.set(name, value);
    }
    if (input !== undefined) headers.set("Content-Type", "application/json");
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

test("public timers require the exact string true and every other flag preserves owner authentication", async () => {
  for (const enabled of [undefined, "false", "", "True", "TRUE", " true ", "1", true as unknown as string]) {
    const current = fixture({ PUBLIC_TIMERS: enabled });
    const response = await current.request("/api/state", "GET", undefined, { Authorization: null });
    assert.equal(response.status, 401);
    assert.equal(current.queries.length, 0);
    assert.equal((await current.request("/api/state")).status, 200);
    current.sqlite.close();
  }
  const current = fixture({ PUBLIC_TIMERS: "false", OWNER_KEY_SHA256: undefined });
  assert.equal((await current.request("/api/state", "GET", undefined, { Authorization: null })).status, 503);
  assert.equal(current.queries.length, 0);
  current.sqlite.close();
});

test("public opt-in removes the code requirement without changing saved timers or exposing credentials", async () => {
  const current = fixture();
  await current.request("/api/bosses", "POST", { action: "countdown", bossId: "death-knight", seconds: 300 });
  await current.request("/api/bosses", "POST", { action: "countdown", bossId: "naght-sieger", seconds: 360 });
  await current.request("/api/push/subscribe", "POST", subscription);
  const before = current.sqlite.prepare("SELECT * FROM timer_accounts WHERE user_id=?").get(ownerIdentity);
  const deviceBefore = current.sqlite.prepare("SELECT * FROM push_subscriptions").all();
  current.environment.PUBLIC_TIMERS = "true";
  delete current.environment.OWNER_KEY_SHA256;
  const response = await current.request("/api/state", "GET", undefined, { Authorization: null });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), allowedOrigin);
  assert.equal(response.headers.get("Access-Control-Allow-Credentials"), null);
  const encoded = await response.text();
  assertPrivateResponse(encoded);
  const data = JSON.parse(encoded);
  assert.deepEqual(Object.keys(data).sort(), ["alerts", "bosses", "push", "revision", "schedule", "serverNow"]);
  assert.deepEqual(Object.keys(data.push).sort(), ["alertKinds", "configured", "lastDispatchAt", "publicKey", "schedulerReady", "subscriptions"]);
  assert.equal(data.push.publicKey, vapid.publicKey);
  assert.equal(data.push.subscriptions, 1);
  assert.equal(data.bosses.find((boss: { id: string }) => boss.id === "death-knight").dueAt, noon + 300_000);
  assert.equal(data.bosses.find((boss: { id: string }) => boss.id === "naght-sieger").dueAt, noon + 360_000);
  assert.deepEqual(current.sqlite.prepare("SELECT * FROM timer_accounts WHERE user_id=?").get(ownerIdentity), before);
  assert.deepEqual(current.sqlite.prepare("SELECT * FROM push_subscriptions").all(), deviceBefore);
  current.sqlite.close();
});

test("public callers edit the same fixed owner roster and cannot select another account", async () => {
  const current = fixture({ PUBLIC_TIMERS: "true", OWNER_KEY_SHA256: undefined });
  const withoutCode = { Authorization: null };
  const initial = await (await current.request("/api/state", "GET", undefined, withoutCode)).json();
  current.sqlite.prepare("INSERT INTO timer_accounts (user_id,bosses,revision,updated_at) VALUES (?,?,0,?)")
    .run("different-owner", JSON.stringify(initial.bosses), noon);
  const otherBefore = current.sqlite.prepare("SELECT * FROM timer_accounts WHERE user_id='different-owner'").get();
  const edited = await current.request("/api/bosses", "POST", { action: "countdown", bossId: "morocc", seconds: 600, userId: "different-owner" }, withoutCode);
  assert.equal(edited.status, 200);
  assertPrivateResponse(await edited.text());
  const secondVisitor = await (await current.request("/api/state", "GET", undefined, withoutCode)).json();
  assert.equal(secondVisitor.bosses.find((boss: { id: string }) => boss.id === "morocc").dueAt, noon + 600_000);
  assert.equal(secondVisitor.revision, initial.revision + 1);
  assert.deepEqual(current.sqlite.prepare("SELECT * FROM timer_accounts WHERE user_id='different-owner'").get(), otherBefore);
  assert.equal((await current.request("/api/bosses", "POST", { action: "favorite", bossId: "morocc", favorite: true }, withoutCode)).status, 200);
  const latest = await (await current.request("/api/state", "GET", undefined, withoutCode)).json();
  assert.equal(latest.bosses.find((boss: { id: string }) => boss.id === "morocc").favorite, true);
  current.sqlite.close();
});

test("public mode still rejects forged Sites identity, untrusted origins and oversized JSON before storage", async () => {
  const current = fixture({ PUBLIC_TIMERS: "true", OWNER_KEY_SHA256: undefined });
  const forged = await current.request("/api/state", "GET", undefined, { Authorization: null, "oai-authenticated-user-id": "victim" });
  assert.equal(forged.status, 403);
  for (const origin of ["null", "https://attacker.test", "https://yukikiie.github.io.attacker.test", "http://yukikiie.github.io"]) {
    const response = await current.request("/api/state", "GET", undefined, { Authorization: null, Origin: origin });
    assert.equal(response.status, 403);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), null);
  }
  for (const [body, contentType, status] of [
    [JSON.stringify({ ignored: "字".repeat(8192) }), "application/json", 413],
    ["[]", "application/json", 400],
    ["{}", "text/plain", 415],
  ] as const) {
    const response = await handleRequest(new Request("https://api.example.workers.dev/api/bosses", {
      method: "POST", headers: { Origin: allowedOrigin, "Content-Type": contentType }, body,
    }), current.environment, current.dependencies);
    assert.equal(response.status, status);
  }
  assert.equal(current.queries.length, 0);
  const preflight = await handleRequest(new Request("https://api.example.workers.dev/api/bosses", {
    method: "OPTIONS", headers: { Origin: allowedOrigin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type" },
  }), current.environment, current.dependencies);
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("Access-Control-Allow-Origin"), allowedOrigin);
  assert.equal(preflight.headers.get("Access-Control-Allow-Credentials"), null);
  assert.equal(current.queries.length, 0);
  current.sqlite.close();
});

test("public push operations require the specific endpoint capability and never enumerate or alter other devices", async () => {
  const current = fixture({ PUBLIC_TIMERS: "true", OWNER_KEY_SHA256: undefined });
  const withoutCode = { Authorization: null };
  const second: ValidatedSubscription = { ...subscription, endpoint: "https://web.push.apple.com/second-private-endpoint", keys: { ...subscription.keys, auth: Buffer.alloc(16, 29).toString("base64url") } };
  for (const device of [subscription, second]) {
    const response = await current.request("/api/push/subscribe", "POST", device, withoutCode);
    assert.equal(response.status, 200);
    const body = await response.text();
    assertPrivateResponse(body);
    assert.equal(body.includes(second.endpoint), false);
    assert.equal(body.includes(second.keys.auth), false);
  }
  const devices = () => current.sqlite.prepare("SELECT id,tested_at FROM push_subscriptions ORDER BY id").all();
  const before = devices();
  for (const pathname of ["/api/push/status", "/api/push/test", "/api/push/subscribe"]) {
    const method = pathname === "/api/push/subscribe" ? "DELETE" : "POST";
    assert.equal((await current.request(pathname, method, {}, withoutCode)).status, 400);
  }
  const unknownEndpoint = "https://web.push.apple.com/unknown-capability";
  assert.deepEqual(await (await current.request("/api/push/status", "POST", { endpoint: unknownEndpoint }, withoutCode)).json(), { connected: false, testedAt: null });
  assert.equal((await current.request("/api/push/test", "POST", { endpoint: unknownEndpoint }, withoutCode)).status, 404);
  assert.equal((await current.request("/api/push/subscribe", "DELETE", { endpoint: unknownEndpoint }, withoutCode)).status, 200);
  assert.deepEqual(devices(), before);
  assert.equal(current.pushes.length, 0);
  for (const pathname of ["/api/dispatch", "/api/subscriptions", "/api/push/subscriptions"]) {
    const response = await current.request(pathname, "GET", undefined, withoutCode);
    assert.equal(response.status, 404);
    assertPrivateResponse(await response.text());
  }
  assert.equal((await current.request("/api/dispatch", "POST", {}, withoutCode)).status, 404);
  assert.equal((await current.request("/api/push/subscribe", "GET", undefined, withoutCode)).status, 405);
  const tested = await current.request("/api/push/test", "POST", { endpoint: subscription.endpoint }, withoutCode);
  assert.equal(tested.status, 200);
  assertPrivateResponse(await tested.text());
  assert.equal(current.pushes.length, 1);
  assert.equal(current.pushes[0].subscription.endpoint, subscription.endpoint);
  assert.deepEqual(await (await current.request("/api/push/status", "POST", { endpoint: second.endpoint }, withoutCode)).json(), { connected: true, testedAt: null });
  const removed = await current.request("/api/push/subscribe", "DELETE", { endpoint: subscription.endpoint }, withoutCode);
  assert.equal(removed.status, 200);
  assert.equal((await removed.json()).push.subscriptions, 1);
  assert.deepEqual(await (await current.request("/api/push/status", "POST", { endpoint: subscription.endpoint }, withoutCode)).json(), { connected: false, testedAt: null });
  assert.deepEqual(await (await current.request("/api/push/status", "POST", { endpoint: second.endpoint }, withoutCode)).json(), { connected: true, testedAt: null });
  current.sqlite.close();
});

test("public mode leaves minute cron and per-device10/5/1/spawn dedup unchanged without an owner code", async () => {
  const current = fixture({ PUBLIC_TIMERS: "true", OWNER_KEY_SHA256: undefined });
  const withoutCode = { Authorization: null };
  await current.request("/api/push/subscribe", "POST", subscription, withoutCode);
  await current.request("/api/bosses", "POST", { action: "countdown", bossId: "morocc", seconds: 590 }, withoutCode);
  for (const offset of [0, 300_000, 530_000, 590_000]) {
    current.now(noon + offset);
    assert.equal((await handleScheduled(current.environment, current.dependencies)).accepted, 1);
    assert.equal((await handleScheduled(current.environment, current.dependencies)).accepted, 0);
  }
  assert.deepEqual(current.pushes.map((push) => push.payload.title), ["夢羅克 · 10 分鐘提醒", "夢羅克 · 5 分鐘提醒", "夢羅克 · 1 分鐘提醒", "夢羅克 · 重生時間到"]);
  current.sqlite.close();
});

test("deployment explicitly opts into public timers without putting private values in Wrangler variables", async () => {
  const configuration = JSON.parse(await readFile(new URL("../worker/wrangler.jsonc", import.meta.url), "utf8"));
  assert.equal(configuration.vars.PUBLIC_TIMERS, "true");
  assert.equal(configuration.vars.MVP_ALERTS_ENABLED, "true");
  assert.equal(configuration.vars.MINI_ALERTS_ENABLED, "true");
  assert.equal(configuration.vars.ALLOWED_ORIGIN, allowedOrigin);
  assert.deepEqual(configuration.triggers.crons, ["* * * * *"]);
  assert.equal("OWNER_KEY_SHA256" in configuration.vars, false);
  assert.equal("VAPID_PRIVATE_KEY" in configuration.vars, false);
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
  current.now(noon + 530_000);
  assert.equal((await handleScheduled(current.environment, current.dependencies)).accepted, 1);
  assert.match(current.pushes[2].payload.title, /1 分鐘提醒/);
  assert.equal((await handleScheduled(current.environment, current.dependencies)).accepted, 0);
  assert.equal(current.pushes.length, 3);
  current.now(noon + 590_000);
  assert.equal((await handleScheduled(current.environment, current.dependencies)).accepted, 1);
  assert.match(current.pushes[3].payload.title, /重生時間到/);
  assert.equal((await handleScheduled(current.environment, current.dependencies)).accepted, 0);
  current.sqlite.close();
});

test("alert-kind policy defaults to both kinds and reports a read-only Mini-only policy without secrets", async () => {
  const legacy = fixture();
  const originalState = await (await legacy.request("/api/state")).json();
  assert.deepEqual(originalState.push.alertKinds, ["MVP", "Mini"]);
  legacy.sqlite.close();
  const current = fixture({ PUBLIC_TIMERS: "true", OWNER_KEY_SHA256: undefined, MVP_ALERTS_ENABLED: "false", MINI_ALERTS_ENABLED: "true" });
  const response = await current.request("/api/state", "GET", undefined, { Authorization: null });
  assert.equal(response.status, 200);
  const encoded = await response.text();
  assertPrivateResponse(encoded);
  assert.deepEqual(JSON.parse(encoded).push.alertKinds, ["Mini"]);
  assert.equal(JSON.parse(encoded).bosses.some((boss: { kind: string }) => boss.kind === "MVP"), true);
  assert.equal((await current.request("/api/push/preferences", "POST", { MVP_ALERTS_ENABLED: "true" }, { Authorization: null })).status, 404);
  current.sqlite.close();
});

test("alert-kind flags disable only boolean false or trimmed case-insensitive false", async () => {
  for (const flag of [false, "false", "False", " FALSE "]) {
    const current = fixture({ MVP_ALERTS_ENABLED: flag, MINI_ALERTS_ENABLED: flag });
    assert.deepEqual((await current.service.state(ownerIdentity)).push.alertKinds, []);
    await current.request("/api/push/subscribe", "POST", subscription);
    await current.request("/api/bosses", "POST", { action: "countdown", bossId: "morocc", seconds: 60 });
    await current.request("/api/bosses", "POST", { action: "countdown", bossId: "boitata", seconds: 60 });
    assert.equal((await handleScheduled(current.environment, current.dependencies)).accepted, 0);
    assert.equal(current.pushes.length, 0);
    current.sqlite.close();
  }
  for (const flag of [undefined, true, "true", "", "0", "off"]) {
    const current = fixture({ MVP_ALERTS_ENABLED: flag, MINI_ALERTS_ENABLED: flag });
    assert.deepEqual((await current.service.state(ownerIdentity)).push.alertKinds, ["MVP", "Mini"]);
    current.sqlite.close();
  }
});

test("muted MVP timers produce no10/5/1/spawn push attempts or delivery claims", async () => {
  const current = fixture({ MVP_ALERTS_ENABLED: "false", MINI_ALERTS_ENABLED: "true" });
  await current.request("/api/push/subscribe", "POST", subscription);
  await current.request("/api/bosses", "POST", { action: "countdown", bossId: "morocc", seconds: 590 });
  for (const offset of [0, 300_000, 530_000, 590_000, 710_000]) {
    current.now(noon + offset);
    const result = await handleScheduled(current.environment, current.dependencies);
    assert.equal(result.accepted, 0);
    assert.equal(result.failed, 0);
  }
  assert.equal(current.pushes.length, 0);
  assert.equal(current.sqlite.prepare("SELECT COUNT(*) AS count FROM push_deliveries").get()?.count, 0);
  assert.equal(current.sqlite.prepare("SELECT COUNT(*) AS count FROM timer_alerts").get()?.count, 0);
  const state = await current.service.state(ownerIdentity);
  const morocc = state.bosses.find((boss: { id: string }) => boss.id === "morocc");
  assert.equal(morocc.dueAt, noon + 590_000);
  assert.equal(morocc.observedAt, noon);
  assert.equal(morocc.source, "manual");
  assert.equal(morocc.kind, "MVP");
  assert.equal(state.push.schedulerReady, true);
  assert.equal(state.push.subscriptions, 1);
  current.sqlite.close();
});

test("Mini alerts retain all four windows and dedup while MVP timers and subscriptions remain stored", async () => {
  const current = fixture({ MVP_ALERTS_ENABLED: "false", MINI_ALERTS_ENABLED: "true" });
  await current.request("/api/push/subscribe", "POST", subscription);
  await current.request("/api/bosses", "POST", { action: "countdown", bossId: "morocc", seconds: 590 });
  await current.request("/api/bosses", "POST", { action: "countdown", bossId: "boitata", seconds: 590 });
  const before = (await current.service.state(ownerIdentity)).bosses;
  const subscriptionsBefore = current.sqlite.prepare("SELECT * FROM push_subscriptions").all();
  for (const offset of [0, 300_000, 530_000, 590_000]) {
    current.now(noon + offset);
    assert.equal((await handleScheduled(current.environment, current.dependencies)).accepted, 1);
    assert.equal((await handleScheduled(current.environment, current.dependencies)).accepted, 0);
  }
  assert.deepEqual(current.pushes.map((push) => push.payload.title), ["波伊塔塔 · 10 分鐘提醒", "波伊塔塔 · 5 分鐘提醒", "波伊塔塔 · 1 分鐘提醒", "波伊塔塔 · 重生時間到"]);
  for (const push of current.pushes) assert.doesNotMatch(push.payload.body, /夢羅克|MVP/);
  const after = (await current.service.state(ownerIdentity)).bosses;
  assert.deepEqual(after.map(({ status, ...saved }) => saved), before.map(({ status, ...saved }) => saved));
  assert.equal(after.find((boss: { id: string }) => boss.id === "morocc").status, "due");
  assert.deepEqual(current.sqlite.prepare("SELECT * FROM push_subscriptions").all(), subscriptionsBefore);
  assert.equal(current.sqlite.prepare("SELECT COUNT(*) AS count FROM push_deliveries").get()?.count, 4);
  assert.equal(current.sqlite.prepare("SELECT COUNT(*) AS count FROM timer_alerts").get()?.count, 4);
  current.sqlite.close();
});

test("Mini-only route context excludes an earlier MVP without altering any valid saved timer or revision", async () => {
  const current = fixture({ MVP_ALERTS_ENABLED: "false", MINI_ALERTS_ENABLED: "true" });
  await current.request("/api/push/subscribe", "POST", subscription);
  await current.request("/api/bosses", "POST", { action: "countdown", bossId: "death-knight", seconds: 300 });
  await current.request("/api/bosses", "POST", { action: "countdown", bossId: "naght-sieger", seconds: 360 });
  await current.request("/api/bosses", "POST", { action: "countdown", bossId: "boitata", seconds: 420 });
  const before = current.sqlite.prepare("SELECT * FROM timer_accounts WHERE user_id=?").get(ownerIdentity);
  assert.equal((await handleScheduled(current.environment, current.dependencies)).accepted, 2);
  assert.deepEqual(current.pushes.map((push) => push.payload.title), ["納戶特基格 · 10 分鐘提醒", "波伊塔塔 · 10 分鐘提醒"]);
  for (const push of current.pushes) {
    assert.match(push.payload.body, /先前往 納戶特基格（剩 6 分鐘）/);
    assert.match(push.payload.body, /接著準備 波伊塔塔（剩 7 分鐘；相隔 1 分鐘）/);
    assert.doesNotMatch(push.payload.body, /死靈騎士|MVP/);
  }
  assert.deepEqual(current.sqlite.prepare("SELECT * FROM timer_accounts WHERE user_id=?").get(ownerIdentity), before);
  assert.equal((await handleScheduled(current.environment, current.dependencies)).accepted, 0);
  current.sqlite.close();
});

test("final dispatch recheck cancels a formerly Mini candidate when it is now a muted MVP", async () => {
  const current = fixture({ MVP_ALERTS_ENABLED: "false", MINI_ALERTS_ENABLED: "true" });
  await current.request("/api/push/subscribe", "POST", subscription);
  await current.request("/api/bosses", "POST", { action: "countdown", bossId: "boitata", seconds: 590 });
  const originalDatabase = current.environment.DB!;
  let revised = false;
  current.environment.DB = {
    prepare(query: string) {
      if (query === "SELECT bosses FROM timer_accounts WHERE user_id=?" && !revised) {
        revised = true;
        const saved = current.sqlite.prepare("SELECT bosses FROM timer_accounts WHERE user_id=?").get(ownerIdentity) as { bosses: string };
        const changed = JSON.parse(saved.bosses).map((boss: { id: string }) => boss.id === "boitata" ? { ...boss, kind: "MVP" } : boss);
        current.sqlite.prepare("UPDATE timer_accounts SET bosses=?,revision=revision+1 WHERE user_id=?").run(JSON.stringify(changed), ownerIdentity);
      }
      return originalDatabase.prepare(query);
    },
  } as unknown as D1Database;
  assert.equal((await handleScheduled(current.environment, current.dependencies)).accepted, 0);
  assert.equal(revised, true);
  assert.equal(current.pushes.length, 0);
  assert.equal(current.sqlite.prepare("SELECT status FROM push_deliveries").get()?.status, "cancelled");
  assert.equal(current.sqlite.prepare("SELECT COUNT(*) AS count FROM timer_alerts").get()?.count, 0);
  current.sqlite.close();
});

test("muting MVP alerts does not retry an existing failed MVP delivery or remove its history", async () => {
  const current = fixture();
  await current.request("/api/push/subscribe", "POST", subscription);
  await current.request("/api/bosses", "POST", { action: "countdown", bossId: "morocc", seconds: 590 });
  current.pushResult({ ok: false, status: 503, expired: false });
  assert.equal((await handleScheduled(current.environment, current.dependencies)).failed, 1);
  const deliveryBefore = current.sqlite.prepare("SELECT * FROM push_deliveries").all();
  const historyBefore = current.sqlite.prepare("SELECT * FROM timer_alerts").all();
  current.environment.MVP_ALERTS_ENABLED = "false";
  current.environment.MINI_ALERTS_ENABLED = "true";
  for (const offset of [60_000, 300_000, 530_000, 590_000]) {
    current.now(noon + offset);
    const result = await handleScheduled(current.environment, current.dependencies);
    assert.equal(result.accepted, 0);
    assert.equal(result.failed, 0);
  }
  assert.equal(current.pushes.length, 1);
  assert.deepEqual(current.sqlite.prepare("SELECT * FROM push_deliveries").all(), deliveryBefore);
  assert.deepEqual(current.sqlite.prepare("SELECT * FROM timer_alerts").all(), historyBefore);
  assert.deepEqual((await (await current.request("/api/state")).json()).push.alertKinds, ["Mini"]);
  current.sqlite.close();
});

test("MVP mute leaves explicit device test notifications and kind-independent subscription operations working", async () => {
  const current = fixture({ MVP_ALERTS_ENABLED: "false", MINI_ALERTS_ENABLED: "true" });
  await current.request("/api/push/subscribe", "POST", subscription);
  const response = await current.request("/api/push/test", "POST", { endpoint: subscription.endpoint });
  assert.equal(response.status, 200);
  const encoded = await response.text();
  assertPrivateResponse(encoded);
  assert.equal(JSON.parse(encoded).testAccepted, true);
  assert.deepEqual(JSON.parse(encoded).push.alertKinds, ["Mini"]);
  assert.equal(current.pushes.length, 1);
  assert.equal(current.pushes[0].payload.title, "Yuki RO · 通知測試");
  assert.equal((await current.request("/api/push/status", "POST", { endpoint: subscription.endpoint })).status, 200);
  current.sqlite.close();
});

test("one-minute reminders include the next confirmed boss without duplicate deliveries", async () => {
  const current = fixture();
  await current.request("/api/push/subscribe", "POST", subscription);
  await current.request("/api/bosses", "POST", { action: "countdown", bossId: "morocc", seconds: 60 });
  await current.request("/api/bosses", "POST", { action: "countdown", bossId: "boitata", seconds: 900 });
  assert.equal((await handleScheduled(current.environment, current.dependencies)).accepted, 1);
  assert.equal(current.pushes.length, 1);
  assert.match(current.pushes[0].payload.title, /夢羅克.*1 分鐘提醒/);
  assert.match(current.pushes[0].payload.body, /波伊塔塔/);
  current.now(noon + 1_000);
  assert.equal((await handleScheduled(current.environment, current.dependencies)).accepted, 0);
  assert.equal(current.pushes.length, 1);
  current.sqlite.close();
});

test("dispatcher sends and persists next-boss context from the final account recheck", async () => {
  const current = fixture();
  await current.request("/api/push/subscribe", "POST", subscription);
  await current.request("/api/bosses", "POST", { action: "countdown", bossId: "morocc", seconds: 590 });
  await current.request("/api/bosses", "POST", { action: "countdown", bossId: "boitata", seconds: 900 });
  const originalDatabase = current.environment.DB!;
  let revised = false;
  current.environment.DB = {
    prepare(query: string) {
      if (query === "SELECT bosses FROM timer_accounts WHERE user_id=?" && !revised) {
        revised = true;
        const record = current.sqlite.prepare("SELECT bosses FROM timer_accounts WHERE user_id=?").get(ownerIdentity) as { bosses: string };
        const cleared = updateBoss(JSON.parse(record.bosses), { type: "clear", bossId: "boitata" }, noon);
        const bosses = updateBoss(cleared, { type: "countdown", bossId: "lady-tanee", seconds: 900 }, noon);
        current.sqlite.prepare("UPDATE timer_accounts SET bosses=?,revision=revision+1 WHERE user_id=?").run(JSON.stringify(bosses), ownerIdentity);
      }
      return originalDatabase.prepare(query);
    },
  } as unknown as D1Database;
  assert.equal((await handleScheduled(current.environment, current.dependencies)).accepted, 1);
  assert.equal(revised, true);
  assert.equal(current.pushes.length, 1);
  assert.match(current.pushes[0].payload.body, /嗒妮小姐/);
  assert.doesNotMatch(current.pushes[0].payload.body, /波伊塔塔/);
  const alert = current.sqlite.prepare("SELECT message FROM timer_alerts WHERE user_id=?").get(ownerIdentity) as { message: string };
  assert.match(alert.message, /嗒妮小姐/);
  assert.doesNotMatch(alert.message, /波伊塔塔/);
  assert.equal((await handleScheduled(current.environment, current.dependencies)).accepted, 0);
  assert.equal(current.pushes.length, 1);
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
