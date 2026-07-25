#!/usr/bin/env python3
"""Re-tune all catalog images from saved raw packs (white background)."""

from __future__ import annotations

import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "tmp" / "anil-raw" / "catalog"
OUT = ROOT / "public" / "images" / "catalog"

spec = importlib.util.spec_from_file_location("uci", ROOT / "scripts" / "update-catalog-images.py")
uci = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(uci)

slugs = sorted(
    {
        p.stem
        for p in RAW.iterdir()
        if p.suffix.lower() in {".png", ".jpg", ".jpeg"} and not p.name.endswith(".bin")
    }
)

for slug in slugs:
    src = None
    for ext in (".png", ".jpg", ".jpeg"):
        cand = RAW / f"{slug}{ext}"
        if cand.exists():
            src = cand
            break
    if not src:
        print(f"skip {slug}")
        continue
    dest = OUT / f"{slug}.jpg"
    print(f"{slug}: {src.name} -> {dest.name}")
    uci.tune_background(src, dest)

print(f"Done {len(slugs)} images")
