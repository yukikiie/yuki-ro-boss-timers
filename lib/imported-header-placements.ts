import type { BackgroundThemeId } from "./background-themes";
import type { ThemeLayout } from "./theme-residents";

export type ImportedHeaderFileId = "1063" | "1242" | "1388" | "1572" | "1727" | "1894" | "2316" | "3505";
export type ImportedHeaderPlacement = {
  fileId: ImportedHeaderFileId;
  x: number;
  y: number;
  width: number;
  support: "grass" | "path" | "rock" | "branch" | "air";
  landmark: string;
  depth: "distant" | "middle" | "foreground";
};

function placement(fileId: ImportedHeaderFileId, x: number, y: number, width: number, support: ImportedHeaderPlacement["support"], landmark: string, depth: ImportedHeaderPlacement["depth"]): ImportedHeaderPlacement {
  return { fileId, x, y, width, support, landmark, depth };
}

export const IMPORTED_HEADER_PLACEMENTS: Record<BackgroundThemeId, Record<ThemeLayout, ImportedHeaderPlacement[]>> = {
  "moon-garden": {
    desktop: [
      placement("1063", 528, 204, 46, "grass", "dry middle garden landing beside the stone path", "middle"),
      placement("1242", 278, 217, 46, "grass", "grass on the left middle garden landing", "middle"),
      placement("1388", 828, 146, 36, "air", "open air beside the upper waterfall", "distant"),
      placement("1572", 360, 272, 58, "grass", "grass beside the inner path bend", "foreground"),
      placement("1727", 480, 151, 34, "grass", "upper garden terrace below the castle", "distant"),
      placement("1894", 89, 290, 58, "rock", "flat left foreground garden stone", "foreground"),
      placement("2316", 628, 267, 46, "grass", "middle flower verge before the stream bank", "middle"),
      placement("3505", 866, 224, 46, "path", "dry right half of the wooden bridge deck", "middle"),
    ],
    mobile: [
      placement("1063", 538, 369, 72, "grass", "dry upper garden terrace beside the castle steps", "distant"),
      placement("1242", 560, 476, 90, "grass", "middle garden grass to the left of the stream", "middle"),
      placement("1388", 830, 319, 72, "air", "open air in front of the waterfall cliffs", "distant"),
      placement("1572", 580, 721, 116, "path", "near bend of the broad garden path", "foreground"),
      placement("1727", 323, 372, 64, "grass", "left terrace beside the castle path", "distant"),
      placement("1894", 940, 497, 88, "rock", "dry right bridge-bank ledge", "middle"),
      placement("2316", 491, 565, 86, "path", "middle bend of the stone garden path", "middle"),
      placement("3505", 210, 688, 118, "grass", "left foreground flower bank", "foreground"),
    ],
  },
  "mushroom-forest": {
    desktop: [
      placement("1063", 475, 235, 46, "grass", "dry centre-left forest clearing", "middle"),
      placement("1242", 418, 241, 46, "grass", "left middle clearing grass", "middle"),
      placement("1388", 222, 178, 36, "air", "air beneath the left mushroom canopy", "distant"),
      placement("1572", 545, 276, 58, "path", "middle bend of the clearing trail", "foreground"),
      placement("1727", 526, 210, 34, "grass", "upper clearing grass below the arch approach", "distant"),
      placement("1894", 866, 275, 58, "grass", "open right foreground meadow", "foreground"),
      placement("2316", 343, 295, 58, "grass", "lower left clearing beside the trail", "foreground"),
      placement("3505", 690, 249, 46, "grass", "right middle clearing grass", "middle"),
    ],
    mobile: [
      placement("1063", 520, 437, 84, "path", "dry path below the rune arch steps", "middle"),
      placement("1242", 410, 471, 88, "grass", "left trail verge below the roots", "middle"),
      placement("1388", 834, 339, 72, "air", "open air above the right grassy ledge", "distant"),
      placement("1572", 588, 551, 116, "path", "middle forest trail bend", "foreground"),
      placement("1727", 376, 337, 64, "rock", "mossy left distant terrace lip", "distant"),
      placement("1894", 804, 610, 116, "grass", "right lower clearing grass", "foreground"),
      placement("2316", 542, 714, 116, "path", "front curve of the forest trail", "foreground"),
      placement("3505", 162, 704, 112, "rock", "left foreground mossy stone beside the ferns", "foreground"),
    ],
  },
  "sky-islands": {
    desktop: [
      placement("1063", 460, 232, 50, "path", "clear centre of the main island trail", "middle"),
      placement("1242", 530, 129, 34, "grass", "middle arch-island turf left of the wizard Poring", "distant"),
      placement("1388", 905, 166, 48, "air", "open clouds below the right arch island", "middle"),
      placement("1572", 646, 269, 58, "path", "right bend of the main island trail", "foreground"),
      placement("1727", 376, 116, 32, "grass", "distant island beside its pink shrub", "distant"),
      placement("1894", 337, 199, 46, "rock", "flat stone along the main island back edge", "middle"),
      placement("2316", 715, 244, 54, "grass", "back grass of the main island", "middle"),
      placement("3505", 80, 217, 58, "grass", "left main-island turf beneath the cherry tree", "middle"),
    ],
    mobile: [
      placement("1063", 640, 447, 100, "path", "clear right side of the main island trail", "middle"),
      placement("1242", 420, 329, 72, "grass", "small middle-left island beneath its yellow tree", "distant"),
      placement("1388", 788, 363, 90, "air", "cloud gap beside the right pink-shrub island", "middle"),
      placement("1572", 690, 560, 115, "grass", "right foreground turf beside the island trail", "foreground"),
      placement("1727", 574, 174, 64, "grass", "upper island beneath its pink tree", "distant"),
      placement("1894", 930, 382, 92, "rock", "right main-island rear stone landing", "middle"),
      placement("2316", 515, 430, 95, "grass", "upper main-island trail verge", "middle"),
      placement("3505", 105, 493, 112, "grass", "left main-island grass near the rim", "foreground"),
    ],
  },
  "crystal-cavern": {
    desktop: [
      placement("1063", 661, 286, 48, "rock", "dry right centre of the main stone floor", "foreground"),
      placement("1242", 406, 162, 34, "rock", "left middle stone stair landing", "distant"),
      placement("1388", 365, 130, 36, "air", "open cave air above the left shelf", "distant"),
      placement("1572", 505, 276, 58, "rock", "central dry stone floor", "foreground"),
      placement("1727", 739, 135, 34, "rock", "right upper dry shelf", "distant"),
      placement("1894", 228, 245, 46, "rock", "left edge of the dry main platform", "middle"),
      placement("2316", 671, 232, 46, "rock", "right rear of the main stone floor", "middle"),
      placement("3505", 891, 204, 46, "rock", "right lower crystal shelf", "middle"),
    ],
    mobile: [
      placement("1063", 446, 458, 86, "rock", "dry back-left edge of the main platform", "middle"),
      placement("1242", 556, 429, 84, "rock", "dry central rear stone landing", "middle"),
      placement("1388", 388, 264, 72, "air", "open air above the left middle ledges", "distant"),
      placement("1572", 408, 600, 116, "rock", "front left of the broad stone platform", "foreground"),
      placement("1727", 370, 329, 64, "rock", "left middle dry shelf beside the crystals", "distant"),
      placement("1894", 686, 482, 90, "rock", "right rear of the dry central platform", "middle"),
      placement("2316", 678, 593, 112, "rock", "near right central stone floor", "foreground"),
      placement("3505", 918, 426, 82, "rock", "dry right lower shelf above the pool", "middle"),
    ],
  },
  "cosmic-sanctuary": {
    desktop: [
      placement("1063", 360, 278, 48, "rock", "dry left foreground terrace beside the trail", "foreground"),
      placement("1242", 353, 234, 46, "rock", "dry crystal ledge on the left bank", "middle"),
      placement("1388", 399, 160, 36, "air", "open air beside the left luminous trees", "distant"),
      placement("1572", 495, 295, 58, "path", "middle bend of the foreground sanctuary trail", "foreground"),
      placement("1727", 330, 124, 34, "grass", "upper left terrace beneath the blue canopy", "distant"),
      placement("1894", 900, 218, 46, "rock", "right dry upper stone platform", "middle"),
      placement("2316", 682, 314, 58, "grass", "near right sanctuary trail verge", "foreground"),
      placement("3505", 263, 288, 58, "rock", "left foreground flat stone terrace", "foreground"),
    ],
    mobile: [
      placement("1063", 800, 414, 88, "rock", "dry right upper sanctuary platform", "middle"),
      placement("1242", 238, 450, 90, "rock", "left portal landing beside the tree roots", "middle"),
      placement("1388", 850, 308, 72, "air", "open air beneath the right luminous bough", "distant"),
      placement("1572", 594, 627, 116, "grass", "central foreground sanctuary trail verge", "foreground"),
      placement("1727", 438, 385, 64, "grass", "small left-bank terrace above the cascade", "distant"),
      placement("1894", 941, 490, 86, "rock", "right lower sanctuary ledge", "middle"),
      placement("2316", 728, 586, 100, "rock", "near right dry bank stone", "foreground"),
      placement("3505", 150, 625, 116, "grass", "left foreground flower bank", "foreground"),
    ],
  },
};
