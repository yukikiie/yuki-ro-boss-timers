import { resolveBossName } from "./boss-names.js";

export const bossCatalog = Object.freeze([
  { id: "atroce", name: "阿特羅斯", kind: "MVP", size: "大", element: "暗", race: "動物", spriteIndex: 0, favorite: true },
  { id: "lady-tanee", name: "嗒妮小姐", kind: "MVP", size: "小", element: "風", race: "植物", spriteIndex: 1, favorite: true },
  { id: "boitata", name: "波伊塔塔", kind: "Mini", size: "中", element: "火", race: "動物", spriteIndex: 2, favorite: true },
  { id: "wandering-samurai", name: "漂流浪人", kind: "Mini", size: "中", element: "無", race: "人形", spriteIndex: 3, favorite: true },
  { id: "dark-elementalist", name: "暗・元素使", kind: "Mini", size: "小", element: "念", race: "不死", spriteIndex: 4, favorite: false },
  { id: "naght-sieger", name: "納戶特基格", kind: "Mini", size: "大", element: "念", race: "惡魔", spriteIndex: 5, favorite: false },
  { id: "coelacanth", name: "腔棘魚", kind: "Mini", size: "大", element: "水", race: "魚貝", spriteIndex: 6, favorite: false },
  { id: "dark-ranger", name: "暗・遊俠", kind: "Mini", size: "小", element: "風", race: "人形", spriteIndex: 7, favorite: false },
  { id: "death-knight", name: "死靈騎士", kind: "MVP", size: "大", element: "暗", race: "惡魔", spriteIndex: 8, favorite: false },
  { id: "fallen-bishop", name: "墮落大神官希巴姆", kind: "MVP", size: "中", element: "暗", race: "惡魔", spriteIndex: 9, favorite: false },
  { id: "tao-gunka", name: "塔奧群卡", kind: "MVP", size: "大", element: "無", race: "惡魔", spriteIndex: 10, favorite: false },
  { id: "ice-dragon", name: "寒冰龍", kind: "Mini", size: "大", element: "水", race: "龍", spriteIndex: 11, favorite: false },
  { id: "restful", name: "安息者", kind: "Mini", size: "中", element: "聖", race: "天使", spriteIndex: 12, favorite: false },
  { id: "chimera", name: "凱美拉", kind: "Mini", size: "大", element: "火", race: "動物", spriteIndex: 13, favorite: false },
  { id: "holy-angel-poring", name: "聖天使波利", kind: "MVP", size: "中", element: "聖", race: "天使", spriteIndex: 14, favorite: false },
  { id: "morocc", name: "夢羅克", kind: "MVP", size: "大", element: "暗", race: "惡魔", spriteIndex: 15, favorite: false },
  { id: "shadow-demon", name: "影魔", kind: "MVP", size: "大", element: "念", race: "無形", spriteIndex: 16, favorite: false },
  { id: "orc-hero", name: "獸人英雄", kind: "MVP", size: "大", element: "地", race: "人形", spriteIndex: 17, favorite: false },
].map((boss) => Object.freeze(boss)));

const tirfingMetadata = Object.freeze({ id: "custom-qinmln", name: "獸牙怪", kind: "Mini", size: "中", element: "暗", race: "無形" });
const geneticistMetadata = Object.freeze({ id: "custom-1hb3imu", name: "暗・基因學者", kind: "MVP", size: "中", element: "火", race: "人形" });
const executionerMetadata = Object.freeze({ id: "custom-1xgl1sj", name: "代行刑者", kind: "MVP", size: "中", element: "暗", race: "天使" });
const shadowDragonMetadata = Object.freeze({ id: "custom-1hknmq6", name: "尼德豪克的影子", kind: "MVP", size: "大", element: "暗", race: "龍" });
const undeadWizardMetadata = Object.freeze({ id: "custom-14l2kgf", name: "亡靈巫師", kind: "Mini", size: "中", element: "不死", race: "不死" });
const darkChaserMetadata = Object.freeze({ id: "custom-5qip79", name: "暗・逐影", kind: "MVP", size: "小", element: "不死", race: "人形" });
const zombieDragonMetadata = Object.freeze({ id: "custom-1n83kp1", name: "殭屍龍", kind: "MVP", size: "大", element: "暗", race: "龍" });

function normalizedName(name) {
  return typeof name === "string" ? name.normalize("NFKC").replace(/[・·.]/g, "・").replace(/\s+/g, "") : "";
}

export function bossDetails(boss) {
  if (!boss || typeof boss !== "object") return null;
  const byId = bossCatalog.find((entry) => entry.id === boss.id)
    || (boss.id === tirfingMetadata.id ? tirfingMetadata : null)
    || (boss.id === geneticistMetadata.id ? geneticistMetadata : null)
    || (boss.id === executionerMetadata.id ? executionerMetadata : null)
    || (boss.id === shadowDragonMetadata.id ? shadowDragonMetadata : null)
    || (boss.id === undeadWizardMetadata.id ? undeadWizardMetadata : null)
    || (boss.id === darkChaserMetadata.id ? darkChaserMetadata : null)
    || (boss.id === zombieDragonMetadata.id ? zombieDragonMetadata : null);
  if (byId) return byId;
  const name = normalizedName(resolveBossName(boss.name)?.name || boss.name);
  return bossCatalog.find((entry) => normalizedName(entry.name) === name)
    || (name === "獸牙怪" || name === "兽牙怪" ? tirfingMetadata : null)
    || (name === geneticistMetadata.name ? geneticistMetadata : null)
    || (name === executionerMetadata.name ? executionerMetadata : null)
    || (name === shadowDragonMetadata.name ? shadowDragonMetadata : null)
    || (name === undeadWizardMetadata.name ? undeadWizardMetadata : null)
    || (name === darkChaserMetadata.name ? darkChaserMetadata : null)
    || (name === zombieDragonMetadata.name ? zombieDragonMetadata : null);
}

function respawnTime(boss) {
  return (boss?.status === "counting" || boss?.status === "due")
    && Number.isSafeInteger(boss.dueAt) && boss.dueAt >= 0 && boss.dueAt <= 8_640_000_000_000_000
    ? boss.dueAt : Infinity;
}

export function sortBossesByRespawn(bosses) {
  if (!Array.isArray(bosses)) return [];
  return bosses.map((boss, index) => ({ boss, index })).sort((first, second) => {
    const firstTime = respawnTime(first.boss);
    const secondTime = respawnTime(second.boss);
    if (firstTime !== secondTime) return firstTime < secondTime ? -1 : 1;
    return Number(second.boss?.favorite === true) - Number(first.boss?.favorite === true) || first.index - second.index;
  }).map((entry) => entry.boss);
}

const displayRanks = new Map([
  "orc-hero", "morocc", "custom-1n83kp1", "tao-gunka", "fallen-bishop", "death-knight",
  "holy-angel-poring", "custom-1hknmq6", "shadow-demon", "custom-1xgl1sj", "custom-1hb3imu", "custom-5qip79",
  "chimera", "custom-qinmln", "custom-14l2kgf", "coelacanth", "naght-sieger", "restful", "ice-dragon", "dark-ranger", "dark-elementalist",
].map((id, index) => [id, index]));

export function sortBossesForDisplay(bosses) {
  if (!Array.isArray(bosses)) return [];
  return bosses.map((boss, index) => ({ boss, index, rank: displayRanks.get(bossDetails(boss)?.id) ?? Infinity })).sort((first, second) => {
    const favoriteOrder = Number(second.boss?.favorite === true) - Number(first.boss?.favorite === true);
    if (favoriteOrder) return favoriteOrder;
    const firstTime = respawnTime(first.boss);
    const secondTime = respawnTime(second.boss);
    if (firstTime !== secondTime) return firstTime < secondTime ? -1 : 1;
    if (Number.isFinite(firstTime) || first.boss?.favorite === true) return first.index - second.index;
    const kindOrder = Number(first.boss?.kind !== "MVP") - Number(second.boss?.kind !== "MVP");
    if (kindOrder) return kindOrder;
    if (first.rank !== second.rank) return first.rank < second.rank ? -1 : 1;
    return first.index - second.index;
  }).map((entry) => entry.boss);
}
