import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { createApiClient, normalizedBasePath, validatedApiOrigin } from "../src/api.ts";
import { normalizeAssetBase, rewritePublicAssetPaths } from "../src/asset-paths.ts";
import { activateApplicationWorker, isApplicationRegistration } from "../src/push-registration.ts";
import { bossDisplayName } from "../lib/boss-names.js";

const base = "/yuki-ro-boss-timers/";
function stateResponse() { return Response.json({ serverNow: 1234, bosses: [] }); }

test("asset base accepts only an absolute project directory", () => {
  for (const value of ["/", base, "/another-repo/"]) {
    assert.equal(normalizeAssetBase(value), value);
    assert.equal(normalizedBasePath(value), value);
  }
  for (const value of ["https://evil.invalid/", "//evil.invalid/", "/repo", "/../repo/", "/repo/?key=x", "/repo/#x"]) {
    assert.throws(() => normalizeAssetBase(value));
    assert.throws(() => normalizedBasePath(value));
  }
});

test("asset rewriting scopes code and atlas URLs without touching APIs, fragments or HTTPS", () => {
  const source = 'const image="/art/a.png"; const icon=\'/pixel/p.png\'; const font=`/fonts/f.woff2`; fetch("/api/state"); const external="https://example.com/art/a.png"; const clip="url(#sprite)";';
  const rewritten = rewritePublicAssetPaths(source, base);
  assert.ok(rewritten.includes('"/yuki-ro-boss-timers/art/a.png"'));
  assert.ok(rewritten.includes("'/yuki-ro-boss-timers/pixel/p.png'"));
  assert.ok(rewritten.includes('`/yuki-ro-boss-timers/fonts/f.woff2`'));
  assert.ok(rewritten.includes('fetch("/api/state")'));
  assert.ok(rewritten.includes('"https://example.com/art/a.png"'));
  assert.ok(rewritten.includes('"url(#sprite)"'));
  assert.equal(rewritePublicAssetPaths(rewritten, base), rewritten);
  assert.equal(rewritePublicAssetPaths('{"source":"/art/a.png"}', "/"), '{"source":"/art/a.png"}');
});

test("API configuration rejects credentials, unsafe origins, paths and key-bearing URLs", () => {
  assert.equal(validatedApiOrigin("https://timers.example.workers.dev"), "https://timers.example.workers.dev");
  assert.equal(validatedApiOrigin("http://127.0.0.1:8787", true), "http://127.0.0.1:8787");
  assert.throws(() => validatedApiOrigin("http://127.0.0.1:8787"));
  for (const value of [undefined, "", "not-a-url", "http://example.com", "https://owner:code@example.com", "https://example.com/private", "https://example.com/?code=secret", "https://example.com/#secret", "file:///api"]) assert.throws(() => validatedApiOrigin(value));
});

test("shared state opens directly without a connection code, bearer or cookies", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const client = createApiClient({ basePath: base, fetcher: async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, init });
    assert.equal(new Headers(init.headers).has("Authorization"), false);
    if (url === `${base}config.json`) {
      return Response.json({ apiOrigin: "https://timers.example.workers.dev" });
    }
    return stateResponse();
  } });
  const response = await client.request("/api/state", { cache: "no-store" });
  assert.deepEqual(await response.json(), { serverNow: 1234, bosses: [] });
  assert.deepEqual(calls.map((call) => call.url), [`${base}config.json`, "https://timers.example.workers.dev/api/state"]);
  assert.ok(calls.every((call) => call.init.credentials === "omit" && call.init.redirect === "error"));
  assert.equal(calls[1].init.mode, "cors");
  assert.deepEqual(Object.keys(client), ["request"]);
});

test("mutations use only the configured origin and never forward an Authorization header", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const client = createApiClient({ basePath: base, fetcher: async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, init });
    return url.endsWith("config.json") ? Response.json({ apiOrigin: "https://shared.example.workers.dev/" }) : stateResponse();
  } });
  await client.request("/api/bosses", { method: "POST", body: "{}", credentials: "include", redirect: "follow", headers: { Authorization: "Bearer wrong" } });
  const mutation = calls.at(-1)!;
  assert.equal(mutation.url, "https://shared.example.workers.dev/api/bosses");
  assert.equal(mutation.init.credentials, "omit");
  assert.equal(mutation.init.redirect, "error");
  assert.equal(new Headers(mutation.init.headers).has("Authorization"), false);
  for (const path of ["https://evil.invalid/api/state", "//evil.invalid/api/state", "/api/../secret", "/api/state?key=secret", "/api/state#key", "/signin-with-chatgpt"]) await assert.rejects(client.request(path), /Invalid API/);
  assert.equal(calls.length, 2);
});

test("invalid configuration fails before contacting an API and can be retried", async () => {
  let calls = 0;
  const client = createApiClient({ basePath: base, fetcher: async (input) => {
    calls++;
    assert.equal(String(input), `${base}config.json`);
    return Response.json({ apiOrigin: "https://shared.example.workers.dev/private?secret=unsafe" });
  } });
  await assert.rejects(client.request("/api/state"), /HTTPS/);
  await assert.rejects(client.request("/api/state"), /HTTPS/);
  assert.equal(calls, 2);
});

test("an unauthorized backend reports a public-access setup error without asking for a code", async () => {
  let requests = 0;
  const client = createApiClient({ basePath: base, fetcher: async () => {
    requests++;
    return requests === 1 ? Response.json({ apiOrigin: "https://shared.example.workers.dev" }) : new Response("", { status: 401 });
  } });
  await assert.rejects(client.request("/api/state"), /尚未啟用公開存取/);
  await assert.rejects(client.request("/api/state"), /尚未啟用公開存取/);
  assert.equal(requests, 3);
});

test("manifest is relative and app requests never use Sites authentication", async () => {
  const manifest = JSON.parse(await readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"));
  assert.deepEqual([manifest.id, manifest.scope, manifest.start_url], ["./", "./", "./"]);
  assert.ok(manifest.icons.every((icon: { src: string }) => icon.src.startsWith("./pixel/")));
  const app = await readFile(new URL("../src/boss-timer-app.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(app, /next\/link|signin-with-chatgpt|credentials:\s*"same-origin"|\bfetch\(/);
  assert.match(app, /activateApplicationWorker\(navigator.serviceWorker, appBasePath\)/);
  assert.match(app, /getRegistration\(appBasePath\)/);
  assert.match(app, /Cloudflare 會每分鐘檢查提醒，無須開著電腦/);
  assert.match(app, /export default function Home\(\) \{ return <BossTimerApp \/>; \}/);
  assert.doesNotMatch(app, /PrivateConnection|onDisconnect|private-account-settings|中斷連接／更換連接碼/);
  assert.match(app, /任何持有網址的人都可以查看及修改此面板的倒數/);
  const transport = await readFile(new URL("../src/api.ts", import.meta.url), "utf8");
  const main = await readFile(new URL("../src/main.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(transport, /localStorage|sessionStorage|connectionCode|rememberedCode|storageKey|Bearer/);
  assert.doesNotMatch(main, /private-connection/);
  assert.match(main, /localStorage\.removeItem\(`bosswatch\.github\.connection:\$\{appBasePath\}`\)/);
  assert.doesNotMatch(main, /localStorage\.(?:getItem|setItem)|sessionStorage/);
});

test("every boss exposes confirmed kill and manual countdown as separate visible controls", async () => {
  const app = await readFile(new URL("../src/boss-timer-app.tsx", import.meta.url), "utf8");
  const actionRow = app.match(/<div className="card-button-row"[\s\S]*?<\/div>/)?.[0];
  assert.ok(actionRow);
  assert.match(actionRow, /role="group" aria-label=\{`\$\{canonicalName\} 計時操作`\}/);
  assert.equal((actionRow.match(/<button\b/g) || []).length, 2);
  assert.match(actionRow, /button-kill[\s\S]*?onClick=\{\(\) => confirmKill\(boss\)\}>剛被擊殺<\/button>/);
  assert.match(actionRow, /button-adjust[\s\S]*?onClick=\{\(\) => openCountdown\(boss\)\}>設定倒數<\/button>/);
  assert.equal((actionRow.match(/disabled=\{busy \|\| resting\}/g) || []).length, 2);
  assert.equal((app.match(/onClick=\{\(\) => confirmKill\(boss\)\}/g) || []).length, 2);
});

test("kill shortcut only opens an in-page confirmation and is blocked while busy or resting", async () => {
  const app = await readFile(new URL("../src/boss-timer-app.tsx", import.meta.url), "utf8");
  const handlerBody = app.match(/function confirmKill\(boss: Boss\) \{([\s\S]*?)\n  \}\n  function openCountdown/)?.[1];
  assert.ok(handlerBody);
  assert.doesNotMatch(handlerBody, /window\.confirm|mutate\(|seconds/);
  for (const respawnMinutes of [120, 180]) {
    for (const [busy, resting] of [[false, false], [true, false], [false, true], [true, true]]) {
      const errors: string[] = [];
      const menus: null[] = [];
      const dialogs: { type: string; boss: unknown }[] = [];
      const handler = vm.runInNewContext(`(boss) => {${handlerBody}}`, {
        busy, resting,
        setFormError: (value: string) => errors.push(value),
        setMenu: (value: null) => menus.push(value),
        setDialog: (value: { type: string; boss: unknown }) => dialogs.push(value),
      }) as (boss: { id: string; name: string; respawnMinutes: number }) => void;
      const boss = Object.freeze({ id: "fixture-boss", name: "測試 Boss", respawnMinutes });
      handler(boss);
      assert.equal(dialogs.length, busy || resting ? 0 : 1);
      assert.deepEqual(errors, busy || resting ? [] : [""]);
      assert.deepEqual(menus, busy || resting ? [] : [null]);
      if (dialogs.length) {
        assert.equal(dialogs[0].type, "kill");
        assert.equal(dialogs[0].boss, boss);
      }
    }
  }
});

test("only explicit kill form submission mutates the boss and closes after success", async () => {
  const app = await readFile(new URL("../src/boss-timer-app.tsx", import.meta.url), "utf8");
  const handlerBody = app.match(/async function submitDialog\(event: React\.FormEvent\) \{([\s\S]*?)\n  \}\n  async function connectPush/)?.[1];
  assert.ok(handlerBody);
  for (const respawnMinutes of [120, 180]) {
    for (const [busy, resting, accepted] of [[false, false, true], [false, false, false], [true, false, true], [false, true, true]]) {
      const mutations: { action: string; values: unknown; message: string }[] = [];
      const closed: null[] = [];
      let prevented = 0;
      const boss = Object.freeze({ id: "fixture-boss", name: "測試 Boss", respawnMinutes });
      const handler = vm.runInNewContext(`async (event) => {${handlerBody}}`, {
        busy, resting, dialog: { type: "kill", boss },
        bossDisplayName,
        setDialog: (value: null) => closed.push(value),
        mutate: async (action: string, values: unknown, message: string) => { mutations.push({ action, values: JSON.parse(JSON.stringify(values)), message }); return accepted; },
      }) as (event: { preventDefault: () => void }) => Promise<void>;
      await handler({ preventDefault: () => { prevented++; } });
      assert.equal(prevented, 1);
      assert.equal(mutations.length, busy || resting ? 0 : 1);
      assert.deepEqual(closed, !busy && !resting && accepted ? [null] : []);
      if (mutations.length) {
        assert.deepEqual(mutations[0].values, { bossId: boss.id });
        assert.equal(mutations[0].action, "kill");
        assert.ok(mutations[0].message.includes(`${respawnMinutes / 60} 小時倒數`));
      }
    }
  }
});

test("kill modal labels its duration, requires no time fields and focuses a non-mutating Cancel", async () => {
  const app = await readFile(new URL("../src/boss-timer-app.tsx", import.meta.url), "utf8");
  const modal = app.slice(app.indexOf('{dialog && <div className="modal-backdrop"'));
  assert.match(modal, /dialog\.type === "add" \? "新增你的 Boss" : bossDisplayName\(dialog\.boss\)/);
  assert.match(modal, /確認當下的伺服器時間重新開始 \$\{dialog\.boss\.respawnMinutes \/ 60\} 小時倒數，取代目前倒數；不需要輸入時間/);
  assert.match(modal, /dialog\.type === "add" \? <div className="add-fields"/);
  assert.match(modal, /確認擊殺 · \$\{dialog\.boss\.respawnMinutes \/ 60\}小時/);
  assert.match(modal, /disabled=\{busy \|\| \(dialog\.type !== "add" && resting\)\}/);
  const cancel = modal.match(/<button className="dialog-cancel"[^\n]+>取消<\/button>/)?.[0];
  assert.ok(cancel);
  assert.match(cancel, /autoFocus=\{dialog\.type === "kill"\}/);
  assert.match(cancel, /onClick=\{\(\) => setDialog\(null\)\}/);
  assert.doesNotMatch(cancel, /mutate|submitDialog/);
  const cancelHandler = cancel.match(/onClick=\{(\(\) => setDialog\(null\))\}/)?.[1];
  assert.ok(cancelHandler);
  const closed: null[] = [];
  const cancelDialog = vm.runInNewContext(`(${cancelHandler})`, { setDialog: (value: null) => closed.push(value) }) as () => void;
  cancelDialog();
  assert.deepEqual(closed, [null]);
});

test("both card types reserve a compact vertical pair without shrinking portraits or countdowns", async () => {
  const styles = await readFile(new URL("../src/approved-art.css", import.meta.url), "utf8");
  assert.match(styles, /grid-template-rows: minmax\(0, 1fr\) minmax\(51px, 1fr\); height: max\(27\.5cqi, 110px\)/);
  assert.match(styles, /\.reference-timers \.card-featured \{[^}]*height: max\(29cqi, 114px\)/);
  assert.match(styles, /\.reference-timers \.card-button-row, \.reference-timers \.card-featured \.card-button-row \{[^}]*display: grid; grid-template-columns: minmax\(0, 1fr\); gap: 3px/);
  assert.match(styles, /\.reference-timers \.button-card, \.reference-timers \.card-featured \.button-card \{ min-height: max\(5\.2cqi, 24px\)/);
  assert.match(styles, /\.reference-timers \.button-adjust, \.reference-timers \.card-featured \.button-adjust \{ background:/);
  assert.match(styles, /grid-template-columns: 34cqi minmax\(0, 1fr\) 19\.53cqi/);
  assert.match(styles, /height: 22\.605cqi/);
});

test("only the exact application worker can supply a notification subscription", async () => {
  const page = `https://yukikiie.github.io${base}`;
  assert.equal(isApplicationRegistration({ scope: "https://yukikiie.github.io/" } as ServiceWorkerRegistration, base, page), false);
  assert.equal(isApplicationRegistration({ scope: page } as ServiceWorkerRegistration, base, page), true);
  assert.equal(isApplicationRegistration(undefined, base, page), false);
  const calls: { script: string; scope: string | undefined }[] = [];
  const registration = { active: {} } as ServiceWorkerRegistration;
  const container = { register: async (script: string, options?: RegistrationOptions) => { calls.push({ script, scope: options?.scope }); return registration; } } as ServiceWorkerContainer;
  assert.equal(await activateApplicationWorker(container, base), registration);
  assert.deepEqual(calls, [{ script: `${base}sw.js`, scope: base }]);
});

async function serviceWorkerFixture(windows: { url: string; navigate: (destination: string) => Promise<void>; focus: () => Promise<void> }[] = []) {
  const handlers = new Map<string, (event: any) => void>();
  const notifications: { title: string; options: any }[] = [];
  const opened: string[] = [];
  const scope = `https://yukikiie.github.io${base}`;
  const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  vm.runInNewContext(source, { URL, self: { registration: { scope, showNotification: async (title: string, options: any) => { notifications.push({ title, options }); } }, clients: { matchAll: async () => windows, openWindow: async (url: string) => { opened.push(url); }, claim: async () => {} }, skipWaiting: async () => {}, addEventListener: (name: string, handler: (event: any) => void) => handlers.set(name, handler) } });
  return { handlers, notifications, opened, scope };
}

test("push icons and destinations are confined to this GitHub project", async () => {
  const fixture = await serviceWorkerFixture();
  let pending: Promise<void> = Promise.resolve();
  fixture.handlers.get("push")!({ data: { json: () => ({ title: "阿特羅斯", body: "即將出現", url: "https://evil.invalid/" }) }, waitUntil: (promise: Promise<void>) => { pending = promise; } });
  await pending;
  assert.equal(fixture.notifications[0].options.icon, `${fixture.scope}pixel/poring-standalone.png?v=standalone-b1`);
  assert.equal(fixture.notifications[0].options.badge, fixture.notifications[0].options.icon);
  assert.equal(fixture.notifications[0].options.data.url, fixture.scope);
});

test("notification click never hijacks a different GitHub Pages app", async () => {
  const navigated: string[] = [];
  let focused = 0;
  const other = { url: "https://yukikiie.github.io/another-app/", navigate: async (url: string) => { navigated.push(url); }, focus: async () => { focused++; } };
  const matching = { ...other, url: `https://yukikiie.github.io${base}?view=timers` };
  for (const windows of [[other], [other, matching]]) {
    const fixture = await serviceWorkerFixture(windows);
    let pending: Promise<void> = Promise.resolve();
    fixture.handlers.get("notificationclick")!({ notification: { close: () => {} }, waitUntil: (promise: Promise<void>) => { pending = promise; } });
    await pending;
    if (windows.length === 1) { assert.deepEqual(fixture.opened, [fixture.scope]); assert.equal(navigated.length, 0); assert.equal(focused, 0); }
    else { assert.equal(navigated.at(-1), fixture.scope); assert.equal(focused, 1); assert.equal(fixture.opened.length, 0); }
  }
});
