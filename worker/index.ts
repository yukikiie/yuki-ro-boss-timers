import { ApiError, allowedOrigin, api, bodyJson, createTimerService, json, sameOrigin, userIdentity } from "./service.ts";
import type { ServiceDependencies, WorkerEnvironment } from "./service.ts";

const routes: Record<string, readonly string[]> = {
  "/api/state": ["GET"],
  "/api/bosses": ["POST"],
  "/api/push/subscribe": ["POST", "DELETE"],
  "/api/push/status": ["POST"],
  "/api/push/test": ["POST"],
};

function cors(response: Response, request: Request, environment: WorkerEnvironment) {
  const headers = new Headers(response.headers);
  headers.set("Vary", request.method === "OPTIONS" ? "Origin, Access-Control-Request-Method, Access-Control-Request-Headers" : "Origin");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Cache-Control", "no-store");
  if (environment.ALLOWED_ORIGIN === allowedOrigin && request.headers.get("origin") === allowedOrigin) {
    headers.set("Access-Control-Allow-Origin", allowedOrigin);
  }
  return new Response(response.body, { status: response.status, headers });
}

function preflight(request: Request, environment: WorkerEnvironment, methods: readonly string[]) {
  sameOrigin(request, environment);
  if (request.headers.get("origin") !== allowedOrigin) throw new ApiError("缺少網站來源。", 403);
  const method = request.headers.get("access-control-request-method") || "";
  if (!methods.includes(method)) throw new ApiError("不支援這種請求方式。", 405);
  const requestedHeaders = (request.headers.get("access-control-request-headers") || "")
    .split(",").map((header) => header.trim().toLowerCase()).filter(Boolean);
  if (requestedHeaders.some((header) => header !== "authorization" && header !== "content-type")) {
    throw new ApiError("不允許這些請求標頭。", 403);
  }
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": methods.join(", "),
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Max-Age": "600",
    },
  });
}

export async function handleRequest(request: Request, environment: WorkerEnvironment, dependencies: ServiceDependencies = {}) {
  const response = await api(async () => {
    const pathname = new URL(request.url).pathname;
    if (pathname === "/health" && request.method === "GET") return json({ ok: true });
    const methods = routes[pathname];
    if (!methods) throw new ApiError("找不到這個功能。", 404);
    if (request.method === "OPTIONS") return preflight(request, environment, methods);
    sameOrigin(request, environment);
    if (!methods.includes(request.method)) throw new ApiError("不支援這種請求方式。", 405);
    const owner = await userIdentity(request, environment);
    const service = createTimerService(environment, dependencies);
    if (pathname === "/api/state") return json(await service.state(owner));
    const input = await bodyJson(request);
    if (pathname === "/api/bosses") return json(await service.mutateBosses(owner, input));
    if (pathname === "/api/push/subscribe") {
      return json(await (request.method === "DELETE" ? service.unsubscribe(owner, input.endpoint) : service.subscribe(owner, input)));
    }
    if (pathname === "/api/push/status") return json(await service.subscriptionStatus(owner, input.endpoint));
    return json(await service.testPush(owner, input.endpoint));
  });
  return cors(response, request, environment);
}

export async function handleScheduled(environment: WorkerEnvironment, dependencies: ServiceDependencies = {}) {
  return createTimerService(environment, dependencies).dispatchReminders();
}

export default {
  fetch(request: Request, environment: WorkerEnvironment) {
    return handleRequest(request, environment);
  },
  scheduled(_controller: ScheduledController, environment: WorkerEnvironment, context: ExecutionContext) {
    context.waitUntil(handleScheduled(environment).catch((error) => {
      console.error("Scheduled timer dispatch failed", error instanceof Error ? error.name : "Error");
    }));
  },
};
