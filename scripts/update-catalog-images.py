#!/usr/bin/env python3
"""Download real Sivakasi cracker product pack photos, light background tune."""

from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

from PIL import Image, ImageEnhance

ROOT = Path(__file__).resolve().parents[1]
HTML_DIR = ROOT / "tmp" / "anil-html"
OUT_DIR = ROOT / "public" / "images" / "catalog"
RAW_DIR = ROOT / "tmp" / "anil-raw" / "catalog"
OUT_DIR.mkdir(parents=True, exist_ok=True)
RAW_DIR.mkdir(parents=True, exist_ok=True)

UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)

# Prefer short product-pack filenames (500x500.png). Avoid *-1000x1000.jpeg
# (those are Anil safety-instruction sheets on IndiaMART).
CATEGORY_PICK: dict[str, list[str]] = {
    "single-sound-crackers": ["4-inch-anil-crackers", "3-5-lakshmi"],
    "deluxe-crackers": ["deluxe-anil-crackers", "4-inch-anil"],
    "giant-crackers": ["giant-crackers"],
    "garland": ["bijili-chorsa", "bijli"],
    "bijili": ["bijili-chorsa", "bijli"],
    "bomb-item": ["atom-bomb-dynamite", "junglee-bomb"],
    "adiyal": ["assorted-cartoons"],
    "ground-chakkar": ["whistling-wheel-chakkar", "whistling-wheel"],
    "special-chakkar": ["swastika-spinner"],
    "flower-pots": ["flower-pots-small"],
    "peacock-series": ["mor-pankh"],
    "twinkling-star": ["4-dlx-twinkle-star", "2-twinkle-star", "1-5-twinkle"],
    "lovely-sparkler": ["anil-candle-sparkler", "pul-pul"],
    "rocket": ["cannan-shot", "cannon"],
    "children-special": ["little-pops"],
    "new-arrival": ["green-pops", "toy-twist"],
    "multicolor-fountain": ["flower-pots-big-fountain", "flower-pots-big", "multi-colour"],
    "special-edition-2025": ["magizhchi-diwali-gift", "gift-pack"],
    "shot-items": ["cannan-shot", "cannon"],
    "fancy-out-items": ["rec-reg", "green-pops", "glit"],
    "sparkler-7cm": ["anil-candle-sparkler", "pul-pul"],
    "sparkler-10cm": ["pul-pul", "anil-candle"],
    "sparkler-15cm": ["glary-glory-white-blinkling", "glary"],
    "sparkler-30cm": ["30-cm-colour-sparklers", "anil-candle-sparkler"],
    "sparkler-50cm": ["glary-glory", "emeralld", "rangeela"],
}


def collect_pack_urls() -> list[str]:
    """Collect product-pack image URLs (prefer 500x500.png packs)."""
    pat = re.compile(r"https://5\.imimg\.com/data5/[^\"\s,]+\.(?:jpg|jpeg|png|webp)", re.I)
    urls: list[str] = []
    seen: set[str] = set()
    for f in sorted(HTML_DIR.glob("*.html")):
        text = f.read_text(errors="ignore")
        # og:image first — usually the real pack shot
        for m in re.findall(r'og:image" content="(https://5\.imimg\.com/[^"]+)"', text):
            if m not in seen:
                seen.add(m)
                urls.append(m)
        for u in pat.findall(text):
            if any(x in u for x in ("Logo", "125x125", "250x250", "90x90", "120x120", "VideoImage")):
                continue
            # Skip safety-instruction style large jpegs
            name = u.split("/")[-1].lower()
            if name.startswith("anil-") and "1000x1000" in name and name.endswith((".jpeg", ".jpg")):
                continue
            if u not in seen:
                seen.add(u)
                urls.append(u)
    return urls


def score_url(url: str, prefs: list[str]) -> tuple[int, int, str]:
    name = url.split("/")[-1].lower()
    pref_rank = 99
    for i, p in enumerate(prefs):
        if p in name:
            pref_rank = i
            break
    # Prefer 500x500 png packs
    size_rank = 0 if "500x500" in name else 1 if "1000x1000" in name else 2
    fmt_rank = 0 if name.endswith(".png") else 1
    return (pref_rank, size_rank, fmt_rank, name)


def pick_url(all_urls: list[str], prefs: list[str]) -> str | None:
    matched = [u for u in all_urls if any(p in u.lower() for p in prefs)]
    if not matched:
        return None
    matched.sort(key=lambda u: score_url(u, prefs))
    return matched[0]


def download(url: str, dest: Path) -> bool:
    dest.parent.mkdir(parents=True, exist_ok=True)
    try:
        r = subprocess.run(
            [
                "curl",
                "-fsSL",
                "-A",
                UA,
                "-e",
                "https://www.anilcelebrations.net/",
                "-H",
                "Accept: image/*,*/*",
                "-o",
                str(dest),
                url,
            ],
            capture_output=True,
            text=True,
            timeout=60,
        )
        if r.returncode != 0 or not dest.exists() or dest.stat().st_size < 500:
            print(f"  FAIL {url}: {r.stderr.strip() or 'empty'}")
            if dest.exists():
                dest.unlink(missing_ok=True)
            return False
        return True
    except Exception as e:
        print(f"  FAIL {url}: {e}")
        return False


def _is_backdrop(rgb: tuple[int, int, int], seed: tuple[int, int, int], tol: int = 56) -> bool:
    """True for dark/gray studio vignette pixels (not colorful pack art)."""
    r, g, b = rgb
    sr, sg, sb = seed
    if abs(r - sr) <= tol and abs(g - sg) <= tol and abs(b - sb) <= tol:
        # Avoid wiping light-but-colored pack pixels that happen to match
        if max(r, g, b) - min(r, g, b) > 35 and max(r, g, b) > 100:
            return False
        return True
    mx, mn = max(r, g, b), min(r, g, b)
    # Near-black charcoal vignette
    if mx <= 70 and (mx - mn) <= 28:
        return True
    # Mid gray radial falloff (common leftover halo)
    if mx <= 130 and (mx - mn) <= 22 and (r + g + b) / 3 <= 110:
        return True
    return False


def replace_dark_backdrop(img: Image.Image, bg: tuple[int, int, int] = (255, 255, 255)) -> Image.Image:
    """Flood-fill dark vignette from corners → pure white (no AI)."""
    img = img.convert("RGB")
    w, h = img.size
    px = img.load()
    seeds = [
        (0, 0),
        (w - 1, 0),
        (0, h - 1),
        (w - 1, h - 1),
        (w // 2, 0),
        (w // 2, h - 1),
        (0, h // 2),
        (w - 1, h // 2),
    ]
    visited = [[False] * w for _ in range(h)]
    stack: list[tuple[int, int, tuple[int, int, int]]] = []

    for sx, sy in seeds:
        seed = px[sx, sy]
        if _is_backdrop(seed, seed, tol=70):
            stack.append((sx, sy, seed))

    while stack:
        x, y, seed = stack.pop()
        if x < 0 or y < 0 or x >= w or y >= h or visited[y][x]:
            continue
        cur = px[x, y]
        if not _is_backdrop(cur, seed, tol=58):
            continue
        visited[y][x] = True
        px[x, y] = bg
        stack.extend(
            (
                (x + 1, y, seed),
                (x - 1, y, seed),
                (x, y + 1, seed),
                (x, y - 1, seed),
            )
        )

    # Wipe leftover dark fringe near borders
    for y in range(h):
        for x in range(w):
            if visited[y][x]:
                continue
            edge = min(x, y, w - 1 - x, h - 1 - y)
            if edge > min(w, h) * 0.28:
                continue
            r, g, b = px[x, y]
            mx, mn = max(r, g, b), min(r, g, b)
            if mx <= 55 and (mx - mn) <= 22:
                px[x, y] = bg
            elif mx <= 100 and (mx - mn) <= 16 and edge < min(w, h) * 0.12:
                px[x, y] = bg

    return img


def tune_background(src: Path, dest: Path, size: int = 1000) -> None:
    """Pure white studio backdrop + light sharpen — no AI, no dark vignette."""
    img = Image.open(src).convert("RGB")
    img = replace_dark_backdrop(img, bg=(255, 255, 255))

    w, h = img.size
    side = max(w, h)
    # Small padding so pack doesn't touch edges
    pad = max(24, side // 40)
    canvas = Image.new("RGB", (side + pad * 2, side + pad * 2), (255, 255, 255))
    canvas.paste(img, ((side + pad * 2 - w) // 2, (side + pad * 2 - h) // 2))
    img = canvas.resize((size, size), Image.Resampling.LANCZOS)

    img = ImageEnhance.Contrast(img).enhance(1.04)
    img = ImageEnhance.Color(img).enhance(1.05)
    img = ImageEnhance.Sharpness(img).enhance(1.08)

    dest.parent.mkdir(parents=True, exist_ok=True)
    img.save(dest, "JPEG", quality=92, optimize=True)


def main() -> None:
    all_urls = collect_pack_urls()
    print(f"Candidate pack URLs: {len(all_urls)}")
    mapping: dict[str, str] = {}
    sources: dict[str, str] = {}
    used: set[str] = set()

    for slug, prefs in CATEGORY_PICK.items():
        url = pick_url(all_urls, prefs)
        # If same URL already used, try next match
        if url and url in used:
            matched = [u for u in all_urls if any(p in u.lower() for p in prefs)]
            matched.sort(key=lambda u: score_url(u, prefs))
            url = next((u for u in matched if u not in used), url)
        if not url:
            print(f"[{slug}] NO URL for {prefs}")
            continue
        sources[slug] = url
        used.add(url)
        raw = RAW_DIR / f"{slug}.bin"
        out = OUT_DIR / f"{slug}.jpg"
        print(f"[{slug}] {url.split('/')[-1]}")
        if not download(url, raw):
            continue
        head = raw.read_bytes()[:8]
        ext = ".png" if head.startswith(b"\x89PNG") else ".jpg"
        named = RAW_DIR / f"{slug}{ext}"
        named.write_bytes(raw.read_bytes())
        tune_background(named, out)
        mapping[slug] = f"/images/catalog/{slug}.jpg"
        print(f"  -> {out.relative_to(ROOT)} ({out.stat().st_size} bytes)")

    (ROOT / "tmp" / "catalog-image-map.json").write_text(json.dumps(mapping, indent=2))
    (ROOT / "tmp" / "catalog-image-sources.json").write_text(json.dumps(sources, indent=2))
    print(f"\nMapped {len(mapping)} / {len(CATEGORY_PICK)} categories")
    missing = [s for s in CATEGORY_PICK if s not in mapping]
    if missing:
        print("Missing:", missing)


if __name__ == "__main__":
    main()
