const $=s=>document.querySelector(s), C=OGT.coverage, F=OGT.facilities, D=OGT.detail||{};
const LS={g:(k,d)=>JSON.parse(localStorage.getItem(k)||JSON.stringify(d)),s:(k,v)=>localStorage.setItem(k,JSON.stringify(v))};
const esc=t=>String(t==null?'':t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const byName=n=>F.find(f=>f.名称===n)||null;
const localInfo=()=>LS.g('ogt_fac_info',{});
const mergedFacility=f=>{if(!f)return null;const saved=Object.fromEntries(Object.entries(localInfo()[f.名称]||{}).filter(([,v])=>v!==''&&v!=null));return {...f,...saved};};

/* 部位アイコン：カテゴリごとに専用の線画アイコンを使う */
const ICON={upper:'ic-upper',lower:'ic-lower',core:'ic-core',arm:'ic-arm',cardio:'ic-cardio'};
function figure(cat){
  const id=ICON[cat]||'ic-all';
  return `<div class="micon"><svg width="30" height="30" viewBox="0 0 48 48"><use href="#${id}"/></svg></div>`;
}

/* ============ まちのジム ============ */
$('#k-gym').textContent=C.gyms; $('#k-mun').textContent=C.municipalities;
const SHOW=[['所在地_連結表記','住所'],['電話番号','電話番号'],['開始時間','開館時間'],
            ['更衣室','更衣室'],['シャワー室','シャワー室'],['車椅子可','車椅子対応']];
$('#bars').innerHTML=SHOW.filter(([k])=>C.coverage[k]).map(([k,ja])=>{const v=C.coverage[k];
  const c=v.pct<40?'f-or':v.pct<75?'f-bl':'f-gr';
  return `<div class="bar"><div class="t"><b>${ja}</b><i>${v.pct}% 記入済み</i></div>
  <div class="track"><i class="${c}" style="width:${v.pct}%"></i></div></div>`}).join('');
$('#src').innerHTML=`出典：東京都オープンデータカタログサイト（各区市町村提供）／CC BY 4.0<br>
${C.municipalities}の区市・${C.facilities}の施設の公開データを、すべての項目について数えました。`;

/* ============ さがす ============ */
const muns=[...new Set(F.map(f=>f.自治体))].sort();
$('#f-mun').innerHTML=`<option value="">ぜんぶ見る（${F.length}か所）</option>`+muns.map(m=>`<option>${m}</option>`).join('');
const tag=(v,l)=>{const known=v!==''&&v!=null,yes=known&&!/^(無|不可|なし)$/.test(String(v));return `<span class="tag ${yes?'y':'n'}">${l}${known?(yes?' あり':' なし'):' 不明'}</span>`;};
const WANTED=[['電話番号','電話番号'],['開始時間','開館時間'],['更衣室','更衣室'],['シャワー室','シャワー'],['車椅子可','車椅子'],['URL','公式URL']];
function wanted(f){const mf=mergedFacility(f),a=WANTED.filter(([k])=>!mf[k]).map(([,l])=>l);
 if(!(confAll()[f.名称]||[]).length)a.unshift('マシン構成');return a;}
function wantedHtml(f){return wanted(f).map(x=>`<span class="tag wanted" onclick="openFacility('${esc(f.名称)}')">募集中：${esc(x)}</span>`).join('');}
function facilityCard(f,dist){const x=mergedFacility(f);return `<div class="card">
  <div class="ttl">${esc(x.名称)}</div>
  <div class="sub">${esc(x.自治体)}　${esc(x['所在地_連結表記']||'')}${dist!=null?`<br><b>現在地から約 ${dist.toFixed(1)}km</b>`:''}</div>
  <div style="margin-top:12px">${tag(x.更衣室,'更衣室')}${tag(x['シャワー室'],'シャワー室')}${tag(x.車椅子可,'車椅子')}${tag(x.開始時間,'開館時間')}</div>
  <div class="wanted-row">${wantedHtml(f)||'<span class="tag y">基本情報は登録済み</span>'}</div>
  <div class="fac-actions"><button class="green" onclick="startFacility('${esc(f.名称)}')">この施設で記録を開始</button><button class="ghost" onclick="openFacility('${esc(f.名称)}')">設定一覧を見る・修正する</button></div>
 </div>`;}
let findRows=F.map(f=>({f,dist:null})),GYM_MAP=null,MAP_LAYER=null;
function filteredRows(){const m=$('#f-mun').value;return findRows.filter(x=>!m||x.f.自治体===m);}
function draw(){const rows=filteredRows();$('#list').innerHTML=rows.map(x=>facilityCard(x.f,x.dist)).join('')||'<div class="card"><div class="sub">該当する施設がありません。</div></div>';drawMap(rows);}
function setFindView(v){const map=v==='map';$('#gym-map').style.display=map?'block':'none';$('#list').style.display=map?'none':'block';
 $('#btn-map').classList.toggle('ghost',!map);$('#btn-list').classList.toggle('ghost',map);if(map){initMap();setTimeout(()=>GYM_MAP&&GYM_MAP.invalidateSize(),50);}}
function initMap(){if(GYM_MAP||!window.L)return;GYM_MAP=L.map('gym-map').setView([35.68,139.69],10);
 L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(GYM_MAP);drawMap(filteredRows());}
function drawMap(rows){if(!GYM_MAP)return;if(MAP_LAYER)MAP_LAYER.remove();MAP_LAYER=L.layerGroup().addTo(GYM_MAP);
 for(const {f,dist} of rows){const la=+f.緯度,lo=+f.経度;if(!la||!lo)continue;
  const pop=`<div class="ttl">${esc(f.名称)}</div><div>${esc(f.自治体)}${dist!=null?`・約${dist.toFixed(1)}km`:''}</div><div class="wanted-row">${wantedHtml(f)}</div><button onclick="startFacility('${esc(f.名称)}')">記録を開始</button><button class="ghost" onclick="openFacility('${esc(f.名称)}')">設定を見る</button>`;
  L.marker([la,lo],{title:f.名称}).bindPopup(pop).addTo(MAP_LAYER);}}
function km(a,b,c,d){const R=6371,p=Math.PI/180,x=(c-a)*p,y=(d-b)*p;const q=Math.sin(x/2)**2+Math.cos(a*p)*Math.cos(c*p)*Math.sin(y/2)**2;return 2*R*Math.asin(Math.sqrt(q));}
function nearby(){const st=$('#near-st');if(!navigator.geolocation){st.className='msg ng';st.textContent='この端末では現在地を取得できません。';return;}
 st.className='msg';st.textContent='現在地を確認しています…';navigator.geolocation.getCurrentPosition(p=>{const {latitude,longitude}=p.coords;
  findRows=F.map(f=>({f,dist:km(latitude,longitude,+f.緯度,+f.経度)})).sort((a,b)=>a.dist-b.dist);st.className='msg ok';st.textContent=`近い順に並べました。最寄りは ${findRows[0].f.名称}（約${findRows[0].dist.toFixed(1)}km）です。`;draw();setFindView('list');
 },()=>{st.className='msg ng';st.textContent='現在地を取得できませんでした。位置情報の利用を許可してください。';},{enableHighAccuracy:true,timeout:10000});}
$('#f-mun').onchange=draw; draw();

/* ============ きろく ============ */
let CAT='';
function confAll(){const c=LS.g('ogt_conf',{});
 for(const id in D){const d=D[id];if(!c[d.name])c[d.name]=d.machines;}
 LS.s('ogt_conf',c);return c;}
function detailOf(n){for(const id in D)if(D[id].name===n)return {...D[id],...(localInfo()[n]||{})};
 const f=mergedFacility(byName(n));if(!f)return null;return {name:f.名称,address:f['所在地_連結表記']||'',phone:f.電話番号||'',gymHours:[f.開始時間&&f.終了時間?`${f.開始時間}〜${f.終了時間}`:f.開始時間||''].filter(Boolean),gymFee:[],gymBelongings:'',gymProcedure:'',gymNotes:[],...f};}
function facs(select){const c=confAll(),k=Object.keys(c),cur=select||$('#l-fac').value;
 $('#l-fac').innerHTML=k.map(x=>`<option>${esc(x)}</option>`).join('');if(cur&&k.includes(cur))$('#l-fac').value=cur;mach();shared();renderHistory();}

let EDIT_FAC='';
function startFacility(n){const c=confAll();if(!c[n]){c[n]=[];LS.s('ogt_conf',c);}facs(n);go('log');location.hash='log';window.scrollTo(0,0);}
function machineWeights(m){if(Array.isArray(m.weights)&&m.weights.length)return m.weights;const a=Number(m.min),b=Number(m.max),s=Number(m.step);if(Number.isFinite(a)&&Number.isFinite(b)&&s>0&&b>=a){const out=[];for(let v=a;v<=b+1e-9&&out.length<100;v+=s)out.push(+v.toFixed(2));return out;}return Number.isFinite(a)&&a>0?[a]:[];}
function machineLines(ms){return (ms||[]).map(m=>`${m.name} | ${machineWeights(m).join(' ')}`).join('\n');}
function parseMachineLines(t){return t.split(/\n+/).map(s=>s.trim()).filter(Boolean).map(line=>{const [namePart,weightPart='']=line.split('|');const ws=weightPart.trim().split(/[\s,、]+/).map(Number).filter(Number.isFinite);return {name:namePart.trim(),weights:ws.length?ws:undefined,min:ws[0]||0,max:ws[ws.length-1]||0,step:ws.length>1?+(ws[1]-ws[0]).toFixed(2):2.5,hasSets:true};}).filter(m=>m.name);}
function openFacility(n){EDIT_FAC=n;FAC_AI_IMAGE='';const f=mergedFacility(byName(n))||{名称:n};const ms=confAll()[n]||[];
 $('#fd-title').textContent=n;$('#fd-address').textContent=`${f.自治体||''}　${f['所在地_連結表記']||''}`;$('#fd-wanted').innerHTML=wanted(f).map(x=>`<span class="tag wanted">募集中：${esc(x)}</span>`).join('');
 $('#fd-phone').value=f.電話番号||'';$('#fd-open').value=f.開始時間||'';$('#fd-close').value=f.終了時間||'';$('#fd-change').value=f.更衣室||'';$('#fd-shower').value=f['シャワー室']||'';$('#fd-wheel').value=f.車椅子可||'';$('#fd-url').value=f.URL||'';$('#fd-machines').value=machineLines(ms);$('#fd-st').textContent='';$('#fd-ai-st').textContent='';$('#fd-ai-text').value='';$('#fd-ai-image').value='';$('#fd-ai-file').textContent='画像は選択されていません';$('#fd-ai-preview').style.display='none';$('#fd-ai-preview').removeAttribute('src');$('#fac-dialog').showModal();}

let FAC_AI_IMAGE='';
$('#fd-ai-image').addEventListener('change',async e=>{const f=e.target.files&&e.target.files[0],st=$('#fd-ai-st');FAC_AI_IMAGE='';
 if(!f){$('#fd-ai-file').textContent='画像は選択されていません';$('#fd-ai-preview').style.display='none';return;}
 if(f.size>12*1024*1024){st.className='msg ng';st.textContent='画像が大きすぎます（12MBまで）。';e.target.value='';return;}
 try{FAC_AI_IMAGE=await shrinkImage(f);$('#fd-ai-file').textContent=f.name;$('#fd-ai-preview').src=FAC_AI_IMAGE;$('#fd-ai-preview').style.display='block';st.textContent='';}
 catch(err){st.className='msg ng';st.textContent='画像を読み込めませんでした。別の画像を選んでください。';}});
function shrinkImage(file){return new Promise((resolve,reject)=>{const img=new Image(),u=URL.createObjectURL(file);img.onload=()=>{const max=1400,s=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*s));c.height=Math.max(1,Math.round(img.height*s));c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(u);resolve(c.toDataURL('image/jpeg',.82));};img.onerror=()=>{URL.revokeObjectURL(u);reject(new Error('image'));};img.src=u;});}
async function assistFacility(){const text=$('#fd-ai-text').value.trim(),st=$('#fd-ai-st'),b=$('#fd-ai-btn');if(!text&&!FAC_AI_IMAGE){st.className='msg ng';st.textContent='文章を貼り付けるか、画像を選んでください。';return;}
 b.disabled=true;b.textContent='AIが読み取っています…';st.className='msg';st.textContent='候補を抽出しています。画像の場合は少し時間がかかります。';
 try{const r=await fetch('/api/parse',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text,image:FAC_AI_IMAGE,facility:EDIT_FAC})}),j=await r.json();if(!r.ok||!j.ok)throw new Error(j.error||'抽出できませんでした');applyFacilityCandidate(j.data);st.className='msg ok';st.textContent='AIの候補を入力しました。内容を確認してから保存してください。';}
 catch(e){st.className='msg ng';st.textContent=`AIで読み取れませんでした：${e.message}`;}finally{b.disabled=false;b.textContent='AIで設定候補を入力';}}
function applyFacilityCandidate(d){if(!d)return;const set=(id,v)=>{if(v!==''&&v!=null)$(id).value=String(v);};set('#fd-phone',d.phone);set('#fd-open',d.open);set('#fd-close',d.close);set('#fd-change',d.changingRoom);set('#fd-shower',d.shower);set('#fd-wheel',d.wheelchair);set('#fd-url',d.url);if(d.machines&&d.machines.length)$('#fd-machines').value=machineLines(d.machines);}
async function saveFacility(shareIt){const n=EDIT_FAC;if(!n)return;const info=localInfo();info[n]={電話番号:$('#fd-phone').value.trim(),開始時間:$('#fd-open').value.trim(),終了時間:$('#fd-close').value.trim(),更衣室:$('#fd-change').value,'シャワー室':$('#fd-shower').value,車椅子可:$('#fd-wheel').value,URL:$('#fd-url').value.trim()};LS.s('ogt_fac_info',info);
 const machines=parseMachineLines($('#fd-machines').value),conf=confAll();conf[n]=machines;LS.s('ogt_conf',conf);const st=$('#fd-st');st.className='msg ok';st.textContent='この端末の個人用設定に保存しました。';facs(n);draw();
 $('#fd-wanted').innerHTML=wanted(mergedFacility(byName(n))||{名称:n}).map(x=>`<span class="tag wanted">募集中：${esc(x)}</span>`).join('')||'<span class="tag y">基本情報とマシン設定を保存済み</span>';
 if(shareIt){try{const j=await (await fetch('/api/share',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({facility:n,machines,settings:info[n],consent:true})})).json();if(!j.ok)throw new Error(j.error);st.textContent=`個人用に保存し、共有データにも反映しました（延べ${j.contributions}人）。`;shared();}catch(e){st.className='msg ng';st.textContent=`個人用には保存済みです。共有は失敗しました：${e.message}`;}}}

function facInfo(d){
 if(!d){$('#fac-info').innerHTML='';return;}
 $('#fac-info').innerHTML=`<div class="card cream">
  <div class="ttl">${esc(d.name)}</div>
  <div class="sub" style="margin-top:8px">
   ${esc(d.address)}　${esc(d.phone)}<br>
   <b>開館時間</b>　${(d.gymHours||[]).map(esc).join('／')}<br>
   <b>料金</b>　${(d.gymFee||[]).map(esc).join('／')}<br>
   <b>持ち物</b>　${esc(d.gymBelongings||'—')}</div>
  <div class="small" style="margin-top:10px">${esc(d.gymProcedure||'')}<br>${(d.gymNotes||[]).map(esc).join('　')}</div>
 </div>`;}

function mach(){
 const conf=confAll(),f=$('#l-fac').value,d=detailOf(f);
 facInfo(d);
 let ms=conf[f]||[];
 const cats=d&&d.categories;
 $('#cats').innerHTML=cats?['',...Object.keys(cats)].map(k=>
  `<span class="chip ${CAT===k?'sel':''}" onclick="CAT='${k}';mach()">${k?esc(cats[k].label):'すべて'}</span>`).join(''):'';
 if(CAT)ms=ms.filter(m=>m.category===CAT);
 if(!ms.length){$('#machines').innerHTML='<div class="card"><div class="sub">まだマシンがとうろくされていません。下からふやせます。</div></div>';return;}
 const log=LS.g('ogt_log',[]);
 $('#machines').innerHTML=ms.map((m,i)=>{
  const past=log.filter(l=>l.f===f&&l.m===m.name).sort((a,b)=>b.t-a.t),last=past[0];
  const days=last?Math.floor((Date.now()-last.t)/864e5):null;
  const ws=m.weights&&m.weights.length?m.weights:null;
  const cur=last?last.w:(ws?ws[0]:(m.min||0));
  const unit=(m.fields&&m.fields[0]&&m.fields[0].unit)||'kg';
  const lbl=(m.fields&&m.fields[0]&&m.fields[0].label)||'重さ';
  return `<div class="card">
   <div class="mrow">${figure(m.category||'')}
    <div style="flex:1"><div class="mname">${esc(m.name)}</div>
     ${m.description?`<div class="mdesc">${esc(m.description)}</div>`:''}
     ${m.videoUrl?`<a class="howto" href="${esc(m.videoUrl)}" target="_blank" rel="noopener">▶ 使い方の動画</a>`:''}
    </div></div>
   <div class="picker">
     <button class="rnd" onclick="adj(${i},-1)" aria-label="重さをへらす">−</button>
     <div class="wv" id="w${i}">${cur}<u>${esc(unit)}</u></div>
     <button class="rnd" onclick="adj(${i},1)" aria-label="重さをふやす">＋</button>
     ${m.hasSets!==false?`<div class="reps">× <input type="number" id="r${i}" value="${last&&last.r||10}" min="1" inputmode="numeric"> 回</div>`:''}
     <div style="flex:1"></div>
     <button class="green" onclick="save(${i})">記録する</button>
   </div>
   <div class="last">${last?`まえは ${last.w}${esc(unit)}${last.r?' を '+last.r+'回':''}・${days===0?'きょう':days+'日まえ'}`:'まだ記録がありません'}</div>
   ${ws?`<div class="stack"><b>えらべる${esc(lbl)}</b>　${ws.join(' ／ ')}</div>`:''}
   <div id="s${i}"></div></div>`}).join('');
 window._ms=ms;}

function adj(i,d){const m=window._ms[i],e=$('#w'+i);
 const unit=(m.fields&&m.fields[0]&&m.fields[0].unit)||'kg';
 const cur=parseFloat(e.textContent);
 if(m.weights&&m.weights.length){
  let idx=m.weights.findIndex(x=>Math.abs(x-cur)<1e-6); if(idx<0)idx=0;
  idx=Math.max(0,Math.min(m.weights.length-1,idx+d));
  e.innerHTML=m.weights[idx]+`<u>${unit}</u>`;
 }else{let v=cur+d*(m.step||2.5);v=Math.max(m.min||0,v);
  e.innerHTML=(Number.isInteger(v)?v:v.toFixed(1))+`<u>${unit}</u>`;}}

function save(i){const m=window._ms[i],f=$('#l-fac').value;
 const w=parseFloat($('#w'+i).textContent);
 const rEl=$('#r'+i),r=rEl?parseInt(rEl.value)||0:0;
 const log=LS.g('ogt_log',[]);
 const prev=log.filter(l=>l.f===f&&l.m===m.name).sort((a,b)=>b.t-a.t)[0];
 log.push({f,m:m.name,w,r,t:Date.now()});LS.s('ogt_log',log);
 $('#s'+i).innerHTML=(prev&&w>prev.w)
  ?`<div class="up">前回より ${(w-prev.w).toFixed(1)}kg 増えました</div>`
  :`<div class="msg ok">記録しました</div>`;
 renderHistory();}

/* ---- 記録の履歴（一覧・削除） ---- */
function renderHistory(){
 const f=$('#l-fac').value,log=LS.g('ogt_log',[]);
 const mine=log.map((l,idx)=>({...l,idx})).filter(l=>l.f===f).sort((a,b)=>b.t-a.t);
 $('#log-st').textContent=`この端末にはこれまで ${log.length} 件の記録があります。`;
 const box=$('#history');if(!box)return;
 if(!mine.length){box.innerHTML='<div class="card"><div class="sub">まだこの施設の記録がありません。</div></div>';return;}
 const fmt=t=>{const d=new Date(t);return `${d.getMonth()+1}月${d.getDate()}日`;};
 box.innerHTML='<div class="card">'+mine.slice(0,20).map(l=>`
   <div class="hrow">
     <div class="hdate">${fmt(l.t)}</div>
     <div class="hbody"><b>${esc(l.m)}</b>　${l.w}kg${l.r?' × '+l.r+'回':''}</div>
     <button class="ghost sm" onclick="delLog(${l.idx})" aria-label="この記録を削除">削除</button>
   </div>`).join('')+'</div>'+
  (mine.length>20?`<div class="small">ほかに ${mine.length-20} 件あります。</div>`:'');}
function delLog(idx){const log=LS.g('ogt_log',[]);log.splice(idx,1);LS.s('ogt_log',log);mach();renderHistory();}

/* ---- みんなでふやす ---- */
async function addM(){
 const f=$('#l-fac').value,nm=$('#nm').value.trim();
 if(!nm){$('#add-st').className='msg ng';$('#add-st').textContent='マシンの名前を入れてください';return;}
 const ws=$('#wl').value.trim().split(/[\s,、]+/).map(Number).filter(x=>!isNaN(x)&&x>=0);
 const m={name:nm,weights:ws.length?ws:undefined,min:ws[0]||0,max:ws[ws.length-1]||0,
          step:ws.length>1?+(ws[1]-ws[0]).toFixed(2):2.5,hasSets:true};
 const conf=confAll();conf[f]=[...(conf[f]||[]),m];LS.s('ogt_conf',conf);
 $('#nm').value=$('#wl').value='';CAT='';mach();
 if($('#cons').checked){
  try{const j=await (await fetch('/api/share',{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({facility:f,machines:[m],consent:true})})).json();
   $('#add-st').className='msg '+(j.ok?'ok':'ng');
   $('#add-st').innerHTML=j.ok?`この施設は、これまでに ${j.contributions} 人の入力で ${j.machines.length} 台が登録されています。`:j.error;
   shared();}catch(e){$('#add-st').className='msg ng';$('#add-st').textContent='共有に失敗しました（自分の記録には追加済みです）';}
 }else{$('#add-st').className='msg ok';$('#add-st').textContent='自分の記録にのみ追加しました。';}}

let _shared=null;
async function shared(){const f=$('#l-fac').value;if(!f)return;
 try{const j=await (await fetch('/api/share?facility='+encodeURIComponent(f))).json();
  const ms=j.machines||[],settings=j.settings||{};if(!j.ok||(!ms.length&&!Object.keys(settings).length)){$('#shared-box').style.display='none';return;}
  _shared=ms;
  $('#shared-body').innerHTML=`<div class="sub">延べ <b>${j.contributions}</b> 人の入力で ${ms.length} 台と施設情報が登録されています</div>`+
   '<div style="margin-top:10px">'+ms.map(m=>`<span class="tag y">${esc(m.name)}</span>`).join('')+'</div>'+
   (Object.keys(settings).length?`<div class="small">共有設定：${Object.entries(settings).map(([k,v])=>`${esc(k)} ${esc(v)}`).join('／')}</div>`:'');
  $('#shared-box').style.display='block';}catch(e){}}
function pull(){if(!_shared)return;const f=$('#l-fac').value,conf=confAll();
 const names=new Set((conf[f]||[]).map(m=>m.name));
 conf[f]=[...(conf[f]||[]),..._shared.filter(m=>!names.has(m.name))];
 LS.s('ogt_conf',conf);CAT='';mach();
 $('#add-st').className='msg ok';$('#add-st').textContent='共有データを反映しました。';}

/* ---- AIトレーナー ---- */
async function coach(){const b=$('#btn-coach'),st=$('#coach-st'),o=$('#coach-out');
 b.disabled=true;b.textContent='考えています…';st.textContent='';o.style.display='none';
 try{const f=$('#l-fac').value,conf=confAll(),ms=(conf[f]||[]).map(m=>({
   name:m.name,min:m.weights?m.weights[0]:m.min,max:m.weights?m.weights[m.weights.length-1]:m.max,
   step:m.step,weights:m.weights}));
  const log=LS.g('ogt_log',[]).filter(l=>l.f===f).slice(-12)
   .map(l=>({m:l.m,w:l.w,d:Math.floor((Date.now()-l.t)/864e5)}));
  const bodyAll=mergedBody(),profile=bodyProfile();
  const j=await (await fetch('/api/coach',{method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({facility:f,machines:ms,history:log,profile,body:bodyAll[bodyAll.length-1]||null})})).json();
  if(!j.ok)throw new Error(j.error);
  o.textContent=j.advice;o.style.display='block';
  st.className='msg ok';st.textContent='この施設のマシン構成のみを根拠に助言しました。';
 }catch(e){st.className='msg ng';st.textContent=e.message;}
 b.disabled=false;b.textContent='きょうは何をすればいい？';}

/* ============ からだ ============ */
function mergedBody(){
 const base=(OGT.body||[]).map(x=>({...x}));
 const mine=LS.g('ogt_body_user',[]);
 const seen=new Map();
 for(const b of [...base,...mine])seen.set(b.d,b); // 同日はユーザー入力を優先
 return [...seen.values()].sort((a,b)=>a.d.localeCompare(b.d));}

function renderBody(){
 const B=mergedBody();
 const kpiEl=$('#b-kpi'),chEl=$('#b-chart');
 if(!kpiEl||!chEl||!B.length)return;
 const last=B[B.length-1],first=B[0],sg=x=>x>0?'＋'+x:String(x);
 const dw=(last.w-first.w).toFixed(1),df=(last.f-first.f).toFixed(1),dm=(last.m-first.m).toFixed(1);
 kpiEl.innerHTML=`<div class="card or"><div class="numrow">
   <div><div class="num">${last.w}<u>kg</u></div><div class="l">体重　${sg(dw)}</div></div>
   <div><div class="num">${last.f}<u>%</u></div><div class="l">体脂肪率　${sg(df)}</div></div>
   <div><div class="num">${last.m}<u>kg</u></div><div class="l">筋肉量　${sg(dm)}</div></div>
  </div></div>`;
 const W=720,H=210,P=34;
 const line=(k,col)=>{const vs=B.map(b=>b[k]),mn=Math.min(...vs),mx=Math.max(...vs);
  const pts=B.map((b,i)=>[P+i*(W-2*P)/((B.length-1)||1),H-P-((b[k]-mn)/((mx-mn)||1))*(H-2*P)]);
  return `<polyline fill="none" stroke="${col}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"
   points="${pts.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ')}"/>`+
   pts.map(p=>`<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4.5" fill="#fff" stroke="${col}" stroke-width="3"/>`).join('');};
 chEl.innerHTML=`<div class="card">
   <div style="font-size:17px;font-weight:900;margin-bottom:10px">
     <span style="color:#2E8B62">●</span> 筋肉量　　<span style="color:#E8620F">●</span> 体脂肪率</div>
   <svg viewBox="0 0 ${W} ${H}" style="width:100%">${line('m','#2E8B62')}${line('f','#E8620F')}</svg>
   <div class="small">${first.d} 〜 ${last.d}（${B.length}回測定）</div></div>`;}
renderBody();

function bodyProfile(){return {age:$('#bp-age').value,sex:$('#bp-sex').value,area:$('#bp-area').value.trim()};}
function loadBodyProfile(){const p=LS.g('ogt_body_profile',LS.g('ogt_prof',{})),sex=({男性:'男',女性:'女','回答しない':'未回答'})[p.sex]||p.sex||'';$('#bp-age').value=p.age||'';$('#bp-sex').value=sex;$('#bp-area').value=p.area||'';}
function saveBodyProfile(){const p=bodyProfile();LS.s('ogt_body_profile',p);LS.s('ogt_prof',{...LS.g('ogt_prof',{}),...p});$('#bp-st').className='msg ok';$('#bp-st').textContent='この端末にプロフィールを保存しました。';}
for(const id of ['bp-age','bp-sex','bp-area'])$('#'+id).addEventListener('change',saveBodyProfile);
loadBodyProfile();

async function showBodyCompare(rec,p){const out=$('#body-compare');if(!rec||!p.age||!p.sex||!p.area){out.innerHTML='';return;}
 out.innerHTML='<div class="card"><div class="sub">同じような人との比較を集計しています…</div></div>';
 try{const q=new URLSearchParams({type:'body',age:p.age,sex:p.sex,area:p.area,weight:rec.w||'',fat:rec.f||'',muscle:rec.m||''});const j=await (await fetch('/api/cluster?'+q)).json();if(!j.ok)throw new Error(j.error||'集計できません');
  const labels={weight:['体重','kg'],fat:['体脂肪率','%'],muscle:['筋肉量','kg']};const cards=Object.entries(labels).map(([k,[l,u]])=>{const x=j.metrics[k];return `<div class="card"><div class="small">${l}</div><div class="num">${x&&x.percentile!=null?x.percentile:'—'}<u>%地点</u></div><div class="small">${x&&x.stats?`${x.stats.n}人・${esc(x.scope)}`:'比較データ待ち'}</div></div>`;}).join('');
  out.innerHTML=`<h3>同じような人との体組成比較</h3><div class="compare-grid">${cards}</div><div class="small">値が小さい・大きいこと自体を良し悪しとは判定しません。集団内での位置だけを表示します。</div>`;
 }catch(e){out.innerHTML=`<div class="msg ng">比較情報を取得できませんでした：${esc(e.message)}</div>`;}}

async function addBody(){
 const w=parseFloat($('#bw').value),fp=parseFloat($('#bf').value),mm=parseFloat($('#bm').value);
 if(!(w>0)){bodySay('体重を入力してください',0);return;}
 const d=new Date().toISOString().slice(0,10);
 const rec={d,w,f:isNaN(fp)?null:fp,m:isNaN(mm)?null:mm};
 const mine=LS.g('ogt_body_user',[]);
 const i=mine.findIndex(x=>x.d===d);
 if(i>=0)mine[i]=rec; else mine.push(rec);
 LS.s('ogt_body_user',mine);
 $('#bw').value=$('#bf').value=$('#bm').value='';
 bodySay('記録しました。',1);
 renderBody();
 if($('#body-share').checked){const p=bodyProfile();if(!p.age||!p.sex||!p.area){bodySay('端末には記録しました。匿名共有には年代・性別・居住エリアを入力してください。',0);return;}saveBodyProfile();
  try{const j=await (await fetch('/api/cluster',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({consent:true,anonId:anonIdLocal(),...p,body:{weight:w,fat:fp,muscle:mm}})})).json();if(!j.ok)throw new Error(j.error);bodySay('記録し、体組成を匿名で共有しました。比較情報を更新します。',1);showBodyCompare(rec,p);}catch(e){bodySay(`端末には記録しました。匿名共有は失敗しました：${e.message}`,0);}}
}
function anonIdLocal(){let v=localStorage.getItem('ogt_anon');if(!v){v=crypto.randomUUID?crypto.randomUUID():String(Math.random()).slice(2)+Date.now();localStorage.setItem('ogt_anon',v);}return v;}
function bodySay(t,ok){const e=$('#body-st');if(!e)return;e.className='msg '+(ok?'ok':'ng');e.textContent=t;}

/* ============ まとめて登録 ============ */
let _ai=null;
async function ai(){const b=$('#btn-ai'),st=$('#ai-st');
 b.disabled=true;b.textContent='構造化しています…';st.textContent='';
 $('#ai-out').style.display='none';$('#ai-imp').style.display='none';
 try{const j=await (await fetch('/api/parse',{method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({text:$('#say').value})})).json();
  if(!j.ok)throw new Error(j.error);
  _ai=j.data;$('#ai-out').textContent=JSON.stringify(j.data,null,1);
  $('#ai-out').style.display='block';$('#ai-imp').style.display='block';
  st.className='msg ok';st.textContent='AIが構造化しました。';
 }catch(e){st.className='msg ng';st.textContent=e.message;}
 b.disabled=false;b.textContent='AIにととのえてもらう';}
function impAI(){if(!_ai)return;const all=confAll();
 all[_ai.facility||'名前のないジム']=_ai.machines;LS.s('ogt_conf',all);
 $('#ai-st').className='msg ok';$('#ai-st').textContent=`登録しました（${_ai.machines.length}台）`;facs();}

/* ============ ナビ ============ */
function go(id){document.querySelectorAll('nav a').forEach(x=>x.classList.toggle('on',x.dataset.p===id));
 document.querySelectorAll('.pane').forEach(p=>p.classList.remove('on'));
 const el=$('#p-'+id);if(el)el.classList.add('on');}
document.querySelectorAll('nav a[data-p]').forEach(a=>a.onclick=e=>{e.preventDefault();
 go(a.dataset.p);location.hash=a.dataset.p;window.scrollTo(0,0);});
$('#l-fac').onchange=()=>{CAT='';mach();shared();renderHistory();};

(function(){if(localStorage.getItem('ogt_log'))return;const d=864e5,f='旭町南地区区民館';
 LS.s('ogt_log',[{f,m:'チェストプレス',w:26,r:10,t:Date.now()-6*d},
  {f,m:'ラットプルダウン',w:32,r:10,t:Date.now()-6*d},
  {f,m:'レッグプレス',w:68,r:12,t:Date.now()-3*d},
  {f,m:'チェストプレス',w:31,r:10,t:Date.now()-3*d}]);})();

facs();

/* 審査・説明用の深いリンク。通常利用には影響しない */
const DEMO_VIEW=new URLSearchParams(location.search).get('demo');
if(DEMO_VIEW==='map'){go('find');setFindView('map');}
if(DEMO_VIEW==='ai'){go('find');setTimeout(()=>openFacility(F[0].名称),0);}
(function(){const h=(location.hash||'').replace('#','');
 if(h==='coach'){go('log');setTimeout(()=>coach(),500);return;}
 if(h==='conf-demo'){go('conf');setTimeout(()=>ai(),300);return;}
 if(['home','find','log','body','conf'].includes(h))go(h);})();
