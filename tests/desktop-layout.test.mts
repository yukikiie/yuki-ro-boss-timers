import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const readSource = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const styles = readSource("../src/desktop-layout.css");
const page = readSource("../src/boss-timer-app.tsx");

function mediaBody(minimum: number) {
  const marker = `@media (min-width: ${minimum}px)`;
  const markerIndex = styles.indexOf(marker);
  assert.ok(markerIndex >= 0, marker);
  const start = styles.indexOf("{", markerIndex);
  assert.ok(start > 0);
  let depth = 1;
  let end = start + 1;
  for (; end < styles.length && depth; end++) {
    if (styles[end] === "{") depth++;
    if (styles[end] === "}") depth--;
  }
  assert.equal(depth, 0);
  return styles.slice(start + 1, end - 1);
}

function declarations(source: string, selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const body = source.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1];
  assert.ok(body, selector);
  return Object.fromEntries(body.split(";").filter(value => value.trim()).map(value => {
    const separator = value.indexOf(":");
    return [value.slice(0, separator).trim(), value.slice(separator + 1).trim()];
  }));
}

test("desktop styles leave mobile and tablet geometry untouched", () => {
  const mobile = styles.slice(0, styles.indexOf("@media")).trim();
  assert.equal(declarations(mobile, ".boss-card-slot").display, "contents");
  assert.equal(declarations(mobile, ".desktop-header-scene").display, "none");
  assert.doesNotMatch(mobile, /(?:^|[;{])\s*(?:width|height|padding|margin|position|font-size)\s*:/);
  const breakpoints = [...styles.matchAll(/@media\s*\(min-width:\s*(\d+)px\)/g)].map(match => Number(match[1]));
  assert.ok(breakpoints.includes(1100));
  assert.ok(breakpoints.every(minimum => minimum >= 1100));
  const main = readSource("../src/main.tsx");
  assert.ok(main.indexOf('import "./desktop-layout.css"') > main.indexOf('import "./living-scene.css"'));
  assert.match(page, /return <div className="boss-card-slot" key=\{boss\.id\}><article className=\{`boss-card /);
  assert.match(page, /<\/article><\/div>;/);
});

test("wide viewports use a full-width panoramic header and three card columns", () => {
  const desktop = mediaBody(1100);
  const shell = declarations(desktop, ".app-shell");
  assert.equal(shell.display, "grid");
  assert.equal(shell["max-width"], "1440px");
  assert.equal(shell.width, "calc(100% - 48px)");
  assert.equal(shell["align-content"], "start");
  const timerShell = declarations(desktop, ".app-shell.reference-timers");
  assert.equal(timerShell["grid-template-columns"], "repeat(2, minmax(0, 1fr))");
  assert.equal(timerShell["grid-template-rows"], "auto auto");
  assert.equal(declarations(desktop, ".app-shell .map-masthead")["container-type"], "inline-size");
  assert.equal(declarations(desktop, ".reference-timers .animated-header")["grid-column"], "1 / -1");
  assert.equal(declarations(desktop, ".reference-timers .animated-header").width, "100%");
  assert.equal(declarations(desktop, ".reference-timers .mobile-header-scene").display, "none");
  assert.equal(declarations(desktop, ".reference-timers .desktop-header-scene").display, "block");
  assert.equal(declarations(desktop, ".reference-timers .boss-grid")["grid-template-columns"], "repeat(3, minmax(0, 1fr))");
  assert.equal(declarations(mediaBody(1400), ".reference-timers .boss-grid")["grid-template-columns"], "repeat(3, minmax(0, 1fr))");
  assert.equal(declarations(desktop, ".app-shell .main-nav").display, "grid");
  assert.equal(declarations(desktop, ".app-shell .mobile-nav").display, "none");
});

test("every desktop card owns the sizing context for portraits, badges and countdowns", () => {
  const desktop = mediaBody(1100);
  const slot = declarations(desktop, ".reference-timers .boss-card-slot");
  assert.equal(slot.display, "block");
  assert.equal(slot["container-type"], "inline-size");
  assert.equal(slot["container-name"], "boss-card");
  assert.equal(slot["--b-unit"], ".214592cqi");
  const featured = declarations(desktop, ".reference-timers .card-featured");
  assert.equal(featured["grid-column"], "auto");
  assert.equal(featured.height, "max(27.5cqi, 110px)");
  assert.equal(declarations(desktop, ".reference-timers .boss-identity h3")["font-size"], "clamp(13px, 4.08cqi, 17px)");
  assert.match(readSource("../src/approved-art.css"), /--countdown-height: calc\(26 \* var\(--b-unit\)\)/);
  assert.match(readSource("../src/reference-countdown.css"), /height: var\(--countdown-height, 28px\)/);
  const openSlot = declarations(desktop, ".reference-timers .boss-card-slot:has(.card-menu-open)");
  assert.equal(openSlot.position, "relative");
  assert.equal(openSlot["z-index"], "32");
});

test("desktop paints the complete garden once behind the grid at its natural ratio", () => {
  const desktop = mediaBody(1100);
  const main = declarations(desktop, ".app-shell.reference-timers[data-scene-phase] .main-shell");
  assert.equal(main.background, "none");
  assert.equal(main["min-height"], "0");
  assert.equal(main.display, "grid");
  assert.equal(main["grid-column"], "1 / -1");
  assert.equal(main["grid-row"], "2");
  assert.equal(main["align-content"], "start");
  const content = declarations(desktop, ".reference-timers .main-content");
  assert.equal(content["grid-area"], "1 / 1");
  assert.equal(content["align-self"], "start");
  const garden = declarations(desktop, ".reference-timers .living-garden");
  assert.equal(garden.position, "relative");
  assert.equal(garden.inset, "auto");
  assert.equal(garden["grid-area"], "1 / 1");
  assert.equal(garden["align-self"], "start");
  assert.equal(garden.width, "100%");
  assert.equal(garden.height, undefined);
  assert.equal(garden["background-image"], "var(--scene-garden-image)");
  assert.equal(garden["background-size"], "100% auto");
  assert.equal(garden["background-repeat"], "no-repeat");
  assert.equal(garden["background-position"], "center top");
  assert.match(readSource("../src/living-scene.css"), /\.living-garden \{[^}]*aspect-ratio: 739 \/ 2129/);
  assert.match(readSource("../src/components/living-scene.tsx"), /viewBox="0 0 739 2129" preserveAspectRatio="xMidYMin meet"/);
  assert.equal(declarations(desktop, ".app-shell .map-art")["aspect-ratio"], "3 / 2");
  assert.doesNotMatch(styles, /cover|mirror|repeat-[xy]|background-size:\s*[^;]*100%\s+100%|scale\(/);
  assert.doesNotMatch(styles, /--desktop-scene-height|--desktop-garden-top|--desktop-sidebar-width/);
  const header = declarations(desktop, ".reference-timers .desktop-header-image");
  assert.equal(header.width, "100%");
  assert.equal(header.height, "auto");
  assert.equal(header["aspect-ratio"], undefined);
  const overlay = declarations(desktop, ".reference-timers .desktop-header-scene > svg");
  assert.equal(overlay.position, "absolute");
  assert.equal(overlay.inset, "0");
  assert.equal(overlay.width, "100%");
  assert.equal(overlay.height, "100%");
  const tools = declarations(desktop, ".reference-timers .timer-tools[open]");
  assert.equal(tools.position, "relative");
  assert.equal(tools.inset, "auto");
});

test("desktop controls open through media state without timer or storage side effects", () => {
  assert.match(page, /<details className="timer-tools" open=\{desktopLayout \|\| undefined\}>/);
  const body = page.match(/useEffect\(\(\) => \{\s*(const desktopPreference = window\.matchMedia\("\(min-width: 1100px\)"\);[\s\S]*?)\n  \}, \[\]\);/)?.[1];
  assert.ok(body);
  assert.doesNotMatch(body, /apiFetch|mutate|localStorage|sessionStorage|setData|setClock|setInterval/);
  const updates: boolean[] = [];
  let listener: (() => void) | undefined;
  let removed = false;
  const preference = {
    matches: false,
    addEventListener: (event: string, handler: () => void) => { assert.equal(event, "change"); listener = handler; },
    removeEventListener: (event: string, handler: () => void) => { assert.equal(event, "change"); assert.equal(handler, listener); removed = true; },
  };
  const cleanup = vm.runInNewContext(`(() => {${body}})()`, {
    window: { matchMedia: (query: string) => { assert.equal(query, "(min-width: 1100px)"); return preference; } },
    setDesktopLayout: (value: boolean) => updates.push(value),
  }) as () => void;
  preference.matches = true;
  listener!();
  preference.matches = false;
  listener!();
  assert.deepEqual(updates, [false, true, false]);
  cleanup();
  assert.equal(removed, true);
  assert.equal(declarations(mediaBody(1100), ".reference-timers .timer-tools > summary").display, "none");
});
