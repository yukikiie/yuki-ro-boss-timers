# Uniform boss-name typeface

`BosswatchBossNames-800.woff2` is a full Traditional Chinese, Latin and numeric Noto Sans TC instance at weight 800. It replaces the limited 546-character UI subset only for boss names. All card and upcoming-route names share this face, weight and 17px size; long names wrap instead of selecting a smaller font.

The original `BosswatchUI-Reference800.woff2` and expansion remain unchanged for the rest of the interface. The full name font covers all current canonical names and personal shortcuts, including 代行、影龍、亡靈巫師、獸牙怪 and 基因 without per-character fallback.

Source: [Google Fonts Noto Sans TC](https://github.com/google/fonts/tree/main/ofl/notosanstc), `NotoSansTC[wght].ttf`, version 2.004-H2. The source SHA-256 is `864727d210d54f2537bbe23b3a839436c3992af72de9322af5270897246bd44f`. FontTools instanced weight 800 and encoded WOFF2 without subsetting. The bundled font SHA-256 is `b426834edc30738ecbac8c057c7435d95e042b4b6a6a5a02f3018c9f00684839` and its cmap contains 20,745 codepoints.

License: `BosswatchBossNames-NotoSansTC-OFL.txt`. The font is self-hosted; visitors do not contact a third-party font service. Regression tests decode the bundled WOFF2 cmap directly and check every catalog name, canonical name and shortcut.
