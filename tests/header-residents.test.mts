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

const residents = loadModule(new URL("../src/components/garden-creature.tsx", import.meta.url));
const crowd = loadModule(new URL("../lib/header-crowd.ts", import.meta.url)) as typeof import("../lib/header-crowd");
const hooks = loadModule(new URL("../hooks/use-header-behavior.ts", import.meta.url)) as typeof import("../hooks/use-header-behavior");
const indices = [0, 1, 2, 3, 4, 5, 8, 9];
const expectedIds = ["purple-poring", "hat-poring", "blue-ghost", "leaf-poring", "lunatic", "peco-chick", "pink-poring", "angel-poring"];
const removedIds = ["novice", "priest", "moonlight-cat", "alice-maid"];

test("every phase and header layout renders only the eight retained monster overlays", () => {
  assert.deepEqual([...residents.headerMonsterActorIndices], indices);
  for (const phase of ["day", "afternoon", "night"] as const) {
    for (const tall of [false, true]) {
      const markup = renderToStaticMarkup(React.createElement(residents.HeaderResidents, { phase, active: false, tall }));
      assert.deepEqual([...markup.matchAll(/data-header-resident="([^"]+)"/g)].map(match => match[1]), expectedIds);
      assert.doesNotMatch(markup, /data-garden-person|novice|priest|moonlight-cat|alice-maid|ro-garden-people|ro-garden-added-companions/);
      assert.equal((markup.match(/data-routine="sleep"/g) || []).length, phase === "night" ? 8 : 0);
      assert.equal((markup.match(/data-affection-mark=/g) || []).length, phase === "night" ? 0 : 1);
    }
  }
});

test("optional crowd selection preserves original indices and survives sleep and morning resets without invisible actors", () => {
  assert.equal(crowd.createHeaderCrowd("day").actors.length, 12);
  for (const layout of ["standard", "tall"] as const) {
    let world = crowd.createHeaderCrowd("day", 7091, layout, indices);
    for (const phase of ["day", "afternoon", "night", "day"] as const) {
      world = crowd.advanceHeaderCrowd(world, phase === "night" ? 0 : 5000, phase);
      assert.deepEqual([...world.actors.map(actor => actor.index)], indices);
      assert.deepEqual([...world.actors.map(actor => actor.id)], expectedIds);
      assert.ok(world.actors.every(actor => !removedIds.includes(actor.id) && !removedIds.includes(actor.plan.targetId ?? "")));
      assert.ok(world.actors.every(actor => actor.activity === "sleep") === (phase === "night"));
    }
  }
});

test("sparse provider bindings keep pink Poring at index eight and Angel Poring at index nine", () => {
  function Probe() {
    return React.createElement("g", { "data-pink": hooks.useHeaderBehavior(8).transform, "data-angel": hooks.useHeaderBehavior(9).transform });
  }
  const markup = renderToStaticMarkup(React.createElement(hooks.HeaderBehaviorProvider, { phase: "night", active: false, tall: true, actorIndices: indices, children: React.createElement(Probe) }));
  assert.match(markup, /data-pink="translate\(700 530\)"/);
  assert.match(markup, /data-angel="translate\(160 260\)"/);
});
