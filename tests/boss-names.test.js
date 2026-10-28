import test from "node:test";
import assert from "node:assert/strict";
import { bossNameRegistry, bossDisplayName, bossCanonicalName, resolveBossName } from "../lib/boss-names.js";

const expectedNames = [
  ["lady-tanee", "嗒妮小姐", "妮小姐"],
  ["fallen-bishop", "墮落大神官希巴姆", "大神官"],
  ["death-knight", "死靈騎士", "47"],
  ["tao-gunka", "塔奧群卡", "塔奧"],
  ["custom-5qip79", "暗・逐影", "逐影"],
  ["boitata", "波伊塔塔", "波波塔塔"],
  ["naght-sieger", "納戶特基格", "光頭"],
  ["dark-elementalist", "暗・元素使", "元素"],
  ["dark-ranger", "暗・遊俠", "遊俠"],
  ["custom-1hb3imu", "暗・基因學者", "基因"],
  ["custom-1xgl1sj", "代行刑者", "代行"],
  ["custom-1hknmq6", "尼德豪克的影子", "影龍"],
  ["custom-1gjisbs", "皮里恩", "皮皮"],
];

test("the registry contains exactly the thirteen approved personal shortcuts and official identities", () => {
  assert.deepEqual(bossNameRegistry.map(({ id, name, displayName }) => [id, name, displayName]), expectedNames);
  for (const entry of bossNameRegistry) {
    assert.deepEqual(entry.aliases, [entry.displayName]);
    assert.deepEqual(Object.keys(entry), ["id", "name", "displayName", "aliases"]);
  }
});

test("IDs, complete official names and explicit shortcuts resolve to the same frozen entry", () => {
  for (const entry of bossNameRegistry) {
    for (const input of [entry.id, entry.name, entry.displayName, ...entry.aliases]) {
      assert.equal(resolveBossName(input), entry);
      assert.equal(bossDisplayName({ name: input }), entry.displayName);
      assert.equal(bossCanonicalName({ name: input }), entry.name);
    }
  }
});

test("exact lookup normalizes Unicode, case, middle-dot variants and whitespace without fuzzy matching", () => {
  const elementalist = resolveBossName("dark-elementalist");
  for (const input of [" 暗 ・ 元素使 ", "暗·元素使", "暗．元素使", "暗.元素使", "暗\u3000·\u3000元素使", " ＤＡＲＫ－ＥＬＥＭＥＮＴＡＬＩＳＴ "]) {
    assert.equal(resolveBossName(input), elementalist);
  }
  assert.equal(resolveBossName(" DARK-RANGER ").id, "dark-ranger");
  assert.equal(resolveBossName("暗·逐影").id, "custom-5qip79");
  assert.equal(resolveBossName(" 暗．遊俠 ").id, "dark-ranger");
  assert.equal(resolveBossName("４７").id, "death-knight");
  for (const input of ["暗元素使", "暗遊俠", "暗逐影", "小姐", "妮", "大神", "群卡", "頭", "波波", "047", "47號", "47秒", "第47隻", "47.0", "death", "dark", "custom-5qip79-extra"]) {
    assert.equal(resolveBossName(input), null, input);
  }
  for (const input of [null, undefined, 47, NaN, {}, [], "", "   "]) assert.equal(resolveBossName(input), null);
});

test("a registered stable ID takes priority over conflicting full names or shortcuts", () => {
  for (const entry of bossNameRegistry) {
    const conflictingName = entry.id === "death-knight" ? "妮小姐" : "47";
    assert.equal(bossDisplayName({ id: entry.id, name: conflictingName }), entry.displayName);
    assert.equal(bossCanonicalName({ id: entry.id, name: conflictingName }), entry.name);
    assert.equal(bossDisplayName({ id: entry.id.toUpperCase(), name: "Unknown" }), entry.displayName);
    assert.equal(bossCanonicalName({ id: entry.id }), entry.name);
  }
});

test("the saved geneticist ID, approved shortcut and normalized full name preserve its official identity", () => {
  const entry = resolveBossName("custom-1hb3imu");
  for (const input of ["基因", "暗・基因學者", "暗·基因學者", "暗．基因學者", " 暗 . 基因學者 ", " ＣＵＳＴＯＭ－１ＨＢ３ＩＭＵ "]) {
    assert.equal(resolveBossName(input), entry);
    assert.equal(bossDisplayName({ name: input }), "基因");
    assert.equal(bossCanonicalName({ name: input }), "暗・基因學者");
  }
  assert.equal(bossCanonicalName({ id: "custom-1hb3imu", name: "47" }), "暗・基因學者");
  assert.equal(bossDisplayName({ id: "death-knight", name: "基因" }), "47");
  for (const input of ["基因學者", "暗基因學者", "基因王", "小基因", "暗・基因", "custom-1hb3imu-extra"]) {
    assert.equal(resolveBossName(input), null, input);
  }
});

test("unknown custom names remain exactly as entered instead of receiving invented aliases", () => {
  for (const name of [" 自訂  Boss ", "獸牙怪", "亡靈巫師", "殭屍龍", "阿特羅斯", "暗逐影", "47號", "波伊塔塔王"]) {
    const boss = { id: "custom-unregistered", name };
    assert.equal(bossDisplayName(boss), name);
    assert.equal(bossCanonicalName(boss), name);
  }
  for (const boss of [null, undefined, {}, { id: "custom-unregistered" }, { name: null }, { name: 47 }]) {
    assert.equal(bossDisplayName(boss), "");
    assert.equal(bossCanonicalName(boss), "");
  }
});

test("executioner and shadow dragon keep their saved shortcuts and resolve only complete approved identities", () => {
  for (const [id, name, displayName] of expectedNames.slice(10, 12)) {
    const entry = resolveBossName(id);
    for (const input of [id, name, displayName, ` ${name.split("").join(" ")} `]) {
      assert.equal(resolveBossName(input), entry);
      assert.equal(bossDisplayName({ name: input }), displayName);
      assert.equal(bossCanonicalName({ name: input }), name);
    }
    assert.equal(bossCanonicalName({ id, name: "47" }), name);
  }
  for (const input of ["代", "代行者", "代行刑", "代行王", "尼德豪克", "影", "影龍王", "影龍的影子", "Nidhogg", "custom-1xgl1sj-extra", "custom-1hknmq6-extra"]) assert.equal(resolveBossName(input), null, input);
  assert.equal(bossDisplayName({ id: "custom-1xgl1sj", name: "影龍" }), "代行");
  assert.equal(bossDisplayName({ id: "custom-1hknmq6", name: "代行" }), "影龍");
});

test("the saved Phreeoni shortcut resolves only its exact canonical name and stable identity", () => {
  const entry = resolveBossName("custom-1gjisbs");
  assert.deepEqual(entry, { id: "custom-1gjisbs", name: "皮里恩", displayName: "皮皮", aliases: ["皮皮"] });
  for (const input of ["皮皮", "皮里恩", " 皮 里 恩 ", " ＣＵＳＴＯＭ－１ＧＪＩＳＢＳ "]) {
    assert.equal(resolveBossName(input), entry);
    assert.equal(bossDisplayName({ name: input }), "皮皮");
    assert.equal(bossCanonicalName({ name: input }), "皮里恩");
  }
  assert.equal(bossDisplayName({ id: "custom-1gjisbs", name: "47" }), "皮皮");
  assert.equal(bossCanonicalName({ id: "death-knight", name: "皮皮" }), "死靈騎士");
  for (const input of ["皮", "皮皮王", "皮里恩王", "皮利恩", "Phreeoni", "1159", "custom-1gjisbs-extra"]) assert.equal(resolveBossName(input), null, input);
});

test("registry entries and nested aliases cannot be mutated through lookup results", () => {
  assert.ok(Object.isFrozen(bossNameRegistry));
  for (const entry of bossNameRegistry) {
    assert.ok(Object.isFrozen(entry));
    assert.ok(Object.isFrozen(entry.aliases));
    assert.throws(() => { resolveBossName(entry.id).name = "changed"; }, TypeError);
    assert.throws(() => { resolveBossName(entry.id).aliases.push("unapproved"); }, TypeError);
  }
  assert.throws(() => { bossNameRegistry.push({}); }, TypeError);
});

test("display and canonical lookups leave saved identity and every timer field untouched", () => {
  for (const [id, name, displayName] of expectedNames) {
    const boss = Object.freeze({ id, name, kind: "Mini", favorite: true, status: "counting", dueAt: 1792760400000, observedAt: 1792756800000, cycle: "2026-10-23", source: "manual", respawnMinutes: 120 });
    const before = JSON.stringify(boss);
    assert.equal(bossDisplayName(boss), displayName);
    assert.equal(bossCanonicalName(boss), name);
    assert.equal(resolveBossName(displayName).id, id);
    assert.equal(JSON.stringify(boss), before);
  }
});

test("normalized names and IDs do not collide across registry identities", () => {
  const identities = new Map();
  for (const entry of bossNameRegistry) {
    for (const input of [entry.id, entry.name, ...entry.aliases]) {
      const key = input.normalize("NFKC").toLowerCase().replace(/[・·.]/g, "・").replace(/\s+/g, "");
      assert.ok(!identities.has(key) || identities.get(key) === entry.id, input);
      identities.set(key, entry.id);
    }
  }
});
