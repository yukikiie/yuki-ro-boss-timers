import test from "node:test";
import assert from "node:assert/strict";
import { defaultBosses, normalizeBosses, reminderCandidates, scheduleAt, upcomingBosses, updateBoss } from "../lib/timers.js";
import { bossDetails } from "../lib/boss-catalog.js";

const at = (time) => Date.parse(time);
const noon = at("2026-10-18T12:00:00+08:00");
const countdown = (bosses, bossId, seconds, now = noon) => updateBoss(bosses, { type: "countdown", bossId, seconds }, now);

test("HKT is UTC+8 and game time is one hour behind HKT", () => {
  const gameFour = at("2026-10-18T05:00:00+08:00");
  assert.equal(gameFour, at("2026-10-17T21:00:00Z"));
  assert.equal(scheduleAt(gameFour).cycle, "2026-10-18");
  assert.equal(scheduleAt(gameFour - 1).cycle, "2026-10-17");
});

test("rest starts exactly03:00 HKT and ends exactly05:00", () => {
  const rest = at("2026-10-18T03:00:00+08:00");
  const reset = at("2026-10-18T05:00:00+08:00");
  assert.equal(scheduleAt(rest - 1).resting, false);
  assert.equal(scheduleAt(rest).resting, true);
  assert.equal(scheduleAt(reset - 1).resting, true);
  assert.equal(scheduleAt(reset).resting, false);
  assert.equal(scheduleAt(rest).restStart, rest);
  assert.equal(scheduleAt(rest).nextReset, reset);
});

test("next reset and rest use the current05:00–05:00 cycle", () => {
  const schedule = scheduleAt(noon);
  assert.equal(schedule.cycle, "2026-10-18");
  assert.equal(schedule.nextReset, at("2026-10-19T05:00:00+08:00"));
  assert.equal(schedule.restStart, at("2026-10-19T03:00:00+08:00"));
  assert.equal(scheduleAt(at("2026-01-01T01:00:00+08:00")).cycle, "2025-12-31");
});

test("invalid clocks fail explicitly", () => {
  for (const now of [NaN, Infinity, -1, 1.2, "123"]) assert.throws(() => scheduleAt(now));
});

test("eighteen defaults keep four favorite mains first and start without fake due times", () => {
  const bosses = defaultBosses(noon);
  assert.equal(bosses.length, 18);
  assert.deepEqual(bosses.slice(0, 4).map((boss) => [boss.id, boss.name]), [["atroce", "阿特羅斯"], ["lady-tanee", "嗒妮小姐"], ["boitata", "波伊塔塔"], ["wandering-samurai", "漂流浪人"]]);
  assert.deepEqual(bosses.map((boss) => boss.respawnMinutes), [180, 180, 120, 120, 120, 120, 120, 120, 180, 180, 180, 120, 120, 120, 180, 180, 180, 180]);
  assert.deepEqual(bosses.slice(16).map((boss) => [boss.id, boss.name, boss.kind]), [["shadow-demon", "影魔", "MVP"], ["orc-hero", "獸人英雄", "MVP"]]);
  assert.equal(bosses.filter((boss) => boss.favorite).length, 4);
  assert.ok(bosses.slice(0, 4).every((boss) => boss.favorite));
  assert.ok(bosses.slice(4).every((boss) => !boss.favorite));
  assert.ok(bosses.every((boss) => boss.status === "unknown" && boss.dueAt === null && boss.source === null));
  assert.deepEqual(reminderCandidates(bosses, noon), []);
});

test("reading existing boss lists never adds missing defaults or restores removed bosses", () => {
  const initial = countdown(defaultBosses(noon).slice(0, 4), "atroce", 600);
  const existing = initial.filter((boss) => boss.id !== "lady-tanee");
  const before = JSON.stringify(existing);
  const normalized = normalizeBosses(existing, noon + 1_000);
  assert.deepEqual(normalized.map((boss) => boss.id), ["atroce", "boitata", "wandering-samurai"]);
  assert.equal(normalized[0].dueAt, noon + 600_000);
  assert.equal(JSON.stringify(existing), before);
  assert.deepEqual(normalizeBosses([], noon), []);
  for (const previousCount of [11, 16]) {
    const previousDefaults = defaultBosses(noon).slice(0, previousCount);
    assert.deepEqual(normalizeBosses(previousDefaults, noon), previousDefaults);
  }
});

test("explicitly adding the two new MVPs preserves existing live custom IDs and unrelated timers", () => {
  const previousRoster = countdown(defaultBosses(noon).slice(0, 16), "atroce", 600);
  const before = JSON.stringify(previousRoster);
  assert.deepEqual(normalizeBosses(previousRoster, noon), previousRoster);
  let bosses = previousRoster;
  for (const [name, spriteIndex] of [["影魔", 16], ["獸人英雄", 17]]) {
    bosses = updateBoss(bosses, { type: "add", name, kind: "MVP" }, noon);
    const added = bosses.at(-1);
    assert.match(added.id, /^custom-/);
    assert.equal(added.name, name);
    assert.equal(added.respawnMinutes, 180);
    assert.equal(added.favorite, false);
    assert.equal(added.status, "unknown");
    assert.equal(added.dueAt, null);
    assert.equal(bossDetails(added).spriteIndex, spriteIndex);
  }
  assert.equal(bosses.length, 18);
  assert.equal(new Set(bosses.map((boss) => boss.id)).size, 18);
  assert.deepEqual(bosses.slice(0, 16), previousRoster);
  assert.equal(JSON.stringify(previousRoster), before);
  assert.deepEqual(normalizeBosses(bosses, noon), bosses);
});

test("defaults during rest are resting, and reset never starts a timer", () => {
  const resting = defaultBosses(at("2026-10-18T04:00:00+08:00"));
  assert.ok(resting.every((boss) => boss.status === "resting"));
  const reset = normalizeBosses(resting, at("2026-10-18T05:00:00+08:00"));
  assert.ok(reset.every((boss) => boss.status === "unknown" && boss.dueAt === null));
});

test("countdowns are immutable and independent for each boss", () => {
  const initial = defaultBosses(noon);
  const before = JSON.stringify(initial);
  const first = countdown(initial, "atroce", 3_000);
  const second = countdown(first, "lady-tanee", 6_000, noon + 1_000);
  assert.equal(JSON.stringify(initial), before);
  assert.equal(second[0].dueAt, noon + 3_000_000);
  assert.equal(second[1].dueAt, noon + 6_001_000);
  assert.equal(second[2].dueAt, null);
  assert.equal(second[0].observedAt, noon);
  assert.equal(second[0].source, "manual");
});

test("killed MVP uses180min and killed Mini uses120min from death", () => {
  let bosses = defaultBosses(noon);
  bosses = updateBoss(bosses, { type: "kill", bossId: "atroce" }, noon);
  bosses = updateBoss(bosses, { type: "kill", bossId: "boitata" }, noon + 12_345);
  assert.equal(bosses[0].dueAt, noon + 180 * 60_000);
  assert.equal(bosses[2].dueAt, noon + 12_345 + 120 * 60_000);
  assert.equal(bosses[2].source, "kill");
});

test("the two appended MVPs independently use three-hour kill timers", () => {
  let bosses = defaultBosses(noon);
  bosses = updateBoss(bosses, { type: "kill", bossId: "shadow-demon" }, noon);
  bosses = updateBoss(bosses, { type: "kill", bossId: "orc-hero" }, noon + 1000);
  assert.equal(bosses.find((boss) => boss.id === "shadow-demon").dueAt, noon + 180 * 60_000);
  assert.equal(bosses.find((boss) => boss.id === "orc-hero").dueAt, noon + 1000 + 180 * 60_000);
  assert.ok(bosses.slice(0, 16).every((boss) => boss.dueAt === null));
});

test("each confirmed kill restarts its boss from the new server time without entering a duration", () => {
  for (const bossId of ["atroce", "naght-sieger"]) {
    const initial = countdown(defaultBosses(noon), "lady-tanee", 3_600);
    const first = updateBoss(initial, { type: "kill", bossId }, noon + 1_000);
    const firstBoss = first.find((boss) => boss.id === bossId);
    const secondNow = noon + 600_000;
    const second = updateBoss(first, { type: "kill", bossId }, secondNow);
    const secondBoss = second.find((boss) => boss.id === bossId);
    assert.equal(secondBoss.dueAt, secondNow + secondBoss.respawnMinutes * 60_000);
    assert.equal(secondBoss.observedAt, secondNow);
    assert.equal(secondBoss.source, "kill");
    assert.ok(secondBoss.dueAt > firstBoss.dueAt);
    assert.equal(firstBoss.observedAt, noon + 1_000);
    assert.deepEqual(second.filter((boss) => boss.id !== bossId), first.filter((boss) => boss.id !== bossId));
  }
});

test("manual resting and clear remove old timers", () => {
  const initial = countdown(defaultBosses(noon), "atroce", 600);
  const resting = updateBoss(initial, { type: "resting", bossId: "atroce" }, noon + 1);
  assert.equal(resting[0].status, "resting");
  assert.equal(resting[0].dueAt, null);
  assert.deepEqual(reminderCandidates(resting, noon + 1), []);
  const cleared = updateBoss(resting, { type: "clear", bossId: "atroce" }, noon + 2);
  assert.equal(cleared[0].status, "unknown");
  assert.equal(cleared[0].observedAt, null);
});

test("countdowns and killed actions are rejected throughout rest", () => {
  for (const time of ["03:00:00", "04:00:00", "04:59:59"]) {
    const now = at(`2026-10-18T${time}+08:00`);
    assert.throws(() => countdown(defaultBosses(now), "atroce", 300, now), /休息/);
    assert.throws(() => updateBoss(defaultBosses(now), { type: "kill", bossId: "boitata" }, now), /休息/);
  }
});

test("timers cannot reach or cross the03:00 rest boundary", () => {
  const now = at("2026-10-19T02:50:00+08:00");
  const bosses = defaultBosses(now);
  assert.doesNotThrow(() => countdown(bosses, "atroce", 599, now));
  assert.throws(() => countdown(bosses, "atroce", 600, now), /休息/);
  assert.throws(() => countdown(bosses, "atroce", 601, now), /休息/);
  assert.throws(() => updateBoss(bosses, { type: "kill", bossId: "boitata" }, now), /休息/);
});

test("elapsed countdowns become due but stale15min timers are discarded", () => {
  const bosses = countdown(defaultBosses(noon), "atroce", 60);
  assert.equal(normalizeBosses(bosses, noon + 59_999)[0].status, "counting");
  assert.equal(normalizeBosses(bosses, noon + 60_000)[0].status, "due");
  assert.equal(normalizeBosses(bosses, noon + 60_000 + 900_000)[0].status, "due");
  const stale = normalizeBosses(bosses, noon + 60_000 + 900_001)[0];
  assert.equal(stale.status, "unknown");
  assert.equal(stale.dueAt, null);
});

test("entering daily rest invalidates all countdowns", () => {
  const now = at("2026-10-19T02:58:00+08:00");
  const bosses = countdown(defaultBosses(now), "atroce", 60, now);
  const rest = normalizeBosses(bosses, at("2026-10-19T03:00:00+08:00"));
  assert.ok(rest.every((boss) => boss.status === "resting" && boss.dueAt === null));
  assert.deepEqual(reminderCandidates(bosses, at("2026-10-19T03:00:00+08:00")), []);
});

test("closed tabs across reset discard yesterday without inventing rotation", () => {
  const bosses = countdown(defaultBosses(noon), "atroce", 10_000);
  for (const now of [at("2026-10-19T05:00:00+08:00"), at("2026-10-21T12:00:00+08:00")]) {
    const normalized = normalizeBosses(bosses, now);
    assert.ok(normalized.every((boss) => boss.status === "unknown" && boss.dueAt === null));
    assert.deepEqual(reminderCandidates(bosses, now), []);
  }
});

test("10minute,5minute and1minute thresholds are inclusive without overlapping", () => {
  const bosses = countdown(defaultBosses(noon), "atroce", 1_200);
  assert.deepEqual(reminderCandidates(bosses, noon + 599_999), []);
  assert.equal(reminderCandidates(bosses, noon + 600_000)[0].threshold, 600);
  assert.equal(reminderCandidates(bosses, noon + 899_999)[0].threshold, 600);
  assert.equal(reminderCandidates(bosses, noon + 900_000)[0].threshold, 300);
  assert.equal(reminderCandidates(bosses, noon + 1_139_999)[0].threshold, 300);
  assert.equal(reminderCandidates(bosses, noon + 1_140_000)[0].threshold, 60);
  assert.equal(reminderCandidates(bosses, noon + 1_199_999)[0].threshold, 60);
});

test("exact remaining60/61,300/301 and600/601 seconds select only one reminder", () => {
  for (const [seconds, threshold] of [[1, 60], [60, 60], [61, 300], [300, 300], [301, 600], [600, 600], [601, null]]) {
    const bosses = countdown(defaultBosses(noon), "atroce", seconds);
    const reminders = reminderCandidates(bosses, noon);
    assert.equal(reminders.length, threshold === null ? 0 : 1);
    if (threshold !== null) assert.equal(reminders[0].threshold, threshold);
  }
});

test("late dispatcher checks select the current1minute window, never missed catch-up thresholds", () => {
  const bosses = countdown(defaultBosses(noon), "atroce", 1200);
  const late = reminderCandidates(bosses, noon + 1_155_000);
  assert.equal(late.length, 1);
  assert.equal(late[0].threshold, 60);
  assert.equal(late[0].title, "阿特羅斯 · 1 分鐘提醒");
  assert.deepEqual(reminderCandidates(bosses, noon + 1_320_001), []);
});

test("upcomingBosses sorts confirmed future timers globally rather than by MVP, favorite or catalog order", () => {
  let bosses = countdown(defaultBosses(noon), "naght-sieger", 360);
  bosses = countdown(bosses, "death-knight", 300);
  bosses = countdown(bosses, "atroce", 420);
  const before = JSON.stringify(bosses);
  const queue = upcomingBosses(bosses, noon);
  assert.deepEqual(queue.map((boss) => [boss.id, boss.kind]), [["death-knight", "MVP"], ["naght-sieger", "Mini"], ["atroce", "MVP"]]);
  assert.equal(queue[0].dueAt, noon + 300_000);
  assert.equal(queue[1].observedAt, noon);
  assert.equal(queue[1].source, "manual");
  assert.equal(JSON.stringify(bosses), before);
  assert.notEqual(queue[0], bosses.find((boss) => boss.id === "death-knight"));
});

test("equal future deadlines retain stable input order without MVP or favorite tie-breaks", () => {
  let bosses = countdown(defaultBosses(noon), "naght-sieger", 300);
  bosses = countdown(bosses, "atroce", 300);
  const selected = [bosses.find((boss) => boss.id === "naght-sieger"), bosses.find((boss) => boss.id === "atroce")];
  assert.deepEqual(upcomingBosses(selected, noon).map((boss) => boss.id), ["naght-sieger", "atroce"]);
  const reminders = reminderCandidates(selected, noon);
  assert.deepEqual(reminders.map((candidate) => candidate.bossId), ["naght-sieger", "atroce"]);
  assert.match(reminders[0].message, /先前往 納戶特基格.*接著準備 阿特羅斯.*同時重生/);
});

test("5minute MVP precedes6minute Mini and both reminders name the first destination and nearby preparation", () => {
  let bosses = countdown(defaultBosses(noon), "naght-sieger", 360);
  bosses = countdown(bosses, "death-knight", 300);
  const reminders = reminderCandidates(bosses, noon);
  assert.deepEqual(reminders.map((candidate) => [candidate.bossId, candidate.threshold]), [["death-knight", 300], ["naght-sieger", 600]]);
  for (const reminder of reminders) {
    assert.match(reminder.message, /先前往 死靈騎士（剩 5 分鐘）/);
    assert.match(reminder.message, /接著準備 納戶特基格（剩 6 分鐘；相隔 1 分鐘）/);
  }
  assert.equal(bosses.find((boss) => boss.id === "death-knight").dueAt, noon + 300_000);
  assert.equal(bosses.find((boss) => boss.id === "naght-sieger").dueAt, noon + 360_000);
});

test("nearby preparation includes a five-minute gap but not a larger gap", () => {
  let bosses = countdown(defaultBosses(noon), "death-knight", 60);
  bosses = countdown(bosses, "naght-sieger", 360);
  assert.match(reminderCandidates(bosses, noon)[0].message, /接著準備 納戶特基格（剩 6 分鐘；相隔 5 分鐘）/);
  bosses = countdown(bosses, "naght-sieger", 361);
  const message = reminderCandidates(bosses, noon)[0].message;
  assert.match(message, /下一隻 納戶特基格（剩 6 分 1 秒）/);
  assert.doesNotMatch(message, /接著準備/);
});

test("queue and reminder context follow correction and removal without changing another boss timer", () => {
  let bosses = countdown(defaultBosses(noon), "naght-sieger", 360);
  bosses = countdown(bosses, "death-knight", 300);
  const knight = bosses.find((boss) => boss.id === "death-knight");
  const originalKnightKey = reminderCandidates(bosses, noon).find((candidate) => candidate.bossId === knight.id).cycleKey;
  bosses = countdown(bosses, "naght-sieger", 120, noon + 1_000);
  assert.deepEqual(upcomingBosses(bosses, noon + 1_000).map((boss) => boss.id), ["naght-sieger", "death-knight"]);
  assert.deepEqual(bosses.find((boss) => boss.id === knight.id), knight);
  const corrected = reminderCandidates(bosses, noon + 1_000);
  assert.match(corrected[0].message, /先前往 納戶特基格.*接著準備 死靈騎士/);
  assert.equal(corrected.find((candidate) => candidate.bossId === knight.id).cycleKey, originalKnightKey);
  bosses = updateBoss(bosses, { type: "remove", bossId: "naght-sieger" }, noon + 1_000);
  assert.deepEqual(upcomingBosses(bosses, noon + 1_000).map((boss) => boss.id), ["death-knight"]);
  const remaining = reminderCandidates(bosses, noon + 1_000);
  assert.match(remaining[0].message, /先前往 死靈騎士（剩 4 分 59 秒）。/);
  assert.doesNotMatch(remaining[0].message, /納戶特基格|接著準備/);
  assert.equal(remaining[0].cycleKey, originalKnightKey);
});

test("overdue bosses never block the future destination and expiration does not create a kill or new timer", () => {
  let bosses = countdown(defaultBosses(noon), "death-knight", 1);
  bosses = countdown(bosses, "naght-sieger", 361);
  const before = JSON.stringify(bosses);
  const now = noon + 61_000;
  assert.deepEqual(upcomingBosses(bosses, now).map((boss) => boss.id), ["naght-sieger"]);
  const reminders = reminderCandidates(bosses, now);
  assert.deepEqual(reminders.map((candidate) => [candidate.bossId, candidate.threshold]), [["death-knight", 0], ["naght-sieger", 300]]);
  for (const reminder of reminders) {
    assert.match(reminder.message, /先前往 納戶特基格（剩 5 分鐘）/);
    assert.doesNotMatch(reminder.message, /先前往 死靈騎士|已擊殺|重新開始|自動前往/);
  }
  assert.match(reminders[0].message, /已確認倒數已結束，請確認遊戲中的 Boss 狀態/);
  assert.equal(JSON.stringify(bosses), before);
  assert.equal(normalizeBosses(bosses, now).find((boss) => boss.id === "death-knight").dueAt, noon + 1000);
});

test("queue excludes unconfirmed, invalid, paused, resting, expired-cycle and exact-due entries", () => {
  const good = countdown(defaultBosses(noon), "death-knight", 300).find((boss) => boss.id === "death-knight");
  for (const mutation of [
    { observedAt: null }, { observedAt: noon + 1 }, { source: null }, { source: "guessed" },
    { status: "paused" }, { status: "resting" }, { status: "unknown" }, { cycle: "2026-10-17" },
  ]) {
    assert.deepEqual(upcomingBosses([{ ...good, ...mutation }], noon), []);
  }
  assert.deepEqual(upcomingBosses([good], good.dueAt), []);
  assert.deepEqual(upcomingBosses([good], at("2026-10-19T03:00:00+08:00")), []);
  assert.deepEqual(upcomingBosses([good], at("2026-10-19T05:00:00+08:00")), []);
  assert.deepEqual(upcomingBosses(undefined, noon), []);
});

test("long custom boss names are shortened only in context and keep the encrypted payload within320characters", () => {
  let bosses = defaultBosses(noon);
  for (const [name, seconds] of [["甲".repeat(60), 59], ["乙".repeat(60), 61], ["丙".repeat(60), 300]]) {
    bosses = updateBoss(bosses, { type: "add", name, kind: "MVP" }, noon);
    bosses = countdown(bosses, bosses.at(-1).id, seconds);
  }
  for (const reminder of reminderCandidates(bosses, noon)) {
    assert.ok(reminder.message.length <= 320);
    assert.ok(reminder.title.length <= 120);
    assert.ok(reminder.message.includes(`${"甲".repeat(24)}…`));
    assert.ok(reminder.message.includes(`${"乙".repeat(24)}…`));
    const own = bosses.find((boss) => boss.id === reminder.bossId);
    assert.ok(reminder.message.startsWith(`MVP ${own.name} `));
    assert.ok(reminder.title.startsWith(own.name));
  }
  const unicode = updateBoss(defaultBosses(noon), { type: "add", name: "🐱".repeat(30), kind: "Mini" }, noon);
  const observed = countdown(unicode, unicode.at(-1).id, 60);
  const message = reminderCandidates(observed, noon)[0].message;
  assert.ok(message.length <= 320);
  assert.ok(message.includes(`${"🐱".repeat(24)}…`));
  assert.equal(message.isWellFormed(), true);
});

test("spawn alerts are limited to the exact due time through two minutes", () => {
  const bosses = countdown(defaultBosses(noon), "atroce", 600);
  assert.equal(reminderCandidates(bosses, noon + 600_000)[0].threshold, 0);
  assert.equal(reminderCandidates(bosses, noon + 720_000)[0].threshold, 0);
  assert.deepEqual(reminderCandidates(bosses, noon + 720_001), []);
  assert.deepEqual(reminderCandidates(bosses, noon + 1_000_000), []);
});

test("one appropriate reminder per boss, never three catch-up alerts", () => {
  let bosses = countdown(defaultBosses(noon), "atroce", 60);
  bosses = countdown(bosses, "lady-tanee", 450);
  bosses = countdown(bosses, "boitata", 1_200);
  const candidates = reminderCandidates(bosses, noon + 60_000);
  assert.deepEqual(candidates.map((candidate) => [candidate.bossId, candidate.threshold]), [["atroce", 0], ["lady-tanee", 600]]);
});

test("dedup key stays stable for a timer and changes when corrected", () => {
  const bosses = countdown(defaultBosses(noon), "atroce", 600);
  const first = reminderCandidates(bosses, noon)[0];
  const later = reminderCandidates(bosses, noon + 300_000)[0];
  assert.equal(first.cycleKey, later.cycleKey);
  assert.match(first.cycleKey, /2026-10-18:atroce:/);
  const corrected = countdown(bosses, "atroce", 599, noon + 1_000);
  assert.notEqual(reminderCandidates(corrected, noon + 1_000)[0].cycleKey, first.cycleKey);
});

test("malformed imported data is sanitized without mutation", () => {
  const good = countdown(defaultBosses(noon), "atroce", 600)[0];
  const imported = [null, {}, { ...good, id: "<script>" }, { ...good, name: " " }, { ...good, kind: "Other" }, good, good];
  const before = JSON.stringify(imported);
  const normalized = normalizeBosses(imported, noon);
  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].id, "atroce");
  assert.equal(JSON.stringify(imported), before);
  assert.deepEqual(normalizeBosses(undefined, noon), []);
});

test("unconfirmed future observations, bad source and forged kill timers never alert", () => {
  const good = countdown(defaultBosses(noon), "atroce", 600)[0];
  const mutations = [
    { observedAt: null }, { observedAt: noon + 1 }, { source: null }, { source: "guessed" },
    { dueAt: "123" }, { dueAt: NaN }, { dueAt: Infinity }, { observedAt: noon - 86_400_000 },
    { dueAt: good.observedAt }, { source: "kill" }, { cycle: "2026-10-17" },
  ];
  for (const mutation of mutations) {
    const bosses = [{ ...good, ...mutation }];
    assert.equal(normalizeBosses(bosses, noon)[0].status, "unknown");
    assert.deepEqual(reminderCandidates(bosses, noon), []);
  }
});

test("imported respawn durations cannot override MVP and Mini rules", () => {
  const imported = defaultBosses(noon).map((boss) => ({ ...boss, respawnMinutes: 1 }));
  const normalized = normalizeBosses(imported, noon);
  assert.deepEqual(normalized.map((boss) => boss.respawnMinutes), [180, 180, 120, 120, 120, 120, 120, 120, 180, 180, 180, 120, 120, 120, 180, 180, 180, 180]);
});

test("paused and resting imported bosses never notify", () => {
  const good = countdown(defaultBosses(noon), "atroce", 600)[0];
  for (const status of ["paused", "resting", "unknown"]) {
    const bosses = [{ ...good, status }];
    assert.equal(normalizeBosses(bosses, noon)[0].dueAt, null);
    assert.deepEqual(reminderCandidates(bosses, noon), []);
  }
});

test("add, favorite and remove preserve unrelated bosses", () => {
  let bosses = updateBoss(defaultBosses(noon), { type: "add", name: "  新 Boss  ", kind: "Mini" }, noon);
  const added = bosses.at(-1);
  assert.equal(added.name, "新 Boss");
  assert.equal(added.favorite, false);
  assert.equal(added.respawnMinutes, 120);
  bosses = updateBoss(bosses, { type: "favorite", bossId: added.id, favorite: true }, noon);
  assert.equal(bosses.at(-1).favorite, true);
  bosses = updateBoss(bosses, { type: "remove", bossId: added.id }, noon);
  assert.deepEqual(bosses, defaultBosses(noon));
});

test("30boss limit and bad action parameters are rejected", () => {
  let bosses = defaultBosses(noon);
  for (let index = bosses.length; index < 30; index += 1) bosses = updateBoss(bosses, { type: "add", name: `Boss ${index}`, kind: "MVP" }, noon);
  assert.equal(bosses.length, 30);
  assert.throws(() => updateBoss(bosses, { type: "add", name: "Overflow", kind: "MVP" }, noon));
  for (const seconds of [0, -1, 1.5, 86_401, "60", NaN]) assert.throws(() => countdown(bosses, "atroce", seconds));
  for (const action of [null, {}, { type: "kill", bossId: "missing" }, { type: "hmm", bossId: "atroce" }, { type: "favorite", bossId: "atroce", favorite: "yes" }, { type: "add", name: "阿特羅斯", kind: "MVP" }, { type: "add", name: "x".repeat(61), kind: "MVP" }, { type: "add", name: "Valid", kind: "Other" }]) {
    assert.throws(() => updateBoss(defaultBosses(noon), action, noon));
  }
});
