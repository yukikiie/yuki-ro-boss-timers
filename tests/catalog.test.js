import test from "node:test";
import assert from "node:assert/strict";
import { bossCatalog, bossDetails, sortBossesByRespawn, sortBossesForDisplay } from "../lib/boss-catalog.js";

test("catalog contains the eighteen confirmed compact metadata records", () => {
  assert.deepEqual(bossCatalog.map(({ id, name, kind, size, element, race, spriteIndex, favorite }) => [id, name, kind, size, element, race, spriteIndex, favorite]), [
    ["atroce", "阿特羅斯", "MVP", "大", "暗", "動物", 0, true],
    ["lady-tanee", "嗒妮小姐", "MVP", "小", "風", "植物", 1, true],
    ["boitata", "波伊塔塔", "Mini", "中", "火", "動物", 2, true],
    ["wandering-samurai", "漂流浪人", "Mini", "中", "無", "人形", 3, true],
    ["dark-elementalist", "暗・元素使", "Mini", "小", "念", "不死", 4, false],
    ["naght-sieger", "納戶特基格", "Mini", "大", "念", "惡魔", 5, false],
    ["coelacanth", "腔棘魚", "Mini", "大", "水", "魚貝", 6, false],
    ["dark-ranger", "暗・遊俠", "Mini", "小", "風", "人形", 7, false],
    ["death-knight", "死靈騎士", "MVP", "大", "暗", "惡魔", 8, false],
    ["fallen-bishop", "墮落大神官希巴姆", "MVP", "中", "暗", "惡魔", 9, false],
    ["tao-gunka", "塔奧群卡", "MVP", "大", "無", "惡魔", 10, false],
    ["ice-dragon", "寒冰龍", "Mini", "大", "水", "龍", 11, false],
    ["restful", "安息者", "Mini", "中", "聖", "天使", 12, false],
    ["chimera", "凱美拉", "Mini", "大", "火", "動物", 13, false],
    ["holy-angel-poring", "聖天使波利", "MVP", "中", "聖", "天使", 14, false],
    ["morocc", "夢羅克", "MVP", "大", "暗", "惡魔", 15, false],
    ["shadow-demon", "影魔", "MVP", "大", "念", "無形", 16, false],
    ["orc-hero", "獸人英雄", "MVP", "大", "地", "人形", 17, false],
  ]);
  assert.equal(new Set(bossCatalog.map((boss) => boss.id)).size, 18);
  assert.equal(new Set(bossCatalog.map((boss) => boss.spriteIndex)).size, 18);
  assert.equal(bossCatalog.filter((boss) => boss.favorite).length, 4);
});

test("live custom IDs resolve the new MVP portraits by their exact normalized names", () => {
  const shadowDemon = bossDetails({ id: "custom-live-shadow", name: " 影 魔 " });
  const orcHero = bossDetails({ id: "custom-live-orc", name: " 獸人英雄 " });
  assert.equal(shadowDemon, bossCatalog[16]);
  assert.equal(orcHero, bossCatalog[17]);
  assert.equal(shadowDemon.spriteIndex, 16);
  assert.equal(orcHero.spriteIndex, 17);
});

test("MVP-first catalog display includes both appended MVPs before all Minis", () => {
  const ordered = sortBossesForDisplay(bossCatalog);
  assert.deepEqual(ordered.slice(0, 9).map((boss) => boss.id), [
    "atroce", "lady-tanee", "death-knight", "fallen-bishop", "tao-gunka", "holy-angel-poring", "morocc", "shadow-demon", "orc-hero",
  ]);
  assert.ok(ordered.slice(0, 9).every((boss) => boss.kind === "MVP"));
  assert.ok(ordered.slice(9).every((boss) => boss.kind === "Mini"));
  assert.equal(ordered.length, 18);
});

test("metadata uses exact known id first and exact normalized names as fallback", () => {
  assert.equal(bossDetails({ id: "atroce", name: "Unknown" }), bossCatalog[0]);
  assert.equal(bossDetails({ id: "custom-existing", name: " 腔棘魚 " }), bossCatalog[6]);
  assert.equal(bossDetails({ name: "墮落大神官希巴姆" }), bossCatalog[9]);
  for (const entry of bossCatalog.slice(11)) {
    assert.equal(bossDetails({ id: entry.id }), entry);
    assert.equal(bossDetails({ id: `custom-${entry.id}`, name: entry.name }), entry);
  }
  for (const name of ["暗・元素使", "暗·元素使", "暗．元素使", " 暗 ・ 元素使 ", "暗\u3000·\u3000元素使"]) {
    assert.equal(bossDetails({ name }), bossCatalog[4]);
  }
  for (const name of ["暗・遊俠", "暗·遊俠", "暗．遊俠", " 暗 ・ 遊俠 "]) {
    assert.equal(bossDetails({ name }), bossCatalog[7]);
  }
});

test("unknown custom bosses never receive invented metadata", () => {
  for (const boss of [null, undefined, "atroce", {}, { id: "custom-unknown", name: "自訂 Boss" }, { name: "阿特羅斯王" }, { name: "元素使" }, { name: "暗元素使" }]) {
    assert.equal(bossDetails(boss), null);
  }
});

test("catalog metadata cannot be mutated through lookup results", () => {
  assert.ok(Object.isFrozen(bossCatalog));
  assert.ok(bossCatalog.every(Object.isFrozen));
  assert.throws(() => { bossDetails({ id: "atroce" }).race = "人形"; }, TypeError);
  assert.equal(bossDetails({ id: "atroce" }).race, "動物");
});

test("respawn ordering puts the earliest mixed Mini or MVP first regardless of favorites", () => {
  const bosses = [
    { id: "mvp-later", kind: "MVP", status: "counting", dueAt: 1_200, favorite: true },
    { id: "mini-earliest", kind: "Mini", status: "counting", dueAt: 300, favorite: false },
    { id: "mvp-due", kind: "MVP", status: "due", dueAt: 600, favorite: false },
  ];
  assert.deepEqual(sortBossesByRespawn(bosses).map((boss) => boss.id), ["mini-earliest", "mvp-due", "mvp-later"]);
});

test("respawn ties use favorite only as tie-breaker then preserve original order", () => {
  const bosses = [
    { id: "mini-first", kind: "Mini", status: "counting", dueAt: 600, favorite: false },
    { id: "mvp-favorite", kind: "MVP", status: "counting", dueAt: 600, favorite: true },
    { id: "mini-favorite", kind: "Mini", status: "due", dueAt: 600, favorite: true },
    { id: "mvp-last", kind: "MVP", status: "due", dueAt: 600, favorite: false },
  ];
  assert.deepEqual(sortBossesByRespawn(bosses).map((boss) => boss.id), ["mvp-favorite", "mini-favorite", "mini-first", "mvp-last"]);
});

test("unknown, resting, paused and invalid countdowns sort below valid timers", () => {
  const inactive = [
    { id: "unknown", status: "unknown", dueAt: 0 },
    { id: "resting", status: "resting", dueAt: 0 },
    { id: "paused", status: "paused", dueAt: 0 },
    ...[null, undefined, NaN, Infinity, -1, 1.5, "1", 8_640_000_000_000_001].map((dueAt, index) => ({ id: `invalid-${index}`, status: "counting", dueAt })),
  ];
  const active = { id: "valid-zero", status: "due", dueAt: 0 };
  assert.deepEqual(sortBossesByRespawn([...inactive, active]), [active, ...inactive]);
  assert.deepEqual(sortBossesByRespawn(undefined), []);
});

test("respawn ordering is immutable and retains duplicate records without deduplication", () => {
  const duplicate = Object.freeze({ id: "same", status: "counting", dueAt: 300, favorite: false });
  const later = Object.freeze({ id: "later", status: "counting", dueAt: 900, favorite: false });
  const bosses = Object.freeze([later, duplicate, duplicate]);
  const ordered = sortBossesByRespawn(bosses);
  assert.deepEqual(ordered, [duplicate, duplicate, later]);
  assert.deepEqual(bosses, [later, duplicate, duplicate]);
  assert.notEqual(ordered, bosses);
  assert.equal(ordered[0], duplicate);
  assert.equal(ordered[1], duplicate);
});

test("display groups all MVPs before Minis and keeps respawn order inside each group", () => {
  const bosses = [
    { id: "mini-first", kind: "Mini", status: "counting", dueAt: 100 },
    { id: "mvp-unknown", kind: "MVP", status: "unknown", dueAt: null },
    { id: "mini-later", kind: "Mini", status: "counting", dueAt: 300 },
    { id: "mvp-later", kind: "MVP", status: "counting", dueAt: 900 },
    { id: "mvp-first", kind: "MVP", status: "counting", dueAt: 600 },
    { id: "mini-unknown", kind: "Mini", status: "unknown", dueAt: null },
  ];
  assert.deepEqual(sortBossesForDisplay(bosses).map((boss) => boss.id), ["mvp-first", "mvp-later", "mvp-unknown", "mini-first", "mini-later", "mini-unknown"]);
  assert.equal(sortBossesByRespawn(bosses)[0].id, "mini-first");
  assert.equal(bosses[0].id, "mini-first");
});

test("display grouping preserves favorites as time tie-breakers, duplicates and empty input", () => {
  const duplicate = Object.freeze({ id: "duplicate", kind: "Mini", status: "counting", dueAt: 100 });
  const bosses = Object.freeze([
    duplicate,
    Object.freeze({ id: "mvp-normal", kind: "MVP", status: "counting", dueAt: 900, favorite: false }),
    Object.freeze({ id: "mvp-favorite", kind: "MVP", status: "counting", dueAt: 900, favorite: true }),
    duplicate,
  ]);
  assert.deepEqual(sortBossesForDisplay(bosses).map((boss) => boss.id), ["mvp-favorite", "mvp-normal", "duplicate", "duplicate"]);
  assert.equal(bosses[0], duplicate);
  assert.deepEqual(sortBossesForDisplay(null), []);
});
