(() => {
"use strict";

const cfg=window.KINVINS_SUPABASE_CONFIG||{};
const MAX_PROOF=5*1024*1024;
let SETTINGS=null;
let submitting=false;

const configured=()=>Boolean(
  cfg.url&&cfg.publishableKey&&
  !String(cfg.url).includes("VOTRE-PROJET")&&
  !String(cfg.publishableKey).includes("VOTRE_CLE")
);

function money2(v){return `$${Number(v||0).toFixed(2)}`}

function normalizePhone(v){
 let p=String(v||"").replace(/[^\d+]/g,"");
 if(p.startsWith("00"))p="+"+p.slice(2);
 if(p.startsWith("0"))p="+243"+p.slice(1);
 if(/^\d{9}$/.test(p))p="+243"+p;
 return p;
}

async function rest(resource,{method="GET",body,headers={}}={}){
 if(!configured())throw new Error("Supabase n'est pas configuré.");
 const h={apikey:cfg.publishableKey,"Content-Type":"application/json",...headers};
 const r=await fetch(`${cfg.url}/rest/v1/${resource}`,{
  method,headers:h,
  body:body===undefined?undefined:JSON.stringify(body)
 });
 let data=null;
 if(r.status!==204){
  try{data=await r.json()}catch{}
 }
 if(!r.ok)throw new Error(data?.message||data?.details||data?.hint||`${r.status} ${r.statusText}`);
 return data;
}

async function rpc(name,body){
 return rest(`rpc/${name}`,{method:"POST",body});
}

async function loadSettings(){
 const rows=await rest("payment_settings?select=*&active=eq.true&order=id.asc&limit=1");
 SETTINGS=rows?.[0]||null;
 if(!SETTINGS)throw new Error("Le compte Orange Money n'est pas encore configuré dans l'Admin.");
 return SETTINGS;
}

function totals(){
 const subtotal=cartSubtotal();
 const zone=document.querySelector("#zone")?.selectedOptions?.[0];
 const deliveryFee=zone?Number(zone.dataset.fee||0):0;
 const total=subtotal+deliveryFee;
 const pct=Number(SETTINGS?.deposit_percent||50);
 const deposit=Math.round((total*pct/100)*100)/100;
 const balance=Math.round((total-deposit)*100)/100;
 return{subtotal,deliveryFee,total,pct,deposit,balance};
}

function renderSummary(){
 const sum=document.querySelector("#checkoutSummary");
 if(!sum)return;
 const t=totals();
 sum.innerHTML=`
 ${cartRows().map(({product:p,qty})=>`
 <div class="summary-row"><span>${qty}× ${p.name}</span><strong>${money(productPrice(p)*qty)}</strong></div>`).join("")}
 <div class="summary-row"><span>Sous-total</span><strong>${money(t.subtotal)}</strong></div>
 <div class="summary-row"><span>Livraison</span><strong>${money(t.deliveryFee)}</strong></div>
 <div class="summary-row total"><span>Total commande</span><strong>${money(t.total)}</strong></div>
 <div class="manual-split-summary">
   <div><span>À payer maintenant — ${t.pct}%</span><strong>${money2(t.deposit)}</strong></div>
   <div><span>Solde à la livraison — ${100-t.pct}%</span><strong>${money2(t.balance)}</strong></div>
 </div>`;
 document.querySelector("#paymentDepositAmount").textContent=money2(t.deposit);
 document.querySelector("#paymentBalanceAmount").textContent=money2(t.balance);
 const amount=document.querySelector("#amountSent");
 if(amount && !amount.matches(":focus"))amount.value=t.deposit.toFixed(2);
}

function network(){
 return document.querySelector('input[name="payNetwork"]:checked')?.value||"orange_money";
}

function updateNetwork(){
 document.querySelectorAll(".payment-provider-card").forEach(card=>{
  card.classList.toggle("selected",Boolean(card.querySelector("input")?.checked));
 });
 const n=network();
 const help=document.querySelector("#networkPaymentHelp");
 if(n==="orange_money"){
  help.textContent="Effectuez le paiement directement vers notre compte Orange Money, puis saisissez la référence de transaction.";
 }else if(n==="mpesa"){
  help.textContent="Depuis M-Pesa, utilisez le transfert inter-réseaux vers notre compte Orange Money si cette option est disponible sur votre portefeuille. Sinon contactez KINVINS sur WhatsApp.";
 }else{
  help.textContent="Depuis Airtel Money, utilisez le transfert inter-réseaux vers notre compte Orange Money si cette option est disponible sur votre portefeuille. Sinon contactez KINVINS sur WhatsApp.";
 }
}

function renderSettings(){
 if(!SETTINGS)return;
 document.querySelector("#paymentReceiverName").textContent=SETTINGS.receiver_name||"KIN Vins & Spiritueux";
 document.querySelector("#paymentReceiverPhone").textContent=SETTINGS.receiver_phone||"—";

 const merchantRow=document.querySelector("#merchantCodeRow");
 if(SETTINGS.merchant_code){
  document.querySelector("#paymentMerchantCode").textContent=SETTINGS.merchant_code;
  merchantRow.classList.remove("hidden");
 }else merchantRow.classList.add("hidden");

 const qr=document.querySelector("#paymentQrCode");
 if(SETTINGS.qr_url){
  qr.src=SETTINGS.qr_url;
  qr.classList.remove("hidden");
 }else qr.classList.add("hidden");
}

function feedback(msg,type="info"){
 const b=document.querySelector("#paymentFeedback");
 if(!b)return;
 b.textContent=msg;
 b.className=`payment-feedback ${type}`;
}

function proofPath(file){
 const ext=(file.name.split(".").pop()||"bin").toLowerCase().replace(/[^a-z0-9]/g,"");
 return `pending/${crypto.randomUUID()}.${ext}`;
}

async function uploadProof(file){
 if(!file)return null;
 if(file.size>MAX_PROOF)throw new Error("La preuve dépasse 5 Mo.");
 const allowed=["image/jpeg","image/png","image/webp","application/pdf"];
 if(!allowed.includes(file.type))throw new Error("Format de preuve non accepté.");
 const path=proofPath(file);
 const encoded=path.split("/").map(encodeURIComponent).join("/");
 const r=await fetch(`${cfg.url}/storage/v1/object/payment-proofs/${encoded}`,{
  method:"POST",
  headers:{
   apikey:cfg.publishableKey,
   Authorization:`Bearer ${cfg.publishableKey}`,
   "Content-Type":file.type,
   "cache-control":"3600"
  },
  body:file
 });
 if(!r.ok){
  let d={};try{d=await r.json()}catch{}
  throw new Error(d.message||d.error||"Impossible d'envoyer la preuve de paiement.");
 }
 return path;
}

async function submitCheckout(e){
 e.preventDefault();
 if(submitting)return;
 if(!cartRows().length){toast("Votre panier est vide");return}

 const form=e.currentTarget;
 const d=new FormData(form);
 const t=totals();
 const senderPhone=normalizePhone(d.get("senderPhone"));
 const tx=String(d.get("transactionReference")||"").trim();
 const amountSent=Number(d.get("amountSent")||0);
 const proofFile=d.get("paymentProof");

 if(!/^\+243\d{9}$/.test(senderPhone)){
  feedback("Entrez un numéro expéditeur RDC valide au format +243…","error");return;
 }
 if(tx.length<3){
  feedback("Saisissez la référence de transaction reçue après le transfert.","error");return;
 }
 if(Math.abs(amountSent-t.deposit)>0.01){
  feedback(`Le montant déclaré doit correspondre à l'acompte attendu : ${money2(t.deposit)}.`,"error");return;
 }

 const btn=document.querySelector("#checkoutSubmitButton");
 const old=btn.textContent;
 submitting=true;btn.disabled=true;btn.textContent="Enregistrement…";
 feedback("Enregistrement sécurisé de votre déclaration de paiement…","info");

 try{
  let path=null;
  if(proofFile && proofFile.size){
   btn.textContent="Envoi de la preuve…";
   path=await uploadProof(proofFile);
  }

  btn.textContent="Création de la commande…";
  const zone=document.querySelector("#zone");
  const result=await rpc("create_manual_mobile_order",{
   p_customer:{
    name:String(d.get("name")||"").trim(),
    phone:normalizePhone(d.get("phone")),
    address:String(d.get("address")||"").trim()
   },
   p_items:cartRows().map(({product,qty})=>({
    productId:product.id,
    quantity:qty
   })),
   p_delivery:{
    commune:zone?.value||zone?.selectedOptions?.[0]?.textContent?.split("—")[0]?.trim()||"",
    deliveryType:String(d.get("deliveryType")||"Standard")
   },
   p_network:network(),
   p_sender_phone:senderPhone,
   p_transaction_reference:tx,
   p_amount_declared:amountSent,
   p_proof_path:path
  });

  sessionStorage.setItem("kin-last-order",result.orderNumber||"");
  sessionStorage.setItem("kin-last-total",money2(result.total));
  sessionStorage.setItem("kin-last-deposit",money2(result.depositAmount));
  sessionStorage.setItem("kin-last-balance",money2(result.balanceAmount));
  sessionStorage.setItem("kin-last-payment-method",network());

  // Le panier est vidé seulement après enregistrement réussi de la commande.
  state.cart={};saveCart();
  location.href="confirmation.html";
 }catch(err){
  feedback(err.message||"Impossible d'enregistrer la commande.","error");
  btn.disabled=false;btn.textContent=old;submitting=false;
 }
}

async function setupCheckout(){
 const form=document.querySelector("#checkoutForm");
 const sum=document.querySelector("#checkoutSummary");
 if(!form||!sum)return;

 try{
  await loadSettings();
  renderSettings();
  renderSummary();
 }catch(err){
  feedback(err.message,"error");
  document.querySelector("#checkoutSubmitButton").disabled=true;
  return;
 }

 document.querySelector("#zone")?.addEventListener("change",renderSummary);
 form.querySelectorAll('input[name="payNetwork"]').forEach(i=>i.addEventListener("change",updateNetwork));
 updateNetwork();
 form.onsubmit=submitCheckout;
}

window.KinManualPayments={setupCheckout};

document.addEventListener("DOMContentLoaded",()=>{
 if(document.querySelector("#checkoutForm"))setupCheckout();
});
})();