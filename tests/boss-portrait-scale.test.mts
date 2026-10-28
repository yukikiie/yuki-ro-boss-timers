import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const requireModule = createRequire(import.meta.url);
const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

function loadModule(path: string, dependencies: Record<string, unknown> = {}) {
  const javascript = ts.transpileModule(source(path), {
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

const motion = loadModule("../lib/boss-motion.ts") as unknown as typeof import("../lib/boss-motion");
const layout = motion.bossPortraitLayout;

function projectedFrame(details: NonNullable<ReturnType<typeof motion.motionDetails>>, frameIndex: number) {
  const frame = details.frames[frameIndex];
  const scale = Math.min(layout.width / details.viewport.width, layout.height / details.viewport.height);
  const letterboxLeft = (layout.width - details.viewport.width * scale) / 2;
  const letterboxTop = layout.height - details.viewport.height * scale;
  return {
    left: letterboxLeft + (frame.offsetLeft - details.viewport.left) * scale,
    top: letterboxTop + (frame.offsetTop - details.viewport.top) * scale,
    width: frame.width * scale,
    height: frame.height * scale,
    scale,
  };
}

test("redrawn Atroce and Tanee retain the established apparent-size reference", () => {
  for (const index of [0, 1]) {
    const details = motion.motionDetails(index)!;
    assert.equal(details.cellWidth, Math.max(...motion.motionFrameBounds[index].map(frame => frame[2])) + 16);
    assert.ok(details.frames.every(frame => Number.isInteger(frame.offsetLeft) && Number.isInteger(frame.offsetTop)));
    assert.equal(details.source, "/art/ro-approved-boss-motion-a.png");
    const footprint = motion.bossIdleSilhouetteAreas[index] * projectedFrame(details, 0).scale ** 2;
    assert.ok(Math.abs(footprint - motion.bossReferenceFootprint) < 1e-9);
  }
});

test("pixel Death Knight matches the reference footprint without stretching its action poses", () => {
  const knight = motion.motionDetails(8)!;
  const tanee = motion.motionDetails(1)!;
  const projectedKnight = projectedFrame(knight, 0);
  const projectedTanee = projectedFrame(tanee, 0);
  assert.equal(knight.source, "/art/ro-approved-boss-motion-b.png");
  assert.ok(Math.abs(motion.bossIdleSilhouetteAreas[8] * projectedKnight.scale ** 2 / (motion.bossIdleSilhouetteAreas[1] * projectedTanee.scale ** 2) - 1) < 1e-9);
  for (const [index, frame] of knight.frames.entries()) {
    const projected = projectedFrame(knight, index);
    assert.ok(Math.abs(projected.width / projected.height - frame.width / frame.height) < 1e-12);
    assert.equal(projected.scale, projectedKnight.scale);
    assert.deepEqual([frame.left, frame.top, frame.width, frame.height], Array.from(motion.motionFrameBounds[8][index]));
  }
});

test("old eighteen retain the reference footprint and the additions use their maximum unclipped fixed scale", () => {
  const reference = [0, 1].reduce((total, index) => total + motion.bossIdleSilhouetteAreas[index] * projectedFrame(motion.motionDetails(index)!, 0).scale ** 2, 0) / 2;
  for (let index = 0; index < motion.bossMotion.length; index++) {
    const details = motion.motionDetails(index)!;
    assert.ok(details.opticalScale >= layout.minimumZoom && details.opticalScale <= layout.maximumZoom);
    const firstFrame = projectedFrame(details, 0);
    const footprint = motion.bossIdleSilhouetteAreas[index] * firstFrame.scale ** 2;
    if (index < 18) {
      assert.ok(footprint / reference >= .99 && footprint / reference <= 1.01, `${details.id}: ${footprint / reference}`);
    } else {
      assert.ok(footprint / reference >= .83 && footprint / reference <= 1.01, `${details.id}: ${footprint / reference}`);
      const baseScale = Math.min(layout.width / details.cellWidth, layout.height / details.cellHeight);
      const maximumWidth = Math.max(...details.frames.map(frame => frame.width));
      const contentHeight = Math.max(...details.frames.map(frame => frame.offsetTop + frame.height)) - Math.min(...details.frames.map(frame => frame.offsetTop));
      const expectedScale = Math.max(layout.minimumZoom * baseScale, Math.min(
        Math.sqrt(reference / motion.bossIdleSilhouetteAreas[index]),
        layout.maximumZoom * baseScale,
        (layout.width + 2 * layout.horizontalOverflow) / maximumWidth,
        layout.cardHeight / contentHeight,
      ));
      assert.ok(Math.abs(firstFrame.scale - expectedScale) < 1e-12, `${details.id}: not the maximum feasible unclipped scale`);
    }
    for (let frameIndex = 1; frameIndex < 4; frameIndex++) assert.equal(projectedFrame(details, frameIndex).scale, firstFrame.scale);
  }
});

test("complete action silhouettes stay within the uniform card and away from text columns", () => {
  const cardHeight = layout.cardHeight;
  const verticalMargin = (cardHeight - layout.height) / 2;
  for (let index = 0; index < motion.bossMotion.length; index++) {
    const details = motion.motionDetails(index)!;
    for (let frameIndex = 0; frameIndex < 4; frameIndex++) {
      const frame = projectedFrame(details, frameIndex);
      assert.ok(frame.left >= -layout.horizontalOverflow - 1e-12, `${details.id}: left overflow`);
      assert.ok(frame.left + frame.width <= layout.width + layout.horizontalOverflow + 1e-12, `${details.id}: text overlap`);
      assert.ok(frame.top >= -verticalMargin - 1e-12, `${details.id}: clipped upper action pose`);
      assert.ok(frame.top + frame.height <= layout.height + verticalMargin + 1e-12, `${details.id}: clipped lower action pose`);
    }
  }
  assert.ok(layout.horizontalOverflow < 1.1);
});

test("each pixel portrait uses one optical viewport and all four freshly drawn clipped poses", () => {
  const components = loadModule("../src/components/animated-boss-portrait.tsx", { "../../lib/boss-motion": motion });
  const Portrait = components.AnimatedBossPortrait as React.ComponentType<{ spriteIndex: number }>;
  for (let index = 0; index < motion.bossMotion.length; index++) {
    const details = motion.motionDetails(index)!;
    const markup = renderToStaticMarkup(React.createElement(Portrait, { spriteIndex: index }));
    assert.equal((markup.match(/<svg\b/g) || []).length, 1);
    assert.equal((markup.match(/data-frame=/g) || []).length, 4);
    assert.equal((markup.match(/<clipPath\b/g) || []).length, 4);
    assert.equal((markup.match(/<image\b/g) || []).length, 4);
    assert.ok(markup.includes(`viewBox="${details.viewport.left} ${details.viewport.top} ${details.viewport.width} ${details.viewport.height}"`));
    assert.ok(markup.includes(`data-portrait-scale="${details.opticalScale}"`));
    assert.ok(markup.includes('data-art-style="pixel"'));
    assert.match(markup, /style="overflow:visible"/);
    assert.doesNotMatch(markup, /transform=|scale\(|ro-routine-|ro-redrawn-|ro-garden-|\/art\/ro-motion-/);
    for (const image of markup.matchAll(/<image\b[^>]+>/g)) {
      assert.ok(image[0].includes(`href="${details.source}"`));
      assert.ok(image[0].includes(`width="${details.width}"`));
      assert.ok(image[0].includes(`height="${details.height}"`));
    }
  }
  const styles = source("../src/boss-motion.css");
  assert.match(styles, /\.motion-portrait, \.motion-portrait image \{ image-rendering: pixelated; \}/);
});

