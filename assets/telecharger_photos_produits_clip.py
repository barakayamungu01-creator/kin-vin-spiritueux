#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Téléchargeur d'images produits avec filtre sémantique CLIP.

But:
- récupérer des images produits depuis le web
- éviter les résultats absurdes (portrait, machine, citation, etc.)
- ne garder qu'une image qui ressemble au produit demandé

Entrées acceptées dans produits.txt :
1) Nom seul
   Hennessy XO
2) SKU|Nom
   HEN-XO|Hennessy XO
3) Nom|URL
   Hennessy XO|https://...
4) SKU|Nom|URL
   HEN-XO|Hennessy XO|https://...

Dépendances :
pip install requests beautifulsoup4 pillow open_clip_torch torch
"""

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
from urllib.parse import quote_plus, urljoin, urlparse, unquote

import requests
from bs4 import BeautifulSoup
from PIL import Image, ImageOps, ImageStat

# CLIP
import torch
import open_clip


HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/152.0 Safari/537.36"
    ),
    "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
}

BAD_URL_TOKENS = (
    "logo",
    "icon",
    "sprite",
    "favicon",
    "avatar",
    "placeholder",
    "spinner",
    "loading",
    "tracking",
    "banner",
    "badge",
)

ALCOHOL_HINTS = {
    "hennessy": ["cognac", "bottle"],
    "martell": ["cognac", "bottle"],
    "camus": ["cognac", "bottle"],
    "chivas": ["whisky", "bottle"],
    "glenfiddich": ["whisky", "bottle"],
    "johnnie": ["whisky", "bottle"],
    "blue label": ["whisky", "bottle"],
    "gold label": ["whisky", "bottle"],
    "ruinart": ["champagne", "bottle"],
    "moet": ["champagne", "bottle"],
    "veuve": ["champagne", "bottle"],
    "perrier": ["champagne", "bottle"],
    "dom perignon": ["champagne", "bottle"],
    "armand de brignac": ["champagne", "bottle"],
    "porto": ["wine bottle"],
    "mouton": ["wine bottle"],
    "fiole": ["wine bottle"],
}


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
    score_visual: float
    score_clip: float
    score_final: float
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
    slug = re.sub(r"[-_]+", " ", slug)
    return slug.strip() or "produit"


def parse_products(path: Path) -> list[Product]:
    products = []

    for raw in path.read_text(encoding="utf-8-sig").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue

        parts = [p.strip() for p in line.split("|")]

        if len(parts) >= 3 and is_url(parts[-1]):
            products.append(Product(sku=parts[0], name="|".join(parts[1:-1]).strip(), page_url=parts[-1]))
        elif len(parts) == 2 and is_url(parts[1]):
            products.append(Product(sku="", name=parts[0] or derive_name_from_url(parts[1]), page_url=parts[1]))
        elif len(parts) == 2:
            products.append(Product(sku=parts[0], name=parts[1], page_url=None))
        elif len(parts) == 1 and is_url(parts[0]):
            products.append(Product(sku="", name=derive_name_from_url(parts[0]), page_url=parts[0]))
        else:
            products.append(Product(sku="", name=line, page_url=None))

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
    return any(tok in low for tok in BAD_URL_TOKENS)


def add_url(out: list[str], seen: set[str], url: str | None, base_url: str | None = None):
    u = normalize_url(url, base_url)
    if not u:
        return
    if likely_bad_asset(u):
        return
    if u not in seen:
        seen.add(u)
        out.append(u)


def extract_jsonld_images(data, page_url, urls, seen):
    if isinstance(data, dict):
        for k, v in data.items():
            kl = str(k).lower()
            if kl in {"image", "images", "contenturl", "thumbnailurl", "primaryimageofpage"}:
                if isinstance(v, str):
                    add_url(urls, seen, v, page_url)
                else:
                    extract_jsonld_images(v, page_url, urls, seen)
            else:
                extract_jsonld_images(v, page_url, urls, seen)
    elif isinstance(data, list):
        for item in data:
            extract_jsonld_images(item, page_url, urls, seen)


def extract_page_images(session: requests.Session, page_url: str) -> list[str]:
    r = session.get(page_url, headers=HEADERS, timeout=30)
    r.raise_for_status()

    soup = BeautifulSoup(r.text, "html.parser")
    urls, seen = [], set()

    for selector, attr in [
        ('meta[property="og:image"]', "content"),
        ('meta[property="og:image:url"]', "content"),
        ('meta[property="og:image:secure_url"]', "content"),
        ('meta[name="twitter:image"]', "content"),
        ('meta[property="twitter:image"]', "content"),
    ]:
        for tag in soup.select(selector):
            add_url(urls, seen, tag.get(attr), page_url)

    for script in soup.find_all("script", type="application/ld+json"):
        raw = script.string or script.get_text(strip=True)
        if not raw:
            continue
        try:
            data = json.loads(raw)
            extract_jsonld_images(data, page_url, urls, seen)
        except Exception:
            pass

    for img in soup.find_all("img"):
        for attr in ["data-zoom-image", "data-large-image", "data-original", "data-src", "data-lazy-src", "src"]:
            add_url(urls, seen, img.get(attr), page_url)

        srcset = img.get("srcset") or img.get("data-srcset")
        if srcset:
            for item in reversed(srcset.split(",")):
                part = item.strip().split()[0]
                add_url(urls, seen, part, page_url)

    return urls


def bing_image_search(session: requests.Session, query: str, max_results: int = 40) -> list[str]:
    url = f"https://www.bing.com/images/search?q={quote_plus(query)}&form=HDRSC3&first=1&tsc=ImageHoverTitle"
    r = session.get(url, headers=HEADERS, timeout=30)
    r.raise_for_status()

    html = r.text
    urls = []
    seen = set()

    # Bing stocke souvent les métadonnées dans m="{... "murl":"https://..."
    for match in re.finditer(r'm="([^"]+)"', html):
        blob = unquote(match.group(1))
        m = re.search(r'"murl":"(.*?)"', blob)
        if m:
            img_url = m.group(1).replace("\\/", "/")
            if img_url and img_url not in seen and not likely_bad_asset(img_url):
                seen.add(img_url)
                urls.append(img_url)
                if len(urls) >= max_results:
                    return urls

    # Fallback: certaines images sont dans src/data-src
    soup = BeautifulSoup(html, "html.parser")
    for img in soup.find_all("img"):
        for attr in ("data-src", "src"):
            candidate = img.get(attr)
            if candidate and candidate.startswith("http") and candidate not in seen and not likely_bad_asset(candidate):
                seen.add(candidate)
                urls.append(candidate)
                if len(urls) >= max_results:
                    return urls

    return urls


def build_search_query(product_name: str) -> str:
    name_low = product_name.lower()
    extra = ["bottle", "packshot", "white background"]

    for key, vals in ALCOHOL_HINTS.items():
        if key in name_low:
            extra = vals + ["packshot", "white background"]
            break

    return f'{product_name} ' + " ".join(extra)


def download_bytes(session: requests.Session, url: str, referer: str | None = None, max_mb: int = 20) -> bytes:
    headers = dict(HEADERS)
    if referer:
        headers["Referer"] = referer

    r = session.get(url, headers=headers, timeout=30, stream=True, allow_redirects=True)
    r.raise_for_status()

    ctype = (r.headers.get("Content-Type") or "").lower()
    if ctype and "image" not in ctype:
        raise ValueError(f"type non image: {ctype}")

    limit = max_mb * 1024 * 1024
    buf = []
    total = 0
    for chunk in r.iter_content(65536):
        if not chunk:
            continue
        total += len(chunk)
        if total > limit:
            raise ValueError("image trop grande")
        buf.append(chunk)
    return b"".join(buf)


def corner_stats(img: Image.Image) -> tuple[float, float]:
    rgb = img.convert("RGB")
    w, h = rgb.size
    s = max(2, int(min(w, h) * 0.06))
    boxes = [(0, 0, s, s), (w-s, 0, w, s), (0, h-s, s, h), (w-s, h-s, w, h)]
    br_vals = []
    neut_vals = []

    for box in boxes:
        crop = rgb.crop(box)
        stat = ImageStat.Stat(crop)
        r, g, b = stat.mean[:3]
        brightness = (r + g + b) / 3.0
        spread = max(r, g, b) - min(r, g, b)
        neutrality = max(0.0, 1.0 - spread / 80.0)
        br_vals.append(brightness)
        neut_vals.append(neutrality)

    return sum(br_vals) / len(br_vals), sum(neut_vals) / len(neut_vals)


def visual_score(img: Image.Image, min_width: int, min_height: int):
    w, h = img.size
    area = w * h
    aspect = w / h if h else 999.0
    square_score = max(0.0, 1.0 - abs(math.log(max(aspect, 0.001))))
    brightness, neutrality = corner_stats(img)
    light_score = max(0.0, min(1.0, (brightness - 170.0) / 75.0))
    megapixels = area / 1_000_000.0
    resolution_score = min(1.0, megapixels / 2.0)

    ratio_penalty = 0.0
    if aspect > 2.0 or aspect < 0.5:
        ratio_penalty = 2.0
    elif aspect > 1.6 or aspect < 0.625:
        ratio_penalty = 0.8

    size_penalty = 0.0
    if w < min_width or h < min_height:
        size_penalty = 5.0

    score = 3.0 * resolution_score + 3.0 * square_score + 2.2 * light_score + 0.8 * neutrality - ratio_penalty - size_penalty
    return score, brightness, w, h


class ClipRanker:
    def __init__(self, model_name="ViT-B-32", pretrained="laion2b_s34b_b79k"):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model, _, self.preprocess = open_clip.create_model_and_transforms(
            model_name, pretrained=pretrained, device=self.device
        )
        self.tokenizer = open_clip.get_tokenizer(model_name)

        self.negative_prompts = [
            "a portrait of a person",
            "a man wearing sunglasses",
            "a quote poster with text",
            "a machine or device",
            "an industrial object",
            "a landscape",
            "a logo",
        ]

    def build_prompts(self, product_name: str):
        positive = [
            f"a product photo of {product_name}",
            f"a bottle of {product_name}",
            f"a packshot of {product_name}",
            f"a studio product shot of {product_name} on white background",
        ]

        low = product_name.lower()
        if any(k in low for k in ["champagne", "ruinart", "moet", "veuve", "perrier", "perignon", "brignac"]):
            positive += [
                f"a champagne bottle of {product_name}",
                f"a product photo of a champagne bottle labeled {product_name}",
            ]
        elif any(k in low for k in ["hennessy", "martell", "camus", "cognac"]):
            positive += [
                f"a cognac bottle of {product_name}",
                f"a product photo of a cognac bottle labeled {product_name}",
            ]
        elif any(k in low for k in ["glenfiddich", "chivas", "johnnie", "blue label", "gold label", "scotch", "whisky", "whiskey"]):
            positive += [
                f"a whisky bottle of {product_name}",
                f"a scotch whisky bottle labeled {product_name}",
            ]
        elif any(k in low for k in ["vin", "porto", "mouton", "fiole"]):
            positive += [
                f"a wine bottle of {product_name}",
                f"a product photo of a wine bottle labeled {product_name}",
            ]

        return positive

    def score(self, image: Image.Image, product_name: str) -> float:
        image = image.convert("RGB")
        img_tensor = self.preprocess(image).unsqueeze(0).to(self.device)

        pos_prompts = self.build_prompts(product_name)
        neg_prompts = self.negative_prompts
        all_prompts = pos_prompts + neg_prompts

        txt = self.tokenizer(all_prompts).to(self.device)

        with torch.no_grad():
            image_features = self.model.encode_image(img_tensor)
            text_features = self.model.encode_text(txt)
            image_features /= image_features.norm(dim=-1, keepdim=True)
            text_features /= text_features.norm(dim=-1, keepdim=True)
            sims = (image_features @ text_features.T).squeeze(0).cpu().tolist()

        pos_scores = sims[:len(pos_prompts)]
        neg_scores = sims[len(pos_prompts):]

        return max(pos_scores) - max(neg_scores)


def normalize_to_square_webp(content: bytes, out_path: Path, size: int = 1200, quality: int = 92):
    img = Image.open(BytesIO(content))
    img.load()
    img = ImageOps.exif_transpose(img)

    if img.mode in ("RGBA", "LA"):
        base = Image.new("RGBA", img.size, (255, 255, 255, 255))
        base.alpha_composite(img.convert("RGBA"))
        img = base.convert("RGB")
    elif img.mode == "P":
        img = img.convert("RGBA")
        base = Image.new("RGBA", img.size, (255, 255, 255, 255))
        base.alpha_composite(img)
        img = base.convert("RGB")
    else:
        img = img.convert("RGB")

    canvas = Image.new("RGB", (size, size), (255, 255, 255))
    margin = int(size * 0.06)
    max_side = size - 2 * margin
    img.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
    x = (size - img.width) // 2
    y = (size - img.height) // 2
    canvas.paste(img, (x, y))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out_path, format="WEBP", quality=quality, method=6)


def process_product(session, product, output_dir, ranker, max_candidates, min_width, min_height, size, delay):
    if product.page_url:
        urls = extract_page_images(session, product.page_url)[:max_candidates]
        source = "product_page"
        referer = product.page_url
    else:
        query = build_search_query(product.name)
        urls = bing_image_search(session, query, max_results=max_candidates)
        source = "bing_image_search"
        referer = "https://www.bing.com/"

    candidates = []
    rejected = []
    seen_hashes = set()

    print(f"  {len(urls)} URL candidates")

    for idx, url in enumerate(urls, start=1):
        try:
            content = download_bytes(session, url, referer=referer)
            digest = hashlib.sha1(content).hexdigest()
            if digest in seen_hashes:
                continue
            seen_hashes.add(digest)

            img = Image.open(BytesIO(content))
            img.load()

            vscore, brightness, w, h = visual_score(img, min_width, min_height)
            if w < min_width or h < min_height:
                rejected.append((url, f"trop petite {w}x{h}"))
                continue

            cscore = ranker.score(img, product.name)

            # score final = visuel + poids fort sémantique CLIP
            final_score = vscore + 8.0 * cscore

            candidates.append(Candidate(
                url=url,
                source=source,
                width=w,
                height=h,
                score_visual=vscore,
                score_clip=cscore,
                score_final=final_score,
                corner_brightness=brightness,
                content=content,
            ))

            print(
                f"    cand {len(candidates):02d} | {w}x{h} | "
                f"vis={vscore:.2f} | clip={cscore:.3f} | final={final_score:.2f}"
            )

        except Exception as exc:
            rejected.append((url, str(exc)))

        time.sleep(delay)

    if not candidates:
        return None, rejected

    candidates.sort(key=lambda c: c.score_final, reverse=True)
    best = candidates[0]

    filename = slugify(product.sku or product.name) + ".webp"
    out_path = output_dir / filename
    normalize_to_square_webp(best.content, out_path, size=size)

    manifest = {
        "sku": product.sku,
        "product": product.name,
        "page_url": product.page_url or "",
        "source_type": best.source,
        "source_image_url": best.url,
        "original_width": best.width,
        "original_height": best.height,
        "visual_score": f"{best.score_visual:.3f}",
        "clip_score": f"{best.score_clip:.4f}",
        "final_score": f"{best.score_final:.3f}",
        "corner_brightness": f"{best.corner_brightness:.1f}",
        "output_file": str(out_path),
        "output_size": f"{size}x{size}",
        "format": "WEBP",
    }

    return manifest, rejected


def write_csv(path: Path, rows: list[dict], fields: list[str]):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=fields, delimiter=";")
        writer.writeheader()
        writer.writerows(rows)


def main():
    ap = argparse.ArgumentParser(description="Téléchargeur d'images produits avec filtre CLIP")
    ap.add_argument("input", nargs="?", default="produits.txt")
    ap.add_argument("--output", default="images_produits")
    ap.add_argument("--max-candidates", type=int, default=25)
    ap.add_argument("--min-width", type=int, default=700)
    ap.add_argument("--min-height", type=int, default=700)
    ap.add_argument("--size", type=int, default=1200)
    ap.add_argument("--delay", type=float, default=0.3)
    args = ap.parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        raise SystemExit(f"Fichier introuvable: {input_path}")

    products = parse_products(input_path)
    if not products:
        raise SystemExit("Aucun produit trouvé.")

    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"Produits: {len(products)}")
    print(f"Sortie  : {output_dir.resolve()}")

    print("Chargement du modèle CLIP...")
    ranker = ClipRanker()

    session = requests.Session()
    session.headers.update(HEADERS)

    manifest_rows = []
    rejected_rows = []

    for i, product in enumerate(products, start=1):
        print(f"\n[{i}/{len(products)}] {product.sku or '-'} | {product.name}")
        try:
            manifest, rejected = process_product(
                session=session,
                product=product,
                output_dir=output_dir,
                ranker=ranker,
                max_candidates=max(1, args.max_candidates),
                min_width=max(1, args.min_width),
                min_height=max(1, args.min_height),
                size=max(100, args.size),
                delay=max(0.0, args.delay),
            )
            for url, reason in rejected:
                rejected_rows.append({
                    "product": product.name,
                    "sku": product.sku,
                    "image_url": url,
                    "reason": reason,
                })

            if manifest:
                manifest_rows.append(manifest)
                print(f"  -> retenue: {Path(manifest['output_file']).name}")
            else:
                print("  -> aucune image retenue")

        except Exception as exc:
            print(f"  ERREUR: {exc}")
            rejected_rows.append({
                "product": product.name,
                "sku": product.sku,
                "image_url": "",
                "reason": str(exc),
            })

    write_csv(
        output_dir / "manifest.csv",
        manifest_rows,
        [
            "sku", "product", "page_url", "source_type", "source_image_url",
            "original_width", "original_height", "visual_score",
            "clip_score", "final_score", "corner_brightness",
            "output_file", "output_size", "format",
        ]
    )

    write_csv(
        output_dir / "rejected.csv",
        rejected_rows,
        ["product", "sku", "image_url", "reason"]
    )

    print("\n=== TERMINE ===")
    print(f"Images retenues: {len(manifest_rows)} / {len(products)}")
    print(f"Manifest: {(output_dir / 'manifest.csv').resolve()}")
    print(f"Rejets  : {(output_dir / 'rejected.csv').resolve()}")


if __name__ == "__main__":
    main()
