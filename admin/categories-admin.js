(() => {
  "use strict";

  const cfg=window.KINVINS_SUPABASE_CONFIG||{};
  const BUCKET="category-images";
  const MAX=700000;

  const configured=()=>Boolean(
    cfg.url&&cfg.publishableKey&&
    !String(cfg.url).includes("VOTRE-PROJET")&&
    !String(cfg.publishableKey).includes("VOTRE_CLE")
  );

  const token=()=>{
    try{return JSON.parse(sessionStorage.getItem("kinvins_admin_session")||"null")?.accessToken||""}
    catch{return""}
  };

  async function api(resource,{method="GET",body,prefer=""}={}){
    if(!configured())throw new Error("Supabase n'est pas configuré.");
    const t=token();
    if(!t)throw new Error("Session administrateur expirée.");
    const headers={
      apikey:cfg.publishableKey,
      Authorization:`Bearer ${t}`,
      "Content-Type":"application/json"
    };
    if(prefer)headers.Prefer=prefer;

    const r=await fetch(`${cfg.url}/rest/v1/${resource}`,{
      method,headers,
      body:body===undefined?undefined:JSON.stringify(body)
    });

    if(!r.ok){
      let msg=`${r.status} ${r.statusText}`;
      try{
        const j=await r.json();
        msg=j.message||j.details||j.hint||msg;
      }catch{}
      throw new Error(msg);
    }

    if(r.status===204)return null;
    const type=r.headers.get("content-type")||"";
    return type.includes("application/json")?r.json():null;
  }

  async function listCategories(){
    return api("site_categories?select=*&order=sort_order.asc,id.asc");
  }

  function encodePath(p){return p.split("/").map(encodeURIComponent).join("/")}

  async function upload(file,key){
    if(!file)return"";
    if(file.size>MAX)throw new Error("Image trop lourde : maximum 700 Ko.");
    if(!/^image\//.test(file.type||""))throw new Error("Fichier image invalide.");

    const ext=(file.name.split(".").pop()||"webp").toLowerCase().replace("jpeg","jpg");
    const path=`${key}/card-${Date.now()}.${ext}`;
    const t=token();

    const r=await fetch(`${cfg.url}/storage/v1/object/${BUCKET}/${encodePath(path)}`,{
      method:"POST",
      headers:{
        apikey:cfg.publishableKey,
        Authorization:`Bearer ${t}`,
        "Content-Type":file.type||"application/octet-stream",
        "cache-control":"3600"
      },
      body:file
    });

    if(!r.ok){
      let msg=`${r.status} ${r.statusText}`;
      try{const j=await r.json();msg=j.message||j.error||msg}catch{}
      throw new Error(msg);
    }

    return `${cfg.url}/storage/v1/object/public/${BUCKET}/${encodePath(path)}`;
  }

  // List page
  document.addEventListener("DOMContentLoaded",async()=>{
    const table=document.querySelector("#adminCategoriesTable");
    if(table){
      try{
        const rows=await listCategories();
        table.innerHTML=rows.map(r=>`<tr>
          <td><div style="display:flex;gap:12px;align-items:center">
            <div class="admin-category-thumb">${r.image_url?`<img src="${r.image_url}" alt="">`:"KIN"}</div>
            <strong>${r.number_label||""}</strong>
          </div></td>
          <td><strong>${r.title||""}</strong></td>
          <td>${r.subtitle||"—"}</td>
          <td>${r.sort_order||0}</td>
          <td><span class="status ${r.active?"ok":"bad"}">${r.active?"Active":"Masquée"}</span></td>
          <td><a class="btn btn-outline btn-small" href="admin-category.html?key=${encodeURIComponent(r.category_key)}">Modifier</a></td>
        </tr>`).join("");
      }catch(err){
        table.innerHTML=`<tr><td colspan="6">Erreur : ${err.message}</td></tr>`;
      }
    }

    const form=document.querySelector("#adminCategoryForm");
    if(!form)return;

    const key=new URLSearchParams(location.search).get("key")||"";
    if(!key){
      location.replace("admin-categories.html");
      return;
    }

    let current=null;
    let selectedFile=null;
    let imageRemoved=false;

    const preview=document.querySelector("#categoryPreview");
    const pNum=document.querySelector("#categoryPreviewNumber");
    const pTitle=document.querySelector("#categoryPreviewTitle");
    const pSub=document.querySelector("#categoryPreviewSubtitle");
    const submit=document.querySelector("#categorySubmit");

    function updatePreview(){
      pNum.textContent=form.elements.numberLabel.value||"";
      pTitle.textContent=form.elements.title.value||"";
      pSub.textContent=form.elements.subtitle.value||"";
      const url=form.elements.imageUrl.value.trim();
      if(selectedFile){
        preview.style.backgroundImage=`url("${URL.createObjectURL(selectedFile)}")`;
      }else if(imageRemoved){
        preview.style.backgroundImage="none";
      }else if(url){
        preview.style.backgroundImage=`url("${url}")`;
      }else if(current?.image_url){
        preview.style.backgroundImage=`url("${current.image_url}")`;
      }else{
        preview.style.backgroundImage="none";
      }
    }

    try{
      const rows=await api(`site_categories?category_key=eq.${encodeURIComponent(key)}&select=*&limit=1`);
      current=rows?.[0];
      if(!current)throw new Error("Catégorie introuvable.");

      document.querySelector("#categoryFormHeading").textContent=`Modifier ${current.title}`;
      form.elements.numberLabel.value=current.number_label||"";
      form.elements.sortOrder.value=current.sort_order||1;
      form.elements.title.value=current.title||"";
      form.elements.subtitle.value=current.subtitle||"";
      form.elements.linkUrl.value=current.link_url||"catalogue.html";
      form.elements.altText.value=current.alt_text||"";
      form.elements.imageUrl.value=current.image_url||"";
      form.elements.active.checked=current.active!==false;
      updatePreview();
    }catch(err){
      alert(err.message);
      return;
    }

    form.addEventListener("input",updatePreview);

    form.elements.imageFile.addEventListener("change",e=>{
      const f=e.target.files?.[0];
      selectedFile=null;
      if(!f)return;
      if(f.size>MAX){
        toast("Image trop lourde : maximum 700 Ko.");
        e.target.value="";
        return;
      }
      selectedFile=f;
      imageRemoved=false;
      form.elements.imageUrl.value="";
      updatePreview();
    });

    form.elements.imageUrl.addEventListener("input",()=>{
      selectedFile=null;
      imageRemoved=false;
      form.elements.imageFile.value="";
      updatePreview();
    });

    document.querySelector("#removeCategoryImage").addEventListener("click",()=>{
      selectedFile=null;
      imageRemoved=true;
      form.elements.imageUrl.value="";
      form.elements.imageFile.value="";
      updatePreview();
    });

    form.addEventListener("submit",async e=>{
      e.preventDefault();
      submit.disabled=true;
      const old=submit.textContent;
      submit.textContent="Enregistrement…";

      try{
        let image=current.image_url||"";
        if(imageRemoved)image="";
        if(form.elements.imageUrl.value.trim())image=form.elements.imageUrl.value.trim();
        if(selectedFile){
          submit.textContent="Envoi de l’image…";
          image=await upload(selectedFile,key);
        }

        const payload={
          number_label:form.elements.numberLabel.value.trim(),
          title:form.elements.title.value.trim(),
          subtitle:form.elements.subtitle.value.trim(),
          link_url:form.elements.linkUrl.value.trim(),
          image_url:image||null,
          alt_text:form.elements.altText.value.trim()||null,
          sort_order:Number(form.elements.sortOrder.value||0),
          active:form.elements.active.checked,
          updated_at:new Date().toISOString()
        };

        await api(`site_categories?category_key=eq.${encodeURIComponent(key)}`,{
          method:"PATCH",
          body:payload,
          prefer:"return=minimal"
        });

        toast("Catégorie mise à jour");
        setTimeout(()=>location.href="admin-categories.html",600);
      }catch(err){
        toast(`Enregistrement impossible : ${err.message}`);
        submit.disabled=false;
        submit.textContent=old;
      }
    });
  });
})();