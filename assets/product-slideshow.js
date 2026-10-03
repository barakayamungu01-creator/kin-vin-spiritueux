(() => {
  "use strict";

  const cfg = window.KINVINS_SUPABASE_CONFIG || {};
  const ProductAPI = window.KinSupabaseProducts || null;
  const BUCKET = "product-images";
  const MAX_FILE = 5 * 1024 * 1024;
  const ALLOWED = new Set(["image/jpeg","image/png","image/webp"]);

  function configured(){
    return Boolean(
      cfg.url && cfg.publishableKey &&
      !String(cfg.url).includes("VOTRE-PROJET") &&
      !String(cfg.publishableKey).includes("VOTRE_CLE")
    );
  }

  function adminToken(){
    try{
      return JSON.parse(sessionStorage.getItem("kinvins_admin_session")||"null")?.accessToken || "";
    }catch{return ""}
  }

  function authHeaders(){
    const token=adminToken();
    if(!token) throw new Error("Session administrateur expirée.");
    return {
      apikey:cfg.publishableKey,
      Authorization:`Bearer ${token}`,
      "Content-Type":"application/json"
    };
  }

  async function rest(resource,{method="GET",body,admin=false,prefer=""}={}){
    const headers={
      apikey:cfg.publishableKey,
      "Content-Type":"application/json"
    };
    if(admin){
      const token=adminToken();
      if(!token) throw new Error("Session administrateur expirée.");
      headers.Authorization=`Bearer ${token}`;
    }
    if(prefer) headers.Prefer=prefer;

    const r=await fetch(`${cfg.url}/rest/v1/${resource}`,{
      method,headers,
      body:body===undefined?undefined:JSON.stringify(body)
    });

    if(!r.ok){
      let message=`${r.status} ${r.statusText}`;
      try{
        const j=await r.json();
        message=j.message||j.details||j.hint||message;
      }catch{}
      throw new Error(message);
    }

    if(r.status===204)return null;
    const type=r.headers.get("content-type")||"";
    return type.includes("application/json")?r.json():null;
  }

  // ------------------------------------------------------------
  // Attach the first two gallery images to each product.
  // ------------------------------------------------------------
  async function attachGallery(products,{admin=false}={}){
    if(!configured() || !Array.isArray(products) || !products.length) return products||[];

    const ids=products.map(p=>Number(p.id)).filter(Number.isFinite);
    if(!ids.length)return products;

    try{
      const rows=await rest(
        `product_images?select=product_id,storage_path,public_url,position,is_primary&product_id=in.(${ids.join(",")})&order=position.asc`,
        {admin}
      );

      const grouped=new Map();
      (rows||[]).forEach(row=>{
        const id=Number(row.product_id);
        if(!grouped.has(id))grouped.set(id,[]);
        if(grouped.get(id).length<2)grouped.get(id).push(row);
      });

      products.forEach(p=>{
        let gallery=grouped.get(Number(p.id))||[];
        if(!gallery.length && p.image){
          gallery=[{
            product_id:p.id,
            storage_path:"",
            public_url:p.image,
            position:1,
            is_primary:true
          }];
        }

        p.imageGallery=gallery.slice(0,2);
        p.images=[...new Set(p.imageGallery.map(x=>x.public_url).filter(Boolean))].slice(0,2);

        if(p.image && !p.images.includes(p.image)){
          p.images.unshift(p.image);
          p.images=p.images.slice(0,2);
        }

        if(p.images[0])p.image=p.images[0];
      });
    }catch(err){
      console.warn("Galerie produit indisponible :",err);
      products.forEach(p=>{
        p.images=p.image?[p.image]:[];
        p.imageGallery=p.image?[{
          product_id:p.id,storage_path:"",public_url:p.image,position:1,is_primary:true
        }]:[];
      });
    }
    return products;
  }

  // Wrap Supabase product list/get so existing application automatically receives gallery data.
  if(ProductAPI && !ProductAPI.__phase8Wrapped){
    const originalList=ProductAPI.list.bind(ProductAPI);
    const originalGet=ProductAPI.get.bind(ProductAPI);

    ProductAPI.list=async function(options={}){
      const products=await originalList(options);
      return attachGallery(products,options);
    };

    ProductAPI.get=async function(id,options={}){
      const p=await originalGet(id,options);
      if(!p)return null;
      const rows=await attachGallery([p],options);
      return rows[0]||p;
    };

    ProductAPI.__phase8Wrapped=true;
  }

  // ------------------------------------------------------------
  // Public slideshow
  // ------------------------------------------------------------
  function imageUrls(p){
    const arr=Array.isArray(p.images)?[...p.images]:[];
    if(p.image && !arr.includes(p.image))arr.unshift(p.image);
    return [...new Set(arr.filter(Boolean))].slice(0,2);
  }

  function fallbackBottle(p,cls="mini-bottle"){
    return `<div class="${cls} fallback-product-bottle" style="background:linear-gradient(90deg,#17110f,${p.tone||"#5c1e26"},#15100e)"><span>${p.name.split(" ").slice(0,2).join("<br>")}</span></div>`;
  }

  function slideshowHTML(p,detail=false){
    const urls=imageUrls(p);
    if(!urls.length)return fallbackBottle(p,detail?"detail-bottle":"mini-bottle");

    const slides=urls.map((url,i)=>`
      <div class="product-slide ${i===0?"is-active":""}">
        <div class="product-photo-panel ${detail?"product-photo-panel-detail":""}">
          <img class="product-photo" src="${url}" alt="${p.name} — image ${i+1}" loading="lazy"
            onerror="this.closest('.product-slide').classList.add('image-error')">
          <div class="slide-image-error">${p.name}</div>
        </div>
      </div>`).join("");

    const controls=urls.length===2?`
      <button class="product-slide-arrow prev" type="button" data-slider-prev aria-label="Image précédente">‹</button>
      <button class="product-slide-arrow next" type="button" data-slider-next aria-label="Image suivante">›</button>
      <div class="product-slide-dots">
        <button type="button" class="product-slide-dot is-active" data-slider-dot="0" aria-label="Image 1"></button>
        <button type="button" class="product-slide-dot" data-slider-dot="1" aria-label="Image 2"></button>
      </div>`:"";

    return `<div class="product-slideshow ${detail?"product-slideshow-detail":""}"
      data-product-slider data-slider-index="0" data-slider-count="${urls.length}">
      <div class="product-slides">${slides}</div>${controls}
    </div>`;
  }

  function setSlider(slider,index){
    const count=Number(slider.dataset.sliderCount||1);
    if(count<2)return;
    const next=((index%count)+count)%count;
    slider.dataset.sliderIndex=String(next);
    slider.querySelectorAll(".product-slide").forEach((el,i)=>el.classList.toggle("is-active",i===next));
    slider.querySelectorAll(".product-slide-dot").forEach((el,i)=>el.classList.toggle("is-active",i===next));
  }

  let autoTimer=null;
  function bindSliders(){
    document.querySelectorAll("[data-product-slider]").forEach(slider=>{
      if(slider.dataset.sliderBound==="1")return;
      slider.dataset.sliderBound="1";

      slider.querySelector("[data-slider-prev]")?.addEventListener("click",e=>{
        e.preventDefault();e.stopPropagation();
        setSlider(slider,Number(slider.dataset.sliderIndex||0)-1);
      });

      slider.querySelector("[data-slider-next]")?.addEventListener("click",e=>{
        e.preventDefault();e.stopPropagation();
        setSlider(slider,Number(slider.dataset.sliderIndex||0)+1);
      });

      slider.querySelectorAll("[data-slider-dot]").forEach(dot=>{
        dot.addEventListener("click",e=>{
          e.preventDefault();e.stopPropagation();
          setSlider(slider,Number(dot.dataset.sliderDot));
        });
      });

      slider.addEventListener("mouseenter",()=>slider.dataset.sliderPaused="1");
      slider.addEventListener("mouseleave",()=>slider.dataset.sliderPaused="0");
    });

    if(!autoTimer){
      autoTimer=setInterval(()=>{
        document.querySelectorAll("[data-product-slider]").forEach(slider=>{
          if(Number(slider.dataset.sliderCount||1)<2)return;
          if(slider.dataset.sliderPaused==="1")return;
          setSlider(slider,Number(slider.dataset.sliderIndex||0)+1);
        });
      },4500);
    }
  }

  if(typeof productCard==="function"){
    productCard=function(p){
      if(p.active===false)return"";
      const sellPrice=(Number(p.promoPrice)>0&&Number(p.promoPrice)<Number(p.price))
        ?Number(p.promoPrice):Number(p.price);
      const oldPrice=sellPrice<Number(p.price)?`<del class="old-price">${money(productPrice(p))}</del>`:"";

      return `<article class="product-card">
        <div class="product-visual product-visual-slider">
          ${slideshowHTML(p,false)}
          <a class="product-visual-link" href="product.html?id=${p.id}" aria-label="Voir ${p.name}"></a>
        </div>
        <div class="product-body">
          <div class="product-meta"><span>${p.category}</span><span>${p.volume}</span></div>
          <h3><a href="product.html?id=${p.id}">${p.name}</a></h3>
          <div class="origin">${p.origin}${p.brand?` • ${p.brand}`:""}</div>
          <div class="product-bottom">
            <span class="price">${oldPrice}${money(sellPrice)}</span>
            <button class="add-btn" data-add="${p.id}">+</button>
          </div>
        </div>
      </article>`;
    };
  }

  if(typeof bindAddButtons==="function"){
    const baseBind=bindAddButtons;
    bindAddButtons=function(){
      baseBind();
      bindSliders();
    };
  }

  if(typeof setupProduct==="function"){
    const baseSetupProduct=setupProduct;
    setupProduct=function(){
      baseSetupProduct();
      const p=state?.currentProduct;
      const visual=document.querySelector("#productDetail .detail-visual");
      if(p&&visual){
        visual.innerHTML=slideshowHTML(p,true);
        bindSliders();
      }
    };
  }

  // ------------------------------------------------------------
  // Admin two-image upload
  // ------------------------------------------------------------
  function safeSegment(value){
    return String(value||"")
      .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
      .trim().toLowerCase()
      .replace(/[^a-z0-9]+/g,"-")
      .replace(/^-+|-+$/g,"")
      .replace(/-+/g,"-")||"produit";
  }

  function ext(file){
    const e=(file.name?.split(".").pop()||"jpg").toLowerCase();
    return e==="jpeg"?"jpg":(["jpg","png","webp"].includes(e)?e:"jpg");
  }

  function encodePath(path){
    return path.split("/").map(encodeURIComponent).join("/");
  }

  async function uploadFile(file,product,slot){
    if(!ALLOWED.has(file.type)&&!/\.(jpe?g|png|webp)$/i.test(file.name||"")){
      throw new Error("Utilisez JPG, PNG ou WebP.");
    }
    if(file.size>MAX_FILE)throw new Error("Une image dépasse 5 Mo.");

    const token=adminToken();
    if(!token)throw new Error("Session administrateur expirée.");

    const path=`${safeSegment(product.sku||`product-${product.id}`)}/image-${slot}-${Date.now()}.${ext(file)}`;
    const r=await fetch(`${cfg.url}/storage/v1/object/${BUCKET}/${encodePath(path)}`,{
      method:"POST",
      headers:{
        apikey:cfg.publishableKey,
        Authorization:`Bearer ${token}`,
        "Content-Type":file.type||"application/octet-stream",
        "cache-control":"3600"
      },
      body:file
    });

    if(!r.ok){
      let msg=`${r.status} ${r.statusText}`;
      try{
        const j=await r.json();
        msg=j.message||j.error||msg;
      }catch{}
      throw new Error(msg);
    }

    return{
      path,
      url:`${cfg.url}/storage/v1/object/public/${BUCKET}/${encodePath(path)}`
    };
  }

  async function saveGallery(productId,gallery,name){
    const rows=(gallery||[]).filter(x=>x?.url).slice(0,2);

    await rest(`product_images?product_id=eq.${encodeURIComponent(productId)}`,{
      method:"DELETE",admin:true,prefer:"return=minimal"
    });

    if(rows.length){
      await rest("product_images",{
        method:"POST",admin:true,prefer:"return=minimal",
        body:rows.map((x,i)=>({
          product_id:productId,
          storage_path:x.path||`external/${productId}/${i+1}-${Date.now()}`,
          public_url:x.url,
          position:i+1,
          is_primary:i===0,
          alt_text:`${name} - image ${i+1}`
        }))
      });
    }

    await rest(`products?id=eq.${encodeURIComponent(productId)}`,{
      method:"PATCH",admin:true,prefer:"return=minimal",
      body:{
        image_url:rows[0]?.url||null,
        updated_at:new Date().toISOString()
      }
    });
  }

  if(typeof setupAdminProductForm==="function"){
    setupAdminProductForm=async function(){
      const form=document.querySelector("#adminProductForm");
      if(!form)return;

      const id=Number(new URLSearchParams(location.search).get("id")||0);

      if(configured()&&ProductAPI){
        try{PRODUCTS=await ProductAPI.list({admin:true})}
        catch(err){toast(`Produits Supabase : ${err.message}`)}
      }

      const existing=id?getProduct(id):null;
      const existingGallery=(existing?.imageGallery?.length
        ?existing.imageGallery
        :(existing?.images||[]).map((url,i)=>({
            public_url:url,storage_path:"",position:i+1,is_primary:i===0
          }))
      ).slice(0,2);

      if(existing){
        document.querySelector("#productFormTitle").textContent=`Modifier ${existing.name}`;
        document.querySelector("#productSubmitLabel").textContent="Enregistrer les modifications";

        ["name","category","subcategory","brand","sku","origin","volume","abv","badge","tone","description"]
          .forEach(key=>{if(form.elements[key])form.elements[key].value=existing[key]??""});

        form.elements.price.value=existing.price??"";
        form.elements.promoPrice.value=existing.promoPrice??"";
        form.elements.stock.value=existing.stock??0;
        form.elements.active.checked=existing.active!==false;
        form.elements.featured.checked=!!existing.featured;
      }

      const selected=[null,null];
      const removed=[false,false];

      function status(slot,msg,state=""){
        const el=document.querySelector(`#productImageUploadStatus${slot+1}`);
        if(!el)return;
        el.textContent=msg||"";
        el.className=`small image-upload-status ${state}`.trim();
      }

      function preview(slot,src){
        const el=document.querySelector(`#productImagePreview${slot+1}`);
        if(!el)return;
        el.innerHTML=src
          ?`<img src="${src}" alt="Aperçu ${slot+1}" onerror="this.style.display='none'">`
          :`<span>Aucune image</span>`;
      }

      for(let slot=0;slot<2;slot++){
        const current=existingGallery[slot]?.public_url||"";
        const hidden=form.elements[`imageData${slot+1}`];
        const urlInput=form.elements[`imageUrl${slot+1}`];
        const fileInput=form.elements[`imageFile${slot+1}`];

        if(hidden)hidden.value=current;
        if(urlInput)urlInput.value=current;
        preview(slot,current);

        urlInput?.addEventListener("input",e=>{
          selected[slot]=null;
          removed[slot]=false;
          fileInput.value="";
          hidden.value=e.target.value.trim();
          preview(slot,hidden.value);
          status(slot,hidden.value?"URL sélectionnée.":"");
        });

        fileInput?.addEventListener("change",e=>{
          const file=e.target.files?.[0];
          selected[slot]=null;
          if(!file)return;

          if(!ALLOWED.has(file.type)&&!/\.(jpe?g|png|webp)$/i.test(file.name||"")){
            toast("Utilisez JPG, PNG ou WebP.");
            e.target.value="";
            return;
          }
          if(file.size>MAX_FILE){
            toast("Image trop lourde : maximum 5 Mo.");
            e.target.value="";
            return;
          }

          selected[slot]=file;
          removed[slot]=false;
          urlInput.value="";
          preview(slot,URL.createObjectURL(file));
          status(slot,`${file.name} sera envoyé vers Supabase.`,"ready");

          if(!configured()){
            const reader=new FileReader();
            reader.onload=()=>hidden.value=reader.result;
            reader.readAsDataURL(file);
          }
        });

        document.querySelector(`#removeProductImage${slot+1}`)?.addEventListener("click",()=>{
          selected[slot]=null;
          removed[slot]=true;
          hidden.value="";
          urlInput.value="";
          fileInput.value="";
          preview(slot,"");
          status(slot,`Image ${slot+1} retirée.`,"warn");
        });
      }

      form.onsubmit=async e=>{
        e.preventDefault();
        const data=Object.fromEntries(new FormData(form).entries());

        const item={
          ...(existing||{}),
          name:data.name.trim(),
          category:data.category,
          subcategory:data.subcategory.trim(),
          brand:data.brand.trim(),
          sku:data.sku.trim(),
          origin:data.origin.trim(),
          volume:data.volume.trim(),
          abv:data.abv.trim(),
          badge:data.badge.trim()||"Nouveau",
          tone:data.tone||"#5c1e26",
          price:Number(data.price),
          promoPrice:Number(data.promoPrice||0),
          stock:Number(data.stock||0),
          description:data.description.trim(),
          active:form.elements.active.checked,
          featured:form.elements.featured.checked
        };

        const submit=form.querySelector('button[type="submit"]');
        submit.disabled=true;
        const oldText=submit.textContent;
        submit.textContent="Enregistrement…";

        try{
          if(configured()&&ProductAPI){
            const primaryBefore=removed[0]?"":(
              form.elements.imageData1.value||
              existingGallery[0]?.public_url||
              existing?.image||
              ""
            );

            item.image=primaryBefore;

            let saved=existing
              ?await ProductAPI.update(existing.id,item)
              :await ProductAPI.create(item);

            const gallery=[];

            for(let slot=0;slot<2;slot++){
              if(removed[slot])continue;

              if(selected[slot]){
                status(slot,"Upload en cours…","loading");
                const up=await uploadFile(selected[slot],saved,slot+1);
                gallery.push(up);
                status(slot,"Image envoyée.","ok");
              }else{
                const url=(form.elements[`imageData${slot+1}`].value||
                  existingGallery[slot]?.public_url||"").trim();
                if(url){
                  gallery.push({
                    url,
                    path:existingGallery[slot]?.storage_path||""
                  });
                }
              }
            }

            await saveGallery(saved.id,gallery,saved.name);
            saved=await ProductAPI.get(saved.id,{admin:true})||saved;

            if(existing)PRODUCTS=PRODUCTS.map(p=>p.id===existing.id?saved:p);
            else PRODUCTS.unshift(saved);
          }else{
            const images=[];
            for(let slot=0;slot<2;slot++){
              if(removed[slot])continue;
              const url=form.elements[`imageData${slot+1}`].value;
              if(url)images.push(url);
            }

            const localItem={
              ...item,
              id:existing?.id||Math.max(0,...PRODUCTS.map(p=>Number(p.id)||0))+1,
              image:images[0]||"",
              images:images.slice(0,2)
            };

            if(existing)PRODUCTS=PRODUCTS.map(p=>p.id===existing.id?localItem:p);
            else PRODUCTS.push(localItem);
            saveProducts();
          }

          toast(existing?"Produit modifié":"Produit ajouté");
          setTimeout(()=>location.href="admin-products.html",650);
        }catch(err){
          toast(`Enregistrement impossible : ${err.message}`);
          submit.disabled=false;
          submit.textContent=oldText;
        }
      };
    };
  }

  // Make sure sliders are initialized if page was already rendered.
  document.addEventListener("DOMContentLoaded",()=>setTimeout(bindSliders,0));
})();