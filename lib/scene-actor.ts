import type { ScenePhase } from "./scene-time";

export type SceneActorAtlas = { source: string; width: number; height: number; rows: [number, number, number, number][][]; columnCuts?: number[]; rowCuts?: number[] };

export function sceneActorFrames(atlas: SceneActorAtlas, index: number, phase: ScenePhase, selectedColumns?: number[]) {
  const bounds = atlas.rows[index];
  if (!bounds?.length) return null;
  const sleeping = phase === "night";
  const columns = selectedColumns ?? (sleeping ? [bounds.length - 2, bounds.length - 1] : [0, 1, 2, 3]);
  if (columns.some(column => !Number.isInteger(column) || !bounds[column])) return null;
  const columnOrigin = (column: number) => atlas.columnCuts?.[column] ?? column * atlas.width / bounds.length;
  const rowOrigin = atlas.rowCuts?.[index] ?? index * atlas.height / atlas.rows.length;
  const localLeft = Math.min(...bounds.map(([left], column) => left - columnOrigin(column))) - 4;
  const localTop = Math.min(...bounds.map(([, top]) => top - rowOrigin)) - 4;
  const localRight = Math.max(...bounds.map(([left, , width], column) => left - columnOrigin(column) + width)) + 4;
  const localBottom = Math.max(...bounds.map(([, top, , height]) => top - rowOrigin + height)) + 4;
  const frames = columns.map((column) => {
    const [left, top, width, height] = bounds[column];
    return { left, top, width, height, offsetLeft: left - columnOrigin(column) - localLeft, offsetTop: sleeping ? localBottom - localTop - height - 4 : top - rowOrigin - localTop };
  });
  return { source: atlas.source, atlasWidth: atlas.width, atlasHeight: atlas.height, frames, sleeping, cellWidth: localRight - localLeft, cellHeight: localBottom - localTop };
}
