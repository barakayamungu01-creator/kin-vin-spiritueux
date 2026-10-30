(() => {
"use strict";
const cfg=window.KINVINS_SUPABASE_CONFIG||{};
function token(){try{return JSON.parse(sessionStorage.getItem("kinvins_admin_session")||"null")?.accessToken||""}catch{return""}}
async function api(resource){
 const r=await fetch(`${cfg.url}/rest/v1/${resource}`,{
  headers:{apikey:cfg.publishableKey,Authorization:`Bearer ${token()}`}
 });
 let d=null;try{d=await r.json()}catch{}
 if(!r.ok)throw new Error(d?.message||`${r.status} ${r.statusText}`);
 return d;
}
const money=v=>`$${Number(v||0).toFixed(2)}`;
document.addEventListener("DOMContentLoaded",async()=>{
 const body=document.querySelector("#ordersLiveTable");if(!body)return;
 try{
  const rows=await api("orders?select=id,order_number,customer_name,customer_phone,created_at,total,deposit_amount,balance_amount,balance_status,payment_status,order_status&order=created_at.desc&limit=200");
  body.innerHTML=rows.length?rows.map(o=>`<tr>
   <td><strong>${o.order_number}</strong></td>
   <td>${o.customer_name}<div class="small muted">${o.customer_phone||""}</div></td>
   <td>${new Date(o.created_at).toLocaleString("fr-FR")}</td>
   <td>${money(o.total)}</td>
   <td>${money(o.deposit_amount)}</td>
   <td>${money(o.balance_amount)}<div class="small muted">${o.balance_status||"—"}</div></td>
   <td><span class="status ${o.payment_status==="paid"?"ok":o.payment_status==="deposit_paid"?"info":"warn"}">${o.payment_status}</span></td>
   <td>${o.order_status}</td>
  </tr>`).join(""):'<tr><td colspan="8">Aucune commande.</td></tr>';
 }catch(e){body.innerHTML=`<tr><td colspan="8">Erreur : ${e.message}</td></tr>`}
});
})();