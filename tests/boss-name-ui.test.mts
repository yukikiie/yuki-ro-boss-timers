import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import * as catalog from "../lib/boss-catalog.js";
import * as bossNames from "../lib/boss-names.js";
import * as backgroundThemes from "../lib/background-themes.ts";
import * as fontPreferences from "../lib/font-preferences.ts";
import * as portraitIcons from "../lib/boss-portrait-icons.js";
import * as timers from "../lib/timers.js";
import * as sceneTime from "../lib/scene-time.ts";

const requireModule = createRequire(import.meta.url);
const pageSource = readFileSync(new URL("../src/boss-timer-app.tsx", import.meta.url), "utf8");
const timestamp = Date.UTC(2026, 9, 19, 4);
const shortcuts = [
  ["lady-tanee", "嗒妮小姐", "妮小姐"],
  ["fallen-bishop", "墮落大神官希巴姆", "大神官"],
  ["death-knight", "死靈騎士", "47"],
  ["tao-gunka", "塔奧群卡", "塔奧"],
  ["custom-5qip79", "暗・逐影", "逐影"],
  ["boitata", "波伊塔塔", "波波塔塔"],
  ["naght-sieger", "納戶特基格", "光頭"],
  ["dark-elementalist", "暗・元素使", "元素"],
  ["dark-ranger", "暗・遊俠", "遊俠"],
  ["custom-1hb3imu", "暗・基因學者", "基因"],
  ["custom-1xgl1sj", "代行刑者", "代行"],
  ["custom-1hknmq6", "尼德豪克的影子", "影龍"],
  ["custom-1gjisbs", "皮里恩", "皮皮"],
] as const;

type FixtureBoss = {
  id: string; name: string; kind: "MVP" | "Mini"; favorite: boolean;
  status: "counting"; dueAt: number; observedAt: number; cycle: string;
  source: "manual"; respawnMinutes: number;
};

function fixtureBoss(id: string, name: string): FixtureBoss {
  const kind = catalog.bossDetails({ id, name })?.kind === "MVP" ? "MVP" : "Mini";
  return Object.freeze({ id, name, kind, favorite: false, status: "counting", dueAt: timestamp + 600000, observedAt: timestamp, cycle: "2026-10-19", source: "manual", respawnMinutes: kind === "MVP" ? 180 : 120 });
}

const bosses = shortcuts.map(([id, name]) => fixtureBoss(id, name));

function loadPage(selected: FixtureBoss[], dialog: { type: "kill" | "countdown"; boss: FixtureBoss } | null = null) {
  let dialogInjected = false;
  const javascript = ts.transpileModule(pageSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const dependencies: Record<string, unknown> = {
    react: {
      ...React,
      useState: (initial: unknown) => {
        let value = typeof initial === "function" ? initial() : initial;
        if (value && typeof value === "object" && "bosses" in value) value = { ...value, bosses: selected };
        else if (value === null && !dialogInjected) { value = dialog; dialogInjected = true; }
        return React.useState(value);
      },
    },
    "../lib/boss-catalog.js": catalog,
    "../lib/boss-names.js": bossNames,
    "../lib/background-themes": backgroundThemes,
    "../lib/font-preferences": fontPreferences,
    "../hooks/use-font-preferences": { useFontPreferences: () => ({ preferences: fontPreferences.DEFAULT_FONT_PREFERENCES, updatePreferences() {}, resetPreferences() {} }) },
    "./components/font-settings": { FontSettings: () => null },
    "../lib/boss-portrait-icons.js": portraitIcons,
    "../lib/timers.js": timers,
    "../lib/scene-time": sceneTime,
    "../hooks/use-scene-phase": { useScenePhase: () => "afternoon" },
    "../hooks/use-background-theme": { useBackgroundTheme: () => ({ themeId: "moon-garden", setThemeId: () => {} }) },
    "./components/background-chooser": { BackgroundChooser: () => null, BackgroundSettings: () => null },
    "./components/living-scene": { AnimatedHeader: () => null, LivingGarden: () => null },
    "./components/reference-countdown": { ReferenceCountdown: ({ value }: { value: string }) => React.createElement("span", null, value) },
    "./components/animated-boss-portrait": { AnimatedBossPortrait: ({ spriteIndex }: { spriteIndex: number }) => React.createElement("svg", { "data-motion-index": spriteIndex }), NativeAnimatedBossPortrait: () => null },
    "./api": { apiFetch: () => { throw new Error("Alias tests must not contact live timers"); }, appBasePath: "/yuki-ro-boss-timers/" },
    "./push-registration": {},
  };
  const moduleValue = { exports: {} as Record<string, React.ComponentType<any>> };
  vm.runInNewContext(javascript, {
    module: moduleValue, exports: moduleValue.exports,
    require: (name: string) => Object.hasOwn(dependencies, name) ? dependencies[name] : requireModule(name),
    fetch: () => { throw new Error("Alias tests must not contact live timers"); },
  });
  return moduleValue.exports;
}

function renderApp(selected = bosses, dialog: { type: "kill" | "countdown"; boss: FixtureBoss } | null = null) {
  return renderToStaticMarkup(React.createElement(loadPage(selected, dialog).BossTimerApp, { referencePreview: true }));
}

test("all thirteen cards display shortcuts while retaining official title and accessible identities", () => {
  const before = JSON.stringify(bosses);
  const markup = renderApp();
  for (const [id, name, displayName] of shortcuts) {
    const boss = bosses.find(entry => entry.id === id)!;
    assert.ok(markup.includes(`<h3 title="${name}">${displayName}</h3>`), id);
    assert.ok(markup.includes(`aria-label="${displayName}（${name}），${boss.kind}`), id);
    for (const action of ["更多選項", "計時操作", "剛被擊殺", "設定倒數"]) assert.ok(markup.includes(`aria-label="${name} ${action}"`), `${id} ${action}`);
    assert.ok(markup.includes(`aria-label="加入最愛 ${name}"`), id);
  }
  assert.doesNotMatch(markup, /boss-name-long/);
  assert.ok(markup.includes('data-motion-index="18"'));
  assert.equal(JSON.stringify(bosses), before);
});

test("each route uses the shortcut visually and the full game name for title and countdown accessibility", () => {
  for (const [id, name, displayName] of shortcuts) {
    const boss = bosses.find(entry => entry.id === id)!;
    const before = JSON.stringify(boss);
    const Route = loadPage([boss]).UpcomingBossRoute;
    const markup = renderToStaticMarkup(React.createElement(Route, { bosses: [boss], now: timestamp }));
    assert.ok(markup.includes(`data-route-boss="${id}"`));
    assert.ok(markup.includes(`<strong class="route-boss-name" title="${name}">${displayName}</strong>`));
    assert.ok(markup.includes(`aria-label="${name}，距離預計出現 00:10:00"`));
    assert.equal(JSON.stringify(boss), before);
  }
});

test("kill and countdown dialogs display all thirteen shortcuts with canonical title attributes", () => {
  for (const [id, name, displayName] of shortcuts) {
    const boss = bosses.find(entry => entry.id === id)!;
    for (const type of ["kill", "countdown"] as const) {
      const before = JSON.stringify(boss);
      const markup = renderApp([boss], { type, boss });
      assert.ok(markup.includes(`role="dialog" aria-modal="true" aria-labelledby="dialog-title"`));
      assert.ok(markup.includes(`<h2 id="dialog-title" title="${name}">${displayName}</h2>`), `${id} ${type}`);
      assert.equal(JSON.stringify(boss), before);
    }
  }
});

test("the existing saved geneticist shortcut retains MVP metadata, animation, canonical controls and timer fields", () => {
  const boss = fixtureBoss("custom-1hb3imu", "基因");
  const before = JSON.stringify(boss);
  assert.equal(boss.kind, "MVP");
  assert.equal(boss.respawnMinutes, 180);
  const markup = renderApp([boss]);
  assert.ok(markup.includes('<h3 title="暗・基因學者">基因</h3>'));
  assert.ok(markup.includes('aria-label="基因（暗・基因學者），MVP'));
  for (const label of ["體型：中型", "屬性：火", "種族：人形", "加入最愛 暗・基因學者", "暗・基因學者 更多選項", "暗・基因學者 計時操作", "暗・基因學者 剛被擊殺", "暗・基因學者 設定倒數"]) assert.ok(markup.includes(`aria-label="${label}"`), label);
  assert.ok(markup.includes('data-motion-index="21"'));
  assert.ok(markup.includes('aria-label="暗・基因學者，距離預計出現 00:10:00"'));
  for (const type of ["kill", "countdown"] as const) {
    assert.ok(renderApp([boss], { type, boss }).includes('<h2 id="dialog-title" title="暗・基因學者">基因</h2>'));
  }
  const reminders = timers.reminderCandidates([boss], timestamp);
  assert.equal(reminders[0].title, "基因 · 10 分鐘提醒");
  assert.equal(reminders[0].bossId, "custom-1hb3imu");
  assert.equal(JSON.stringify(boss), before);
});

test("the existing saved Phreeoni shortcut shows its verified MVP information and canonical controls without renaming timer or notification data", () => {
  const boss = fixtureBoss("custom-1gjisbs", "皮皮");
  const before = JSON.stringify(boss);
  assert.equal(boss.kind, "MVP");
  const markup = renderApp([boss]);
  assert.ok(markup.includes('<h3 title="皮里恩">皮皮</h3>'));
  assert.ok(markup.includes('aria-label="皮皮（皮里恩），MVP'));
  for (const label of ["體型：大型", "屬性：無", "種族：動物", "加入最愛 皮里恩", "皮里恩 更多選項", "皮里恩 計時操作", "皮里恩 剛被擊殺", "皮里恩 設定倒數"]) assert.ok(markup.includes(`aria-label="${label}"`), label);
  assert.ok(markup.includes('data-motion-index="25"'));
  assert.ok(markup.includes('aria-label="皮里恩，距離預計出現 00:10:00"'));
  const reminder = timers.reminderCandidates([boss], timestamp)[0];
  assert.equal(reminder.bossId, "custom-1gjisbs");
  assert.equal(reminder.title, "皮皮 · 10 分鐘提醒");
  assert.equal(JSON.stringify(boss), before);
});

test("unknown custom names remain visible and escaped without invented aliases", () => {
  const boss = fixtureBoss("custom-unregistered", '自訂 <Boss> "測試"');
  const before = JSON.stringify(boss);
  const markup = renderApp([boss]);
  assert.ok(markup.includes('<h3 title="自訂 &lt;Boss&gt; &quot;測試&quot;">自訂 &lt;Boss&gt; &quot;測試&quot;</h3>'));
  assert.doesNotMatch(markup, /boss-name-long/);
  assert.doesNotMatch(markup, /<Boss>/);
  assert.equal(JSON.stringify(boss), before);
});

test("confirmation actions retain original IDs and countdown values while success copy uses shortcuts", async () => {
  const handlerBody = pageSource.match(/async function submitDialog\(event: React\.FormEvent\) \{([\s\S]*?)\n  \}\n  async function connectPush/)?.[1];
  assert.ok(handlerBody);
  for (const [id, , displayName] of shortcuts) {
    const boss = bosses.find(entry => entry.id === id)!;
    for (const type of ["kill", "countdown"] as const) {
      const calls: { action: string; values: unknown; message: string }[] = [];
      const closed: null[] = [];
      const before = JSON.stringify(boss);
      const handler = vm.runInNewContext(`async (event) => {${handlerBody}}`, {
        busy: false, resting: false, dialog: { type, boss }, hours: "01", minutes: "02", seconds: "03",
        bossDisplayName: bossNames.bossDisplayName,
        setFormError: () => assert.fail("Valid countdown should not fail"),
        setDialog: (value: null) => closed.push(value),
        mutate: async (action: string, values: unknown, message: string) => { calls.push({ action, values: JSON.parse(JSON.stringify(values)), message }); return true; },
      }) as (event: { preventDefault: () => void }) => Promise<void>;
      await handler({ preventDefault: () => {} });
      assert.deepEqual(calls, [{ action: type, values: type === "kill" ? { bossId: id } : { bossId: id, seconds: 3723 }, message: type === "kill" ? `${displayName} 已重新開始 ${boss.respawnMinutes / 60} 小時倒數` : `${displayName} 的倒數已設定` }]);
      assert.deepEqual(closed, [null]);
      assert.equal(JSON.stringify(boss), before);
    }
  }
});

test("rest and removal copy use the display identity without changing mutation targeting", () => {
  assert.match(pageSource, /mutate\("resting", \{ bossId: boss\.id \}, `\$\{displayName\} 已標記休眠`\)/);
  assert.match(pageSource, /window\.confirm\(`移除 \$\{accessibleName\}？此 Boss 的倒數也會清除。`\)\) void mutate\("remove", \{ bossId: boss\.id \}, "Boss 已移除"\)/);
});

test("display aliases do not rename defaults, saved timers, or notification payloads", () => {
  const defaults = timers.defaultBosses(timestamp);
  const before = JSON.stringify(defaults);
  const observed = JSON.stringify(bosses);
  const reminders = timers.reminderCandidates(bosses, timestamp);
  assert.equal(defaults.length, 18);
  assert.deepEqual(defaults.map(boss => [boss.id, boss.name]), catalog.bossCatalog.map(boss => [boss.id, boss.name]));
  assert.equal(reminders.length, shortcuts.length);
  for (const [id, name] of shortcuts) {
    const reminder = reminders.find(candidate => candidate.bossId === id)!;
    assert.equal(reminder.title, `${name} · 10 分鐘提醒`);
    assert.ok(reminder.message.includes(name));
    assert.equal(reminder.threshold, 600);
  }
  assert.equal(JSON.stringify(defaults), before);
  assert.equal(JSON.stringify(bosses), observed);
});
