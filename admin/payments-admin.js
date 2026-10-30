(() => {
"use strict";

const cfg=window.KINVINS_SUPABASE_CONFIG||{};
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];

function session(){
 try{return JSON.parse(sessionStorage.getItem("kinvins_admin_session")||"null")}catch{return null}
}
function token(){return session()?.accessToken||""}

async function api(resource,{method="GET",body,prefer=""}={}){
 const t=token();
 if(!t)throw new Error("Session administrateur expirée.");
 const h={
  apikey:cfg.publishableKey,
  Authorization:`Bearer ${t}`,
  "Content-Type":"application/json"
 };
 if(prefer)h.Prefer=prefer;

 const r=await fetch(`${cfg.url}/rest/v1/${resource}`,{
  method,headers:h,
  body:body===undefined?undefined:JSON.stringify(body)
 });
 let data=null;
 if(r.status!==204){try{data=await r.json()}catch{}}
 if(!r.ok)throw new Error(data?.message||data?.details||data?.hint||`${r.status} ${r.statusText}`);
 return data;
}

async function rpc(name,body){
 return api(`rpc/${name}`,{method:"POST",body});
}

const networkLabel=n=>({
 orange_money:"Orange Money",
 mpesa:"M-Pesa",
 airtel_money:"Airtel Money"
}[n]||n);

const statusLabel=s=>({
 pending_verification:"À vérifier",
 deposit_paid:"Acompte validé",
 rejected:"Refusé"
}[s]||s);

async function loadSettings(){
 const form=$("#paymentSettingsForm");
 if(!form)return;
 const rows=await api("payment_settings?select=*&order=id.asc&limit=1");
 const s=rows?.[0];
 if(!s)return;

 form.dataset.id=s.id;
 form.elements.receiverName.value=s.receiver_name||"KIN Vins & Spiritueux";
 form.elements.receiverPhone.value=s.receiver_phone||"";
 form.elements.merchantCode.value=s.merchant_code||"";
 form.elements.depositPercent.value=Number(s.deposit_percent||50);
 form.elements.qrUrl.value=s.qr_url||"";
}

async function saveSettings(e){
 e.preventDefault();
 const form=e.currentTarget;
 const id=form.dataset.id;
 const d=Object.fromEntries(new FormData(form).entries());

 const payload={
  receiver_name:d.receiverName.trim(),
  receiver_network:"ORANGE_MONEY",
  receiver_phone:d.receiverPhone.trim(),
  merchant_code:d.merchantCode.trim()||null,
  deposit_percent:Number(d.depositPercent||50),
  qr_url:d.qrUrl.trim()||null,
  active:true,
  updated_at:new Date().toISOString()
 };

 if(id){
  await api(`payment_settings?id=eq.${id}`,{
   method:"PATCH",body:payload,prefer:"return=minimal"
  });
 }else{
  await api("payment_settings",{
   method:"POST",body:payload,prefer:"return=minimal"
  });
 }
 if(typeof toast==="function")toast("Configuration Orange Money enregistrée");
 else alert("Configuration Orange Money enregistrée");
 await loadSettings();
}

async function openProof(path){
 if(!path){alert("Aucune preuve jointe.");return}
 const t=token();
 const encoded=path.split("/").map(encodeURIComponent).join("/");
 const r=await fetch(`${cfg.url}/storage/v1/object/payment-proofs/${encoded}`,{
  headers:{apikey:cfg.publishableKey,Authorization:`Bearer ${t}`}
 });
 if(!r.ok)throw new Error("Impossible d'ouvrir la preuve.");
 const blob=await r.blob();
 const url=URL.createObjectURL(blob);
 window.open(url,"_blank","noopener");
 setTimeout(()=>URL.revokeObjectURL(url),60000);
}

async function loadPayments(){
 const body=$("#paymentsTable");
 body.innerHTML='<tr><td colspan="9">Chargement…</td></tr>';

 const rows=await api(
  "payment_deposits?select=id,order_id,sender_network,sender_phone,transaction_reference,amount_expected,amount_declared,proof_path,status,rejection_reason,created_at,orders(order_number,customer_name,total,balance_amount,payment_status,order_status)&order=created_at.desc&limit=200"
 );

 let pending=0,paid=0,failed=0;
 rows.forEach(r=>{
  if(r.status==="pending_verification")pending++;
  else if(r.status==="deposit_paid")paid++;
  else failed++;
 });
 $("#pendingPayments").textContent=pending;
 $("#paidPayments").textContent=paid;
 $("#failedPayments").textContent=failed;

 body.innerHTML=rows.length?rows.map(r=>{
  const order=r.orders||{};
  return `<tr>
   <td><strong>${order.order_number||"—"}</strong><div class="small muted">${new Date(r.created_at).toLocaleString("fr-FR")}</div></td>
   <td>${order.customer_name||"—"}<div class="small muted">Total $${Number(order.total||0).toFixed(2)}<br>Solde $${Number(order.balance_amount||0).toFixed(2)}</div></td>
   <td>${networkLabel(r.sender_network)}</td>
   <td>${r.sender_phone}</td>
   <td><strong>${r.transaction_reference}</strong></td>
   <td>$${Number(r.amount_declared||0).toFixed(2)}<div class="small muted">Attendu $${Number(r.amount_expected||0).toFixed(2)}</div></td>
   <td>${r.proof_path?`<button class="table-action" data-proof="${encodeURIComponent(r.proof_path)}">Voir</button>`:"—"}</td>
   <td><span class="status ${r.status==="deposit_paid"?"ok":r.status==="rejected"?"bad":"warn"}">${statusLabel(r.status)}</span>${r.rejection_reason?`<div class="small muted">${r.rejection_reason}</div>`:""}</td>
   <td>
    ${r.status==="pending_verification"?`
      <button class="btn btn-gold btn-small" data-confirm="${r.id}">Confirmer</button>
      <button class="btn btn-outline btn-small" data-reject="${r.id}">Refuser</button>
    `:""}
    ${r.status==="deposit_paid" && order.payment_status!=="paid"?`
      <button class="btn btn-outline btn-small" data-balance="${r.order_id}">Solde encaissé</button>
    `:""}
   </td>
  </tr>`;
 }).join(""):'<tr><td colspan="9">Aucun paiement.</td></tr>';

 $$("[data-proof]").forEach(b=>b.onclick=async()=>{
  try{await openProof(decodeURIComponent(b.dataset.proof))}
  catch(e){alert(e.message)}
 });

 $$("[data-confirm]").forEach(b=>b.onclick=async()=>{
  if(!confirm("Confirmer que l'acompte est bien reçu sur Orange Money ?"))return;
  try{
   await rpc("admin_verify_deposit",{p_payment_id:b.dataset.confirm,p_action:"confirm",p_reason:null});
   await loadPayments();
  }catch(e){alert(e.message)}
 });

 $$("[data-reject]").forEach(b=>b.onclick=async()=>{
  const reason=prompt("Motif du refus (optionnel) :")||"";
  try{
   await rpc("admin_verify_deposit",{p_payment_id:b.dataset.reject,p_action:"reject",p_reason:reason});
   await loadPayments();
  }catch(e){alert(e.message)}
 });

 $$("[data-balance]").forEach(b=>b.onclick=async()=>{
  if(!confirm("Confirmer que le solde de 50 % a été encaissé à la livraison ?"))return;
  try{
   await rpc("admin_mark_balance_paid",{p_order_id:b.dataset.balance});
   await loadPayments();
  }catch(e){alert(e.message)}
 });
}

document.addEventListener("DOMContentLoaded",async()=>{
 $("#paymentSettingsForm")?.addEventListener("submit",e=>saveSettings(e).catch(err=>alert(err.message)));
 $("#refreshPayments")?.addEventListener("click",()=>loadPayments().catch(err=>alert(err.message)));
 try{
  await loadSettings();
  await loadPayments();
 }catch(err){
  alert(err.message);
 }
});
})();