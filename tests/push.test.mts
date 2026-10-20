import assert from "node:assert/strict";
import { createDecipheriv, createECDH, createPublicKey, hkdfSync, randomBytes, verify } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import webPush from "web-push";

const { sendPush, validateSubscription } = await import(new URL("../lib/push.ts", import.meta.url).href);

const receiver = createECDH("prime256v1");
const receiverPublic = receiver.generateKeys();
const receiverAuth = randomBytes(16);
const subscription = {
  endpoint: "https://web.push.apple.com/valid-test-token",
  keys: { p256dh: receiverPublic.toString("base64url"), auth: receiverAuth.toString("base64url") },
  expirationTime: null,
};
const vapid = webPush.generateVAPIDKeys();
const environment = {
  VAPID_PUBLIC_KEY: vapid.publicKey,
  VAPID_PRIVATE_KEY: vapid.privateKey,
  VAPID_SUBJECT: "https://timers.example.com/",
};

test("accepts actual gateway formats and returns only subscription fields", () => {
  for (const endpoint of [
    subscription.endpoint,
    "https://push.services.mozilla.com/wpush/v2/token_value-1",
    "https://updates.push.services.mozilla.com/wpush/v2/token_value-1",
    "https://fcm.googleapis.com/fcm/send/token:value-1",
    "https://fcm.googleapis.com/wp/token_value-1",
    "https://fcmregistrations.googleapis.com/v1/projects/example/registrations/token",
    "https://wns2-sg2p.notify.windows.com/?token=encoded%2Ftoken",
  ]) {
    const validated = validateSubscription({ ...subscription, endpoint, privateData: "not retained" });
    assert.deepEqual(validated, { ...subscription, endpoint });
  }
});

test("rejects SSRF hosts, arbitrary paths, redirects targets, and URL credentials", () => {
  for (const endpoint of [
    "http://web.push.apple.com/token",
    "https://127.0.0.1/token",
    "https://localhost/token",
    "https://web.push.apple.com.attacker.test/token",
    "https://web.push.apple.com./token",
    "https://user:secret@web.push.apple.com/token",
    "https://web.push.apple.com:8443/token",
    "https://web.push.apple.com/token#fragment",
    "https://web.push.apple.com/token?redirect=http://localhost",
    "https://fcm.googleapis.com/arbitrary-api",
    "https://updates.push.services.mozilla.com/wpush/v2/token%2Fvalue",
    "https://evilnotify.windows.com/?token=value",
    "https://wns2-sg2p.notify.windows.com/?token=value&redirect=evil",
    `https://web.push.apple.com/${"a".repeat(4096)}`,
  ]) {
    assert.throws(() => validateSubscription({ ...subscription, endpoint }), Error, endpoint);
  }
});

test("rejects malformed P-256 points, noncanonical base64url, auth keys, and expiration", () => {
  const invalidPoint = Buffer.alloc(65);
  invalidPoint[0] = 4;
  for (const input of [
    null,
    [],
    { ...subscription, keys: null },
    { ...subscription, keys: { ...subscription.keys, p256dh: invalidPoint.toString("base64url") } },
    { ...subscription, keys: { ...subscription.keys, p256dh: `${subscription.keys.p256dh}=` } },
    { ...subscription, keys: { ...subscription.keys, auth: randomBytes(15).toString("base64url") } },
    { ...subscription, keys: { ...subscription.keys, auth: "A".repeat(21) + "B" } },
    { ...subscription, expirationTime: -1 },
    { ...subscription, expirationTime: Number.NaN },
    { ...subscription, expirationTime: "tomorrow" },
  ]) {
    assert.throws(() => validateSubscription(input));
  }
});

test("sends a decryptable RFC 8291 AES128GCM message with a valid VAPID signature", async () => {
  const originalFetch = globalThis.fetch;
  let captured: RequestInit | undefined;
  globalThis.fetch = async (endpoint, options) => {
    assert.equal(endpoint, subscription.endpoint);
    captured = options;
    return new Response(null, { status: 201 });
  };
  try {
    assert.deepEqual(await sendPush(subscription, {
      title: "阿特羅斯 · 5 minutes",
      body: "Boss appears soon.",
      tag: "atroce-5m",
      url: "https://attacker.example/",
    }, environment), { ok: true, status: 201, expired: false });
    assert.ok(captured);
    assert.equal(captured.method, "POST");
    assert.equal(captured.redirect, "manual");
    assert.ok(captured.signal);
    const headers = new Headers(captured.headers);
    assert.equal(headers.get("content-encoding"), "aes128gcm");
    assert.equal(headers.get("ttl"), "90");
    assert.equal(headers.get("urgency"), "high");
    const encrypted = Buffer.from(captured.body as ArrayBuffer);
    const salt = encrypted.subarray(0, 16);
    assert.equal(encrypted.readUInt32BE(16), 4096);
    assert.equal(encrypted[20], 65);
    const ephemeralPublic = encrypted.subarray(21, 86);
    const shared = receiver.computeSecret(ephemeralPublic);
    const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), receiverPublic, ephemeralPublic]);
    const intermediate = Buffer.from(hkdfSync("sha256", shared, receiverAuth, keyInfo, 32));
    const key = Buffer.from(hkdfSync("sha256", intermediate, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
    const nonce = Buffer.from(hkdfSync("sha256", intermediate, salt, Buffer.from("Content-Encoding: nonce\0"), 12));
    const decipher = createDecipheriv("aes-128-gcm", key, nonce);
    decipher.setAuthTag(encrypted.subarray(-16));
    const plaintext = Buffer.concat([decipher.update(encrypted.subarray(86, -16)), decipher.final()]);
    assert.equal(plaintext.at(-1), 2);
    assert.deepEqual(JSON.parse(plaintext.subarray(0, -1).toString()), {
      title: "阿特羅斯 · 5 minutes", body: "Boss appears soon.", tag: "atroce-5m", url: "/",
    });
    const authorization = headers.get("authorization");
    assert.ok(authorization);
    const match = /^vapid t=([^,]+), k=(.+)$/.exec(authorization);
    assert.ok(match);
    assert.equal(match[2], vapid.publicKey);
    const [header, claims, signature] = match[1].split(".");
    assert.deepEqual(JSON.parse(Buffer.from(header, "base64url").toString()), { typ: "JWT", alg: "ES256" });
    const decodedClaims = JSON.parse(Buffer.from(claims, "base64url").toString());
    assert.equal(decodedClaims.aud, "https://web.push.apple.com");
    assert.equal(decodedClaims.sub, environment.VAPID_SUBJECT);
    assert.ok(decodedClaims.exp > Date.now() / 1000);
    assert.ok(decodedClaims.exp <= Date.now() / 1000 + 86400);
    const publicBytes = Buffer.from(vapid.publicKey, "base64url");
    const publicKey = createPublicKey({
      key: {
        kty: "EC", crv: "P-256",
        x: publicBytes.subarray(1, 33).toString("base64url"),
        y: publicBytes.subarray(33).toString("base64url"),
      },
      format: "jwk",
    });
    assert.equal(verify("sha256", Buffer.from(`${header}.${claims}`), {
      key: publicKey, dsaEncoding: "ieee-p1363",
    }, Buffer.from(signature, "base64url")), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejects redirects and marks only removed subscriptions expired", async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const status of [301, 307, 404, 410, 429, 503]) {
      globalThis.fetch = async (_endpoint, options) => {
        assert.equal(options?.redirect, "manual");
        return new Response(null, { status, headers: { Location: "http://127.0.0.1/private" } });
      };
      assert.deepEqual(await sendPush(subscription, { title: "Test", body: "Test" }, environment), {
        ok: false, status, expired: status === 404 || status === 410,
      });
    }
    globalThis.fetch = async () => { throw new Error("Offline"); };
    assert.deepEqual(await sendPush(subscription, { title: "Test", body: "Test" }, environment), {
      ok: false, status: 0, expired: false,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("keeps gateway acceptance when optional response cleanup fails", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(new ReadableStream({
    cancel() { throw new Error("Cleanup failed"); },
  }), { status: 201 });
  try {
    assert.deepEqual(await sendPush(subscription, { title: "Test", body: "Test" }, environment), {
      ok: true, status: 201, expired: false,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("does not send expired, unsupported, misconfigured, or oversized messages", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("Unexpected network call"); };
  try {
    assert.deepEqual(await sendPush({ ...subscription, expirationTime: Date.now() - 1 }, {
      title: "Test", body: "Test",
    }, environment), { ok: false, status: 410, expired: true });
    await assert.rejects(sendPush(subscription, { title: "Test", body: "Test" }, {}));
    await assert.rejects(sendPush(subscription, { title: "Test", body: "Test" }, {
      ...environment, VAPID_SUBJECT: "https://localhost/",
    }));
    await assert.rejects(sendPush(subscription, { title: "Test", body: "X".repeat(321) }, environment));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("aborts a gateway request after ten seconds", async (context) => {
  const originalFetch = globalThis.fetch;
  context.mock.timers.enable({ apis: ["setTimeout"] });
  let aborted = false;
  globalThis.fetch = async (_endpoint, options) => new Promise((_resolve, reject) => {
    options?.signal?.addEventListener("abort", () => {
      aborted = true;
      reject(new Error("Timed out"));
    });
  });
  try {
    const delivery = sendPush(subscription, { title: "Test", body: "Test" }, environment);
    context.mock.timers.tick(10_000);
    assert.deepEqual(await delivery, { ok: false, status: 0, expired: false });
    assert.equal(aborted, true);
  } finally {
    context.mock.timers.reset();
    globalThis.fetch = originalFetch;
  }
});

test("service worker shows deduplicated notifications and cannot open a payload URL", async () => {
  const listeners = new Map<string, (event: Record<string, unknown>) => void>();
  const displayed: Array<{ title: string; options: Record<string, unknown> }> = [];
  const opened: string[] = [];
  const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  const worker = {
    addEventListener: (name: string, listener: (event: Record<string, unknown>) => void) => listeners.set(name, listener),
    skipWaiting: async () => undefined,
    location: { origin: "https://timers.example.com" },
    registration: {
      scope: "https://yukikiie.github.io/yuki-ro-boss-timers/",
      showNotification: async (title: string, options: Record<string, unknown>) => { displayed.push({ title, options }); },
    },
    clients: {
      claim: async () => undefined,
      matchAll: async () => [],
      openWindow: async (url: string) => { opened.push(url); },
    },
  };
  vm.runInNewContext(source, { self: worker, URL });
  let pending: Promise<unknown> = Promise.resolve();
  listeners.get("push")?.({
    data: { json: () => ({ title: "Ready", body: "Boss due", tag: "boss-cycle", url: "https://evil.example/" }) },
    waitUntil: (promise: Promise<unknown>) => { pending = promise; },
  });
  await pending;
  assert.equal(displayed[0].title, "Ready");
  assert.equal(displayed[0].options.tag, "boss-cycle");
  assert.equal((displayed[0].options.data as { url: string }).url, "https://yukikiie.github.io/yuki-ro-boss-timers/");
  listeners.get("notificationclick")?.({
    notification: { close: () => undefined, data: { url: "https://evil.example/" } },
    waitUntil: (promise: Promise<unknown>) => { pending = promise; },
  });
  await pending;
  assert.deepEqual(opened, ["https://yukikiie.github.io/yuki-ro-boss-timers/"]);
  assert.equal(listeners.has("fetch"), false);
});
