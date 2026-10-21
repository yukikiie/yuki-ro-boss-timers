# RO artwork assets and preview provenance

## Current header motion and boss portraits

The timer app selects the taller header and pixel-style portraits for all eighteen catalog bosses. The main app uses saved account timers and Auto Hong Kong lighting. Daily routines belong only to the header's twelve decorative residents; they are not boss-card routines. The canonical `/header-preview` uses English preview controls and the actual reusable timer UI with sample data. `/routine-preview`, `/animation-preview` and `/scene-preview` alias it. `/header-layout-preview` also demonstrates the taller landscape. Preview routes remain non-mutating and separate from real account state.

### Header residents and movement

- `../art/ro-garden-creatures.png`: 1254×1254 RGBA; six species with four play poses and two sleeping poses each.
- `../art/ro-garden-walk.png`: 1254×1254 RGBA; dedicated walking poses for the same six species.
- `../art/ro-garden-people.png`: 2172×724 RGBA; novice and priest, four awake poses and two resting poses each.
- `../art/ro-header-added-porings.png`: plain pink Poring and pink winged Angel Poring; eight poses each, including four slither/flight poses, two playful poses and two sleeping poses.
- `../art/ro-header-added-companions.png`: Moonlight Cat and Alice Maid; four walking poses, two bell/sweeping poses and two sleeping poses each. Actual image dimensions and measured eight-column regions are recorded in `lib/garden-added-porings-atlas.json` and `lib/garden-added-companions-atlas.json`; prompts and reference URLs are in the matching `output/ro-header-added-*-prompts.txt` files.
- `lib/garden-creatures-atlas.json`, `lib/garden-walk-atlas.json` and `lib/garden-people-atlas.json` hold actual dimensions and measured silhouette regions. Generated rows/columns are not uniformly spaced; do not substitute nominal equal cells.
- `lib/scene-actor.ts` preserves common source scale and baseline without independently zooming each frame. Explicit unique SVG clips prevent neighboring sprites from leaking through.
- `lib/header-crowd.ts` coordinates all twelve residents with full-box spacing, collision-aware travel, yielding, idle and playful stops. Angel Poring has a raised flight lane and a separate nighttime branch. A single active-time clock belongs to each header. Night uses separated resting anchors. The tall header applies a separate 76-unit upward actor offset.
- Tall-layout creature routes extend into the lower foreground meadow, including lower initial positions and frequent play stops. People remain on the upper path. The standard layout keeps its original map bounds; no sprites are enlarged or cropped for this change.

The original six monsters are purple bat Poring, hat Poring, blue ghost Poring, leaf Poring, Lunatic rabbit and Peco chick; the original people are the novice and priest. Plain pink Poring, pink Angel Poring, Moonlight Cat and Alice Maid join them without changing boss records. Their identities follow the user's RO monster references, not the blue Holy Angel Poring boss portrait. Night uses genuine closed-eye art, plus separate code-native Zzz and face-positioned breathing bubbles. The airship has a sleeping face at night and its propeller stops. Exactly one affection mark remains beside the purple Poring. These are decorative residents, never invented timer records.

Pause, reduced-motion, offscreen and hidden-document suspension apply to header motion. Reduced motion preserves a visible static pose and sleep marks. The renderer must use the actual measured clips and face anchors, not uniform atlas assumptions or a generic upper-right nose-bubble position.

### Complete header and garden paintings

- `../art/ro-header-residents-morning.png` and `../art/ro-header-residents-afternoon.png`: 1672×941 RGB.
- `../art/ro-header-residents-night.png`: 1671×941 RGB, normalized to the same logical display geometry.
- `../art/ro-header-tall-preview.png`, `../art/ro-header-tall-morning.png` and `../art/ro-header-tall-night.png`: 1448×1086 RGB; the selected 4:3 timer header uses a 1672×1254 logical scene.
- `../art/ro-garden-morning.png`, `../art/ro-garden-afternoon.png` and `../art/ro-garden-night.png`: 739×2129 RGB, relit full-height gardens with corresponding landmarks.

The base headers remove baked foreground residents so awake duplicates cannot remain under a sleeping actor. Each painting is displayed whole, once, without screenshot patchwork. The scrolling garden is one unique continuous image with `no-repeat`, not fixed scenery or tiled strips. Its width-fitted 739:2129 geometry and matching animation overlay never depend on roster height. Empty and filtered lists retain the full painting's minimum height; longer lists continue on a phase-matched solid base after the painting ends. Artwork is never cropped, stretched, zoomed, mirrored or repeated to accommodate cards. Extending the illustrated landscape requires newly drawn terrain in a new asset. Non-timer pages preserve the complete 1536×1024 earlier map at 3:2 using `contain`; the selected 4:3 timer header is unchanged.

Hong Kong time selects morning 06:00–11:59, sunny afternoon 12:00–17:59 and night 18:00–05:59. These are independently generated lighting edits, not a color filter applied to the interface. Morning is fresh/soft, afternoon is bright shiny sunlight rather than sunset, and night includes stars, moonlight and locally luminous water/flowers. Foreground controls and boss cards retain their normal colors.

Header prompt provenance: `output/ro-garden-walk-prompts.txt`, `output/ro-garden-people-prompts.txt`, `output/ro-living-garden-prompts.txt`, `output/ro-resident-header-prompts.txt`, `output/ro-header-tall-preview-prompt.txt` and `output/ro-header-tall-phases-prompts.txt`. Garden lighting prompts remain in `output/ro-garden-time-prompts.txt`. All raster edits use the built-in image tool and are copied unchanged; exact pixel identity outside a generated edit is not guaranteed.

## Pixel-style boss-card action artwork

All eighteen catalog bosses use pixel-style action artwork: four selected poses each, seventy-two selected poses across five transparent atlases. `app/components/animated-boss-portrait.tsx` uses the action sequences through explicit per-boss atlas/row mappings in `lib/boss-motion.ts` in every phase; it does not select sleeping or daytime-play boss art. Apparent portrait sizing is normalized against the first two bosses with fixed per-character optical viewports and one common portrait slot. Card clearance preserves action extents without independent frame scaling.

- `../art/ro-pixel-motion-a.png`: 1254×1254 RGBA; Atroce, Tanee, Boitata and Wanderer.
- `../art/ro-pixel-motion-b.png`: 1254×1254 RGBA; Dark Elementalist, Naght, Coelacanth and Dark Ranger.
- `../art/ro-pixel-motion-c.png`: 1254×1254 RGBA; Death Knight, Fallen Bishop, head-only Tao and Ice Dragon.
- `../art/ro-pixel-motion-d.png`: 1254×1254 RGBA; Restful, Chimera, Holy Poring and the preserved previous Morocc drawing. Its last row is no longer selected.
- `../art/ro-pixel-motion-e.png`: corrected brown, bony-faced Morocc, pale asymmetric Shadow Demon (影魔) and green armored Orc Hero (獸人英雄), three rows of four compact action poses. Actual dimensions and full-silhouette regions are in `lib/pixel-motion-e.json`; the user references and prompt set are in `output/ro-pixel-motion-e-prompts.txt`.

The approved pixel reference guides stepped outlines, compact silhouettes and simplified shading. These are generated pixel-style drawings, not a mathematically exact native 64×64 grid or a promise of perfect reference matching. `lib/pixel-motion-a.json` through `lib/pixel-motion-d.json` record actual image dimensions, measured per-frame regions and weighted idle silhouette areas; do not assume uniform generated cells. Prompts, generation choices and limitations are recorded in `output/ro-pixel-motion-a-prompt.txt` through `output/ro-pixel-motion-d-prompt.txt`. The original action assets below are preserved unchanged for rollback.

### Preserved original action sheets

- `../art/ro-motion-a.png`: 1254×1254 RGBA; Atroce claw/jaw, Tanee gesture/hair, Boitata hood/jaw/tail, Wanderer sword action.
- `../art/ro-motion-b.png`: 1536×1024 RGBA; Elementalist staff, Naght fists/jaws, Coelacanth bite/fins, Ranger draw/release. Some spell edges/glows are partially transparent; retain alpha.
- `../art/ro-motion-c.png`: 1254×1254 RGBA; Death Knight/horse, Bishop/two orbs, head-only Tao eyes/crystals, Ice Dragon breath/wings.
- `../art/ro-motion-d.png`: 1254×1254 RGBA; Restful wings/skull, Chimera roar/serpents, Holy Poring wings/face, Morocc claws/shoulder eyes.

These original illustrated sheets remain available for rollback, rather than the current pixel-style portrait selection. Their measured source regions and shared canvases avoid independent frame zooming; small generated registration differences can remain. The selected first-three illustrations guided their design/style, not a pixel-identical recovery. Their prompts and limitations remain in `output/ro-motion-a-b-prompts.txt` and `output/ro-motion-c-d-prompts.txt`.

The four boss day/night routine sheets were an incorrect interpretation of a header-only request. They are archived under `output/unused-boss-routine-study/`, outside `public/`, and have no active renderer metadata. They are studies only, not selected Site assets. Boss timers/status, roster, reminders and notification subscriptions are unaffected.

## Retained static and legacy artwork

These remain for rollback/reference, not the current action portrait selection:

- `../art/ro-redrawn-main.png`: 1774×887 RGBA; Wanderer, Dark Elementalist, Naght, Coelacanth, Dark Ranger, Death Knight, Fallen Bishop and Tao. Use measured nonuniform bounds.
- `../art/ro-redrawn-expansion.png`: 1774×887 RGBA; Ice Dragon, Restful, Chimera, Holy Angel Poring and Morocc, plus three transparent cells.
- `ro-bosses-standalone.png`: 1448×1086 RGBA; eleven monsters in four 362-pixel columns, with row boundaries at 0, 390, 715 and 1086, not equal thirds.
- `ro-bosses-expansion-standalone.png`: 1774×887 RGBA; five monsters plus three transparent cells.
- `ro-map-standalone.png`: 1536×1024 opaque earlier map, retained for other pages/rollback.
- `poring-standalone.png`: 1254×1254 RGBA; full transparent Poring used by app/notification icons and non-timer headings.
- `ro-world.webp`, `ro-map.webp`, `ro-bosses.webp`, `ro-bosses-reference-v2.webp`, `ro-bosses-expansion.webp` and `ro-bosses-expansion-reference-v3.webp`: legacy paintings/atlases, not the current timer header or action portraits.

Earlier scene/redraw prompts remain in `output/ro-regenerated-scenes-prompts.txt`, `output/ro-redrawn-main-prompt.txt`, `output/ro-redrawn-expansion-prompt.txt`, `output/ro-main-standalone-prompt.txt` and `output/ro-standalone-support-prompts.txt`. The old extraction trial `output/ro-b-extraction-unused.png` and its prompt are not selected by the UI.

## Typography and interface

Names, compact size/element/race badges, navigation and controls are real text or code-native symbols. Chinese UI text uses `public/fonts/BosswatchUI-Reference800.woff2`, an OFL-licensed Noto Sans TC weight-800 subset, not the generated reference's original font. The illustrated title has an accessible HTML heading. Countdown digits, colon and dash use consistent native SVG paths, not extracted raster glyphs.

Preview routes use sample state and never read or mutate real timers or register/send push notifications. The manifest identity and notification subscription scope remain unchanged.
