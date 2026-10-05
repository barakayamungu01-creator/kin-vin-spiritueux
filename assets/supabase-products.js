(() => {
  const cfg = window.KINVINS_SUPABASE_CONFIG || {};

  const configured = () =>
    Boolean(
      cfg.url &&
      cfg.publishableKey &&
      !String(cfg.url).includes("VOTRE-PROJET") &&
      !String(cfg.publishableKey).includes("VOTRE_CLE")
    );

  // Le panier peut être lu avant que le catalogue Supabase soit disponible.
  // Ces drapeaux empêchent cart.html d'afficher à tort "panier vide".
  window.KIN_PRODUCTS_LOADING = configured();
  window.KIN_PRODUCTS_READY = !configured();

  const adminToken = () => {
    try {
      const session = JSON.parse(sessionStorage.getItem("kinvins_admin_session") || "null");
      return session?.accessToken || "";
    } catch {
      return "";
    }
  };

  async function api(resource, options = {}) {
    if (!configured()) throw new Error("Supabase n'est pas configuré.");

    const headers = {
      apikey: cfg.publishableKey,
      "Content-Type": "application/json"
    };

    if (options.admin) {
      const token = adminToken();
      if (!token) throw new Error("Session administrateur absente.");
      headers.Authorization = `Bearer ${token}`;
    }

    if (options.prefer) headers.Prefer = options.prefer;

    const response = await fetch(`${cfg.url}/rest/v1/${resource}`, {
      method: options.method || "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });

    if (!response.ok) {
      let message = `${response.status} ${response.statusText}`;
      try {
        const body = await response.json();
        message = body.message || body.details || body.hint || message;
      } catch {}
      throw new Error(message);
    }

    if (response.status === 204) return null;
    const type = response.headers.get("content-type") || "";
    return type.includes("application/json") ? response.json() : null;
  }

  function normalize(row) {
    return {
      id: Number(row.id),
      name: row.name || "",
      brand: row.brand || "",
      category: row.category || "",
      subcategory: row.subcategory || "",
      sku: row.sku || "",
      origin: row.origin || "",
      volume: row.volume || "",
      abv: row.abv || "",
      price: Number(row.price || 0),
      promoPrice: row.promo_price == null ? 0 : Number(row.promo_price),
      stock: Number(row.stock || 0),
      badge: row.badge || "",
      description: row.description || "",
      active: row.active !== false,
      featured: Boolean(row.featured),
      image: row.image_url || "",
      tone: row.tone || "#5c1e26",
      createdAt: row.created_at || null,
      updatedAt: row.updated_at || null
    };
  }

  function toDb(product) {
    return {
      name: String(product.name || "").trim(),
      brand: product.brand || null,
      category: product.category || null,
      subcategory: product.subcategory || null,
      sku: product.sku || null,
      origin: product.origin || null,
      volume: product.volume || null,
      abv: product.abv || null,
      price: Number(product.price || 0),
      promo_price: Number(product.promoPrice || 0) > 0 ? Number(product.promoPrice) : null,
      stock: Math.max(0, Number(product.stock || 0)),
      badge: product.badge || null,
      description: product.description || null,
      active: product.active !== false,
      featured: Boolean(product.featured),
      image_url: product.image || null,
      tone: product.tone || "#5c1e26",
      updated_at: new Date().toISOString()
    };
  }

  const ProductsAPI = {
    configured,

    async list({ admin = false } = {}) {
      const fields = [
        "id","name","brand","category","subcategory","sku","origin","volume","abv",
        "price","promo_price","stock","badge","description","active","featured",
        "image_url","tone","created_at","updated_at"
      ].join(",");
      const active = admin ? "" : "&active=eq.true";
      const rows = await api(
        `products?select=${encodeURIComponent(fields)}${active}&order=featured.desc,created_at.desc`,
        { admin }
      );
      return (rows || []).map(normalize);
    },

    async get(id, { admin = false } = {}) {
      const rows = await api(`products?id=eq.${encodeURIComponent(id)}&select=*`, { admin });
      return rows?.[0] ? normalize(rows[0]) : null;
    },

    async create(product) {
      const body = toDb(product);
      delete body.updated_at;
      const rows = await api("products", {
        method: "POST",
        body,
        admin: true,
        prefer: "return=representation"
      });
      return normalize(rows[0]);
    },

    async update(id, product) {
      const rows = await api(`products?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: toDb(product),
        admin: true,
        prefer: "return=representation"
      });
      return rows?.[0] ? normalize(rows[0]) : null;
    },

    async remove(id) {
      await api(`products?id=eq.${encodeURIComponent(id)}`, {
        method: "DELETE",
        admin: true,
        prefer: "return=minimal"
      });
    }
  };


  const PRODUCT_BUCKET = "product-images";
  const MAX_SINGLE_IMAGE_BYTES = 5 * 1024 * 1024;
  const ALLOWED_SINGLE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

  function currentAdminToken() {
    try {
      const session = JSON.parse(sessionStorage.getItem("kinvins_admin_session") || "null");
      return session?.accessToken || "";
    } catch {
      return "";
    }
  }

  function safeSegment(value) {
    return String(value || "")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-+/g, "-") || "produit";
  }

  function fileExtension(file) {
    const byName = (file?.name?.split(".").pop() || "").toLowerCase();
    if (["jpg","jpeg","png","webp"].includes(byName)) return byName === "jpeg" ? "jpg" : byName;
    if (file?.type === "image/png") return "png";
    if (file?.type === "image/webp") return "webp";
    return "jpg";
  }

  function encodeStoragePath(path) {
    return String(path).split("/").map(encodeURIComponent).join("/");
  }

  function publicStorageUrl(path) {
    return `${cfg.url}/storage/v1/object/public/${PRODUCT_BUCKET}/${encodeStoragePath(path)}`;
  }

  async function uploadProductImageFile(file, product) {
    if (!configured()) throw new Error("Supabase n'est pas configuré.");
    if (!file) throw new Error("Aucun fichier image sélectionné.");
    if (!ALLOWED_SINGLE_IMAGE_TYPES.has(file.type) && !/\.(jpe?g|png|webp)$/i.test(file.name || "")) {
      throw new Error("Format image non pris en charge. Utilisez JPG, PNG ou WebP.");
    }
    if (file.size > MAX_SINGLE_IMAGE_BYTES) throw new Error("L'image dépasse 5 Mo.");

    const token = currentAdminToken();
    if (!token) throw new Error("Session administrateur expirée. Reconnectez-vous.");

    const folder = safeSegment(product?.sku || `product-${product?.id || "new"}`);
    const stamp = Date.now();
    const ext = fileExtension(file);
    const path = `${folder}/main-${stamp}.${ext}`;

    const response = await fetch(
      `${cfg.url}/storage/v1/object/${PRODUCT_BUCKET}/${encodeStoragePath(path)}`,
      {
        method: "POST",
        headers: {
          apikey: cfg.publishableKey,
          Authorization: `Bearer ${token}`,
          "Content-Type": file.type || "application/octet-stream",
          "cache-control": "3600"
        },
        body: file
      }
    );

    if (!response.ok) {
      let message = `${response.status} ${response.statusText}`;
      try {
        const body = await response.json();
        message = body.message || body.error || body.error_description || message;
      } catch {}
      if (response.status === 404) {
        message = "Bucket product-images introuvable. Exécutez d'abord le SQL Supabase Produits + Images.";
      } else if (response.status === 403) {
        message = "Upload refusé par Supabase Storage. Vérifiez les politiques RLS du bucket product-images et votre rôle admin.";
      }
      throw new Error(message);
    }

    return { path, url: publicStorageUrl(path) };
  }

  async function syncPrimaryImageRow(productId, uploaded, productName) {
    if (!productId || !uploaded?.url) return;
    try {
      await api(`product_images?product_id=eq.${encodeURIComponent(productId)}`, {
        method: "DELETE",
        admin: true,
        prefer: "return=minimal"
      });

      await api("product_images", {
        method: "POST",
        admin: true,
        prefer: "return=minimal",
        body: [{
          product_id: productId,
          storage_path: uploaded.path,
          public_url: uploaded.url,
          position: 1,
          is_primary: true,
          alt_text: productName ? `${productName} - photo principale` : "Photo principale"
        }]
      });
    } catch (err) {
      console.warn("Synchronisation product_images impossible :", err);
    }
  }

  window.KinSupabaseProducts = ProductsAPI;

  async function refreshPublicProducts() {
    if (!configured()) {
      window.KIN_PRODUCTS_LOADING = false;
      window.KIN_PRODUCTS_READY = true;
      if (typeof refreshCartUI === "function") refreshCartUI();
      return;
    }

    window.KIN_PRODUCTS_LOADING = true;

    try {
      PRODUCTS = await ProductsAPI.list();

      window.KIN_PRODUCTS_READY = true;
      window.KIN_PRODUCTS_LOADING = false;

      if (document.querySelector("#homeProducts")) setupHome();
      if (document.querySelector("#catalogGrid")) setupCatalogue();
      if (document.querySelector("#productDetail")) setupProduct();

      // IMPORTANT : le panier utilise les IDs du catalogue Supabase.
      // Il faut donc le recalculer seulement après chargement de PRODUCTS.
      if (typeof refreshCartUI === "function") refreshCartUI();

      window.dispatchEvent(new CustomEvent("kin:products-ready", {
        detail: { count: PRODUCTS.length }
      }));
    } catch (err) {
      console.error("Produits Supabase indisponibles :", err);

      // Fin du statut "chargement" même si Supabase est indisponible.
      // Le site peut alors utiliser les données locales de secours.
      window.KIN_PRODUCTS_READY = true;
      window.KIN_PRODUCTS_LOADING = false;

      if (typeof refreshCartUI === "function") refreshCartUI();
    }
  }

  // Remplace la liste produits admin du prototype.
  if (typeof setupAdminProducts === "function") {
    setupAdminProducts = async function() {
      const table = $("#adminProductsTable");
      if (!table) return;
      const search = $("#adminProductSearch");

      try {
        PRODUCTS = configured()
          ? await ProductsAPI.list({ admin: true })
          : PRODUCTS;
      } catch (err) {
        toast(`Produits Supabase : ${err.message}`);
      }

      function render() {
        const q = (search?.value || "").toLowerCase().trim();
        const list = PRODUCTS.filter(p =>
          `${p.name} ${p.category} ${p.brand || ""} ${p.sku || ""}`
            .toLowerCase()
            .includes(q)
        );

        table.innerHTML = list.map(p => `<tr>
          <td><div style="display:flex;align-items:center;gap:10px">
            <div class="admin-product-thumb">${p.image ? `<img src="${p.image}" alt="">` : "KIN"}</div>
            <div><strong>${p.name}</strong><div class="small muted">${p.sku || "Sans SKU"}</div></div>
          </div></td>
          <td>${p.category}</td>
          <td>${p.brand || "—"}</td>
          <td>${Number(p.promoPrice) > 0 ? `<del class="old-price">${money(p.price)}</del>${money(p.promoPrice)}` : money(p.price)}</td>
          <td>${p.stock}</td>
          <td><span class="status ${p.active === false ? "bad" : p.stock < 10 ? "warn" : "ok"}">
            ${p.active === false ? "Inactif" : p.stock < 10 ? "Stock faible" : "Actif"}
          </span></td>
          <td class="admin-actions">
            <a class="btn btn-outline btn-small" href="admin-product-new.html?id=${p.id}">Modifier</a>
            <button class="btn btn-danger btn-small" data-delete-product="${p.id}">Supprimer</button>
          </td>
        </tr>`).join("");

        $$("[data-delete-product]").forEach(btn => {
          btn.onclick = async () => {
            const id = Number(btn.dataset.deleteProduct);
            const p = getProduct(id);
            if (!confirm(`Supprimer ${p?.name || "ce produit"} ?`)) return;

            try {
              if (configured()) {
                await ProductsAPI.remove(id);
              } else {
                PRODUCTS = PRODUCTS.filter(x => x.id !== id);
                saveProducts();
              }

              PRODUCTS = PRODUCTS.filter(x => x.id !== id);
              delete state.cart[id];
              saveCart();
              render();
              toast("Produit supprimé");
            } catch (err) {
              toast(`Suppression impossible : ${err.message}`);
            }
          };
        });
      }

      if (search) search.oninput = render;

      const reset = $("#resetProductsBtn");
      if (reset) {
        if (configured()) {
          reset.style.display = "none";
        } else {
          reset.onclick = () => {
            if (confirm("Réinitialiser le catalogue de démonstration ?")) {
              resetProducts();
              render();
              toast("Catalogue réinitialisé");
            }
          };
        }
      }

      render();
    };
  }

  // Remplace le formulaire produit admin du prototype.
  if (typeof setupAdminProductForm === "function") {
    setupAdminProductForm = async function() {
      const form = $("#adminProductForm");
      if (!form) return;

      const id = Number(new URLSearchParams(location.search).get("id") || 0);

      if (configured()) {
        try {
          PRODUCTS = await ProductsAPI.list({ admin: true });
        } catch (err) {
          toast(`Produits Supabase : ${err.message}`);
        }
      }

      const existing = id ? getProduct(id) : null;
      const title = $("#productFormTitle");
      const submit = $("#productSubmitLabel");
      const preview = $("#productImagePreview");
      const imageData = $("#productImageData");
      const uploadStatus = $("#productImageUploadStatus");

      let selectedImageFile = null;
      let removeCurrentImage = false;

      if (existing) {
        if (title) title.textContent = `Modifier ${existing.name}`;
        if (submit) submit.textContent = "Enregistrer les modifications";

        ["name","category","subcategory","brand","sku","origin","volume","abv","badge","tone","description"]
          .forEach(key => {
            const el = form.elements[key];
            if (el) el.value = existing[key] ?? "";
          });

        form.elements.price.value = existing.price ?? "";
        form.elements.promoPrice.value = existing.promoPrice ?? "";
        form.elements.stock.value = existing.stock ?? 0;
        form.elements.active.checked = existing.active !== false;
        form.elements.featured.checked = !!existing.featured;
        form.elements.imageUrl.value = existing.image && !String(existing.image).startsWith("data:")
          ? existing.image
          : "";
        if (imageData) imageData.value = existing.image || "";
      }

      function setStatus(message, state = "") {
        if (!uploadStatus) return;
        uploadStatus.textContent = message || "";
        uploadStatus.className = `small image-upload-status ${state}`.trim();
      }

      function showPreview(src) {
        if (!preview) return;
        preview.innerHTML = src
          ? `<img src="${src}" alt="Aperçu produit" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"><span class="preview-image-error" style="display:none">Image inaccessible</span>`
          : `<span>Aucune image</span>`;
      }

      showPreview(existing?.image || "");

      form.elements.imageUrl.oninput = e => {
        const value = e.target.value.trim();
        selectedImageFile = null;
        removeCurrentImage = false;
        form.elements.imageFile.value = "";
        imageData.value = value;
        showPreview(value);
        setStatus(value ? "URL externe sélectionnée." : "");
      };

      form.elements.imageFile.onchange = e => {
        const file = e.target.files?.[0];
        selectedImageFile = null;
        if (!file) return;

        if (!ALLOWED_SINGLE_IMAGE_TYPES.has(file.type) && !/\.(jpe?g|png|webp)$/i.test(file.name || "")) {
          toast("Utilisez une image JPG, PNG ou WebP.");
          e.target.value = "";
          return;
        }

        if (file.size > MAX_SINGLE_IMAGE_BYTES) {
          toast("Image trop lourde : maximum 5 Mo.");
          e.target.value = "";
          return;
        }

        selectedImageFile = file;
        removeCurrentImage = false;
        form.elements.imageUrl.value = "";

        const previewUrl = URL.createObjectURL(file);
        showPreview(previewUrl);

        if (configured()) {
          imageData.value = existing?.image || "";
          setStatus(`${file.name} sera envoyé dans Supabase Storage lors de l'enregistrement.`, "ready");
        } else {
          const reader = new FileReader();
          reader.onload = () => { imageData.value = reader.result; };
          reader.readAsDataURL(file);
          setStatus(`${file.name} sera enregistré localement dans le navigateur.`, "ready");
        }
      };

      const remove = $("#removeProductImage");
      if (remove) {
        remove.onclick = () => {
          selectedImageFile = null;
          removeCurrentImage = true;
          imageData.value = "";
          form.elements.imageUrl.value = "";
          form.elements.imageFile.value = "";
          showPreview("");
          setStatus("L'image sera retirée du produit à l'enregistrement.", "warn");
        };
      }

      form.onsubmit = async e => {
        e.preventDefault();

        const data = Object.fromEntries(new FormData(form).entries());
        const item = {
          ...(existing || {}),
          name: data.name.trim(),
          category: data.category,
          subcategory: data.subcategory.trim(),
          brand: data.brand.trim(),
          sku: data.sku.trim(),
          origin: data.origin.trim(),
          volume: data.volume.trim(),
          abv: data.abv.trim(),
          badge: data.badge.trim() || "Nouveau",
          tone: data.tone || "#5c1e26",
          price: Number(data.price),
          promoPrice: Number(data.promoPrice || 0),
          stock: Number(data.stock || 0),
          description: data.description.trim(),
          image: removeCurrentImage ? "" : (data.imageData || existing?.image || ""),
          active: form.elements.active.checked,
          featured: form.elements.featured.checked
        };

        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.dataset.originalText = submitBtn.textContent;
          submitBtn.textContent = selectedImageFile && configured() ? "Envoi de l’image…" : "Enregistrement…";
        }

        try {
          if (configured()) {
            let saved = existing
              ? await ProductsAPI.update(existing.id, item)
              : await ProductsAPI.create(item);

            if (selectedImageFile) {
              setStatus("Upload vers Supabase Storage…", "loading");
              const uploaded = await uploadProductImageFile(selectedImageFile, saved);
              item.image = uploaded.url;

              saved = await ProductsAPI.update(saved.id, {
                ...saved,
                ...item,
                image: uploaded.url
              });

              await syncPrimaryImageRow(saved.id, uploaded, saved.name);
              setStatus("Image envoyée et liée au produit.", "ok");
            } else if (removeCurrentImage) {
              saved = await ProductsAPI.update(saved.id, { ...saved, ...item, image: "" });
              try {
                await api(`product_images?product_id=eq.${encodeURIComponent(saved.id)}`, {
                  method: "DELETE",
                  admin: true,
                  prefer: "return=minimal"
                });
              } catch (err) {
                console.warn("Nettoyage product_images impossible :", err);
              }
            }

            if (existing) {
              PRODUCTS = PRODUCTS.map(p => p.id === existing.id ? saved : p);
            } else {
              PRODUCTS.unshift(saved);
            }
          } else {
            const localItem = {
              ...item,
              id: existing?.id || Math.max(0, ...PRODUCTS.map(p => Number(p.id) || 0)) + 1
            };

            if (existing) PRODUCTS = PRODUCTS.map(p => p.id === existing.id ? localItem : p);
            else PRODUCTS.push(localItem);

            saveProducts();
          }

          toast(existing ? "Produit modifié" : "Produit ajouté");
          setTimeout(() => location.href = "admin-products.html", 650);
        } catch (err) {
          toast(`Enregistrement impossible : ${err.message}`);
          setStatus(err.message || "Erreur d'upload.", "bad");
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = submitBtn.dataset.originalText || (existing ? "Enregistrer les modifications" : "Ajouter le produit");
          }
        }
      };
    };
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!location.pathname.includes("/admin/")) {
      refreshPublicProducts();
    }
  });
})();
