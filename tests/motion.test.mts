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

function loadModule(path: string, dependencies: Record<string, unknown> = {}) {
  const javascript = ts.transpileModule(readSource(path), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const moduleValue = { exports: {} as Record<string, unknown> };
  const resolveDependency = (name: string) => {
    if (Object.hasOwn(dependencies, name)) return dependencies[name];
    if (name.startsWith(".") && name.endsWith(".json")) return { default: JSON.parse(readFileSync(new URL(name, new URL(path, import.meta.url)), "utf8")) };
    return requireModule(name);
  };
  vm.runInNewContext(javascript, { module: moduleValue, exports: moduleValue.exports, require: resolveDependency });
  return moduleValue.exports;
}

const motion = loadModule("../lib/boss-motion.ts");
type MotionDetails = { id: string; action: string; duration: number; source: string; width: number; height: number; row: number; cellWidth: number; cellHeight: number; frames: { left: number; top: number; width: number; height: number; offsetLeft: number; offsetTop: number }[] };
const motionDetails = motion.motionDetails as (index: number) => MotionDetails | null;

test("all twenty-five motion identities, character actions and durations remain stable during the artwork replacement", () => {
  assert.equal(createHash("sha256").update(JSON.stringify(motion.bossMotion)).digest("hex"), "0d474ed323834ce98d1c3cda0713fddb48c5eb9fdb7e293663965b4580904420");
});

test("all twenty-five selected bosses have distinct character actions and four-frame atlas positions", () => {
  const expectedIds = ["atroce", "lady-tanee", "boitata", "wandering-samurai", "dark-elementalist", "naght-sieger", "coelacanth", "dark-ranger", "death-knight", "fallen-bishop", "tao-gunka", "ice-dragon", "restful", "chimera", "holy-angel-poring", "morocc", "shadow-demon", "orc-hero", "dark-chaser", "undead-wizard", "zombie-dragon", "dark-geneticist", "tirfing", "valkyrie-executioner", "shadow-dragon"];
  const actions = new Set();
  for (const [index, id] of expectedIds.entries()) {
    const details = motionDetails(index)!;
    assert.equal(details.id, id);
    assert.equal(details.row, index % 5);
    assert.equal(details.frames.length, 4);
    for (const frame of details.frames) {
      assert.ok(frame.offsetLeft >= 0 && frame.offsetTop >= 0);
      assert.ok(frame.offsetLeft + frame.width <= details.cellWidth);
      assert.ok(frame.offsetTop + frame.height <= details.cellHeight);
      assert.ok(frame.left >= 0 && frame.top >= 0);
      assert.ok(frame.left + frame.width <= details.width);
      assert.ok(frame.top + frame.height <= details.height);
    }
    assert.ok(details.duration >= .7 && details.duration <= 3);
    actions.add(details.action);
  }
  assert.equal(actions.size, 25);
  for (const invalid of [-1, 25, 1.5, NaN]) assert.equal(motionDetails(invalid), null);
});

test("every known boss uses the single approved style through five ordered animation batches", () => {
  for (let index = 0; index < 25; index++) {
    const details = motionDetails(index)!;
    const batch = "abcde"[Math.floor(index / 5)];
    assert.equal(details.source, `/art/ro-approved-boss-motion-${batch}.png`);
    assert.equal(details.row, index % 5);
    assert.equal(details.cellWidth, Math.max(...details.frames.map(frame => frame.width)) + 16);
  }
});

test("wizard and living sword retain their approved indices and action selections", () => {
  const wizard = motionDetails(19)!;
  assert.equal(wizard.id, "undead-wizard");
  assert.equal(wizard.action, "舉杖蓄能與紫焰施法");
  assert.equal(wizard.duration, 1.6);
  assert.equal(wizard.source, "/art/ro-approved-boss-motion-d.png");
  assert.equal(motionDetails(22)!.source, "/art/ro-approved-boss-motion-e.png");
});

test("animated portraits render four clipped poses per boss, without whole-image transforms", () => {
  const components = loadModule("../src/components/animated-boss-portrait.tsx", { "../../lib/boss-motion": motion });
  const Portrait = components.AnimatedBossPortrait as React.ComponentType<{ spriteIndex: number }>;
  const markup = renderToStaticMarkup(React.createElement(React.Fragment, null, ...Array.from({ length: 25 }, (_, spriteIndex) => React.createElement(Portrait, { key: spriteIndex, spriteIndex }))));
  assert.equal((markup.match(/data-motion-boss=/g) || []).length, 25);
  assert.equal((markup.match(/data-frame=/g) || []).length, 100);
  const clips = [...markup.matchAll(/<clipPath id="([^"]+)"/g)].map(match => match[1]);
  assert.equal(clips.length, 100);
  assert.equal(new Set(clips).size, 100);
  assert.doesNotMatch(markup, /ro-b-reference-source|ro-redrawn-main|ro-redrawn-expansion|transform=/);
  assert.match(markup, /animation-delay:-0\.66s/);
});

test("animated portraits and scenery support pause, reduced motion and hidden-document suspension", () => {
  const styles = readSource("../src/boss-motion.css");
  const sceneStyles = readSource("../src/living-scene.css");
  const component = readSource("../src/components/animated-boss-portrait.tsx");
  const page = readSource("../src/boss-timer-app.tsx");
  assert.match(styles, /steps\(1, end\)/);
  assert.match(styles, /motion-paused[^}]*animation-play-state:\s*paused/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce/);
  assert.match(sceneStyles, /prefers-reduced-motion:\s*reduce/);
  assert.match(sceneStyles, /motion-paused/);
  assert.match(component, /IntersectionObserver/);
  assert.match(component, /visibilitychange/);
  assert.match(page, /暫停所有動畫/);
  assert.match(page, /播放所有動畫/);
  assert.match(page, /bosswatch\.motion/);
  const atlasStyles = styles.replace(/\.native-motion-canvas\s*\{[^}]*\}/g, "");
  assert.doesNotMatch(atlasStyles, /@keyframes[^}]*bounce|@keyframes[^}]*shake|transform:\s*translate/);
});

test("header and long garden contain scene-specific water, petal and light animations", () => {
  const components = loadModule("../src/components/living-scene.tsx", { "../../lib/scene-time": loadModule("../lib/scene-time.ts"), "../../lib/background-themes": loadModule("../lib/background-themes.ts"), "./theme-residents": { ThemeResidents: () => null }, "./garden-creature": { HeaderResidents: () => null } });
  const Header = components.AnimatedHeader as React.ComponentType;
  const Garden = components.LivingGarden as React.ComponentType;
  const markup = renderToStaticMarkup(React.createElement(React.Fragment, null, React.createElement(Header), React.createElement(Garden)));
  assert.equal((markup.match(/<img\b/g) || []).length, 1);
  for (const animation of ["scene-waterfall", "scene-stream", "scene-ripple", "scene-petal", "scene-star", "scene-propeller", "scene-garden-water", "scene-firefly"]) assert.ok(markup.includes(animation), animation);
  assert.match(markup, /viewBox="0 0 1672 941"/);
  assert.match(markup, /viewBox="0 0 739 2129"/);
  assert.doesNotMatch(markup, /pattern|foreignObject|heart|<text/);
});

test("all five approved action atlases use transparent PNGs with matching declared dimensions", () => {
  const atlases = motion.motionAtlases as { source: string; width: number; height: number }[];
  assert.equal(atlases.length, 5);
  for (const atlas of atlases) {
    const bytes = readFileSync(new URL(`../public${atlas.source}`, import.meta.url));
    assert.equal(bytes.readUInt32BE(16), atlas.width);
    assert.equal(bytes.readUInt32BE(20), atlas.height);
    assert.equal(bytes[25], 6);
  }
});

test("new and restyled characters use the shared four-pose pause, visibility and reduced-motion mechanism", () => {
  const components = loadModule("../src/components/animated-boss-portrait.tsx", { "../../lib/boss-motion": motion });
  const Portrait = components.AnimatedBossPortrait as React.ComponentType<{ spriteIndex: number }>;
  for (let spriteIndex = 0; spriteIndex < 25; spriteIndex++) {
    const { id, source } = motionDetails(spriteIndex)!;
    const markup = renderToStaticMarkup(React.createElement("div", { className: "motion-paused" }, React.createElement(Portrait, { spriteIndex })));
    assert.ok(markup.includes(`data-motion-boss="${id}"`));
    assert.equal((markup.match(/data-frame=/g) || []).length, 4);
    assert.equal((markup.match(/class="motion-frame motion-frame-/g) || []).length, 4);
    assert.match(markup, /data-visible="false"/);
    assert.equal((markup.match(new RegExp(`href="${source}"`, "g")) || []).length, 4);
    assert.doesNotMatch(markup, /\.gif|native-motion|<img|transform=/);
  }
  const styles = readSource("../src/boss-motion.css");
  assert.match(styles, /\.motion-portrait\[data-visible="false"\] \.motion-frame, \.motion-paused \.motion-frame \{ animation-play-state: paused; \}/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\) \{\s*\.motion-frame \{ animation: none !important; opacity: 0; \}\s*\.motion-frame-0 \{ opacity: 1; \}/);
});

test("the production app retains real timers and routes all matching portraits through the existing renderer", () => {
  const page = readSource("../src/boss-timer-app.tsx");
  assert.match(page, /export default function Home\(\) \{ return <BossTimerApp \/>; \}/);
  assert.match(page, /const metadata = bossDetails\(boss\);/);
  assert.match(page, /metadata && "spriteIndex" in metadata \? metadata : portraitMotion\(boss\)/);
  assert.match(page, /sortBossesForDisplay\(filtered\)/);
});
