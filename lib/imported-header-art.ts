import styleAtlas from "./imported-header-style-atlas.json";
import referenceAtlas from "./garden-added-porings-atlas.json";
import { sceneActorFrames, type SceneActorAtlas } from "./scene-actor";

type Bounds = [number, number, number, number];
type ImportedStyleAtlas = {
  source: string; width: number; height: number; fileIds: string[];
  rows: Bounds[][]; rowCuts: number[]; rowColumnCuts: number[][]; idleAreas: number[]; frameAreas: number[][];
};
const atlas = styleAtlas as ImportedStyleAtlas;
const reference = sceneActorFrames(referenceAtlas as unknown as SceneActorAtlas, 0, "day", [0, 1, 2, 3])!;

export const IMPORTED_HEADER_ART_IDS = Object.freeze([...atlas.fileIds]);
export const IMPORTED_HEADER_SCALE_MULTIPLIER = 1.3;
export const IMPORTED_HEADER_CREATURE_SCALE_MULTIPLIERS: Readonly<Record<string, number>> = Object.freeze({ "1388": 1.3 });
export const IMPORTED_HEADER_REFERENCE_IDLE_AREA = 19578;
export const IMPORTED_HEADER_REFERENCE_CELL_WIDTH = reference.cellWidth;
export const IMPORTED_HEADER_REFERENCE_FILL_RATIO = IMPORTED_HEADER_REFERENCE_IDLE_AREA / reference.cellWidth ** 2;

export function importedHeaderArtDetails(placement: { fileId: string; x: number; y: number; width: number }) {
  const row = atlas.fileIds.indexOf(placement.fileId);
  if (row < 0) return null;
  const frames = sceneActorFrames({
    source: atlas.source, width: atlas.width, height: atlas.height,
    rows: [atlas.rows[row]], rowCuts: [atlas.rowCuts[row], atlas.rowCuts[row + 1]], columnCuts: atlas.rowColumnCuts[row],
  }, 0, "day", [0, 1, 2, 3])!;
  const creatureScaleMultiplier = IMPORTED_HEADER_CREATURE_SCALE_MULTIPLIERS[placement.fileId] ?? 1;
  const effectiveReferenceWidth = placement.width * IMPORTED_HEADER_SCALE_MULTIPLIER * creatureScaleMultiplier;
  const scale = effectiveReferenceWidth * Math.sqrt(IMPORTED_HEADER_REFERENCE_FILL_RATIO / atlas.idleAreas[row]);
  const baseline = Math.max(...frames.frames.map(frame => frame.offsetTop + frame.height));
  return {
    ...frames,
    id: placement.fileId,
    row,
    baseline,
    scale,
    duration: 3.2 + row % 3 * .4,
    referenceWidth: placement.width,
    creatureScaleMultiplier,
    effectiveReferenceWidth,
    occupiedIdleArea: atlas.idleAreas[row] * scale ** 2,
    left: placement.x - frames.cellWidth * scale / 2,
    top: placement.y - baseline * scale,
    width: frames.cellWidth * scale,
    height: frames.cellHeight * scale,
  };
}
