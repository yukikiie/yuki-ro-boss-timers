import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { inflateSync } from "node:zlib";
import ts from "typescript";

type Bounds = [number, number, number, number];
type PixelAtlas = { source: string; width: number; height: number; rows: Bounds[][]; idleAreas: number[] };

const preservedSheetIds = ["a", "b", "c", "d"] as const;
const sheetIds = [...preservedSheetIds, "e", "f", "g", "h", "i"] as const;
const readManifest = (sheet: string) => JSON.parse(readFileSync(new URL(`../lib/pixel-motion-${sheet}.json`, import.meta.url), "utf8")) as PixelAtlas;
const atlases = sheetIds.map(readManifest);
const alphaCache = new Map<string, Uint8Array>();
const originalHashes = [
  "529cc34930ce2e8b3721599b6d1a7235de92ac1df39fee0bd081f194371605a2",
  "abb460811a40196b3e035d5e39986a04fa1d91131ded8db4289a580bd792e08b",
  "358d0ea1a96a31e927475ba3a62f01483a6b2b65811e6e6a9758d8c7655f5bcf",
  "6f386c41905146edf5ec70fdf5cacdf9731d16d722fcee19d01a4d47840bd065",
];
const preservedPixelHashes = [
  "2747c8340a01103430c07b463a4791185bfe6e57a045966d558a4f8550ab7ca5",
  "3a9828ba6f8ec906a6bddd4e5a288459d2f49378b65d83c592a7150cab67873e",
  "e8f4b342431595e2d28f4cc253ffc395ca4a125d85583d69ab33c5851f1a1c29",
  "f53b2113ebdf2fe2eaa341cc2a0e2108ebfa73c057e3ff149906f0c391bbed8b",
  "5e478f81da20dfe1efbe50827226d1642335664cd7cb60819b09bc644feaf423",
  "f32a43b07442b9ac7da61401db3472269c5697a3887728a5a0622a181725fb8a",
  "2bc31efcbe7a6eca2420f4833108f2e2393c4e9371b1df4e3a60152fae1c4283",
];
const spriteLocations = [
  ...Array.from({ length: 15 }, (_, index) => ({ atlasIndex: Math.floor(index / 4), row: index % 4 })),
  { atlasIndex: 4, row: 0 },
  { atlasIndex: 4, row: 1 },
  { atlasIndex: 4, row: 2 },
  { atlasIndex: 5, row: 0 },
  { atlasIndex: 7, row: 0 },
  { atlasIndex: 5, row: 2 },
  { atlasIndex: 6, row: 0 },
  { atlasIndex: 8, row: 0 },
];
const bossIds = [
  "atroce", "lady-tanee", "boitata", "wandering-samurai", "dark-elementalist", "naght-sieger",
  "coelacanth", "dark-ranger", "death-knight", "fallen-bishop", "tao-gunka", "ice-dragon",
  "restful", "chimera", "holy-angel-poring", "morocc", "shadow-demon", "orc-hero", "dark-chaser", "undead-wizard", "zombie-dragon", "dark-geneticist", "tirfing",
];

function pngAlpha(atlas: PixelAtlas) {
  const cached = alphaCache.get(atlas.source);
  if (cached) return cached;
  const bytes = readFileSync(new URL(`../public${atlas.source}`, import.meta.url));
  assert.deepEqual(bytes.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), atlas.source);
  assert.equal(bytes.toString("ascii", 12, 16), "IHDR", atlas.source);
  assert.equal(bytes.readUInt32BE(16), atlas.width, `${atlas.source}: width`);
  assert.equal(bytes.readUInt32BE(20), atlas.height, `${atlas.source}: height`);
  assert.equal(bytes[24], 8, `${atlas.source}: 8-bit channels`);
  assert.equal(bytes[25], 6, `${atlas.source}: true RGBA`);
  assert.equal(bytes[26], 0, `${atlas.source}: compression`);
  assert.equal(bytes[27], 0, `${atlas.source}: filter method`);
  assert.equal(bytes[28], 0, `${atlas.source}: non-interlaced`);
  const chunks: Buffer[] = [];
  for (let offset = 8; offset < bytes.length;) {
    assert.ok(offset + 12 <= bytes.length, `${atlas.source}: truncated chunk`);
    const length = bytes.readUInt32BE(offset);
    assert.ok(offset + length + 12 <= bytes.length, `${atlas.source}: truncated chunk payload`);
    if (bytes.toString("ascii", offset + 4, offset + 8) === "IDAT") chunks.push(bytes.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  assert.ok(chunks.length > 0, `${atlas.source}: missing image data`);
  const scanlines = inflateSync(Buffer.concat(chunks));
  const alpha = new Uint8Array(atlas.width * atlas.height);
  const stride = atlas.width * 4 + 1;
  assert.equal(scanlines.length, stride * atlas.height, `${atlas.source}: scanline dimensions`);
  for (let row = 0; row < atlas.height; row++) {
    const filter = scanlines[row * stride];
    assert.ok(filter <= 4, `${atlas.source}: invalid row filter`);
    for (let column = 0; column < atlas.width; column++) {
      const position = row * atlas.width + column;
      const left = column ? alpha[position - 1] : 0;
      const up = row ? alpha[position - atlas.width] : 0;
      const upperLeft = row && column ? alpha[position - atlas.width - 1] : 0;
      const prediction = left + up - upperLeft;
      const leftDistance = Math.abs(prediction - left);
      const upDistance = Math.abs(prediction - up);
      const cornerDistance = Math.abs(prediction - upperLeft);
      const paeth = leftDistance <= upDistance && leftDistance <= cornerDistance ? left : upDistance <= cornerDistance ? up : upperLeft;
      const predictor = filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? up : filter === 3 ? Math.floor((left + up) / 2) : paeth;
      alpha[position] = (scanlines[row * stride + column * 4 + 4] + predictor) & 255;
    }
  }
  alphaCache.set(atlas.source, alpha);
  return alpha;
}

function cropAlpha(atlas: PixelAtlas, bounds: Bounds) {
  const alpha = pngAlpha(atlas);
  const [left, top, width, height] = bounds;
  let weightedArea = 0;
  let foregroundPixels = 0;
  let minimumLeft = width;
  let minimumTop = height;
  let maximumRight = -1;
  let maximumBottom = -1;
  for (let vertical = 0; vertical < height; vertical++) {
    for (let horizontal = 0; horizontal < width; horizontal++) {
      const value = alpha[(top + vertical) * atlas.width + left + horizontal];
      weightedArea += value / 255;
      if (value <= 10) continue;
      foregroundPixels++;
      minimumLeft = Math.min(minimumLeft, horizontal);
      minimumTop = Math.min(minimumTop, vertical);
      maximumRight = Math.max(maximumRight, horizontal);
      maximumBottom = Math.max(maximumBottom, vertical);
    }
  }
  return { weightedArea, foregroundPixels, margins: [minimumLeft, minimumTop, width - 1 - maximumRight, height - 1 - maximumBottom] };
}

function pngRgba(atlas: PixelAtlas) {
  const bytes = readFileSync(new URL(`../public${atlas.source}`, import.meta.url));
  const chunks: Buffer[] = [];
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    if (bytes.toString("ascii", offset + 4, offset + 8) === "IDAT") chunks.push(bytes.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  const scanlines = inflateSync(Buffer.concat(chunks));
  const stride = atlas.width * 4;
  const pixels = Buffer.alloc(stride * atlas.height);
  for (let row = 0; row < atlas.height; row++) {
    const filter = scanlines[row * (stride + 1)];
    for (let column = 0; column < stride; column++) {
      const position = row * stride + column;
      const left = column >= 4 ? pixels[position - 4] : 0;
      const up = row ? pixels[position - stride] : 0;
      const upperLeft = row && column >= 4 ? pixels[position - stride - 4] : 0;
      const prediction = left + up - upperLeft;
      const leftDistance = Math.abs(prediction - left);
      const upDistance = Math.abs(prediction - up);
      const cornerDistance = Math.abs(prediction - upperLeft);
      const paeth = leftDistance <= upDistance && leftDistance <= cornerDistance ? left : upDistance <= cornerDistance ? up : upperLeft;
      const predictor = filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? up : filter === 3 ? Math.floor((left + up) / 2) : paeth;
      pixels[position] = (scanlines[row * (stride + 1) + column + 1] + predictor) & 255;
    }
  }
  return pixels;
}

for (const [sheetIndex, atlas] of atlases.entries()) {
  const rowCount = ["g", "h", "i"].includes(sheetIds[sheetIndex]) ? 1 : ["e", "f"].includes(sheetIds[sheetIndex]) ? 3 : 4;
  test(`pixel sheet ${sheetIds[sheetIndex]} has ${rowCount * 4} separate integer ROIs inside its RGBA image`, () => {
    assert.equal(atlas.source, `/art/ro-pixel-motion-${sheetIds[sheetIndex]}.png`);
    assert.ok(Number.isInteger(atlas.width) && atlas.width > 0);
    assert.ok(Number.isInteger(atlas.height) && atlas.height > 0);
    assert.equal(atlas.rows.length, rowCount, atlas.source);
    const frames = atlas.rows.flat();
    assert.equal(frames.length, rowCount * 4, atlas.source);
    for (const [rowIndex, row] of atlas.rows.entries()) {
      assert.equal(row.length, 4, `${atlas.source}: row ${rowIndex}`);
      for (const [frameIndex, bounds] of row.entries()) {
        assert.equal(bounds.length, 4);
        assert.ok(bounds.every(Number.isInteger), `${atlas.source}: row ${rowIndex}, frame ${frameIndex}`);
        const [left, top, width, height] = bounds;
        assert.ok(left >= 0 && top >= 0 && width > 4 && height > 4);
        assert.ok(left + width <= atlas.width && top + height <= atlas.height);
      }
    }
    const alpha = pngAlpha(atlas);
    for (const [frameIndex, [left, top, width, height]] of frames.entries()) {
      for (let otherIndex = frameIndex + 1; otherIndex < frames.length; otherIndex++) {
        const [otherLeft, otherTop, otherWidth, otherHeight] = frames[otherIndex];
        const disjoint = left + width <= otherLeft || otherLeft + otherWidth <= left || top + height <= otherTop || otherTop + otherHeight <= top;
        if (disjoint) continue;
        assert.equal(sheetIds[sheetIndex], "h", `${atlas.source}: overlapping ROIs ${frameIndex} and ${otherIndex}`);
        for (let vertical = Math.max(top, otherTop); vertical < Math.min(top + height, otherTop + otherHeight); vertical++) {
          for (let horizontal = Math.max(left, otherLeft); horizontal < Math.min(left + width, otherLeft + otherWidth); horizontal++) {
            assert.ok(alpha[vertical * atlas.width + horizontal] <= 10, `${atlas.source}: shared foreground between ROIs ${frameIndex} and ${otherIndex}`);
          }
        }
      }
    }
    assert.ok(alpha.some(value => value === 0), `${atlas.source}: no transparent background`);
    assert.ok(alpha.some(value => value > 10), `${atlas.source}: no foreground`);
  });

  test(`pixel sheet ${sheetIds[sheetIndex]} preserves two padding pixels around every alpha > 10 foreground crop`, () => {
    const paddingFailures: string[] = [];
    for (const [rowIndex, row] of atlas.rows.entries()) {
      for (const [frameIndex, bounds] of row.entries()) {
        const { foregroundPixels, margins } = cropAlpha(atlas, bounds);
        const label = `${atlas.source}: row ${rowIndex}, frame ${frameIndex}`;
        assert.ok(foregroundPixels > 0, `${label}: empty crop`);
        if (margins.some(margin => margin < 2)) paddingFailures.push(`${label}: alpha > 10 margins [left,top,right,bottom] = ${margins}`);
      }
    }
    assert.deepEqual(paddingFailures, []);
  });

  test(`pixel sheet ${sheetIds[sheetIndex]} idle areas match weighted foreground alpha`, () => {
    assert.equal(atlas.idleAreas.length, rowCount, atlas.source);
    for (const [rowIndex, row] of atlas.rows.entries()) {
      const expected = atlas.idleAreas[rowIndex];
      assert.ok(Number.isFinite(expected) && expected > 0, `${atlas.source}: idle area ${rowIndex}`);
      const { weightedArea } = cropAlpha(atlas, row[0]);
      const tolerance = Math.max(2, expected * .0025);
      assert.ok(Math.abs(weightedArea - expected) <= tolerance,
        `${atlas.source}: idle row ${rowIndex}, metadata ${expected}, decoded alpha ${weightedArea}, tolerance ${tolerance}`);
    }
  });
}

test("boss motion maps twenty-three bosses to nine pixel sheets and ninety-two selected frames", () => {
  const moduleValue = { exports: {} as Record<string, unknown> };
  const javascript = ts.transpileModule(readFileSync(new URL("../lib/boss-motion.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(javascript, {
    module: moduleValue,
    exports: moduleValue.exports,
    require: (path: string) => {
      const index = sheetIds.findIndex(sheet => path === `./pixel-motion-${sheet}.json`);
      assert.ok(index >= 0, `Unexpected boss motion dependency: ${path}`);
      return { default: atlases[index] };
    },
  });
  const normalized = JSON.parse(JSON.stringify(moduleValue.exports));
  assert.deepEqual(normalized.motionAtlases, atlases.map(({ source, width, height }) => ({ source, width, height })));
  assert.deepEqual(normalized.motionSpriteLocations, spriteLocations);
  assert.deepEqual(normalized.motionFrameBounds, spriteLocations.map(({ atlasIndex, row }) => atlases[atlasIndex].rows[row]));
  assert.deepEqual(normalized.bossIdleSilhouetteAreas, spriteLocations.map(({ atlasIndex, row }) => atlases[atlasIndex].idleAreas[row]));
  assert.deepEqual(normalized.bossMotion.map((boss: { id: string }) => boss.id), bossIds);
  assert.equal(normalized.motionFrameBounds.length, 23);
  assert.equal(normalized.motionFrameBounds.flat().length, 92);
  const detailsFor = moduleValue.exports.motionDetails as (index: number) => {
    id: string; source: string; width: number; height: number; row: number;
    frames: { left: number; top: number; width: number; height: number }[];
  } | null;
  assert.equal(typeof detailsFor, "function");
  for (const [spriteIndex, { atlasIndex, row }] of spriteLocations.entries()) {
    const details = detailsFor(spriteIndex);
    const atlas = atlases[atlasIndex];
    assert.ok(details, `Missing motion details for ${bossIds[spriteIndex]}`);
    assert.equal(details.id, bossIds[spriteIndex]);
    assert.equal(details.source, atlas.source, `${details.id}: selected source`);
    assert.equal(details.width, atlas.width, `${details.id}: selected width`);
    assert.equal(details.height, atlas.height, `${details.id}: selected height`);
    assert.equal(details.row, row, `${details.id}: selected row`);
    assert.deepEqual(JSON.parse(JSON.stringify(details.frames.map(({ left, top, width, height }) => [left, top, width, height]))), atlas.rows[row], `${details.id}: selected frame bounds`);
  }
  assert.equal(detailsFor(-1), null);
  assert.equal(detailsFor(23), null);
});

test("original motion PNGs remain retained unchanged beside their pixel replacements", () => {
  for (const [index, sheet] of preservedSheetIds.entries()) {
    const original = readFileSync(new URL(`../public/art/ro-motion-${sheet}.png`, import.meta.url));
    const replacement = readFileSync(new URL(`../public${atlases[index].source}`, import.meta.url));
    assert.equal(createHash("sha256").update(original).digest("hex"), originalHashes[index], `ro-motion-${sheet}.png changed`);
    assert.notEqual(createHash("sha256").update(replacement).digest("hex"), originalHashes[index], `Sheet ${sheet} still uses its original artwork`);
  }
});

test("existing A–G pixel PNGs remain byte-for-byte unchanged when wizard and Tirfing are restyled", () => {
  for (const [index, sheet] of [...preservedSheetIds, "e", "f", "g"].entries()) {
    const bytes = readFileSync(new URL(`../public/art/ro-pixel-motion-${sheet}.png`, import.meta.url));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), preservedPixelHashes[index], `ro-pixel-motion-${sheet}.png changed`);
  }
});

for (const { sheetIndex, label, hash } of [
  { sheetIndex: 6, label: "geneticist", hash: "2bc31efcbe7a6eca2420f4833108f2e2393c4e9371b1df4e3a60152fae1c4283" },
  { sheetIndex: 7, label: "undead wizard", hash: "4e349375601c80c5a68591a8c5f11a6a8ff07e20114bace40fb00075e6c9b8e8" },
  { sheetIndex: 8, label: "Tirfing", hash: "f041953d71d1ee3e0d3704329439999561b5a002911ab853e75d681ce691692b" },
]) test(`${label} has four distinct tightly bounded drawn pixel poses and no omitted foreground`, () => {
  const atlas = atlases[sheetIndex];
  const bytes = readFileSync(new URL(`../public${atlas.source}`, import.meta.url));
  assert.equal(createHash("sha256").update(bytes).digest("hex"), hash);
  const alpha = pngAlpha(atlas);
  const rgba = pngRgba(atlas);
  const covered = new Uint8Array(atlas.width * atlas.height);
  const hashes = [];
  for (const bounds of atlas.rows[0]) {
    const [left, top, width, height] = bounds;
    for (let vertical = top; vertical < top + height; vertical++) {
      for (let horizontal = left; horizontal < left + width; horizontal++) covered[vertical * atlas.width + horizontal]++;
    }
    const { margins } = cropAlpha(atlas, bounds);
    const [paddingLeft, paddingTop, paddingRight, paddingBottom] = margins;
    const foregroundWidth = width - paddingLeft - paddingRight;
    const foregroundHeight = height - paddingTop - paddingBottom;
    const hash = createHash("sha256").update(`${foregroundWidth}:${foregroundHeight}:`);
    for (let vertical = top + paddingTop; vertical < top + height - paddingBottom; vertical++) {
      const start = (vertical * atlas.width + left + paddingLeft) * 4;
      hash.update(rgba.subarray(start, start + foregroundWidth * 4));
    }
    hashes.push(hash.digest("hex"));
  }
  assert.equal(new Set(hashes).size, 4);
  for (let position = 0; position < alpha.length; position++) {
    assert.equal(rgba[position * 4 + 3], alpha[position]);
    if (alpha[position] > 10) assert.equal(covered[position], 1, `${label} foreground ${position} is omitted or shared`);
  }
});

