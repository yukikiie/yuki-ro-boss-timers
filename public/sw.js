self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { body: event.data.text() };
    }
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) payload = {};
  const title = typeof payload.title === "string" && payload.title
    ? payload.title.slice(0, 120)
    : "Yuki RO Timers";
  const body = typeof payload.body === "string"
    ? payload.body.slice(0, 320)
    : "Your boss timer has an update. Open Yuki to check.";
  const tag = typeof payload.tag === "string" && payload.tag
    ? payload.tag.slice(0, 96)
    : "yuki-timer-update";
  event.waitUntil(self.registration.showNotification(title, {
    body,
    tag,
    icon: new URL("pixel/poring-standalone.png?v=standalone-b1", self.registration.scope).href,
    badge: new URL("pixel/poring-standalone.png?v=standalone-b1", self.registration.scope).href,
    requireInteraction: true,
    data: { url: self.registration.scope },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const scope = new URL(self.registration.scope);
  const destination = scope.href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find((windowClient) => {
      try {
        const candidate = new URL(windowClient.url);
        return candidate.origin === scope.origin && candidate.pathname.startsWith(scope.pathname);
      } catch {
        return false;
      }
    });
    if (existing) {
      await existing.navigate(destination);
      await existing.focus();
      return;
    }
    await self.clients.openWindow(destination);
  })());
});
