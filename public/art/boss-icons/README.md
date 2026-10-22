# Native custom-boss portrait references

These are the user's verified native portrait references, downloaded unchanged from the public rxx-web monster image collection on 2026-10-21. Dark Chaser is 74×75 pixels; the other two PNGs are 75×75. These reference PNGs remain unchanged, rather than being cropped, repainted or moved as a substitute for character animation.

| Saved boss | File | Source |
| --- | --- | --- |
| 暗·逐影 (`custom-5qip79`) | `dark-chaser-30039.png` | https://rxx-web.vercel.app/img/game/monster/30039.png |
| 亡靈巫師 (`custom-14l2kgf`) | `undead-wizard-31014.png` | https://rxx-web.vercel.app/img/game/monster/31014.png |
| 殭屍龍 (`custom-1n83kp1`) | `zombie-dragon-30025.png` | https://rxx-web.vercel.app/img/game/monster/30025.png |

`lib/boss-portrait-icons.js` matches the exact saved IDs or normalized full names. Punctuation/spacing normalization does not introduce abbreviated aliases such as 逐影, 亡靈 or 龍. Its `portraitMotion` lookup selects sprite indices 18–20 from `/art/ro-pixel-motion-f.png`: Dark Chaser, Undead Wizard and Zombie Dragon, each with four newly drawn articulated pixel poses. The existing `AnimatedBossPortrait` renderer supplies the same discrete pose playback, global Pause, reduced-motion and visibility handling used by the original eighteen characters. `lib/pixel-motion-f.json` records actual dimensions, measured regions and idle silhouette areas. Native image paths remain available through `portraitIcon` for reference/fallback, but these three matched cards select animated artwork first.

This art-only lookup adds no metadata, timers, default catalog records or notification behavior. Existing portrait-slot dimensions and all earlier action sheets remain unchanged. Generated poses follow the supplied identities and established pixel style; they are not official native game animation frames or an exact recovery of unavailable full-body references.

## 獸牙怪 native animation

The existing 獸牙怪 (`custom-qinmln`) card uses the unchanged native TIRFING animation from https://ro.dvg.cn/monsterinfo.php?id=1204. `tirfing-1204.gif` is downloaded from https://ro.dvg.cn/dbsource/mob/gif/1204.gif: an 82×126 transparent canvas, eighteen 100 ms frames and an infinite loop. The complete sword remains inside the original canvas; it is not cropped, masked or repainted.

`tirfing-1204.png`, downloaded unchanged from https://ro.dvg.cn/dbsource/mob/png/1204.png, is the transparent 47×93 first pose. The renderer places it at (18, 24) inside the same 82×126 canvas when paused, offscreen, hidden or reduced-motion is enabled, avoiding a size or position jump. The earlier twenty-one articulated sprites are unchanged.

Only the source's 中型、暗、無形 attributes are added to this existing custom card. Its saved Mini classification, ID, timers and default catalog membership are unchanged; source level, combat statistics and spawn rules are not imported.

The images originate from the referenced game-art collections, not this project's generated-art pipeline; no ownership or independent redistribution license is asserted here.
