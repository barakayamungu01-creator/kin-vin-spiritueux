(() => {
  "use strict";

  const cfg=window.KINVINS_SUPABASE_CONFIG||{};

  const configured=()=>Boolean(
    cfg.url&&cfg.publishableKey&&
    !String(cfg.url).includes("VOTRE-PROJET")&&
    !String(cfg.publishableKey).includes("VOTRE_CLE")
  );

  async function fetchPublicCategories(){
    if(!configured())return[];
    const fields="id,category_key,number_label,title,subtitle,link_url,image_url,alt_text,sort_order,active";
    const r=await fetch(
      `${cfg.url}/rest/v1/site_categories?select=${encodeURIComponent(fields)}&active=eq.true&order=sort_order.asc,id.asc`,
      {headers:{apikey:cfg.publishableKey}}
    );
    if(!r.ok)throw new Error(`${r.status} ${r.statusText}`);
    return r.json();
  }

  function applyCategoryData(rows){
    const grid=document.querySelector("#homeCategoryGrid");
    if(!grid||!Array.isArray(rows)||!rows.length)return;

    const elements=new Map(
      [...grid.querySelectorAll("[data-category-key]")]
        .map(el=>[el.dataset.categoryKey,el])
    );

    rows.forEach(row=>{
      const el=elements.get(row.category_key);
      if(!el)return;

      el.hidden=row.active===false;
      el.href=row.link_url||"catalogue.html";

      const number=el.querySelector("span");
      const title=el.querySelector("h3");
      const subtitle=el.querySelector("p");

      if(number)number.textContent=row.number_label||"";
      if(title)title.textContent=row.title||"";
      if(subtitle)subtitle.textContent=row.subtitle||"";

      if(row.image_url){
        el.style.backgroundImage=`url("${row.image_url}")`;
      }

      if(row.alt_text){
        el.setAttribute("aria-label",row.alt_text);
        el.title=row.alt_text;
      }

      el.dataset.sortOrder=String(row.sort_order||0);
    });

    [...grid.children]
      .sort((a,b)=>(Number(a.dataset.sortOrder)||0)-(Number(b.dataset.sortOrder)||0))
      .forEach(el=>grid.appendChild(el));
  }

  document.addEventListener("DOMContentLoaded",async()=>{
    try{
      const rows=await fetchPublicCategories();
      applyCategoryData(rows);
    }catch(err){
      console.warn("Catégories Supabase indisponibles, fallback local utilisé :",err);
    }
  });
})();