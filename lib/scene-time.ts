export type ScenePhase = "day" | "afternoon" | "night";
export type SceneMode = ScenePhase | "auto";

const HOUR_MS = 60 * 60 * 1000;
const HOURS_PER_DAY = 24;
const HONG_KONG_UTC_OFFSET = 8;

export const SCENE_PHASES = [
  { id: "day", label: "早晨", hours: "06:00–11:59", startHour: 6, endHourExclusive: 12 },
  { id: "afternoon", label: "晴朗午後", hours: "12:00–17:59", startHour: 12, endHourExclusive: 18 },
  { id: "night", label: "星夜", hours: "18:00–05:59", startHour: 18, endHourExclusive: 6 },
] as const;

export const SCENE_ASSETS = {
  day: { header: "/art/ro-header-residents-morning.png", garden: "/art/ro-garden-morning.png" },
  afternoon: { header: "/art/ro-header-residents-afternoon.png", garden: "/art/ro-garden-afternoon.png" },
  night: { header: "/art/ro-header-residents-night.png", garden: "/art/ro-garden-night.png" },
} as const satisfies Record<ScenePhase, { header: string; garden: string }>;

export function getHongKongScenePhase(timestamp: number): ScenePhase {
  if (!Number.isFinite(timestamp)) return "day";

  const utcHour = Math.floor(timestamp / HOUR_MS) % HOURS_PER_DAY;
  const hongKongHour = (utcHour + HONG_KONG_UTC_OFFSET + HOURS_PER_DAY) % HOURS_PER_DAY;

  if (hongKongHour >= 6 && hongKongHour < 12) return "day";
  if (hongKongHour >= 12 && hongKongHour < 18) return "afternoon";
  return "night";
}

export function sceneAssetPaths(phase: ScenePhase) {
  return SCENE_ASSETS[phase];
}
