import creatureAtlasData from "./garden-creatures-atlas.json";
import poringAtlasData from "./garden-added-porings-atlas.json";
import type { BackgroundThemeId } from "./background-themes";
import { sceneActorFrames, type SceneActorAtlas } from "./scene-actor";
import type { ScenePhase } from "./scene-time";

export type ThemeLayout = "desktop" | "mobile";
export type ThemeResidentId = "purple-poring" | "hat-poring" | "blue-ghost" | "leaf-poring" | "lunatic" | "peco-chick" | "pink-poring" | "angel-poring";
export type ThemeResident = {
  id: ThemeResidentId;
  /** Centre and foot/contact point, in the painting's normalized coordinates. */
  x: number;
  y: number;
  width: number;
  support: "grass" | "path" | "rock" | "branch" | "air";
  landmark: string;
  depth: "distant" | "middle" | "foreground";
  motion: "rest" | "perch" | "hop" | "hover";
  facing: "left" | "right";
};

export const THEME_SCENE_SIZE = {
  desktop: { width: 1000, height: 1000 / 3 },
  mobile: { width: 1000, height: 750 },
} as const;

function resident(id: ThemeResidentId, x: number, y: number, width: number, support: ThemeResident["support"], landmark: string, depth: ThemeResident["depth"], facing: ThemeResident["facing"] = "right"): ThemeResident {
  return { id, x, y, width, support, landmark, depth, facing, motion: support === "air" ? "hover" : id === "peco-chick" ? "perch" : id === "lunatic" ? "hop" : "rest" };
}

/** Each map is composed against its complete painting; mobile is independently staged. */
export const THEME_RESIDENTS: Record<BackgroundThemeId, Record<ThemeLayout, ThemeResident[]>> = {
  "moon-garden": {
    desktop: [
      resident("peco-chick", 166, 180, 24, "rock", "left garden terrace stone", "distant"),
      resident("hat-poring", 380, 206, 30, "grass", "grass below the castle steps", "distant", "left"),
      resident("blue-ghost", 737, 230, 29, "rock", "dry bridge approach on the near bank", "middle"),
      resident("angel-poring", 645, 132, 36, "air", "open sky above the distant valley", "distant", "left"),
      resident("leaf-poring", 240, 278, 43, "grass", "left foreground flower verge", "foreground"),
      resident("lunatic", 450, 296, 44, "path", "inner bend of the broad stone path", "foreground", "left"),
      resident("pink-poring", 600, 316, 55, "grass", "near grass beside the path", "foreground"),
      resident("purple-poring", 706, 284, 50, "grass", "dry flower bank before the stream", "foreground", "left"),
    ],
    mobile: [
      resident("peco-chick", 205, 291, 50, "branch", "left cherry branch above the flower terraces", "distant"),
      resident("angel-poring", 696, 232, 66, "air", "open sky to the side of the moon", "distant", "left"),
      resident("hat-poring", 411, 371, 64, "path", "landing below the castle steps", "distant"),
      resident("blue-ghost", 713, 492, 55, "rock", "dry left bridge-bank stone", "middle", "left"),
      resident("leaf-poring", 246, 560, 83, "rock", "left foreground flat stone terrace", "middle"),
      resident("lunatic", 610, 612, 85, "path", "near bend of the garden path", "foreground", "left"),
      resident("pink-poring", 420, 676, 103, "grass", "front left grass beside the path", "foreground"),
      resident("purple-poring", 790, 672, 96, "grass", "front grass on the dry bank", "foreground", "left"),
    ],
  },
  "mushroom-forest": {
    desktop: [
      resident("peco-chick", 148, 284, 25, "rock", "flat foreground stone below the left roots", "middle"),
      resident("hat-poring", 358, 232, 30, "grass", "moss below the left arching root", "distant"),
      resident("blue-ghost", 804, 227, 31, "grass", "right root-side moss", "distant", "left"),
      resident("angel-poring", 721, 125, 36, "air", "canopy opening beside the rune arch", "distant", "left"),
      resident("leaf-poring", 265, 264, 39, "grass", "left clearing fern verge", "middle"),
      resident("lunatic", 451, 307, 45, "path", "left edge of the front dirt trail", "foreground"),
      resident("pink-poring", 621, 288, 54, "grass", "near right clearing grass", "foreground", "left"),
      resident("purple-poring", 762, 299, 49, "grass", "right foreground clearing", "foreground", "left"),
    ],
    mobile: [
      resident("peco-chick", 286, 237, 49, "branch", "moss-covered horizontal left bough", "distant"),
      resident("angel-poring", 680, 215, 66, "air", "canopy gap right of the distant portal", "distant", "left"),
      resident("hat-poring", 630, 410, 62, "grass", "grass below the rune-arch approach", "distant"),
      resident("blue-ghost", 766, 432, 63, "grass", "right grassy terrace", "middle", "left"),
      resident("leaf-poring", 275, 498, 84, "grass", "left fern verge", "middle"),
      resident("lunatic", 470, 600, 86, "path", "left bend of the dirt trail", "foreground"),
      resident("pink-poring", 675, 656, 102, "grass", "right clearing below the trail", "foreground", "left"),
      resident("purple-poring", 285, 668, 96, "grass", "front left forest grass", "foreground"),
    ],
  },
  "sky-islands": {
    desktop: [
      resident("peco-chick", 150, 218, 24, "rock", "square stone at the left of the main island", "middle"),
      resident("blue-ghost", 214, 134, 21, "grass", "small distant left floating island", "distant"),
      resident("hat-poring", 573, 129, 24, "grass", "middle floating island beside the pillars", "distant", "left"),
      resident("angel-poring", 425, 132, 38, "air", "cloud gap between the islands", "middle"),
      resident("lunatic", 375, 241, 41, "path", "left bend of the main island trail", "middle"),
      resident("leaf-poring", 246, 275, 42, "grass", "main island's near left grass", "foreground"),
      resident("pink-poring", 526, 280, 53, "grass", "main island's near grassy rim", "foreground", "left"),
      resident("purple-poring", 800, 283, 49, "grass", "main island's right foreground turf", "foreground", "left"),
    ],
    mobile: [
      resident("blue-ghost", 258, 241, 45, "grass", "small island at the left tree bough", "distant"),
      resident("hat-poring", 664, 282, 49, "grass", "grass beside the middle island arch", "distant", "left"),
      resident("angel-poring", 515, 291, 72, "air", "open cloud gap between islands", "middle"),
      resident("peco-chick", 150, 391, 52, "rock", "left square stone on the main island", "middle"),
      resident("lunatic", 394, 472, 84, "path", "left bend of the main island path", "middle"),
      resident("leaf-poring", 250, 524, 84, "grass", "near left island turf", "foreground"),
      resident("pink-poring", 562, 566, 103, "grass", "near island rim grass", "foreground"),
      resident("purple-poring", 819, 536, 96, "grass", "right foreground island grass", "foreground", "left"),
    ],
  },
  "crystal-cavern": {
    desktop: [
      resident("peco-chick", 282, 155, 24, "rock", "left middle shelf beside the cyan crystals", "distant"),
      resident("blue-ghost", 794, 147, 28, "rock", "right middle crystal shelf", "distant", "left"),
      resident("angel-poring", 690, 132, 36, "air", "open cave air beside the rear cascade", "distant", "left"),
      resident("hat-poring", 161, 209, 32, "rock", "left low shelf above the pool", "middle"),
      resident("leaf-poring", 452, 222, 34, "rock", "back edge of the main stone floor", "middle"),
      resident("purple-poring", 322, 279, 49, "rock", "left foreground stone platform", "foreground"),
      resident("pink-poring", 586, 302, 54, "rock", "front central stone platform", "foreground", "left"),
      resident("lunatic", 761, 279, 44, "rock", "right dry edge of the main stone platform", "foreground", "left"),
    ],
    mobile: [
      resident("peco-chick", 200, 215, 48, "rock", "left upper crystal shelf lip", "distant"),
      resident("angel-poring", 742, 244, 66, "air", "open cave air right of the cascade", "distant", "left"),
      resident("blue-ghost", 813, 371, 58, "rock", "right middle crystal ledge", "distant", "left"),
      resident("hat-poring", 297, 466, 67, "rock", "left lower shelf above the water", "middle"),
      resident("leaf-poring", 536, 529, 75, "rock", "rear edge of the main dry platform", "middle"),
      resident("purple-poring", 265, 531, 96, "rock", "left foreground platform", "foreground"),
      resident("pink-poring", 562, 628, 103, "rock", "near centre of the main platform", "foreground"),
      resident("lunatic", 785, 538, 86, "rock", "right edge of the dry main platform", "foreground", "left"),
    ],
  },
  "cosmic-sanctuary": {
    desktop: [
      resident("peco-chick", 849, 122, 24, "branch", "right luminous tree bough", "distant"),
      resident("hat-poring", 265, 181, 29, "rock", "dry portal-side ledge", "distant"),
      resident("angel-poring", 750, 137, 38, "air", "star field beside the moon", "distant", "left"),
      resident("blue-ghost", 808, 216, 30, "rock", "dry right river ledge", "middle", "left"),
      resident("leaf-poring", 182, 282, 41, "rock", "left foreground flat stone terrace", "middle"),
      resident("lunatic", 427, 288, 44, "path", "front bend of the sanctuary trail", "foreground"),
      resident("pink-poring", 576, 313, 54, "path", "near sanctuary trail", "foreground"),
      resident("purple-poring", 794, 286, 49, "rock", "right foreground flat stone ledge", "foreground", "left"),
    ],
    mobile: [
      resident("peco-chick", 245, 237, 48, "branch", "left luminous tree branch", "distant"),
      resident("angel-poring", 692, 271, 68, "air", "sky gap beside the moon", "distant", "left"),
      resident("hat-poring", 350, 430, 62, "rock", "dry portal ledge", "distant"),
      resident("blue-ghost", 834, 501, 63, "rock", "right lower dry crystal ledge", "middle", "left"),
      resident("leaf-poring", 270, 609, 84, "grass", "left glowing flower bank", "middle"),
      resident("lunatic", 478, 653, 86, "path", "near bend of the sanctuary trail", "foreground"),
      resident("pink-poring", 631, 714, 103, "path", "near sanctuary trail", "foreground"),
      resident("purple-poring", 835, 629, 96, "grass", "right foreground sanctuary bank", "foreground", "left"),
    ],
  },
};

const creatureRows: Record<Exclude<ThemeResidentId, "pink-poring" | "angel-poring">, number> = {
  "purple-poring": 0, "hat-poring": 1, "blue-ghost": 2, "leaf-poring": 3, lunatic: 4, "peco-chick": 5,
};

export const THEME_RESIDENT_SCALE_MULTIPLIERS: Readonly<Partial<Record<ThemeResidentId, number>>> = Object.freeze({
  "angel-poring": 1.3,
  "hat-poring": 1.2,
  "peco-chick": 1.2,
  "blue-ghost": 1.2,
});

export function themeResidentDetails(placement: ThemeResident, phase: ScenePhase = "day") {
  const added = placement.id === "pink-poring" || placement.id === "angel-poring";
  const atlas = (added ? poringAtlasData : creatureAtlasData) as unknown as SceneActorAtlas;
  const row = placement.id === "pink-poring" ? 0 : placement.id === "angel-poring" ? 1 : creatureRows[placement.id];
  // Angel Poring remains in its wing poses in the air; grounded residents rest at night.
  const sleeping = phase === "night" && placement.support !== "air";
  const columns = sleeping ? added ? [6, 7] : [4, 5] : [0, 1, 2, 3];
  const frames = sceneActorFrames(atlas, row, sleeping ? "night" : "day", columns)!;
  const scaleMultiplier = THEME_RESIDENT_SCALE_MULTIPLIERS[placement.id] ?? 1;
  const width = placement.width * scaleMultiplier;
  const scale = width / frames.cellWidth;
  const baseline = Math.max(...frames.frames.map(frame => frame.offsetTop + frame.height));
  return {
    ...placement, ...frames, baseline, scaleMultiplier, referenceWidth: placement.width,
    left: placement.x - width / 2,
    top: placement.y - baseline * scale,
    width,
    height: frames.cellHeight * scale,
  };
}
