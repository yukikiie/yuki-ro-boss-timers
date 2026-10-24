import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const requireModule = createRequire(import.meta.url);
const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const timers = await import(new URL("../lib/timers.js", import.meta.url).href) as typeof import("../lib/timers.js");
const catalog = await import(new URL("../lib/boss-catalog.js", import.meta.url).href) as typeof import("../lib/boss-catalog.js");
const bossNames = await import(new URL("../lib/boss-names.js", import.meta.url).href) as typeof import("../lib/boss-names.js");
const sceneTime = await import(new URL("../lib/scene-time.ts", import.meta.url).href) as typeof import("../lib/scene-time");
const pageSource = source("../src/boss-timer-app.tsx");

function loadPage() {
  const javascript = ts.transpileModule(pageSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const dependencies: Record<string, unknown> = {
    "../lib/boss-catalog.js": catalog,
    "../lib/boss-names.js": bossNames,
    "../lib/timers.js": timers,
    "../lib/scene-time": sceneTime,
    "../hooks/use-scene-phase": { useScenePhase: () => "afternoon" },
    "./components/living-scene": { AnimatedHeader: () => null, LivingGarden: () => null },
    "./components/reference-countdown": { ReferenceCountdown: ({ value }: { value: string }) => React.createElement("span", null, value) },
    "./components/animated-boss-portrait": { AnimatedBossPortrait: () => React.createElement("svg") },
    "./api": { apiFetch: () => { throw new Error("Route SSR must not fetch live data"); }, appBasePath: "/yuki-ro-boss-timers/" },
    "./private-connection": { PrivateConnection: () => null },
    "./push-registration": {},
  };
  const moduleValue = { exports: {} as Record<string, unknown> };
  vm.runInNewContext(javascript, {
    module: moduleValue, exports: moduleValue.exports,
    require: (name: string) => Object.hasOwn(dependencies, name) ? dependencies[name] : requireModule(name),
    fetch: () => { throw new Error("Route SSR must not fetch live data"); },
  });
  return moduleValue.exports;
}

type TestBoss = Omit<ReturnType<typeof timers.defaultBosses>[number], "dueAt" | "observedAt" | "source"> & { dueAt: number | null; observedAt: number | null; source: "manual" | "kill" | null };
const page = loadPage();
const Route = page.UpcomingBossRoute as React.ComponentType<{ bosses: TestBoss[]; now: number; resting?: boolean }>;
const now = Date.parse("2026-10-20T06:00:00Z");

function withCountdowns(entries: { id: string; seconds: number }[]): TestBoss[] {
  return entries.reduce((bosses, entry) => timers.updateBoss(bosses, { type: "countdown", bossId: entry.id, seconds: entry.seconds }, now), timers.defaultBosses(now));
}

function renderRoute(bosses: TestBoss[], timestamp = now, resting = false) {
  return renderToStaticMarkup(React.createElement(Route, { bosses, now: timestamp, resting }));
}

test("five-minute Death Knight precedes six-minute Naght Sieger with next-target preparation", () => {
  const bosses = withCountdowns([{ id: "naght-sieger", seconds: 360 }, { id: "death-knight", seconds: 300 }, { id: "atroce", seconds: 1200 }]);
  const markup = renderRoute(bosses);
  assert.match(markup, /aria-label="出發順序，依已確認的重生倒數"/);
  assert.match(markup, /data-route-boss="death-knight" data-route-position="first"/);
  assert.match(markup, /data-route-boss="naght-sieger" data-route-position="next"/);
  assert.ok(markup.indexOf("死靈騎士") < markup.indexOf("納戶特基格"));
  assert.match(markup, /先前往/);
  assert.match(markup, /接著準備/);
  assert.match(markup, /00:05:00/);
  assert.match(markup, /00:06:00/);
  assert.match(markup, /緊接重生/);
  assert.match(markup, /00:01:00/);
  assert.doesNotMatch(markup, /阿特羅斯|<button|aria-live="assertive"/);
});

test("route order ignores MVP and favorite priority and does not mutate saved timers", () => {
  const bosses = withCountdowns([{ id: "atroce", seconds: 600 }, { id: "naght-sieger", seconds: 60 }, { id: "death-knight", seconds: 300 }]);
  for (const boss of bosses) boss.favorite = boss.kind === "MVP";
  const previous = JSON.stringify(bosses);
  const markup = renderRoute(bosses);
  assert.match(markup, /data-route-boss="naght-sieger" data-route-position="first"/);
  assert.match(markup, /data-route-boss="death-knight" data-route-position="next"/);
  assert.equal(JSON.stringify(bosses), previous);
  assert.match(pageSource, /<UpcomingBossRoute bosses=\{bosses\} now=\{now\} resting=\{resting\} \/>/);
  assert.doesNotMatch(pageSource, /<UpcomingBossRoute bosses=\{visibleBosses\}/);
});

test("each selected destination visibly shows its exact HKT deadline including seconds", () => {
  const bosses = withCountdowns([{ id: "death-knight", seconds: 337 }, { id: "naght-sieger", seconds: 552 }]);
  const previous = JSON.stringify(bosses);
  const markup = renderRoute(bosses);
  assert.match(markup, /class="route-spawn-time" dateTime="2026-10-20T06:05:37.000Z">預計 14:05:37 HKT<\/time>/);
  assert.match(markup, /class="route-spawn-time" dateTime="2026-10-20T06:09:12.000Z">預計 14:09:12 HKT<\/time>/);
  assert.match(markup, /00:05:37/);
  assert.match(markup, /00:09:12/);
  assert.equal(JSON.stringify(bosses), previous);
});

test("absolute HKT time stays fixed as the countdown advances without rounding the deadline", () => {
  const bosses = withCountdowns([{ id: "death-knight", seconds: 337 }]);
  bosses.find((boss) => boss.id === "death-knight")!.dueAt! += 450;
  const previous = JSON.stringify(bosses);
  for (const elapsed of [0, 1000, 14200]) {
    const markup = renderRoute(bosses, now + elapsed);
    assert.match(markup, /class="route-spawn-time" dateTime="2026-10-20T06:05:37.450Z">預計 14:05:37 HKT<\/time>/);
  }
  assert.match(renderRoute(bosses), /00:05:38/);
  assert.match(renderRoute(bosses, now + 14200), /00:05:24/);
  assert.equal(JSON.stringify(bosses), previous);
});

test("HKT midnight shows the next date and never formats midnight as hour 24", () => {
  const timestamp = Date.parse("2026-10-20T15:59:00Z");
  const bosses = [
    { ...withCountdowns([{ id: "death-knight", seconds: 60 }]).find((boss) => boss.id === "death-knight")!, dueAt: timestamp + 59000, observedAt: timestamp },
    { ...withCountdowns([{ id: "naght-sieger", seconds: 60 }]).find((boss) => boss.id === "naght-sieger")!, dueAt: timestamp + 61000, observedAt: timestamp },
  ];
  const markup = renderRoute(bosses, timestamp);
  assert.match(markup, />預計 23:59:59 HKT<\/time>/);
  assert.match(markup, />預計 10\/21 00:00:01 HKT<\/time>/);
  assert.doesNotMatch(markup, />預計 24:/);
  assert.match(renderRoute(bosses, timestamp + 60000), />預計 00:00:01 HKT<\/time>/);
});

test("expired and unconfirmed timers never become navigation targets or imply another kill", () => {
  const bosses = withCountdowns([{ id: "death-knight", seconds: 60 }, { id: "naght-sieger", seconds: 360 }]);
  const expired = bosses.find((boss) => boss.id === "death-knight")!;
  expired.dueAt = now - 1000;
  expired.observedAt = now - 121000;
  expired.status = "due";
  const unconfirmed = bosses.find((boss) => boss.id === "atroce")!;
  Object.assign(unconfirmed, { dueAt: now + 30000, observedAt: null, source: null, status: "counting" });
  const previous = JSON.stringify(bosses);
  const markup = renderRoute(bosses);
  assert.match(markup, /data-route-boss="naght-sieger" data-route-position="first"/);
  assert.doesNotMatch(markup, /death-knight|atroce|接著準備<\/span>|緊接重生|data-route-position="next"/);
  assert.equal(JSON.stringify(bosses), previous);
  assert.equal(expired.status, "due");
  assert.equal(expired.dueAt, now - 1000);
});

test("close-gap highlight includes exactly five minutes but not a longer gap", () => {
  for (const [seconds, highlighted] of [[600, true], [601, false]] as const) {
    const markup = renderRoute(withCountdowns([{ id: "death-knight", seconds: 300 }, { id: "naght-sieger", seconds }]));
    assert.equal(markup.includes("upcoming-route-close"), highlighted);
    assert.equal(markup.includes("緊接重生"), highlighted);
    assert.equal(markup.includes("出現間隔"), !highlighted);
  }
});

test("empty, rest-period and elapsed queues do not invent a destination", () => {
  assert.equal(renderRoute(timers.defaultBosses(now)), "");
  const bosses = withCountdowns([{ id: "death-knight", seconds: 60 }]);
  assert.equal(renderRoute(bosses, now, true), "");
  assert.equal(renderRoute(bosses, now + 60000), "");
  assert.equal(renderRoute(bosses, 0), "");
  assert.equal(renderRoute(bosses, NaN), "");
});

test("safe sample preview exercises the same confirmed route without contacting the account", () => {
  const App = page.BossTimerApp as React.ComponentType<{ referencePreview: boolean }>;
  const markup = renderToStaticMarkup(React.createElement(App, { referencePreview: true }));
  assert.match(markup, /data-route-boss="dark-ranger" data-route-position="first"/);
  assert.match(markup, /data-route-boss="atroce" data-route-position="next"/);
  assert.match(pageSource, /observedAt: boss\.remaining \? timestamp : null/);
  assert.match(pageSource, /source: boss\.remaining \? "manual" : null/);
});

test("notification and form copy consistently describe ten, five and one-minute reminders", () => {
  assert.match(pageSource, /10 分鐘、5 分鐘、1 分鐘及出現提醒/);
  assert.match(pageSource, /time: "01", caption: "分鐘前", label: "最後準備"/);
  assert.match(pageSource, /不補發已錯過的 10、5 或 1 分鐘通知/);
  assert.match(pageSource, /提醒會在 10、5、1 分鐘及預計出現時送出/);
  assert.match(source("../src/approved-art.css"), /\.app-shell \.reminder-milestones \{ grid-template-columns: repeat\(4, minmax\(0, 1fr\)\); \}/);
  assert.doesNotMatch(pageSource, /不補發已錯過的 10 或 5 分鐘|10 分鐘、5 分鐘及出現提醒/);
});
