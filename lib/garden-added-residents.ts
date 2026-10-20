import poringAtlasData from "./garden-added-porings-atlas.json";
import companionAtlasData from "./garden-added-companions-atlas.json";
import { headerActors } from "./header-behavior";
import { sceneActorFrames, type SceneActorAtlas } from "./scene-actor";
import type { ScenePhase } from "./scene-time";

const poringAtlas = poringAtlasData as unknown as SceneActorAtlas;
const companionAtlas = companionAtlasData as unknown as SceneActorAtlas;

export const addedGardenResidents = [
  { id: "pink-poring", name: "波利", action: "滑行散步與伸展玩耍", atlas: poringAtlas, row: 0, person: false, sleepNose: [.40, .82] },
  { id: "angel-poring", name: "天使波利", action: "拍翼飛行與收翼休息", atlas: poringAtlas, row: 1, person: false, sleepNose: [.41, .87] },
  { id: "moonlight-cat", name: "月夜貓", action: "散步、搖鈴與擺尾", atlas: companionAtlas, row: 0, person: true, sleepNose: [.49, .75] },
  { id: "alice-maid", name: "愛麗絲女僕", action: "散步、掃地與倚帚休息", atlas: companionAtlas, row: 1, person: true, sleepNose: [.51, .75] },
] as const;

export function addedGardenResidentDetails(index: number, phase: ScenePhase = "day", activity = "walk") {
  if (!Number.isInteger(index) || index < 0 || index >= addedGardenResidents.length) return null;
  const { atlas, row, ...resident } = addedGardenResidents[index];
  const columns = phase === "night" ? [6, 7] : activity === "idle" ? [0] : activity === "play" ? [4, 5] : [0, 1, 2, 3];
  const details = sceneActorFrames(atlas, row, phase, columns);
  return details ? { ...headerActors[index + 8], ...resident, ...details } : null;
}
