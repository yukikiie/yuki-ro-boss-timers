import test from "node:test";
import assert from "node:assert/strict";
import { bossCatalog, bossDetails, sortBossesByRespawn, sortBossesForDisplay } from "../lib/boss-catalog.js";
import { defaultBosses } from "../lib/timers.js";

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

test("untimed catalog display includes both appended MVPs before all Minis", () => {
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

test("only the approved personal shortcuts resolve existing metadata without changing saved names", () => {
  const shortcuts = [["妮小姐", "lady-tanee"], ["大神官", "fallen-bishop"], ["47", "death-knight"], ["塔奧", "tao-gunka"], ["波波塔塔", "boitata"], ["光頭", "naght-sieger"], ["元素", "dark-elementalist"], ["遊俠", "dark-ranger"]];
  for (const [name, id] of shortcuts) {
    const boss = Object.freeze({ id: "custom-shortcut-fixture", name, dueAt: 1792760400000, observedAt: 1792756800000, status: "counting" });
    const before = JSON.stringify(boss);
    assert.equal(bossDetails(boss), bossCatalog.find(entry => entry.id === id));
    assert.equal(JSON.stringify(boss), before);
  }
  assert.equal(bossDetails({ id: "atroce", name: "47" }), bossCatalog[0]);
  for (const name of ["逐影", "047", "47號", "47秒", "大神官王", "波波", "暗遊俠", "元素使", "暗元素使"]) assert.equal(bossDetails({ name }), null);
});

test("catalog metadata cannot be mutated through lookup results", () => {
  assert.ok(Object.isFrozen(bossCatalog));
  assert.ok(bossCatalog.every(Object.isFrozen));
  assert.throws(() => { bossDetails({ id: "atroce" }).race = "人形"; }, TypeError);
  assert.equal(bossDetails({ id: "atroce" }).race, "動物");
});

test("the exact saved Tirfing ID resolves verified metadata without inventing a sprite or new stats", () => {
  const details = bossDetails({ id: "custom-qinmln" });
  assert.deepEqual(details, { id: "custom-qinmln", name: "獸牙怪", kind: "Mini", size: "中", element: "暗", race: "無形" });
  assert.equal(Object.hasOwn(details, "spriteIndex"), false);
  assert.equal(Object.hasOwn(details, "favorite"), false);
  assert.equal(Object.hasOwn(details, "level"), false);
  assert.equal(Object.hasOwn(details, "respawnMinutes"), false);
  assert.ok(Object.isFrozen(details));
  assert.throws(() => { details.size = "大"; }, TypeError);
  assert.equal(bossDetails({ id: "custom-qinmln", name: "影魔" }), details);
  assert.equal(bossDetails({ id: "atroce", name: "獸牙怪" }), bossCatalog[0]);
});

test("only normalized full traditional or simplified Tirfing names receive its metadata", () => {
  const details = bossDetails({ id: "custom-qinmln" });
  for (const name of ["獸牙怪", "兽牙怪", " 獸 牙 怪 ", "兽\u3000牙\u3000怪"]) {
    assert.equal(bossDetails({ id: "custom-another-tirfing", name }), details);
  }
  for (const name of ["獸牙", "兽牙", "牙怪", "獸牙怪王", "小獸牙怪", "獸・牙怪", "TIRFING", "1204"]) {
    assert.equal(bossDetails({ id: "custom-unrelated", name }), null);
  }
  assert.equal(bossDetails({ id: "1204" }), null);
  assert.equal(bossDetails({ id: "custom-qinmln-extra" }), null);
});

test("Tirfing lookup does not add default records or mutate a saved timer", () => {
  const timestamp = Date.UTC(2026, 9, 23, 4);
  const defaults = defaultBosses(timestamp);
  assert.equal(bossCatalog.length, 18);
  assert.equal(defaults.length, 18);
  assert.equal(bossCatalog.some(boss => boss.id === "custom-qinmln" || boss.name === "獸牙怪"), false);
  assert.equal(defaults.some(boss => boss.id === "custom-qinmln"), false);
  const boss = Object.freeze({ id: "custom-qinmln", name: "獸牙怪", kind: "Mini", favorite: true, status: "counting", dueAt: timestamp + 3600000, observedAt: timestamp, source: "manual", cycle: "2026-10-23", respawnMinutes: 120 });
  const before = JSON.stringify(boss);
  bossDetails(boss);
  assert.equal(JSON.stringify(boss), before);
  assert.equal(bossDetails(boss).race, "無形");
});

test("the saved geneticist ID resolves only verified compact metadata without replacing existing identities", () => {
  const details = bossDetails({ id: "custom-1hb3imu", name: "基因" });
  assert.deepEqual(details, { id: "custom-1hb3imu", name: "暗・基因學者", kind: "MVP", size: "中", element: "火", race: "人形" });
  for (const field of ["spriteIndex", "favorite", "level", "respawnMinutes"]) assert.equal(Object.hasOwn(details, field), false);
  assert.ok(Object.isFrozen(details));
  assert.throws(() => { details.element = "暗"; }, TypeError);
  assert.equal(bossDetails({ id: "custom-1hb3imu", name: "影魔" }), details);
  assert.equal(bossDetails({ id: "atroce", name: "基因" }), bossCatalog[0]);
  assert.equal(bossDetails({ id: "custom-qinmln", name: "基因" }).name, "獸牙怪");
});

test("geneticist metadata accepts its approved shortcut and exact normalized full name, not partial guesses", () => {
  const details = bossDetails({ id: "custom-1hb3imu" });
  for (const name of ["基因", " 暗 ・ 基因學者 ", "暗·基因學者", "暗．基因學者", "暗.基因學者"]) {
    assert.equal(bossDetails({ id: "custom-geneticist-fixture", name }), details);
  }
  for (const name of ["基因學者", "暗基因學者", "基因王", "小基因", "暗・基因", "Geneticist", "140"]) {
    assert.equal(bossDetails({ id: "custom-unrelated", name }), null, name);
  }
  assert.equal(bossDetails({ id: "custom-1hb3imu-extra" }), null);
});

test("geneticist metadata leaves all eighteen defaults and the saved custom timer unchanged", () => {
  const timestamp = Date.UTC(2026, 9, 24, 4);
  const defaults = defaultBosses(timestamp);
  assert.equal(bossCatalog.length, 18);
  assert.equal(defaults.length, 18);
  assert.equal(bossCatalog.some(boss => boss.id === "custom-1hb3imu" || boss.name === "暗・基因學者"), false);
  assert.equal(defaults.some(boss => boss.id === "custom-1hb3imu"), false);
  const boss = Object.freeze({ id: "custom-1hb3imu", name: "基因", kind: "MVP", favorite: false, status: "counting", dueAt: timestamp + 3600000, observedAt: timestamp, source: "manual", cycle: "2026-10-24", respawnMinutes: 120 });
  const before = JSON.stringify(boss);
  assert.equal(bossDetails(boss).name, "暗・基因學者");
  assert.equal(JSON.stringify(boss), before);
});

test("saved executioner and shadow dragon identities resolve verified metadata while preserving all timer fields", () => {
  const timestamp = Date.UTC(2026, 9, 27, 4);
  const defaults = defaultBosses(timestamp);
  const defaultsSnapshot = JSON.stringify(defaults);
  const expected = [
    { id: "custom-1xgl1sj", name: "代行刑者", kind: "MVP", size: "中", element: "暗", race: "天使" },
    { id: "custom-1hknmq6", name: "尼德豪克的影子", kind: "MVP", size: "大", element: "暗", race: "龍" },
  ];
  for (const [index, record] of expected.entries()) {
    const shortcut = index === 0 ? "代行" : "影龍";
    const details = bossDetails({ id: record.id, name: shortcut });
    assert.deepEqual(details, record);
    assert.ok(Object.isFrozen(details));
    assert.throws(() => { details.size = "小"; }, TypeError);
    for (const field of ["spriteIndex", "favorite", "level", "respawnMinutes"]) assert.equal(Object.hasOwn(details, field), false);
    for (const name of [shortcut, record.name, ` ${record.name.split("").join(" ")} `]) assert.equal(bossDetails({ id: "custom-fixture", name }), details);
    assert.equal(bossDetails({ id: record.id, name: expected[1 - index].name }), details);
    assert.equal(bossDetails({ id: "atroce", name: shortcut }), bossCatalog[0]);
    const saved = Object.freeze({ id: record.id, name: shortcut, kind: "MVP", status: "counting", dueAt: timestamp + (index + 1) * 3600000, observedAt: timestamp, source: "manual", favorite: true, cycle: "2026-10-27", respawnMinutes: 180 });
    const before = JSON.stringify(saved);
    assert.equal(bossDetails(saved), details);
    assert.equal(JSON.stringify(saved), before);
    assert.equal(defaults.some(boss => boss.id === record.id), false);
    assert.equal(bossCatalog.some(boss => boss.id === record.id), false);
  }
  for (const name of ["代行者", "代行王", "代行刑", "尼德豪克", "影龍王", "影", "影龍的影子"]) assert.equal(bossDetails({ name }), null, name);
  assert.equal(bossCatalog.length, 18);
  assert.equal(defaults.length, 18);
  assert.equal(JSON.stringify(defaultBosses(timestamp)), defaultsSnapshot);
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

test("display puts timed Minis above later and untimed MVPs in global respawn order", () => {
  const bosses = [
    { id: "mini-first", kind: "Mini", status: "counting", dueAt: 100 },
    { id: "mvp-unknown", kind: "MVP", status: "unknown", dueAt: null, favorite: true },
    { id: "mini-later", kind: "Mini", status: "counting", dueAt: 300 },
    { id: "mvp-later", kind: "MVP", status: "counting", dueAt: 900, favorite: true },
    { id: "mvp-first", kind: "MVP", status: "due", dueAt: 600 },
    { id: "mini-unknown", kind: "Mini", status: "unknown", dueAt: null },
  ];
  assert.deepEqual(sortBossesForDisplay(bosses).map((boss) => boss.id), ["mini-first", "mini-later", "mvp-first", "mvp-later", "mvp-unknown", "mini-unknown"]);
  assert.equal(sortBossesByRespawn(bosses)[0].id, "mini-first");
  assert.equal(bosses[0].id, "mini-first");
});

test("display ordering is immutable and retains duplicate references", () => {
  const duplicate = Object.freeze({ id: "duplicate", kind: "Mini", status: "counting", dueAt: 100 });
  const bosses = Object.freeze([
    duplicate,
    Object.freeze({ id: "mvp-normal", kind: "MVP", status: "counting", dueAt: 900, favorite: false }),
    Object.freeze({ id: "mvp-favorite", kind: "MVP", status: "counting", dueAt: 900, favorite: true }),
    duplicate,
  ]);
  const ordered = sortBossesForDisplay(bosses);
  assert.deepEqual(ordered.map((boss) => boss.id), ["duplicate", "duplicate", "mvp-favorite", "mvp-normal"]);
  assert.notEqual(ordered, bosses);
  assert.equal(ordered[0], duplicate);
  assert.equal(ordered[1], duplicate);
  assert.equal(bosses[0], duplicate);
  assert.equal(bosses[1].id, "mvp-normal");
  assert.equal(bosses[2].id, "mvp-favorite");
  assert.equal(bosses[3], duplicate);
});

test("display time ties put MVP before Mini, then favorites, then stable input order", () => {
  const bosses = [
    { id: "mini-normal-first", kind: "Mini", status: "counting", dueAt: 600, favorite: false },
    { id: "mvp-normal-first", kind: "MVP", status: "counting", dueAt: 600, favorite: false },
    { id: "mini-favorite", kind: "Mini", status: "due", dueAt: 600, favorite: true },
    { id: "mvp-favorite", kind: "MVP", status: "due", dueAt: 600, favorite: true },
    { id: "mvp-normal-last", kind: "MVP", status: "counting", dueAt: 600, favorite: false },
    { id: "mini-normal-last", kind: "Mini", status: "counting", dueAt: 600, favorite: false },
  ];
  assert.deepEqual(sortBossesForDisplay(bosses).map((boss) => boss.id), [
    "mvp-favorite", "mvp-normal-first", "mvp-normal-last", "mini-favorite", "mini-normal-first", "mini-normal-last",
  ]);
});

test("display puts inactive and invalid timers last with MVP, favorite and stable ties", () => {
  const invalid = [null, undefined, NaN, Infinity, -1, 1.5, "1", 8_640_000_000_000_001]
    .map((dueAt, index) => ({ id: `invalid-${index}`, kind: "MVP", status: "counting", dueAt }));
  const bosses = [
    { id: "mini-unknown", kind: "Mini", status: "unknown", dueAt: 0, favorite: true },
    { id: "mvp-resting", kind: "MVP", status: "resting", dueAt: 0 },
    ...invalid,
    { id: "mini-paused", kind: "Mini", status: "paused", dueAt: 0 },
    { id: "mvp-unknown-favorite", kind: "MVP", status: "unknown", dueAt: 0, favorite: true },
    { id: "active-mini", kind: "Mini", status: "due", dueAt: 0 },
    { id: "active-mvp", kind: "MVP", status: "counting", dueAt: 8_640_000_000_000_000 },
  ];
  assert.deepEqual(sortBossesForDisplay(bosses).map((boss) => boss.id), [
    "active-mini", "active-mvp", "mvp-unknown-favorite", "mvp-resting", ...invalid.map((boss) => boss.id), "mini-unknown", "mini-paused",
  ]);
});

test("display ordering safely accepts empty and non-array input", () => {
  assert.deepEqual(sortBossesForDisplay([]), []);
  assert.deepEqual(sortBossesForDisplay(null), []);
  assert.deepEqual(sortBossesForDisplay(undefined), []);
  assert.deepEqual(sortBossesForDisplay({}), []);
});
