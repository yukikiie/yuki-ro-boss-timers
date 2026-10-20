import webPush from "web-push";

export type ValidatedSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  expirationTime?: number | null;
};

export type PushPayload = {
  title: string;
  body: string;
  tag?: string;
  url?: string;
};

export type VapidEnvironment = {
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
};

export type PushResult = { ok: boolean; status: number; expired: boolean };

function record(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Invalid push subscription.");
  }
  return input as Record<string, unknown>;
}

function decodeKey(input: unknown, length: number, name: string): Uint8Array {
  if (typeof input !== "string" || !/^[A-Za-z0-9_-]+$/.test(input)) {
    throw new Error(`Invalid ${name} key.`);
  }
  const expectedLength = Math.ceil((length * 8) / 6);
  if (input.length !== expectedLength) throw new Error(`Invalid ${name} key.`);
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const decoded = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  if (decoded.length !== length) throw new Error(`Invalid ${name} key.`);
  const encoded = btoa(String.fromCharCode(...decoded))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  if (encoded !== input) throw new Error(`Invalid ${name} key.`);
  return decoded;
}

function integer(bytes: Uint8Array): bigint {
  return BigInt(`0x${Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("")}`);
}

function assertPublicPoint(bytes: Uint8Array): void {
  if (bytes[0] !== 4) throw new Error("Invalid P-256 public key.");
  const prime = BigInt("0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff");
  const coefficient = BigInt("0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604b");
  const horizontal = integer(bytes.slice(1, 33));
  const vertical = integer(bytes.slice(33, 65));
  const equation = ((horizontal ** BigInt(3) - BigInt(3) * horizontal + coefficient) % prime + prime) % prime;
  if (horizontal >= prime || vertical >= prime || (vertical * vertical) % prime !== equation) {
    throw new Error("Invalid P-256 public key.");
  }
}

function allowedGateway(endpoint: URL): boolean {
  const { hostname, pathname, searchParams, search } = endpoint;
  if (hostname === "web.push.apple.com") {
    return !search && /^\/[A-Za-z0-9_-]+$/.test(pathname);
  }
  if (hostname === "push.services.mozilla.com" || hostname === "updates.push.services.mozilla.com") {
    return !search && /^\/wpush\/v[12]\/[A-Za-z0-9_-]+$/.test(pathname);
  }
  if (hostname === "fcm.googleapis.com") {
    return !search && /^\/(?:fcm\/send|wp)\/[A-Za-z0-9:_-]+$/.test(pathname);
  }
  if (hostname === "fcmregistrations.googleapis.com") {
    return !search && /^\/v1\/[A-Za-z0-9_:/.-]+$/.test(pathname);
  }
  if (/^[a-z0-9-]+\.notify\.windows\.com$/.test(hostname)) {
    return pathname === "/" && searchParams.size === 1 && !!searchParams.get("token");
  }
  return false;
}

export function validateSubscription(input: unknown): ValidatedSubscription {
  const subscription = record(input);
  if (typeof subscription.endpoint !== "string" || subscription.endpoint.length > 4096) {
    throw new Error("Invalid push endpoint.");
  }
  let endpoint: URL;
  try {
    endpoint = new URL(subscription.endpoint);
  } catch {
    throw new Error("Invalid push endpoint.");
  }
  if (
    endpoint.protocol !== "https:" || endpoint.username || endpoint.password ||
    endpoint.hash || endpoint.port || !allowedGateway(endpoint)
  ) {
    throw new Error("Unsupported push gateway.");
  }
  const keys = record(subscription.keys);
  assertPublicPoint(decodeKey(keys.p256dh, 65, "p256dh"));
  decodeKey(keys.auth, 16, "auth");
  const validated: ValidatedSubscription = {
    endpoint: endpoint.href,
    keys: { p256dh: keys.p256dh as string, auth: keys.auth as string },
  };
  if (subscription.expirationTime !== undefined) {
    if (
      subscription.expirationTime !== null &&
      (typeof subscription.expirationTime !== "number" ||
        !Number.isFinite(subscription.expirationTime) || subscription.expirationTime < 0)
    ) {
      throw new Error("Invalid push expiration time.");
    }
    validated.expirationTime = subscription.expirationTime;
  }
  return validated;
}

function vapidDetails(environment: VapidEnvironment) {
  const { VAPID_SUBJECT: subject, VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey } = environment;
  if (!subject || !publicKey || !privateKey) throw new Error("Phone notifications are not configured.");
  let contact: URL;
  try {
    contact = new URL(subject);
  } catch {
    throw new Error("Invalid notification contact URL.");
  }
  if (
    contact.protocol !== "https:" || contact.username || contact.password || contact.hash ||
    !contact.hostname.includes(".") || contact.hostname === "localhost" ||
    /^\d[\d.]+$/.test(contact.hostname) || contact.hostname.startsWith("[")
  ) {
    throw new Error("Notification contact must be a public HTTPS site URL.");
  }
  assertPublicPoint(decodeKey(publicKey, 65, "VAPID public"));
  decodeKey(privateKey, 32, "VAPID private");
  return { subject: contact.href, publicKey, privateKey };
}

function encodedPayload(payload: PushPayload): string {
  if (
    typeof payload.title !== "string" || payload.title.length < 1 || payload.title.length > 120 ||
    typeof payload.body !== "string" || payload.body.length > 320 ||
    (payload.tag !== undefined && (typeof payload.tag !== "string" || payload.tag.length > 96))
  ) {
    throw new Error("Invalid notification message.");
  }
  return JSON.stringify({ title: payload.title, body: payload.body, tag: payload.tag, url: "/" });
}

export async function sendPush(
  subscription: ValidatedSubscription,
  payload: PushPayload,
  environment: VapidEnvironment,
): Promise<PushResult> {
  const validated = validateSubscription(subscription);
  if (validated.expirationTime != null && validated.expirationTime <= Date.now()) {
    return { ok: false, status: 410, expired: true };
  }
  const details = webPush.generateRequestDetails(validated, encodedPayload(payload), {
    vapidDetails: vapidDetails(environment),
    contentEncoding: "aes128gcm",
    TTL: 90,
    urgency: "high",
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(validated.endpoint, {
      method: "POST",
      headers: details.headers,
      body: details.body ? new Uint8Array(details.body).buffer : undefined,
      redirect: "manual",
      signal: controller.signal,
    });
    await response.body?.cancel().catch(() => undefined);
    return {
      ok: response.ok,
      status: response.status,
      expired: response.status === 404 || response.status === 410,
    };
  } catch {
    return { ok: false, status: 0, expired: false };
  } finally {
    clearTimeout(timeout);
  }
}
