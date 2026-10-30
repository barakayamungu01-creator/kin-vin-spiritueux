(() => {
"use strict";
const cfg=window.KINVINS_SUPABASE_CONFIG||{};
let paymentSubmitting=false;
const info={
 mpesa:{label:"M-Pesa",help:"Une demande de paiement M-Pesa sera envoyée sur votre téléphone Vodacom."},
 airtel_money:{label:"Airtel Money",help:"Une demande Airtel Money sera envoyée sur votre téléphone Airtel."},
 orange_money:{label:"Orange Money",help:"Suivez les instructions Orange Money affichées sur votre téléphone."},
 cash_on_delivery:{label:"Paiement à la livraison",help:"Vous réglerez la commande à la livraison."}
};
const configured=()=>Boolean(cfg.url&&cfg.publishableKey&&!String(cfg.url).includes("VOTRE-PROJET")&&!String(cfg.publishableKey).includes("VOTRE_CLE"));
function normalizePhone(v){let p=String(v||"").replace(/[^\d+]/g,"");if(p.startsWith("00"))p="+"+p.slice(2);if(p.startsWith("0"))p="+243"+p.slice(1);if(/^\d{9}$/.test(p))p="+243"+p;return p}
function validPhone(v){return /^\+243\d{9}$/.test(normalizePhone(v))}
async function invoke(payload){
 if(!configured())throw new Error("Supabase n'est pas configuré.");
 const r=await fetch(`${cfg.url}/functions/v1/mobile-payment`,{method:"POST",headers:{apikey:cfg.publishableKey,Authorization:`Bearer ${cfg.publishableKey}`,"Content-Type":"application/json"},body:JSON.stringify(payload)});
 let body={};try{body=await r.json()}catch{}
 if(!r.ok)throw new Error(body.error||body.message||`${r.status} ${r.statusText}`);
 return body;
}
function provider(form){return form.querySelector('input[name="pay"]:checked')?.value||"mpesa"}
function totals(){const sub=cartSubtotal(),opt=document.querySelector("#zone")?.selectedOptions?.[0],fee=opt?Number(opt.dataset.fee||0):0;return{subtotal:sub,deliveryFee:fee,total:sub+fee}}
function renderSummary(){
 const sum=document.querySelector("#checkoutSummary");if(!sum)return;
 const t=totals();
 sum.innerHTML=`${cartRows().map(({product:p,qty})=>`<div class="summary-row"><span>${qty}× ${p.name}</span><strong>${money(productPrice(p)*qty)}</strong></div>`).join("")}<div class="summary-row"><span>Sous-total</span><strong>${money(t.subtotal)}</strong></div><div class="summary-row"><span>Livraison</span><strong>${money(t.deliveryFee)}</strong></div><div class="summary-row total"><span>Total</span><strong>${money(t.total)}</strong></div>`;
}
function updateUI(){
 const form=document.querySelector("#checkoutForm");if(!form)return;
 const p=provider(form),meta=info[p]||info.mpesa;
 document.querySelectorAll(".payment-provider-card").forEach(c=>c.classList.toggle("selected",c.querySelector("input")?.checked));
 const panel=document.querySelector("#mobilePaymentPanel"),phone=document.querySelector("#mobileMoneyPhone"),button=document.querySelector("#checkoutSubmitButton");
 document.querySelector("#selectedPaymentTitle").textContent=meta.label;
 document.querySelector("#selectedPaymentHelp").textContent=meta.help;
 const mobile=p!=="cash_on_delivery";
 panel.classList.toggle("hidden",!mobile);phone.required=mobile;
 button.textContent=mobile?`Payer avec ${meta.label}`:"Confirmer la commande";
}
function feedback(msg,type="info"){const b=document.querySelector("#paymentFeedback");if(!b)return;b.textContent=msg;b.className=`payment-feedback ${type}`}
function payload(form){
 const d=new FormData(form),t=totals(),p=provider(form);
 return{action:"initiate",provider:p,customer:{name:String(d.get("name")||"").trim(),phone:normalizePhone(d.get("phone")),mobileMoneyPhone:normalizePhone(d.get("mobileMoneyPhone")||d.get("phone")),address:String(d.get("address")||"").trim(),commune:document.querySelector("#zone")?.selectedOptions?.[0]?.textContent?.split("—")[0]?.trim()||""},currency:"USD",subtotal:t.subtotal,deliveryFee:t.deliveryFee,total:t.total,items:cartRows().map(({product,qty})=>({productId:product.id,sku:product.sku||null,name:product.name,quantity:qty,unitPrice:productPrice(product)})),returnUrl:new URL("payment-status.html",location.href).href,confirmationUrl:new URL("confirmation.html",location.href).href};
}
async function submit(e){
 e.preventDefault();if(paymentSubmitting)return;
 const form=e.currentTarget,p=provider(form);
 if(!cartRows().length){toast("Votre panier est vide");return}
 if(p!=="cash_on_delivery"&&!validPhone(document.querySelector("#mobileMoneyPhone")?.value)){feedback("Entrez un numéro RDC valide au format +243…","error");return}
 const btn=document.querySelector("#checkoutSubmitButton"),old=btn.textContent;paymentSubmitting=true;btn.disabled=true;btn.textContent=p==="cash_on_delivery"?"Création de la commande…":"Demande de paiement…";feedback("Connexion sécurisée au service de paiement…","info");
 try{
  const r=await invoke(payload(form));
  sessionStorage.setItem("kin-last-order",r.orderNumber||"");sessionStorage.setItem("kin-last-total",money(r.total||totals().total));sessionStorage.setItem("kin-last-payment-method",p);sessionStorage.setItem("kin-payment-order-id",r.orderId||"");sessionStorage.setItem("kin-payment-id",r.paymentId||"");
  if(p==="cash_on_delivery"){state.cart={};saveCart();location.href="confirmation.html";return}
  if(r.redirectUrl){location.href=r.redirectUrl;return}
  location.href=`payment-status.html?order=${encodeURIComponent(r.orderId)}&payment=${encodeURIComponent(r.paymentId)}`;
 }catch(err){feedback(err.message||"Paiement impossible.","error");btn.disabled=false;btn.textContent=old;paymentSubmitting=false}
}
function setupCheckout(){
 const form=document.querySelector("#checkoutForm"),sum=document.querySelector("#checkoutSummary");if(!form||!sum)return;
 renderSummary();document.querySelector("#zone")?.addEventListener("change",renderSummary);form.querySelectorAll('input[name="pay"]').forEach(i=>i.addEventListener("change",updateUI));updateUI();form.onsubmit=submit;
}
async function paymentStatus(orderId,paymentId){return invoke({action:"status",orderId,paymentId})}
window.KinMobilePayments={setupCheckout,paymentStatus,invoke,normalizePhone};
document.addEventListener("DOMContentLoaded",()=>{if(document.querySelector("#checkoutForm"))setupCheckout()});
})();