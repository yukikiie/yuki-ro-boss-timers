export const bossNameRegistry = Object.freeze([
  { id: "lady-tanee", name: "嗒妮小姐", displayName: "妮小姐", aliases: ["妮小姐"] },
  { id: "fallen-bishop", name: "墮落大神官希巴姆", displayName: "大神官", aliases: ["大神官"] },
  { id: "death-knight", name: "死靈騎士", displayName: "47", aliases: ["47"] },
  { id: "tao-gunka", name: "塔奧群卡", displayName: "塔奧", aliases: ["塔奧"] },
  { id: "custom-5qip79", name: "暗・逐影", displayName: "逐影", aliases: ["逐影"] },
  { id: "boitata", name: "波伊塔塔", displayName: "波波塔塔", aliases: ["波波塔塔"] },
  { id: "naght-sieger", name: "納戶特基格", displayName: "光頭", aliases: ["光頭"] },
  { id: "dark-elementalist", name: "暗・元素使", displayName: "元素", aliases: ["元素"] },
  { id: "dark-ranger", name: "暗・遊俠", displayName: "遊俠", aliases: ["遊俠"] },
  { id: "custom-1hb3imu", name: "暗・基因學者", displayName: "基因", aliases: ["基因"] },
  { id: "custom-1xgl1sj", name: "代行刑者", displayName: "代行", aliases: ["代行"] },
  { id: "custom-1hknmq6", name: "尼德豪克的影子", displayName: "影龍", aliases: ["影龍"] },
].map(entry => Object.freeze({ ...entry, aliases: Object.freeze(entry.aliases) })));

function normalizedName(input) {
  return typeof input === "string" ? input.normalize("NFKC").toLowerCase().replace(/[・·.]/g, "・").replace(/\s+/g, "") : "";
}

function entryById(input) {
  const key = normalizedName(input);
  return key ? bossNameRegistry.find(entry => normalizedName(entry.id) === key) || null : null;
}

export function resolveBossName(input) {
  const key = normalizedName(input);
  if (!key) return null;
  return entryById(input) || bossNameRegistry.find(entry => [entry.name, ...entry.aliases].some(name => normalizedName(name) === key)) || null;
}

function bossEntry(boss) {
  if (!boss || typeof boss !== "object") return null;
  return entryById(boss.id) || resolveBossName(boss.name);
}

function originalName(boss) {
  return boss && typeof boss === "object" && typeof boss.name === "string" ? boss.name : "";
}

export function bossDisplayName(boss) {
  return bossEntry(boss)?.displayName || originalName(boss);
}

export function bossCanonicalName(boss) {
  return bossEntry(boss)?.name || originalName(boss);
}
