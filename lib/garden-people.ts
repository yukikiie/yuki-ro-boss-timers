import atlasData from "./garden-people-atlas.json";
import type { ScenePhase } from "./scene-time";
import { sceneActorFrames, type SceneActorAtlas } from "./scene-actor";

const atlas = atlasData as unknown as SceneActorAtlas;

export const gardenPeople = [
  { id: "novice", name: "初心者", action: "散步、招手與整理背包", left: 774, top: 523, width: 143, height: 170, duration: 2.4, roam: "22px", delay: "-2.6s" },
  { id: "priest", name: "服事", action: "散步、揮手與閱讀祈禱書", left: 938, top: 565, width: 149, height: 189, duration: 2.8, roam: "-20px", delay: "-5.4s" },
] as const;

export function gardenPersonDetails(index: number, phase: ScenePhase = "day", activity = "walk") {
  if (!Number.isInteger(index) || index < 0 || index >= gardenPeople.length) return null;
  const columns = phase === "night" ? [4, 5] : activity === "idle" ? [0] : activity === "play" ? [2, 3] : [0, 1];
  const details = sceneActorFrames(atlas, index, phase, columns);
  return details ? { ...gardenPeople[index], ...details } : null;
}
