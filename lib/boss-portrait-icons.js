import { resolveBossName } from "./boss-names.js";

const portraitIcons = Object.freeze([
  Object.freeze({ id: "custom-5qip79", name: "暗・逐影", source: "/art/boss-icons/dark-chaser-30039.png", motionId: "dark-chaser", spriteIndex: 18 }),
  Object.freeze({ id: "custom-14l2kgf", name: "亡靈巫師", source: "/art/boss-icons/undead-wizard-31014.png", motionId: "undead-wizard", spriteIndex: 19 }),
  Object.freeze({ id: "custom-1n83kp1", name: "殭屍龍", source: "/art/boss-icons/zombie-dragon-30025.png", motionId: "zombie-dragon", spriteIndex: 20 }),
  Object.freeze({ id: "custom-1hb3imu", name: "暗・基因學者", motionId: "dark-geneticist", spriteIndex: 21 }),
]);

const tirfingPortrait = Object.freeze({
  id: "tirfing",
  source: "/art/boss-icons/tirfing-1204.gif",
  stillSource: "/art/boss-icons/tirfing-1204.png",
  width: 82,
  height: 126,
  stillFrame: Object.freeze({ left: 18, top: 24, width: 47, height: 93 }),
});

function normalizedName(name) {
  return typeof name === "string" ? name.normalize("NFKC").replace(/[・·.]/g, "・").replace(/\s+/g, "") : "";
}

function portraitEntry(boss) {
  if (!boss || typeof boss !== "object") return null;
  const byId = portraitIcons.find((entry) => entry.id === boss.id);
  if (byId) return byId;
  const name = normalizedName(resolveBossName(boss.name)?.name || boss.name);
  return portraitIcons.find((entry) => entry.name === name) || null;
}

export function portraitIcon(boss) {
  const entry = portraitEntry(boss);
  return entry ? entry.source || null : portraitAnimation(boss)?.stillSource || null;
}

export function portraitMotion(boss) {
  const entry = portraitEntry(boss);
  return entry ? { id: entry.motionId, spriteIndex: entry.spriteIndex } : null;
}

export function portraitAnimation(boss) {
  if (!boss || typeof boss !== "object") return null;
  const name = normalizedName(boss.name);
  return boss.id === "custom-qinmln" || name === "獸牙怪" || name === "兽牙怪" ? tirfingPortrait : null;
}
