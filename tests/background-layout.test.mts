import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import * as catalog from "../lib/boss-catalog.js";
import * as portraitIcons from "../lib/boss-portrait-icons.js";
import * as timers from "../lib/timers.js";
import * as sceneTime from "../lib/scene-time.ts";

const requireModule = createRequire(import.meta.url);
const readSource = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const artStyles = readSource("../src/approved-art.css");
const sceneStyles = readSource("../src/living-scene.css");

function declarations(source: string, selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const body = source.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1];
  assert.ok(body, selector);
  return Object.fromEntries(body.split(";").filter(value => value.trim()).map(value => {
    const separator = value.indexOf(":");
    return [value.slice(0, separator).trim(), value.slice(separator + 1).trim()];
  }));
}

function loadModule(path: string, dependencies: Record<string, unknown>) {
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

const scenery = loadModule("../src/components/living-scene.tsx", {
  "../../lib/scene-time": sceneTime,
  "./garden-creature": { HeaderResidents: () => null },
});

function renderRoster(count: number, width: number, phase: sceneTime.ScenePhase, filter = "All", view = "timers") {
  const timestamp = Date.UTC(2026, 9, 19, 4);
  const defaults = timers.defaultBosses(timestamp);
  const bosses = Array.from({ length: count }, (_, index) => ({
    ...defaults[index % defaults.length],
    id: index < defaults.length ? defaults[index].id : `background-fixture-${index}`,
  }));
  const page = loadModule("../src/boss-timer-app.tsx", {
    react: {
      ...React,
      useState: (initial: unknown) => {
        const resolved = typeof initial === "function" ? initial() : initial;
        const value = resolved && typeof resolved === "object" && "bosses" in resolved
          ? { ...resolved, bosses }
          : resolved === "All" ? filter : resolved === "timers" ? view : resolved;
        return React.useState(value);
      },
    },
    "../lib/boss-catalog.js": catalog,
    "../lib/boss-portrait-icons.js": portraitIcons,
    "../lib/timers.js": timers,
    "../lib/scene-time": sceneTime,
    "../hooks/use-scene-phase": { useScenePhase: () => phase },
    "./components/living-scene": scenery,
    "./components/reference-countdown": { ReferenceCountdown: () => null },
    "./components/animated-boss-portrait": { AnimatedBossPortrait: () => React.createElement("svg") },
    "./api": { apiFetch: () => { throw new Error("Background tests must not contact live timers"); }, appBasePath: "/yuki-ro-boss-timers/" },
    "./push-registration": {},
  });
  const App = page.BossTimerApp as React.ComponentType<{ referencePreview: boolean; previewTallHeader: boolean }>;
  return renderToStaticMarkup(React.createElement("div", { style: { width } }, React.createElement(App, { referencePreview: true, previewTallHeader: true })));
}

test("the single garden and its overlay keep their natural geometry independently of roster height", () => {
  const garden = declarations(artStyles, ".reference-timers .main-shell");
  assert.equal(garden["min-height"], "calc(100cqi * 2129 / 739)");
  assert.equal(garden["background-size"], "100% auto");
  assert.equal(garden["background-position"], "center top");
  assert.equal(garden["background-repeat"], "no-repeat");
  assert.equal(garden["background-color"], "#8ad26c");
  const overlay = declarations(sceneStyles, ".living-garden");
  assert.equal(overlay.inset, "0 0 auto");
  assert.equal(overlay["aspect-ratio"], "739 / 2129");
  assert.equal(overlay.height, undefined);
  assert.doesNotMatch(sceneStyles, /height:\s*max\(100%,\s*288/);
  assert.match(readSource("../src/components/living-scene.tsx"), /viewBox="0 0 739 2129" preserveAspectRatio="xMidYMin meet"/);
  assert.equal(declarations(sceneStyles, '.app-shell.reference-timers[data-scene-phase="afternoon"] .main-shell')["background-color"], "#b3eb2c");
  assert.equal(declarations(sceneStyles, '.app-shell.reference-timers[data-scene-phase="night"] .main-shell')["background-color"], "#0a5670");
});

test("non-timer maps show the complete 3:2 painting without changing the 4:3 timer header", () => {
  for (const selector of [".app-shell .map-masthead", ".app-shell .masthead-compact"]) {
    const rule = declarations(artStyles, selector);
    assert.equal(rule.height, "auto");
    assert.equal(rule["aspect-ratio"], "3 / 2");
  }
  const map = declarations(artStyles, ".app-shell .map-art");
  assert.equal(map.background, 'url("/pixel/ro-map-standalone.png") center top / contain no-repeat');
  assert.equal(declarations(artStyles, ".app-shell .masthead-compact .map-art")["background-position"], "center top");
  assert.equal(declarations(artStyles, ".reference-timers .map-masthead")["aspect-ratio"], "auto");
  assert.equal(declarations(sceneStyles, ".animated-header-image").height, "auto");
  assert.equal(declarations(sceneStyles, '.animated-header[data-header-layout="tall"] .animated-header-image')["aspect-ratio"], "1672 / 1254");
  for (const view of ["notifications", "guide"]) {
    const markup = renderRoster(21, 390, "day", "All", view);
    assert.match(markup, /class="map-masthead masthead-compact"/);
    assert.match(markup, /class="map-art"/);
    assert.doesNotMatch(markup, /class="animated-header-image"|class="living-scene living-garden"/);
  }
});

for (const phase of ["day", "afternoon", "night"] as const) {
  for (const width of [320, 390, 480, 1024]) {
    test(`${phase} scene markup stays unchanged for 0, 1, 5, 18, 21 and 30 rows at ${width}px`, () => {
      let expectedHeader = "";
      let expectedGarden = "";
      for (const count of [0, 1, 5, 18, 21, 30]) {
        const markup = renderRoster(count, width, phase);
        assert.equal((markup.match(/<article class="boss-card(?: |")/g) || []).length, count);
        assert.equal((markup.match(/class="boss-card-slot"/g) || []).length, count);
        const header = markup.match(/<header\b[\s\S]*?<\/header>/)?.[0];
        const garden = markup.match(/<div class="living-scene living-garden"[\s\S]*?<\/svg><\/div>/)?.[0];
        assert.ok(header);
        assert.ok(garden);
        assert.match(header, /class="animated-header-image"[^>]+width="1672" height="1254"/);
        assert.match(garden, /viewBox="0 0 739 2129" preserveAspectRatio="xMidYMin meet"/);
        if (!expectedHeader) { expectedHeader = header; expectedGarden = garden; }
        assert.equal(header, expectedHeader);
        assert.equal(garden, expectedGarden);
        assert.ok(markup.includes(`--scene-garden-image:url(&quot;${sceneTime.SCENE_ASSETS[phase].garden}&quot;)`));
      }
      const filtered = renderRoster(21, width, phase, "Mini");
      assert.ok((filtered.match(/<article class="boss-card(?: |")/g) || []).length < 21);
      assert.equal(filtered.match(/<header\b[\s\S]*?<\/header>/)?.[0], expectedHeader);
      assert.equal(filtered.match(/<div class="living-scene living-garden"[\s\S]*?<\/svg><\/div>/)?.[0], expectedGarden);
    });
  }
}

test("approved garden, tall header and earlier map PNG bytes remain unchanged", () => {
  const assets = [
    ["/art/ro-garden-morning.png", 739, 2129, "650d886e2a6a848884084b1416b778e07fe73f2aba3c3f3ec92b7b3f363ca93c"],
    ["/art/ro-garden-afternoon.png", 739, 2129, "a341e7de83f8f1c6fa7f9c4fdd8b7093076aee9257fc77c21bd0e033699f85ac"],
    ["/art/ro-garden-night.png", 739, 2129, "a5c0f1b5980ba4a87f5beb53a9df62978be05031d3da01a2b1cfd9561a984e53"],
    ["/art/ro-header-tall-morning.png", 1448, 1086, "735563d0527640825a34ad9155ff2f7ea178d6ddcdd66e2b3dab9092959aea23"],
    ["/art/ro-header-tall-preview.png", 1448, 1086, "4cd62878ad13f7fc4ed3a7f2124a1ae6a61d9c15e47d9562cf2fedee6cbc3589"],
    ["/art/ro-header-tall-night.png", 1448, 1086, "864c4bbffb3af2ec2d1285f92d15bf2dfde75f08cb248b26f0a1313a9d06e545"],
    ["/pixel/ro-map-standalone.png", 1536, 1024, "f7f0f07c5ba85eba0728e0b28505de2bb8f0f42bdff1cc33b426d6591a3a81be"],
  ] as const;
  for (const [path, width, height, hash] of assets) {
    const bytes = readFileSync(new URL(`../public${path}`, import.meta.url));
    assert.equal(bytes.readUInt32BE(16), width);
    assert.equal(bytes.readUInt32BE(20), height);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), hash, path);
  }
});
