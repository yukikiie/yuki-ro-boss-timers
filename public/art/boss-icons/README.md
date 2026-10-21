# Native custom-boss portrait references

These are the user's verified native portrait references, downloaded unchanged from the public rxx-web monster image collection on 2026-10-21. Dark Chaser is 74×75 pixels; the other two PNGs are 75×75. They are not generated artwork, screenshot crops or invented full-body sprites. They remain static; the existing eighteen catalog portraits retain their four-pose animations.

| Saved boss | File | Source |
| --- | --- | --- |
| 暗·逐影 (`custom-5qip79`) | `dark-chaser-30039.png` | https://rxx-web.vercel.app/img/game/monster/30039.png |
| 亡靈巫師 (`custom-14l2kgf`) | `undead-wizard-31014.png` | https://rxx-web.vercel.app/img/game/monster/31014.png |
| 殭屍龍 (`custom-1n83kp1`) | `zombie-dragon-30025.png` | https://rxx-web.vercel.app/img/game/monster/30025.png |

`lib/boss-portrait-icons.js` matches the exact saved IDs or normalized full names. Punctuation/spacing normalization does not introduce abbreviated aliases such as 逐影, 亡靈 or 龍. This art-only lookup adds no metadata, timers, default catalog records or notification behavior. The UI preserves the existing portrait slot and fits each native portrait into a round presentation frame without altering the PNG bytes.

The images originate from the referenced game-art collection, not this project's generated-art pipeline; no ownership or independent redistribution license is asserted here.
