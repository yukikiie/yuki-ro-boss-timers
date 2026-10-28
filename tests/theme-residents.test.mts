import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const requireModule = createRequire(import.meta.url);
const modules = new Map<string, { exports: Record<string, any> }>();

function loadModule(path: URL): Record<string, any> {
  const cached = modules.get(path.href);
  if (cached) return cached.exports;
  const moduleValue = { exports: {} as Record<string, any> };
  modules.set(path.href, moduleValue);
  const javascript = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(javascript, {
    module: moduleValue, exports: moduleValue.exports,
    require: (name: string) => {
      if (!name.startsWith(".")) return requireModule(name);
      if (name.endsWith(".json")) return { default: JSON.parse(readFileSync(new URL(name, path), "utf8")) };
      const scriptPath = new URL(`${name}.ts`, path);
      return loadModule(existsSync(scriptPath) ? scriptPath : new URL(`${name}.tsx`, path));
    },
  });
  return moduleValue.exports;
}

type Layout = "desktop" | "mobile";
type Phase = "day" | "afternoon" | "night";
type Resident = {
  id: string; x: number; y: number; width: number;
  support: "grass" | "path" | "rock" | "branch" | "air";
  landmark: string;
  depth: "distant" | "middle" | "foreground";
  motion: "rest" | "perch" | "hop" | "hover";
  facing: "left" | "right";
};
type SpriteDetails = Resident & {
  source: string; atlasWidth: number; atlasHeight: number;
  frames: { left: number; top: number; width: number; height: number; offsetLeft: number; offsetTop: number }[];
  cellWidth: number; cellHeight: number; sleeping: boolean;
  left: number; top: number; height: number;
};
const scene = loadModule(new URL("../lib/theme-residents.ts", import.meta.url)) as {
  THEME_SCENE_SIZE: Record<Layout, { width: number; height: number }>;
  THEME_RESIDENTS: Record<string, Record<Layout, Resident[]>>;
  themeResidentDetails: (resident: Resident, phase?: Phase) => SpriteDetails | null;
};
const components = loadModule(new URL("../src/components/theme-residents.tsx", import.meta.url));
const themeIds = ["moon-garden", "mushroom-forest", "sky-islands", "crystal-cavern", "cosmic-sanctuary"];
const retainedIds = ["purple-poring", "hat-poring", "blue-ghost", "leaf-poring", "lunatic", "peco-chick", "pink-poring", "angel-poring"];
const phases: Phase[] = ["day", "afternoon", "night"];
const layouts: Layout[] = ["desktop", "mobile"];

type BackgroundTheme = {
  id: string; desktop: string; mobile: string;
  desktopSize: readonly [number, number]; mobileSize: readonly [number, number];
};
const backgrounds = loadModule(new URL("../lib/background-themes.ts", import.meta.url)) as { BACKGROUND_THEMES: BackgroundTheme[] };
type HeaderOptions = {
  themeId: string; desktop?: boolean; phase?: Phase; tall?: boolean;
  paused?: boolean; reduced?: boolean; intersecting?: boolean; documentVisible?: boolean;
};

function renderThemedHeader({ themeId, desktop = false, phase = "afternoon", tall = true, paused = false, reduced = false, intersecting = true, documentVisible = true }: HeaderOptions) {
  const states = [intersecting, documentVisible, reduced, desktop];
  let stateIndex = 0;
  const javascript = ts.transpileModule(readFileSync(new URL("../src/components/living-scene.tsx", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const headerModule = { exports: {} as Record<string, any> };
  const dependencies: Record<string, unknown> = {
    react: { ...React, useState: () => React.useState(states[stateIndex++]) },
    "../../lib/scene-time": loadModule(new URL("../lib/scene-time.ts", import.meta.url)),
    "../../lib/background-themes": backgrounds,
    "./theme-residents": components,
    "./garden-creature": { HeaderResidents: () => React.createElement("g", { "data-test-legacy-residents": "true" }) },
  };
  vm.runInNewContext(javascript, {
    module: headerModule, exports: headerModule.exports,
    require: (name: string) => Object.hasOwn(dependencies, name) ? dependencies[name] : requireModule(name),
  });
  const Header = headerModule.exports.AnimatedHeader as React.ComponentType<{ themeId: string; phase: Phase; paused: boolean; tall: boolean }>;
  const markup = renderToStaticMarkup(React.createElement(Header, { themeId, phase, paused, tall }));
  assert.equal(stateIndex, states.length, "visibility, document, motion preference and breakpoint states are supplied");
  return markup;
}

test("every painting has a separate supported monster composition with clear depth and scale", () => {
  assert.deepEqual(Object.keys(scene.THEME_RESIDENTS).sort(), [...themeIds].sort());
  assert.equal(scene.THEME_SCENE_SIZE.desktop.width, 1000);
  assert.equal(scene.THEME_SCENE_SIZE.desktop.height, 1000 / 3);
  assert.equal(scene.THEME_SCENE_SIZE.mobile.width, 1000);
  assert.equal(scene.THEME_SCENE_SIZE.mobile.height, 750);
  const compositions = new Set<string>();
  for (const themeId of themeIds) {
    for (const layout of layouts) {
      const residents = scene.THEME_RESIDENTS[themeId][layout];
      const context = `${themeId}/${layout}`;
      assert.ok(residents.length >= 6 && residents.length <= 8, context);
      assert.equal(new Set(residents.map(resident => resident.id)).size, residents.length, context);
      assert.ok(residents.every(resident => retainedIds.includes(resident.id)), context);
      assert.ok(residents.every(resident => resident.landmark.trim().length >= 6), `${context}: identify the actual support landmark`);
      assert.ok(residents.every(resident => ["left", "right"].includes(resident.facing)), context);
      const chick = residents.find(resident => resident.id === "peco-chick");
      const angel = residents.find(resident => resident.id === "angel-poring");
      const rabbit = residents.find(resident => resident.id === "lunatic");
      assert.ok(chick && angel && rabbit, context);
      assert.ok(["rock", "branch"].includes(chick.support), `${context}: chick has a perch`);
      assert.equal(chick.motion, "perch", context);
      assert.equal(angel.support, "air", context);
      assert.equal(angel.motion, "hover", context);
      assert.ok(["grass", "path", "rock"].includes(rabbit.support), `${context}: rabbit stays near terrain`);
      assert.equal(rabbit.motion, "hop", context);
      assert.ok(residents.filter(resident => resident.id !== "angel-poring").every(resident => resident.support !== "air" && resident.motion !== "hover"), `${context}: grounded monsters do not float`);
      const widths = residents.map(resident => resident.width);
      const baselines = residents.map(resident => resident.y);
      assert.ok(Math.max(...widths) / Math.min(...widths) >= 1.5, `${context}: distant and foreground characters differ in scale`);
      assert.ok(Math.max(...baselines) - Math.min(...baselines) > scene.THEME_SCENE_SIZE[layout].height * .25, `${context}: characters do not form a single row`);
      assert.ok(new Set(residents.map(resident => resident.depth)).size >= 2, context);
      compositions.add(JSON.stringify(residents.map(({ id, x, y, width }) => [id, x, y, width])));
    }
  }
  assert.equal(compositions.size, themeIds.length * layouts.length, "every desktop and mobile painting has its own composition");
});

test("native sprite clips and terrain contact remain complete in every theme, layout and phase", () => {
  const sources = new Map<string, [number, number]>();
  for (const themeId of themeIds) {
    for (const layout of layouts) {
      const viewport = scene.THEME_SCENE_SIZE[layout];
      for (const resident of scene.THEME_RESIDENTS[themeId][layout]) {
        for (const phase of phases) {
          const context = `${themeId}/${layout}/${resident.id}/${phase}`;
          const details = scene.themeResidentDetails(resident, phase);
          assert.ok(details, context);
          assert.ok(details.source === "/art/ro-garden-creatures.png" || details.source === "/art/ro-header-added-porings.png", `${context}: reuse approved native monster artwork`);
          assert.ok(details.frames.length >= 2 && details.frames.length <= 4, context);
          assert.ok(details.cellWidth > 0 && details.cellHeight > 0 && details.width > 0 && details.height > 0, context);
          assert.ok(details.left >= 0 && details.top >= 0, `${context}: complete top and left bounds`);
          assert.ok(details.left + details.width <= viewport.width, `${context}: complete right bound`);
          assert.ok(details.top + details.height <= viewport.height, `${context}: complete bottom bound`);
          const scale = details.width / details.cellWidth;
          const bottom = Math.max(...details.frames.map(frame => details.top + (frame.offsetTop + frame.height) * scale));
          assert.ok(Math.abs(bottom - resident.y) < .00001, `${context}: feet meet the mapped support point`);
          for (const frame of details.frames) {
            assert.ok(frame.left >= 0 && frame.top >= 0 && frame.width > 0 && frame.height > 0, context);
            assert.ok(frame.left + frame.width <= details.atlasWidth && frame.top + frame.height <= details.atlasHeight, `${context}: source clip stays inside atlas`);
            assert.ok(frame.offsetLeft >= 0 && frame.offsetTop >= 0, context);
            assert.ok(frame.offsetLeft + frame.width <= details.cellWidth && frame.offsetTop + frame.height <= details.cellHeight, `${context}: no native pose is cut off`);
          }
          sources.set(details.source, [details.atlasWidth, details.atlasHeight]);
        }
      }
    }
  }
  for (const [source, [width, height]] of sources) {
    const bytes = readFileSync(new URL(`../public${source}`, import.meta.url));
    assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", source);
    assert.equal(bytes.readUInt32BE(16), width, source);
    assert.equal(bytes.readUInt32BE(20), height, source);
  }
});

test("requested header creatures grow uniformly by thirty or twenty percent with full wings and fixed contacts", () => {
  const requested: Record<string, number> = { "angel-poring": 1.3, "hat-poring": 1.2, "peco-chick": 1.2, "blue-ghost": 1.2 };
  for (const themeId of themeIds) for (const layout of layouts) for (const resident of scene.THEME_RESIDENTS[themeId][layout]) for (const phase of phases) {
    const details = scene.themeResidentDetails(resident, phase)!;
    const expected = requested[resident.id] ?? 1;
    const baselineScale = resident.width / details.cellWidth;
    const context = `${themeId}/${layout}/${resident.id}/${phase}`;
    assert.ok(Math.abs(details.width / resident.width - expected) < 1e-12, `${context}: requested horizontal scale`);
    assert.ok(Math.abs(details.height / (details.cellHeight * baselineScale) - expected) < 1e-12, `${context}: identical vertical scale preserves anatomy and complete wings`);
    assert.ok(Math.abs(details.left + details.width / 2 - resident.x) < 1e-9, `${context}: centre anchor retained`);
    const contact = Math.max(...details.frames.map(frame => details.top + (frame.offsetTop + frame.height) * details.width / details.cellWidth));
    assert.ok(Math.abs(contact - resident.y) < 1e-9, `${context}: foot/contact point retained`);
    if (resident.id === "angel-poring") assert.equal(details.frames.length, 4, `${context}: both wings keep all four complete flight poses`);
  }
});

test("the rendered overlay contains only mapped native monsters and pauses all pose frames", () => {
  const ThemeResidents = components.ThemeResidents as React.ComponentType<{ themeId: string; layout: Layout; phase: Phase; active: boolean }>;
  for (const themeId of themeIds) {
    for (const layout of layouts) {
      for (const phase of phases) {
        for (const active of [false, true]) {
          const context = `${themeId}/${layout}/${phase}/${active}`;
          const residents = scene.THEME_RESIDENTS[themeId][layout];
          const markup = renderToStaticMarkup(React.createElement("svg", null, React.createElement(ThemeResidents, { themeId, layout, phase, active })));
          assert.deepEqual([...markup.matchAll(/data-theme-resident="([^"]+)"/g)].map(match => match[1]).sort(), [...residents].map(resident => resident.id).sort(), context);
          assert.equal((markup.match(/data-support="/g) || []).length, residents.length, context);
          assert.equal((markup.match(/data-landmark="/g) || []).length, residents.length, context);
          assert.equal((markup.match(/data-depth="/g) || []).length, residents.length, context);
          assert.doesNotMatch(markup, /data-garden-person|novice|priest|moonlight-cat|alice-maid|ro-garden-people|ro-garden-added-companions/, context);
          const expectedFrames = residents.reduce((total, resident) => total + scene.themeResidentDetails(resident, phase)!.frames.length, 0);
          const clips = [...markup.matchAll(/<clipPath\b[^>]*id="([^"]+)"/g)].map(match => match[1]);
          assert.equal(clips.length, expectedFrames + 32, context);
          assert.equal(new Set(clips).size, clips.length, context);
          for (const clip of clips) assert.ok(markup.includes(`clip-path="url(#${clip})"`), context);
          assert.equal((markup.match(/<image\b/g) || []).length, expectedFrames + 32, context);
          const frameTags = [...markup.matchAll(/<g\b[^>]*class="[^"]*\bcreature-frame\b[^"]*"[^>]*>/g)].map(match => match[0]);
          assert.equal(frameTags.length, expectedFrames + 32, context);
          assert.ok(frameTags.every(tag => tag.includes(`animation-play-state:${active ? "running" : "paused"}`)), context);
          assert.doesNotMatch(markup, /preserveAspectRatio="none"|preserveAspectRatio="[^"]*slice"|<filter\b/, context);
        }
      }
    }
  }
});

test("selected theme headers preserve each PNG's natural proportions and use the matching normalized overlay", () => {
  for (const theme of backgrounds.BACKGROUND_THEMES) {
    for (const layout of layouts) {
      const source = theme[layout];
      const [width, height] = layout === "desktop" ? theme.desktopSize : theme.mobileSize;
      const bytes = readFileSync(new URL(`../public${source}`, import.meta.url));
      assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", source);
      assert.equal(bytes.readUInt32BE(16), width, source);
      assert.equal(bytes.readUInt32BE(20), height, source);
      for (const tall of [false, true]) {
        const context = `${theme.id}/${layout}/${tall}`;
        const markup = renderThemedHeader({ themeId: theme.id, desktop: layout === "desktop", tall });
        const imageClass = layout === "desktop" ? "desktop-header-image" : "animated-header-image";
        const image = markup.match(new RegExp(`<img\\b[^>]*class="${imageClass}"[^>]*>`))?.[0];
        assert.ok(image, context);
        assert.ok(image.includes(`src="${source}"`), context);
        assert.ok(image.includes(`width="${width}"`) && image.includes(`height="${height}"`), context);
        assert.ok(image.includes("width:100%") && image.includes("height:auto") && image.includes("aspect-ratio:auto"), `${context}: painting renders fully without a forced crop`);
        assert.equal((markup.match(/<img\b/g) || []).length, 1, context);
        const overlay = markup.match(/<svg\b[^>]*class="scene-motion-layer"[^>]*>/)?.[0];
        assert.ok(overlay, context);
        assert.ok(overlay.includes(`viewBox="0 0 1000 ${1000 * height / width}"`), context);
        assert.ok(overlay.includes('preserveAspectRatio="xMidYMid meet"'), context);
        assert.ok(markup.includes(`data-background-theme="${theme.id}"`) && markup.includes(`data-background-layout="${layout}"`), context);
        assert.equal((markup.match(/data-theme-resident="/g) || []).length, scene.THEME_RESIDENTS[theme.id][layout].length, context);
        assert.doesNotMatch(markup, /desktop-header-title|data-test-legacy-residents|desktop-waterfall-|header-waterfall-|desktop-stream-|header-river-/, `${context}: legacy title and water clips cannot cover new terrain`);
        assert.doesNotMatch(markup, /data-garden-person|novice|priest|moonlight-cat|alice-maid|preserveAspectRatio="none"|preserveAspectRatio="[^"]*slice"/, context);
      }
    }
  }
});

test("selected theme headers gate every resident on pause, reduced motion, intersection and document visibility", () => {
  const cases: { label: string; options: Partial<HeaderOptions>; active: boolean; visible: boolean }[] = [
    { label: "playing", options: {}, active: true, visible: true },
    { label: "paused", options: { paused: true }, active: false, visible: true },
    { label: "reduced motion", options: { reduced: true }, active: false, visible: true },
    { label: "offscreen", options: { intersecting: false }, active: false, visible: false },
    { label: "document hidden", options: { documentVisible: false }, active: false, visible: false },
  ];
  for (const themeId of themeIds) {
    for (const layout of layouts) {
      for (const { label, options, active, visible } of cases) {
        const context = `${themeId}/${layout}/${label}`;
        const markup = renderThemedHeader({ themeId, desktop: layout === "desktop", ...options });
        assert.ok(markup.includes(`data-residents-active="${active}"`), context);
        assert.ok(markup.includes(`data-scene-visible="${visible}"`), context);
        assert.equal((markup.match(/data-theme-resident="/g) || []).length, scene.THEME_RESIDENTS[themeId][layout].length, `${context}: pausing never removes the monsters`);
        const frames = [...markup.matchAll(/<g\b[^>]*class="[^"]*\bcreature-frame\b[^"]*"[^>]*>/g)].map(match => match[0]);
        assert.ok(frames.length > 0, context);
        assert.ok(frames.every(frame => frame.includes(`animation-play-state:${active ? "running" : "paused"}`)), context);
        const imported = [...markup.matchAll(/<g\b[^>]*class="[^"]*\bimported-illustrated-frame\b[^"]*"[^>]*>/g)].map(match => match[0]);
        assert.equal(imported.length, 32, context);
        assert.ok(imported.every(frame => frame.includes(`animation-play-state:${active ? "running" : "paused"}`)), context);
        assert.doesNotMatch(markup, /data-test-legacy-residents/, context);
      }
    }
  }
});
