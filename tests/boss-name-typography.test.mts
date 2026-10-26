import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { brotliDecompressSync } from "node:zlib";
import { bossCatalog } from "../lib/boss-catalog.js";
import { bossNameRegistry } from "../lib/boss-names.js";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

function fontCoverage(file: string) {
  const bytes = readFileSync(new URL(`../public/fonts/${file}`, import.meta.url));
  assert.equal(bytes.toString("ascii", 0, 4), "wOF2");
  let cursor = 48;
  let tableOffset = 0;
  let cmapOffset = -1;
  let cmapLength = 0;
  function base128() {
    let value = 0;
    for (let count = 0; count < 5; count++) {
      const byte = bytes[cursor++];
      value = value * 128 + (byte & 127);
      if (!(byte & 128)) return value;
    }
    throw new Error("Invalid WOFF2 table length");
  }
  for (let index = 0; index < bytes.readUInt16BE(12); index++) {
    const flags = bytes[cursor++];
    const tagIndex = flags & 63;
    const tag = tagIndex === 63 ? bytes.toString("ascii", cursor, cursor += 4) : tagIndex === 0 ? "cmap" : tagIndex === 10 ? "glyf" : tagIndex === 11 ? "loca" : "other";
    const length = base128();
    const version = flags >>> 6;
    const transformed = tag === "glyf" || tag === "loca" ? version !== 3 : version !== 0;
    const storedLength = transformed ? base128() : length;
    if (tag === "cmap") { cmapOffset = tableOffset; cmapLength = storedLength; }
    tableOffset += storedLength;
  }
  assert.ok(cmapOffset >= 0);
  const decoded = brotliDecompressSync(bytes.subarray(cursor, cursor + bytes.readUInt32BE(20)));
  assert.equal(decoded.length, tableOffset);
  const cmap = decoded.subarray(cmapOffset, cmapOffset + cmapLength);
  const subtables = Array.from({ length: cmap.readUInt16BE(2) }, (_, index) => cmap.readUInt32BE(8 + index * 8));
  return (character: string) => {
    const codepoint = character.codePointAt(0)!;
    return subtables.some(offset => {
      const format = cmap.readUInt16BE(offset);
      if (format === 12) {
        for (let group = 0; group < cmap.readUInt32BE(offset + 12); group++) {
          const position = offset + 16 + group * 12;
          const start = cmap.readUInt32BE(position);
          const end = cmap.readUInt32BE(position + 4);
          if (codepoint >= start && codepoint <= end) return cmap.readUInt32BE(position + 8) + codepoint - start !== 0;
        }
      }
      if (format === 4 && codepoint <= 65535) {
        const segments = cmap.readUInt16BE(offset + 6) / 2;
        for (let segment = 0; segment < segments; segment++) {
          const end = cmap.readUInt16BE(offset + 14 + segment * 2);
          const start = cmap.readUInt16BE(offset + 16 + segments * 2 + segment * 2);
          if (codepoint < start || codepoint > end) continue;
          const delta = cmap.readInt16BE(offset + 16 + segments * 4 + segment * 2);
          const rangePosition = offset + 16 + segments * 6 + segment * 2;
          const range = cmap.readUInt16BE(rangePosition);
          const glyph = range ? cmap.readUInt16BE(rangePosition + range + (codepoint - start) * 2) : codepoint;
          return glyph !== 0 && ((glyph + delta) & 65535) !== 0;
        }
      }
      return false;
    });
  };
}

test("one full Traditional Chinese weight-800 font covers every current shortcut and canonical name", () => {
  const bytes = readFileSync(new URL("../public/fonts/BosswatchBossNames-800.woff2", import.meta.url));
  assert.equal(createHash("sha256").update(bytes).digest("hex"), "b426834edc30738ecbac8c057c7435d95e042b4b6a6a5a02f3018c9f00684839");
  const supports = fontCoverage("BosswatchBossNames-800.woff2");
  const names = [...bossCatalog.map(boss => boss.name), ...bossNameRegistry.flatMap(entry => [entry.name, entry.displayName, ...entry.aliases]), "亡靈巫師", "殭屍龍", "獸牙怪"];
  for (const name of names) for (const character of name) assert.ok(supports(character), `${name}: missing ${character}`);
  const oldSupports = fontCoverage("BosswatchUI-Reference800.woff2");
  for (const character of "代巫師牙怪因") assert.equal(oldSupports(character), false, `${character}: expected original subset gap`);
});

test("all card and route names use the same 17px family and weight without long-name shrinking", () => {
  const styles = source("../src/approved-art.css");
  const desktop = source("../src/desktop-layout.css");
  assert.match(styles, /@font-face \{ font-family: "Bosswatch Boss Names";[^}]*BosswatchBossNames-800\.woff2[^}]*font-weight: 800/);
  assert.match(styles, /--boss-name-font-size: 17px/);
  assert.match(styles, /\.reference-timers \.boss-identity h3,[^}]*font-family: var\(--font-boss-name\); font-size: var\(--boss-name-font-size\); font-weight: 800/);
  assert.match(styles, /\.reference-timers \.boss-identity h3,[^}]*line-height: 1\.4/);
  assert.match(styles, /\.upcoming-route \.route-boss-name \{[^}]*font-family: var\(--font-boss-name\); font-size: var\(--boss-name-font-size\); font-weight: 800/);
  assert.match(desktop, /\.reference-timers \.boss-identity h3 \{\s*font-size: var\(--boss-name-font-size\)/);
  assert.doesNotMatch(styles + desktop + source("../src/boss-timer-app.tsx"), /boss-name-long/);
  assert.match(styles, /@media \(max-width: 359px\) \{\s*\.reference-timers \.boss-name-row \{ flex-wrap: wrap; row-gap: 0;/);
});
