import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const pageSource = readFileSync(new URL("../src/boss-timer-app.tsx", import.meta.url), "utf8");
const componentSource = pageSource.slice(pageSource.indexOf("export function AlertKindStatus"), pageSource.indexOf("export function UpcomingBossRoute"));
const javascript = ts.transpileModule(componentSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
const moduleValue = { exports: {} as Record<string, React.ComponentType<{ kinds?: ("MVP" | "Mini")[] }>> };
vm.runInNewContext(javascript, { module: moduleValue, exports: moduleValue.exports, require: createRequire(import.meta.url) });

test("notification center displays the server's exact enabled reminder kinds", () => {
  for (const kinds of [[], ["Mini"], ["MVP"], ["MVP", "Mini"]] as ("MVP" | "Mini")[][]) {
    const markup = renderToStaticMarkup(React.createElement(moduleValue.exports.AlertKindStatus, { kinds }));
    assert.match(markup, /aria-label="目前提醒類型"/);
    assert.ok(markup.includes(`MVP 通知${kinds.includes("MVP") ? "已啟用" : "已關閉"}`));
    assert.ok(markup.includes(`Mini 通知${kinds.includes("Mini") ? "已啟用" : "已關閉"}`));
  }
  assert.match(pageSource, /<AlertKindStatus kinds=\{data\?\.push\.alertKinds\} \/>/);
});

test("legacy responses do not invent a notification policy or change stored state", () => {
  assert.equal(renderToStaticMarkup(React.createElement(moduleValue.exports.AlertKindStatus, {})), "");
  const kinds = Object.freeze(["Mini"]);
  const before = JSON.stringify(kinds);
  renderToStaticMarkup(React.createElement(moduleValue.exports.AlertKindStatus, { kinds: kinds as ("MVP" | "Mini")[] }));
  assert.equal(JSON.stringify(kinds), before);
  assert.doesNotMatch(componentSource, /fetch|apiFetch|localStorage|subscribe|setState/);
});
