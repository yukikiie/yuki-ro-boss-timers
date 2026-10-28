import spriteData from "./imported-header-sprites.json";

export type ImportedHeaderSpriteId = keyof typeof spriteData;
export type ImportedHeaderSprite = Readonly<{
  id: string; source: string; sourceGif: string; width: number; height: number;
  frameCount: number; durationsMs: readonly number[]; durationMs: number; footY: number; sourceSha256: string;
}>;

export const IMPORTED_HEADER_SPRITES = Object.freeze(Object.fromEntries(Object.entries(spriteData).map(([id, sprite]) => [id, Object.freeze({ ...sprite, durationsMs: Object.freeze([...sprite.durationsMs]) })]))) as Readonly<Record<ImportedHeaderSpriteId, ImportedHeaderSprite>>;

export function importedHeaderSpriteDetails(placement: { fileId: string; x: number; y: number; width: number }) {
  const sprite = IMPORTED_HEADER_SPRITES[placement.fileId as ImportedHeaderSpriteId];
  if (!sprite) return null;
  const scale = placement.width / sprite.width;
  return {
    ...sprite,
    canvasWidth: sprite.width,
    canvasHeight: sprite.height,
    stripWidth: sprite.width * sprite.frameCount,
    left: placement.x - placement.width / 2,
    top: placement.y - sprite.footY * scale,
    width: placement.width,
    height: sprite.height * scale,
  };
}
