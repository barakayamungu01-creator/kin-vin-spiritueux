#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

import argparse
import csv
import hashlib
import html
import json
import math
import random
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
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/152.0.0.0 Safari/537.36"
    ),
    "Accept": (
        "text/html,application/xhtml+xml,application/xml;q=0.9,"
        "image/avif,image/webp,image/apng,*/*;q=0.8"
    ),
    "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
    "Cache-Control": "no-cache",
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


def make_session() -> requests.Session:
    session = requests.Session()
    session.headers.update(HEADERS)

    retry = Retry(
        total=3,
        connect=3,
        read=3,
        status=3,
        backoff_factor=0.8,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=frozenset(["GET"]),
        raise_on_status=False,
    )
    adapter = HTTPAdapter(max_retries=retry, pool_connections=20, pool_maxsize=20)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session


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
    url = html.unescape(url.strip())
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
            if str(key).lower() in {
                "image", "images", "contenturl", "thumbnailurl", "primaryimageofpage"
            }:
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
    r = session.get(page_url, timeout=30)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")
    urls: list[str] = []
    seen: set[str] = set()

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
        for attr in (
            "data-zoom-image", "data-large-image", "data-original",
            "data-src", "data-lazy-src", "data-image", "src"
        ):
            add_url(urls, seen, img.get(attr), page_url)

        for attr in ("srcset", "data-srcset"):
            srcset = img.get(attr)
            if srcset:
                for item in reversed(srcset.split(",")):
                    parts = item.strip().split()
                    if parts:
                        add_url(urls, seen, parts[0], page_url)

    for source in soup.find_all("source"):
        srcset = source.get("srcset") or source.get("data-srcset")
        if srcset:
            for item in reversed(srcset.split(",")):
                parts = item.strip().split()
                if parts:
                    add_url(urls, seen, parts[0], page_url)

    return urls


def parse_bing_html_for_image_urls(page_html: str, max_results: int = 40) -> list[str]:
    """Extrait les URL originales murl d'une page de résultats Bing Images."""
    soup = BeautifulSoup(page_html, "html.parser")
    results: list[str] = []
    seen: set[str] = set()

    # Format classique Bing Images: <a class="iusc" m='{"murl":"..."}'>
    for tag in soup.select("a.iusc"):
        raw = tag.get("m")
        if not raw:
            continue
        try:
            data = json.loads(html.unescape(raw))
        except Exception:
            continue

        for key in ("murl", "imgurl"):
            u = data.get(key)
            if u:
                add_url(results, seen, u)
                break

        if len(results) >= max_results:
            return results

    # Secours si Bing change légèrement son DOM mais garde murl dans le HTML.
    if len(results) < max_results:
        patterns = (
            r'"murl"\s*:\s*"(https?:\\?/\\?/[^\"]+)"',
            r'&quot;murl&quot;\s*:\s*&quot;(https?://[^&]+)&quot;',
        )
        for pattern in patterns:
            for match in re.findall(pattern, page_html, flags=re.I):
                u = html.unescape(match).replace("\\/", "/")
                add_url(results, seen, u)
                if len(results) >= max_results:
                    return results

    return results


def bing_image_search(
    session: requests.Session,
    query: str,
    max_results: int = 40,
) -> list[str]:
    params = {
        "q": query,
        "form": "HDRSC3",
        "first": "1",
        "tsc": "ImageBasicHover",
        "cw": "1177",
        "ch": "742",
    }
    headers = dict(HEADERS)
    headers.update({
        "Referer": "https://www.bing.com/",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "same-origin",
        "Upgrade-Insecure-Requests": "1",
    })

    r = session.get(
        "https://www.bing.com/images/search",
        params=params,
        headers=headers,
        timeout=30,
    )

    if r.status_code in (403, 429):
        raise RuntimeError(f"Bing Images bloque temporairement la requête (HTTP {r.status_code})")
    r.raise_for_status()

    results = parse_bing_html_for_image_urls(r.text, max_results=max_results)
    if not results:
        raise RuntimeError("Bing Images n'a retourné aucune URL exploitable")
    return results


def duckduckgo_image_search(
    session: requests.Session,
    query: str,
    max_results: int = 40,
) -> list[str]:
    """Secours uniquement. DuckDuckGo peut renvoyer 403 sur i.js."""
    r = session.get("https://duckduckgo.com/", params={"q": query}, timeout=25)
    r.raise_for_status()

    token = None
    for pattern in (
        r'vqd=["\']([^"\']+)["\']',
        r'vqd=([\d-]+)&',
        r'"vqd":"([^"]+)"',
    ):
        m = re.search(pattern, r.text)
        if m:
            token = m.group(1)
            break

    if not token:
        raise RuntimeError("Token DuckDuckGo introuvable")

    headers = dict(HEADERS)
    headers.update({
        "Referer": r.url,
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "X-Requested-With": "XMLHttpRequest",
    })

    rr = session.get(
        "https://duckduckgo.com/i.js",
        params={"l": "fr-fr", "o": "json", "q": query, "vqd": token, "f": ",,,"},
        headers=headers,
        timeout=30,
    )

    if rr.status_code == 403:
        raise RuntimeError("DuckDuckGo Images a refusé la requête (HTTP 403)")
    rr.raise_for_status()

    results: list[str] = []
    seen: set[str] = set()
    for item in rr.json().get("results", []):
        u = item.get("image")
        add_url(results, seen, u)
        if len(results) >= max_results:
            break
    return results


def search_images(
    session: requests.Session,
    query: str,
    max_results: int,
    engine: str,
) -> tuple[list[str], str]:
    errors = []

    if engine in ("auto", "bing"):
        try:
            urls = bing_image_search(session, query, max_results)
            if urls:
                return urls, "bing"
        except Exception as exc:
            errors.append(f"Bing: {exc}")
            if engine == "bing":
                raise

    if engine in ("auto", "duckduckgo"):
        try:
            urls = duckduckgo_image_search(session, query, max_results)
            if urls:
                return urls, "duckduckgo"
        except Exception as exc:
            errors.append(f"DuckDuckGo: {exc}")
            if engine == "duckduckgo":
                raise

    raise RuntimeError(" | ".join(errors) or "Aucun moteur de recherche disponible")


def download_bytes(
    session: requests.Session,
    url: str,
    referer: str | None,
    max_mb: int = 20,
) -> bytes:
    headers = dict(HEADERS)
    headers["Accept"] = "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
    if referer:
        headers["Referer"] = referer

    r = session.get(url, headers=headers, timeout=30, stream=True, allow_redirects=True)
    if r.status_code in (403, 429):
        raise ValueError(f"Téléchargement refusé HTTP {r.status_code}")
    r.raise_for_status()

    ct = (r.headers.get("Content-Type") or "").lower()
    if ct and "image" not in ct and "octet-stream" not in ct:
        raise ValueError(f"Type non image: {ct}")

    chunks: list[bytes] = []
    total = 0
    max_bytes = max_mb * 1024 * 1024

    for chunk in r.iter_content(65536):
        if not chunk:
            continue
        total += len(chunk)
        if total > max_bytes:
            raise ValueError("Image trop volumineuse")
        chunks.append(chunk)

    if not chunks:
        raise ValueError("Image vide")
    return b"".join(chunks)


def corner_brightness(img: Image.Image) -> float:
    rgb = img.convert("RGB")
    w, h = rgb.size
    s = max(2, int(min(w, h) * 0.06))
    boxes = [
        (0, 0, s, s),
        (w - s, 0, w, s),
        (0, h - s, s, h),
        (w - s, h - s, w, h),
    ]
    values = []
    for box in boxes:
        stat = ImageStat.Stat(rgb.crop(box))
        values.append(sum(stat.mean[:3]) / 3.0)
    return sum(values) / len(values)


def score_image(img: Image.Image, min_width: int, min_height: int) -> tuple[float, float]:
    w, h = img.size
    if w < min_width or h < min_height:
        raise ValueError(f"Image trop petite: {w}x{h}")

    aspect = w / h if h else 999.0
    square_score = max(0.0, 1.0 - abs(math.log(max(aspect, 0.001))))
    megapixels = (w * h) / 1_000_000.0
    resolution_score = min(1.0, megapixels / 2.0)
    bright = corner_brightness(img)
    light_score = max(0.0, min(1.0, (bright - 170.0) / 75.0))
    ratio_penalty = 2.0 if aspect > 2.0 or aspect < 0.5 else (
        0.8 if aspect > 1.6 or aspect < 0.625 else 0.0
    )
    large_bonus = 1.0 if w >= 1200 and h >= 1200 else 0.0

    score = (
        3.0 * resolution_score
        + 3.0 * square_score
        + 2.5 * light_score
        + 0.8 * large_bonus
        - ratio_penalty
    )
    return score, bright


def build_candidate(
    url: str,
    content: bytes,
    source: str,
    min_width: int,
    min_height: int,
) -> Candidate:
    img = Image.open(BytesIO(content))
    img.load()
    score, bright = score_image(img, min_width, min_height)
    return Candidate(url, source, img.width, img.height, score, bright, content)


def save_webp(
    candidate: Candidate,
    output_path: Path,
    canvas_size: int = 1200,
    quality: int = 92,
):
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
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=fields, delimiter=";")
        writer.writeheader()
        writer.writerows(rows)


def process_product(
    session: requests.Session,
    product: Product,
    output_dir: Path,
    max_candidates: int,
    min_width: int,
    min_height: int,
    canvas_size: int,
    light_threshold: float | None,
    strict_light: bool,
    delay: float,
    search_engine: str,
    query_suffix: str,
):
    if product.page_url:
        source = "product_page"
        urls = extract_page_images(session, product.page_url)
        referer = product.page_url
        print(f"  Source : page produit ({len(urls)} URL candidates)")
    else:
        query = f"{product.name} {query_suffix}".strip()
        urls, actual_engine = search_images(
            session,
            query=query,
            max_results=max_candidates,
            engine=search_engine,
        )
        source = f"image_search_{actual_engine}"
        referer = "https://www.bing.com/" if actual_engine == "bing" else "https://duckduckgo.com/"
        print(f"  Moteur : {actual_engine} | {len(urls)} URL candidates")

    candidates: list[Candidate] = []
    preferred: list[Candidate] = []
    rejected: list[dict] = []
    hashes: set[str] = set()

    for url in urls[:max_candidates]:
        try:
            content = download_bytes(session, url, referer)
            digest = hashlib.sha1(content).hexdigest()

            if digest in hashes:
                rejected.append({
                    "sku": product.sku,
                    "product": product.name,
                    "image_url": url,
                    "reason": "duplicate",
                })
                continue
            hashes.add(digest)

            c = build_candidate(url, content, source, min_width, min_height)
            candidates.append(c)

            is_light = light_threshold is None or c.corner_brightness >= light_threshold
            if is_light:
                preferred.append(c)
            elif strict_light:
                rejected.append({
                    "sku": product.sku,
                    "product": product.name,
                    "image_url": url,
                    "reason": f"background_too_dark:{c.corner_brightness:.1f}",
                })

            print(
                f"    candidat {len(candidates):02d} | "
                f"{c.width}x{c.height} | fond={c.corner_brightness:.0f} | "
                f"score={c.score:.2f}"
            )

        except Exception as exc:
            rejected.append({
                "sku": product.sku,
                "product": product.name,
                "image_url": url,
                "reason": str(exc),
            })

        if delay > 0:
            time.sleep(delay + random.uniform(0.0, min(0.25, delay / 2)))

    if strict_light and light_threshold is not None:
        pool = preferred
    elif preferred:
        pool = preferred
    else:
        # Important: --light-background devient une préférence, pas une cause
        # de zéro résultat. Utiliser --strict-light-background pour l'imposer.
        pool = candidates
        if candidates and light_threshold is not None:
            print(
                "  AVERTISSEMENT: aucun fond n'atteint le seuil demandé; "
                "sélection du meilleur candidat disponible."
            )

    if not pool:
        return None, rejected

    pool.sort(key=lambda x: x.score, reverse=True)
    best = pool[0]

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
    p = argparse.ArgumentParser(
        description="Télécharge et prépare une image principale par produit"
    )
    p.add_argument("input", nargs="?", default="produits.txt")
    p.add_argument("--output", default="images_produits_web")
    p.add_argument("--max-candidates", type=int, default=30)
    p.add_argument("--min-width", type=int, default=600)
    p.add_argument("--min-height", type=int, default=600)
    p.add_argument("--size", type=int, default=1200)
    p.add_argument(
        "--light-background",
        type=float,
        default=None,
        help="Ex. 215 = préférer fortement les fonds clairs",
    )
    p.add_argument(
        "--strict-light-background",
        action="store_true",
        help="Refuser réellement les images sous le seuil --light-background",
    )
    p.add_argument(
        "--search-engine",
        choices=("auto", "bing", "duckduckgo"),
        default="bing",
        help="Moteur utilisé si aucune URL de page produit n'est fournie",
    )
    p.add_argument(
        "--query-suffix",
        default="bottle product packshot white background high resolution",
        help="Texte ajouté au nom du produit pour la recherche d'images",
    )
    p.add_argument("--delay", type=float, default=0.7)
    args = p.parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        raise SystemExit(f"Fichier introuvable: {input_path}")

    products = parse_products(input_path)
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    session = make_session()

    manifest: list[dict] = []
    rejected: list[dict] = []

    print(f"Produits: {len(products)}")
    print(f"Sortie  : {output_dir.resolve()}")
    print(f"Moteur  : {args.search_engine}\n")

    for i, product in enumerate(products, 1):
        print(f"[{i}/{len(products)}] {product.sku or '-'} | {product.name}")

        try:
            row, rej = process_product(
                session=session,
                product=product,
                output_dir=output_dir,
                max_candidates=max(1, args.max_candidates),
                min_width=max(1, args.min_width),
                min_height=max(1, args.min_height),
                canvas_size=max(100, args.size),
                light_threshold=args.light_background,
                strict_light=args.strict_light_background,
                delay=max(0.0, args.delay),
                search_engine=args.search_engine,
                query_suffix=args.query_suffix,
            )
            rejected.extend(rej)

            if row:
                manifest.append(row)
                print(f"  -> retenue: {Path(row['output_file']).name}")
            else:
                print("  -> aucune image acceptable")

        except Exception as exc:
            rejected.append({
                "sku": product.sku,
                "product": product.name,
                "image_url": "",
                "reason": f"product_error:{exc}",
            })
            print(f"  ERREUR: {exc}")

        print()

    write_csv(
        output_dir / "manifest.csv",
        manifest,
        [
            "sku", "product", "page_url", "source_type", "source_image_url",
            "original_width", "original_height", "corner_brightness", "score",
            "output_file", "output_size", "format"
        ],
    )
    write_csv(
        output_dir / "rejected.csv",
        rejected,
        ["sku", "product", "image_url", "reason"],
    )

    print("=== TERMINÉ ===")
    print(f"Images retenues: {len(manifest)} / {len(products)}")
    print(f"Manifest: {(output_dir / 'manifest.csv').resolve()}")
    print(f"Rejets  : {(output_dir / 'rejected.csv').resolve()}")


if __name__ == "__main__":
    main()
