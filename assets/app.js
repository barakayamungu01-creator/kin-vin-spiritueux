
const DEFAULT_PRODUCTS = [{"id": 1, "name": "Château Les Terrasses", "category": "Vins", "subcategory": "Rouge", "origin": "France", "volume": "75 cl", "price": 29, "badge": "Sélection", "tone": "#5c1e26", "stock": 34, "description": "Vin rouge élégant aux notes de fruits noirs, épices douces et finale soyeuse.", "abv": "13.5%"}, {"id": 2, "name": "Champagne Brut Impérial", "category": "Champagnes", "subcategory": "Brut", "origin": "France", "volume": "75 cl", "price": 68, "badge": "Best seller", "tone": "#6f602e", "stock": 18, "description": "Champagne brut équilibré, bulles fines, agrumes et brioche.", "abv": "12%"}, {"id": 3, "name": "Single Malt 12 Years", "category": "Whiskies", "subcategory": "Single Malt", "origin": "Écosse", "volume": "70 cl", "price": 56, "badge": "12 ans", "tone": "#855721", "stock": 12, "description": "Single malt rond et boisé, notes de miel, vanille et fruits secs.", "abv": "40%"}, {"id": 4, "name": "Cognac VSOP Réserve", "category": "Cognacs", "subcategory": "VSOP", "origin": "France", "volume": "70 cl", "price": 64, "badge": "VSOP", "tone": "#6d2b18", "stock": 9, "description": "Cognac souple et complexe, fruits confits, chêne et épices.", "abv": "40%"}, {"id": 5, "name": "Rosé Méditerranée", "category": "Vins", "subcategory": "Rosé", "origin": "France", "volume": "75 cl", "price": 26, "badge": "Nouveau", "tone": "#a35862", "stock": 28, "description": "Rosé frais et fruité, idéal à l'apéritif et avec des plats légers.", "abv": "12.5%"}, {"id": 6, "name": "Blanc Réserve", "category": "Vins", "subcategory": "Blanc", "origin": "Afrique du Sud", "volume": "75 cl", "price": 24, "badge": "Frais", "tone": "#81703a", "stock": 22, "description": "Blanc vif aux notes d'agrumes et de fruits tropicaux.", "abv": "13%"}, {"id": 7, "name": "Brut Rosé", "category": "Champagnes", "subcategory": "Rosé", "origin": "France", "volume": "75 cl", "price": 72, "badge": "Premium", "tone": "#805157", "stock": 14, "description": "Champagne rosé délicat, petits fruits rouges et finale fraîche.", "abv": "12%"}, {"id": 8, "name": "Highland Reserve", "category": "Whiskies", "subcategory": "Blend", "origin": "Écosse", "volume": "70 cl", "price": 61, "badge": "Réserve", "tone": "#6a451d", "stock": 16, "description": "Whisky équilibré, céréales toastées, caramel et bois doux.", "abv": "40%"}, {"id": 9, "name": "Dark Rum Heritage", "category": "Rhums", "subcategory": "Ambré", "origin": "Caraïbes", "volume": "70 cl", "price": 39, "badge": "Premium", "tone": "#4b2c19", "stock": 21, "description": "Rhum ambré chaleureux, vanille, caramel et épices.", "abv": "40%"}, {"id": 10, "name": "London Dry Gin", "category": "Gins", "subcategory": "Dry", "origin": "Royaume-Uni", "volume": "70 cl", "price": 34, "badge": "Dry", "tone": "#27483f", "stock": 27, "description": "Gin sec classique, genièvre, agrumes et plantes aromatiques.", "abv": "43%"}, {"id": 11, "name": "Vodka Platinum", "category": "Vodkas", "subcategory": "Premium", "origin": "Europe", "volume": "70 cl", "price": 31, "badge": "Pure", "tone": "#5d6670", "stock": 30, "description": "Vodka nette et douce, distillation multiple et texture soyeuse.", "abv": "40%"}, {"id": 12, "name": "Coffret Prestige", "category": "Coffrets", "subcategory": "Cadeau", "origin": "Sélection KIN", "volume": "3 bouteilles", "price": 145, "badge": "Cadeau", "tone": "#3c2221", "stock": 8, "description": "Coffret premium de trois bouteilles sélectionnées pour offrir.", "abv": "—"}];
let PRODUCTS = (() => {
  try {
    const saved = JSON.parse(localStorage.getItem("kin-products") || "null");
    return Array.isArray(saved) && saved.length ? saved : DEFAULT_PRODUCTS.map(p => ({...p}));
  } catch {
    return DEFAULT_PRODUCTS.map(p => ({...p}));
  }
})();
function saveProducts(){
  localStorage.setItem("kin-products", JSON.stringify(PRODUCTS));
}
function resetProducts(){
  PRODUCTS = DEFAULT_PRODUCTS.map(p => ({...p}));
  localStorage.setItem("kin-products", JSON.stringify(PRODUCTS));
}
const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s), money=v=>`$${Number(v).toFixed(2)}`;

const state={
  cart:JSON.parse(localStorage.getItem("kin-cart")||"{}"),
  currentProduct:null
};

function getProduct(id){return PRODUCTS.find(p=>p.id===Number(id))}
function productPrice(p){const promo=Number(p?.promoPrice||0),base=Number(p?.price||0);return promo>0&&promo<base?promo:base}
function saveCart(){localStorage.setItem("kin-cart",JSON.stringify(state.cart));updateCartBadge();renderDrawer()}
function cartRows(){return Object.entries(state.cart).map(([id,qty])=>({product:getProduct(id),qty})).filter(r=>r.product)}
function cartCount(){return cartRows().reduce((s,r)=>s+r.qty,0)}
function cartSubtotal(){return cartRows().reduce((s,r)=>s+r.product.price*r.qty,0)}
function addToCart(id,qty=1){state.cart[id]=(state.cart[id]||0)+qty;saveCart();toast("Produit ajouté au panier")}
function setQty(id,qty){if(qty<=0)delete state.cart[id];else state.cart[id]=qty;saveCart()}
function updateCartBadge(){$$(".cart-count").forEach(el=>el.textContent=cartCount())}
function bottleHTML(p, cls="mini-bottle"){
 if(p.image){
   return `<div class="${cls} product-image-wrap"><img class="product-photo" src="${p.image}" alt="${p.name}"></div>`;
 }
 return `<div class="${cls}" style="background:linear-gradient(90deg,#17110f,${p.tone||"#5c1e26"},#15100e)"><span>${p.name.split(" ").slice(0,2).join("<br>")}</span></div>`;
}
function productCard(p){
 if(p.active===false) return "";
 const sellPrice=(Number(p.promoPrice)>0 && Number(p.promoPrice)<Number(p.price))?Number(p.promoPrice):Number(p.price);
 const oldPrice=sellPrice<Number(p.price)?`<del class="old-price">${money(productPrice(p))}</del>`:"";
 return `<article class="product-card">
  <a class="product-visual" href="product.html?id=${p.id}"><span class="badge">${p.badge||"KIN"}</span>${bottleHTML(p)}</a>
  <div class="product-body"><div class="product-meta"><span>${p.category}</span><span>${p.volume}</span></div>
  <h3><a href="product.html?id=${p.id}">${p.name}</a></h3><div class="origin">${p.origin}${p.brand?` • ${p.brand}`:""}</div>
  <div class="product-bottom"><span class="price">${oldPrice}${money(sellPrice)}</span><button class="add-btn" data-add="${p.id}">+</button></div></div>
 </article>`;
}
function bindAddButtons(){$$("[data-add]").forEach(b=>b.onclick=()=>addToCart(+b.dataset.add))}
function toast(msg){const t=$("#toast");if(!t)return;t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),1800)}

function renderDrawer(){
 const box=$("#drawerItems"); if(!box)return;
 const rows=cartRows();
 box.innerHTML=rows.length?rows.map(({product:p,qty})=>`<div class="cart-line" style="grid-template-columns:54px 1fr auto">
 <div class="cart-thumb">KIN</div><div><strong>${p.name}</strong><div class="small muted">${money(productPrice(p))}</div>
 <div class="qty-control" style="margin-top:6px"><button data-ddec="${p.id}">−</button><span>${qty}</span><button data-dinc="${p.id}">+</button></div></div><strong>${money(productPrice(p)*qty)}</strong></div>`).join(""):`<p class="muted">Votre panier est vide.</p>`;
 const total=$("#drawerTotal"); if(total) total.textContent=money(cartSubtotal());
 $$("[data-ddec]").forEach(b=>b.onclick=()=>setQty(+b.dataset.ddec,(state.cart[b.dataset.ddec]||0)-1));
 $$("[data-dinc]").forEach(b=>b.onclick=()=>setQty(+b.dataset.dinc,(state.cart[b.dataset.dinc]||0)+1));
}
function setupGlobalUI(){
 updateCartBadge();renderDrawer();
 const m=$("#menuBtn"),nav=$("#navLinks"); if(m&&nav)m.onclick=()=>nav.classList.toggle("open");
 const cb=$("#cartBtn"),drawer=$("#cartDrawer"),ov=$("#overlay"),cc=$("#closeCart");
 const open=()=>{drawer?.classList.add("open");ov?.classList.add("show");document.body.classList.add("locked")};
 const close=()=>{drawer?.classList.remove("open");ov?.classList.remove("show");document.body.classList.remove("locked")};
 if(cb)cb.onclick=open;if(cc)cc.onclick=close;if(ov)ov.onclick=close;
 $$("[data-close]").forEach(b=>b.onclick=()=>{b.closest(".modal")?.classList.remove("open");document.body.classList.remove("locked")});
 $$(".modal").forEach(m=>m.onclick=e=>{if(e.target===m){m.classList.remove("open");document.body.classList.remove("locked")}});
 const age=$("#ageGate"); if(age){
   if(localStorage.getItem("kin-age-ok")==="1")age.classList.add("hidden");
   $("#ageYes").onclick=()=>{localStorage.setItem("kin-age-ok","1");age.classList.add("hidden")};
   $("#ageNo").onclick=()=>alert("L’accès est réservé aux personnes ayant l’âge légal requis.");
 }
 document.addEventListener("keydown",e=>{if(e.key==="Escape"){close();$$(".modal").forEach(x=>x.classList.remove("open"))}});
}
function setupHome(){
 const grid=$("#homeProducts"); if(grid){grid.innerHTML=PRODUCTS.slice(0,8).map(productCard).join("");bindAddButtons()}
 const filters=$$(".filter"); filters.forEach(b=>b.onclick=()=>{filters.forEach(x=>x.classList.remove("active"));b.classList.add("active");const f=b.dataset.filter;grid.innerHTML=(f==="Tous"?PRODUCTS:PRODUCTS.filter(p=>p.category===f)).slice(0,8).map(productCard).join("");bindAddButtons()});
 const dform=$("#deliveryForm"); if(dform)dform.onsubmit=e=>{e.preventDefault();const fee=+$("#deliveryZone").value;$("#deliveryResult").textContent=fee?`Frais estimés : ${money(fee)}`:"Choisissez une commune."};
}
function setupCatalogue(){
 const grid=$("#catalogGrid"),search=$("#catalogSearch"),sort=$("#catalogSort"),chips=$$(".filter");
 if(!grid)return;
 let filter="Tous";
 function render(){
  let q=(search?.value||"").toLowerCase().trim();
  let list=PRODUCTS.filter(p=>(filter==="Tous"||p.category===filter)&&`${p.name} ${p.category} ${p.origin} ${p.subcategory}`.toLowerCase().includes(q));
  if(sort?.value==="price-asc")list.sort((a,b)=>a.price-b.price);
  if(sort?.value==="price-desc")list.sort((a,b)=>b.price-a.price);
  if(sort?.value==="name")list.sort((a,b)=>a.name.localeCompare(b.name));
  grid.innerHTML=list.map(productCard).join("");bindAddButtons();
 }
 chips.forEach(b=>b.onclick=()=>{chips.forEach(x=>x.classList.remove("active"));b.classList.add("active");filter=b.dataset.filter;render()});
 if(search)search.oninput=render;if(sort)sort.onchange=render;render();
}
function setupProduct(){
 const wrap=$("#productDetail"); if(!wrap)return;
 const id=new URLSearchParams(location.search).get("id")||1,p=getProduct(id)||PRODUCTS[0];state.currentProduct=p;
 wrap.innerHTML=`<div class="detail-visual">${bottleHTML(p,"detail-bottle")}</div><div class="detail-info"><p class="eyebrow">${p.category.toUpperCase()}</p><h1 style="font-size:4rem">${p.name}</h1><p class="price">${Number(p.promoPrice)>0&&Number(p.promoPrice)<Number(p.price)?`<del class="old-price">${money(productPrice(p))}</del>${money(p.promoPrice)}`:money(productPrice(p))}</p><p class="muted">${p.description}</p>
 <div class="detail-list"><div><span class="small muted">Origine</span><br><strong>${p.origin}</strong></div><div><span class="small muted">Contenance</span><br><strong>${p.volume}</strong></div><div><span class="small muted">Type</span><br><strong>${p.subcategory}</strong></div><div><span class="small muted">Alcool</span><br><strong>${p.abv}</strong></div></div>
 <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><div class="qty-control"><button id="qtyMinus">−</button><span id="qtyValue">1</span><button id="qtyPlus">+</button></div><button class="btn btn-gold" id="detailAdd">Ajouter au panier</button></div><p class="small muted" style="margin-top:12px">Stock disponible : ${p.stock} unités</p></div>`;
 let q=1;$("#qtyMinus").onclick=()=>{$("#qtyValue").textContent=q=Math.max(1,q-1)};$("#qtyPlus").onclick=()=>{$("#qtyValue").textContent=q=q+1};$("#detailAdd").onclick=()=>addToCart(p.id,q);
 const rel=$("#relatedProducts");if(rel){rel.innerHTML=PRODUCTS.filter(x=>x.category===p.category&&x.id!==p.id).slice(0,4).map(productCard).join("");bindAddButtons()}
}
function setupCartPage(){
 const box=$("#cartPageItems"),summary=$("#cartPageSummary");if(!box)return;
 function render(){
  const rows=cartRows();
  box.innerHTML=rows.length?rows.map(({product:p,qty})=>`<div class="cart-line"><div class="cart-thumb">KIN</div><div><strong>${p.name}</strong><div class="small muted">${p.category} • ${p.volume}</div><button class="btn btn-outline" style="min-height:32px;padding:0 12px;margin-top:7px" data-remove="${p.id}">Supprimer</button></div><div class="qty-control"><button data-cdec="${p.id}">−</button><span>${qty}</span><button data-cinc="${p.id}">+</button></div><div><strong>${money(productPrice(p)*qty)}</strong></div></div>`).join(""):`<div style="padding:28px"><p>Votre panier est vide.</p><a class="btn btn-gold" href="catalogue.html">Voir le catalogue</a></div>`;
  const sub=cartSubtotal();summary.innerHTML=`<div class="summary-row"><span>Sous-total</span><strong>${money(sub)}</strong></div><div class="summary-row"><span>Livraison</span><span>Calculée au checkout</span></div><div class="summary-row total"><span>Total produits</span><strong>${money(sub)}</strong></div><a class="btn btn-gold full" href="checkout.html" style="margin-top:16px">Passer au checkout</a>`;
  $$("[data-cdec]").forEach(b=>b.onclick=()=>{setQty(+b.dataset.cdec,(state.cart[b.dataset.cdec]||0)-1);render()});
  $$("[data-cinc]").forEach(b=>b.onclick=()=>{setQty(+b.dataset.cinc,(state.cart[b.dataset.cinc]||0)+1);render()});
  $$("[data-remove]").forEach(b=>b.onclick=()=>{setQty(+b.dataset.remove,0);render()});
 }
 render();
}
function setupCheckout(){
 const sum=$("#checkoutSummary"),form=$("#checkoutForm");if(!sum||!form)return;
 function render(){
  const sub=cartSubtotal(), opt=$("#zone")?.selectedOptions?.[0], fee=opt?+(opt.dataset.fee||0):0;
  sum.innerHTML=`${cartRows().map(({product:p,qty})=>`<div class="summary-row"><span>${qty}× ${p.name}</span><strong>${money(productPrice(p)*qty)}</strong></div>`).join("")}<div class="summary-row"><span>Sous-total</span><strong>${money(sub)}</strong></div><div class="summary-row"><span>Livraison</span><strong>${money(fee)}</strong></div><div class="summary-row total"><span>Total</span><strong>${money(sub+fee)}</strong></div>`;
 }
 $("#zone").onchange=render;render();
 form.onsubmit=e=>{e.preventDefault();if(!cartRows().length){toast("Votre panier est vide");return}const order="KIN-"+Math.floor(100000+Math.random()*900000);sessionStorage.setItem("kin-last-order",order);sessionStorage.setItem("kin-last-total",sum.querySelector(".total strong").textContent);state.cart={};saveCart();location.href="confirmation.html"};
}
function setupConfirmation(){const o=$("#orderNumber"),t=$("#orderTotal");if(o)o.textContent=sessionStorage.getItem("kin-last-order")||"KIN-XXXXXX";if(t)t.textContent=sessionStorage.getItem("kin-last-total")||"$0.00"}
function setupAccount(){
 const login=$("#loginForm"),register=$("#registerForm");if(login)login.onsubmit=e=>{e.preventDefault();localStorage.setItem("kin-user","Client Démo");location.href="account.html"};
 if(register)register.onsubmit=e=>{e.preventDefault();localStorage.setItem("kin-user","Nouveau client");location.href="account.html"};
 const user=$("#accountName");if(user)user.textContent=localStorage.getItem("kin-user")||"Client Démo";
}
function setupB2B(){const f=$("#b2bForm");if(f)f.onsubmit=e=>{e.preventDefault();e.target.reset();toast("Demande B2B enregistrée")}}
function setupAdmin(){
 const inv=$("#inventoryTable");if(inv)inv.innerHTML=PRODUCTS.map(p=>`<tr><td>${p.name}</td><td>${p.category}</td><td>${money(productPrice(p))}</td><td>${p.stock}</td><td><span class="status ${p.stock<10?"bad":p.stock<15?"warn":"ok"}">${p.stock<10?"Faible":p.stock<15?"À surveiller":"OK"}</span></td></tr>`).join("");
}
document.addEventListener("DOMContentLoaded",()=>{setupGlobalUI();setupHome();setupCatalogue();setupProduct();setupCartPage();setupCheckout();setupConfirmation();setupAccount();setupB2B();setupAdmin()});



// --- Individual + Professional account system (prototype/localStorage) ---
const KIN_KEYS={session:"kin-session",individual:"kin-individual-profile",pro:"kin-pro-profile"};
function readJSON(key,fallback=null){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
function writeJSON(key,value){localStorage.setItem(key,JSON.stringify(value))}
function formObject(form){return Object.fromEntries(new FormData(form).entries())}
function session(){return readJSON(KIN_KEYS.session,{})||{}}
function setSession(type,name,email){writeJSON(KIN_KEYS.session,{type,name,email,loggedAt:new Date().toISOString()})}
function clearSession(){localStorage.removeItem(KIN_KEYS.session)}
function ensureOfferCopy(offer){
 const copy={Essentiel:"Catalogue professionnel, commandes par carton et support standard.",Business:"Tarification par volume, livraisons planifiées et services renforcés.",Premium:"Conditions personnalisées, accompagnement dédié et gestion grands comptes."};
 return copy[offer]||"Choisissez une offre professionnelle pour personnaliser votre espace.";
}
function setupMembership(){
 const individualLogin=$("#individualLoginForm");
 if(individualLogin) individualLogin.onsubmit=e=>{e.preventDefault();const d=formObject(e.target),profile=readJSON(KIN_KEYS.individual,{firstName:"Client",lastName:"KIN",email:d.email,phone:"—",commune:"—"});setSession("individual",`${profile.firstName||"Client"} ${profile.lastName||""}`.trim(),d.email);location.href="account.html"};
 const proLogin=$("#proLoginForm");
 if(proLogin) proLogin.onsubmit=e=>{e.preventDefault();const d=formObject(e.target),profile=readJSON(KIN_KEYS.pro,{company:"Entreprise KIN",firstName:"Responsable",lastName:"Pro",email:d.email});setSession("pro",profile.company||"Entreprise KIN",d.email);location.href="pro-account.html"};
 const reg=$("#individualRegisterForm");
 if(reg) reg.onsubmit=e=>{e.preventDefault();const d=formObject(e.target);if(d.password!==d.password2){toast("Les mots de passe ne correspondent pas");return}delete d.password2;writeJSON(KIN_KEYS.individual,d);setSession("individual",`${d.firstName} ${d.lastName}`,d.email);toast("Compte individuel créé");setTimeout(()=>location.href="account.html",500)};
 const preg=$("#proRegisterForm");
 if(preg) preg.onsubmit=e=>{e.preventDefault();const d=formObject(e.target);if(d.password!==d.password2){toast("Les mots de passe ne correspondent pas");return}delete d.password2;d.offer=null;d.createdAt=new Date().toISOString();writeJSON(KIN_KEYS.pro,d);setSession("pro",d.company,d.email);toast("Compte professionnel créé");setTimeout(()=>location.href="pro-offers.html",500)};
 const s=session(),ip=readJSON(KIN_KEYS.individual,{}),pp=readJSON(KIN_KEYS.pro,{});
 if($("#accountName")){const display=(ip.firstName||s.name||"Client")+(ip.lastName?` ${ip.lastName}`:"");$("#accountName").textContent=display.trim();$("#individualProfileName").textContent=display.trim();$("#individualProfileEmail").textContent=ip.email||s.email||"—";$("#individualProfilePhone").textContent=ip.phone||"—";$("#individualProfileCommune").textContent=ip.commune||"—"}
 if($("#individualLogout")) $("#individualLogout").onclick=()=>{clearSession();location.href="login.html"};
 $$(".select-offer").forEach(btn=>btn.onclick=()=>{const profile=readJSON(KIN_KEYS.pro,null);if(!profile){toast("Créez d’abord votre compte professionnel");setTimeout(()=>location.href="pro-register.html",700);return}profile.offer=btn.dataset.offer;profile.offerSelectedAt=new Date().toISOString();writeJSON(KIN_KEYS.pro,profile);setSession("pro",profile.company,profile.email);toast(`Offre ${profile.offer} sélectionnée`);setTimeout(()=>location.href="pro-account.html",500)});
 if($("#proCompanyName")){const p=readJSON(KIN_KEYS.pro,{company:"Votre entreprise"});$("#proCompanyName").textContent=p.company||"Votre entreprise";$("#proContactName").textContent=`${p.firstName||"—"} ${p.lastName||""}`.trim();$("#proContactEmail").textContent=p.email||"—";$("#proActivity").textContent=p.activity||"—";$("#proVolume").textContent=p.volume||"—";$("#proActiveOffer").textContent=p.offer||"Aucune offre sélectionnée";$("#proOfferDescription").textContent=ensureOfferCopy(p.offer);if(p.offer)$("#proOfferAction").textContent="Changer d’offre"}
 if($("#proLogout")) $("#proLogout").onclick=()=>{clearSession();location.href="login.html"};
 const pf=$("#proProfileForm");if(pf){const p=readJSON(KIN_KEYS.pro,{});const map={ppCompany:"company",ppTradeName:"tradeName",ppActivity:"activity",ppVolume:"volume",ppCommune:"commune",ppPhone:"phone",ppAddress:"address",ppContact:"contact",ppEmail:"email"};Object.entries(map).forEach(([id,key])=>{const el=$("#"+id);if(el)el.value=key==="contact"?`${p.firstName||""} ${p.lastName||""}`.trim():(p[key]||"")});pf.onsubmit=e=>{e.preventDefault();const current=readJSON(KIN_KEYS.pro,{});current.company=$("#ppCompany").value;current.tradeName=$("#ppTradeName").value;current.activity=$("#ppActivity").value;current.volume=$("#ppVolume").value;current.commune=$("#ppCommune").value;current.phone=$("#ppPhone").value;current.address=$("#ppAddress").value;current.email=$("#ppEmail").value;const parts=$("#ppContact").value.trim().split(/\s+/);current.firstName=parts.shift()||"";current.lastName=parts.join(" ");writeJSON(KIN_KEYS.pro,current);toast("Profil professionnel mis à jour")}}
}
document.addEventListener("DOMContentLoaded",setupMembership);



function setupAdminProducts(){
 const table=$("#adminProductsTable"); if(!table)return;
 const search=$("#adminProductSearch");
 function render(){
   const q=(search?.value||"").toLowerCase().trim();
   const list=PRODUCTS.filter(p=>`${p.name} ${p.category} ${p.brand||""} ${p.sku||""}`.toLowerCase().includes(q));
   table.innerHTML=list.map(p=>`<tr>
     <td><div style="display:flex;align-items:center;gap:10px"><div class="admin-product-thumb">${p.image?`<img src="${p.image}" alt="">`:"KIN"}</div><div><strong>${p.name}</strong><div class="small muted">${p.sku||"Sans SKU"}</div></div></div></td>
     <td>${p.category}</td><td>${p.brand||"—"}</td>
     <td>${Number(p.promoPrice)>0?`<del class="old-price">${money(p.price)}</del>${money(p.promoPrice)}`:money(p.price)}</td>
     <td>${p.stock}</td>
     <td><span class="status ${p.active===false?"bad":p.stock<10?"warn":"ok"}">${p.active===false?"Inactif":p.stock<10?"Stock faible":"Actif"}</span></td>
     <td class="admin-actions"><a class="btn btn-outline btn-small" href="admin-product-new.html?id=${p.id}">Modifier</a><button class="btn btn-danger btn-small" data-delete-product="${p.id}">Supprimer</button></td>
   </tr>`).join("");
   $$("[data-delete-product]").forEach(btn=>btn.onclick=()=>{
     const id=Number(btn.dataset.deleteProduct),p=getProduct(id);
     if(!confirm(`Supprimer ${p?.name||"ce produit"} ?`))return;
     PRODUCTS=PRODUCTS.filter(x=>x.id!==id);
     delete state.cart[id];
     saveProducts();saveCart();render();toast("Produit supprimé");
   });
 }
 if(search)search.oninput=render;
 const reset=$("#resetProductsBtn"); if(reset)reset.onclick=()=>{
   if(confirm("Réinitialiser le catalogue de démonstration ? Les produits ajoutés seront supprimés.")){
     resetProducts();render();toast("Catalogue réinitialisé");
   }
 };
 render();
}

function setupAdminProductForm(){
 const form=$("#adminProductForm");if(!form)return;
 const params=new URLSearchParams(location.search),id=Number(params.get("id")||0);
 const existing=id?getProduct(id):null;
 const title=$("#productFormTitle"),submit=$("#productSubmitLabel"),preview=$("#productImagePreview"),imageData=$("#productImageData");
 if(existing){
   if(title)title.textContent=`Modifier ${existing.name}`;
   if(submit)submit.textContent="Enregistrer les modifications";
   const fields=["name","category","subcategory","brand","sku","origin","volume","abv","badge","tone","description"];
   fields.forEach(key=>{const el=form.elements[key];if(el)el.value=existing[key]??""});
   form.elements.price.value=existing.price??"";
   form.elements.promoPrice.value=existing.promoPrice??"";
   form.elements.stock.value=existing.stock??0;
   form.elements.active.checked=existing.active!==false;
   form.elements.featured.checked=!!existing.featured;
   form.elements.imageUrl.value=existing.image&& !String(existing.image).startsWith("data:")?existing.image:"";
   if(imageData)imageData.value=existing.image||"";
 }
 function showPreview(src){
   if(!preview)return;
   preview.innerHTML=src?`<img src="${src}" alt="Aperçu produit">`:`<span>Aucune image</span>`;
 }
 showPreview(existing?.image||"");
 form.elements.imageUrl.oninput=e=>{if(e.target.value.trim()){imageData.value=e.target.value.trim();showPreview(imageData.value)}};
 form.elements.imageFile.onchange=e=>{
   const file=e.target.files?.[0];if(!file)return;
   if(file.size>450000){toast("Image trop lourde pour ce prototype (max ~450 Ko)");e.target.value="";return}
   const reader=new FileReader();
   reader.onload=()=>{imageData.value=reader.result;showPreview(reader.result)};
   reader.readAsDataURL(file);
 };
 const remove=$("#removeProductImage");if(remove)remove.onclick=()=>{imageData.value="";form.elements.imageUrl.value="";form.elements.imageFile.value="";showPreview("")};
 form.onsubmit=e=>{
   e.preventDefault();
   const data=Object.fromEntries(new FormData(form).entries());
   const item={
     ...(existing||{}),
     id:existing?.id || Math.max(0,...PRODUCTS.map(p=>Number(p.id)||0))+1,
     name:data.name.trim(),category:data.category,subcategory:data.subcategory.trim(),
     brand:data.brand.trim(),sku:data.sku.trim(),origin:data.origin.trim(),volume:data.volume.trim(),
     abv:data.abv.trim(),badge:data.badge.trim()||"Nouveau",tone:data.tone||"#5c1e26",
     price:Number(data.price),promoPrice:Number(data.promoPrice||0),stock:Number(data.stock||0),
     description:data.description.trim(),image:data.imageData||"",active:form.elements.active.checked,
     featured:form.elements.featured.checked,updatedAt:new Date().toISOString()
   };
   if(existing){PRODUCTS=PRODUCTS.map(p=>p.id===existing.id?item:p)}else{PRODUCTS.push(item)}
   try{saveProducts()}catch(err){toast("Stockage local plein : utilisez une image plus légère ou une URL");return}
   toast(existing?"Produit modifié":"Produit ajouté");
   setTimeout(()=>location.href="admin-products.html",500);
 };
}

document.addEventListener("DOMContentLoaded",()=>{setupAdminProducts();setupAdminProductForm()});


const DEFAULT_ARTICLES = [{"id": 1, "title": "Comment choisir un vin rouge pour un dîner à Kinshasa", "slug": "choisir-vin-rouge-diner-kinshasa", "excerpt": "Un guide simple pour choisir le style de vin rouge adapté à votre menu, à votre budget et au nombre d’invités.", "content": "Choisir un vin rouge ne consiste pas seulement à chercher une bouteille chère. Le meilleur choix dépend surtout du plat servi, du style de soirée et des préférences des invités.\n\nPour les viandes grillées et les plats riches, recherchez des rouges structurés avec suffisamment de matière. Pour une cuisine plus légère, un vin fruité et souple sera généralement plus facile à servir.\n\nÀ Kinshasa, pensez aussi à la température de service. Un vin rouge servi trop chaud peut paraître lourd. Une légère fraîcheur améliore souvent l’équilibre aromatique.\n\nEnfin, définissez votre budget par personne et prévoyez les quantités avant la commande. Notre catalogue permet de filtrer les vins par gamme de prix et style.", "category": "Conseils vins", "author": "Équipe KIN", "date": "2026-09-18", "status": "published", "featured": true, "image": "", "metaTitle": "Comment choisir un vin rouge à Kinshasa | kinvins.cd", "metaDescription": "Guide pratique pour choisir un vin rouge pour un dîner à Kinshasa : accords, température, budget et quantités.", "focusKeyword": "vin rouge Kinshasa"}, {"id": 2, "title": "Champagne ou vin mousseux : quelles différences ?", "slug": "champagne-ou-vin-mousseux-differences", "excerpt": "Origine, méthode de production, goût et budget : les principales différences à connaître avant d’acheter.", "content": "Le mot champagne désigne un vin effervescent produit dans la région de Champagne en France et selon des règles précises. Tous les champagnes sont des vins mousseux, mais tous les vins mousseux ne sont pas des champagnes.\n\nLa méthode de production, les cépages et l’origine influencent fortement le style final. Certains mousseux offrent un excellent rapport qualité-prix pour les grandes réceptions, alors qu’un champagne peut être privilégié pour une occasion prestigieuse.\n\nPour choisir, commencez par le nombre de personnes, le moment de service et le budget total. Un brut polyvalent fonctionne bien à l’apéritif, tandis qu’un rosé peut accompagner des plats plus gastronomiques.", "category": "Champagnes", "author": "Équipe KIN", "date": "2026-09-15", "status": "published", "featured": true, "image": "", "metaTitle": "Champagne ou vin mousseux : les différences | KIN", "metaDescription": "Découvrez les différences entre champagne et vin mousseux : origine, production, goût, prix et conseils de choix.", "focusKeyword": "champagne vin mousseux"}, {"id": 3, "title": "Whisky : comprendre Single Malt, Blend et âge", "slug": "whisky-single-malt-blend-age-guide", "excerpt": "Les termes essentiels à comprendre pour choisir un whisky selon vos goûts et votre budget.", "content": "Single Malt, Blend, âge, finition en fût : l’univers du whisky comporte de nombreux termes. Un Single Malt est élaboré à partir d’orge maltée dans une seule distillerie. Un Blend assemble généralement plusieurs whiskies afin de créer un profil régulier.\n\nL’âge indiqué correspond au whisky le plus jeune entrant dans l’assemblage. Un âge plus élevé ne signifie pas automatiquement qu’un whisky conviendra davantage à vos goûts.\n\nPour débuter, identifiez les profils que vous appréciez : fruité, boisé, fumé, tourbé, doux ou épicé. Vous pourrez ensuite comparer les bouteilles plus facilement.", "category": "Spiritueux", "author": "Équipe KIN", "date": "2026-09-10", "status": "published", "featured": false, "image": "", "metaTitle": "Guide whisky : Single Malt, Blend et âge | KIN", "metaDescription": "Comprendre les termes Single Malt, Blend et âge pour mieux choisir votre whisky selon vos goûts et votre budget.", "focusKeyword": "guide whisky"}, {"id": 4, "title": "Combien de bouteilles prévoir pour une réception ?", "slug": "combien-bouteilles-reception", "excerpt": "Une méthode simple pour estimer vins, champagne et autres boissons selon le nombre d’invités et la durée de l’événement.", "content": "La quantité de boissons nécessaire dépend de la durée de la réception, du type de repas, du nombre d’invités et des alternatives sans alcool disponibles.\n\nCommencez par séparer l’apéritif, le repas et le toast éventuel. Pour chaque étape, estimez le nombre de verres par personne, puis convertissez en bouteilles selon la contenance.\n\nPour les grands événements, prévoyez toujours une marge de sécurité raisonnable sans surdimensionner exagérément la commande. Une livraison planifiée permet aussi de mieux répartir les quantités.\n\nKIN PRO peut préparer une estimation adaptée aux hôtels, entreprises, mariages et organisateurs d’événements.", "category": "Événements", "author": "Équipe KIN", "date": "2026-09-06", "status": "published", "featured": false, "image": "", "metaTitle": "Combien de bouteilles pour une réception ? | KIN", "metaDescription": "Estimez les quantités de vins, champagne et boissons à prévoir pour une réception, un mariage ou un événement.", "focusKeyword": "bouteilles réception"}];
let ARTICLES = (() => {
  try{
    const saved=JSON.parse(localStorage.getItem("kin-blog-articles")||"null");
    return Array.isArray(saved)&&saved.length?saved:DEFAULT_ARTICLES.map(a=>({...a}));
  }catch{return DEFAULT_ARTICLES.map(a=>({...a}))}
})();
function saveArticles(){localStorage.setItem("kin-blog-articles",JSON.stringify(ARTICLES))}
function slugify(value){
 return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()
   .replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").replace(/-{2,}/g,"-");
}
function formatDate(v){
 if(!v)return "";
 const d=new Date(v+"T12:00:00");
 return new Intl.DateTimeFormat("fr-FR",{day:"2-digit",month:"long",year:"numeric"}).format(d);
}
function articleImage(a,cls="blog-card-image"){
 if(a.image)return `<div class="${cls}"><img src="${a.image}" alt="${a.title}"></div>`;
 return `<div class="${cls} blog-placeholder"><span>KIN JOURNAL</span><strong>${(a.category||"Journal").slice(0,18)}</strong></div>`;
}
function articleCard(a){
 return `<article class="blog-card">${articleImage(a)}
 <div class="blog-card-body"><div class="blog-meta"><span>${a.category||"Journal"}</span><time>${formatDate(a.date)}</time></div>
 <h3><a href="article.html?slug=${encodeURIComponent(a.slug)}">${a.title}</a></h3>
 <p>${a.excerpt||""}</p><a class="text-link" href="article.html?slug=${encodeURIComponent(a.slug)}">Lire l’article →</a></div></article>`;
}
function publishedArticles(){return ARTICLES.filter(a=>a.status==="published").sort((a,b)=>String(b.date).localeCompare(String(a.date)))}

function setupHomeBlog(){
 const box=$("#homeBlog");if(!box)return;
 const pub=publishedArticles();
 const list=[...pub.filter(a=>a.featured),...pub.filter(a=>!a.featured)].slice(0,3);
 box.innerHTML=list.map(articleCard).join("");
}
function setupBlog(){
 const grid=$("#blogGrid");if(!grid)return;
 const search=$("#blogSearch"),chips=$$(".blog-filter");let category="Tous";
 function render(){
  const q=(search?.value||"").toLowerCase().trim();
  const list=publishedArticles().filter(a=>(category==="Tous"||a.category===category)&&`${a.title} ${a.excerpt} ${a.category} ${a.focusKeyword||""}`.toLowerCase().includes(q));
  grid.innerHTML=list.length?list.map(articleCard).join(""):`<div class="panel" style="padding:28px"><p>Aucun article trouvé.</p></div>`;
 }
 chips.forEach(b=>b.onclick=()=>{chips.forEach(x=>x.classList.remove("active"));b.classList.add("active");category=b.dataset.blogFilter;render()});
 if(search)search.oninput=render;render();
}
function setupArticle(){
 const host=$("#articleHost");if(!host)return;
 const slug=new URLSearchParams(location.search).get("slug");
 const a=ARTICLES.find(x=>x.slug===slug&&x.status==="published")||publishedArticles()[0];
 if(!a){host.innerHTML="<p>Aucun article publié.</p>";return}
 document.title=(a.metaTitle||a.title)+" — kinvins.cd";
 let metaDesc=document.querySelector('meta[name="description"]');
 if(metaDesc)metaDesc.setAttribute("content",a.metaDescription||a.excerpt||"");
 let canonical=document.querySelector('link[rel="canonical"]');
 if(!canonical){canonical=document.createElement("link");canonical.rel="canonical";document.head.appendChild(canonical)}
 canonical.href=`https://kinvins.cd/blog/${a.slug}`;
 [["og:title",a.metaTitle||a.title],["og:description",a.metaDescription||a.excerpt||""]].forEach(([key,val])=>{const m=document.createElement("meta");m.setAttribute("property",key);m.content=val;document.head.appendChild(m)});
 const structured=document.createElement("script");structured.type="application/ld+json";
 structured.textContent=JSON.stringify({"@context":"https://schema.org","@type":"Article","headline":a.title,"description":a.metaDescription||a.excerpt,"datePublished":a.date,"dateModified":a.updatedAt?.slice(0,10)||a.date,"author":{"@type":"Organization","name":a.author||"KIN Vins & Spiritueux"},"publisher":{"@type":"Organization","name":"KIN Vins & Spiritueux"},"mainEntityOfPage":`https://kinvins.cd/blog/${a.slug}`});
 document.head.appendChild(structured);
 const paragraphs=String(a.content||"").split(/\n\s*\n/).filter(Boolean).map(p=>`<p>${p.replace(/\n/g,"<br>")}</p>`).join("");
 host.innerHTML=`<article class="article-wrap"><div class="article-head"><p class="eyebrow">${(a.category||"JOURNAL").toUpperCase()}</p><h1>${a.title}</h1><p class="article-excerpt">${a.excerpt||""}</p><div class="blog-meta"><span>Par ${a.author||"Équipe KIN"}</span><time>${formatDate(a.date)}</time></div></div>${articleImage(a,"article-hero-image")}<div class="article-layout"><div class="article-content">${paragraphs}<div class="article-cta"><h3>Découvrez notre sélection</h3><p>Retrouvez les vins, champagnes et spiritueux disponibles dans notre catalogue.</p><a class="btn btn-gold" href="catalogue.html">Voir le catalogue</a></div></div><aside class="article-aside panel"><p class="eyebrow">À RETENIR</p><strong>${a.focusKeyword||a.category||"KIN Journal"}</strong><p class="small muted">Article publié le ${formatDate(a.date)}.</p><a class="text-link" href="blog.html">← Tous les articles</a></aside></div></article>`;
}
function setupAdminBlog(){
 const body=$("#adminBlogTable");if(!body)return;
 const search=$("#adminBlogSearch");
 function render(){
  const q=(search?.value||"").toLowerCase().trim();
  const list=ARTICLES.filter(a=>`${a.title} ${a.category} ${a.author} ${a.slug}`.toLowerCase().includes(q)).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  body.innerHTML=list.map(a=>`<tr><td><strong>${a.title}</strong><div class="small muted">/${a.slug}</div></td><td>${a.category}</td><td>${formatDate(a.date)}</td><td><span class="status ${a.status==="published"?"ok":"warn"}">${a.status==="published"?"Publié":"Brouillon"}</span></td><td>${a.featured?"Oui":"—"}</td><td class="admin-actions"><a class="btn btn-outline btn-small" href="article.html?slug=${encodeURIComponent(a.slug)}">Voir</a><a class="btn btn-outline btn-small" href="admin-article-new.html?id=${a.id}">Modifier</a><button class="btn btn-danger btn-small" data-delete-article="${a.id}">Supprimer</button></td></tr>`).join("");
  $$("[data-delete-article]").forEach(b=>b.onclick=()=>{const id=Number(b.dataset.deleteArticle),a=ARTICLES.find(x=>x.id===id);if(!confirm(`Supprimer l’article « ${a?.title||""} » ?`))return;ARTICLES=ARTICLES.filter(x=>x.id!==id);saveArticles();render();toast("Article supprimé")});
 }
 if(search)search.oninput=render;
 const reset=$("#resetArticlesBtn");if(reset)reset.onclick=()=>{if(confirm("Réinitialiser les articles de démonstration ?")){ARTICLES=DEFAULT_ARTICLES.map(a=>({...a}));saveArticles();render();toast("Blog réinitialisé")}};
 render();
}
function setupAdminArticleForm(){
 const form=$("#adminArticleForm");if(!form)return;
 const id=Number(new URLSearchParams(location.search).get("id")||0),existing=id?ARTICLES.find(a=>a.id===id):null;
 const titleInput=form.elements.title,slugInput=form.elements.slug,metaTitle=form.elements.metaTitle,metaDesc=form.elements.metaDescription,keyword=form.elements.focusKeyword;
 if(existing){
  $("#articleFormTitle").textContent="Modifier l’article";$("#articleSubmitLabel").textContent="Enregistrer les modifications";
  ["title","slug","excerpt","content","category","author","date","status","metaTitle","metaDescription","focusKeyword"].forEach(k=>{if(form.elements[k])form.elements[k].value=existing[k]??""});
  form.elements.featured.checked=!!existing.featured;
  if(existing.image&&!String(existing.image).startsWith("data:"))form.elements.imageUrl.value=existing.image;
  $("#articleImageData").value=existing.image||"";
 }
 let slugTouched=!!existing;
 slugInput.addEventListener("input",()=>slugTouched=true);
 titleInput.addEventListener("input",()=>{if(!slugTouched)slugInput.value=slugify(titleInput.value);updateSeo()});
 [slugInput,metaTitle,metaDesc,keyword].forEach(el=>el.addEventListener("input",updateSeo));
 function updateSeo(){
  const seo=$("#seoChecklist");if(!seo)return;
  const mt=(metaTitle.value||titleInput.value).trim(),md=metaDesc.value.trim(),sl=slugInput.value.trim(),kw=keyword.value.trim().toLowerCase();
  const checks=[
   [mt.length>=35&&mt.length<=65,`Titre SEO : ${mt.length} caractères (objectif 35–65)`],
   [md.length>=120&&md.length<=160,`Meta description : ${md.length} caractères (objectif 120–160)`],
   [sl.length>3&&sl.length<80,`Slug : ${sl||"à définir"}`],
   [kw&&(`${titleInput.value} ${metaDesc.value}`.toLowerCase().includes(kw)),`Mot-clé principal : ${kw||"à définir"}`]
  ];
  seo.innerHTML=checks.map(([ok,text])=>`<div class="seo-check ${ok?"good":"todo"}"><span>${ok?"✓":"○"}</span>${text}</div>`).join("");
 }
 updateSeo();
 const preview=$("#articleImagePreview"),imageData=$("#articleImageData");
 function showImage(src){preview.innerHTML=src?`<img src="${src}" alt="Aperçu">`:`<span>Aucune image</span>`}
 showImage(existing?.image||"");
 form.elements.imageUrl.oninput=e=>{if(e.target.value.trim()){imageData.value=e.target.value.trim();showImage(imageData.value)}};
 form.elements.imageFile.onchange=e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>450000){toast("Image trop lourde pour ce prototype (max ~450 Ko)");e.target.value="";return}const reader=new FileReader();reader.onload=()=>{imageData.value=reader.result;showImage(reader.result)};reader.readAsDataURL(file)};
 $("#removeArticleImage").onclick=()=>{imageData.value="";form.elements.imageUrl.value="";form.elements.imageFile.value="";showImage("")};
 form.onsubmit=e=>{
  e.preventDefault();const fd=new FormData(form),data=Object.fromEntries(fd.entries());
  const article={...(existing||{}),id:existing?.id||Math.max(0,...ARTICLES.map(a=>Number(a.id)||0))+1,title:data.title.trim(),slug:slugify(data.slug||data.title),excerpt:data.excerpt.trim(),content:data.content.trim(),category:data.category,author:data.author.trim()||"Équipe KIN",date:data.date,status:data.status,featured:form.elements.featured.checked,image:data.imageData||"",metaTitle:data.metaTitle.trim()||data.title.trim(),metaDescription:data.metaDescription.trim()||data.excerpt.trim(),focusKeyword:data.focusKeyword.trim(),updatedAt:new Date().toISOString()};
  const duplicate=ARTICLES.find(a=>a.slug===article.slug&&a.id!==article.id);if(duplicate){toast("Ce slug est déjà utilisé");return}
  if(existing)ARTICLES=ARTICLES.map(a=>a.id===article.id?article:a);else ARTICLES.push(article);
  try{saveArticles()}catch{toast("Stockage local plein : utilisez une image plus légère ou une URL");return}
  toast(existing?"Article modifié":"Article créé");setTimeout(()=>location.href="admin-blog.html",500);
 };
}
document.addEventListener("DOMContentLoaded",()=>{setupHomeBlog();setupBlog();setupArticle();setupAdminBlog();setupAdminArticleForm()});


const DEFAULT_BANNERS = [{"id": 1, "name": "Accueil — Offre premium", "zone": "home_hero", "title": "Une sélection premium livrée à Kinshasa.", "subtitle": "Découvrez nos vins, champagnes et spiritueux sélectionnés.", "buttonLabel": "Voir le catalogue", "buttonLink": "catalogue.html", "image": "", "mobileImage": "", "fallbackTone": "#5c1623", "textAlign": "left", "overlay": 48, "order": 1, "active": true, "startDate": "", "endDate": "", "alt": "Sélection premium KIN Vins & Spiritueux"}, {"id": 2, "name": "Catalogue — Promotions", "zone": "catalog_top", "title": "Découvrez nos offres du moment.", "subtitle": "Sélection de bouteilles à prix avantageux.", "buttonLabel": "Voir les produits", "buttonLink": "catalogue.html", "image": "", "mobileImage": "", "fallbackTone": "#3b2415", "textAlign": "left", "overlay": 52, "order": 1, "active": true, "startDate": "", "endDate": "", "alt": "Offres du catalogue KIN Vins & Spiritueux"}];
let BANNERS = (() => {
  try{
    const saved=JSON.parse(localStorage.getItem("kin-site-banners")||"null");
    return Array.isArray(saved)&&saved.length?saved:DEFAULT_BANNERS.map(b=>({...b}));
  }catch{return DEFAULT_BANNERS.map(b=>({...b}))}
})();
function saveBanners(){localStorage.setItem("kin-site-banners",JSON.stringify(BANNERS))}
function bannerIsScheduledNow(b){
 const now=new Date();
 if(b.startDate){
   const s=new Date(b.startDate+"T00:00:00");
   if(now<s)return false;
 }
 if(b.endDate){
   const e=new Date(b.endDate+"T23:59:59");
   if(now>e)return false;
 }
 return b.active!==false;
}
function bannerZoneLabel(zone){
 return ({
   home_hero:"Accueil — Hero",
   home_promo:"Accueil — Promo",
   catalog_top:"Catalogue — Haut",
   blog_top:"Blog — Haut",
   pro_top:"KIN PRO — Haut"
 })[zone]||zone;
}
function bannerMarkup(b){
 const desktop=b.image||"";
 const mobile=b.mobileImage||desktop;
 const media = desktop ? `
   <picture class="managed-banner-media">
     ${mobile?`<source media="(max-width:680px)" srcset="${mobile}">`:""}
     <img src="${desktop}" alt="${b.alt||b.title||b.name||"Bannière"}">
   </picture>` : `<div class="managed-banner-fallback" style="background:radial-gradient(circle at 70% 30%,${b.fallbackTone||"#5c1623"},transparent 42%),linear-gradient(135deg,#26130f,#0d0b0a)"></div>`;
 const align=b.textAlign||"left";
 return `<article class="managed-banner-slide align-${align}" data-banner-id="${b.id}">
   ${media}
   <div class="managed-banner-overlay" style="background:rgba(0,0,0,${Math.max(0,Math.min(80,Number(b.overlay)||0))/100})"></div>
   <div class="managed-banner-content">
     ${b.title?`<h2>${b.title}</h2>`:""}
     ${b.subtitle?`<p>${b.subtitle}</p>`:""}
     ${b.buttonLabel&&b.buttonLink?`<a class="btn btn-gold" href="${b.buttonLink}">${b.buttonLabel}</a>`:""}
   </div>
 </article>`;
}
function setupManagedBanners(){
 $$("[data-banner-zone]").forEach(host=>{
   const zone=host.dataset.bannerZone;
   const list=BANNERS.filter(b=>b.zone===zone&&bannerIsScheduledNow(b)).sort((a,b)=>(Number(a.order)||0)-(Number(b.order)||0));
   if(!list.length){host.style.display="none";return}
   host.innerHTML=`<div class="managed-banner-track">${list.map(bannerMarkup).join("")}</div>${list.length>1?`<div class="managed-banner-dots">${list.map((_,i)=>`<button class="${i===0?"active":""}" data-banner-dot="${i}" aria-label="Bannière ${i+1}"></button>`).join("")}</div>`:""}`;
   const slides=host.querySelectorAll(".managed-banner-slide"),dots=host.querySelectorAll("[data-banner-dot]");
   let index=0,timer=null;
   const show=i=>{
     index=(i+slides.length)%slides.length;
     slides.forEach((s,j)=>s.classList.toggle("active",j===index));
     dots.forEach((d,j)=>d.classList.toggle("active",j===index));
   };
   dots.forEach((d,i)=>d.onclick=()=>{show(i);restart()});
   const restart=()=>{
     if(timer)clearInterval(timer);
     if(slides.length>1)timer=setInterval(()=>show(index+1),6500);
   };
   show(0);restart();
 });
}
function setupAdminBanners(){
 const table=$("#adminBannersTable");if(!table)return;
 const search=$("#adminBannerSearch");
 function render(){
   const q=(search?.value||"").toLowerCase().trim();
   const list=BANNERS.filter(b=>`${b.name} ${b.title} ${b.zone}`.toLowerCase().includes(q)).sort((a,b)=>a.zone.localeCompare(b.zone)||(Number(a.order)||0)-(Number(b.order)||0));
   table.innerHTML=list.map(b=>`<tr>
     <td><div style="display:flex;gap:10px;align-items:center"><div class="admin-banner-thumb">${b.image?`<img src="${b.image}" alt="">`:"KIN"}</div><div><strong>${b.name}</strong><div class="small muted">${b.title||"Sans titre"}</div></div></div></td>
     <td>${bannerZoneLabel(b.zone)}</td>
     <td>${b.order||0}</td>
     <td><span class="status ${b.active===false?"bad":bannerIsScheduledNow(b)?"ok":"warn"}">${b.active===false?"Inactive":bannerIsScheduledNow(b)?"Visible":"Planifiée"}</span></td>
     <td>${b.startDate||"—"} → ${b.endDate||"—"}</td>
     <td class="admin-actions"><a class="btn btn-outline btn-small" href="admin-banner-new.html?id=${b.id}">Modifier</a><button class="btn btn-danger btn-small" data-delete-banner="${b.id}">Supprimer</button></td>
   </tr>`).join("");
   $$("[data-delete-banner]").forEach(btn=>btn.onclick=()=>{
     const id=Number(btn.dataset.deleteBanner),b=BANNERS.find(x=>x.id===id);
     if(!confirm(`Supprimer la bannière « ${b?.name||""} » ?`))return;
     BANNERS=BANNERS.filter(x=>x.id!==id);saveBanners();render();toast("Bannière supprimée");
   });
 }
 if(search)search.oninput=render;
 const reset=$("#resetBannersBtn");if(reset)reset.onclick=()=>{if(confirm("Réinitialiser les bannières de démonstration ?")){BANNERS=DEFAULT_BANNERS.map(b=>({...b}));saveBanners();render();toast("Bannières réinitialisées")}};
 render();
}
function setupAdminBannerForm(){
 const form=$("#adminBannerForm");if(!form)return;
 const id=Number(new URLSearchParams(location.search).get("id")||0),existing=id?BANNERS.find(b=>b.id===id):null;
 const desktopPreview=$("#bannerImagePreview"),mobilePreview=$("#bannerMobilePreview");
 const imageData=$("#bannerImageData"),mobileData=$("#bannerMobileData");
 function showPreview(host,src,label){
   host.innerHTML=src?`<img src="${src}" alt="Aperçu">`:`<span>${label}</span>`;
 }
 if(existing){
   $("#bannerFormTitle").textContent="Modifier la bannière";
   $("#bannerSubmitLabel").textContent="Enregistrer les modifications";
   ["name","zone","title","subtitle","buttonLabel","buttonLink","fallbackTone","textAlign","overlay","order","startDate","endDate","alt"].forEach(k=>{if(form.elements[k])form.elements[k].value=existing[k]??""});
   form.elements.active.checked=existing.active!==false;
   imageData.value=existing.image||"";mobileData.value=existing.mobileImage||"";
   if(existing.image&&!String(existing.image).startsWith("data:"))form.elements.imageUrl.value=existing.image;
   if(existing.mobileImage&&!String(existing.mobileImage).startsWith("data:"))form.elements.mobileImageUrl.value=existing.mobileImage;
 }
 showPreview(desktopPreview,existing?.image||"","Aucune image desktop");
 showPreview(mobilePreview,existing?.mobileImage||"","Aucune image mobile");
 function bindImage(inputName,urlName,dataEl,preview,label){
   form.elements[urlName].oninput=e=>{if(e.target.value.trim()){dataEl.value=e.target.value.trim();showPreview(preview,dataEl.value,label)}};
   form.elements[inputName].onchange=e=>{
     const file=e.target.files?.[0];if(!file)return;
     if(file.size>700000){toast("Image trop lourde pour ce prototype (max ~700 Ko)");e.target.value="";return}
     const reader=new FileReader();reader.onload=()=>{dataEl.value=reader.result;showPreview(preview,reader.result,label)};reader.readAsDataURL(file);
   };
 }
 bindImage("imageFile","imageUrl",imageData,desktopPreview,"Aucune image desktop");
 bindImage("mobileImageFile","mobileImageUrl",mobileData,mobilePreview,"Aucune image mobile");
 $("#removeBannerImage").onclick=()=>{imageData.value="";form.elements.imageUrl.value="";form.elements.imageFile.value="";showPreview(desktopPreview,"","Aucune image desktop")};
 $("#removeBannerMobileImage").onclick=()=>{mobileData.value="";form.elements.mobileImageUrl.value="";form.elements.mobileImageFile.value="";showPreview(mobilePreview,"","Aucune image mobile")};
 const live=$("#bannerLivePreview");
 function updateLivePreview(){
   const d=Object.fromEntries(new FormData(form).entries());
   const tmp={id:0,name:d.name,title:d.title,subtitle:d.subtitle,buttonLabel:d.buttonLabel,buttonLink:d.buttonLink,image:imageData.value,mobileImage:mobileData.value,fallbackTone:d.fallbackTone,textAlign:d.textAlign,overlay:Number(d.overlay||0)};
   live.innerHTML=bannerMarkup(tmp);
   live.querySelector(".managed-banner-slide")?.classList.add("active");
 }
 form.addEventListener("input",updateLivePreview);form.addEventListener("change",updateLivePreview);updateLivePreview();
 form.onsubmit=e=>{
   e.preventDefault();const data=Object.fromEntries(new FormData(form).entries());
   const item={...(existing||{}),id:existing?.id||Math.max(0,...BANNERS.map(b=>Number(b.id)||0))+1,name:data.name.trim(),zone:data.zone,title:data.title.trim(),subtitle:data.subtitle.trim(),buttonLabel:data.buttonLabel.trim(),buttonLink:data.buttonLink.trim(),image:data.imageData||"",mobileImage:data.mobileImageData||"",fallbackTone:data.fallbackTone||"#5c1623",textAlign:data.textAlign||"left",overlay:Number(data.overlay||0),order:Number(data.order||0),active:form.elements.active.checked,startDate:data.startDate||"",endDate:data.endDate||"",alt:data.alt.trim(),updatedAt:new Date().toISOString()};
   if(existing)BANNERS=BANNERS.map(b=>b.id===item.id?item:b);else BANNERS.push(item);
   try{saveBanners()}catch{toast("Stockage local plein : utilisez une image plus légère ou une URL");return}
   toast(existing?"Bannière modifiée":"Bannière créée");setTimeout(()=>location.href="admin-banners.html",500);
 };
}
document.addEventListener("DOMContentLoaded",()=>{setupManagedBanners();setupAdminBanners();setupAdminBannerForm()});


const DEFAULT_CLIENTS = [{"id": 1, "type": "individual", "status": "active", "firstName": "Patrick", "lastName": "Mbuyi", "company": "", "email": "patrick@example.com", "phone": "+243 810 000 001", "city": "Kinshasa", "commune": "Gombe", "address": "Avenue exemple, Gombe", "createdAt": "2026-08-05", "lastOrderAt": "2026-09-17", "ordersCount": 4, "totalSpent": 326, "loyaltyPoints": 420, "tags": ["VIP", "Vin rouge"], "notes": "Préfère les livraisons en fin d’après-midi.", "proOffer": "", "taxId": "", "contactPerson": "", "creditLimit": 0}, {"id": 2, "type": "individual", "status": "active", "firstName": "Sarah", "lastName": "Kanku", "company": "", "email": "sarah@example.com", "phone": "+243 810 000 002", "city": "Kinshasa", "commune": "Ngaliema", "address": "Quartier Ma Campagne", "createdAt": "2026-08-22", "lastOrderAt": "2026-09-12", "ordersCount": 2, "totalSpent": 141, "loyaltyPoints": 160, "tags": ["Champagne"], "notes": "", "proOffer": "", "taxId": "", "contactPerson": "", "creditLimit": 0}, {"id": 3, "type": "professional", "status": "active", "firstName": "", "lastName": "", "company": "Hôtel Fleuve Démo", "email": "achats@hotel-demo.cd", "phone": "+243 810 000 100", "city": "Kinshasa", "commune": "Gombe", "address": "Boulevard du Fleuve", "createdAt": "2026-07-18", "lastOrderAt": "2026-09-18", "ordersCount": 14, "totalSpent": 4860, "loyaltyPoints": 0, "tags": ["Hôtel", "Grand compte"], "notes": "Livraison planifiée chaque vendredi.", "proOffer": "Premium", "taxId": "NIF-DEMO-001", "contactPerson": "Responsable achats", "creditLimit": 2500}, {"id": 4, "type": "professional", "status": "pending", "firstName": "", "lastName": "", "company": "Lounge Kin Démo", "email": "manager@lounge-demo.cd", "phone": "+243 810 000 101", "city": "Kinshasa", "commune": "Lingwala", "address": "Avenue du Commerce", "createdAt": "2026-09-14", "lastOrderAt": "", "ordersCount": 0, "totalSpent": 0, "loyaltyPoints": 0, "tags": ["Bar / Lounge"], "notes": "Compte Pro en attente de validation.", "proOffer": "Business", "taxId": "NIF-DEMO-002", "contactPerson": "Gérant", "creditLimit": 0}, {"id": 5, "type": "individual", "status": "inactive", "firstName": "Jean", "lastName": "Kalala", "company": "", "email": "jean@example.com", "phone": "+243 810 000 003", "city": "Kinshasa", "commune": "Limete", "address": "Limete résidentiel", "createdAt": "2026-06-09", "lastOrderAt": "2026-07-04", "ordersCount": 1, "totalSpent": 39, "loyaltyPoints": 40, "tags": [], "notes": "Compte désactivé à la demande du client.", "proOffer": "", "taxId": "", "contactPerson": "", "creditLimit": 0}];
let CLIENTS = (() => {
  try{
    const saved=JSON.parse(localStorage.getItem("kin-admin-clients")||"null");
    return Array.isArray(saved)&&saved.length?saved:DEFAULT_CLIENTS.map(c=>({...c}));
  }catch{return DEFAULT_CLIENTS.map(c=>({...c}))}
})();
function saveClients(){localStorage.setItem("kin-admin-clients",JSON.stringify(CLIENTS))}
function clientName(c){return c.type==="professional"?(c.company||"Entreprise"):`${c.firstName||""} ${c.lastName||""}`.trim()||"Client"}
function clientTypeLabel(c){return c.type==="professional"?"Professionnel":"Particulier"}
function clientStatusLabel(status){return ({active:"Actif",pending:"En attente",inactive:"Inactif",blocked:"Bloqué"})[status]||status}
function clientStatusClass(status){return ({active:"ok",pending:"warn",inactive:"info",blocked:"bad"})[status]||"info"}

function setupAdminClients(){
 const table=$("#adminClientsTable");if(!table)return;
 const search=$("#clientSearch"),type=$("#clientTypeFilter"),status=$("#clientStatusFilter");
 function render(){
   const q=(search?.value||"").toLowerCase().trim();
   const t=type?.value||"all",s=status?.value||"all";
   const list=CLIENTS.filter(c=>{
     const hay=`${clientName(c)} ${c.email} ${c.phone} ${c.commune} ${(c.tags||[]).join(" ")}`.toLowerCase();
     return (!q||hay.includes(q))&&(t==="all"||c.type===t)&&(s==="all"||c.status===s);
   }).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
   table.innerHTML=list.map(c=>`<tr>
     <td><div><strong>${clientName(c)}</strong><div class="small muted">${c.email}</div></div></td>
     <td>${clientTypeLabel(c)}</td>
     <td>${c.commune||"—"}</td>
     <td>${c.ordersCount||0}</td>
     <td>${money(c.totalSpent||0)}</td>
     <td><span class="status ${clientStatusClass(c.status)}">${clientStatusLabel(c.status)}</span></td>
     <td>${(c.tags||[]).slice(0,2).map(t=>`<span class="client-tag">${t}</span>`).join(" ")||"—"}</td>
     <td class="admin-actions"><a class="btn btn-outline btn-small" href="admin-client.html?id=${c.id}">Voir / modifier</a></td>
   </tr>`).join("");
   $("#clientsCount").textContent=list.length;
   $("#clientsRevenue").textContent=money(list.reduce((sum,c)=>sum+Number(c.totalSpent||0),0));
   $("#clientsProCount").textContent=list.filter(c=>c.type==="professional").length;
   $("#clientsPendingCount").textContent=list.filter(c=>c.status==="pending").length;
 }
 [search,type,status].forEach(el=>{if(el)el.addEventListener(el.tagName==="INPUT"?"input":"change",render)});
 const reset=$("#resetClientsBtn");if(reset)reset.onclick=()=>{if(confirm("Réinitialiser les clients de démonstration ?")){CLIENTS=DEFAULT_CLIENTS.map(c=>({...c}));saveClients();render();toast("Clients réinitialisés")}};
 const exportBtn=$("#exportClientsBtn");if(exportBtn)exportBtn.onclick=()=>{
   const headers=["ID","Type","Nom","Entreprise","Email","Téléphone","Commune","Statut","Commandes","Dépenses","Points","Offre Pro","Tags"];
   const rows=CLIENTS.map(c=>[c.id,c.type,`${c.firstName||""} ${c.lastName||""}`.trim(),c.company||"",c.email||"",c.phone||"",c.commune||"",c.status||"",c.ordersCount||0,c.totalSpent||0,c.loyaltyPoints||0,c.proOffer||"", (c.tags||[]).join("|")]);
   const esc=v=>`"${String(v??"").replace(/"/g,'""')}"`;
   const csv=[headers,...rows].map(r=>r.map(esc).join(",")).join("\n");
   const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");
   a.href=url;a.download="kin-clients.csv";a.click();URL.revokeObjectURL(url);
 };
 render();
}

function setupAdminClientForm(){
 const form=$("#adminClientForm");if(!form)return;
 const id=Number(new URLSearchParams(location.search).get("id")||0),existing=id?CLIENTS.find(c=>c.id===id):null;
 const typeSelect=form.elements.type,individualFields=$("#individualFields"),proFields=$("#professionalFields");
 function syncType(){
   const pro=typeSelect.value==="professional";
   individualFields.style.display=pro?"none":"grid";
   proFields.style.display=pro?"grid":"none";
 }
 typeSelect.addEventListener("change",syncType);
 if(existing){
   $("#clientFormTitle").textContent=clientName(existing);
   $("#clientSubmitLabel").textContent="Enregistrer les modifications";
   ["type","status","firstName","lastName","company","email","phone","city","commune","address","createdAt","lastOrderAt","ordersCount","totalSpent","loyaltyPoints","proOffer","taxId","contactPerson","creditLimit","notes"].forEach(k=>{
     if(form.elements[k])form.elements[k].value=existing[k]??"";
   });
   form.elements.tags.value=(existing.tags||[]).join(", ");
 }
 syncType();
 const archive=$("#archiveClientBtn");if(archive&&existing)archive.onclick=()=>{
   existing.status="inactive";saveClients();form.elements.status.value="inactive";toast("Client désactivé");
 };
 const deleteBtn=$("#deleteClientBtn");if(deleteBtn&&existing)deleteBtn.onclick=()=>{
   if(!confirm(`Supprimer définitivement ${clientName(existing)} ?`))return;
   CLIENTS=CLIENTS.filter(c=>c.id!==existing.id);saveClients();location.href="admin-clients.html";
 };
 form.onsubmit=e=>{
   e.preventDefault();
   const d=Object.fromEntries(new FormData(form).entries());
   const item={
     ...(existing||{}),
     id:existing?.id||Math.max(0,...CLIENTS.map(c=>Number(c.id)||0))+1,
     type:d.type,status:d.status,
     firstName:d.type==="individual"?d.firstName.trim():"",
     lastName:d.type==="individual"?d.lastName.trim():"",
     company:d.type==="professional"?d.company.trim():"",
     email:d.email.trim(),phone:d.phone.trim(),city:d.city.trim(),commune:d.commune.trim(),address:d.address.trim(),
     createdAt:d.createdAt||new Date().toISOString().slice(0,10),lastOrderAt:d.lastOrderAt||"",
     ordersCount:Number(d.ordersCount||0),totalSpent:Number(d.totalSpent||0),loyaltyPoints:Number(d.loyaltyPoints||0),
     tags:String(d.tags||"").split(",").map(x=>x.trim()).filter(Boolean),
     notes:d.notes.trim(),
     proOffer:d.type==="professional"?d.proOffer:"",
     taxId:d.type==="professional"?d.taxId.trim():"",
     contactPerson:d.type==="professional"?d.contactPerson.trim():"",
     creditLimit:d.type==="professional"?Number(d.creditLimit||0):0,
     updatedAt:new Date().toISOString()
   };
   if(existing)CLIENTS=CLIENTS.map(c=>c.id===item.id?item:c);else CLIENTS.push(item);
   saveClients();toast(existing?"Client modifié":"Client créé");
   setTimeout(()=>location.href=`admin-client.html?id=${item.id}`,400);
 };
 if(existing){
   const summary=$("#clientSummary");
   summary.innerHTML=`<div class="dashboard-grid">
     <div class="panel kpi"><span>COMMANDES</span><strong>${existing.ordersCount||0}</strong></div>
     <div class="panel kpi"><span>DÉPENSES</span><strong>${money(existing.totalSpent||0)}</strong></div>
     <div class="panel kpi"><span>POINTS</span><strong>${existing.loyaltyPoints||0}</strong></div>
     <div class="panel kpi"><span>DERNIÈRE COMMANDE</span><strong style="font-size:1.2rem">${existing.lastOrderAt||"—"}</strong></div>
   </div>`;
   const orders=$("#clientOrders");
   if(existing.ordersCount>0){
     const n=Math.min(existing.ordersCount,4);
     orders.innerHTML=Array.from({length:n},(_,i)=>`<tr><td>#KIN-${10428-i-existing.id}</td><td>${i===0?(existing.lastOrderAt||"2026-09-10"):"2026-08-"+String(20-i).padStart(2,"0")}</td><td>${money(Math.max(24,Math.round((existing.totalSpent||100)/Math.max(1,n))))}</td><td><span class="status ok">Livrée</span></td></tr>`).join("");
   }else{
     orders.innerHTML='<tr><td colspan="4" class="muted">Aucune commande.</td></tr>';
   }
 }
}
document.addEventListener("DOMContentLoaded",()=>{setupAdminClients();setupAdminClientForm()});
