(() => {
  "use strict";

  const cfg=window.KINVINS_SUPABASE_CONFIG||{};
  const BUCKET="site-banners";
  const MAX_IMAGE_BYTES=700000;

  const configured=()=>Boolean(
    cfg.url&&cfg.publishableKey&&
    !String(cfg.url).includes("VOTRE-PROJET")&&
    !String(cfg.publishableKey).includes("VOTRE_CLE")
  );

  const adminToken=()=>{
    try{
      return JSON.parse(sessionStorage.getItem("kinvins_admin_session")||"null")?.accessToken||"";
    }catch{return""}
  };

  async function api(resource,{method="GET",body,admin=false,prefer=""}={}){
    if(!configured())throw new Error("Supabase n'est pas configuré.");
    const headers={
      apikey:cfg.publishableKey,
      "Content-Type":"application/json"
    };
    if(admin){
      const token=adminToken();
      if(!token)throw new Error("Session administrateur expirée.");
      headers.Authorization=`Bearer ${token}`;
    }
    if(prefer)headers.Prefer=prefer;

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

  function normalize(row){
    return{
      id:Number(row.id),
      name:row.name||"",
      zone:row.zone||"",
      title:row.title||"",
      subtitle:row.subtitle||"",
      buttonLabel:row.button_label||"",
      buttonLink:row.button_link||"",
      image:row.image_url||"",
      mobileImage:row.mobile_image_url||"",
      fallbackTone:row.fallback_tone||"#5c1623",
      textAlign:row.text_align||"left",
      overlay:Number(row.overlay||0),
      order:Number(row.sort_order||0),
      active:row.active!==false,
      startDate:row.start_date||"",
      endDate:row.end_date||"",
      alt:row.alt_text||"",
      createdAt:row.created_at||"",
      updatedAt:row.updated_at||""
    };
  }

  function payload(b){
    return{
      name:b.name,
      zone:b.zone,
      title:b.title||null,
      subtitle:b.subtitle||null,
      button_label:b.buttonLabel||null,
      button_link:b.buttonLink||null,
      image_url:b.image||null,
      mobile_image_url:b.mobileImage||null,
      fallback_tone:b.fallbackTone||"#5c1623",
      text_align:b.textAlign||"left",
      overlay:Math.max(0,Math.min(80,Number(b.overlay)||0)),
      sort_order:Number(b.order||0),
      active:b.active!==false,
      start_date:b.startDate||null,
      end_date:b.endDate||null,
      alt_text:b.alt||null,
      updated_at:new Date().toISOString()
    };
  }

  async function loadBanners({admin=false}={}){
    const fields=[
      "id","name","zone","title","subtitle","button_label","button_link",
      "image_url","mobile_image_url","fallback_tone","text_align","overlay",
      "sort_order","active","start_date","end_date","alt_text","created_at","updated_at"
    ].join(",");
    const active=admin?"":"&active=eq.true";
    const rows=await api(
      `site_banners?select=${encodeURIComponent(fields)}${active}&order=zone.asc,sort_order.asc,id.asc`,
      {admin}
    );
    BANNERS=(rows||[]).map(normalize);
    return BANNERS;
  }

  function ext(file){
    const e=(file?.name?.split(".").pop()||"webp").toLowerCase();
    if(["jpg","jpeg","png","webp"].includes(e))return e==="jpeg"?"jpg":e;
    if(file?.type==="image/png")return"png";
    if(file?.type==="image/jpeg")return"jpg";
    return"webp";
  }

  function pathEncode(path){
    return path.split("/").map(encodeURIComponent).join("/");
  }

  async function uploadBanner(file,zone,variant){
    if(!file)return"";
    if(file.size>MAX_IMAGE_BYTES)throw new Error("Image trop lourde : maximum 700 Ko.");
    if(!/^image\//.test(file.type||"")&&!/\.(jpe?g|png|webp)$/i.test(file.name||"")){
      throw new Error("Format d'image invalide.");
    }

    const token=adminToken();
    if(!token)throw new Error("Session administrateur expirée.");

    const safe=String(zone||"banner").replace(/[^a-z0-9_-]+/gi,"-").toLowerCase();
    const path=`${safe}/${variant}-${Date.now()}.${ext(file)}`;
    const r=await fetch(`${cfg.url}/storage/v1/object/${BUCKET}/${pathEncode(path)}`,{
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
      let message=`${r.status} ${r.statusText}`;
      try{
        const j=await r.json();
        message=j.message||j.error||message;
      }catch{}
      throw new Error(message);
    }

    return `${cfg.url}/storage/v1/object/public/${BUCKET}/${pathEncode(path)}`;
  }

  if(!configured())return;

  const localSetupAdminBanners=window.setupAdminBanners;
  const localSetupAdminBannerForm=window.setupAdminBannerForm;

  window.setupAdminBanners=async function(){
    const table=document.querySelector("#adminBannersTable");
    if(!table)return;
    const search=document.querySelector("#adminBannerSearch");

    try{
      await loadBanners({admin:true});
    }catch(err){
      console.error(err);
      if(typeof localSetupAdminBanners==="function")return localSetupAdminBanners();
      return;
    }

    function render(){
      const q=(search?.value||"").toLowerCase().trim();
      const list=BANNERS
        .filter(b=>`${b.name} ${b.title} ${b.zone}`.toLowerCase().includes(q))
        .sort((a,b)=>a.zone.localeCompare(b.zone)||(Number(a.order)||0)-(Number(b.order)||0));

      table.innerHTML=list.map(b=>`<tr>
        <td><div style="display:flex;gap:10px;align-items:center">
          <div class="admin-banner-thumb">${b.image?`<img src="${b.image}" alt="">`:"KIN"}</div>
          <div><strong>${b.name}</strong><div class="small muted">${b.title||"Visuel sans texte"}</div></div>
        </div></td>
        <td>${bannerZoneLabel(b.zone)}</td>
        <td>${b.order||0}</td>
        <td><span class="status ${b.active===false?"bad":bannerIsScheduledNow(b)?"ok":"warn"}">${b.active===false?"Inactive":bannerIsScheduledNow(b)?"Visible":"Planifiée"}</span></td>
        <td>${b.startDate||"—"} → ${b.endDate||"—"}</td>
        <td class="admin-actions">
          <a class="btn btn-outline btn-small" href="admin-banner-new.html?id=${b.id}">Modifier</a>
          <button class="btn btn-danger btn-small" data-delete-banner="${b.id}">Supprimer</button>
        </td>
      </tr>`).join("");

      document.querySelectorAll("[data-delete-banner]").forEach(btn=>btn.onclick=async()=>{
        const id=Number(btn.dataset.deleteBanner);
        const b=BANNERS.find(x=>x.id===id);
        if(!confirm(`Supprimer la bannière « ${b?.name||""} » ?`))return;
        try{
          await api(`site_banners?id=eq.${id}`,{method:"DELETE",admin:true,prefer:"return=minimal"});
          BANNERS=BANNERS.filter(x=>x.id!==id);
          render();
          toast("Bannière supprimée");
        }catch(err){
          toast(`Suppression impossible : ${err.message}`);
        }
      });
    }

    if(search)search.oninput=render;

    const reset=document.querySelector("#resetBannersBtn");
    if(reset){
      reset.style.display="none";
      reset.title="La réinitialisation locale est désactivée avec Supabase";
    }
    render();
  };

  window.setupAdminBannerForm=async function(){
    const form=document.querySelector("#adminBannerForm");
    if(!form)return;

    try{
      await loadBanners({admin:true});
    }catch(err){
      console.error(err);
      if(typeof localSetupAdminBannerForm==="function")return localSetupAdminBannerForm();
      return;
    }

    const id=Number(new URLSearchParams(location.search).get("id")||0);
    const existing=id?BANNERS.find(b=>b.id===id):null;

    const desktopPreview=document.querySelector("#bannerImagePreview");
    const mobilePreview=document.querySelector("#bannerMobilePreview");
    const imageData=document.querySelector("#bannerImageData");
    const mobileData=document.querySelector("#bannerMobileData");

    let desktopFile=null;
    let mobileFile=null;

    const show=(host,src,label)=>{
      host.innerHTML=src?`<img src="${src}" alt="Aperçu">`:`<span>${label}</span>`;
    };

    if(existing){
      document.querySelector("#bannerFormTitle").textContent="Modifier la bannière";
      document.querySelector("#bannerSubmitLabel").textContent="Enregistrer les modifications";
      ["name","zone","title","subtitle","buttonLabel","buttonLink","fallbackTone","textAlign","overlay","order","startDate","endDate","alt"]
        .forEach(k=>{if(form.elements[k])form.elements[k].value=existing[k]??""});
      form.elements.active.checked=existing.active!==false;
      imageData.value=existing.image||"";
      mobileData.value=existing.mobileImage||"";
      form.elements.imageUrl.value=existing.image||"";
      form.elements.mobileImageUrl.value=existing.mobileImage||"";
    }

    show(desktopPreview,existing?.image||"","Aucune image desktop");
    show(mobilePreview,existing?.mobileImage||"","Aucune image mobile");

    form.elements.imageUrl.oninput=e=>{
      desktopFile=null;
      imageData.value=e.target.value.trim();
      form.elements.imageFile.value="";
      show(desktopPreview,imageData.value,"Aucune image desktop");
    };

    form.elements.mobileImageUrl.oninput=e=>{
      mobileFile=null;
      mobileData.value=e.target.value.trim();
      form.elements.mobileImageFile.value="";
      show(mobilePreview,mobileData.value,"Aucune image mobile");
    };

    form.elements.imageFile.onchange=e=>{
      const file=e.target.files?.[0];
      if(!file)return;
      if(file.size>MAX_IMAGE_BYTES){
        toast("Image desktop trop lourde : maximum 700 Ko.");
        e.target.value="";
        return;
      }
      desktopFile=file;
      form.elements.imageUrl.value="";
      show(desktopPreview,URL.createObjectURL(file),"Aucune image desktop");
    };

    form.elements.mobileImageFile.onchange=e=>{
      const file=e.target.files?.[0];
      if(!file)return;
      if(file.size>MAX_IMAGE_BYTES){
        toast("Image mobile trop lourde : maximum 700 Ko.");
        e.target.value="";
        return;
      }
      mobileFile=file;
      form.elements.mobileImageUrl.value="";
      show(mobilePreview,URL.createObjectURL(file),"Aucune image mobile");
    };

    document.querySelector("#removeBannerImage").onclick=()=>{
      desktopFile=null;
      imageData.value="";
      form.elements.imageUrl.value="";
      form.elements.imageFile.value="";
      show(desktopPreview,"","Aucune image desktop");
    };

    document.querySelector("#removeBannerMobileImage").onclick=()=>{
      mobileFile=null;
      mobileData.value="";
      form.elements.mobileImageUrl.value="";
      form.elements.mobileImageFile.value="";
      show(mobilePreview,"","Aucune image mobile");
    };

    const live=document.querySelector("#bannerLivePreview");
    function livePreview(){
      const d=Object.fromEntries(new FormData(form).entries());
      const tmp={
        id:0,name:d.name,title:d.title,subtitle:d.subtitle,
        buttonLabel:d.buttonLabel,buttonLink:d.buttonLink,
        image:desktopFile?URL.createObjectURL(desktopFile):imageData.value,
        mobileImage:mobileFile?URL.createObjectURL(mobileFile):mobileData.value,
        fallbackTone:d.fallbackTone,textAlign:d.textAlign,overlay:Number(d.overlay||0)
      };
      live.innerHTML=bannerMarkup(tmp);
      live.querySelector(".managed-banner-slide")?.classList.add("active");
    }
    form.addEventListener("input",livePreview);
    form.addEventListener("change",livePreview);
    livePreview();

    form.onsubmit=async e=>{
      e.preventDefault();
      const d=Object.fromEntries(new FormData(form).entries());
      const submit=document.querySelector("#bannerSubmitLabel");
      const oldText=submit.textContent;
      submit.disabled=true;
      submit.textContent="Enregistrement…";

      try{
        let desktop=imageData.value||existing?.image||"";
        let mobile=mobileData.value||existing?.mobileImage||"";

        if(desktopFile){
          submit.textContent="Envoi image desktop…";
          desktop=await uploadBanner(desktopFile,d.zone,"desktop");
        }
        if(mobileFile){
          submit.textContent="Envoi image mobile…";
          mobile=await uploadBanner(mobileFile,d.zone,"mobile");
        }

        const item={
          ...(existing||{}),
          name:d.name.trim(),
          zone:d.zone,
          title:d.title.trim(),
          subtitle:d.subtitle.trim(),
          buttonLabel:d.buttonLabel.trim(),
          buttonLink:d.buttonLink.trim(),
          image:desktop,
          mobileImage:mobile,
          fallbackTone:d.fallbackTone||"#5c1623",
          textAlign:d.textAlign||"left",
          overlay:Number(d.overlay||0),
          order:Number(d.order||0),
          active:form.elements.active.checked,
          startDate:d.startDate||"",
          endDate:d.endDate||"",
          alt:d.alt.trim()
        };

        if(existing){
          const rows=await api(`site_banners?id=eq.${existing.id}`,{
            method:"PATCH",admin:true,prefer:"return=representation",body:payload(item)
          });
          if(rows?.[0])item.id=Number(rows[0].id);
        }else{
          const rows=await api("site_banners",{
            method:"POST",admin:true,prefer:"return=representation",body:payload(item)
          });
          if(rows?.[0])item.id=Number(rows[0].id);
        }

        toast(existing?"Bannière modifiée":"Bannière créée");
        setTimeout(()=>location.href="admin-banners.html",600);
      }catch(err){
        toast(`Enregistrement impossible : ${err.message}`);
        submit.disabled=false;
        submit.textContent=oldText;
      }
    };
  };

  // Refresh public banners from central Supabase data.
  document.addEventListener("DOMContentLoaded",async()=>{
    try{
      await loadBanners({admin:false});
      if(typeof setupHomeHeroVisual==="function")setupHomeHeroVisual();
      if(typeof setupManagedBanners==="function")setupManagedBanners();
    }catch(err){
      console.warn("Bannières Supabase indisponibles, fallback local utilisé :",err);
    }
  });
})();