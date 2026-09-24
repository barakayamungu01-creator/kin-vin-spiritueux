(() => {
  "use strict";

  const $ = s => document.querySelector(s);

  const els = {
    productFile: $("#productFile"),
    photoFolder: $("#photoFolder"),
    productFileName: $("#productFileName"),
    photoFolderName: $("#photoFolderName"),
    analyze: $("#analyzeImportBtn"),
    clear: $("#clearImportBtn"),
    analysis: $("#importAnalysis"),
    previewBody: $("#importPreviewBody"),
    run: $("#runImportBtn"),
    readyText: $("#importReadyText"),
    progressBox: $("#importProgressBox"),
    progressTitle: $("#progressTitle"),
    progressPercent: $("#progressPercent"),
    progressBar: $("#progressBar"),
    progressDetail: $("#progressDetail"),
    log: $("#importLog"),
    result: $("#importResult")
  };

  const cfg = window.KINVINS_SUPABASE_CONFIG || {};
  const BUCKET = "product-images";
  const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
  const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

  let parsedRows = [];
  let photoFiles = [];
  let analysisRows = [];

  const aliases = {
    sku: ["sku","reference","référence","ref","code","code produit","product code"],
    name: ["name","nom","nom produit","produit","product","product name"],
    brand: ["brand","marque"],
    category: ["category","categorie","catégorie"],
    subcategory: ["subcategory","sub category","sous categorie","sous catégorie","sous-categorie","sous-catégorie"],
    origin: ["origin","origine","pays","country"],
    volume: ["volume","contenance","format"],
    abv: ["abv","alcool","degre","degré","alcohol","alcohol %","taux alcool"],
    price: ["price","prix","prix vente","selling price"],
    promoPrice: ["promo_price","promo price","prix promo","prix promotion","prix promotionnel"],
    stock: ["stock","quantite","quantité","qty","quantity"],
    badge: ["badge","etiquette","étiquette","tag"],
    description: ["description","desc"],
    active: ["active","actif","visible"],
    featured: ["featured","vedette","mis en avant","mise en avant","selection","sélection"],
    imageUrl: ["image_url","image url","photo url","url image","url photo"]
  };

  function configured() {
    return Boolean(
      cfg.url &&
      cfg.publishableKey &&
      !String(cfg.url).includes("VOTRE-PROJET") &&
      !String(cfg.publishableKey).includes("VOTRE_CLE")
    );
  }

  function adminSession() {
    try {
      return JSON.parse(sessionStorage.getItem("kinvins_admin_session") || "null");
    } catch {
      return null;
    }
  }

  function normalizeHeader(value) {
    return String(value ?? "")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .trim().toLowerCase()
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ");
  }

  function canonicalSku(value) {
    return String(value ?? "")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .trim().toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-+/g, "-");
  }

  function safeStorageSegment(value) {
    return canonicalSku(value).toLowerCase() || "produit";
  }

  function parseBool(value, fallback = false) {
    if (value === true || value === 1) return true;
    if (value === false || value === 0) return false;
    const s = String(value ?? "").trim().toLowerCase();
    if (!s) return fallback;
    if (["true","1","yes","oui","o","y","actif","active"].includes(s)) return true;
    if (["false","0","no","non","n","inactif","inactive"].includes(s)) return false;
    return fallback;
  }

  function parseNumber(value, fallback = 0) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    const s = String(value ?? "")
      .trim()
      .replace(/\s/g, "")
      .replace(/\$/g, "")
      .replace(/,/g, ".");
    const n = Number(s);
    return Number.isFinite(n) ? n : fallback;
  }

  function mapColumns(raw) {
    const source = {};
    for (const [key, value] of Object.entries(raw || {})) {
      source[normalizeHeader(key)] = value;
    }

    const get = field => {
      for (const alias of aliases[field]) {
        const key = normalizeHeader(alias);
        if (Object.prototype.hasOwnProperty.call(source, key)) return source[key];
      }
      return "";
    };

    return {
      sku: String(get("sku") ?? "").trim(),
      name: String(get("name") ?? "").trim(),
      brand: String(get("brand") ?? "").trim(),
      category: String(get("category") ?? "").trim(),
      subcategory: String(get("subcategory") ?? "").trim(),
      origin: String(get("origin") ?? "").trim(),
      volume: String(get("volume") ?? "").trim(),
      abv: String(get("abv") ?? "").trim(),
      price: parseNumber(get("price"), 0),
      promoPrice: parseNumber(get("promoPrice"), 0),
      stock: Math.max(0, Math.trunc(parseNumber(get("stock"), 0))),
      badge: String(get("badge") ?? "").trim(),
      description: String(get("description") ?? "").trim(),
      active: parseBool(get("active"), true),
      featured: parseBool(get("featured"), false),
      imageUrl: String(get("imageUrl") ?? "").trim()
    };
  }

  function csvParse(text) {
    const firstLine = (text.split(/\r?\n/)[0] || "");
    const candidates = [",",";","\t","|"];
    const delimiter = candidates
      .map(d => [d, firstLine.split(d).length])
      .sort((a,b) => b[1]-a[1])[0][0];

    const rows = [];
    let row = [], field = "", quoted = false;

    for (let i=0; i<text.length; i++) {
      const ch = text[i];
      const next = text[i+1];

      if (ch === '"' && quoted && next === '"') {
        field += '"'; i++; continue;
      }
      if (ch === '"') {
        quoted = !quoted; continue;
      }
      if (ch === delimiter && !quoted) {
        row.push(field); field = ""; continue;
      }
      if ((ch === "\n" || ch === "\r") && !quoted) {
        if (ch === "\r" && next === "\n") i++;
        row.push(field); field = "";
        if (row.some(v => String(v).trim() !== "")) rows.push(row);
        row = [];
        continue;
      }
      field += ch;
    }
    if (field || row.length) {
      row.push(field);
      if (row.some(v => String(v).trim() !== "")) rows.push(row);
    }

    if (!rows.length) return [];
    const headers = rows.shift().map(h => String(h).trim());
    return rows.map(cols => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = cols[i] ?? "");
      return obj;
    });
  }

  async function readProductFile(file) {
    if (!file) throw new Error("Sélectionnez un fichier CSV ou Excel.");
    const ext = (file.name.split(".").pop() || "").toLowerCase();

    if (ext === "csv" || ext === "txt") {
      return csvParse(await file.text());
    }

    if (!window.XLSX) {
      throw new Error("Le module Excel n'a pas pu être chargé. Utilisez un CSV ou rechargez la page.");
    }

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return [];
    const sheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
  }

  function imageFilesFromInput(fileList) {
    return [...(fileList || [])].filter(file =>
      ALLOWED_IMAGE_TYPES.has(file.type) ||
      /\.(jpe?g|png|webp)$/i.test(file.name)
    );
  }

  function photoRank(file, skuCanon) {
    const stem = file.name.replace(/\.[^.]+$/, "");
    const c = canonicalSku(stem);
    if (c === skuCanon) return 0;
    if (c === `${skuCanon}-MAIN`) return 1;
    if (c === `${skuCanon}-1`) return 2;
    const m = c.match(new RegExp(`^${skuCanon.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}-(\\d+)$`));
    if (m) return 10 + Number(m[1]);
    return 100;
  }

  function matchPhotos(sku) {
    const skuCanon = canonicalSku(sku);
    if (!skuCanon) return [];

    return photoFiles
      .filter(file => {
        const stem = file.name.replace(/\.[^.]+$/, "");
        const c = canonicalSku(stem);
        return c === skuCanon || c.startsWith(`${skuCanon}-`);
      })
      .sort((a,b) => {
        const ra = photoRank(a, skuCanon);
        const rb = photoRank(b, skuCanon);
        return ra - rb || a.name.localeCompare(b.name);
      });
  }

  function validateRow(product, photos, options) {
    const errors = [];
    const warnings = [];

    if (!product.sku) errors.push("SKU manquant");
    if (!product.name) errors.push("Nom manquant");
    if (!product.category) warnings.push("Catégorie vide");
    if (!(product.price > 0)) errors.push("Prix invalide");
    if (product.stock < 0) errors.push("Stock invalide");
    if (options.requirePhoto && !photos.length && !product.imageUrl) errors.push("Photo requise");
    if (!photos.length && !product.imageUrl) warnings.push("Aucune photo");
    if (photos.some(f => f.size > MAX_IMAGE_BYTES)) errors.push("Photo > 5 Mo");
    if (options.skipInactive && product.active === false) errors.push("Produit inactif ignoré");

    return { errors, warnings };
  }

  function options() {
    return {
      updateExisting: $("#updateExisting").checked,
      replacePhotos: $("#replacePhotos").checked,
      requirePhoto: $("#requirePhoto").checked,
      skipInactive: $("#skipInactive").checked
    };
  }

  function setProgress(done, total, title, detail = "") {
    const pct = total ? Math.round((done / total) * 100) : 0;
    els.progressPercent.textContent = `${pct}%`;
    els.progressBar.style.width = `${pct}%`;
    els.progressTitle.textContent = title;
    els.progressDetail.textContent = detail;
  }

  function log(message, type = "info") {
    const div = document.createElement("div");
    div.className = type;
    div.textContent = message;
    els.log.appendChild(div);
    els.log.scrollTop = els.log.scrollHeight;
  }

  function sessionHeaders(extra = {}) {
    const session = adminSession();
    if (!session?.accessToken) throw new Error("Session administrateur expirée.");
    return {
      apikey: cfg.publishableKey,
      Authorization: `Bearer ${session.accessToken}`,
      ...extra
    };
  }

  async function rest(resource, {
    method = "GET",
    body,
    prefer = "",
    contentType = "application/json"
  } = {}) {
    const headers = sessionHeaders({});
    if (contentType) headers["Content-Type"] = contentType;
    if (prefer) headers.Prefer = prefer;

    const response = await fetch(`${cfg.url}/rest/v1/${resource}`, {
      method,
      headers,
      body: body === undefined ? undefined :
        (contentType === "application/json" ? JSON.stringify(body) : body)
    });

    if (!response.ok) {
      let message = `${response.status} ${response.statusText}`;
      try {
        const payload = await response.json();
        message = payload.message || payload.details || payload.hint || message;
      } catch {}
      throw new Error(message);
    }

    if (response.status === 204) return null;
    const type = response.headers.get("content-type") || "";
    return type.includes("application/json") ? response.json() : null;
  }

  async function fetchExistingBySku(skus) {
    if (!skus.length) return new Map();
    const map = new Map();

    for (let i=0; i<skus.length; i+=100) {
      const chunk = skus.slice(i, i+100)
        .map(s => `"${String(s).replace(/"/g,'\\"')}"`)
        .join(",");
      const rows = await rest(
        `products?select=id,sku,name&sku=in.(${encodeURIComponent(chunk)})`
      );
      (rows || []).forEach(r => map.set(String(r.sku).trim().toUpperCase(), r));
    }
    return map;
  }

  async function upsertProducts(rows, allowUpdate) {
    if (!rows.length) return [];

    if (!allowUpdate) {
      const existing = await fetchExistingBySku(rows.map(r => r.sku));
      const duplicate = rows.find(r => existing.has(r.sku.toUpperCase()));
      if (duplicate) throw new Error(`Le SKU ${duplicate.sku} existe déjà. Activez "Mettre à jour les SKU existants".`);
    }

    const payload = rows.map(p => ({
      sku: p.sku,
      name: p.name,
      brand: p.brand || null,
      category: p.category || null,
      subcategory: p.subcategory || null,
      origin: p.origin || null,
      volume: p.volume || null,
      abv: p.abv || null,
      price: p.price,
      promo_price: p.promoPrice > 0 ? p.promoPrice : null,
      stock: p.stock,
      badge: p.badge || null,
      description: p.description || null,
      active: p.active,
      featured: p.featured,
      image_url: p.imageUrl || null,
      updated_at: new Date().toISOString()
    }));

    const results = [];
    for (let i=0; i<payload.length; i+=50) {
      const chunk = payload.slice(i, i+50);
      const rowsOut = await rest(
        "products?on_conflict=sku",
        {
          method: "POST",
          body: chunk,
          prefer: "resolution=merge-duplicates,return=representation"
        }
      );
      results.push(...(rowsOut || []));
    }
    return results;
  }

  function storagePath(sku, index, file) {
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace("jpeg","jpg");
    const skuPath = safeStorageSegment(sku);
    const n = String(index + 1).padStart(2, "0");
    return `${skuPath}/${n}.${ext}`;
  }

  function encodeObjectPath(path) {
    return path.split("/").map(encodeURIComponent).join("/");
  }

  async function uploadImage(path, file) {
    const response = await fetch(
      `${cfg.url}/storage/v1/object/${BUCKET}/${encodeObjectPath(path)}`,
      {
        method: "POST",
        headers: sessionHeaders({
          "Content-Type": file.type || "application/octet-stream",
          "cache-control": "3600",
          "x-upsert": "true"
        }),
        body: file
      }
    );

    if (!response.ok) {
      let message = `${response.status} ${response.statusText}`;
      try {
        const payload = await response.json();
        message = payload.message || payload.error || message;
      } catch {}
      throw new Error(message);
    }

    return `${cfg.url}/storage/v1/object/public/${BUCKET}/${encodeObjectPath(path)}`;
  }

  async function clearImageRows(productId) {
    await rest(`product_images?product_id=eq.${encodeURIComponent(productId)}`, {
      method: "DELETE",
      prefer: "return=minimal"
    });
  }

  async function saveImageRows(rows) {
    if (!rows.length) return;
    await rest("product_images", {
      method: "POST",
      body: rows,
      prefer: "return=minimal"
    });
  }

  async function setPrimaryProductImage(productId, url) {
    await rest(`products?id=eq.${encodeURIComponent(productId)}`, {
      method: "PATCH",
      body: { image_url: url, updated_at: new Date().toISOString() },
      prefer: "return=minimal"
    });
  }

  async function analyze() {
    if (!configured()) {
      throw new Error("Supabase n'est pas configuré dans assets/supabase-config.js.");
    }
    const session = adminSession();
    if (!session?.accessToken) {
      throw new Error("Reconnectez-vous à l'administration.");
    }

    const file = els.productFile.files?.[0];
    const rawRows = await readProductFile(file);
    if (!rawRows.length) throw new Error("Le fichier ne contient aucune ligne exploitable.");

    parsedRows = rawRows.map(mapColumns);
    photoFiles = imageFilesFromInput(els.photoFolder.files);
    const opts = options();

    analysisRows = parsedRows.map((product, index) => {
      const photos = matchPhotos(product.sku);
      const validation = validateRow(product, photos, opts);
      return { index, product, photos, ...validation };
    });

    const ready = analysisRows.filter(r => !r.errors.length);
    const withPhotos = analysisRows.filter(r => r.photos.length || r.product.imageUrl).length;
    const errors = analysisRows.filter(r => r.errors.length).length;

    $("#kpiRows").textContent = analysisRows.length;
    $("#kpiReady").textContent = ready.length;
    $("#kpiPhotos").textContent = withPhotos;
    $("#kpiErrors").textContent = errors;

    els.previewBody.innerHTML = analysisRows.map((r, i) => {
      const state = r.errors.length ? "bad" : r.warnings.length ? "warn" : "ok";
      const label = r.errors.length
        ? r.errors.join(" • ")
        : r.warnings.length
          ? r.warnings.join(" • ")
          : "Prêt";

      return `<tr>
        <td>${i + 1}</td>
        <td><strong>${r.product.sku || "—"}</strong></td>
        <td>${r.product.name || "—"}${r.product.brand ? `<div class="small muted">${r.product.brand}</div>` : ""}</td>
        <td>${r.product.category || "—"}</td>
        <td>$${Number(r.product.price || 0).toFixed(2)}</td>
        <td>${r.product.stock}</td>
        <td><span class="photo-count">${r.photos.length}</span>${r.product.imageUrl && !r.photos.length ? ' + URL' : ''}</td>
        <td><span class="import-status ${state}">${label}</span></td>
      </tr>`;
    }).join("");

    els.readyText.textContent = `${ready.length} produit(s) seront importés. ${errors} ligne(s) seront ignorées.`;
    els.run.disabled = ready.length === 0;
    els.analysis.classList.remove("hidden");
    els.result.classList.add("hidden");
  }

  async function runImport() {
    const validRows = analysisRows.filter(r => !r.errors.length);
    if (!validRows.length) return;

    const opts = options();
    els.run.disabled = true;
    els.progressBox.classList.remove("hidden");
    els.result.classList.add("hidden");
    els.log.innerHTML = "";
    setProgress(0, validRows.length, "Création / mise à jour des produits");

    let failureCount = 0;
    let uploadedPhotos = 0;
    let upserted = [];

    try {
      upserted = await upsertProducts(validRows.map(r => r.product), opts.updateExisting);
      log(`${upserted.length} produit(s) créé(s) ou mis à jour.`, "ok");
    } catch (err) {
      log(`Produits : ${err.message}`, "err");
      els.run.disabled = false;
      throw err;
    }

    const bySku = new Map(
      upserted.map(p => [String(p.sku || "").trim().toUpperCase(), p])
    );

    for (let i=0; i<validRows.length; i++) {
      const entry = validRows[i];
      const product = bySku.get(entry.product.sku.toUpperCase());

      setProgress(
        i,
        validRows.length,
        `Photos : ${entry.product.name}`,
        `${i + 1}/${validRows.length} • ${entry.photos.length} photo(s)`
      );

      if (!product) {
        failureCount++;
        log(`${entry.product.sku} : produit introuvable après upsert`, "err");
        continue;
      }

      if (!entry.photos.length) {
        if (entry.product.imageUrl) {
          try {
            await setPrimaryProductImage(product.id, entry.product.imageUrl);
            log(`${entry.product.sku} : URL d'image conservée`, "info");
          } catch (err) {
            failureCount++;
            log(`${entry.product.sku} : ${err.message}`, "err");
          }
        } else {
          log(`${entry.product.sku} : aucune photo`, "info");
        }
        continue;
      }

      try {
        if (opts.replacePhotos) {
          await clearImageRows(product.id);
        }

        const imageRows = [];
        let primaryUrl = "";

        for (let j=0; j<entry.photos.length; j++) {
          const file = entry.photos[j];

          if (file.size > MAX_IMAGE_BYTES) {
            throw new Error(`${file.name} dépasse 5 Mo`);
          }

          const path = storagePath(entry.product.sku, j, file);
          const url = await uploadImage(path, file);
          uploadedPhotos++;

          if (j === 0) primaryUrl = url;

          imageRows.push({
            product_id: product.id,
            storage_path: path,
            public_url: url,
            position: j + 1,
            is_primary: j === 0,
            alt_text: `${entry.product.name} - photo ${j + 1}`
          });
        }

        await saveImageRows(imageRows);
        if (primaryUrl) await setPrimaryProductImage(product.id, primaryUrl);

        log(`${entry.product.sku} : ${entry.photos.length} photo(s) envoyée(s)`, "ok");
      } catch (err) {
        failureCount++;
        log(`${entry.product.sku} : ${err.message}`, "err");
      }
    }

    setProgress(validRows.length, validRows.length, "Import terminé", `${uploadedPhotos} photo(s) envoyée(s)`);

    $("#resultProducts").textContent = validRows.length;
    $("#resultCreatedUpdated").textContent = upserted.length;
    $("#resultPhotos").textContent = uploadedPhotos;
    $("#resultFailed").textContent = failureCount;
    els.result.classList.remove("hidden");
    els.run.disabled = false;
  }

  function clearAll() {
    parsedRows = [];
    photoFiles = [];
    analysisRows = [];
    els.productFile.value = "";
    els.photoFolder.value = "";
    els.productFileName.textContent = "Aucun fichier choisi";
    els.photoFolderName.textContent = "Aucun dossier choisi";
    els.analysis.classList.add("hidden");
    els.progressBox.classList.add("hidden");
    els.result.classList.add("hidden");
    els.log.innerHTML = "";
  }

  els.productFile?.addEventListener("change", () => {
    const file = els.productFile.files?.[0];
    els.productFileName.textContent = file ? file.name : "Aucun fichier choisi";
  });

  els.photoFolder?.addEventListener("change", () => {
    const files = imageFilesFromInput(els.photoFolder.files);
    photoFiles = files;
    if (!files.length) {
      els.photoFolderName.textContent = "Aucun dossier choisi";
      return;
    }
    const first = files[0];
    const folder = (first.webkitRelativePath || "").split("/")[0];
    els.photoFolderName.textContent = `${folder || "Dossier"} • ${files.length} image(s)`;
  });

  els.analyze?.addEventListener("click", async () => {
    els.analyze.disabled = true;
    try {
      await analyze();
      if (window.toast) toast("Analyse terminée");
    } catch (err) {
      if (window.toast) toast(err.message);
      else alert(err.message);
    } finally {
      els.analyze.disabled = false;
    }
  });

  els.clear?.addEventListener("click", clearAll);

  els.run?.addEventListener("click", async () => {
    if (!confirm("Importer les produits et les photos dans Supabase ?")) return;
    try {
      await runImport();
      if (window.toast) toast("Import terminé");
    } catch (err) {
      if (window.toast) toast(err.message);
      else alert(err.message);
    }
  });
})();
