export function isApplicationRegistration(registration: ServiceWorkerRegistration | undefined, basePath: string, pageUrl: string) {
  return registration?.scope === new URL(basePath, pageUrl).href;
}

export async function activateApplicationWorker(container: ServiceWorkerContainer, basePath: string) {
  const registration = await container.register(`${basePath}sw.js`, { scope: basePath });
  if (registration.active) return registration;
  const worker = registration.installing || registration.waiting;
  if (!worker) throw new Error("通知背景程式未能啟動，請重新整理後再試。");
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => finish(new Error("通知背景程式啟動逾時，請重新整理後再試。")), 20000);
    function finish(error?: Error) {
      clearTimeout(timeout);
      worker!.removeEventListener("statechange", changed);
      if (error) reject(error);
      else resolve();
    }
    function changed() {
      if (worker!.state === "activated") finish();
      else if (worker!.state === "redundant") finish(new Error("通知背景程式未能啟動，請重試。"));
    }
    worker.addEventListener("statechange", changed);
    changed();
  });
  return registration;
}
