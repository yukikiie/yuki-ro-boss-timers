import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { bossCatalog } from "../lib/boss-catalog.js";
import { portraitAnimation, portraitIcon, portraitMotion } from "../lib/boss-portrait-icons.js";
import { defaultBosses } from "../lib/timers.js";
import { rewritePublicAssetPaths } from "../src/asset-paths.ts";

const requireModule = createRequire(import.meta.url);
const source = readFileSync(new URL("../src/components/animated-boss-portrait.tsx", import.meta.url), "utf8");
const nativeSource = source.slice(source.indexOf("export function NativeAnimatedBossPortrait"));
const animation = portraitAnimation({ id: "custom-qinmln" })!;

function renderNative({ visible = true, documentVisible = true, reducedMotion = false, paused = false } = {}) {
  const states = [visible, documentVisible, reducedMotion];
  let stateIndex = 0;
  const javascript = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const moduleValue = { exports: {} as Record<string, React.ComponentType<typeof animation & { paused: boolean }>> };
  vm.runInNewContext(javascript, {
    module: moduleValue, exports: moduleValue.exports,
    require: (name: string) => name === "react" ? { ...React, useState: () => React.useState(states[stateIndex++]) }
      : name === "../../lib/boss-motion" ? { motionDetails: () => { throw new Error("Native portraits must not select a sprite atlas"); } }
        : requireModule(name),
  });
  const markup = renderToStaticMarkup(React.createElement(moduleValue.exports.NativeAnimatedBossPortrait, { ...animation, paused }));
  assert.equal(stateIndex, states.length);
  return markup;
}

function gifFrames(bytes: Buffer) {
  assert.match(bytes.toString("ascii", 0, 6), /^GIF8[79]a$/);
  const width = bytes.readUInt16LE(6);
  const height = bytes.readUInt16LE(8);
  const packed = bytes[10];
  let cursor = 13 + (packed & 128 ? 3 * 2 ** ((packed & 7) + 1) : 0);
  let delay = 0;
  const frames: { left: number; top: number; width: number; height: number; delay: number }[] = [];
  function subBlocks() {
    const blocks: Buffer[] = [];
    while (true) {
      assert.ok(cursor < bytes.length);
      const length = bytes[cursor++];
      if (length === 0) return blocks;
      assert.ok(cursor + length <= bytes.length);
      blocks.push(bytes.subarray(cursor, cursor + length));
      cursor += length;
    }
  }
  while (cursor < bytes.length) {
    const marker = bytes[cursor++];
    if (marker === 59) return { width, height, frames };
    if (marker === 33) {
      const label = bytes[cursor++];
      const blocks = subBlocks();
      if (label === 249) {
        assert.equal(blocks.length, 1);
        assert.equal(blocks[0].length, 4);
        delay = blocks[0].readUInt16LE(1) * 10;
      }
      continue;
    }
    assert.equal(marker, 44);
    assert.ok(cursor + 9 <= bytes.length);
    const frame = {
      left: bytes.readUInt16LE(cursor), top: bytes.readUInt16LE(cursor + 2),
      width: bytes.readUInt16LE(cursor + 4), height: bytes.readUInt16LE(cursor + 6), delay,
    };
    const localPalette = bytes[cursor + 8];
    cursor += 9 + (localPalette & 128 ? 3 * 2 ** ((localPalette & 7) + 1) : 0);
    assert.ok(frame.width > 0 && frame.height > 0);
    assert.ok(frame.left + frame.width <= width && frame.top + frame.height <= height);
    assert.ok(cursor < bytes.length);
    cursor++;
    subBlocks();
    frames.push(frame);
    delay = 0;
  }
  throw new Error("GIF trailer is missing");
}

test("the retained native reference remains compatible while beast cards select the new pixel motion", () => {
  for (const boss of [{ id: "custom-qinmln" }, { id: "custom-qinmln", name: "Unknown" }, { name: "獸牙怪" }, { name: "兽牙怪" }, { id: "different-custom-id", name: " 獸 牙 怪 " }]) {
    assert.equal(portraitAnimation(boss), animation);
    assert.equal(portraitIcon(boss), animation.stillSource);
    assert.deepEqual(portraitMotion(boss), { id: "tirfing", spriteIndex: 22 });
  }
  assert.deepEqual(animation, {
    id: "tirfing", source: "/art/boss-icons/tirfing-1204.gif", stillSource: "/art/boss-icons/tirfing-1204.png",
    width: 82, height: 126, stillFrame: { left: 18, top: 24, width: 47, height: 93 },
  });
  for (const boss of [null, undefined, false, 1204, "獸牙怪", [], {}, { id: "custom-qinmln-extra" }, { name: "獸牙" }, { name: "獸人英雄" }, { name: "獸牙怪王" }, { name: "Tirfing" }, { name: "Custom Boss" }]) {
    assert.equal(portraitAnimation(boss), null);
    assert.equal(portraitMotion(boss), null);
  }
  assert.ok(Object.isFrozen(animation));
  assert.ok(Object.isFrozen(animation.stillFrame));
  assert.equal(Reflect.set(animation.stillFrame, "left", 0), false);
});

test("original GIF and poster bytes retain the native geometry and all eighteen 100ms frames", () => {
  const gif = readFileSync(new URL(`../public${animation.source}`, import.meta.url));
  const png = readFileSync(new URL(`../public${animation.stillSource}`, import.meta.url));
  assert.equal(createHash("sha256").update(gif).digest("hex"), "1188e2b1db8ab8d7ce13ee8eea06fb28740424d910cd7a11562cc5d7b067ab41");
  assert.equal(createHash("sha256").update(png).digest("hex"), "b19e12957d9f9aad3a613c4feccefc12afdf9b47f2359e2d3628a4b2c0588ecd");
  assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(png.readUInt32BE(16), 47);
  assert.equal(png.readUInt32BE(20), 93);
  const decoded = gifFrames(gif);
  assert.equal(decoded.width, 82);
  assert.equal(decoded.height, 126);
  assert.equal(decoded.frames.length, 18);
  assert.deepEqual(decoded.frames.map(frame => frame.delay), Array(18).fill(100));
});

test("available Sharp decoder independently confirms the complete native GIF canvas", async context => {
  let sharp;
  try { sharp = requireModule("sharp"); }
  catch { context.skip("Sharp is unavailable; GIF block structure and hashes are tested independently"); return; }
  const gif = readFileSync(new URL(`../public${animation.source}`, import.meta.url));
  const metadata = await sharp(gif, { animated: true }).metadata();
  assert.equal(metadata.width, 82);
  assert.equal(metadata.pageHeight, 126);
  assert.equal(metadata.pages, 18);
  assert.deepEqual(metadata.delay, Array(18).fill(100));
});

test("active native animation uses the full canvas and paused rendering keeps the exact original poster offset", () => {
  const active = renderNative();
  const still = renderNative({ paused: true });
  const imageStyles = (markup: string) => {
    const image = markup.match(/<img\b[^>]*>/)?.[0];
    assert.ok(image);
    const style = image.match(/style="([^"]+)"/)?.[1];
    assert.ok(style);
    return Object.fromEntries(style.split(";").filter(Boolean).map(declaration => declaration.split(":")));
  };
  for (const markup of [active, still]) {
    assert.match(markup, /<div\b[^>]*class="boss-figure native-motion-portrait"/);
    const canvas = markup.match(/<span\b[^>]*class="native-motion-canvas"[^>]*>/)?.[0];
    assert.ok(canvas);
    assert.equal(canvas.match(/aspect-ratio:([^;"]+)/)?.[1].replace(/\s/g, ""), "82/126");
    assert.equal((markup.match(/<img\b/g) || []).length, 1);
    assert.doesNotMatch(markup, /<svg\b|<image\b|viewBox=|<clipPath|foreignObject/);
  }
  assert.match(active, /data-native-playing="true"/);
  const activeImage = active.match(/<img\b[^>]*>/)![0];
  assert.match(activeImage, /src="\/art\/boss-icons\/tirfing-1204\.gif"/);
  assert.match(activeImage, /width="82" height="126"/);
  assert.deepEqual(imageStyles(active), { left: "0", top: "0", width: "100%", height: "100%" });
  assert.match(still, /data-native-playing="false"/);
  const stillImage = still.match(/<img\b[^>]*>/)![0];
  assert.match(stillImage, /src="\/art\/boss-icons\/tirfing-1204\.png"/);
  assert.match(stillImage, /width="47" height="93"/);
  const posterStyles = imageStyles(still);
  for (const [property, expected] of Object.entries({ left: 18 / 82 * 100, top: 24 / 126 * 100, width: 47 / 82 * 100, height: 93 / 126 * 100 })) {
    assert.match(posterStyles[property], /%$/);
    assert.ok(Math.abs(Number.parseFloat(posterStyles[property]) - expected) < 1e-10, property);
  }
  const styles = readFileSync(new URL("../src/boss-motion.css", import.meta.url), "utf8");
  assert.match(styles, /\.native-motion-canvas \{[^}]*position: absolute;[^}]*bottom: 0;[^}]*left: 50%;[^}]*height: 100%;[^}]*transform: translateX\(-50%\)/);
  assert.match(styles, /\.native-motion-canvas img \{[^}]*position: absolute;[^}]*display: block;/);
});

test("native animation never selects a GIF while paused, reduced, offscreen or in a hidden document", () => {
  for (const settings of [{ paused: true }, { reducedMotion: true }, { visible: false }, { documentVisible: false }, { visible: false, paused: true, reducedMotion: true }]) {
    const markup = renderNative(settings);
    assert.match(markup, /data-native-playing="false"/);
    assert.ok(markup.includes(animation.stillSource));
    assert.ok(!markup.includes(animation.source));
  }
});

test("native visibility and reduced-motion listeners update correctly and clean up", () => {
  const body = nativeSource.match(/useEffect\(\(\) => \{([\s\S]*?)\n  \}, \[\]\);/)?.[1];
  assert.ok(body);
  assert.doesNotMatch(body, /fetch\(|apiFetch|localStorage|sessionStorage|setInterval/);
  const element = {};
  const documentListeners = new Map<string, () => void>();
  const motionListeners = new Map<string, () => void>();
  const removed: string[] = [];
  const updates: { visible: boolean[]; document: boolean[]; reduced: boolean[] } = { visible: [], document: [], reduced: [] };
  const preference = {
    matches: false,
    addEventListener: (event: string, handler: () => void) => motionListeners.set(event, handler),
    removeEventListener: (event: string, handler: () => void) => { assert.equal(handler, motionListeners.get(event)); removed.push(`motion:${event}`); },
  };
  const documentState = {
    hidden: false,
    addEventListener: (event: string, handler: () => void) => documentListeners.set(event, handler),
    removeEventListener: (event: string, handler: () => void) => { assert.equal(handler, documentListeners.get(event)); removed.push(`document:${event}`); },
  };
  let observed = false;
  let disconnected = false;
  let intersection: ((entries: { isIntersecting: boolean }[]) => void) | undefined;
  const cleanup = vm.runInNewContext(`(() => {${body}})()`, {
    portraitRef: { current: element }, document: documentState,
    window: { matchMedia: (query: string) => { assert.equal(query, "(prefers-reduced-motion: reduce)"); return preference; } },
    IntersectionObserver: class {
      constructor(callback: (entries: { isIntersecting: boolean }[]) => void, options: { rootMargin: string }) { intersection = callback; assert.equal(options.rootMargin, "80px"); }
      observe(target: unknown) { assert.equal(target, element); observed = true; }
      disconnect() { disconnected = true; }
    },
    setVisible: (value: boolean) => updates.visible.push(value),
    setDocumentVisible: (value: boolean) => updates.document.push(value),
    setReducedMotion: (value: boolean) => updates.reduced.push(value),
  }) as () => void;
  assert.equal(observed, true);
  intersection!([{ isIntersecting: true }]);
  intersection!([{ isIntersecting: false }]);
  documentState.hidden = true;
  documentListeners.get("visibilitychange")!();
  preference.matches = true;
  motionListeners.get("change")!();
  assert.deepEqual(updates.visible, [true, false]);
  assert.deepEqual(updates.document, [true, false]);
  assert.deepEqual(updates.reduced, [false, true]);
  cleanup();
  assert.equal(disconnected, true);
  assert.deepEqual(removed.sort(), ["document:visibilitychange", "motion:change"]);
});

test("the retained native reference does not add defaults or mutate timers and saved IDs keep their motion indices", () => {
  const timestamp = Date.parse("2026-10-22T04:00:00Z");
  const defaults = defaultBosses(timestamp);
  const snapshot = JSON.stringify(defaults);
  assert.equal(defaults.length, 18);
  for (const boss of bossCatalog) {
    assert.equal(portraitAnimation(boss), null);
    assert.equal(typeof boss.spriteIndex, "number");
  }
  for (const [index, id] of ["custom-5qip79", "custom-14l2kgf", "custom-1n83kp1"].entries()) {
    const boss = Object.freeze({ id, name: "Unknown", dueAt: timestamp + 3600000, observedAt: timestamp, sent: [600] });
    assert.equal(portraitAnimation(boss), null);
    assert.equal(portraitMotion(boss)?.spriteIndex, 18 + index);
  }
  const saved = Object.freeze({ id: "custom-qinmln", name: "獸牙怪", status: "counting", dueAt: timestamp + 7200000, observedAt: timestamp, sent: [600], favorite: true });
  const savedSnapshot = JSON.stringify(saved);
  assert.equal(portraitAnimation(saved), animation);
  assert.deepEqual(portraitMotion(saved), { id: "tirfing", spriteIndex: 22 });
  assert.equal(JSON.stringify(saved), savedSnapshot);
  assert.equal(JSON.stringify(defaults), snapshot);
  assert.equal(JSON.stringify(defaultBosses(timestamp)), snapshot);
  const rewritten = rewritePublicAssetPaths(readFileSync(new URL("../lib/boss-portrait-icons.js", import.meta.url), "utf8"), "/yuki-ro-boss-timers/");
  for (const path of [animation.source, animation.stillSource]) assert.ok(rewritten.includes(`/yuki-ro-boss-timers${path}`));
});
