import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const requireModule = createRequire(import.meta.url);
const readSource = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const source = readSource("../src/components/living-scene.tsx");

function loadModule(path: string, dependencies: Record<string, unknown> = {}) {
  const javascript = ts.transpileModule(readSource(path), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const moduleValue = { exports: {} as Record<string, unknown> };
  vm.runInNewContext(javascript, {
    module: moduleValue, exports: moduleValue.exports,
    require: (name: string) => Object.hasOwn(dependencies, name) ? dependencies[name] : requireModule(name),
  });
  return moduleValue.exports;
}

const sceneTime = loadModule("../lib/scene-time.ts");
type Phase = "day" | "afternoon" | "night";
type HeaderOptions = {
  desktop?: boolean; phase?: Phase; paused?: boolean; reduced?: boolean;
  intersecting?: boolean; documentVisible?: boolean; tall?: boolean;
};

function renderHeader({ desktop = false, phase = "day", paused = false, reduced = false, intersecting = true, documentVisible = true, tall = true }: HeaderOptions = {}) {
  const stateValues = [intersecting, documentVisible, reduced, desktop];
  let stateIndex = 0;
  const components = loadModule("../src/components/living-scene.tsx", {
    react: {
      ...React,
      useState: () => React.useState(stateValues[stateIndex++]),
    },
    "../../lib/scene-time": sceneTime,
    "../../lib/background-themes": loadModule("../lib/background-themes.ts"),
    "./theme-residents": { ThemeResidents: () => null },
    "./garden-creature": {
      HeaderResidents: ({ phase: residentPhase, active, tall: residentTall }: { phase: Phase; active: boolean; tall?: boolean }) => React.createElement("g", {
        "data-test-residents": residentPhase,
        "data-test-active": String(active),
        "data-test-tall": String(residentTall),
      }),
    },
  });
  const Header = components.AnimatedHeader as React.ComponentType<{ phase: Phase; paused: boolean; tall: boolean }>;
  const markup = renderToStaticMarkup(React.createElement(Header, { phase, paused, tall }));
  assert.equal(stateIndex, stateValues.length);
  return markup;
}

test("desktop renders one complete 2172 by 724 panorama with an identically sized overlay", () => {
  for (const phase of ["day", "afternoon", "night"] as const) {
    const markup = renderHeader({ desktop: true, phase });
    const image = markup.match(/<img\b[^>]*class="desktop-header-image"[^>]*>/)?.[0];
    assert.ok(image, phase);
    assert.match(image, /width="2172"/);
    assert.match(image, /height="724"/);
    assert.match(image, /src="\/art\/ro-header-desktop-[^"]+\.png"/);
    assert.equal((markup.match(/class="desktop-header-image"/g) || []).length, 1);
    assert.match(markup, /viewBox="0 0 2172 724" preserveAspectRatio="xMidYMid meet"/);
    assert.doesNotMatch(markup, /class="mobile-header-scene"|class="animated-header-image"|preserveAspectRatio="none"|preserveAspectRatio="[^"]*slice"/);
    assert.match(markup, new RegExp(`data-desktop-scene="${phase}"`));
    assert.match(markup, /class="desktop-header-title"/);
    for (const animation of ["scene-waterfall", "scene-stream", "scene-ripple", "scene-petal", "scene-night-star"]) {
      assert.ok(markup.includes(animation), `${phase}: ${animation}`);
    }
    const clips = [...markup.matchAll(/<clipPath id="([^"]+)"/g)].map(match => match[1]);
    assert.equal(clips.length, 2);
    assert.equal(new Set(clips).size, clips.length);
    for (const identifier of clips) assert.ok(markup.includes(`clip-path="url(#${identifier})"`));
  }
});

test("desktop media changes and reduced-motion changes update the header and remove their listeners", () => {
  const body = source.match(/useEffect\(\(\) => \{\s*(const preference = window\.matchMedia\("\(prefers-reduced-motion: reduce\)"\);[\s\S]*?)\n  \}, \[\]\);/)?.[1];
  assert.ok(body);
  assert.doesNotMatch(body, /apiFetch|fetch\(|localStorage|sessionStorage|setInterval/);
  const handlers = new Map<string, () => void>();
  const removed: string[] = [];
  const preferences = new Map([
    ["(prefers-reduced-motion: reduce)", { matches: false }],
    ["(min-width: 1100px)", { matches: false }],
  ]);
  const updates: { reduced: boolean[]; desktop: boolean[] } = { reduced: [], desktop: [] };
  const cleanup = vm.runInNewContext(`(() => {${body}})()`, {
    window: {
      matchMedia: (query: string) => {
        const preference = preferences.get(query);
        assert.ok(preference, query);
        return {
          get matches() { return preference.matches; },
          addEventListener: (event: string, handler: () => void) => { assert.equal(event, "change"); handlers.set(query, handler); },
          removeEventListener: (event: string, handler: () => void) => { assert.equal(event, "change"); assert.equal(handler, handlers.get(query)); removed.push(query); },
        };
      },
    },
    setReducedMotion: (value: boolean) => updates.reduced.push(value),
    setDesktopScene: (value: boolean) => updates.desktop.push(value),
  }) as () => void;
  preferences.get("(min-width: 1100px)")!.matches = true;
  handlers.get("(min-width: 1100px)")!();
  preferences.get("(prefers-reduced-motion: reduce)")!.matches = true;
  handlers.get("(prefers-reduced-motion: reduce)")!();
  preferences.get("(min-width: 1100px)")!.matches = false;
  handlers.get("(min-width: 1100px)")!();
  assert.deepEqual(updates.desktop, [false, true, true, false]);
  assert.deepEqual(updates.reduced, [false, false, true, true]);
  cleanup();
  assert.deepEqual(removed.sort(), [...preferences.keys()].sort());
});

test("mobile retains the original phase paintings and the complete tall or standard geometry", () => {
  const assets = sceneTime.SCENE_ASSETS as Record<Phase, { header: string }>;
  for (const phase of ["day", "afternoon", "night"] as const) {
    for (const tall of [false, true]) {
      const markup = renderHeader({ phase, tall });
      assert.match(markup, /class="mobile-header-scene"/);
      assert.doesNotMatch(markup, /desktop-header-image|desktop-header-title|ro-header-desktop-/);
      assert.match(markup, new RegExp(`viewBox="0 0 1672 ${tall ? 1254 : 941}"`));
      const expected = tall ? phase === "day" ? "/art/ro-header-tall-morning.png" : phase === "night" ? "/art/ro-header-tall-night.png" : "/art/ro-header-tall-preview.png" : assets[phase].header;
      assert.ok(markup.includes(`src="${expected}"`));
      assert.match(markup, new RegExp(`data-test-tall="${String(tall)}"`));
    }
  }
});

test("desktop reuses the existing residents and gates them on pause, visibility and reduced motion", () => {
  const cases: { settings: HeaderOptions; active: boolean }[] = [
    { settings: {}, active: true },
    { settings: { paused: true }, active: false },
    { settings: { reduced: true }, active: false },
    { settings: { intersecting: false }, active: false },
    { settings: { documentVisible: false }, active: false },
  ];
  for (const { settings, active } of cases) {
    const markup = renderHeader({ ...settings, desktop: true, phase: "afternoon" });
    assert.equal((markup.match(/data-test-residents=/g) || []).length, 1);
    assert.match(markup, /transform="translate\(250 -225\)"/);
    assert.match(markup, /data-test-residents="afternoon"/);
    assert.match(markup, new RegExp(`data-test-active="${String(active)}"`));
  }
  const sceneStyles = readSource("../src/living-scene.css");
  assert.match(sceneStyles, /motion-paused/);
  assert.match(sceneStyles, /prefers-reduced-motion:\s*reduce/);
  assert.match(sceneStyles, /data-scene-visible="false"/);
});

test("every referenced desktop panorama is a new complete three-to-one PNG", () => {
  const paths = new Set<string>();
  for (const phase of ["day", "afternoon", "night"] as const) {
    const markup = renderHeader({ desktop: true, phase });
    const image = markup.match(/<img\b[^>]*class="desktop-header-image"[^>]*>/)?.[0];
    const path = image?.match(/src="([^"]+)"/)?.[1];
    assert.ok(path);
    paths.add(path);
  }
  assert.ok(paths.size >= 1);
  for (const path of paths) {
    const bytes = readFileSync(new URL(`../public${path}`, import.meta.url));
    assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", path);
    assert.equal(bytes.readUInt32BE(16), 2172, path);
    assert.equal(bytes.readUInt32BE(20), 724, path);
  }
});

test("all fifty-one previously tracked artwork assets remain byte-for-byte unchanged", () => {
  const manifest = JSON.parse(readSource("./fixtures/approved-art-hashes.json")) as { path: string; sha256: string }[];
  assert.equal(manifest.length, 51);
  assert.equal(new Set(manifest.map(asset => asset.path)).size, manifest.length);
  for (const asset of manifest) {
    const bytes = readFileSync(new URL(`../public${asset.path}`, import.meta.url));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), asset.sha256, asset.path);
  }
});
