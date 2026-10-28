import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { inflateSync } from "node:zlib";

type Bounds = [number, number, number, number];
type ApprovedAtlas = {
  source: string; width: number; height: number; bossIds: string[]; rows: Bounds[][]; idleAreas: number[];
  approvedIdlePixelHashes: string[]; approvedIdleSizes: number[][]; approvedIdleSourceBounds: Bounds[];
  sourceMasterSha256: string; generatedSource: string; frameOrder: string[];
};
const proof = JSON.parse(readFileSync(new URL("./fixtures/approved-boss-idle-proofs.json", import.meta.url), "utf8"));
const batchIds = ["a", "b", "c", "d", "e"];
const available = batchIds.filter(batch => existsSync(new URL(`../lib/approved-boss-motion-${batch}.json`, import.meta.url)));

function rgbaPixels(atlas: ApprovedAtlas) {
  const bytes = readFileSync(new URL(`../public${atlas.source}`, import.meta.url));
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(bytes.readUInt32BE(16), atlas.width);
  assert.equal(bytes.readUInt32BE(20), atlas.height);
  assert.equal(bytes[24], 8);
  assert.equal(bytes[25], 6);
  assert.equal(bytes[28], 0);
  const chunks: Buffer[] = [];
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    if (bytes.toString("ascii", offset + 4, offset + 8) === "IDAT") chunks.push(bytes.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  const scanlines = inflateSync(Buffer.concat(chunks));
  const stride = atlas.width * 4;
  const pixels = Buffer.alloc(stride * atlas.height);
  assert.equal(scanlines.length, (stride + 1) * atlas.height);
  for (let row = 0; row < atlas.height; row++) for (let column = 0; column < stride; column++) {
    const filter = scanlines[row * (stride + 1)];
    assert.ok(filter <= 4);
    const position = row * stride + column;
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

function crop(pixels: Buffer, atlasWidth: number, [left, top, width, height]: Bounds) {
  const buffer = Buffer.alloc(width * height * 4);
  for (let row = 0; row < height; row++) {
    const start = ((top + row) * atlasWidth + left) * 4;
    pixels.copy(buffer, row * width * 4, start, start + width * 4);
  }
  return buffer;
}

for (const batch of available) test(`approved batch ${batch} preserves exact idle pixels and four complete distinct action poses per boss`, () => {
  const atlas = JSON.parse(readFileSync(new URL(`../lib/approved-boss-motion-${batch}.json`, import.meta.url), "utf8")) as ApprovedAtlas;
  const expected = proof.bosses.slice(batchIds.indexOf(batch) * 5, batchIds.indexOf(batch) * 5 + 5);
  assert.deepEqual(atlas.bossIds, expected.map((boss: any) => boss.id));
  assert.equal(atlas.sourceMasterSha256, "0bbf3ec962fc0f79855b4b7fd4911e29c563e9f596540e91d60e937e53e8a788");
  assert.equal(atlas.sourceMasterSha256, proof.sourceMasterSha256);
  assert.doesNotMatch(atlas.generatedSource, /[\\/]/);
  assert.deepEqual(atlas.frameOrder, ["approved-idle", "windup", "action", "recovery"]);
  assert.equal(atlas.rows.length, 5);
  const pixels = rgbaPixels(atlas);
  const covered = new Uint8Array(atlas.width * atlas.height);
  for (const [row, bounds] of atlas.rows.entries()) {
    assert.equal(bounds.length, 4);
    const hashes: string[] = [];
    for (const [column, [left, top, width, height]] of bounds.entries()) {
      assert.ok([left, top, width, height].every(Number.isInteger));
      assert.ok(left >= 0 && top >= 0 && width > 4 && height > 4 && left + width <= atlas.width && top + height <= atlas.height);
      let area = 0;
      const margins = [width, height, width, height];
      for (let vertical = 0; vertical < height; vertical++) for (let horizontal = 0; horizontal < width; horizontal++) {
        const pixel = (top + vertical) * atlas.width + left + horizontal;
        covered[pixel]++;
        const alpha = pixels[pixel * 4 + 3];
        area += alpha / 255;
        if (alpha > 8) {
          margins[0] = Math.min(margins[0], horizontal);
          margins[1] = Math.min(margins[1], vertical);
          margins[2] = Math.min(margins[2], width - horizontal - 1);
          margins[3] = Math.min(margins[3], height - vertical - 1);
        }
      }
      assert.ok(margins.every(margin => margin >= 2), `${batch}/${row}/${column}: complete foreground with two empty padding pixels`);
      const tightBounds: Bounds = [left + 2, top + 2, width - 4, height - 4];
      const hash = createHash("sha256").update(crop(pixels, atlas.width, tightBounds)).digest("hex");
      hashes.push(hash);
      if (!column) {
        assert.deepEqual([width - 4, height - 4], expected[row].size);
        assert.deepEqual(atlas.approvedIdleSizes[row], expected[row].size);
        assert.deepEqual(atlas.approvedIdleSourceBounds[row], expected[row].sourceBounds);
        assert.equal(atlas.approvedIdlePixelHashes[row], expected[row].rawPixelHash);
        assert.equal(hash, expected[row].rawPixelHash, `${expected[row].id}: every approved idle RGBA byte remains exact`);
        assert.ok(Math.abs(area - atlas.idleAreas[row]) < 1e-6);
      }
    }
    assert.equal(new Set(hashes).size, 4, `${expected[row].id}: four distinct drawings`);
  }
  for (let pixel = 0; pixel < covered.length; pixel++) if (pixels[pixel * 4 + 3] > 8) assert.equal(covered[pixel], 1, `${batch}: foreground ${pixel} omitted or shared`);
});

test("all twenty-five approved bosses require five complete animation batches", () => {
  assert.deepEqual(available, batchIds);
  assert.equal(proof.bosses.length, 25);
});
