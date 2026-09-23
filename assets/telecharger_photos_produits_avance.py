#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import re
import time
import unicodedata
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from PIL import Image, ImageOps, ImageStat

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/152.0 Safari/537.36"
    ),
    "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
}

BAD_URL_TOKENS = (
    "logo", "icon", "sprite", "favicon", "avatar", "placeholder",
    "spinner", "loading", "tracking", "pixel.gif", "badge", "banner",
    "thumbnail", "thumb_"
)


@dataclass
class Product:
    sku: str
    name: str
    page_url: str | None


@dataclass
class Candidate:
    url: str
    source: str
    width: int
    height: int
    score: float
    corner_brightness: float
    content: bytes


def slugify(text: str, max_len: int = 120) -> str:
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    text = re.sub(r"-+", "-", text).strip("-")
    return (text or "produit")[:max_len]


def is_url(value: str) -> bool:
    return value.lower().startswith(("http://", "https://"))


def derive_name_from_url(url: str) -> str:
    parsed = urlparse(url)
    slug = Path(parsed.path).stem or parsed.netloc
    return re.sub(r"[-_]+", " ", slug).strip() or "produit"


def parse_products(path: Path) -> list[Product]:
    products: list[Product] = []
    for raw in path.read_text(encoding="utf-8-sig").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        parts = [p.strip() for p in line.split("|")]

        if len(parts) >= 3 and is_url(parts[-1]):
            products.append(Product(parts[0], "|".join(parts[1:-1]).strip(), parts[-1]))
        elif len(parts) == 2 and is_url(parts[1]):
            products.append(Product("", parts[0] or derive_name_from_url(parts[1]), parts[1]))
        elif len(parts) == 2:
            products.append(Product(parts[0], parts[1], None))
        elif len(parts) == 1 and is_url(parts[0]):
            products.append(Product("", derive_name_from_url(parts[0]), parts[0]))
        else:
            products.append(Product("", line, None))
    return products


def normalize_url(url: str | None, base_url: str | None = None) -> str | None:
    if not url:
        return None
    url = url.strip()
    if not url or url.startswith("data:"):
        return None
    if url.startswith("//"):
        url = "https:" + url
    elif base_url:
        url = urljoin(base_url, url)
    return url


def likely_bad_asset(url: str) -> bool:
    low = url.lower()
    return any(token in low for token in BAD_URL_TOKENS)


def add_url(out: list[str], seen: set[str], url: str | None, base_url: str | None = None):
    url = normalize_url(url, base_url)
    if not url or likely_bad_asset(url) or url in seen:
        return
    seen.add(url)
    out.append(url)


def extract_jsonld_images(data, page_url, urls, seen):
    if isinstance(data, dict):
        for key, value in data.items():
            if str(key).lower() in {"image", "images", "contenturl", "thumbnailurl", "primaryimageofpage"}:
                if isinstance(value, str):
                    add_url(urls, seen, value, page_url)
                else:
                    extract_jsonld_images(value, page_url, urls, seen)
            else:
                extract_jsonld_images(value, page_url, urls, seen)
    elif isinstance(data, list):
        for item in data:
            extract_jsonld_images(item, page_url, urls, seen)


def extract_page_images(session: requests.Session, page_url: str) -> list[str]:
    r = session.get(page_url, headers=HEADERS, timeout=30)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")
    urls, seen = [], set()

    for selector in (
        'meta[property="og:image"]',
        'meta[property="og:image:url"]',
        'meta[property="og:image:secure_url"]',
        'meta[name="twitter:image"]',
        'meta[property="twitter:image"]',
    ):
        for tag in soup.select(selector):
            add_url(urls, seen, tag.get("content"), page_url)

    for script in soup.find_all("script", type="application/ld+json"):
        raw = script.string or script.get_text(strip=True)
        if not raw:
            continue
        try:
            extract_jsonld_images(json.loads(raw), page_url, urls, seen)
        except Exception:
            pass

    for img in soup.find_all("img"):
        for attr in ("data-zoom-image", "data-large-image", "data-original", "data-src", "data-lazy-src", "src"):
            add_url(urls, seen, img.get(attr), page_url)
        for attr in ("srcset", "data-srcset"):
            srcset = img.get(attr)
            if srcset:
                for item in reversed(srcset.split(",")):
                    add_url(urls, seen, item.strip().split()[0], page_url)

    for source in soup.find_all("source"):
        srcset = source.get("srcset") or source.get("data-srcset")
        if srcset:
            for item in reversed(srcset.split(",")):
                add_url(urls, seen, item.strip().split()[0], page_url)

    return urls


def duckduckgo_image_search(session: requests.Session, query: str, max_results: int = 40) -> list[str]:
    r = session.get("https://duckduckgo.com/", params={"q": query}, headers=HEADERS, timeout=25)
    r.raise_for_status()
    token = None
    for pattern in (r'vqd=["\']([^"\']+)["\']', r'vqd=([\d-]+)&', r'"vqd":"([^"]+)"'):
        m = re.search(pattern, r.text)
        if m:
            token = m.group(1)
            break
    if not token:
        raise RuntimeError("Token DuckDuckGo introuvable")

    headers = dict(HEADERS)
    headers["Referer"] = r.url
    r = session.get(
        "https://duckduckgo.com/i.js",
        params={"l": "fr-fr", "o": "json", "q": query, "vqd": token, "f": ",,,"},
        headers=headers,
        timeout=30,
    )
    r.raise_for_status()
    results, seen = [], set()
    for item in r.json().get("results", []):
        u = item.get("image")
        if u and u not in seen and not likely_bad_asset(u):
            seen.add(u)
            results.append(u)
        if len(results) >= max_results:
            break
    return results


def download_bytes(session: requests.Session, url: str, referer: str | None, max_mb: int = 20) -> bytes:
    headers = dict(HEADERS)
    if referer:
        headers["Referer"] = referer
    r = session.get(url, headers=headers, timeout=30, stream=True, allow_redirects=True)
    r.raise_for_status()
    ct = (r.headers.get("Content-Type") or "").lower()
    if ct and "image" not in ct:
        raise ValueError(f"Type non image: {ct}")
    chunks, total = [], 0
    for chunk in r.iter_content(65536):
        if not chunk:
            continue
        total += len(chunk)
        if total > max_mb * 1024 * 1024:
            raise ValueError("Image trop volumineuse")
        chunks.append(chunk)
    return b"".join(chunks)


def corner_brightness(img: Image.Image) -> float:
    rgb = img.convert("RGB")
    w, h = rgb.size
    s = max(2, int(min(w, h) * 0.06))
    boxes = [(0, 0, s, s), (w-s, 0, w, s), (0, h-s, s, h), (w-s, h-s, w, h)]
    vals = []
    for box in boxes:
        stat = ImageStat.Stat(rgb.crop(box))
        vals.append(sum(stat.mean[:3]) / 3.0)
    return sum(vals) / len(vals)


def score_image(img: Image.Image, min_width: int, min_height: int) -> tuple[float, float]:
    w, h = img.size
    if w < min_width or h < min_height:
        raise ValueError(f"Image trop petite: {w}x{h}")
    aspect = w / h if h else 999
    square_score = max(0.0, 1.0 - abs(math.log(max(aspect, 0.001))))
    megapixels = (w * h) / 1_000_000
    resolution_score = min(1.0, megapixels / 2.0)
    bright = corner_brightness(img)
    light_score = max(0.0, min(1.0, (bright - 170) / 75))
    ratio_penalty = 2.0 if aspect > 2 or aspect < 0.5 else (0.8 if aspect > 1.6 or aspect < 0.625 else 0.0)
    large_bonus = 1.0 if w >= 1200 and h >= 1200 else 0.0
    score = 3.0 * resolution_score + 3.0 * square_score + 2.5 * light_score + 0.8 * large_bonus - ratio_penalty
    return score, bright


def build_candidate(url: str, content: bytes, source: str, min_width: int, min_height: int) -> Candidate:
    img = Image.open(BytesIO(content))
    img.load()
    score, bright = score_image(img, min_width, min_height)
    return Candidate(url, source, img.width, img.height, score, bright, content)


def save_webp(candidate: Candidate, output_path: Path, canvas_size: int = 1200, quality: int = 92):
    img = Image.open(BytesIO(candidate.content))
    img.load()
    img = ImageOps.exif_transpose(img)
    if img.mode in ("RGBA", "LA", "P"):
        rgba = img.convert("RGBA")
        base = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
        base.alpha_composite(rgba)
        img = base.convert("RGB")
    else:
        img = img.convert("RGB")

    canvas = Image.new("RGB", (canvas_size, canvas_size), (255, 255, 255))
    margin = int(canvas_size * 0.06)
    max_side = canvas_size - 2 * margin
    img.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
    x = (canvas_size - img.width) // 2
    y = (canvas_size - img.height) // 2
    canvas.paste(img, (x, y))
    output_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(output_path, "WEBP", quality=quality, method=6)


def write_csv(path: Path, rows: list[dict], fields: list[str]):
    with path.open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=fields, delimiter=";")
        w.writeheader()
        w.writerows(rows)


def process_product(session, product, output_dir, max_candidates, min_width, min_height, canvas_size, light_threshold, delay):
    if product.page_url:
        source = "product_page"
        urls = extract_page_images(session, product.page_url)
        referer = product.page_url
    else:
        source = "image_search"
        query = f'{product.name} product bottle packshot white background'
        urls = duckduckgo_image_search(session, query, max_candidates)
        referer = "https://duckduckgo.com/"

    candidates, rejected, hashes = [], [], set()

    for url in urls[:max_candidates]:
        try:
            content = download_bytes(session, url, referer)
            h = hashlib.sha1(content).hexdigest()
            if h in hashes:
                rejected.append({"sku": product.sku, "product": product.name, "image_url": url, "reason": "duplicate"})
                continue
            hashes.add(h)
            c = build_candidate(url, content, source, min_width, min_height)
            if light_threshold is not None and c.corner_brightness < light_threshold:
                rejected.append({"sku": product.sku, "product": product.name, "image_url": url, "reason": f"background_too_dark:{c.corner_brightness:.1f}"})
                continue
            candidates.append(c)
            print(f"    candidat {len(candidates):02d} | {c.width}x{c.height} | fond={c.corner_brightness:.0f} | score={c.score:.2f}")
        except Exception as e:
            rejected.append({"sku": product.sku, "product": product.name, "image_url": url, "reason": str(e)})
        time.sleep(delay)

    if not candidates:
        return None, rejected

    candidates.sort(key=lambda x: x.score, reverse=True)
    best = candidates[0]
    filename = slugify(product.sku or product.name) + ".webp"
    out = output_dir / filename
    save_webp(best, out, canvas_size)

    return {
        "sku": product.sku,
        "product": product.name,
        "page_url": product.page_url or "",
        "source_type": best.source,
        "source_image_url": best.url,
        "original_width": best.width,
        "original_height": best.height,
        "corner_brightness": f"{best.corner_brightness:.1f}",
        "score": f"{best.score:.3f}",
        "output_file": str(out),
        "output_size": f"{canvas_size}x{canvas_size}",
        "format": "WEBP",
    }, rejected


def main():
    p = argparse.ArgumentParser(description="Télécharge et prépare une image principale par produit")
    p.add_argument("input", nargs="?", default="produits.txt")
    p.add_argument("--output", default="images_produits_web")
    p.add_argument("--max-candidates", type=int, default=30)
    p.add_argument("--min-width", type=int, default=600)
    p.add_argument("--min-height", type=int, default=600)
    p.add_argument("--size", type=int, default=1200)
    p.add_argument("--light-background", type=float, default=None, help="Ex. 215 pour exiger un fond clair")
    p.add_argument("--delay", type=float, default=0.5)
    args = p.parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        raise SystemExit(f"Fichier introuvable: {input_path}")

    products = parse_products(input_path)
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    session = requests.Session()
    session.headers.update(HEADERS)

    manifest, rejected = [], []
    print(f"Produits: {len(products)}")
    print(f"Sortie  : {output_dir.resolve()}\n")

    for i, product in enumerate(products, 1):
        print(f"[{i}/{len(products)}] {product.sku or '-'} | {product.name}")
        try:
            row, rej = process_product(
                session, product, output_dir,
                max(1, args.max_candidates),
                max(1, args.min_width),
                max(1, args.min_height),
                max(100, args.size),
                args.light_background,
                max(0.0, args.delay),
            )
            rejected.extend(rej)
            if row:
                manifest.append(row)
                print(f"  -> retenue: {Path(row['output_file']).name}")
            else:
                print("  -> aucune image acceptable")
        except Exception as e:
            rejected.append({"sku": product.sku, "product": product.name, "image_url": "", "reason": f"product_error:{e}"})
            print(f"  ERREUR: {e}")
        print()

    write_csv(output_dir / "manifest.csv", manifest, [
        "sku", "product", "page_url", "source_type", "source_image_url",
        "original_width", "original_height", "corner_brightness", "score",
        "output_file", "output_size", "format"
    ])
    write_csv(output_dir / "rejected.csv", rejected, ["sku", "product", "image_url", "reason"])

    print("=== TERMINÉ ===")
    print(f"Images retenues: {len(manifest)} / {len(products)}")
    print(f"Manifest: {(output_dir / 'manifest.csv').resolve()}")
    print(f"Rejets  : {(output_dir / 'rejected.csv').resolve()}")


if __name__ == "__main__":
    main()
