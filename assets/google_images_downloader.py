#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import re
import time
import unicodedata
from pathlib import Path
from urllib.parse import quote_plus

import requests
from PIL import Image
from selenium import webdriver
from selenium.common.exceptions import (
    ElementClickInterceptedException,
    StaleElementReferenceException,
    WebDriverException,
)
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options


HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/153.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
}


def slugify(text: str, max_len: int = 100) -> str:
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    text = re.sub(r"-+", "-", text).strip("-")
    return (text or "produit")[:max_len]


def load_products(path: Path) -> list[str]:
    products = []
    for raw in path.read_text(encoding="utf-8-sig").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue

        # Supporte aussi SKU|Nom
        if "|" in line:
            parts = [x.strip() for x in line.split("|") if x.strip()]
            if parts:
                line = parts[-1]

        products.append(line)

    return products


def build_driver(headless: bool = False) -> webdriver.Chrome:
    options = Options()

    if headless:
        options.add_argument("--headless=new")

    options.add_argument("--start-maximized")
    options.add_argument("--window-size=1440,1100")
    options.add_argument("--lang=fr-FR")
    options.add_argument("--disable-notifications")
    options.add_argument("--disable-popup-blocking")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option("excludeSwitches", ["enable-automation", "enable-logging"])
    options.add_experimental_option("useAutomationExtension", False)

    driver = webdriver.Chrome(options=options)

    try:
        driver.execute_script(
            "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
        )
    except Exception:
        pass

    return driver


def accept_consent(driver):
    texts = [
        "Tout accepter",
        "Accepter tout",
        "Accept all",
        "J'accepte",
        "Accepter",
    ]

    for text in texts:
        try:
            buttons = driver.find_elements(
                By.XPATH,
                f"//button[contains(., '{text}')] | "
                f"//div[@role='button' and contains(., '{text}')]"
            )
            for btn in buttons:
                if btn.is_displayed() and btn.is_enabled():
                    driver.execute_script("arguments[0].click();", btn)
                    time.sleep(1)
                    return
        except Exception:
            pass


def google_images_url(query: str) -> str:
    return f"https://www.google.com/search?tbm=isch&hl=fr&q={quote_plus(query)}"


def get_thumbnails(driver):
    selectors = [
        "img.YQ4gaf",
        "img.rg_i",
        "div[data-ri] img",
        "a.wXeWr img",
        "img",
    ]

    for selector in selectors:
        try:
            elements = driver.find_elements(By.CSS_SELECTOR, selector)
            good = []

            for el in elements:
                try:
                    if not el.is_displayed():
                        continue

                    src = el.get_attribute("src") or el.get_attribute("data-src") or ""
                    w = int(el.get_attribute("width") or 0)
                    h = int(el.get_attribute("height") or 0)

                    if src and (w >= 80 or h >= 80):
                        good.append(el)

                except Exception:
                    continue

            if len(good) >= 3:
                return good

        except Exception:
            continue

    return []


def get_large_image_urls(driver) -> list[str]:
    urls = []
    seen = set()

    selectors = [
        "img.sFlh5c.FyHeAf.iPVvYb",
        "img.iPVvYb",
        "img.n3VNCb",
        "img.sFlh5c",
        "div[role='dialog'] img",
        "img",
    ]

    for selector in selectors:
        try:
            imgs = driver.find_elements(By.CSS_SELECTOR, selector)
        except Exception:
            continue

        for img in imgs:
            try:
                if not img.is_displayed():
                    continue

                src = img.get_attribute("src") or img.get_attribute("data-src") or ""

                if not src.startswith(("http://", "https://")):
                    continue

                low = src.lower()

                if (
                    "gstatic.com" in low
                    or "/logos/" in low
                    or "favicon" in low
                ):
                    continue

                nw = driver.execute_script("return arguments[0].naturalWidth || 0;", img)
                nh = driver.execute_script("return arguments[0].naturalHeight || 0;", img)

                if nw < 300 and nh < 300:
                    continue

                if src not in seen:
                    seen.add(src)
                    urls.append(src)

            except Exception:
                continue

    return urls


def scroll_down(driver):
    try:
        driver.execute_script(
            "window.scrollBy(0, Math.max(window.innerHeight * 1.5, 900));"
        )
        time.sleep(1)
    except Exception:
        pass


def validate_image(content: bytes, min_short_side: int, min_long_side: int):
    try:
        with Image.open(io.BytesIO(content)) as img:
            img.load()
            w, h = img.size

        if min(w, h) < min_short_side:
            return False, w, h

        if max(w, h) < min_long_side:
            return False, w, h

        return True, w, h

    except Exception:
        return False, 0, 0


def detect_extension(content: bytes) -> str:
    try:
        with Image.open(io.BytesIO(content)) as img:
            fmt = (img.format or "").upper()

        return {
            "JPEG": ".jpg",
            "PNG": ".png",
            "WEBP": ".webp",
            "GIF": ".gif",
            "AVIF": ".avif",
        }.get(fmt, ".jpg")

    except Exception:
        return ".jpg"


def download_image(session, image_url, referer, min_short_side, min_long_side):
    headers = dict(HEADERS)
    headers["Referer"] = referer

    r = session.get(
        image_url,
        headers=headers,
        timeout=25,
        allow_redirects=True,
    )
    r.raise_for_status()

    ctype = (r.headers.get("Content-Type") or "").lower()
    if ctype and "image" not in ctype:
        raise ValueError(f"contenu non image: {ctype}")

    content = r.content

    if len(content) > 25 * 1024 * 1024:
        raise ValueError("image trop volumineuse")

    valid, w, h = validate_image(
        content,
        min_short_side=min_short_side,
        min_long_side=min_long_side,
    )

    if not valid:
        raise ValueError(f"image trop petite ou invalide: {w}x{h}")

    return content, w, h


def save_image(content, folder: Path, product_slug: str, number: int):
    digest = hashlib.sha1(content).hexdigest()[:10]
    ext = detect_extension(content)

    filename = f"{product_slug}-{number:02d}-{digest}{ext}"
    path = folder / filename
    path.write_bytes(content)

    return path


def process_product(
    driver,
    session,
    product,
    output_root,
    images_per_product,
    max_thumbnails,
    min_short_side,
    min_long_side,
    search_suffix,
):
    query = f"{product} {search_suffix}".strip()
    search_url = google_images_url(query)

    print(f"  Recherche: {query}")

    driver.get(search_url)
    time.sleep(2)
    accept_consent(driver)
    time.sleep(0.5)

    product_slug = slugify(product)
    product_dir = output_root / product_slug
    product_dir.mkdir(parents=True, exist_ok=True)

    downloaded = []
    seen_urls = set()
    seen_hashes = set()
    tried = 0

    for _ in range(6):
        thumbs = get_thumbnails(driver)

        if not thumbs:
            scroll_down(driver)
            continue

        for thumb in thumbs:
            if len(downloaded) >= images_per_product:
                break

            if tried >= max_thumbnails:
                break

            tried += 1

            try:
                driver.execute_script(
                    "arguments[0].scrollIntoView({block:'center'});",
                    thumb,
                )
                time.sleep(0.15)

                try:
                    driver.execute_script("arguments[0].click();", thumb)
                except Exception:
                    thumb.click()

                time.sleep(0.8)

                large_urls = get_large_image_urls(driver)

                for image_url in large_urls:
                    if len(downloaded) >= images_per_product:
                        break

                    if image_url in seen_urls:
                        continue

                    seen_urls.add(image_url)

                    try:
                        content, w, h = download_image(
                            session,
                            image_url,
                            search_url,
                            min_short_side,
                            min_long_side,
                        )

                        digest = hashlib.sha1(content).hexdigest()

                        if digest in seen_hashes:
                            continue

                        seen_hashes.add(digest)

                        path = save_image(
                            content,
                            product_dir,
                            product_slug,
                            len(downloaded) + 1,
                        )

                        downloaded.append({
                            "product": product,
                            "query": query,
                            "image_number": len(downloaded) + 1,
                            "image_url": image_url,
                            "width": w,
                            "height": h,
                            "file": str(path),
                        })

                        print(
                            f"    OK {len(downloaded)}/{images_per_product} "
                            f"| {w}x{h} | {path.name}"
                        )

                    except Exception as exc:
                        print(f"    rejet: {exc}")

            except (
                StaleElementReferenceException,
                ElementClickInterceptedException,
                WebDriverException,
            ):
                continue

        if len(downloaded) >= images_per_product:
            break

        if tried >= max_thumbnails:
            break

        scroll_down(driver)

    return downloaded


def write_manifest(rows, path: Path):
    fields = [
        "product",
        "query",
        "image_number",
        "image_url",
        "width",
        "height",
        "file",
    ]

    with path.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=fields,
            delimiter=";",
        )
        writer.writeheader()
        writer.writerows(rows)


def main():
    parser = argparse.ArgumentParser(
        description="Télécharge des images produits depuis Google Images."
    )

    parser.add_argument(
        "input",
        nargs="?",
        default="produits.txt",
    )

    parser.add_argument(
        "--output",
        default="images_google",
    )

    parser.add_argument(
        "--images-per-product",
        type=int,
        default=3,
    )

    parser.add_argument(
        "--max-thumbnails",
        type=int,
        default=40,
    )

    parser.add_argument(
        "--min-short-side",
        type=int,
        default=250,
    )

    parser.add_argument(
        "--min-long-side",
        type=int,
        default=600,
    )

    parser.add_argument(
        "--search-suffix",
        default="bottle product packshot",
    )

    parser.add_argument(
        "--headless",
        action="store_true",
    )

    args = parser.parse_args()

    input_path = Path(args.input)

    if not input_path.exists():
        raise SystemExit(f"Fichier introuvable: {input_path}")

    products = load_products(input_path)

    if not products:
        raise SystemExit("Aucun produit trouvé.")

    output_root = Path(args.output)
    output_root.mkdir(parents=True, exist_ok=True)

    print(f"Produits: {len(products)}")
    print(f"Sortie  : {output_root.resolve()}")

    session = requests.Session()
    session.headers.update(HEADERS)

    driver = None
    all_rows = []

    try:
        print("Ouverture de Chrome...")
        driver = build_driver(headless=args.headless)

        for i, product in enumerate(products, start=1):
            print(f"\n[{i}/{len(products)}] {product}")

            rows = process_product(
                driver=driver,
                session=session,
                product=product,
                output_root=output_root,
                images_per_product=max(1, args.images_per_product),
                max_thumbnails=max(5, args.max_thumbnails),
                min_short_side=max(1, args.min_short_side),
                min_long_side=max(1, args.min_long_side),
                search_suffix=args.search_suffix,
            )

            all_rows.extend(rows)

            if not rows:
                print("  -> aucune image téléchargée")
            else:
                print(f"  -> {len(rows)} image(s) téléchargée(s)")

            time.sleep(1)

    finally:
        if driver is not None:
            try:
                driver.quit()
            except Exception:
                pass

        manifest = output_root / "manifest.csv"
        write_manifest(all_rows, manifest)

        print("\n=== TERMINE ===")
        print(f"Images téléchargées: {len(all_rows)}")
        print(f"Manifest: {manifest.resolve()}")


if __name__ == "__main__":
    main()
