export type ApiConfiguration = { apiOrigin: string };

type ApiClientOptions = {
  basePath: string;
  fetcher?: typeof fetch;
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem">;
  onUnauthorized?: () => void;
  allowLocalHttp?: boolean;
};

export function normalizedBasePath(value: string) {
  if (!/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(value)) throw new Error("Invalid application base path.");
  return value;
}

export function validatedApiOrigin(value: unknown, allowLocalHttp = false) {
  if (typeof value !== "string" || !value) throw new Error("通知服務尚未設定，請稍後再試。");
  let destination: URL;
  try { destination = new URL(value); } catch { throw new Error("通知服務設定無效。"); }
  const local = ["127.0.0.1", "localhost", "[::1]"].includes(destination.hostname);
  if ((destination.protocol !== "https:" && !(allowLocalHttp && destination.protocol === "http:" && local)) || destination.username || destination.password || destination.pathname !== "/" || destination.search || destination.hash) throw new Error("通知服務必須使用安全的 HTTPS 網址。");
  return destination.origin;
}

export function validConnectionCode(value: string) {
  return /^[A-Za-z0-9_-]{43}$/.test(value);
}

export function createApiClient({ basePath, fetcher = fetch, storage, onUnauthorized, allowLocalHttp = false }: ApiClientOptions) {
  const base = normalizedBasePath(basePath);
  const storageKey = `bosswatch.github.connection:${base}`;
  let origin: string | null = null;
  let configuration: Promise<void> | null = null;
  let connectionCode: string | null = null;

  async function configure() {
    if (!configuration) configuration = (async () => {
      const response = await fetcher(`${base}config.json`, { credentials: "omit", cache: "no-store", redirect: "error" });
      if (!response.ok) throw new Error("未能讀取通知服務設定，請重新整理。");
      const result = await response.json() as Partial<ApiConfiguration> | null;
      origin = validatedApiOrigin(result?.apiOrigin, allowLocalHttp);
    })().catch((error: unknown) => { configuration = null; throw error; });
    await configuration;
  }

  function disconnect() {
    connectionCode = null;
    try { storage?.removeItem(storageKey); } catch {}
  }

  function rememberedCode() {
    try {
      const value = storage?.getItem(storageKey);
      return value && validConnectionCode(value) ? value : null;
    } catch { return null; }
  }

  async function request(path: string, init: RequestInit = {}, candidate = connectionCode) {
    if (!/^\/api\/[a-z]+(?:\/[a-z]+)*$/.test(path)) throw new Error("Invalid API request path.");
    if (!candidate || !validConnectionCode(candidate)) throw new Error("請輸入你的私人連接碼。");
    await configure();
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${candidate}`);
    const response = await fetcher(`${origin}${path}`, { ...init, headers, credentials: "omit", mode: "cors", redirect: "error" });
    if (response.status === 401) {
      disconnect();
      onUnauthorized?.();
      throw new Error("連接碼無效或已更新，請重新連接。");
    }
    return response;
  }

  async function connect(value: string) {
    const candidate = value.trim();
    if (!validConnectionCode(candidate)) throw new Error("請輸入完整的 43 字元私人連接碼。");
    const response = await request("/api/state", { cache: "no-store" }, candidate);
    if (!response.ok) throw new Error("暫時未能連接私人計時服務，請稍後再試。");
    const state = await response.json() as { serverNow?: unknown; bosses?: unknown };
    if (typeof state.serverNow !== "number" || !Array.isArray(state.bosses)) throw new Error("私人計時服務傳回無效資料。");
    connectionCode = candidate;
    try { storage?.setItem(storageKey, candidate); } catch {}
  }

  return { request, connect, disconnect, rememberedCode };
}

const basePath = normalizedBasePath(import.meta.env?.BASE_URL || "/yuki-ro-boss-timers/");
const browserStorage = typeof window !== "undefined" ? {
  getItem: (key: string) => window.localStorage.getItem(key),
  setItem: (key: string, value: string) => window.localStorage.setItem(key, value),
  removeItem: (key: string) => window.localStorage.removeItem(key),
} : undefined;

export const apiClient = createApiClient({ basePath, storage: browserStorage, allowLocalHttp: import.meta.env?.DEV === true, onUnauthorized: () => {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("bosswatch-disconnected"));
} });
export const apiFetch = apiClient.request;
export const appBasePath = basePath;
