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
const loaded = { exports: {} as Record<string, React.ComponentType<{ value: string; decorative?: boolean }>> };
vm.runInNewContext(ts.transpileModule(source("../src/components/reference-countdown.tsx"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, { module: loaded, exports: loaded.exports, require: requireModule });
const Countdown = loaded.exports.ReferenceCountdown;
const render = (value: string, decorative = false) => renderToStaticMarkup(React.createElement(Countdown, { value, decorative }));

function inside(path: string, horizontal: number, vertical: number) {
  const tokens = path.match(/[A-Z]|-?\d+(?:\.\d+)?/g)!;
  const points: [number, number][] = [];
  let cursor = 0;
  let left = 0;
  let top = 0;
  while (cursor < tokens.length) {
    const command = tokens[cursor++];
    if (command === "Z") break;
    if (command === "M" || command === "L") { left = Number(tokens[cursor++]); top = Number(tokens[cursor++]); }
    else if (command === "H") left = Number(tokens[cursor++]);
    else if (command === "V") top = Number(tokens[cursor++]);
    else assert.fail(`Unexpected numeral path command ${command}`);
    points.push([left, top]);
  }
  let occupied = false;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
    const [firstX, firstY] = points[index];
    const [secondX, secondY] = points[previous];
    if ((firstY > vertical) !== (secondY > vertical) && horizontal < (secondX - firstX) * (vertical - firstY) / (secondY - firstY) + firstX) occupied = !occupied;
  }
  return occupied;
}

test("two and five have clearly opposite upper and lower strokes at the existing glyph dimensions", () => {
  const paths = [...render("25").matchAll(/<path d="([^"]+)"/g)].map(match => match[1]);
  assert.equal(paths.length, 2);
  for (const path of paths) for (const vertical of [2, 13, 26]) assert.equal(inside(path, 8, vertical), true);
  assert.equal(inside(paths[0], 2, 8), false, "2 leaves its upper-left open");
  assert.equal(inside(paths[0], 13, 8), true, "2 has an upper-right stroke");
  assert.equal(inside(paths[0], 2, 20), true, "2 has a lower-left stroke");
  assert.equal(inside(paths[0], 13, 20), false, "2 leaves its lower-right open");
  assert.equal(inside(paths[1], 2, 8), true, "5 has an upper-left stroke");
  assert.equal(inside(paths[1], 13, 8), false, "5 leaves its upper-right open");
  assert.equal(inside(paths[1], 2, 20), false, "5 leaves its lower-left open");
  assert.equal(inside(paths[1], 13, 20), true, "5 has a lower-right stroke");
});

test("countdown samples keep fixed-width pixel glyphs, exact values and readable accessible labels", () => {
  for (const value of ["00:25:52", "02:52:25", "0123456789", "--:--:--"]) {
    const markup = render(value);
    assert.ok(markup.includes(`role="img" aria-label="${value}"`));
    const glyphs = [...markup.matchAll(/<svg\b[^>]*>/g)].map(match => match[0]);
    assert.equal(glyphs.length, value.length);
    for (const [index, glyph] of glyphs.entries()) {
      assert.ok(glyph.includes(`viewBox="0 0 ${value[index] === ":" ? 5 : 16} 28"`));
      assert.ok(glyph.includes('shape-rendering="crispEdges"'));
    }
  }
  const decorative = render("00:25:52", true);
  assert.match(decorative, /^<span class="reference-countdown" aria-hidden="true">/);
  assert.doesNotMatch(decorative, /role="img"|aria-label=/);
  assert.match(render("<invalid>"), /&lt;invalid&gt;/);
});

test("cards, destination countdowns and both clocks share the same clear glyphs without changing their timer values", () => {
  const app = source("../src/boss-timer-app.tsx");
  const styles = source("../src/reference-countdown.css");
  assert.match(app, /<time className="route-countdown"[^]*?<ReferenceCountdown value=\{durationText\(\(boss\.dueAt! - now\) \/ 1000\)\} decorative \/>/);
  for (const offset of [7, 8]) assert.ok(app.includes(`<ReferenceCountdown value={localClock(now, ${offset})} />`));
  assert.match(styles, /\.app-shell \.route-countdown \.reference-countdown, \.app-shell \.dual-clock strong \.reference-countdown \{ --countdown-height: 1em; color: inherit;/);
  assert.match(styles, /height: var\(--countdown-height, 28px\)/);
});

test("both destination spawn times are larger and preserve the existing user size controls", () => {
  assert.match(source("../src/approved-art.css"), /\.upcoming-route \.route-spawn-time \{[^}]*font-size: max\(3\.4cqi, 14px\); font-weight: 800/);
  assert.match(source("../src/desktop-layout.css"), /\.reference-timers \.upcoming-route \.route-spawn-time \{\s*font-size: 16px/);
  const customized = source("../src/font-settings.css");
  assert.match(customized, /\.route-spawn-time \{ font-size: calc\(max\(3\.4cqi, 14px\) \* var\(--user-ui-scale\)\)/);
  assert.match(customized, /\.route-spawn-time \{ font-size: calc\(16px \* var\(--user-ui-scale\)\)/);
});
