export type ApiConfiguration = { apiOrigin: string };

type ApiClientOptions = {
  basePath: string;
  fetcher?: typeof fetch;
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

export function createApiClient({ basePath, fetcher = fetch, allowLocalHttp = false }: ApiClientOptions) {
  const base = normalizedBasePath(basePath);
  let origin: string | null = null;
  let configuration: Promise<void> | null = null;

  async function configure() {
    if (!configuration) configuration = (async () => {
      const response = await fetcher(`${base}config.json`, { credentials: "omit", cache: "no-store", redirect: "error" });
      if (!response.ok) throw new Error("未能讀取通知服務設定，請重新整理。");
      const result = await response.json() as Partial<ApiConfiguration> | null;
      origin = validatedApiOrigin(result?.apiOrigin, allowLocalHttp);
    })().catch((error: unknown) => { configuration = null; throw error; });
    await configuration;
  }

  async function request(path: string, init: RequestInit = {}) {
    if (!/^\/api\/[a-z]+(?:\/[a-z]+)*$/.test(path)) throw new Error("Invalid API request path.");
    await configure();
    const headers = new Headers(init.headers);
    headers.delete("Authorization");
    const response = await fetcher(`${origin}${path}`, { ...init, headers, credentials: "omit", mode: "cors", redirect: "error" });
    if (response.status === 401) throw new Error("計時服務尚未啟用公開存取，請確認雲端設定。");
    return response;
  }

  return { request };
}

const basePath = normalizedBasePath(import.meta.env?.BASE_URL || "/yuki-ro-boss-timers/");
export const apiClient = createApiClient({ basePath, allowLocalHttp: import.meta.env?.DEV === true });
export const apiFetch = apiClient.request;
export const appBasePath = basePath;
