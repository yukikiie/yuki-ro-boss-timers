# Native custom-boss portrait references

These are the user's verified native portrait references, downloaded unchanged from the public rxx-web monster image collection on 2026-10-21. Dark Chaser is 74×75 pixels; the other two PNGs are 75×75. These reference PNGs remain unchanged, rather than being cropped, repainted or moved as a substitute for character animation.

| Saved boss | File | Source |
| --- | --- | --- |
| 暗·逐影 (`custom-5qip79`) | `dark-chaser-30039.png` | https://rxx-web.vercel.app/img/game/monster/30039.png |
| 亡靈巫師 (`custom-14l2kgf`) | `undead-wizard-31014.png` | https://rxx-web.vercel.app/img/game/monster/31014.png |
| 殭屍龍 (`custom-1n83kp1`) | `zombie-dragon-30025.png` | https://rxx-web.vercel.app/img/game/monster/30025.png |

`lib/boss-portrait-icons.js` matches the exact saved IDs or normalized full names, plus explicit personal shortcuts from `lib/boss-names.js`, such as the approved 逐影 shortcut. Normalization does not invent other abbreviations such as 亡靈 or 龍. Its `portraitMotion` lookup keeps Dark Chaser and Zombie Dragon at sprite indices 18 and 20 in `/art/ro-pixel-motion-f.png`; Undead Wizard retains index 19 but now selects the coarse pixel restyle in `/art/ro-pixel-motion-h.png`. Each has four newly drawn articulated poses. The existing `AnimatedBossPortrait` renderer supplies the same discrete pose playback, global Pause, reduced-motion and visibility handling used by the original eighteen characters. The corresponding `lib/pixel-motion-*.json` files record actual dimensions, measured regions and idle silhouette areas. Native image paths remain available through `portraitIcon` for reference/fallback, but these matched cards select animated artwork first. The earlier atlas F remains unchanged, including its previous wizard row.

This art-only lookup adds no metadata, timers, default catalog records or notification behavior. Existing portrait-slot dimensions and all earlier action sheets remain unchanged. Generated poses follow the supplied identities and established pixel style; they are not official native game animation frames or an exact recovery of unavailable full-body references.

## 獸牙怪 articulated pixel portrait and retained native references

The existing 獸牙怪 (`custom-qinmln`) card now selects motion index 22 from `/art/ro-pixel-motion-i.png`: four newly drawn coarse pixel living-sword poses, with the red eye, toothed bone blade, burgundy hilt and short claws informed by https://ro.dvg.cn/monsterinfo.php?id=1204. Both exact traditional 獸牙怪 and simplified 兽牙怪 names resolve to the same motion. The card uses the shared `AnimatedBossPortrait` renderer, not native GIF playback, and inherits its existing global Pause, offscreen/hidden suspension and reduced-motion handling.

The earlier native references remain unchanged for compatibility and rollback. `tirfing-1204.gif`, downloaded from https://ro.dvg.cn/dbsource/mob/gif/1204.gif, retains its 82×126 transparent canvas and eighteen 100 ms frames. `tirfing-1204.png`, downloaded from https://ro.dvg.cn/dbsource/mob/png/1204.png, remains the transparent 47×93 first pose. The legacy `portraitAnimation` export still describes its original (18, 24) poster offset, but the matched card selects pixel motion before that fallback.

Only the source's 中型、暗、無形 attributes are added to this existing custom card. Its saved Mini classification, ID, timers and default catalog membership are unchanged; source level, combat statistics and spawn rules are not imported.

The retained native reference images originate from the referenced game-art collections, not this project's generated-art pipeline; no ownership or independent redistribution license is asserted here.

The new H and I atlases are generated pixel-style redraws using atlas A's thick stepped outlines, coarse shading and compact chibi proportions as their style reference; they are not official game frames. Their four complete poses use one fixed per-character optical scale in the existing portrait slot. No earlier raster asset, other character mapping, saved timer, metadata, route, notification behavior or header/garden layout changes as part of these two restyles.

## 基因 articulated portrait and attributes

The existing `custom-1hb3imu` record uses the personal display name 基因 and canonical identity 暗・基因學者. Its MVP classification, 中型、火、人形 attributes follow the user's supplied in-game references. This metadata-only addition does not add a default boss or rewrite any saved timer fields.

The portrait selects motion index 21 from the new transparent `/art/ro-pixel-motion-g.png` atlas, with four distinct drawn idle, wind-up, flaming-axe attack and recovery poses. The monochrome hair, high collar, segmented armor and flaming axe are redrawn from the supplied character references in the established portrait style; these are generated articulated poses, not official game animation frames or a cropped game screenshot. `lib/pixel-motion-g.json` records the source dimensions and measured complete pose regions. The existing visibility, global Pause and reduced-motion handling applies unchanged. Earlier portrait assets and all header/garden backgrounds remain byte-identical.
