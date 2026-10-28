import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import { inflateSync } from "node:zlib";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const requireModule = createRequire(import.meta.url);
const modules = new Map<string, { exports: Record<string, any> }>();
const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
function load(path: URL): Record<string, any> {
  if (modules.has(path.href)) return modules.get(path.href)!.exports;
  const moduleValue = { exports: {} as Record<string, any> };
  modules.set(path.href, moduleValue);
  const javascript = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(javascript, { module: moduleValue, exports: moduleValue.exports, require: (name: string) => {
    if (!name.startsWith(".")) return requireModule(name);
    if (name.endsWith(".json")) return { default: JSON.parse(readFileSync(new URL(name, path), "utf8")) };
    const script = new URL(`${name}.ts`, path);
    return load(existsSync(script) ? script : new URL(`${name}.tsx`, path));
  } });
  return moduleValue.exports;
}

const sprites = load(new URL("../lib/imported-header-sprites.ts", import.meta.url));
const art = load(new URL("../lib/imported-header-art.ts", import.meta.url));
const styleAtlas = JSON.parse(source("../lib/imported-header-style-atlas.json"));
const placements = load(new URL("../lib/imported-header-placements.ts", import.meta.url));
const components = load(new URL("../src/components/imported-header-residents.tsx", import.meta.url));
const themes = load(new URL("../lib/theme-residents.ts", import.meta.url));
const themeComponents = load(new URL("../src/components/theme-residents.tsx", import.meta.url));
const ids = ["1063", "1242", "1388", "1572", "1727", "1894", "2316", "3505"];
const expectedOriginals: Record<string, string> = {
  "1063": "a1dfdce22d7b2f560805103b34c6b8079d9911aadbbf061cbb184f59be3e5918",
  "1242": "ef627fa4060becaab94bf7b81b9102b43ba8bce8cfcb9808ad16b3af47c20aa0",
  "1388": "e4b549f4c546e7c2318b80c03fd3001ed51f92de5d22e77dd3f2c3f10de7f0d3",
  "1572": "d24435f0f48eb5f3424ab908c628f9694ee8bdd3d7f1eacd0aeaca7f52a086a8",
  "1727": "0a184b195bfe391dc2a9f86c6d7beb8b9709271f76d22b29351af6b2d82389ea",
  "1894": "1342353453f61b3d1965d03cbbeb9ddb1a028866c4b8d2461359aa04e59cf4cc",
  "2316": "9982994f0f23a0bbf0c6c96148801b4374852fd461910bf6fc7fdd695af9a100",
  "3505": "caee7b63789b6a3093c7bfe1d68c76a7dd08b638e4cb178e73c12c11d88ada23",
};
const expectedPixels: Record<string, string> = {
  "1063": "c1e04ca6661d63773928ee01418f939e5299f369246f574b9c2c557a8585a071",
  "1242": "636c5fda60f36022fb36f03ddb78852977ab214aaf3ff1b7a80d74230df6523e",
  "1388": "dff960c562755402e1fdea992904aeb89a9a5c27943de36f995ebeaf617cf0e5",
  "1572": "eef1fb391fde0e6ab8ee0d13bf96c6b6f15b62246a3673608a81c817d53e76ed",
  "1727": "8e35dbcac89043f7319f1b9ec0b9057ec5793be675c86e4152a0a95cea75d121",
  "1894": "7754f21fa8a06bb8e5536769464a5c54830eeb397fdf7e219789019bd0f70572",
  "2316": "fa9bf23250e37b93bd279b09872293c24b06ab0536f8da19c5a11aeb76e75167",
  "3505": "92a2df31c67f12a29c21d4d3d8285acd3a5b0ee34dfab1769cae31cf205ba57d",
};

function pngPixels(path: string, width: number, height: number) {
  const bytes = readFileSync(new URL(`../public${path}`, import.meta.url));
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(bytes.readUInt32BE(16), width);
  assert.equal(bytes.readUInt32BE(20), height);
  assert.equal(bytes[24], 8);
  assert.equal(bytes[25], 6, "native transparency is RGBA");
  const chunks: Buffer[] = [];
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    if (bytes.toString("ascii", offset + 4, offset + 8) === "IDAT") chunks.push(bytes.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  const scanlines = inflateSync(Buffer.concat(chunks));
  const stride = width * 4;
  const pixels = Buffer.alloc(stride * height);
  assert.equal(scanlines.length, (stride + 1) * height);
  for (let row = 0; row < height; row++) for (let column = 0; column < stride; column++) {
    const position = row * stride + column;
    const filter = scanlines[row * (stride + 1)];
    assert.ok(filter <= 4);
    const left = column >= 4 ? pixels[position - 4] : 0;
    const up = row ? pixels[position - stride] : 0;
    const upperLeft = row && column >= 4 ? pixels[position - stride - 4] : 0;
    const prediction = left + up - upperLeft;
    const distances = [Math.abs(prediction - left), Math.abs(prediction - up), Math.abs(prediction - upperLeft)];
    const paeth = distances[0] <= distances[1] && distances[0] <= distances[2] ? left : distances[1] <= distances[2] ? up : upperLeft;
    const predictor = filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? up : filter === 3 ? Math.floor((left + up) / 2) : paeth;
    pixels[position] = (scanlines[row * (stride + 1) + column + 1] + predictor) & 255;
  }
  return pixels;
}

test("all eight supplied GIFs retain their original bytes and exact native frame timing", () => {
  assert.deepEqual(Object.keys(sprites.IMPORTED_HEADER_SPRITES), ids);
  let total = 0;
  for (const id of ids) {
    const sprite = sprites.IMPORTED_HEADER_SPRITES[id];
    assert.ok(Object.isFrozen(sprite) && Object.isFrozen(sprite.durationsMs));
    const gif = readFileSync(new URL(`../public${sprite.sourceGif}`, import.meta.url));
    assert.match(gif.toString("ascii", 0, 6), /^GIF8[79]a$/);
    assert.equal(createHash("sha256").update(gif).digest("hex"), sprite.sourceSha256);
    assert.equal(sprite.sourceSha256, expectedOriginals[id]);
    assert.equal(gif.readUInt16LE(6), sprite.width);
    assert.equal(gif.readUInt16LE(8), sprite.height);
    const expectedDelay = id === "1063" ? 50 : id === "1727" ? 80 : 100;
    assert.equal(sprite.frameCount, id === "1063" ? 12 : 4);
    assert.deepEqual(Array.from(sprite.durationsMs), Array(sprite.frameCount).fill(expectedDelay));
    assert.equal(sprite.durationMs, sprite.frameCount * expectedDelay);
    total += sprite.frameCount;
  }
  assert.equal(total, 40);
});

test("every exported full-canvas RGBA pose matches the supplied GIF pixels with no matte or recoloring", () => {
  for (const id of ids) {
    const sprite = sprites.IMPORTED_HEADER_SPRITES[id];
    const stripWidth = sprite.width * sprite.frameCount;
    const pixels = pngPixels(sprite.source, stripWidth, sprite.height);
    const digest = createHash("sha256");
    const poses = new Set<string>();
    let foot = 0;
    let transparent = 0;
    for (let frame = 0; frame < sprite.frameCount; frame++) {
      const buffer = Buffer.alloc(sprite.width * sprite.height * 4);
      for (let row = 0; row < sprite.height; row++) {
        const offset = (row * stripWidth + frame * sprite.width) * 4;
        pixels.copy(buffer, row * sprite.width * 4, offset, offset + sprite.width * 4);
        for (let column = 0; column < sprite.width; column++) if (pixels[offset + column * 4 + 3]) foot = Math.max(foot, row + 1); else transparent++;
      }
      digest.update(buffer);
      poses.add(createHash("sha256").update(buffer).digest("hex"));
    }
    assert.equal(digest.digest("hex"), expectedPixels[id], `${id}: all native color/alpha pixels`);
    assert.equal(poses.size, id === "1727" ? 3 : 4, `${id}: genuine distinct supplied poses`);
    assert.equal(sprite.footY, foot);
    assert.ok(transparent > 0, `${id}: no opaque background box`);
  }
});

test("all thirty-two illustrated poses are complete, distinct and optically measured from actual silhouettes", () => {
  assert.equal(createHash("sha256").update(readFileSync(new URL(`../public${styleAtlas.source}`, import.meta.url))).digest("hex"), "a80197d3ab3b77614bb4c9ca623c7bf48caec027acc159b799d6d9857e9fd52f");
  assert.deepEqual(styleAtlas.fileIds, ids);
  const pixels = pngPixels(styleAtlas.source, styleAtlas.width, styleAtlas.height);
  const coverage = new Uint8Array(styleAtlas.width * styleAtlas.height);
  for (const [row, bounds] of styleAtlas.rows.entries()) {
    const poses = new Set<string>();
    for (const [column, [left, top, width, height]] of bounds.entries()) {
      assert.ok(left > 0 && top > 0 && left + width < styleAtlas.width && top + height < styleAtlas.height);
      assert.ok(left >= styleAtlas.rowColumnCuts[row][column] && left + width <= styleAtlas.rowColumnCuts[row][column + 1]);
      assert.ok(top >= styleAtlas.rowCuts[row] && top + height <= styleAtlas.rowCuts[row + 1]);
      const buffer = Buffer.alloc(width * height * 4);
      let occupiedArea = 0;
      for (let vertical = 0; vertical < height; vertical++) for (let horizontal = 0; horizontal < width; horizontal++) {
        const pixel = (top + vertical) * styleAtlas.width + left + horizontal;
        coverage[pixel]++;
        pixels.copy(buffer, (vertical * width + horizontal) * 4, pixel * 4, pixel * 4 + 4);
        if (pixels[pixel * 4 + 3] > 32) occupiedArea++;
      }
      assert.equal(occupiedArea, styleAtlas.frameAreas[row][column]);
      if (!column) assert.equal(occupiedArea, styleAtlas.idleAreas[row]);
      poses.add(createHash("sha256").update(buffer).digest("hex"));
    }
    assert.equal(poses.size, 4, `${ids[row]}: four distinct articulated poses`);
  }
  for (let pixel = 0; pixel < coverage.length; pixel++) if (pixels[pixel * 4 + 3] > 8) assert.equal(coverage[pixel], 1, `significant foreground ${pixel} is preserved exactly once`);
  const referenceData = JSON.parse(source("../lib/garden-added-porings-atlas.json"));
  const referencePixels = pngPixels(referenceData.source, referenceData.width, referenceData.height);
  const [left, top, width, height] = referenceData.rows[0][0];
  let referenceArea = 0;
  for (let vertical = top; vertical < top + height; vertical++) for (let horizontal = left; horizontal < left + width; horizontal++) if (referencePixels[(vertical * referenceData.width + horizontal) * 4 + 3] > 32) referenceArea++;
  assert.equal(referenceArea, art.IMPORTED_HEADER_REFERENCE_IDLE_AREA);
  assert.equal(art.IMPORTED_HEADER_REFERENCE_CELL_WIDTH, 224);
  assert.equal(art.IMPORTED_HEADER_SCALE_MULTIPLIER, 1.3);
  assert.deepEqual(Object.keys(art.IMPORTED_HEADER_CREATURE_SCALE_MULTIPLIERS), ["1388"]);
  assert.equal(art.IMPORTED_HEADER_CREATURE_SCALE_MULTIPLIERS["1388"], 1.3);
  for (const fileId of ids) for (const width of [30, 50, 100]) {
    const details = art.importedHeaderArtDetails({ fileId, x: 500, y: 500, width });
    const baselineScale = width * Math.sqrt(art.IMPORTED_HEADER_REFERENCE_FILL_RATIO / styleAtlas.idleAreas[ids.indexOf(fileId)]);
    const requestedFactor = fileId === "1388" ? 1.3 * 1.3 : 1.3;
    assert.ok(Math.abs(details.scale / baselineScale - requestedFactor) < 1e-12, `${fileId}/${width}: gray angel gains another thirty percent; the other imported residents retain their size`);
    assert.ok(Math.abs(details.width / (details.cellWidth * baselineScale) - requestedFactor) < 1e-12);
    assert.ok(Math.abs(details.height / (details.cellHeight * baselineScale) - requestedFactor) < 1e-12);
    assert.ok(Math.abs(details.occupiedIdleArea - referenceArea * (width / 224) ** 2 * requestedFactor ** 2) < 1e-8, `${fileId}/${width}: complete silhouette including both wings scales uniformly`);
    assert.ok(Math.abs(details.top + details.baseline * details.scale - 500) < 1e-9, `${fileId}/${width}: contact point stays anchored`);
    assert.equal(details.frames.length, 4);
    for (const frame of details.frames) assert.ok(frame.offsetLeft >= 0 && frame.offsetTop >= 0 && frame.offsetLeft + frame.width <= details.cellWidth && frame.offsetTop + frame.height <= details.cellHeight);
  }
});

test("all ten compositions keep sixteen complete residents separate through daytime poses and nighttime rest", () => {
  const compositions = new Set<string>();
  const visibleBounds = (allDetails: any[]) => {
    const frames = allDetails.flatMap(details => {
      const scale = details.width / details.cellWidth;
      return details.frames.map((frame: any) => {
        const offsetLeft = details.facing === "left" ? details.cellWidth - frame.offsetLeft - frame.width : frame.offsetLeft;
        return { left: details.left + offsetLeft * scale, top: details.top + frame.offsetTop * scale, right: details.left + (offsetLeft + frame.width) * scale, bottom: details.top + (frame.offsetTop + frame.height) * scale };
      });
    });
    return {
      left: Math.min(...frames.map((frame: any) => frame.left)), top: Math.min(...frames.map((frame: any) => frame.top)),
      right: Math.max(...frames.map((frame: any) => frame.right)), bottom: Math.max(...frames.map((frame: any) => frame.bottom)),
    };
  };
  for (const [themeId, layouts] of Object.entries(placements.IMPORTED_HEADER_PLACEMENTS) as [string, any][]) for (const [layout, residents] of Object.entries(layouts) as [string, any[]][]) {
    assert.deepEqual(Array.from(residents, resident => resident.fileId).sort(), ids);
    assert.notEqual(residents.find(resident => resident.fileId === "1063").support, "air", `${themeId}/${layout}: the white rabbit is grounded`);
    assert.deepEqual(Array.from(residents.filter(resident => resident.support === "air"), resident => resident.fileId), ["1388"], `${themeId}/${layout}: only the winged resident flies`);
    const viewportHeight = layout === "desktop" ? 1000 / 3 : 750;
    compositions.add(JSON.stringify(residents));
    for (const placement of residents) {
      const details = art.importedHeaderArtDetails(placement);
      assert.ok(details.left >= 0 && details.top >= 0 && details.left + details.width <= 1000 && details.top + details.height <= viewportHeight, `${themeId}/${layout}/${placement.fileId}: complete illustrated viewport`);
      assert.ok(Math.abs(details.top + details.baseline * details.scale - placement.y) < 1e-9);
    }
    const occupied = [
      ...Array.from(themes.THEME_RESIDENTS[themeId][layout], (resident: any) => ({ id: resident.id, bounds: visibleBounds([themes.themeResidentDetails(resident, "day"), themes.themeResidentDetails(resident, "night")]) })),
      ...Array.from(residents, resident => ({ id: resident.fileId, bounds: visibleBounds([art.importedHeaderArtDetails(resident)]) })),
    ];
    for (let first = 0; first < occupied.length; first++) for (let second = first + 1; second < occupied.length; second++) {
      const firstBounds = occupied[first].bounds;
      const secondBounds = occupied[second].bounds;
      const overlapWidth = Math.min(firstBounds.right, secondBounds.right) - Math.max(firstBounds.left, secondBounds.left);
      const overlapHeight = Math.min(firstBounds.bottom, secondBounds.bottom) - Math.max(firstBounds.top, secondBounds.top);
      assert.ok(overlapWidth <= 1e-9 || overlapHeight <= 1e-9, `${themeId}/${layout}: ${occupied[first].id} and ${occupied[second].id} remain separate across all four poses`);
    }
    const markup = renderToStaticMarkup(React.createElement("svg", null, React.createElement(themeComponents.ThemeResidents, { themeId, layout, phase: "day", active: true })));
    assert.deepEqual([...markup.matchAll(/data-imported-header-resident="([^"]+)"/g)].map(match => match[1]).sort(), ids);
    assert.deepEqual([...markup.matchAll(/data-theme-resident="([^"]+)"/g)].map(match => match[1]).sort(), Array.from(themes.THEME_RESIDENTS[themeId][layout], (resident: any) => resident.id).sort());
    const actualOrder = [...markup.matchAll(/data-(?:theme-resident|imported-header-resident)="([^"]+)"/g)].map(match => match[1]);
    const expectedOrder = [...themes.THEME_RESIDENTS[themeId][layout].map((resident: any) => ({ ...resident, key: resident.id })), ...residents.map(resident => ({ ...resident, key: resident.fileId }))].sort((first, second) => first.y - second.y).map(resident => resident.key);
    assert.deepEqual(actualOrder, expectedOrder, `${themeId}/${layout}: existing and new residents share depth ordering`);
  }
  assert.equal(compositions.size, 10);
  assert.equal(art.importedHeaderArtDetails({ fileId: "unknown", x: 10, y: 10, width: 10 }), null);
});

test("illustrated four-pose playback pauses and resumes without replacing the artwork or inventing nighttime poses", () => {
  const placement = placements.IMPORTED_HEADER_PLACEMENTS["moon-garden"].desktop[0];
  const details = art.importedHeaderArtDetails(placement);
  for (const phase of ["day", "afternoon", "night"]) for (const active of [false, true]) {
    const markup = renderToStaticMarkup(React.createElement("svg", null, React.createElement(components.ImportedHeaderResident, { placement, phase, active })));
    assert.match(markup, new RegExp(`viewBox="0 0 ${details.cellWidth} ${details.cellHeight}"`));
    assert.match(markup, /preserveAspectRatio="xMidYMax meet" overflow="visible"/);
    assert.equal((markup.match(new RegExp(`href="${styleAtlas.source}"`, "g")) || []).length, 4);
    assert.equal((markup.match(/<clipPath\b/g) || []).length, 4);
    const frames = [...markup.matchAll(/<g\b[^>]*data-imported-frame="\d"[^>]*>/g)].map(match => match[0]);
    assert.equal(frames.length, 4);
    assert.ok(frames.every(frame => frame.includes(`animation-duration:${details.duration}s`) && frame.includes(`animation-play-state:${active ? "running" : "paused"}`)));
    assert.ok(details.duration >= 2.4 && details.duration <= 4.8);
    assert.ok(markup.includes(`h${placement.width * 1.3 * .36}v1.6`), "ground shadow follows the effective size");
    assert.doesNotMatch(markup, /header-monsters|\.gif|imported-header-strip|sleep-marks|sleep-bubble|data-routine="sleep"|scale\(-1|<filter/);
  }
  assert.match(components.importedHeaderMotionStyles, /prefers-reduced-motion:reduce[^]*imported-illustrated-frame \{ animation:none!important; opacity:0!important \}[^]*imported-illustrated-frame-0 \{ opacity:1!important/);
  assert.doesNotMatch(source("../src/components/imported-header-residents.tsx"), /fetch\(|setInterval|requestAnimationFrame|localStorage|pushManager|serviceWorker/);
});
