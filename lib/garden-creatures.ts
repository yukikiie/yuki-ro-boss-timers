import atlasData from "./garden-creatures-atlas.json";
import walkAtlasData from "./garden-walk-atlas.json";
import type { ScenePhase } from "./scene-time";
import { sceneActorFrames, type SceneActorAtlas } from "./scene-actor";

const atlas = atlasData as unknown as SceneActorAtlas;
const walkAtlas = walkAtlasData as unknown as SceneActorAtlas;

export const gardenCreatures = [
  { id: "purple-poring", name: "紫色波利", action: "扇翅散步與張望", left: 238, top: 686, width: 220, height: 168, duration: 1.6, roam: "52px", delay: "-1.2s" },
  { id: "hat-poring", name: "帽子波利", action: "整理帽子與玩耍", left: 601, top: 695, width: 177, height: 144, duration: 2.4, roam: "24px", delay: "-3.6s" },
  { id: "blue-ghost", name: "藍色幽靈波利", action: "伸展小手與散步", left: 1096, top: 754, width: 114, height: 110, duration: 2, roam: "-26px", delay: "-2.3s" },
  { id: "leaf-poring", name: "綠葉波利", action: "葉片擺動與追逐落櫻", left: 463, top: 814, width: 114, height: 106, duration: 1.8, roam: "35px", delay: "-5.1s" },
  { id: "lunatic", name: "白色瘋兔", action: "走路、嗅花與耳朵互動", left: 765, top: 833, width: 108, height: 100, duration: 1.6, roam: "-42px", delay: "-1.6s" },
  { id: "peco-chick", name: "大嘴鳥寶寶", action: "小碎步、啄地與拍翅", left: 95, top: 707, width: 100, height: 96, duration: 1.4, roam: "35px", delay: "-4.3s" },
] as const;

export function gardenCreatureDetails(index: number, phase: ScenePhase = "day", activity = "walk") {
  if (!Number.isInteger(index) || index < 0 || index >= gardenCreatures.length) return null;
  const walking = phase !== "night" && Boolean(walkAtlas.rows[index]);
  const columns = phase === "night" ? [4, 5] : activity === "idle" ? [walking ? 5 : 0] : activity === "play" ? walking ? [4, 5] : [2, 3] : [0, 1, 2, 3];
  const details = sceneActorFrames(walking ? walkAtlas : atlas, index, phase, columns);
  return details ? { ...gardenCreatures[index], ...details } : null;
}
