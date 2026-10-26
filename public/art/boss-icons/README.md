# Native custom-boss portrait references

These are the user's verified native portrait references, downloaded unchanged from the public rxx-web monster image collection on 2026-10-21. Dark Chaser is 74×75 pixels; the other two PNGs are 75×75. These reference PNGs remain unchanged, rather than being cropped, repainted or moved as a substitute for character animation.

| Saved boss | File | Source |
| --- | --- | --- |
| 暗·逐影 (`custom-5qip79`) | `dark-chaser-30039.png` | https://rxx-web.vercel.app/img/game/monster/30039.png |
| 亡靈巫師 (`custom-14l2kgf`) | `undead-wizard-31014.png` | https://rxx-web.vercel.app/img/game/monster/31014.png |
| 殭屍龍 (`custom-1n83kp1`) | `zombie-dragon-30025.png` | https://rxx-web.vercel.app/img/game/monster/30025.png |

`lib/boss-portrait-icons.js` matches the exact saved IDs or normalized full names, plus explicit personal shortcuts from `lib/boss-names.js`, such as the approved 逐影 shortcut. Normalization does not invent other abbreviations such as 亡靈 or 龍. Its `portraitMotion` lookup keeps Dark Chaser, Undead Wizard and Zombie Dragon at sprite indices 18, 19 and 20, selecting their coarse pixel restyles from `/art/ro-pixel-motion-m.png`, `/art/ro-pixel-motion-h.png` and `/art/ro-pixel-motion-n.png` respectively. Each has four newly drawn articulated poses. The existing `AnimatedBossPortrait` renderer supplies the same discrete pose playback, global Pause, reduced-motion and visibility handling used by the original eighteen characters. The corresponding `lib/pixel-motion-*.json` files record actual dimensions, measured regions and idle silhouette areas. Native image paths remain available through `portraitIcon` for reference/fallback, but these matched cards select animated artwork first. The earlier atlas F remains unchanged for reference/rollback.

This art-only lookup adds no metadata, timers, default catalog records or notification behavior. Existing portrait-slot dimensions and all earlier action sheets remain unchanged. Generated poses follow the supplied identities and established pixel style; they are not official native game animation frames or an exact recovery of unavailable full-body references.

## 獸牙怪 articulated pixel portrait and retained native references

The existing 獸牙怪 (`custom-qinmln`) card now selects motion index 22 from `/art/ro-pixel-motion-i.png`: four newly drawn coarse pixel living-sword poses, with the red eye, toothed bone blade, burgundy hilt and short claws informed by https://ro.dvg.cn/monsterinfo.php?id=1204. Both exact traditional 獸牙怪 and simplified 兽牙怪 names resolve to the same motion. The card uses the shared `AnimatedBossPortrait` renderer, not native GIF playback, and inherits its existing global Pause, offscreen/hidden suspension and reduced-motion handling.

The earlier native references remain unchanged for compatibility and rollback. `tirfing-1204.gif`, downloaded from https://ro.dvg.cn/dbsource/mob/gif/1204.gif, retains its 82×126 transparent canvas and eighteen 100 ms frames. `tirfing-1204.png`, downloaded from https://ro.dvg.cn/dbsource/mob/png/1204.png, remains the transparent 47×93 first pose. The legacy `portraitAnimation` export still describes its original (18, 24) poster offset, but the matched card selects pixel motion before that fallback.

Only the source's 中型、暗、無形 attributes are added to this existing custom card. Its saved Mini classification, ID, timers and default catalog membership are unchanged; source level, combat statistics and spawn rules are not imported.

The retained native reference images originate from the referenced game-art collections, not this project's generated-art pipeline; no ownership or independent redistribution license is asserted here.

The new H and I atlases are generated pixel-style redraws using atlas A's thick stepped outlines, coarse shading and compact chibi proportions as their style reference; they are not official game frames. Their four complete poses use one fixed per-character optical scale in the existing portrait slot. No earlier raster asset, other character mapping, saved timer, metadata, route, notification behavior or header/garden layout changes as part of these two restyles.

## 基因 articulated portrait and attributes

The existing `custom-1hb3imu` record uses the personal display name 基因 and canonical identity 暗・基因學者. Its MVP classification, 中型、火、人形 attributes follow the user's supplied in-game references. This metadata-only addition does not add a default boss or rewrite any saved timer fields.

The portrait retains motion index 21 and now selects the coarse pixel redraw in `/art/ro-pixel-motion-l.png`, with four distinct drawn idle, wind-up, flaming-axe attack and recovery poses. The monochrome hair, high collar, segmented armor and flaming axe are redrawn from the supplied character references using atlas A's chunky stepped-outline style; these are generated articulated poses, not official game animation frames or a cropped game screenshot. `lib/pixel-motion-l.json` records the source dimensions and measured complete pose regions. The earlier atlas G remains byte-identical for reference/rollback. The existing visibility, global Pause and reduced-motion handling applies unchanged, as do all header/garden backgrounds.

## 代行 and 影龍 articulated portraits and attributes

The existing `custom-1xgl1sj` record keeps the visible shortcut 代行 and canonical lookup name 代行刑者, with the user's verified MVP / 中型 / 暗 / 天使 attributes. It selects motion index 23 from `/art/ro-pixel-motion-j.png`: four distinct drawn winged-warrior idle, weapon wind-up, attack and recovery poses.

The existing `custom-1hknmq6` record keeps the visible shortcut 影龍 and canonical lookup name 尼德豪克的影子, with the user's verified MVP / 大型 / 暗 / 龍 attributes. It selects motion index 24 from `/art/ro-pixel-motion-k.png`: four distinct drawn red shadow-dragon idle, charging, breath-attack and recovery poses.

Both new transparent atlases are built-in image-tool redraws using the supplied character references and atlas A's coarse stepped pixel/chibi style; they are not official game frames. `lib/pixel-motion-j.json` and `lib/pixel-motion-k.json` record their actual source dimensions, complete pose regions and weighted idle silhouette areas. Both use the existing four-pose renderer, fixed per-character optical scale, global Pause, reduced-motion and visibility handling. Exact full names and the approved shortcuts resolve without fuzzy matching. The accompanying L/M/N coarse-style alignment intentionally replaces only the active artwork at indices 21/18/20, without changing those identities or action timing. Every prior raster asset is retained unchanged; the original eighteen defaults, saved record names/IDs/timers, metadata for other bosses, subscriptions and header/garden artwork remain unchanged.
