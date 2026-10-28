import json
from pathlib import Path

from PIL import Image


def main():
    root = Path(__file__).resolve().parents[1]
    source = root / "public" / "art" / "ro-header-imported-monsters-style-v3.png"
    image = Image.open(source).convert("RGBA")
    alpha = image.getchannel("A")
    occupied_rows = []
    start = None
    for y in range(image.height):
        occupied = alpha.crop((0, y, image.width, y + 1)).getextrema()[1] > 32
        if occupied and start is None:
            start = y
        if not occupied and start is not None:
            occupied_rows.append((start, y))
            start = None
    if start is not None:
        occupied_rows.append((start, image.height))
    if len(occupied_rows) != 8:
        raise ValueError(f"Expected eight clear rows, found {occupied_rows}")

    row_cuts = [0] + [(previous[1] + following[0]) // 2 for previous, following in zip(occupied_rows, occupied_rows[1:])] + [image.height]
    rows = []
    column_cuts = []
    frame_areas = []
    for row_index in range(8):
        top, bottom = row_cuts[row_index:row_index + 2]
        cuts = [0]
        for column in range(1, 4):
            middle = image.width * column / 4
            radius = image.width / 16
            candidates = range(round(middle - radius), round(middle + radius) + 1)
            cut = min(candidates, key=lambda x: (sum(alpha.crop((x, top, x + 1, bottom)).getdata()), abs(x - middle)))
            if alpha.crop((cut, top, cut + 1, bottom)).getextrema()[1] > 8:
                raise ValueError(f"Row {row_index}: no transparent separator for pose {column}")
            cuts.append(cut)
        cuts.append(image.width)
        bounds = []
        areas = []
        for left, right in zip(cuts, cuts[1:]):
            cell = alpha.crop((left, top, right, bottom))
            box = cell.point(lambda value: 255 if value > 8 else 0).getbbox()
            if box is None:
                raise ValueError("Empty sprite pose")
            x1, y1, x2, y2 = box
            if (left == 0 and x1 == 0) or (right == image.width and x2 == right - left):
                raise ValueError(f"Row {row_index}: sprite touches the artwork edge")
            bounds.append([left + x1, top + y1, x2 - x1, y2 - y1])
            areas.append(sum(value > 32 for value in cell.getdata()))
        rows.append(bounds)
        column_cuts.append(cuts)
        frame_areas.append(areas)

    metadata = {
        "source": "/art/ro-header-imported-monsters-style-v3.png",
        "width": image.width,
        "height": image.height,
        "fileIds": ["1063", "1242", "1388", "1572", "1727", "1894", "2316", "3505"],
        "rows": rows,
        "rowCuts": row_cuts,
        "rowColumnCuts": column_cuts,
        "idleAreas": [areas[0] for areas in frame_areas],
        "frameAreas": frame_areas,
    }
    output = root / "lib" / "imported-header-style-atlas.json"
    output.write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"metadata": str(output), "rows": len(rows), "poses": sum(map(len, rows)), "rowCuts": row_cuts, "bounds": rows}))


if __name__ == "__main__":
    main()
