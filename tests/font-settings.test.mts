import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import * as preferences from "../lib/font-preferences.ts";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const requireModule = createRequire(import.meta.url);
function load(path: string, react: Record<string, unknown> = {}, globals: Record<string, unknown> = {}) {
  const loaded = { exports: {} as Record<string, any> };
  const javascript = ts.transpileModule(source(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(javascript, { module: loaded, exports: loaded.exports, ...globals, require: (name: string) => name === "react" ? { ...React, ...react } : name.endsWith("font-preferences") ? preferences : name.endsWith(".css") ? {} : requireModule(name) });
  return loaded.exports;
}

test("typography defaults preserve 17px weight800 names and untouched UI hierarchy", () => {
  assert.deepEqual(preferences.normalizeFontPreferences(null), preferences.DEFAULT_FONT_PREFERENCES);
  const presentation = preferences.fontPreferencePresentation(preferences.DEFAULT_FONT_PREFERENCES);
  assert.equal(presentation.style["--user-name-size"], "17px");
  assert.equal(presentation.style["--user-name-weight"], 800);
  assert.equal(presentation.style["--user-ui-scale"], 1);
  assert.ok(Object.values(presentation.attributes).every(value => value === undefined));
  assert.ok(Object.isFrozen(preferences.DEFAULT_FONT_PREFERENCES) && Object.isFrozen(preferences.DEFAULT_FONT_PREFERENCES.names));
});

test("only supported fonts, bounded finite sizes and explicit boolean styles survive storage", () => {
  const value = preferences.normalizeFontPreferences({ names: { style: "serif", size: 1000, bold: false, italic: true }, ui: { style: "url(secret)", size: -2, bold: "false", italic: "true" }, bossId: "unrelated" });
  assert.deepEqual(value, { names: { style: "serif", size: 20, bold: false, italic: true }, ui: { style: "reference", size: 85, bold: null, italic: false } });
  assert.equal(preferences.normalizeFontPreferences({ names: { size: Infinity }, ui: { size: NaN } }).names.size, 17);
  assert.equal(preferences.normalizeFontPreferences({ names: { size: 13 }, ui: { size: 130 } }).names.size, 14);
  assert.equal(preferences.normalizeFontPreferences({ ui: { size: 130 } }).ui.size, 125);
  const presentation = preferences.fontPreferencePresentation(value);
  assert.equal(presentation.style["--user-name-weight"], 400);
  assert.equal(presentation.style["--user-name-style"], "italic");
  assert.equal(presentation.attributes["data-ui-size-custom"], "true");
  assert.equal(presentation.attributes["data-ui-weight-custom"], undefined);
});

test("local controls restore, update successive targets and reset only their own browser key", () => {
  const writes: string[][] = [];
  const removed: string[] = [];
  const reads: string[] = [];
  let state: any;
  const stored = { names: { style: "sans", size: 18, bold: false, italic: false } };
  const hook = load("../hooks/use-font-preferences.ts", {
    useState: (initial: () => unknown) => { state = initial(); return [state, (next: any) => { state = typeof next === "function" ? next(state) : next; }]; }, useCallback: (callback: unknown) => callback,
  }, { window: { localStorage: { getItem: (key: string) => { reads.push(key); return JSON.stringify(stored); }, setItem: (key: string, value: string) => writes.push([key, value]), removeItem: (key: string) => removed.push(key) } } });
  const controls = hook.useFontPreferences();
  assert.equal(controls.preferences.names.size, 18);
  controls.updatePreferences("names", { italic: true });
  controls.updatePreferences("ui", { size: 115 });
  assert.equal(state.names.italic, true);
  assert.equal(state.names.style, "sans");
  assert.equal(state.ui.size, 115);
  assert.deepEqual(reads, ["bosswatch.typography"]);
  assert.ok(writes.every(([key]) => key === "bosswatch.typography"));
  assert.deepEqual(JSON.parse(writes.at(-1)![1]), state);
  controls.resetPreferences();
  assert.deepEqual(state, preferences.DEFAULT_FONT_PREFERENCES);
  assert.deepEqual(removed, ["bosswatch.typography"]);
});

test("malformed, unavailable and blocked browser storage keep settings usable", () => {
  for (const getItem of [() => "{bad", () => null, () => { throw new Error("blocked"); }]) {
    let state: any;
    const hook = load("../hooks/use-font-preferences.ts", { useState: (initial: () => unknown) => { state = initial(); return [state, (next: any) => { state = typeof next === "function" ? next(state) : next; }]; }, useCallback: (callback: unknown) => callback }, { window: { localStorage: { getItem, setItem() { throw new Error("blocked"); }, removeItem() { throw new Error("blocked"); } } } });
    const controls = hook.useFontPreferences();
    assert.deepEqual(controls.preferences, preferences.DEFAULT_FONT_PREFERENCES);
    assert.doesNotThrow(() => controls.updatePreferences("names", { size: 20 }));
    assert.equal(state.names.size, 20);
    assert.doesNotThrow(controls.resetPreferences);
  }
  const hook = load("../hooks/use-font-preferences.ts", { useState: (initial: () => unknown) => [initial(), () => {}], useCallback: (callback: unknown) => callback });
  assert.deepEqual(hook.useFontPreferences().preferences, preferences.DEFAULT_FONT_PREFERENCES);
});

test("the bottom editor offers labeled font, size, real bold, italic and reset controls", () => {
  const component = load("../src/components/font-settings.tsx").FontSettings;
  const markup = renderToStaticMarkup(React.createElement(component, { preferences: preferences.DEFAULT_FONT_PREFERENCES, onChange() {}, onReset() {} }));
  assert.equal((markup.match(/<fieldset>/g) || []).length, 2);
  assert.equal((markup.match(/type="range"/g) || []).length, 2);
  assert.equal((markup.match(/type="checkbox"/g) || []).length, 4);
  for (const label of ["Boss 名稱字體", "Boss 名稱大小", "介面文字字體", "介面文字大小", "恢復預設"]) assert.ok(markup.includes(label));
  const updates: any[] = [];
  let reset = false;
  const direct = load("../src/components/font-settings.tsx", { useId: () => "test" }).FontSettings({ preferences: preferences.DEFAULT_FONT_PREFERENCES, onChange: (...args: any[]) => updates.push(args), onReset: () => { reset = true; } });
  function visit(element: any) {
    if (Array.isArray(element)) return element.forEach(visit);
    if (!React.isValidElement(element)) return;
    const props = element.props as any;
    if (element.type === "select") props.onChange({ target: { value: "serif" } });
    if (element.type === "input") props.onChange({ target: { value: "20", checked: false } });
    if (element.type === "button") props.onClick();
    visit(props.children);
  }
  visit(direct);
  assert.deepEqual(JSON.parse(JSON.stringify(updates)), [["names", { style: "serif" }], ["names", { size: 20 }], ["names", { bold: false }], ["names", { italic: false }], ["ui", { style: "serif" }], ["ui", { size: 20 }], ["ui", { bold: false }], ["ui", { italic: false }]]);
  assert.equal(reset, true);
});

test("text changes stay scoped, allow wrapping and never scale artwork or SVG countdowns", () => {
  const styles = source("../src/font-settings.css");
  const app = source("../src/boss-timer-app.tsx");
  const hook = source("../hooks/use-font-preferences.ts");
  assert.match(styles, /\.app-shell\.reference-timers \.upcoming-route \.route-boss-name \{[^}]*var\(--user-name-size/);
  assert.match(styles, /\.app-shell\.reference-timers \.upcoming-route \.route-boss-name \{[^}]*font-synthesis: weight style/);
  assert.match(styles, /\[data-ui-italic-custom\][^}]*font-synthesis: weight style/);
  assert.match(styles, /\[data-typography-custom\] \.boss-card,[^}]*height: auto/);
  assert.match(styles, /\[data-typography-custom\] \.boss-identity h3 \{[^}]*overflow: visible/);
  assert.doesNotMatch(styles, /boss-portrait|boss-countdown|reference-countdown|transform:|zoom:|filter:|background-size:/);
  assert.match(styles, /\.app-shell \.font-settings \{[^}]*font-size: 13px; font-weight: 400; font-style: normal/);
  assert.ok(app.indexOf("<FontSettings preferences=") > app.indexOf('aria-label="依重生時間排序的 Boss"'));
  assert.ok(app.indexOf("<FontSettings preferences=") < app.indexOf('className="phone-panel"'));
  assert.doesNotMatch(hook + source("../src/components/font-settings.tsx"), /apiFetch|fetch\(|pushManager|serviceWorker|bosswatch\.background|setInterval/);
});

test("regular and bold full-name font assets are distinct while the approved bold font remains unchanged", () => {
  const font = (weight: number) => readFileSync(new URL(`../public/fonts/BosswatchBossNames-${weight}.woff2`, import.meta.url));
  assert.equal(createHash("sha256").update(font(400)).digest("hex"), "b8ef93c7e88e2ddf29854b2fbc3c2cecefcbe1119520e7aee4546c69855287ce");
  assert.equal(createHash("sha256").update(font(800)).digest("hex"), "b426834edc30738ecbac8c057c7435d95e042b4b6a6a5a02f3018c9f00684839");
  assert.notDeepEqual(font(400), font(800));
  assert.match(source("../src/font-settings.css"), /@font-face \{ font-family: "Bosswatch Boss Names";[^}]*BosswatchBossNames-400\.woff2[^}]*font-weight: 400/);
});
