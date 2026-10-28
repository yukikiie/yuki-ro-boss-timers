# Supplied RO header monsters

The eight numbered GIFs are user-provided artwork. They are retained byte for byte.

The matching `-strip.png` files contain every coalesced GIF frame on its complete original canvas. Transparency, colors, pixel positions and frame delays are unchanged. They remain identity and motion references; the active header uses the matching illustrated four-pose artwork in `ro-header-imported-monsters-style-v3.png`.

Dimensions, frame delays and original GIF SHA-256 hashes are recorded in `lib/imported-header-sprites.json`. Regenerate with `scripts/import-header-gifs.py SOURCE_DIRECTORY`; the importer verifies every exported RGBA frame against the GIF decode.

The illustrated atlas was redrawn with built-in ImageGen against the existing `ro-garden-creatures.png` style master. Its measured poses and optical areas are in `lib/imported-header-style-atlas.json`; regenerate measurements with `scripts/measure-header-style-atlas.py`. The supplied GIFs and original header artwork are unchanged.
