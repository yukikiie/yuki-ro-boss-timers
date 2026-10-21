const portraitIcons = Object.freeze([
  Object.freeze({ id: "custom-5qip79", name: "暗・逐影", source: "/art/boss-icons/dark-chaser-30039.png" }),
  Object.freeze({ id: "custom-14l2kgf", name: "亡靈巫師", source: "/art/boss-icons/undead-wizard-31014.png" }),
  Object.freeze({ id: "custom-1n83kp1", name: "殭屍龍", source: "/art/boss-icons/zombie-dragon-30025.png" }),
]);

function normalizedName(name) {
  return typeof name === "string" ? name.normalize("NFKC").replace(/[・·.]/g, "・").replace(/\s+/g, "") : "";
}

export function portraitIcon(boss) {
  if (!boss || typeof boss !== "object") return null;
  const byId = portraitIcons.find((entry) => entry.id === boss.id);
  if (byId) return byId.source;
  const name = normalizedName(boss.name);
  return portraitIcons.find((entry) => entry.name === name)?.source || null;
}
