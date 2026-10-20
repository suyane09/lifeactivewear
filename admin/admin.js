(()=>{
"use strict";
/* Painel administrativo — Life Activewear. Usa só a chave pública + login do administrador;
   todo acesso é limitado pelas políticas RLS do Supabase (is_admin). */
const URL_="https://karlmhxtuuqpeoetqisp.supabase.co";
const KEY="sb_publishable_YU9uGtcworbZXRRPVX8e_g_8FeFvR5s";
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const brl=n=>(+n||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const fdate=d=>d?new Date(d).toLocaleString("pt-BR",{timeZone:"America/Recife",dateStyle:"short",timeStyle:"short"}):"";
const imgSrc=u=>!u?"":/^assets\//.test(u)?"../"+u:u;
const ST={aguardando:["Aguardando atendimento","warn"],confirmado:["Confirmado","ok"],preparando:["Preparando","blue"],entregue:["Entregue","dark"],cancelado:["Cancelado",""]};
const stBadge=s=>`<span class="badge ${(ST[s]||[0,""])[1]}">${esc((ST[s]||[s])[0])}</span>`;
const num=v=>{v=String(v==null?"":v).trim();if(!v)return null;if(v.includes(","))v=v.replace(/\./g,"").replace(",",".");const n=Number(v);return isFinite(n)?n:NaN};
const money=v=>v==null||v===""?"":Number(v).toFixed(2).replace(".",",");
const slug=s=>s.normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"")||"cat";
const SEED_IMGS=["i7150","i7151","i7152","i7153","i7156","i7157","i7306","i7307"].map(k=>`assets/img/${k}.jpg`);

/* ---------- sessão ---------- */
let session=null;try{session=JSON.parse(localStorage.getItem("life_admin_session"))}catch(e){}
const saveSess=s=>{session=s;try{s?localStorage.setItem("life_admin_session",JSON.stringify(s)):localStorage.removeItem("life_admin_session")}catch(e){}};
const toSess=j=>({access_token:j.access_token,refresh_token:j.refresh_token,expires_at:j.expires_at||Math.floor(Date.now()/1000)+(j.expires_in||3600),email:(j.user||{}).email||(session||{}).email});
async function authCall(path,body,method="POST",tok){
  const r=await fetch(URL_+"/auth/v1/"+path,{method,headers:{apikey:KEY,"Content-Type":"application/json",...(tok?{Authorization:"Bearer "+tok}:{})},body:body?JSON.stringify(body):undefined});
  const j=await r.json().catch(()=>({}));if(!r.ok){const e=new Error(j.msg||j.error_description||j.message||"Erro de autenticação");e.code=r.status;throw e}return j;
}
let refreshing=null;
async function refreshTok(){
  if(!session)throw new Error("Sessão expirada");
  refreshing=refreshing||authCall("token?grant_type=refresh_token",{refresh_token:session.refresh_token}).then(j=>{saveSess(toSess({...j,user:j.user||{email:session.email}}))}).catch(e=>{saveSess(null);throw e}).finally(()=>refreshing=null);
  return refreshing;
}
async function token(){if(!session)throw new Error("Sessão expirada");if(session.expires_at*1000-Date.now()<60000)await refreshTok();return session.access_token}
async function rest(path,{method="GET",body,headers={},count}={}){
  for(let tr=0;tr<2;tr++){
    const t=await token();
    const r=await fetch(URL_+"/rest/v1/"+path,{method,headers:{apikey:KEY,Authorization:"Bearer "+t,"Content-Type":"application/json",...headers},body:body===undefined?undefined:JSON.stringify(body)});
    if(r.status===401&&tr===0){try{await refreshTok();continue}catch(e){go();throw e}}
    const txt=await r.text();let j=null;try{j=txt?JSON.parse(txt):null}catch(e){}
    if(!r.ok){const e=new Error(friendly((j&&j.message)||"Erro ao falar com o servidor"));e.code=r.status;throw e}
    return count?{data:j,total:+((r.headers.get("content-range")||"").split("/")[1])||0}:j;
  }
}
const rpc=(n,a={})=>rest("rpc/"+n,{method:"POST",body:a});
const friendly=m=>/duplicate key.*sku|products_sku/i.test(m)?"Já existe um produto com este SKU":/categories_slug/i.test(m)?"Já existe uma categoria com este nome":/colors_name/i.test(m)?"Já existe uma cor com este nome":/violates foreign key.*color/i.test(m)?"Esta cor está em uso por alguma variação":m.replace(/^ESTOQUE:\s*/,"");
async function uploadImage(file,folder){
  if(!/^image\/(jpeg|png|webp)$/.test(file.type))throw new Error("Use imagens JPG, PNG ou WEBP");
  if(file.size>25e6)throw new Error("Imagem muito grande (máx. 25 MB)");
  const bmp=await createImageBitmap(file),max=1600,k=Math.min(1,max/Math.max(bmp.width,bmp.height));
  const cv=document.createElement("canvas");cv.width=Math.round(bmp.width*k);cv.height=Math.round(bmp.height*k);
  const cx=cv.getContext("2d");cx.fillStyle="#fff";cx.fillRect(0,0,cv.width,cv.height);cx.drawImage(bmp,0,0,cv.width,cv.height);
  const blob=await new Promise(r=>cv.toBlob(r,"image/jpeg",.86));
  if(!blob||blob.size>5e6)throw new Error("Não foi possível reduzir a imagem para 5 MB");
  const path=`${folder}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.jpg`;
  const t=await token();
  const r=await fetch(`${URL_}/storage/v1/object/media/${path}`,{method:"POST",headers:{apikey:KEY,Authorization:"Bearer "+t,"Content-Type":"image/jpeg","x-upsert":"false"},body:blob});
  if(!r.ok){const j=await r.json().catch(()=>({}));throw new Error("Falha no envio da imagem: "+(j.message||r.status))}
  return{url:`${URL_}/storage/v1/object/public/media/${path}`,path};
}
async function listLibrary(){
  const t=await token(),out=[];
  for(const f of["products","site","categories"]){
    try{const r=await fetch(`${URL_}/storage/v1/object/list/media`,{method:"POST",headers:{apikey:KEY,Authorization:"Bearer "+t,"Content-Type":"application/json"},body:JSON.stringify({prefix:f,limit:100,sortBy:{column:"created_at",order:"desc"}})});
      if(r.ok)(await r.json()).filter(o=>o.name&&o.id).forEach(o=>out.push({url:`${URL_}/storage/v1/object/public/media/${f}/${o.name}`,path:`${f}/${o.name}`}))}catch(e){}
  }
  return[...SEED_IMGS.map(u=>({url:u})),...out];
}

/* ---------- UI helpers ---------- */
function toast(m,type){const d=document.createElement("div");d.className="toast "+(type||"");d.textContent=m;$("#toasts").appendChild(d);setTimeout(()=>d.remove(),type==="bad"?7000:3500)}
function modal({title,body,foot="",wide=false,onClose}){
  const ov=document.createElement("div");ov.className="ov";
  ov.innerHTML=`<div class="mdl${wide?" wide":""}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="mh"><h2>${esc(title)}</h2><button class="x" aria-label="Fechar" data-x>×</button></div><div class="mb">${body}</div>${foot?`<div class="mf">${foot}</div>`:""}</div>`;
  const close=()=>{ov.remove();document.removeEventListener("keydown",esk);onClose&&onClose()};
  const esk=e=>{if(e.key==="Escape"&&ov===[...document.querySelectorAll(".ov")].pop())close()};
  document.addEventListener("keydown",esk);
  ov.addEventListener("mousedown",e=>{if(e.target===ov&&!ov.dataset.sticky)close()});
  ov.addEventListener("click",e=>{if(e.target.closest("[data-x]"))close()});
  document.body.appendChild(ov);const f=$("input,select,textarea",ov);f&&f.focus&&setTimeout(()=>f.focus(),30);
  return{ov,close,$:s=>$(s,ov),$$:s=>$$(s,ov)};
}
function confirmBox(title,msg,ok="Confirmar",danger=false){
  return new Promise(res=>{const m=modal({title,body:`<p style="margin:0">${msg}</p>`,foot:`<button class="btn line" data-no>Cancelar</button><button class="btn${danger?" danger":""}" data-ok>${esc(ok)}</button>`,onClose:()=>res(false)});
    m.ov.addEventListener("click",e=>{if(e.target.closest("[data-ok]")){res(true);m.ov.remove()}else if(e.target.closest("[data-no]")){m.close()}})});
}
async function busy(btn,fn){if(btn.getAttribute("aria-busy"))return;btn.setAttribute("aria-busy","true");try{return await fn()}catch(e){toast(e.message||"Erro","bad")}finally{btn.removeAttribute("aria-busy")}}
const icon=p=>`<svg viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
const ICONS={dash:icon('<path d="M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z"/>'),prod:icon('<path d="M20 7l-8-4-8 4 8 4 8-4zM4 7v10l8 4 8-4V7M12 11v10"/>'),cat:icon('<path d="M4 6h16M4 12h16M4 18h10"/>'),est:icon('<path d="M3 7h18v13H3zM8 7V4h8v3M9 12h6"/>'),ped:icon('<path d="M6 2l-2 4v14h16V6l-2-4zM4 6h16M9 10a3 3 0 006 0"/>'),loja:icon('<path d="M3 9l1-5h16l1 5M3 9a3 3 0 006 0 3 3 0 006 0 3 3 0 006 0M5 21V12M19 21V12M3 21h18"/>')};
const NAV=[["dashboard","Dashboard","dash"],["produtos","Produtos","prod"],["categorias","Categorias","cat"],["estoque","Estoque","est"],["pedidos","Pedidos","ped"],["loja","Personalizar loja","loja"]];

/* ---------- estado ---------- */
const S={products:[],colors:[],cats:[],settings:{},pendingOrders:0};
async function loadBase(force){
  if(S.loaded&&!force)return;
  const [cats,colors,sets]=await Promise.all([rest("categories?select=*&order=position.asc"),rest("colors?select=*&order=position.asc"),rest("settings?select=key,value")]);
  S.cats=cats;S.colors=colors;S.settings=Object.fromEntries(sets.map(x=>[x.key,x.value]));S.loaded=true;
}
const sizesList=()=>Array.isArray(S.settings.sizes)&&S.settings.sizes.length?S.settings.sizes:["PP","P","M","G","GG"];
const lowTh=()=>{const n=+S.settings.low_stock_threshold;return isFinite(n)?n:3};
async function loadProducts(){
  S.products=await rest("products?select=id,name,sku,description,price,promo_price,old_price,active,is_new,is_featured,is_promo,track_stock,category_id,created_at,product_images(url,path,position,is_main),product_variants(id,size,stock,active,color_id)&order=created_at.desc,id.desc");
  S.products.forEach(p=>{p.product_images.sort((a,b)=>a.position-b.position)});
}
const totalStock=p=>p.product_variants.filter(v=>v.active).reduce((a,v)=>a+v.stock,0);
const stockState=p=>{if(!p.track_stock)return"free";const v=p.product_variants.filter(v=>v.active);if(!v.length)return"none";if(v.every(x=>x.stock===0))return"out";if(v.some(x=>x.stock<=lowTh()))return"low";return"ok"};
const catName=id=>(S.cats.find(c=>c.id===id)||{}).name||"Sem categoria";
const colorName=id=>(S.colors.find(c=>c.id===id)||{}).name||"?";
async function refreshPending(){try{const r=await rest("orders?select=id&status=eq.aguardando&limit=1",{count:true,headers:{Prefer:"count=exact"}});S.pendingOrders=r.total;const c=$("#pendCnt");if(c){c.hidden=!S.pendingOrders;c.textContent=S.pendingOrders}}catch(e){}}

/* ---------- login ---------- */
const app=$("#app");
function viewLogin(msg){
  app.innerHTML=`<div class="login"><form class="box" id="lf" novalidate><img src="../assets/img/logoD.png" alt="Life Activewear"><h1>Painel da loja</h1><p class="sub">Entre com o e-mail e a senha do administrador.</p>
  <div class="fld"><label for="em">E-mail</label><input class="in" id="em" type="email" autocomplete="username" required></div>
  <div class="fld"><label for="pw">Senha</label><input class="in" id="pw" type="password" autocomplete="current-password" required></div>
  <p class="err" id="le" role="alert">${esc(msg||"")}</p><button class="btn" style="width:100%" id="lb">Entrar</button>
  <p style="text-align:center;margin:16px 0 0"><button type="button" class="link" id="fg">Esqueci minha senha</button></p></form></div>`;
  $("#lf").onsubmit=async e=>{e.preventDefault();const b=$("#lb");$("#le").textContent="";
    const email=$("#em").value.trim(),pw=$("#pw").value;if(!email||!pw){$("#le").textContent="Informe e-mail e senha.";return}
    b.setAttribute("aria-busy","true");
    try{const j=await authCall("token?grant_type=password",{email,password:pw});saveSess(toSess(j));
      const ok=await rpc("is_admin");if(ok!==true){saveSess(null);throw new Error("Esta conta não tem acesso ao painel.")}
      go()}
    catch(er){$("#le").textContent=/Invalid login/i.test(er.message)?"E-mail ou senha incorretos.":er.message}finally{b.removeAttribute("aria-busy")}};
  $("#fg").onclick=async()=>{const email=$("#em").value.trim();if(!email){$("#le").textContent="Digite seu e-mail e toque em “Esqueci minha senha”.";return}
    try{await authCall("recover",{email});$("#le").style.color="var(--ok)";$("#le").textContent="Se o e-mail estiver cadastrado, enviamos um link para redefinir a senha."}catch(er){$("#le").textContent=er.message}};
}
function viewNewPassword(tok){
  app.innerHTML=`<div class="login"><form class="box" id="nf"><img src="../assets/img/logoD.png" alt="Life Activewear"><h1>Nova senha</h1><p class="sub">Defina uma nova senha (mínimo 8 caracteres).</p>
  <div class="fld"><label for="n1">Nova senha</label><input class="in" id="n1" type="password" autocomplete="new-password" minlength="8"></div><p class="err" id="le"></p><button class="btn" style="width:100%">Salvar senha</button></form></div>`;
  $("#nf").onsubmit=async e=>{e.preventDefault();const p=$("#n1").value;if(p.length<8){$("#le").textContent="Use pelo menos 8 caracteres.";return}
    try{await authCall("user",{password:p},"PUT",tok);history.replaceState(null,"",location.pathname+"#/dashboard");toast("Senha alterada","ok");go()}catch(er){$("#le").textContent=er.message}};
}
function logout(){const t=session&&session.access_token;saveSess(null);S.loaded=false;if(t)fetch(URL_+"/auth/v1/logout",{method:"POST",headers:{apikey:KEY,Authorization:"Bearer "+t}}).catch(()=>{});viewLogin()}

/* ---------- shell ---------- */
async function go(){
  const hs=new URLSearchParams(location.hash.replace(/^#/,""));
  if(hs.get("type")==="recovery"&&hs.get("access_token")){const t=hs.get("access_token");saveSess({access_token:t,refresh_token:hs.get("refresh_token")||"",expires_at:Math.floor(Date.now()/1000)+(+hs.get("expires_in")||3600)});viewNewPassword(t);return}
  if(!session){viewLogin();return}
  try{if(await rpc("is_admin")!==true){saveSess(null);viewLogin("Esta conta não tem acesso ao painel.");return}}catch(e){saveSess(null);viewLogin("Sessão expirada. Entre novamente.");return}
  const v=(location.hash.match(/^#\/(\w+)/)||[])[1]||"dashboard";
  if(!$(".shell")){
    app.innerHTML=`<div class="mbar"><button id="bg" aria-label="Menu"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button><img src="../assets/img/logoW.png" alt="Life"><span style="width:34px"></span></div>
    <div class="shell"><aside class="side" id="side"><div class="brand"><img src="../assets/img/logoW.png" alt="Life Activewear"><small>Painel da loja</small></div>
    <nav>${NAV.map(n=>`<a href="#/${n[0]}" data-v="${n[0]}">${ICONS[n[2]]}${n[1]}${n[0]==="pedidos"?`<span class="cnt" id="pendCnt" hidden></span>`:""}</a>`).join("")}</nav>
    <div class="foot"><span class="em" title="${esc(session.email||"")}">${esc(session.email||"")}</span><a href="../" target="_blank" rel="noopener">Ver a loja ↗</a><button id="cpw">Alterar senha</button><button id="out">Sair</button></div></aside>
    <main class="main" id="main"></main></div>`;
    $("#bg").onclick=()=>{$("#side").classList.toggle("open");$$(".veil").forEach(x=>x.remove());if($("#side").classList.contains("open")){const d=document.createElement("div");d.className="veil";d.onclick=()=>{$("#side").classList.remove("open");d.remove()};document.body.appendChild(d)}};
    $("#out").onclick=logout;$("#cpw").onclick=pwModal;
    $("#side").addEventListener("click",e=>{if(e.target.closest("a[data-v]")){$("#side").classList.remove("open");$$(".veil").forEach(x=>x.remove())}});
  }
  $$("#side nav a").forEach(a=>a.classList.toggle("on",a.dataset.v===v));
  const old=$("#main"),m=old.cloneNode(false);old.replaceWith(m);m.innerHTML=`<div class="loading"><span class="spin"></span></div>`;
  try{await loadBase();const f=VIEWS[v]||VIEWS.dashboard;await f(m);refreshPending()}
  catch(e){if(/Sessão expirada/.test(e.message)){viewLogin("Sessão expirada. Entre novamente.");return}m.innerHTML=`<div class="card"><p class="err">${esc(e.message)}</p><button class="btn" onclick="location.reload()">Tentar de novo</button></div>`}
}
addEventListener("hashchange",()=>{if(session)go()});
function pwModal(){
  const m=modal({title:"Alterar senha",body:`<div class="fld"><label>Nova senha</label><input class="in" id="np" type="password" minlength="8" autocomplete="new-password"><span class="hint">Mínimo 8 caracteres.</span></div>`,foot:`<button class="btn line" data-x>Cancelar</button><button class="btn" id="sv">Salvar</button>`});
  m.$("#sv").onclick=e=>busy(e.target,async()=>{const p=m.$("#np").value;if(p.length<8)throw new Error("Use pelo menos 8 caracteres");await authCall("user",{password:p},"PUT",await token());toast("Senha alterada","ok");m.close()});
}
const head=(t,sub,acts="")=>`<div class="top"><div><span class="eyebrow">${esc(sub)}</span><h1>${esc(t)}</h1></div><div class="acts">${acts}</div></div>`;

/* ---------- Dashboard ---------- */
async function viewDash(m){
  const d=await rpc("admin_dashboard");const sales=d.sales,low=d.low_stock,ord=d.orders;
  const bs=ord.by_status||{};const maxS=Math.max(1,...Object.values(bs));
  const daily=d.daily||[],maxD=Math.max(1,...daily.map(x=>+x.revenue));
  m.innerHTML=head("Dashboard","Visão geral",`<button class="btn line" id="rf">Atualizar</button>`)+`
  <div class="kpis">
   <div class="kpi"><div class="l">Produtos cadastrados</div><div class="v">${d.products.total}</div><div class="s">${d.products.active} ativos · ${d.products.inactive} inativos</div></div>
   <div class="kpi${low.products||low.out?" alert":""}"><div class="l">Estoque baixo</div><div class="v">${low.products}</div><div class="s">${low.out} variação(ões) esgotada(s) · alerta em ≤ ${low.threshold}</div></div>
   <div class="kpi"><div class="l">Pedidos registrados</div><div class="v">${ord.total}</div><div class="s">${bs.aguardando||0} aguardando atendimento</div></div>
   <div class="kpi"><div class="l">Faturamento confirmado</div><div class="v">${brl(sales.revenue)}</div><div class="s">${sales.orders} venda(s) · ticket médio ${brl(sales.avg_ticket)}</div></div></div>
  <p class="note info">Pedidos enviados ao WhatsApp só viram <b>venda</b> (e baixam o estoque) quando você muda o status para <b>Confirmado</b> em Pedidos.</p>
  <div class="grid2"><div>
   <div class="card"><div class="ch"><div><h2>Faturamento confirmado — 30 dias</h2><p>${sales.orders?"Pelo dia da confirmação.":"Ainda não há vendas confirmadas."}</p></div></div>
    <div class="bars" role="img" aria-label="Faturamento diário dos últimos 30 dias">${daily.map(x=>`<div class="b${+x.revenue?"":" z"}" tabindex="0" style="height:${Math.max(2,Math.round(+x.revenue/maxD*100))}%"><span class="tip">${x.day.slice(8)}/${x.day.slice(5,7)} · ${brl(x.revenue)} · ${x.orders} venda(s)</span></div>`).join("")}</div>
    <div class="axis"><span>${daily.length?daily[0].day.slice(8)+"/"+daily[0].day.slice(5,7):""}</span><span>hoje</span></div></div>
   <div class="card"><div class="ch"><h2>Produtos mais vendidos</h2></div>${(d.top||[]).length?`<table class="t cards"><thead><tr><th>Produto</th><th class="r">Unidades</th><th class="r">Receita</th></tr></thead><tbody>${d.top.map(t=>`<tr><td data-l="Produto" class="nm">${esc(t.name)}</td><td data-l="Unidades" class="r">${t.units}</td><td data-l="Receita" class="r">${brl(t.revenue)}</td></tr>`).join("")}</tbody></table>`:`<p class="empty">Os mais vendidos aparecem aqui após as primeiras vendas confirmadas.</p>`}</div>
  </div><div>
   <div class="card"><div class="ch"><h2>Pedidos por status</h2><a class="link" href="#/pedidos">Ver pedidos</a></div>${Object.keys(ST).map(k=>`<div class="hbar"><span>${ST[k][0]}</span><div class="tr"><i style="width:${(bs[k]||0)/maxS*100}%"></i></div><b>${bs[k]||0}</b></div>`).join("")}</div>
   <div class="card"><div class="ch"><h2>Alertas de estoque</h2><a class="link" href="#/estoque">Abrir estoque</a></div>${(low.items||[]).length?`<table class="t"><tbody>${low.items.map(i=>`<tr><td class="nm">${esc(i.name)}<div class="sku">${esc(i.color)} · ${esc(i.size)}</div></td><td class="r">${i.stock===0?`<span class="badge bad">Esgotado</span>`:`<span class="badge warn">${i.stock} un.</span>`}</td></tr>`).join("")}</tbody></table>`:`<p class="empty">Nenhum alerta. Estoque em dia.</p>`}</div>
  </div></div>`;
  $("#rf").onclick=()=>go();
}

/* ---------- campo de imagem ---------- */
function imgField(name,val,folder="site"){return `<div class="imgf" data-imgf="${esc(name)}" data-folder="${folder}"><img class="pv" src="${esc(imgSrc(val))}" alt="" ${val?"":"hidden"}><div class="ab"><input type="hidden" data-val value="${esc(val||"")}"><label class="btn line sm" style="cursor:pointer">Enviar imagem<input type="file" accept="image/jpeg,image/png,image/webp" hidden data-file></label><button type="button" class="btn line sm" data-gal>Escolher da galeria</button><span class="hint" data-st></span></div></div>`}
function bindImgFields(root){
  root.addEventListener("change",async e=>{const f=e.target.closest("[data-file]");if(!f||!f.files[0])return;const w=f.closest("[data-imgf]");const st=$("[data-st]",w);st.innerHTML=`<span class="spin"></span> Enviando…`;
    try{const r=await uploadImage(f.files[0],w.dataset.folder);setImgVal(w,r.url);st.textContent="Imagem enviada."}catch(er){st.textContent="";toast(er.message,"bad")}f.value=""});
  root.addEventListener("click",async e=>{const g=e.target.closest("[data-gal]");if(!g)return;const w=g.closest("[data-imgf]");const pick=await galleryPick();if(pick)setImgVal(w,pick.url)});
}
function setImgVal(w,url){$("[data-val]",w).value=url;const p=$(".pv",w);p.src=imgSrc(url);p.hidden=false}
const getImgVal=(root,name)=>($(`[data-imgf="${name}"] [data-val]`,root)||{}).value||"";
function galleryPick(){
  return new Promise(async res=>{let done=false;const m=modal({title:"Galeria de imagens",wide:true,body:`<div class="loading"><span class="spin"></span></div>`,onClose:()=>{if(!done)res(null)}});
    try{const lib=await listLibrary();m.$(".mb").innerHTML=`<div class="gal">${lib.map((l,i)=>`<button type="button" data-i="${i}"><img src="${esc(imgSrc(l.url))}" alt="" loading="lazy"></button>`).join("")}</div>`;
      m.ov.addEventListener("click",e=>{const b=e.target.closest("[data-i]");if(b){done=true;res(lib[+b.dataset.i]);m.ov.remove()}})}catch(e){m.$(".mb").innerHTML=`<p class="err">${esc(e.message)}</p>`}});
}

/* ---------- Produtos ---------- */
const PF={q:"",cat:"",status:"",tag:""};
async function viewProducts(m){
  await loadProducts();
  const draw=()=>{
    let l=S.products.filter(p=>(!PF.q||(p.name+" "+p.sku).toLowerCase().includes(PF.q))&&(!PF.cat||(PF.cat==="none"?!p.category_id:p.category_id===PF.cat))&&(!PF.status||(PF.status==="active"?p.active:PF.status==="inactive"?!p.active:PF.status==="low"?stockState(p)==="low":stockState(p)==="out"))&&(!PF.tag||(PF.tag==="new"?p.is_new:PF.tag==="feat"?p.is_featured:p.is_promo||p.promo_price!=null)));
    $("#plist").innerHTML=l.length?`<table class="t cards"><thead><tr><th></th><th>Produto</th><th>Categoria</th><th class="r">Preço</th><th class="r">Estoque</th><th>Etiquetas</th><th>Ativo</th><th></th></tr></thead><tbody>${l.map(p=>{const im=p.product_images.find(i=>i.is_main)||p.product_images[0],ss=stockState(p),sale=p.promo_price??p.price;
      return `<tr><td class="noL"><img class="thumb" src="${esc(imgSrc(im&&im.url))}" alt=""></td><td data-l="Produto"><div class="nm">${esc(p.name)}</div><div class="sku">${esc(p.sku)}</div></td><td data-l="Categoria">${esc(catName(p.category_id))}</td>
      <td data-l="Preço" class="r">${brl(sale)}${p.promo_price!=null||p.old_price?`<div class="sku"><s>${brl(p.promo_price!=null?p.price:p.old_price)}</s></div>`:""}</td>
      <td data-l="Estoque" class="r">${p.track_stock?totalStock(p):"—"} ${ss==="out"?`<span class="badge bad">Esgotado</span>`:ss==="low"?`<span class="badge warn">Baixo</span>`:ss==="none"?`<span class="badge">Sem variações</span>`:""}</td>
      <td data-l="Etiquetas">${p.is_new?`<span class="badge">Novo</span> `:""}${p.is_featured?`<span class="badge">Destaque</span> `:""}${p.is_promo||p.promo_price!=null?`<span class="badge">Promoção</span>`:""}</td>
      <td data-l="Ativo"><label class="switch" title="${p.active?"Desativar":"Ativar"}"><input type="checkbox" data-tg="${p.id}" ${p.active?"checked":""} aria-label="Ativo"><i></i></label></td>
      <td class="noL" style="white-space:nowrap"><button class="btn line sm" data-ed="${p.id}">Editar</button> <button class="btn line sm" data-dup="${p.id}" title="Duplicar">Duplicar</button> <button class="btn danger sm" data-del="${p.id}">Excluir</button></td></tr>`}).join("")}</tbody></table>`:`<p class="empty">${S.products.length?"Nenhum produto com esses filtros.":"Nenhum produto cadastrado ainda."}</p>`;
  };
  m.innerHTML=head("Produtos","Catálogo",`<button class="btn" id="np">+ Novo produto</button>`)+`<div class="card"><div class="tools"><input class="in grow" id="pq" type="search" placeholder="Buscar por nome ou SKU…" value="${esc(PF.q)}" aria-label="Buscar">
   <select class="in" id="pc" aria-label="Categoria"><option value="">Todas as categorias</option>${S.cats.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("")}<option value="none">Sem categoria</option></select>
   <select class="in" id="ps" aria-label="Status"><option value="">Todos os status</option><option value="active">Ativos</option><option value="inactive">Inativos</option><option value="low">Estoque baixo</option><option value="out">Esgotados</option></select>
   <select class="in" id="pt" aria-label="Etiqueta"><option value="">Todas as etiquetas</option><option value="new">Novo</option><option value="feat">Destaque</option><option value="promo">Promoção</option></select></div><div class="tw" id="plist"></div></div>`;
  $("#pc").value=PF.cat;$("#ps").value=PF.status;$("#pt").value=PF.tag;
  $("#pq").oninput=e=>{PF.q=e.target.value.toLowerCase().trim();draw()};$("#pc").onchange=e=>{PF.cat=e.target.value;draw()};$("#ps").onchange=e=>{PF.status=e.target.value;draw()};$("#pt").onchange=e=>{PF.tag=e.target.value;draw()};
  $("#np").onclick=()=>openEditor(null);
  m.onclick=async e=>{
    const ed=e.target.closest("[data-ed]"),dp=e.target.closest("[data-dup]"),dl=e.target.closest("[data-del]");
    if(ed)openEditor(S.products.find(p=>p.id==ed.dataset.ed));
    else if(dp)openEditor(S.products.find(p=>p.id==dp.dataset.dup),true);
    else if(dl){const p=S.products.find(x=>x.id==dl.dataset.del);if(await confirmBox("Excluir produto",`Excluir <b>${esc(p.name)}</b> definitivamente? Pedidos antigos continuam guardando o nome da peça. Para só esconder da loja, use “Desativar”.`,"Excluir",true))
      busy(dl,async()=>{await rest("products?id=eq."+p.id,{method:"DELETE"});toast("Produto excluído","ok");await loadProducts();draw()})}};
  m.onchange=e=>{const t=e.target.closest("[data-tg]");if(!t)return;const p=S.products.find(x=>x.id==t.dataset.tg),on=t.checked;
    if(on&&!p.product_variants.some(v=>v.active)){t.checked=false;toast("Adicione variações (cor e tamanho) antes de ativar.","bad");return}
    rest("products?id=eq."+p.id,{method:"PATCH",body:{active:on}}).then(()=>{p.active=on;toast(on?"Produto ativado — visível na loja":"Produto desativado — oculto na loja","ok")}).catch(er=>{t.checked=!on;toast(er.message,"bad")})};
  draw();
}

function tagOf(p){const sale=p.promo_price!=null?+p.promo_price:+p.price,old=p.promo_price!=null?+p.price:(+p.old_price||0),disc=old>sale?Math.round((1-sale/old)*100):0;return p.is_promo?(disc?`-${disc}%`:"Promoção"):p.is_new?"Novo":p.is_featured?"Destaque":(disc?`-${disc}%`:"")}
function openEditor(src,dup){
  const isNew=!src||dup;
  const ed={id:isNew?null:src.id,images:src?src.product_images.map(i=>({url:i.url,path:i.path||null})):[],vmap:{},colors:new Set(),sizes:[]};
  if(src)src.product_variants.forEach(v=>{ed.vmap[v.color_id+"|"+v.size]={id:dup?null:v.id,stock:v.stock,active:v.active};ed.colors.add(v.color_id);if(!ed.sizes.includes(v.size))ed.sizes.push(v.size)});
  const P=src||{name:"",sku:"",description:"",category_id:"",price:"",promo_price:null,old_price:null,active:false,is_new:true,is_featured:false,is_promo:false,track_stock:true};
  const allSizes=()=>[...new Set([...sizesList(),...ed.sizes])];
  const mdl=modal({title:isNew?(dup?"Duplicar produto":"Novo produto"):"Editar produto",wide:true,body:`
  <div class="sec"><h3>Informações</h3><div class="row c2"><div class="fld"><label for="f_name">Nome *</label><input class="in" id="f_name" maxlength="120" value="${esc(dup?P.name+" (cópia)":P.name)}"></div>
   <div class="fld"><label for="f_sku">Código / SKU *</label><input class="in" id="f_sku" maxlength="40" value="${esc(dup?P.sku+"-COPIA":P.sku)}"><span class="hint">Letras, números, ponto, hífen ou underline.</span></div></div>
   <div class="row c2"><div class="fld"><label for="f_cat">Categoria</label><select class="in" id="f_cat"><option value="">Sem categoria</option>${S.cats.map(c=>`<option value="${c.id}" ${c.id===P.category_id?"selected":""}>${esc(c.name)}${c.active?"":" (oculta)"}</option>`).join("")}</select></div><div></div></div>
   <div class="fld"><label for="f_desc">Descrição</label><textarea class="in" id="f_desc" maxlength="2000">${esc(P.description)}</textarea></div></div>
  <div class="sec"><h3>Preços</h3><div class="row c3"><div class="fld"><label for="f_price">Preço (R$) *</label><input class="in" id="f_price" inputmode="decimal" value="${esc(money(P.price))}"></div>
   <div class="fld"><label for="f_promo">Preço promocional (R$)</label><input class="in" id="f_promo" inputmode="decimal" value="${esc(money(P.promo_price))}"><span class="hint">Se preenchido, é o preço de venda e o normal aparece riscado.</span></div>
   <div class="fld"><label for="f_old">Preço anterior (R$)</label><input class="in" id="f_old" inputmode="decimal" value="${esc(money(P.old_price))}"><span class="hint">Aparece riscado se não houver preço promocional.</span></div></div></div>
  <div class="sec"><h3>Etiquetas e status</h3><div style="display:flex;gap:22px;flex-wrap:wrap"><label class="chk"><input type="checkbox" id="f_new" ${P.is_new?"checked":""}> Novo</label><label class="chk"><input type="checkbox" id="f_feat" ${P.is_featured?"checked":""}> Destaque</label><label class="chk"><input type="checkbox" id="f_isp" ${P.is_promo?"checked":""}> Promoção</label><label class="chk"><input type="checkbox" id="f_active" ${P.active&&!dup?"checked":""}> Ativo (visível na loja)</label></div></div>
  <div class="sec"><h3>Fotos</h3><p class="hint" style="margin:0 0 12px">A primeira foto é a principal. JPG, PNG ou WEBP (reduzidas automaticamente).</p><div class="photos" id="photos"></div></div>
  <div class="sec"><h3>Cores, tamanhos e estoque</h3><label class="chk" style="margin-bottom:14px"><input type="checkbox" id="f_track" ${P.track_stock?"checked":""}> Controlar estoque deste produto</label>
   <div class="fld"><span class="lbl">Cores</span><div class="chips" id="cchips"></div></div>
   <div class="fld"><span class="lbl">Tamanhos</span><div class="chips" id="schips"></div><div style="display:flex;gap:8px;margin-top:6px"><input class="in" id="newsz" maxlength="10" placeholder="Outro tamanho" style="max-width:160px"><button type="button" class="btn line sm" id="addsz">Adicionar</button></div></div>
   <div id="matrix"></div></div>`,
  foot:`<span class="hint" style="margin-right:auto" id="edmsg"></span><button class="btn line" data-x>Cancelar</button><button class="btn line" id="prev">Pré-visualizar</button><button class="btn" id="save">Salvar produto</button>`});
  mdl.ov.dataset.sticky="1";
  const photos=()=>{mdl.$("#photos").innerHTML=ed.images.map((im,i)=>`<div class="ph${i?"":" main"}"><img src="${esc(imgSrc(im.url))}" alt=""><div class="tg">${i?"&nbsp;":"Principal"}</div><div class="bt"><button type="button" data-pi="${i}" data-a="L" title="Mover para trás" ${i?"":"disabled"}>←</button>${i?`<button type="button" data-pi="${i}" data-a="M" title="Tornar principal">★</button>`:""}<button type="button" data-pi="${i}" data-a="R" title="Mover para frente" ${i<ed.images.length-1?"":"disabled"}>→</button><button type="button" data-pi="${i}" data-a="X" title="Remover">✕</button></div></div>`).join("")+
    (ed.images.length<12?`<label class="addph">+ Enviar fotos<input type="file" id="ufile" accept="image/jpeg,image/png,image/webp" multiple hidden></label><button type="button" class="addph" id="ugal" style="border:1px dashed #aaa">Da galeria</button>`:"")};
  const chips=()=>{
    mdl.$("#cchips").innerHTML=S.colors.map(c=>`<button type="button" class="chip${ed.colors.has(c.id)?" on":""}" data-c="${c.id}"><span class="sw" style="background:linear-gradient(135deg,${c.hex1},${c.hex2})"></span>${esc(c.name)}</button>`).join("")||`<span class="hint">Cadastre cores em Categorias → Cores.</span>`;
    mdl.$("#schips").innerHTML=allSizes().map(s=>`<button type="button" class="chip${ed.sizes.includes(s)?" on":""}" data-s="${esc(s)}">${esc(s)}</button>`).join("");
  };
  const matrix=()=>{
    const cs=S.colors.filter(c=>ed.colors.has(c.id)),ss=allSizes().filter(s=>ed.sizes.includes(s)),track=mdl.$("#f_track").checked;
    if(!cs.length||!ss.length){mdl.$("#matrix").innerHTML=`<p class="hint">Escolha ao menos uma cor e um tamanho para montar as variações.</p>`;return}
    mdl.$("#matrix").innerHTML=(track?"":`<p class="note">Estoque sem controle: as quantidades abaixo são ignoradas e a peça fica sempre disponível.</p>`)+`<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap"><span class="hint">Aplicar a todas:</span><input class="in" id="fillq" type="number" min="0" style="width:90px" placeholder="Qtd"><button type="button" class="btn line sm" id="fillb">Aplicar</button></div>
    <div class="matrix"><table><thead><tr><th>Cor \\ Tam.</th>${ss.map(s=>`<th>${esc(s)}</th>`).join("")}</tr></thead><tbody>${cs.map(c=>`<tr><td class="cn"><span class="sw" style="background:linear-gradient(135deg,${c.hex1},${c.hex2})"></span>${esc(c.name)}</td>${ss.map(s=>{const k=c.id+"|"+s,v=ed.vmap[k]||(ed.vmap[k]={id:null,stock:0,active:true});return `<td class="${v.active?"":"off"}"><input type="number" min="0" max="999999" step="1" data-k="${k}" value="${v.stock}" aria-label="Estoque ${esc(c.name)} ${esc(s)}"><label><input type="checkbox" data-ka="${k}" ${v.active?"checked":""}> ativa</label></td>`}).join("")}</tr>`).join("")}</tbody></table></div>`;
  };
  photos();chips();matrix();
  mdl.ov.addEventListener("click",async e=>{
    const pb=e.target.closest("[data-pi]");if(pb){const i=+pb.dataset.pi,a=pb.dataset.a,im=ed.images;if(a==="X")im.splice(i,1);else if(a==="M")im.unshift(im.splice(i,1)[0]);else{const j=a==="L"?i-1:i+1;[im[i],im[j]]=[im[j],im[i]]}photos();return}
    const c=e.target.closest("[data-c]");if(c){const id=c.dataset.c;if(ed.colors.has(id)){ed.colors.delete(id);Object.keys(ed.vmap).filter(k=>k.startsWith(id+"|")).forEach(k=>delete ed.vmap[k])}else ed.colors.add(id);chips();matrix();return}
    const s=e.target.closest("[data-s]");if(s){const z=s.dataset.s;if(ed.sizes.includes(z)){ed.sizes=ed.sizes.filter(x=>x!==z);Object.keys(ed.vmap).filter(k=>k.endsWith("|"+z)).forEach(k=>delete ed.vmap[k])}else ed.sizes.push(z);chips();matrix();return}
    if(e.target.id==="addsz"){const z=mdl.$("#newsz").value.trim().toUpperCase();if(z&&z.length<=10){if(!ed.sizes.includes(z))ed.sizes.push(z);mdl.$("#newsz").value="";chips();matrix()}return}
    if(e.target.id==="fillb"){const q=parseInt(mdl.$("#fillq").value);if(q>=0)Object.values(ed.vmap).forEach(v=>v.stock=q);matrix();return}
    if(e.target.id==="ugal"){const p=await galleryPick();if(p){ed.images.push({url:p.url,path:p.path||null});photos()}return}
    if(e.target.id==="prev")preview(collect(false));
    if(e.target.id==="save")busy(e.target,async()=>{const body=collect(true);const id=await rpc("admin_save_product",{p:body});toast("Produto salvo","ok");mdl.ov.remove();await loadProducts();if(location.hash.startsWith("#/produtos"))viewProducts($("#main"));return id});
  });
  mdl.ov.addEventListener("input",e=>{const k=e.target.dataset.k;if(k&&ed.vmap[k])ed.vmap[k].stock=Math.max(0,parseInt(e.target.value)||0)});
  mdl.ov.addEventListener("change",async e=>{
    const ka=e.target.dataset.ka;if(ka){ed.vmap[ka].active=e.target.checked;e.target.closest("td").classList.toggle("off",!e.target.checked);return}
    if(e.target.id==="f_track")matrix();
    if(e.target.id==="ufile"){const fs=[...e.target.files];const msg=mdl.$("#edmsg");let n=0;for(const f of fs){msg.innerHTML=`<span class="spin"></span> Enviando ${++n}/${fs.length}…`;try{const r=await uploadImage(f,"products");ed.images.push(r);photos()}catch(er){toast(er.message,"bad")}}msg.textContent=""}});
  function collect(strict){
    const v=id=>mdl.$("#"+id).value.trim(),price=num(v("f_price")),promo=num(v("f_promo")),old=num(v("f_old"));
    if(strict){if(!v("f_name"))throw new Error("Informe o nome do produto");if(!v("f_sku"))throw new Error("Informe o código/SKU");
      if(price==null||isNaN(price)||price<=0)throw new Error("Informe um preço válido");if(isNaN(promo)||isNaN(old))throw new Error("Preço promocional ou anterior inválido");
      if(promo!=null&&promo>=price)throw new Error("O preço promocional deve ser menor que o preço normal");if(old!=null&&old<=(promo??price))throw new Error("O preço anterior deve ser maior que o preço de venda")}
    const variants=[];Object.entries(ed.vmap).forEach(([k,x])=>{const [cid,...sz]=k.split("|");if(ed.colors.has(cid)&&ed.sizes.includes(sz.join("|")))variants.push({id:x.id,color_id:cid,size:sz.join("|"),stock:x.stock,active:x.active})});
    return{id:ed.id,name:v("f_name"),sku:v("f_sku"),description:v("f_desc"),category_id:v("f_cat")||null,price,promo_price:promo,old_price:old,active:mdl.$("#f_active").checked,is_new:mdl.$("#f_new").checked,is_featured:mdl.$("#f_feat").checked,is_promo:mdl.$("#f_isp").checked,track_stock:mdl.$("#f_track").checked,images:ed.images,variants};
  }
  function preview(p){
    const sale=p.promo_price??p.price??0,old=p.promo_price!=null?p.price:(p.old_price||0),pct=+S.settings.pix_percent||0,im=p.images[0],tag=tagOf({...p});
    const cs=S.colors.filter(c=>ed.colors.has(c.id)),ss=allSizes().filter(s=>ed.sizes.includes(s));
    const pm=modal({title:"Pré-visualização",wide:true,body:`<div class="pvw"><div class="pvc"><span class="eyebrow">Como aparece no catálogo</span><div style="margin-top:10px"><img src="${esc(imgSrc(im&&im.url))}" alt="">${tag?`<span class="tag">${esc(tag)}</span>`:""}<h4>${esc(p.name||"Nome do produto")}</h4><div><b>${brl(sale)}</b>${old>sale?`<s>${brl(old)}</s>`:""}</div><div class="pix"><b>${brl(Math.round(sale*(100-pct))/100)}</b> no PIX <em>-${pct}%</em></div><div style="margin-top:6px">${cs.map(c=>`<span class="sw" style="background:linear-gradient(135deg,${c.hex1},${c.hex2})"></span>`).join("")}</div></div></div>
    <div><span class="eyebrow">${esc(catName(p.category_id))} · ${esc(p.sku||"SKU")}</span><h2 style="font-size:28px;text-transform:uppercase;margin:8px 0 10px">${esc(p.name||"Nome do produto")}</h2><div style="font-size:22px;font-weight:900">${brl(sale)} ${old>sale?`<s class="muted" style="font-size:14px;font-weight:400">${brl(old)}</s>`:""}</div><p class="muted">${esc(p.description||"Sem descrição.")}</p>
    <div class="lbl">Tamanhos</div><div class="chips" style="margin:8px 0 14px">${ss.map(s=>`<span class="chip">${esc(s)}</span>`).join("")||"<span class='hint'>—</span>"}</div><div class="lbl">Cores</div><div style="margin-top:8px">${cs.map(c=>`<span class="badge"><span class="sw" style="background:linear-gradient(135deg,${c.hex1},${c.hex2})"></span>${esc(c.name)}</span> `).join("")||"<span class='hint'>—</span>"}</div>
    <p class="hint" style="margin-top:14px">${p.active?"Será publicado na loja ao salvar.":"Está inativo: não aparece na loja."} ${p.images.length>1?`${p.images.length} fotos.`:""}</p></div></div>`,foot:`<button class="btn" data-x>Fechar prévia</button>`});
  }
}

/* ---------- Categorias e cores ---------- */
async function viewCats(m){
  await loadProducts();await loadBase(true);
  const cnt=id=>S.products.filter(p=>p.category_id===id).length;
  m.innerHTML=head("Categorias","Catálogo",`<button class="btn" id="nc">+ Nova categoria</button>`)+`<p class="note info">Mudanças aparecem automaticamente no catálogo público. Categorias ocultas e seus produtos deixam de aparecer nos filtros e na página inicial.</p>
  <div class="card"><div class="tw"><table class="t cards"><thead><tr><th>Ordem</th><th></th><th>Categoria</th><th class="r">Produtos</th><th>Ativa</th><th></th></tr></thead><tbody>${S.cats.map((c,i)=>`<tr><td data-l="Ordem" style="white-space:nowrap"><button class="btn line sm" data-up="${i}" ${i?"":"disabled"} aria-label="Subir">↑</button> <button class="btn line sm" data-dn="${i}" ${i<S.cats.length-1?"":"disabled"} aria-label="Descer">↓</button></td><td class="noL">${c.image_url?`<img class="thumb" src="${esc(imgSrc(c.image_url))}" alt="">`:""}</td><td data-l="Categoria" class="nm">${esc(c.name)}</td><td data-l="Produtos" class="r">${cnt(c.id)}</td><td data-l="Ativa"><label class="switch"><input type="checkbox" data-ct="${c.id}" ${c.active?"checked":""} aria-label="Ativa"><i></i></label></td><td class="noL" style="white-space:nowrap"><button class="btn line sm" data-ec="${c.id}">Editar</button> <button class="btn danger sm" data-dc="${c.id}">Excluir</button></td></tr>`).join("")||`<tr><td colspan="6" class="empty">Nenhuma categoria.</td></tr>`}</tbody></table></div></div>
  <div class="ch" style="margin:26px 0 12px;display:flex;justify-content:space-between;align-items:center"><div><span class="eyebrow">Variações dos produtos</span><h1 style="font-size:22px;text-transform:uppercase;margin-top:6px">Cores</h1></div><button class="btn line" id="ncl">+ Nova cor</button></div>
  <div class="card"><div class="tw"><table class="t"><tbody>${S.colors.map(c=>`<tr><td><span class="sw" style="width:22px;height:22px;background:linear-gradient(135deg,${c.hex1},${c.hex2})"></span></td><td class="nm">${esc(c.name)}</td><td class="r" style="white-space:nowrap"><button class="btn line sm" data-ecl="${c.id}">Editar</button> <button class="btn danger sm" data-dcl="${c.id}">Excluir</button></td></tr>`).join("")}</tbody></table></div></div>`;
  const reload=()=>viewCats(m);
  const catModal=c=>{const mm=modal({title:c?"Editar categoria":"Nova categoria",body:`<div class="fld"><label>Nome *</label><input class="in" id="cn" maxlength="60" value="${esc(c?c.name:"")}"></div><div class="fld"><span class="lbl">Imagem (opcional)</span>${imgField("ci",c?c.image_url:"","categories")}<span class="hint">Se vazia, usa a foto de um produto da categoria.</span></div><label class="chk"><input type="checkbox" id="ca" ${!c||c.active?"checked":""}> Ativa (visível na loja)</label>`,foot:`<button class="btn line" data-x>Cancelar</button><button class="btn" id="cs">Salvar</button>`});
    bindImgFields(mm.ov);mm.$("#cs").onclick=e=>busy(e.target,async()=>{const name=mm.$("#cn").value.trim();if(!name)throw new Error("Informe o nome");const img=getImgVal(mm.ov,"ci")||null,active=mm.$("#ca").checked;
      if(c)await rest("categories?id=eq."+c.id,{method:"PATCH",body:{name,image_url:img,active}});else{let sl=slug(name);if(S.cats.some(x=>x.slug===sl))sl+="-"+Math.random().toString(36).slice(2,5);await rest("categories",{method:"POST",body:{name,slug:sl,image_url:img,active,position:(Math.max(0,...S.cats.map(x=>x.position))+10)}})}
      toast("Categoria salva","ok");mm.ov.remove();reload()})};
  $("#nc").onclick=()=>catModal(null);
  const colModal=c=>{const mm=modal({title:c?"Editar cor":"Nova cor",body:`<div class="fld"><label>Nome *</label><input class="in" id="kn" maxlength="40" value="${esc(c?c.name:"")}"></div><div class="row c2"><div class="fld"><label>Tom claro</label><input type="color" id="k1" value="${c?c.hex1:"#cccccc"}" style="width:100%;height:42px"></div><div class="fld"><label>Tom escuro</label><input type="color" id="k2" value="${c?c.hex2:"#888888"}" style="width:100%;height:42px"></div></div><p class="hint">As duas cores formam o degradê da bolinha mostrada na loja.</p>`,foot:`<button class="btn line" data-x>Cancelar</button><button class="btn" id="ks">Salvar</button>`});
    mm.$("#ks").onclick=e=>busy(e.target,async()=>{const name=mm.$("#kn").value.trim();if(!name)throw new Error("Informe o nome");const b={name,hex1:mm.$("#k1").value,hex2:mm.$("#k2").value};
      if(c)await rest("colors?id=eq."+c.id,{method:"PATCH",body:b});else await rest("colors",{method:"POST",body:{...b,position:Math.max(0,...S.colors.map(x=>x.position))+10}});toast("Cor salva","ok");mm.ov.remove();reload()})};
  $("#ncl").onclick=()=>colModal(null);
  m.onclick=async e=>{
    const t=e.target,up=t.closest("[data-up]"),dn=t.closest("[data-dn]"),ec=t.closest("[data-ec]"),dc=t.closest("[data-dc]"),ecl=t.closest("[data-ecl]"),dcl=t.closest("[data-dcl]");
    if(up||dn){const i=+(up||dn).dataset[up?"up":"dn"],j=up?i-1:i+1,ids=S.cats.map(c=>c.id);[ids[i],ids[j]]=[ids[j],ids[i]];busy(up||dn,async()=>{await rpc("admin_reorder_categories",{p_ids:ids});reload()})}
    else if(ec)catModal(S.cats.find(c=>c.id===ec.dataset.ec));
    else if(dc){const c=S.cats.find(x=>x.id===dc.dataset.dc),n=cnt(c.id);if(await confirmBox("Excluir categoria",`Excluir <b>${esc(c.name)}</b>?${n?` ${n} produto(s) ficarão <b>sem categoria</b> (continuam na loja).`:""}`,"Excluir",true))busy(dc,async()=>{await rest("categories?id=eq."+c.id,{method:"DELETE"});toast("Categoria excluída","ok");reload()})}
    else if(ecl)colModal(S.colors.find(c=>c.id===ecl.dataset.ecl));
    else if(dcl){const c=S.colors.find(x=>x.id===dcl.dataset.dcl);if(await confirmBox("Excluir cor",`Excluir a cor <b>${esc(c.name)}</b>? Só é possível se nenhuma variação a usar.`,"Excluir",true))busy(dcl,async()=>{await rest("colors?id=eq."+c.id,{method:"DELETE"});toast("Cor excluída","ok");reload()})}};
  m.onchange=e=>{const t=e.target.closest("[data-ct]");if(!t)return;rest("categories?id=eq."+t.dataset.ct,{method:"PATCH",body:{active:t.checked}}).then(()=>toast(t.checked?"Categoria visível":"Categoria oculta","ok")).catch(er=>{t.checked=!t.checked;toast(er.message,"bad")})};
}

/* ---------- Estoque ---------- */
const EF={q:"",only:"",cat:""};
async function viewStock(m){
  await loadProducts();const dirty=new Map();
  const rows=()=>{const th=lowTh();const out=[];S.products.forEach(p=>{if(EF.cat&&p.category_id!==EF.cat)return;p.product_variants.forEach(v=>{if(EF.q&&!(p.name+" "+p.sku).toLowerCase().includes(EF.q))return;const st=!v.active?"off":!p.track_stock?"free":v.stock===0?"out":v.stock<=th?"low":"ok";if(EF.only==="low"&&!(st==="low"||st==="out"))return;out.push({p,v,st})})});
    out.sort((a,b)=>a.p.name.localeCompare(b.p.name)||colorName(a.v.color_id).localeCompare(colorName(b.v.color_id)));return out};
  const draw=()=>{const l=rows();$("#slist").innerHTML=l.length?`<table class="t cards"><thead><tr><th>Produto</th><th>Cor</th><th>Tam.</th><th class="r">Estoque</th><th>Situação</th></tr></thead><tbody>${l.map(({p,v,st})=>`<tr><td data-l="Produto"><div class="nm">${esc(p.name)}</div><div class="sku">${esc(p.sku)}</div></td><td data-l="Cor">${esc(colorName(v.color_id))}</td><td data-l="Tam.">${esc(v.size)}</td><td data-l="Estoque" class="r"><input type="number" min="0" class="in" style="width:90px;text-align:center" data-v="${v.id}" value="${dirty.has(v.id)?dirty.get(v.id):v.stock}" aria-label="Estoque"></td><td data-l="Situação">${st==="out"?`<span class="badge bad">Esgotado — bloqueado</span>`:st==="low"?`<span class="badge warn">Baixo</span>`:st==="off"?`<span class="badge">Variação inativa</span>`:st==="free"?`<span class="badge">Sem controle</span>`:`<span class="badge ok">OK</span>`}</td></tr>`).join("")}</tbody></table>`:`<p class="empty">Nada para mostrar.</p>`;
    $("#sv").disabled=!dirty.size;$("#sv").textContent=dirty.size?`Salvar alterações (${dirty.size})`:"Salvar alterações"};
  m.innerHTML=head("Estoque","Controle por cor e tamanho",`<button class="btn" id="sv" disabled>Salvar alterações</button>`)+`<p class="note info">Combinações com estoque 0 ficam <b>bloqueadas</b> na loja automaticamente. O estoque só baixa quando um pedido é marcado como <b>Confirmado</b>. Alerta de estoque baixo: ≤ ${lowTh()} (ajuste em Personalizar loja).</p>
  <div class="card"><div class="tools"><input class="in grow" id="sq" type="search" placeholder="Buscar produto ou SKU…" value="${esc(EF.q)}"><select class="in" id="sc"><option value="">Todas as categorias</option>${S.cats.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("")}</select><select class="in" id="so"><option value="">Todas as variações</option><option value="low">Só baixo e esgotado</option></select></div><div class="tw" id="slist"></div></div>`;
  $("#sc").value=EF.cat;$("#so").value=EF.only;
  $("#sq").oninput=e=>{EF.q=e.target.value.toLowerCase().trim();draw()};$("#sc").onchange=e=>{EF.cat=e.target.value;draw()};$("#so").onchange=e=>{EF.only=e.target.value;draw()};
  m.oninput=e=>{const i=e.target.closest("[data-v]");if(!i)return;const val=Math.max(0,parseInt(i.value)||0),orig=S.products.flatMap(p=>p.product_variants).find(v=>v.id===i.dataset.v);val===orig.stock?dirty.delete(i.dataset.v):dirty.set(i.dataset.v,val);$("#sv").disabled=!dirty.size;$("#sv").textContent=dirty.size?`Salvar alterações (${dirty.size})`:"Salvar alterações"};
  $("#sv").onclick=e=>busy(e.target,async()=>{let n=0;for(const [id,stock] of dirty){await rest("product_variants?id=eq."+id,{method:"PATCH",body:{stock}});n++}dirty.clear();toast(`${n} variação(ões) atualizada(s)`,"ok");await loadProducts();draw()});
  draw();
}

/* ---------- Pedidos ---------- */
const OF={st:"",q:""};
async function viewOrders(m){
  const orders=await rest("orders?select=*,order_items(*)&order=number.desc&limit=300");
  const cnt=k=>orders.filter(o=>!k||o.status===k).length;
  const draw=()=>{const l=orders.filter(o=>(!OF.st||o.status===OF.st)&&(!OF.q||("#"+o.number+" "+(o.customer_name||"")+" "+(o.customer_phone||"")).toLowerCase().includes(OF.q)));
    $("#tabs").innerHTML=[["","Todos"],...Object.keys(ST).map(k=>[k,ST[k][0]])].map(([k,t])=>`<button class="chip${OF.st===k?" on":""}" data-st="${k}">${t} (${cnt(k)})</button>`).join("");
    $("#olist").innerHTML=l.length?`<table class="t cards"><thead><tr><th>Pedido</th><th>Data</th><th>Cliente</th><th>Itens</th><th>Pagamento</th><th class="r">Total</th><th>Status</th><th></th></tr></thead><tbody>${l.map(o=>`<tr><td data-l="Pedido" class="nm">#${o.number}</td><td data-l="Data">${fdate(o.created_at)}</td><td data-l="Cliente">${esc(o.customer_name||"—")}</td><td data-l="Itens">${o.order_items.reduce((a,i)=>a+i.qty,0)}</td><td data-l="Pagamento">${o.payment_method==="pix"?"PIX":"Cartão"}</td><td data-l="Total" class="r">${brl(o.total)}</td><td data-l="Status">${stBadge(o.status)}</td><td class="noL"><button class="btn line sm" data-o="${o.id}">Abrir</button></td></tr>`).join("")}</tbody></table>`:`<p class="empty">${orders.length?"Nenhum pedido com esses filtros.":"Nenhum pedido registrado ainda. Eles aparecem aqui quando um cliente toca em “Finalizar pelo WhatsApp”."}</p>`};
  m.innerHTML=head("Pedidos","Vendas",`<button class="btn line" id="orf">Atualizar</button>`)+`<p class="note info">Pedido registrado = cliente abriu o WhatsApp. Só vira <b>venda</b> quando você marca <b>Confirmado</b>.</p><div class="card"><div class="tabs" id="tabs"></div><div class="tools"><input class="in grow" id="oq" type="search" placeholder="Buscar por nº, nome ou telefone…" value="${esc(OF.q)}"></div><div class="tw" id="olist"></div></div>`;
  $("#orf").onclick=()=>viewOrders(m);$("#oq").oninput=e=>{OF.q=e.target.value.toLowerCase().trim().replace(/^#/,"#");draw()};
  m.onclick=e=>{const s=e.target.closest("[data-st]");if(s){OF.st=s.dataset.st;draw();return}const o=e.target.closest("[data-o]");if(o)orderModal(orders.find(x=>x.id===o.dataset.o),()=>viewOrders(m))};
  draw();
}
function orderModal(o,after){
  const sub=o.order_items.map(i=>`<tr><td><div class="nm">${esc(i.product_name)}</div><div class="sku">${esc(i.sku||"")} · ${esc(i.color)} · ${esc(i.size)}</div></td><td class="r">${i.qty}</td><td class="r">${brl(i.unit_price)}</td><td class="r">${brl(i.line_total)}</td></tr>`).join("");
  const mm=modal({title:`Pedido #${o.number}`,wide:true,body:`<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:14px">${stBadge(o.status)}<span class="muted small">Registrado em ${fdate(o.created_at)}</span>${o.stock_deducted?`<span class="badge ok">Estoque baixado</span>`:`<span class="badge">Estoque não baixado</span>`}</div>
  <div class="tw"><table class="t"><thead><tr><th>Item</th><th class="r">Qtd</th><th class="r">Unit.</th><th class="r">Subtotal</th></tr></thead><tbody>${sub}</tbody></table></div>
  <div style="text-align:right;margin:12px 0;font-size:13px">Subtotal: <b>${brl(o.subtotal)}</b><br>${+o.discount>0?`Desconto PIX: <b>−${brl(o.discount)}</b><br>`:""}Pagamento: <b>${o.payment_method==="pix"?"PIX":"Cartão"}</b><br><span style="font-size:18px">Total: <b>${brl(o.total)}</b></span></div>
  ${o.customer_name||o.customer_phone||o.customer_note?`<div class="sec"><h3>Dados do cliente</h3><p style="margin:0">${esc(o.customer_name||"—")}${o.customer_phone?` · ${esc(o.customer_phone)}`:""}</p>${o.customer_note?`<p class="muted" style="margin:6px 0 0">“${esc(o.customer_note)}”</p>`:""}</div>`:""}
  <div class="sec"><h3>Atualizar status</h3><div class="chips" id="sts">${Object.keys(ST).map(k=>`<button class="chip${o.status===k?" on":""}" data-s="${k}">${ST[k][0]}</button>`).join("")}</div><p class="hint" style="margin-top:8px">Confirmado, Preparando e Entregue baixam o estoque (uma única vez). Cancelar um pedido já confirmado devolve o estoque.</p></div>
  <div class="sec"><h3>Observação interna</h3><textarea class="in" id="an" maxlength="1000">${esc(o.admin_note||"")}</textarea></div>`,foot:`<button class="btn line" data-x>Fechar</button><button class="btn" id="asv">Salvar observação</button>`});
  const set=(status,btn)=>busy(btn,async()=>{const r=await rpc("admin_set_order",{p_id:o.id,p_status:status,p_note:mm.$("#an").value.trim()||null});toast(`Pedido #${o.number}: ${ST[status][0]}`,"ok");mm.ov.remove();after()});
  mm.ov.addEventListener("click",async e=>{const s=e.target.closest("[data-s]");if(s&&s.dataset.s!==o.status){const k=s.dataset.s;if(k==="cancelado"&&!(await confirmBox("Cancelar pedido",`Cancelar o pedido #${o.number}?${o.stock_deducted?" O estoque será devolvido.":""}`,"Cancelar pedido",true)))return;set(k,s)}});
  mm.$("#asv").onclick=e=>set(o.status,e.target);
}

/* ---------- Personalizar loja ---------- */
async function saveSettings(entries){await rest("settings?on_conflict=key",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:entries.map(([key,value])=>({key,value}))});entries.forEach(([k,v])=>S.settings[k]=v)}
function sect(id,title,sub,body){return `<div class="card" id="s_${id}"><div class="ch"><div><h2>${esc(title)}</h2>${sub?`<p>${sub}</p>`:""}</div><button class="btn sm" data-save="${id}">Salvar</button></div>${body}</div>`}
async function viewStore(m){
  await loadBase(true);const s=S.settings,cats=S.cats;
  const hero=(Array.isArray(s.hero)?s.hero:[]).map(x=>({...x})),cols=(Array.isArray(s.collections)?s.collections:[]).map(x=>({...x})),faq=(Array.isArray(s.faq)?s.faq:[]).map(x=>({...x})),pol=(Array.isArray(s.policies)?s.policies:[]).map(x=>({...x}));
  const sg=s.size_guide||{},sgCols=Array.isArray(sg.cols)&&sg.cols.length?sg.cols:["Tamanho","Busto (cm)","Cintura (cm)","Quadril (cm)"],sgRows=(Array.isArray(sg.rows)?sg.rows:[]).map(r=>[...r]);
  const about=s.about||{},feats=[...(about.features||[])];while(feats.length<3)feats.push({title:"",text:""});
  const promo=s.promo||{},cta=s.cta||{};
  const heroH=()=>hero.map((h,i)=>`<div class="rep" data-i="${i}"><div class="rh"><b>Banner ${i+1}</b><span><button class="link" data-hm="${i}" ${i?"":"hidden"}>↑ subir</button> <button class="link" data-hd="${i}" ${i<hero.length-1?"":"hidden"}>↓ descer</button> <button class="link bad" data-hx="${i}" ${hero.length>1?"":"hidden"}>remover</button></span></div><div class="row c2"><div class="fld"><label>Chamada pequena</label><input class="in" data-f="eyebrow" maxlength="60" value="${esc(h.eyebrow||"")}"></div><div class="fld"><label>Título</label><input class="in" data-f="title" maxlength="80" value="${esc(h.title||"")}"></div></div><div class="fld"><label>Texto</label><textarea class="in" data-f="text" maxlength="200" style="min-height:60px">${esc(h.text||"")}</textarea></div><span class="lbl">Imagem</span>${imgField("hero"+i,h.image)}</div>`).join("");
  const colH=()=>cols.map((c,i)=>`<div class="rep" data-i="${i}"><div class="rh"><b>Coleção ${i+1}</b><button class="link bad" data-cx="${i}">remover</button></div><div class="row c3"><div class="fld"><label>Selo</label><input class="in" data-f="label" maxlength="30" value="${esc(c.label||"")}"></div><div class="fld"><label>Título</label><input class="in" data-f="title" maxlength="50" value="${esc(c.title||"")}"></div><div class="fld"><label>Leva para a categoria</label><select class="in" data-f="category_id"><option value="">Toda a coleção</option>${cats.map(k=>`<option value="${k.id}" ${k.id===c.category_id?"selected":""}>${esc(k.name)}</option>`).join("")}</select></div></div><span class="lbl">Imagem</span>${imgField("col"+i,c.image)}</div>`).join("");
  const qaH=(arr,kind)=>arr.map((x,i)=>`<div class="rep" data-i="${i}"><div class="rh"><b>${kind==="faq"?"Pergunta":"Política"} ${i+1}</b><button class="link bad" data-${kind}x="${i}">remover</button></div><div class="fld"><label>${kind==="faq"?"Pergunta":"Título"}</label><input class="in" data-f="${kind==="faq"?"q":"t"}" maxlength="150" value="${esc(kind==="faq"?x.q:x.t)}"></div><div class="fld"><label>${kind==="faq"?"Resposta":"Texto"}</label><textarea class="in" data-f="${kind==="faq"?"a":"p"}" maxlength="1500">${esc(kind==="faq"?x.a:x.p)}</textarea></div></div>`).join("");
  const sgH=()=>`<div class="matrix"><table><thead><tr>${sgCols.map((c,j)=>`<th><input class="in" data-sc="${j}" value="${esc(c)}" style="min-width:90px"></th>`).join("")}<th></th></tr></thead><tbody>${sgRows.map((r,i)=>`<tr>${sgCols.map((_,j)=>`<td><input class="in" data-sr="${i}" data-sj="${j}" value="${esc(r[j]||"")}" style="min-width:90px"></td>`).join("")}<td><button class="link bad" data-srx="${i}">✕</button></td></tr>`).join("")}</tbody></table></div>`;
  m.innerHTML=head("Personalizar loja","Textos, banners e pagamento")+`<p class="note info">Cada bloco tem seu próprio botão <b>Salvar</b>. A loja se atualiza sozinha.</p>
  ${sect("pay","Contato e pagamento","",`<div class="row c2"><div class="fld"><label>WhatsApp da loja (DDI + DDD + número)</label><input class="in" id="p_wa" inputmode="numeric" value="${esc(s.whatsapp||"")}"><span class="hint">Somente números. Ex.: 5587981778968</span></div><div class="fld"><label>Instagram (link completo)</label><input class="in" id="p_ig" value="${esc(s.instagram||"")}"></div></div>
   <div class="row c3"><div class="fld"><label>Desconto PIX (%)</label><input class="in" id="p_pix" inputmode="decimal" value="${esc(s.pix_percent)}"></div><div class="fld"><label>Parcelas sem juros (máx.)</label><input class="in" id="p_inst" inputmode="numeric" value="${esc(s.max_installments)}"></div><div class="fld"><label>Alerta de estoque baixo (≤)</label><input class="in" id="p_low" inputmode="numeric" value="${esc(s.low_stock_threshold)}"></div></div>
   <div class="fld"><label>Tamanhos padrão (separados por vírgula)</label><input class="in" id="p_sizes" value="${esc((s.sizes||[]).join(", "))}"></div>
   <div class="fld"><label>Faixa superior (vazio = texto automático com PIX e parcelas)</label><input class="in" id="p_top" maxlength="200" value="${esc(s.topbar_text||"")}"></div>`)}
  ${sect("hero","Banners da página inicial","Até 5 banners que alternam no topo da loja.",`<div id="heroL">${heroH()}</div><button class="btn line sm" id="heroAdd">+ Adicionar banner</button>`)}
  ${sect("cols","Coleções em destaque","Até 3 blocos com foto na página inicial.",`<div id="colL">${colH()}</div><button class="btn line sm" id="colAdd">+ Adicionar coleção</button>`)}
  ${sect("promo","Promoção (faixa grande)","Título e texto vazios usam automaticamente o desconto PIX e as parcelas.",`<div class="row c2"><div class="fld"><label>Chamada pequena</label><input class="in" id="pr_e" maxlength="60" value="${esc(promo.eyebrow||"")}"></div><div class="fld"><label>Texto do botão</label><input class="in" id="pr_b" maxlength="40" value="${esc(promo.button||"")}"></div></div><div class="fld"><label>Título</label><input class="in" id="pr_t" maxlength="80" value="${esc(promo.title||"")}"></div><div class="fld"><label>Texto</label><textarea class="in" id="pr_x" maxlength="250" style="min-height:60px">${esc(promo.text||"")}</textarea></div><span class="lbl">Imagem</span>${imgField("promo",promo.image)}`)}
  ${sect("mq","Faixa animada","Uma frase por linha (máx. 12).",`<textarea class="in" id="mq_t" style="min-height:110px">${esc((s.marquee||[]).join("\n"))}</textarea>`)}
  ${sect("about","Sobre a Life","",`<div class="row c2"><div class="fld"><label>Chamada pequena</label><input class="in" id="ab_e" maxlength="60" value="${esc(about.eyebrow||"")}"></div><div class="fld"><label>Título</label><input class="in" id="ab_t" maxlength="80" value="${esc(about.title||"")}"></div></div><div class="fld"><label>Texto</label><textarea class="in" id="ab_x" maxlength="800">${esc(about.text||"")}</textarea></div><span class="lbl">Imagem</span>${imgField("about",about.image)}<div class="row c3" style="margin-top:14px">${feats.slice(0,3).map((f,i)=>`<div class="fld"><label>Destaque ${i+1}</label><input class="in" data-ft="${i}" maxlength="40" placeholder="Título" value="${esc(f.title)}"><input class="in" data-fx="${i}" maxlength="60" placeholder="Descrição" value="${esc(f.text)}"></div>`).join("")}</div>`)}
  ${sect("cta","Chamada para o WhatsApp e rodapé","",`<div class="fld"><label>Título</label><input class="in" id="ct_t" maxlength="80" value="${esc(cta.title||"")}"></div><div class="fld"><label>Texto</label><textarea class="in" id="ct_x" maxlength="250" style="min-height:60px">${esc(cta.text||"")}</textarea></div><span class="lbl">Imagem de “Toda a coleção”</span>${imgField("catimg",s.catalog_image)}<div class="fld" style="margin-top:14px"><label>Texto do rodapé</label><textarea class="in" id="ft_t" maxlength="300" style="min-height:60px">${esc(s.footer_text||"")}</textarea></div>`)}
  ${sect("faq","Perguntas frequentes","Use {pix} e {parcelas} para inserir o desconto e as parcelas atuais.",`<div id="faqL">${qaH(faq,"faq")}</div><button class="btn line sm" id="faqAdd">+ Adicionar pergunta</button>`)}
  ${sect("pol","Políticas da loja","",`<div id="polL">${qaH(pol,"pol")}</div><button class="btn line sm" id="polAdd">+ Adicionar política</button>`)}
  ${sect("sg","Guia de medidas","Sem linhas, a loja orienta o cliente a pedir as medidas pelo WhatsApp.",`<div class="fld"><label>Como medir</label><textarea class="in" id="sg_h" maxlength="600">${esc(sg.how||"")}</textarea></div><div id="sgL">${sgH()}</div><button class="btn line sm" id="sgAdd">+ Adicionar linha</button>`)}`;
  bindImgFields(m);
  const readList=(sel,arr)=>$$(sel+" .rep",m).forEach((r,i)=>$$("[data-f]",r).forEach(f=>arr[i][f.dataset.f]=f.value));
  const syncHero=()=>{readList("#heroL",hero);hero.forEach((h,i)=>h.image=getImgVal(m,"hero"+i)||h.image)};
  const syncCols=()=>{readList("#colL",cols);cols.forEach((c,i)=>c.image=getImgVal(m,"col"+i)||c.image)};
  const syncQa=(id,arr)=>readList(id,arr);
  const syncSg=()=>{$$("[data-sc]",m).forEach(i=>sgCols[+i.dataset.sc]=i.value);$$("[data-sr]",m).forEach(i=>sgRows[+i.dataset.sr][+i.dataset.sj]=i.value)};
  const redraw=(id,fn)=>{$(id,m).innerHTML=fn()};
  m.addEventListener("click",e=>{const t=e.target;
    if(t.id==="heroAdd"){if(hero.length>=5)return toast("Máximo de 5 banners","bad");syncHero();hero.push({eyebrow:"",title:"",text:"",image:""});redraw("#heroL",heroH);return}
    let k;if((k=t.closest("[data-hx]"))){syncHero();hero.splice(+k.dataset.hx,1);redraw("#heroL",heroH);return}
    if((k=t.closest("[data-hm]"))){syncHero();const i=+k.dataset.hm;[hero[i-1],hero[i]]=[hero[i],hero[i-1]];redraw("#heroL",heroH);return}
    if((k=t.closest("[data-hd]"))){syncHero();const i=+k.dataset.hd;[hero[i+1],hero[i]]=[hero[i],hero[i+1]];redraw("#heroL",heroH);return}
    if(t.id==="colAdd"){if(cols.length>=3)return toast("Máximo de 3 coleções","bad");syncCols();cols.push({label:"Coleção",title:"",category_id:"",image:""});redraw("#colL",colH);return}
    if((k=t.closest("[data-cx]"))){syncCols();cols.splice(+k.dataset.cx,1);redraw("#colL",colH);return}
    if(t.id==="faqAdd"){syncQa("#faqL",faq);faq.push({q:"",a:""});redraw("#faqL",()=>qaH(faq,"faq"));return}
    if((k=t.closest("[data-faqx]"))){syncQa("#faqL",faq);faq.splice(+k.dataset.faqx,1);redraw("#faqL",()=>qaH(faq,"faq"));return}
    if(t.id==="polAdd"){syncQa("#polL",pol);pol.push({t:"",p:""});redraw("#polL",()=>qaH(pol,"pol"));return}
    if((k=t.closest("[data-polx]"))){syncQa("#polL",pol);pol.splice(+k.dataset.polx,1);redraw("#polL",()=>qaH(pol,"pol"));return}
    if(t.id==="sgAdd"){syncSg();sgRows.push(sgCols.map(()=>""));redraw("#sgL",sgH);return}
    if((k=t.closest("[data-srx]"))){syncSg();sgRows.splice(+k.dataset.srx,1);redraw("#sgL",sgH);return}
    if((k=t.closest("[data-save]")))busy(k,async()=>{const id=k.dataset.save,v=i=>$("#"+i,m).value.trim();let E=[];
      if(id==="pay"){const wa=v("p_wa").replace(/\D/g,""),pix=num(v("p_pix")),ins=num(v("p_inst")),low=num(v("p_low"));if(!/^\d{10,15}$/.test(wa))throw new Error("WhatsApp inválido: use DDI+DDD+número, só números (ex.: 5587981778968)");
        if(pix==null||isNaN(pix)||pix<0||pix>100)throw new Error("Desconto PIX deve estar entre 0 e 100");if(ins==null||isNaN(ins)||!Number.isInteger(ins)||ins<1||ins>12)throw new Error("Parcelas: número inteiro de 1 a 12");if(low==null||isNaN(low)||!Number.isInteger(low)||low<0)throw new Error("Alerta de estoque: número inteiro ≥ 0");
        const sizes=v("p_sizes").split(",").map(x=>x.trim().toUpperCase()).filter(Boolean);if(!sizes.length)throw new Error("Informe ao menos um tamanho");
        E=[["whatsapp",wa],["instagram",v("p_ig")],["pix_percent",pix],["max_installments",ins],["low_stock_threshold",low],["sizes",[...new Set(sizes)]],["topbar_text",v("p_top")]]}
      else if(id==="hero"){syncHero();if(hero.some(h=>!h.image))throw new Error("Todos os banners precisam de imagem");E=[["hero",hero.map(h=>({eyebrow:h.eyebrow||"",title:h.title||"",text:h.text||"",image:h.image}))]]}
      else if(id==="cols"){syncCols();if(cols.some(c=>!c.image||!c.title))throw new Error("Cada coleção precisa de título e imagem");E=[["collections",cols.map(c=>({label:c.label||"Coleção",title:c.title,category_id:c.category_id||null,image:c.image}))]]}
      else if(id==="promo")E=[["promo",{eyebrow:v("pr_e"),title:v("pr_t"),text:v("pr_x"),button:v("pr_b"),image:getImgVal(m,"promo")}]];
      else if(id==="mq")E=[["marquee",v("mq_t").split("\n").map(x=>x.trim()).filter(Boolean)]];
      else if(id==="about")E=[["about",{eyebrow:v("ab_e"),title:v("ab_t"),text:v("ab_x"),image:getImgVal(m,"about"),features:[0,1,2].map(i=>({title:$(`[data-ft="${i}"]`,m).value.trim(),text:$(`[data-fx="${i}"]`,m).value.trim()})).filter(f=>f.title)}]];
      else if(id==="cta")E=[["cta",{title:v("ct_t"),text:v("ct_x")}],["footer_text",v("ft_t")],["catalog_image",getImgVal(m,"catimg")]];
      else if(id==="faq"){syncQa("#faqL",faq);E=[["faq",faq.filter(f=>f.q&&f.a)]]}
      else if(id==="pol"){syncQa("#polL",pol);E=[["policies",pol.filter(f=>f.t&&f.p)]]}
      else if(id==="sg"){syncSg();E=[["size_guide",{how:v("sg_h"),cols:sgCols,rows:sgRows.filter(r=>r.some(c=>String(c).trim()))}]]}
      await saveSettings(E);toast("Salvo — a loja já foi atualizada","ok")});
  });
}

const VIEWS={dashboard:viewDash,produtos:viewProducts,categorias:viewCats,estoque:viewStock,pedidos:viewOrders,loja:viewStore};
setInterval(()=>{if(session&&!document.hidden&&$(".shell"))refreshPending()},60000);
go();
})();
