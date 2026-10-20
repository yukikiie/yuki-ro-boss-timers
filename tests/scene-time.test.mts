import assert from "node:assert/strict";
import test from "node:test";
import type { ScenePhase } from "../lib/scene-time";

const { getHongKongScenePhase, sceneAssetPaths, SCENE_ASSETS, SCENE_PHASES } = await import(
  new URL("../lib/scene-time.ts", import.meta.url).href
) as typeof import("../lib/scene-time");

test("Hong Kong scene phases switch exactly at 06:00, 12:00 and 18:00 HKT", () => {
  const boundaries: [string, ScenePhase][] = [
    ["2026-10-18T21:59:59.999Z", "night"],
    ["2026-10-18T22:00:00.000Z", "day"],
    ["2026-10-19T03:59:59.999Z", "day"],
    ["2026-10-19T04:00:00.000Z", "afternoon"],
    ["2026-10-19T09:59:59.999Z", "afternoon"],
    ["2026-10-19T10:00:00.000Z", "night"],
  ];

  for (const [timestamp, phase] of boundaries) {
    assert.equal(getHongKongScenePhase(Date.parse(timestamp)), phase, timestamp);
  }
});

test("night continues across Hong Kong midnight and UTC date rollover", () => {
  for (const timestamp of [
    "2026-10-19T15:59:59.999Z",
    "2026-10-19T16:00:00.000Z",
    "2026-10-19T21:59:59.999Z",
    "2026-12-31T16:00:00.000Z",
    "2027-01-01T10:00:00.000Z",
  ]) {
    assert.equal(getHongKongScenePhase(Date.parse(timestamp)), "night", timestamp);
  }
  assert.equal(getHongKongScenePhase(Date.parse("2026-10-19T22:00:00.000Z")), "day");
});

test("phase calculation handles pre-epoch timestamps and negative remainders", () => {
  const hour = 60 * 60 * 1000;
  assert.equal(getHongKongScenePhase(0), "day");
  assert.equal(getHongKongScenePhase(-8 * hour), "night");
  assert.equal(getHongKongScenePhase(-8 * hour - 1), "night");
  assert.equal(getHongKongScenePhase(-2 * hour - 1), "night");
  assert.equal(getHongKongScenePhase(-2 * hour), "day");
});

test("non-finite timestamps safely use the morning phase", () => {
  for (const timestamp of [NaN, Infinity, -Infinity]) {
    assert.equal(getHongKongScenePhase(timestamp), "day");
  }
});

test("Hong Kong phases do not depend on the device time zone or daylight saving", () => {
  const originalTimeZone = process.env.TZ;
  try {
    for (const timeZone of ["UTC", "America/New_York", "Europe/London", "Pacific/Auckland"]) {
      process.env.TZ = timeZone;
      assert.equal(getHongKongScenePhase(Date.parse("2026-03-29T04:00:00Z")), "afternoon", timeZone);
      assert.equal(getHongKongScenePhase(Date.parse("2026-10-25T22:00:00Z")), "day", timeZone);
    }
  } finally {
    if (originalTimeZone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimeZone;
  }
});

test("scene metadata and assets cover every phase with its own full illustration pair", () => {
  assert.deepEqual(SCENE_PHASES.map((phase) => phase.id), ["day", "afternoon", "night"]);
  assert.deepEqual(SCENE_PHASES.map((phase) => phase.label), ["早晨", "晴朗午後", "星夜"]);
  assert.deepEqual(SCENE_PHASES.map((phase) => [phase.startHour, phase.endHourExclusive]), [[6, 12], [12, 18], [18, 6]]);
  assert.deepEqual(sceneAssetPaths("day"), { header: "/art/ro-header-residents-morning.png", garden: "/art/ro-garden-morning.png" });
  assert.deepEqual(sceneAssetPaths("afternoon"), { header: "/art/ro-header-residents-afternoon.png", garden: "/art/ro-garden-afternoon.png" });
  assert.deepEqual(sceneAssetPaths("night"), { header: "/art/ro-header-residents-night.png", garden: "/art/ro-garden-night.png" });
  assert.equal(new Set(Object.values(SCENE_ASSETS).flatMap((assets) => [assets.header, assets.garden])).size, 6);
});
