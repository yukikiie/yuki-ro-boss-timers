import argparse
import hashlib
import json
import shutil
from pathlib import Path

from PIL import Image


MONSTER_IDS = ("1063", "1242", "1388", "1572", "1727", "1894", "2316", "3505")


def main():
    parser = argparse.ArgumentParser(description="Losslessly export the supplied RO GIF frames for pausable header animation.")
    parser.add_argument("source_directory", type=Path)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    destination = root / "public" / "art" / "header-monsters"
    destination.mkdir(parents=True, exist_ok=True)
    sprites = {}

    for monster_id in MONSTER_IDS:
        original = args.source_directory / f"{monster_id}.gif"
        source_bytes = original.read_bytes()
        original_hash = hashlib.sha256(source_bytes).hexdigest()
        with Image.open(original) as gif:
            width, height = gif.size
            frame_count = gif.n_frames
            frames = []
            durations = []
            for index in range(frame_count):
                gif.seek(index)
                frames.append(gif.convert("RGBA").copy())
                durations.append(gif.info.get("duration", 100))

        if any(duration <= 0 for duration in durations):
            raise ValueError(f"{original.name}: animation has an invalid frame delay")
        if len(set(durations)) != 1:
            raise ValueError(f"{original.name}: nonuniform frame delays need a timed-frame renderer")
        strip = Image.new("RGBA", (width * frame_count, height))
        for index, frame in enumerate(frames):
            strip.paste(frame, (index * width, 0))
        exported = destination / f"{monster_id}-strip.png"
        strip.save(exported, optimize=True)
        with Image.open(exported) as saved:
            for index, frame in enumerate(frames):
                if saved.crop((index * width, 0, (index + 1) * width, height)).tobytes() != frame.tobytes():
                    raise ValueError(f"{original.name}: exported frame {index} differs from the original")

        shutil.copy2(original, destination / original.name)
        if hashlib.sha256((destination / original.name).read_bytes()).hexdigest() != original_hash:
            raise ValueError(f"{original.name}: original GIF copy differs")
        bounds = [frame.getbbox() for frame in frames]
        sprites[monster_id] = {
            "id": monster_id,
            "source": f"/art/header-monsters/{monster_id}-strip.png",
            "sourceGif": f"/art/header-monsters/{monster_id}.gif",
            "width": width,
            "height": height,
            "frameCount": frame_count,
            "durationsMs": durations,
            "durationMs": sum(durations),
            "footY": max(bound[3] for bound in bounds if bound),
            "sourceSha256": original_hash,
        }

    manifest = root / "lib" / "imported-header-sprites.json"
    manifest.write_text(json.dumps(sprites, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"sprites": len(sprites), "frames": sum(sprite["frameCount"] for sprite in sprites.values()), "pixelVerification": "all frames exact", "manifest": str(manifest)}))


if __name__ == "__main__":
    main()
