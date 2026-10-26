import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { bossCatalog, bossDetails } from "../lib/boss-catalog.js";
import { bossDisplayName } from "../lib/boss-names.js";
import { portraitMotion } from "../lib/boss-portrait-icons.js";
import { defaultBosses } from "../lib/timers.js";

const records = [
  { id: "custom-14l2kgf", name: "亡靈巫師", display: "亡靈巫師", kind: "Mini", size: "中", element: "不死", race: "不死", spriteIndex: 19 },
  { id: "custom-5qip79", name: "暗・逐影", display: "逐影", kind: "MVP", size: "小", element: "不死", race: "人形", spriteIndex: 18 },
  { id: "custom-1n83kp1", name: "殭屍龍", display: "殭屍龍", kind: "MVP", size: "大", element: "暗", race: "龍", spriteIndex: 20 },
];
const page = readFileSync(new URL("../src/boss-timer-app.tsx", import.meta.url), "utf8");
const iconSource = page.match(/function PixelAttributeIcon\([\s\S]*?\n\}/)?.[0];
const metadataSource = page.match(/function BossMetadata\([\s\S]*?\n\}/)?.[0];
assert.ok(iconSource && metadataSource);
const moduleValue = { exports: {} as Record<string, React.ComponentType<{ boss: Record<string, unknown> }>> };
vm.runInNewContext(ts.transpileModule(`${iconSource}\nexport ${metadataSource}`, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText, {
  module: moduleValue, exports: moduleValue.exports, require: createRequire(import.meta.url), bossDetails,
});

test("restored screenshot attributes render for all three existing custom cards", () => {
  for (const record of records) {
    const markup = renderToStaticMarkup(React.createElement(moduleValue.exports.BossMetadata, { boss: record }));
    assert.match(markup, new RegExp(`aria-label="體型：${record.size}型"`));
    assert.match(markup, new RegExp(`class="attribute-chip chip-element element-${record.element}" aria-label="屬性：${record.element}"`));
    assert.match(markup, new RegExp(`aria-label="種族：${record.race}"`));
    if (record.element === "不死") assert.match(markup, /M5 13C-2 0 26 0 19 13L17 15V21H7V15Z/);
  }
  assert.match(readFileSync(new URL("../src/globals.css", import.meta.url), "utf8"), /\.reference-timers \.element-不死 \{[^}]*background: #cff3ec/);
});

test("new attributes preserve the shortcuts, four-pose selection, saved timers and default roster", () => {
  const timestamp = Date.UTC(2026, 9, 27, 4);
  const defaults = JSON.stringify(defaultBosses(timestamp));
  for (const record of records) {
    const boss = Object.freeze({ id: record.id, name: record.display, kind: record.kind, status: "counting", dueAt: timestamp + 600000, observedAt: timestamp, cycle: "2026-10-27", source: "manual", favorite: false, respawnMinutes: record.kind === "Mini" ? 120 : 180 });
    const before = JSON.stringify(boss);
    const details = bossDetails(boss)!;
    assert.equal(details.size, record.size);
    assert.equal(details.element, record.element);
    assert.equal(details.race, record.race);
    assert.equal(bossDisplayName(boss), record.display);
    assert.equal(portraitMotion(boss)!.spriteIndex, record.spriteIndex);
    for (const field of ["spriteIndex", "level", "respawnMinutes", "dueAt"]) assert.equal(Object.hasOwn(details, field), false);
    assert.ok(Object.isFrozen(details));
    assert.equal(JSON.stringify(boss), before);
  }
  assert.equal(bossCatalog.length, 18);
  assert.equal(JSON.stringify(defaultBosses(timestamp)), defaults);
});
