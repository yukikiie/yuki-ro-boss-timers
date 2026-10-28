import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { bossCatalog, bossDetails } from "../lib/boss-catalog.js";
import { portraitAnimation, portraitIcon, portraitMotion } from "../lib/boss-portrait-icons.js";
import { defaultBosses } from "../lib/timers.js";
import { rewritePublicAssetPaths } from "../src/asset-paths.ts";

const references = [
  { id: "custom-5qip79", name: "暗·逐影", file: "dark-chaser-30039.png", width: 74, hash: "e738314b5f8b509cb0452a6455cecf44929d6b174b623990c3d5f63c626faa77" },
  { id: "custom-14l2kgf", name: "亡靈巫師", file: "undead-wizard-31014.png", width: 75, hash: "135d946638385204e2b083a87fc0836435dd375709483c64e088bfc19f986ae9" },
  { id: "custom-1n83kp1", name: "殭屍龍", file: "zombie-dragon-30025.png", width: 75, hash: "10f37191add69e691dbba13ec60edda3333fb3016b9f140c53247cf0c30be00b" },
];
const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

function loadPortrait() {
  const requireModule = createRequire(import.meta.url);
  const portraitSource = source("../src/boss-timer-app.tsx").match(/function BossPortrait\([\s\S]*?\n\}\n(?=function BossSigil)/)?.[0];
  assert.ok(portraitSource);
  const javascript = ts.transpileModule(`export ${portraitSource}`, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  const moduleValue = { exports: {} as Record<string, React.ComponentType<{ boss: { id: string; name: string }; paused?: boolean }>> };
  vm.runInNewContext(javascript, {
    module: moduleValue, exports: moduleValue.exports, require: requireModule,
    bossDetails, portraitAnimation, portraitIcon, portraitMotion,
    AnimatedBossPortrait: ({ spriteIndex }: { spriteIndex: number }) => React.createElement("svg", { "data-preserved-motion": spriteIndex }),
    NativeAnimatedBossPortrait: ({ id, paused }: { id: string; paused: boolean }) => React.createElement("svg", { "data-native-animation": id, "data-native-paused": String(paused) }),
    BossSigil: () => React.createElement("div", { "data-generic-sigil": "true" }),
  });
  return moduleValue.exports.BossPortrait;
}

test("the exact three saved custom IDs resolve to their unchanged native references", () => {
  for (const [index, reference] of references.entries()) {
    assert.equal(portraitIcon({ id: reference.id, name: reference.name }), `/art/boss-icons/${reference.file}`);
    assert.equal(portraitIcon({ id: reference.id, name: "Unknown" }), `/art/boss-icons/${reference.file}`);
    assert.equal(portraitIcon({ id: "different-custom-id", name: reference.name }), `/art/boss-icons/${reference.file}`);
    const expected = { id: ["dark-chaser", "undead-wizard", "zombie-dragon"][index], spriteIndex: 18 + index };
    assert.deepEqual(portraitMotion({ id: reference.id }), expected);
    assert.deepEqual(portraitMotion({ id: "different-custom-id", name: reference.name }), expected);
  }
});

test("only normalized full names and explicit approved shortcuts receive icons", () => {
  for (const name of ["暗・逐影", "暗·逐影", "暗．逐影", " 暗 ・ 逐影 ", "暗\u3000·\u3000逐影"]) assert.equal(portraitIcon({ name }), "/art/boss-icons/dark-chaser-30039.png");
  assert.equal(portraitIcon({ name: " 亡 靈 巫 師 " }), "/art/boss-icons/undead-wizard-31014.png");
  assert.equal(portraitIcon({ name: " 殭屍龍 " }), "/art/boss-icons/zombie-dragon-30025.png");
  assert.equal(portraitIcon({ name: "逐影" }), "/art/boss-icons/dark-chaser-30039.png");
  assert.deepEqual(portraitMotion({ name: "逐影" }), { id: "dark-chaser", spriteIndex: 18 });
  for (const input of [null, undefined, "亡靈巫師", {}, { name: "暗逐影" }, { name: "逐" }, { name: "逐影王" }, { name: "亡靈" }, { name: "殭屍" }, { name: "龍" }, { name: "寒冰龍" }, { name: "影魔" }, { id: "custom-unknown", name: "自訂 Boss" }]) {
    assert.equal(portraitIcon(input), null);
    assert.equal(portraitMotion(input), null);
  }
});

test("native portraits retain their exact downloaded PNG dimensions and bytes", () => {
  for (const reference of references) {
    const bytes = readFileSync(new URL(`../public/art/boss-icons/${reference.file}`, import.meta.url));
    assert.deepEqual(bytes.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    assert.equal(bytes.toString("ascii", 12, 16), "IHDR");
    assert.equal(bytes.readUInt32BE(16), reference.width);
    assert.equal(bytes.readUInt32BE(20), 75);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), reference.hash);
  }
});

test("portrait lookup and verified custom metadata preserve the default eighteen records and all saved timer fields", () => {
  const now = Date.parse("2026-10-21T04:00:00Z");
  const before = defaultBosses(now);
  const snapshot = JSON.stringify(before);
  assert.equal(bossCatalog.length, 18);
  assert.equal(before.length, 18);
  for (const boss of before) {
    assert.equal(portraitIcon(boss), null);
    assert.equal(portraitMotion(boss), null);
  }
  const expectedMetadata = [
    { id: "custom-5qip79", name: "暗・逐影", kind: "MVP", size: "小", element: "不死", race: "人形" },
    { id: "custom-14l2kgf", name: "亡靈巫師", kind: "Mini", size: "中", element: "不死", race: "不死" },
    { id: "custom-1n83kp1", name: "殭屍龍", kind: "MVP", size: "大", element: "暗", race: "龍" },
  ];
  for (const [index, reference] of references.entries()) {
    const metadata = expectedMetadata[index];
    const boss = Object.freeze({ id: reference.id, name: reference.name, kind: metadata.kind, status: "counting", dueAt: now + 3600000, observedAt: now, source: "manual", favorite: false, cycle: "2026-10-21", respawnMinutes: metadata.kind === "Mini" ? 120 : 180 });
    const saved = JSON.stringify(boss);
    assert.ok(portraitIcon(boss));
    assert.equal(portraitMotion(boss)?.spriteIndex, 18 + index);
    const details = bossDetails(boss);
    assert.deepEqual(details, metadata);
    assert.ok(details && Object.isFrozen(details));
    assert.equal(Object.hasOwn(details, "spriteIndex"), false);
    assert.equal(Reflect.set(details, "race", "changed"), false);
    assert.equal(details.race, metadata.race);
    assert.equal(JSON.stringify(boss), saved);
  }
  assert.equal(JSON.stringify(defaultBosses(now)), snapshot);
  assert.equal(JSON.stringify(before), snapshot);
});

test("the three custom cards select real pose animation and retain all eighteen old animations", () => {
  const Portrait = loadPortrait();
  for (const [index, reference] of references.entries()) {
    const markup = renderToStaticMarkup(React.createElement(Portrait, { boss: reference }));
    assert.ok(markup.includes(`data-preserved-motion="${18 + index}"`));
    assert.doesNotMatch(markup, /native-boss-icon|portrait-native-icon|data-generic-sigil|<img/);
  }
  for (const boss of bossCatalog) {
    const markup = renderToStaticMarkup(React.createElement(Portrait, { boss }));
    assert.ok(markup.includes(`data-preserved-motion="${boss.spriteIndex}"`));
    assert.doesNotMatch(markup, /native-boss-icon|data-generic-sigil/);
  }
  const unknown = renderToStaticMarkup(React.createElement(Portrait, { boss: { id: "custom-unknown", name: "Unknown Boss" } }));
  assert.match(unknown, /data-generic-sigil="true"/);
});

test("geneticist uses four-pose motion by saved ID, official name and approved shortcut without an atlas-as-icon fallback", () => {
  const Portrait = loadPortrait();
  const expected = { id: "dark-geneticist", spriteIndex: 21 };
  for (const boss of [{ id: "custom-1hb3imu", name: "基因" }, { id: "custom-1hb3imu", name: "Unknown" }, ...["基因", "暗・基因學者", "暗·基因學者", "暗．基因學者", " 暗 . 基因學者 "].map(name => ({ id: "different-custom-id", name }))]) {
    const before = JSON.stringify(boss);
    assert.deepEqual(portraitMotion(boss), expected);
    assert.equal(portraitIcon(boss), null);
    assert.equal(portraitAnimation(boss), null);
    const markup = renderToStaticMarkup(React.createElement(Portrait, { boss }));
    assert.match(markup, /data-preserved-motion="21"/);
    assert.doesNotMatch(markup, /data-native-animation|data-generic-sigil|<img/);
    assert.equal(JSON.stringify(boss), before);
  }
  for (const name of ["基因學者", "暗基因學者", "小基因", "基因王", "暗・基因", "Geneticist"]) {
    assert.equal(portraitMotion({ name }), null, name);
  }
  assert.equal(portraitMotion({ id: "custom-1hb3imu-extra" }), null);
  assert.equal(portraitIcon({ id: "custom-1hb3imu", name: "獸牙怪" }), null);
  assert.deepEqual(portraitMotion({ id: "custom-5qip79", name: "基因" }), { id: "dark-chaser", spriteIndex: 18 });
});

test("the geneticist motion lookup preserves its existing timer identity and all default records", () => {
  const now = Date.parse("2026-10-24T04:00:00Z");
  const defaults = defaultBosses(now);
  const snapshot = JSON.stringify(defaults);
  const boss = Object.freeze({ id: "custom-1hb3imu", name: "基因", kind: "MVP", status: "counting", dueAt: now + 3600000, observedAt: now, source: "manual", favorite: false, cycle: "2026-10-24", respawnMinutes: 120 });
  const before = JSON.stringify(boss);
  assert.deepEqual(portraitMotion(boss), { id: "dark-geneticist", spriteIndex: 21 });
  assert.equal(bossDetails(boss)?.element, "火");
  assert.equal(JSON.stringify(boss), before);
  assert.equal(bossCatalog.length, 18);
  assert.equal(defaults.length, 18);
  assert.equal(defaults.some(entry => entry.id === boss.id), false);
  assert.equal(JSON.stringify(defaultBosses(now)), snapshot);
});

test("saved executioner and shadow dragon names use real pose animations without native or generic replacements", () => {
  const Portrait = loadPortrait();
  const records = [
    { id: "custom-1xgl1sj", name: "代行刑者", shortcut: "代行", motionId: "valkyrie-executioner", spriteIndex: 23, size: "中", race: "天使" },
    { id: "custom-1hknmq6", name: "尼德豪克的影子", shortcut: "影龍", motionId: "shadow-dragon", spriteIndex: 24, size: "大", race: "龍" },
  ];
  const now = Date.parse("2026-10-27T04:00:00Z");
  const defaults = JSON.stringify(defaultBosses(now));
  for (const [index, record] of records.entries()) {
    const expected = { id: record.motionId, spriteIndex: record.spriteIndex };
    for (const name of [record.shortcut, record.name, ` ${record.name.split("").join(" ")} `]) {
      assert.deepEqual(portraitMotion({ id: "custom-fixture", name }), expected);
      const boss = Object.freeze({ id: record.id, name, kind: "MVP", status: "counting", dueAt: now + (index + 1) * 3600000, observedAt: now, source: "manual", favorite: false, cycle: "2026-10-27", respawnMinutes: 180 });
      const before = JSON.stringify(boss);
      assert.deepEqual(portraitMotion(boss), expected);
      assert.equal(portraitIcon(boss), null);
      assert.equal(portraitAnimation(boss), null);
      assert.equal(bossDetails(boss)?.size, record.size);
      assert.equal(bossDetails(boss)?.element, "暗");
      assert.equal(bossDetails(boss)?.race, record.race);
      for (const paused of [false, true]) {
        const markup = renderToStaticMarkup(React.createElement(Portrait, { boss, paused }));
        assert.ok(markup.includes(`data-preserved-motion="${record.spriteIndex}"`));
        assert.doesNotMatch(markup, /data-native-animation|data-generic-sigil|native-boss-icon|<img/);
      }
      assert.equal(JSON.stringify(boss), before);
    }
    assert.deepEqual(portraitMotion({ id: record.id, name: records[1 - index].name }), expected);
  }
  for (const name of ["代", "代行者", "代行王", "尼德豪克", "影", "影龍王", "影龍的影子", "Nidhogg"]) assert.equal(portraitMotion({ name }), null, name);
  assert.equal(bossCatalog.length, 18);
  assert.equal(JSON.stringify(defaultBosses(now)), defaults);
});

test("the saved Phreeoni identity selects index25 pose animation through its exact canonical name and shortcut", () => {
  const Portrait = loadPortrait();
  const expected = { id: "phreeoni", spriteIndex: 25 };
  const timestamp = Date.parse("2026-10-28T12:00:00Z");
  const defaults = JSON.stringify(defaultBosses(timestamp));
  for (const boss of [{ id: "custom-1gjisbs", name: "皮皮" }, { id: "custom-1gjisbs", name: "Unknown" }, ...["皮皮", "皮里恩", " 皮 里 恩 "].map(name => ({ id: "custom-phreeoni-fixture", name }))]) {
    const before = JSON.stringify(boss);
    assert.deepEqual(portraitMotion(boss), expected);
    assert.equal(portraitIcon(boss), null);
    assert.equal(portraitAnimation(boss), null);
    for (const paused of [false, true]) {
      const markup = renderToStaticMarkup(React.createElement(Portrait, { boss, paused }));
      assert.match(markup, /data-preserved-motion="25"/);
      assert.doesNotMatch(markup, /data-native-animation|data-generic-sigil|native-boss-icon|<img/);
    }
    assert.equal(JSON.stringify(boss), before);
  }
  for (const name of ["皮", "皮皮王", "皮里恩王", "皮利恩", "Phreeoni", "1159"]) assert.equal(portraitMotion({ name }), null, name);
  assert.equal(portraitMotion({ id: "custom-1gjisbs-extra" }), null);
  assert.deepEqual(portraitMotion({ id: "custom-1gjisbs", name: "逐影" }), expected);
  assert.deepEqual(portraitMotion({ id: "custom-5qip79", name: "皮皮" }), { id: "dark-chaser", spriteIndex: 18 });
  assert.equal(bossCatalog.length, 18);
  assert.equal(JSON.stringify(defaultBosses(timestamp)), defaults);
});

test("native icon styling stays inside the current portrait slot and URLs retain GitHub base paths", () => {
  const styles = source("../src/approved-art.css");
  assert.match(styles, /\.reference-timers \.portrait-native-icon \.native-boss-icon \{[^}]*height: 100%;[^}]*object-fit: contain;[^}]*border-radius: 50%/);
  assert.match(styles, /height: 22\.605cqi/);
  assert.match(styles, /grid-template-columns: 34cqi minmax\(0, 1fr\) 19\.53cqi/);
  const rewritten = rewritePublicAssetPaths(source("../lib/boss-portrait-icons.js"), "/yuki-ro-boss-timers/");
  for (const reference of references) assert.ok(rewritten.includes(`/yuki-ro-boss-timers/art/boss-icons/${reference.file}`));
  assert.doesNotMatch(rewritten, /source: "\/art\//);
});

test("metadata-only beast cards use the shared pixel animation instead of the native reference in every pause state", () => {
  const Portrait = loadPortrait();
  for (const boss of [{ id: "custom-qinmln", name: "獸牙怪" }, { id: "custom-qinmln", name: "Unknown" }, { id: "different-custom-id", name: "兽牙怪" }, { id: "another-custom-id", name: " 獸 牙 怪 " }]) {
    for (const paused of [false, true]) {
      const before = JSON.stringify(boss);
      const markup = renderToStaticMarkup(React.createElement(Portrait, { boss, paused }));
      assert.match(markup, /portrait-tirfing/);
      assert.match(markup, /data-preserved-motion="22"/);
      assert.doesNotMatch(markup, /portrait-native-animation|data-native-animation|data-generic-sigil|native-boss-icon|\.gif/);
      assert.deepEqual(portraitMotion(boss), { id: "tirfing", spriteIndex: 22 });
      assert.equal(JSON.stringify(boss), before);
    }
  }
  for (const name of ["獸牙", "兽牙", "牙怪", "獸牙怪王", "小獸牙怪", "Tirfing", "1204"]) assert.equal(portraitMotion({ name }), null, name);
  assert.deepEqual(portraitMotion({ id: "custom-14l2kgf", name: "獸牙怪" }), { id: "undead-wizard", spriteIndex: 19 });
  assert.match(source("../src/boss-timer-app.tsx"), /<BossPortrait boss=\{boss\} paused=\{!motionEnabled \|\| reducedMotion\} \/>/);
});
