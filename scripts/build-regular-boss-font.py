import hashlib
import json
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / "output/font-tools"))
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

source = root / "output/NotoSansTC-full.ttf"
font = instantiateVariableFont(TTFont(source), {"wght": 400}, inplace=True)
font.flavor = "woff2"
destination = root / "public/fonts/BosswatchBossNames-400.woff2"
font.save(destination)
saved = TTFont(destination)
print(json.dumps({"file": destination.name, "weight": saved["OS/2"].usWeightClass, "codepoints": len(saved.getBestCmap()), "sha256": hashlib.sha256(destination.read_bytes()).hexdigest()}))
