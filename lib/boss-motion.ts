import pixelMotionA from "./pixel-motion-a.json";
import pixelMotionB from "./pixel-motion-b.json";
import pixelMotionC from "./pixel-motion-c.json";
import pixelMotionD from "./pixel-motion-d.json";
import pixelMotionE from "./pixel-motion-e.json";
import pixelMotionF from "./pixel-motion-f.json";
import pixelMotionG from "./pixel-motion-g.json";
import pixelMotionH from "./pixel-motion-h.json";
import pixelMotionI from "./pixel-motion-i.json";

const pixelAtlases = [pixelMotionA, pixelMotionB, pixelMotionC, pixelMotionD, pixelMotionE, pixelMotionF, pixelMotionG, pixelMotionH, pixelMotionI];

export const motionAtlases = pixelAtlases.map(({ source, width, height }) => ({ source, width, height }));
export const motionSpriteLocations = [
  ...Array.from({ length: 15 }, (_, index) => ({ atlasIndex: Math.floor(index / 4), row: index % 4 })),
  { atlasIndex: 4, row: 0 },
  { atlasIndex: 4, row: 1 },
  { atlasIndex: 4, row: 2 },
  { atlasIndex: 5, row: 0 },
  { atlasIndex: 7, row: 0 },
  { atlasIndex: 5, row: 2 },
  { atlasIndex: 6, row: 0 },
  { atlasIndex: 8, row: 0 },
];
export const motionFrameBounds = motionSpriteLocations.map(({ atlasIndex, row }) => pixelAtlases[atlasIndex].rows[row]);

export const bossMotion = [
  { id: "atroce", action: "咆哮與揮爪", duration: .88 },
  { id: "lady-tanee", action: "施法、髮絲與樹葉", duration: 1.6 },
  { id: "boitata", action: "蛇冠張開、吐信與盤尾", duration: 1.2 },
  { id: "wandering-samurai", action: "拔刀斬擊", duration: .8 },
  { id: "dark-elementalist", action: "舉杖蓄能", duration: 1.6 },
  { id: "naght-sieger", action: "狼首轉向與揮拳", duration: 1.3 },
  { id: "coelacanth", action: "張口咬擊與擺尾", duration: 1 },
  { id: "dark-ranger", action: "拉弓射箭", duration: 1.1 },
  { id: "death-knight", action: "戰馬抬蹄與騎士出劍", duration: 1.4 },
  { id: "fallen-bishop", action: "手勢與雙靈火", duration: 1.4 },
  { id: "tao-gunka", action: "眨眼與晶石閃光", duration: 2.8 },
  { id: "ice-dragon", action: "吐息與展翼", duration: 1.4 },
  { id: "restful", action: "羽翼開合與骷髏紅光", duration: 1.6 },
  { id: "chimera", action: "獅吼與蛇首攻擊", duration: 1.3 },
  { id: "holy-angel-poring", action: "拍翼與眨眼", duration: .9 },
  { id: "morocc", action: "張顎咆哮與巨拳重擊", duration: 1.6 },
  { id: "shadow-demon", action: "幽影蓄能與異形巨爪", duration: 1.6 },
  { id: "orc-hero", action: "架盾與揮劍", duration: 1.3 },
  { id: "dark-chaser", action: "雙刃蓄勢與交叉斬擊", duration: 1.2 },
  { id: "undead-wizard", action: "舉杖蓄能與紫焰施法", duration: 1.6 },
  { id: "zombie-dragon", action: "展翼蓄勢與紫焰吐息", duration: 1.5 },
  { id: "dark-geneticist", action: "焰斧蓄勢與揮砍", duration: 1.4 },
  { id: "tirfing", action: "魔劍蓄勢、斬擊與咬刃", duration: 1.2 },
] as const;

export const bossIdleSilhouetteAreas = motionSpriteLocations.map(({ atlasIndex, row }) => pixelAtlases[atlasIndex].idleAreas[row]);
export const bossReferenceFootprint = 333.57489217849127;

export const bossPortraitLayout = { width: 34, height: 22.605, cardHeight: 27.5, maximumZoom: 1.3, minimumZoom: .85, horizontalOverflow: .75 } as const;

function motionGeometry(spriteIndex: number) {
  const bounds = motionFrameBounds[spriteIndex];
  const cellWidth = Math.max(...bounds.map((frame) => frame[2])) + 16;
  const top = Math.min(...bounds.map((frame) => frame[1])) - 8;
  const bottom = Math.max(...bounds.map((frame) => frame[1] + frame[3])) + 8;
  const frames = bounds.map(([left, frameTop, width, height]) => ({ left, top: frameTop, width, height, offsetLeft: Math.round((cellWidth - width) / 2), offsetTop: frameTop - top }));
  return { cellWidth, cellHeight: bottom - top, frames };
}

function portraitBaseScale(geometry: ReturnType<typeof motionGeometry>) {
  return Math.min(bossPortraitLayout.width / geometry.cellWidth, bossPortraitLayout.height / geometry.cellHeight);
}

export function motionDetails(spriteIndex: number) {
  if (!Number.isInteger(spriteIndex) || spriteIndex < 0 || spriteIndex >= bossMotion.length) return null;
  const location = motionSpriteLocations[spriteIndex];
  const atlas = motionAtlases[location.atlasIndex];
  const geometry = motionGeometry(spriteIndex);
  const baseScale = portraitBaseScale(geometry);
  const idleFootprint = bossIdleSilhouetteAreas[spriteIndex] * baseScale ** 2;
  const maximumFrameWidth = Math.max(...geometry.frames.map(frame => frame.width));
  const horizontalZoomLimit = (bossPortraitLayout.width + 2 * bossPortraitLayout.horizontalOverflow) / (maximumFrameWidth * baseScale);
  const contentHeight = Math.max(...geometry.frames.map(frame => frame.offsetTop + frame.height)) - Math.min(...geometry.frames.map(frame => frame.offsetTop));
  const verticalZoomLimit = bossPortraitLayout.cardHeight / (contentHeight * baseScale);
  const opticalScale = Math.max(bossPortraitLayout.minimumZoom, Math.min(bossPortraitLayout.maximumZoom, horizontalZoomLimit, verticalZoomLimit, Math.sqrt(bossReferenceFootprint / idleFootprint)));
  const viewportWidth = geometry.cellWidth / opticalScale;
  const viewportHeight = geometry.cellHeight / opticalScale;
  const viewport = { left: (geometry.cellWidth - viewportWidth) / 2, top: (geometry.cellHeight - viewportHeight) / 2, width: viewportWidth, height: viewportHeight };
  return { ...bossMotion[spriteIndex], ...atlas, ...geometry, row: location.row, opticalScale, viewport };
}
