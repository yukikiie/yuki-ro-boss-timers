import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import * as themes from "../lib/background-themes.ts";

const requireModule = createRequire(import.meta.url);
const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

function load(path: string, react: Record<string, unknown> = {}, globals: Record<string, unknown> = {}) {
  const moduleValue = { exports: {} as Record<string, any> };
  const javascript = ts.transpileModule(source(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(javascript, {
    module: moduleValue, exports: moduleValue.exports, document: { body: {} }, ...globals,
    require: (name: string) => name === "react" ? { ...React, ...react } : name === "react-dom" ? { createPortal: (content: unknown) => content } : name.endsWith("background-themes") ? themes : name.endsWith(".css") ? {} : requireModule(name),
  });
  return moduleValue.exports;
}

test("the five immutable background choices use only complete desktop and mobile artwork", () => {
  assert.deepEqual(themes.BACKGROUND_THEMES.map(theme => theme.id), ["moon-garden", "mushroom-forest", "sky-islands", "crystal-cavern", "cosmic-sanctuary"]);
  assert.deepEqual(themes.BACKGROUND_ASPECT_RATIOS, { desktop: 3, mobile: 4 / 3 });
  assert.deepEqual(themes.BACKGROUND_THEMES.map(theme => theme.panelColor), ["#d9d5e3", "#cedbd2", "#d7e2ec", "#66627e", "#566d80"]);
  assert.ok(Object.isFrozen(themes.BACKGROUND_THEMES));
  for (const theme of themes.BACKGROUND_THEMES) {
    assert.ok(Object.isFrozen(theme));
    assert.equal(theme.desktop, `/art/backgrounds/${theme.id}-desktop-soft-v2.png`);
    assert.equal(theme.mobile, `/art/backgrounds/${theme.id}-mobile-soft-v2.png`);
    assert.equal(themes.resolveBackgroundTheme(theme.id), theme);
    assert.ok(Object.isFrozen(theme.desktopSize) && Object.isFrozen(theme.mobileSize));
    for (const [path, size] of [[theme.desktop, theme.desktopSize], [theme.mobile, theme.mobileSize]] as const) {
      const bytes = readFileSync(new URL(`../public${path}`, import.meta.url));
      assert.deepEqual([bytes.readUInt32BE(16), bytes.readUInt32BE(20)], [...size]);
    }
  }
  for (const value of [undefined, null, "", "arena", "ancient-monster-arena", "MOON-GARDEN", {}, 0]) assert.equal(themes.resolveBackgroundTheme(value).id, "moon-garden");
});

test("real selection restores and writes only the device background key while explicit fixtures stay isolated", () => {
  for (const preview of [undefined, "crystal-cavern"] as const) {
    const reads: string[] = [];
    const writes: string[][] = [];
    let state: unknown;
    const hook = load("../hooks/use-background-theme.ts", {
      useState: (initial: any) => { state = initial(); return [state, (next: unknown) => { state = next; }]; },
      useCallback: (callback: unknown) => callback,
    }, { window: { localStorage: { getItem: (key: string) => { reads.push(key); return "sky-islands"; }, setItem: (key: string, value: string) => writes.push([key, value]) } } });
    const selection = hook.useBackgroundTheme(preview);
    assert.equal(selection.themeId, preview ?? "sky-islands");
    selection.setThemeId("cosmic-sanctuary");
    assert.equal(state, "cosmic-sanctuary");
    assert.deepEqual(reads, preview ? [] : ["bosswatch.background"]);
    assert.deepEqual(writes, preview ? [] : [["bosswatch.background", "cosmic-sanctuary"]]);
  }
});

test("invalid or inaccessible storage safely defaults without disabling in-memory changes", () => {
  for (const getItem of [() => "arena", () => null, () => { throw new Error("blocked"); }]) {
    let state: unknown;
    const hook = load("../hooks/use-background-theme.ts", {
      useState: (initial: any) => { state = initial(); return [state, (next: unknown) => { state = next; }]; },
      useCallback: (callback: unknown) => callback,
    }, { window: { localStorage: { getItem, setItem: () => { throw new Error("blocked"); } } } });
    const selection = hook.useBackgroundTheme();
    assert.equal(selection.themeId, "moon-garden");
    assert.doesNotThrow(() => selection.setThemeId("mushroom-forest"));
    assert.equal(state, "mushroom-forest");
  }
});

test("the chooser is closed by default and opens five keyboard-accessible selected radio thumbnails", () => {
  for (const open of [false, true]) {
    const components = load("../src/components/background-chooser.tsx", { useState: () => React.useState(open) });
    const markup = renderToStaticMarkup(React.createElement(components.BackgroundChooser, { themeId: "sky-islands", onSelect: () => assert.fail("SSR must not select a background") }));
    assert.ok(markup.includes(`aria-expanded="${open}"`));
    assert.equal((markup.match(/type="radio"/g) || []).length, open ? 5 : 0);
    assert.equal((markup.match(/checked=""/g) || []).length, open ? 1 : 0);
    if (open) {
      for (const theme of themes.BACKGROUND_THEMES) {
        assert.ok(markup.includes(`src="${theme.desktop}"`));
        assert.ok(markup.includes(`srcSet="${theme.mobile}"`));
        assert.ok(markup.includes(theme.label));
      }
      assert.match(markup.match(/<input\b[^>]*checked=""[^>]*>/)?.[0] ?? "", /value="sky-islands"/);
      assert.match(markup, /<fieldset>/);
      assert.match(markup, /選擇頁首背景/);
    } else assert.doesNotMatch(markup, /<img|<fieldset|background-gallery-heading/);
  }
});

test("background controls preserve complete image geometry and remain independent of timers and subscriptions", () => {
  const hook = source("../hooks/use-background-theme.ts");
  const chooser = source("../src/components/background-chooser.tsx");
  const styles = source("../src/background-chooser.css");
  const app = source("../src/boss-timer-app.tsx");
  assert.doesNotMatch(hook + chooser, /apiFetch|fetch\(|pushManager|serviceWorker|bosswatch\.motion|setInterval/);
  assert.match(chooser, /event\.key !== "Escape"/);
  assert.match(chooser, /removeEventListener\("pointerdown", outside\)/);
  assert.match(styles, /\.background-option img \{ height: auto;/);
  assert.doesNotMatch(styles, /object-fit:\s*cover|background-size:|repeat-[xy]|transform:\s*scale/);
  assert.match(app, /useBackgroundTheme\(previewBackgroundTheme\)/);
  assert.match(app, /<AnimatedHeader phase=\{scenePhase\} themeId=\{themeId\}/);
  assert.match(app, /--scene-garden-image[^\n]*SCENE_ASSETS\[scenePhase\]\.garden/);
});

test("the visible bottom theme gallery shares all five choices, selected state and callbacks with the header chooser", () => {
  const components = load("../src/components/background-chooser.tsx", { useId: () => "bottom-test" });
  const selected: string[] = [];
  const props = { themeId: "cosmic-sanctuary", onSelect: (id: string) => selected.push(id) };
  const markup = renderToStaticMarkup(React.createElement(components.BackgroundSettings, props));
  assert.match(markup, /id="background-settings"/);
  assert.match(markup, /主題背景/);
  assert.equal((markup.match(/type="radio"/g) || []).length, 5);
  assert.equal((markup.match(/使用中/g) || []).length, 1);
  assert.match(markup.match(/<input\b[^>]*checked=""[^>]*>/)?.[0] ?? "", /value="cosmic-sanctuary"/);
  for (const theme of themes.BACKGROUND_THEMES) assert.ok(markup.includes(`src="${theme.desktop}"`) && markup.includes(`srcSet="${theme.mobile}"`));
  function visit(element: any) {
    if (Array.isArray(element)) return element.forEach(visit);
    if (!React.isValidElement(element)) return;
    const elementProps = element.props as any;
    if (element.type === "input") elementProps.onChange();
    visit(elementProps.children);
  }
  visit(components.BackgroundSettings(props));
  assert.deepEqual(selected, themes.BACKGROUND_THEMES.map(theme => theme.id));
  const app = source("../src/boss-timer-app.tsx");
  assert.match(app, /<BackgroundChooser themeId=\{themeId\} onSelect=\{setThemeId\} \/>/);
  assert.match(app, /<BackgroundSettings themeId=\{themeId\} onSelect=\{setThemeId\} \/>\s*<FontSettings/);
  assert.ok(app.indexOf("<BackgroundSettings themeId=") > app.indexOf('aria-label="依重生時間排序的 Boss"'));
  assert.match(source("../src/components/font-settings.tsx"), /id="font-settings"/);
});

test("each thumbnail invokes selection and Escape or outside interaction closes the gallery with listener cleanup", () => {
  const selected: string[] = [];
  const listeners = new Map<string, (event: any) => void>();
  const removed: string[] = [];
  let open = true;
  let effect: (() => (() => void)) | undefined;
  let reference = 0;
  let restoredFocus = 0;
  const components = load("../src/components/background-chooser.tsx", {
    useState: () => [open, (next: boolean) => { open = next; }],
    useId: () => "chooser-test",
    useRef: () => {
      const index = reference++;
      return { current: index === 0 ? { contains: (target: unknown) => target === "inside" } : index === 1 ? { focus: () => { restoredFocus++; } } : { contains: (target: unknown) => target === "gallery", querySelector: () => ({ focus() {} }) } };
    },
    useEffect: (callback: () => (() => void)) => { effect = callback; },
  }, { document: {
    body: {},
    addEventListener: (name: string, callback: (event: any) => void) => listeners.set(name, callback),
    removeEventListener: (name: string, callback: (event: any) => void) => { assert.equal(callback, listeners.get(name)); removed.push(name); },
  } });
  const tree = components.BackgroundChooser({ themeId: "moon-garden", onSelect: (id: string) => selected.push(id) });
  function visit(value: any) {
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (!React.isValidElement(value)) return;
    const props = value.props as any;
    if (value.type === "input") props.onChange();
    visit(props.children);
  }
  visit(tree);
  assert.deepEqual(selected, themes.BACKGROUND_THEMES.map(theme => theme.id));
  const cleanup = effect!();
  listeners.get("keydown")!({ key: "Escape", preventDefault() {} });
  assert.equal(open, false);
  assert.equal(restoredFocus, 1);
  open = true;
  listeners.get("pointerdown")!({ target: "inside" });
  assert.equal(open, true);
  listeners.get("pointerdown")!({ target: "gallery" });
  assert.equal(open, true);
  listeners.get("pointerdown")!({ target: "outside" });
  assert.equal(open, false);
  cleanup();
  assert.deepEqual(removed.sort(), ["keydown", "pointerdown"]);
});

test("portal galleries stay within the viewport after short-landscape resize and parent-page scrolling", () => {
  const gallery = { style: {} as Record<string, string>, getBoundingClientRect: () => ({ height: Math.min(600, Number.parseFloat(gallery.style.maxHeight)) }), querySelector: () => ({ focus(options: unknown) { assert.deepEqual(JSON.parse(JSON.stringify(options)), { preventScroll: true }); } }) };
  const listeners = new Map<string, () => void>();
  const viewport = { innerHeight: 390, innerWidth: 844, addEventListener: (name: string, callback: () => void) => listeners.set(name, callback), removeEventListener() {} };
  const rectangle = { top: 310, bottom: 338, right: 390 };
  let reference = 0;
  let effect: (() => (() => void)) | undefined;
  const components = load("../src/components/background-chooser.tsx", {
    useState: () => [true, () => {}], useId: () => "position-test",
    useRef: () => {
      const index = reference++;
      return { current: index === 0 ? { closest: () => ({ clientWidth: 480 }) } : index === 1 ? { getBoundingClientRect: () => rectangle } : gallery };
    },
    useEffect: (callback: () => (() => void)) => { effect = callback; },
  }, { window: viewport, document: { body: {}, documentElement: { clientWidth: 844 }, addEventListener() {}, removeEventListener() {} } });
  components.BackgroundChooser({ themeId: "moon-garden", onSelect() {} });
  const cleanup = effect!();
  assert.equal(gallery.style.top, "12px");
  assert.equal(gallery.style.left, "12px");
  assert.equal(gallery.style.width, "456px");
  assert.equal(gallery.style.maxHeight, "366px");
  rectangle.top = 100; rectangle.bottom = 128;
  listeners.get("scroll")!();
  assert.equal(gallery.style.top, "12px");
  viewport.innerHeight = 900;
  listeners.get("resize")!();
  assert.equal(gallery.style.top, "136px");
  assert.equal(gallery.style.maxHeight, "876px");
  assert.match(source("../src/background-chooser.css"), /position: fixed/);
  assert.match(source("../src/components/background-chooser.tsx"), /<\/section>, document\.body\)/);
  cleanup();
});
