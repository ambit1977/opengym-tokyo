const $=s=>document.querySelector(s), C=OGT.coverage, F=OGT.facilities, D=OGT.detail||{};
const LS={g:(k,d)=>JSON.parse(localStorage.getItem(k)||JSON.stringify(d)),s:(k,v)=>localStorage.setItem(k,JSON.stringify(v))};
const esc=t=>String(t==null?'':t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* からだの図：部位を色でしめす */
const PART={upper:'up',lower:'lo',core:'co',arm:'ar',cardio:'all'};
function figure(cat){
  const p=PART[cat]||'';
  const css=p==='all'
    ? '.fig-'+cat+' .up,.fig-'+cat+' .lo,.fig-'+cat+' .co,.fig-'+cat+' .ar{fill:#E8620F}'
    : (p?'.fig-'+cat+' .'+p+'{fill:#E8620F}':'');
  return `<svg class="fig fig-${cat}" viewBox="0 0 44 70"><style>${css}</style><use href="#fig"/></svg>`;
}

/* ============ まちのジム ============ */
$('#k-gym').textContent=C.gyms; $('#k-mun').textContent=C.municipalities;
const SHOW=[['所在地_連結表記','じゅうしょ'],['電話番号','でんわ番号'],['開始時間','あいている時間'],
            ['更衣室','こういしつ'],['シャワー室','シャワー'],['車椅子可','車いすで使えるか']];
$('#bars').innerHTML=SHOW.filter(([k])=>C.coverage[k]).map(([k,ja])=>{const v=C.coverage[k];
  const c=v.pct<40?'f-or':v.pct<75?'f-bl':'f-gr';
  return `<div class="bar"><div class="t"><b>${ja}</b><i>${v.pct}% が記入ずみ</i></div>
  <div class="track"><i class="${c}" style="width:${v.pct}%"></i></div></div>`}).join('');
$('#src').innerHTML=`出典：東京都オープンデータカタログサイト（各区市町村提供）／CC BY 4.0<br>
${C.municipalities}の区市・${C.facilities}の施設の公開データを、すべての項目について数えました。`;

/* ============ さがす ============ */
const muns=[...new Set(F.map(f=>f.自治体))].sort();
$('#f-mun').innerHTML=`<option value="">ぜんぶ見る（${F.length}か所）</option>`+muns.map(m=>`<option>${m}</option>`).join('');
const tag=(v,l)=>`<span class="tag ${v?'y':'n'}">${l}${v?' あり':' わからない'}</span>`;
function draw(){const m=$('#f-mun').value;
 const list=F.filter(f=>!m||f.自治体===m);
 $('#list').innerHTML=list.map(f=>`<div class="card">
  <div class="ttl">${esc(f.名称)}</div>
  <div class="sub">${esc(f.自治体)}　${esc(f['所在地_連結表記']||'')}</div>
  <div style="margin-top:12px">${tag(f.更衣室,'こういしつ')}${tag(f['シャワー室'],'シャワー')}${tag(f.車椅子可,'車いす')}${tag(f.開始時間,'時間の記載')}</div>
 </div>`).join('')||'<div class="card"><div class="sub">見つかりませんでした。</div></div>';}
$('#f-mun').onchange=draw; draw();

/* ============ きろく ============ */
let CAT='';
function confAll(){const c=LS.g('ogt_conf',{});
 for(const id in D){const d=D[id];if(!c[d.name])c[d.name]=d.machines;}
 LS.s('ogt_conf',c);return c;}
function detailOf(n){for(const id in D)if(D[id].name===n)return D[id];return null;}
function facs(){const c=confAll(),k=Object.keys(c);
 $('#l-fac').innerHTML=k.map(x=>`<option>${esc(x)}</option>`).join('');mach();shared();}

function facInfo(d){
 if(!d){$('#fac-info').innerHTML='';return;}
 $('#fac-info').innerHTML=`<div class="card cream">
  <div class="ttl">${esc(d.name)}</div>
  <div class="sub" style="margin-top:8px">
   ${esc(d.address)}　${esc(d.phone)}<br>
   <b>あいている時間</b>　${(d.gymHours||[]).map(esc).join('／')}<br>
   <b>りょうきん</b>　${(d.gymFee||[]).map(esc).join('／')}<br>
   <b>もちもの</b>　${esc(d.gymBelongings||'—')}</div>
  <div class="small" style="margin-top:10px">${esc(d.gymProcedure||'')}<br>${(d.gymNotes||[]).map(esc).join('　')}</div>
 </div>`;}

function mach(){
 const conf=confAll(),f=$('#l-fac').value,d=detailOf(f);
 facInfo(d);
 let ms=conf[f]||[];
 const cats=d&&d.categories;
 $('#cats').innerHTML=cats?['',...Object.keys(cats)].map(k=>
  `<span class="chip ${CAT===k?'sel':''}" onclick="CAT='${k}';mach()">${k?esc(cats[k].label):'ぜんぶ'}</span>`).join(''):'';
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
     ${m.videoUrl?`<a class="howto" href="${esc(m.videoUrl)}" target="_blank" rel="noopener">▶ つかい方の動画</a>`:''}
    </div></div>
   <div class="picker">
     <button class="rnd" onclick="adj(${i},-1)" aria-label="重さをへらす">−</button>
     <div class="wv" id="w${i}">${cur}<u>${esc(unit)}</u></div>
     <button class="rnd" onclick="adj(${i},1)" aria-label="重さをふやす">＋</button>
     ${m.hasSets!==false?`<div class="reps">× <input type="number" id="r${i}" value="${last&&last.r||10}" min="1" inputmode="numeric"> 回</div>`:''}
     <div style="flex:1"></div>
     <button class="green" onclick="save(${i})">きろくする</button>
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
  ?`<div class="up">まえより ${(w-prev.w).toFixed(1)}${''}kg ふえました</div>`
  :`<div class="msg ok">きろくしました</div>`;
 $('#log-st').textContent=`これまでに ${log.length} 件をこの端末にほぞんしています。`;}

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
   $('#add-st').innerHTML=j.ok?`ありがとうございます。このジムは、これまでに ${j.contributions} 人が教えてくれて ${j.machines.length} 台になりました。`:j.error;
   shared();}catch(e){$('#add-st').className='msg ng';$('#add-st').textContent='おくれませんでした（じぶんの記録にはふえています）';}
 }else{$('#add-st').className='msg ok';$('#add-st').textContent='じぶんの記録にだけふやしました。';}}

let _shared=null;
async function shared(){const f=$('#l-fac').value;if(!f)return;
 try{const j=await (await fetch('/api/share?facility='+encodeURIComponent(f))).json();
  if(!j.ok||!j.machines||!j.machines.length){$('#shared-box').style.display='none';return;}
  _shared=j.machines;
  $('#shared-body').innerHTML=`<div class="sub">これまでに <b>${j.contributions}</b> 人が教えてくれました（${j.machines.length}台）</div>`+
   '<div style="margin-top:10px">'+j.machines.map(m=>`<span class="tag y">${esc(m.name)}</span>`).join('')+'</div>';
  $('#shared-box').style.display='block';}catch(e){}}
function pull(){if(!_shared)return;const f=$('#l-fac').value,conf=confAll();
 const names=new Set((conf[f]||[]).map(m=>m.name));
 conf[f]=[...(conf[f]||[]),..._shared.filter(m=>!names.has(m.name))];
 LS.s('ogt_conf',conf);CAT='';mach();
 $('#add-st').className='msg ok';$('#add-st').textContent='みんなのマシンをとりこみました。';}

/* ---- AIトレーナー ---- */
async function coach(){const b=$('#btn-coach'),st=$('#coach-st'),o=$('#coach-out');
 b.disabled=true;b.textContent='かんがえています…';st.textContent='';o.style.display='none';
 try{const f=$('#l-fac').value,conf=confAll(),ms=(conf[f]||[]).map(m=>({
   name:m.name,min:m.weights?m.weights[0]:m.min,max:m.weights?m.weights[m.weights.length-1]:m.max,
   step:m.step,weights:m.weights}));
  const log=LS.g('ogt_log',[]).filter(l=>l.f===f).slice(-12)
   .map(l=>({m:l.m,w:l.w,d:Math.floor((Date.now()-l.t)/864e5)}));
  const j=await (await fetch('/api/coach',{method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({facility:f,machines:ms,history:log})})).json();
  if(!j.ok)throw new Error(j.error);
  o.textContent=j.advice;o.style.display='block';
  st.className='msg ok';st.textContent='このジムにあるマシンだけを見て答えました。';
 }catch(e){st.className='msg ng';st.textContent=e.message;}
 b.disabled=false;b.textContent='きょうは何をすればいい？';}

/* ============ からだ ============ */
(function(){const B=OGT.body||[];if(!B.length)return;
 const last=B[B.length-1],first=B[0],sg=x=>x>0?'＋'+x:String(x);
 const dw=(last.w-first.w).toFixed(1),df=(last.f-first.f).toFixed(1),dm=(last.m-first.m).toFixed(1);
 $('#b-kpi').innerHTML=`<div class="card or"><div class="numrow">
   <div><div class="num">${last.w}<u>kg</u></div><div class="l">たいじゅう　${sg(dw)}</div></div>
   <div><div class="num">${last.f}<u>%</u></div><div class="l">たいしぼう率　${sg(df)}</div></div>
   <div><div class="num">${last.m}<u>kg</u></div><div class="l">きんにく量　${sg(dm)}</div></div>
  </div></div>`;
 const W=720,H=210,P=34;
 const line=(k,col)=>{const vs=B.map(b=>b[k]),mn=Math.min(...vs),mx=Math.max(...vs);
  const pts=B.map((b,i)=>[P+i*(W-2*P)/(B.length-1),H-P-((b[k]-mn)/((mx-mn)||1))*(H-2*P)]);
  return `<polyline fill="none" stroke="${col}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"
   points="${pts.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ')}"/>`+
   pts.map(p=>`<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4.5" fill="#fff" stroke="${col}" stroke-width="3"/>`).join('');};
 $('#b-chart').innerHTML=`<div class="card">
   <div style="font-size:17px;font-weight:900;margin-bottom:10px">
     <span style="color:#2E8B62">●</span> きんにく量　　<span style="color:#E8620F">●</span> たいしぼう率</div>
   <svg viewBox="0 0 ${W} ${H}" style="width:100%">${line('m','#2E8B62')}${line('f','#E8620F')}</svg>
   <div class="small">${first.d} 〜 ${last.d}（${B.length}回はかりました）</div></div>`;})();

/* ============ まとめて登録 ============ */
let _ai=null;
async function ai(){const b=$('#btn-ai'),st=$('#ai-st');
 b.disabled=true;b.textContent='ととのえています…';st.textContent='';
 $('#ai-out').style.display='none';$('#ai-imp').style.display='none';
 try{const j=await (await fetch('/api/parse',{method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({text:$('#say').value})})).json();
  if(!j.ok)throw new Error(j.error);
  _ai=j.data;$('#ai-out').textContent=JSON.stringify(j.data,null,1);
  $('#ai-out').style.display='block';$('#ai-imp').style.display='block';
  st.className='msg ok';st.textContent='AIがととのえました。';
 }catch(e){st.className='msg ng';st.textContent=e.message;}
 b.disabled=false;b.textContent='AIにととのえてもらう';}
function impAI(){if(!_ai)return;const all=confAll();
 all[_ai.facility||'名前のないジム']=_ai.machines;LS.s('ogt_conf',all);
 $('#ai-st').className='msg ok';$('#ai-st').textContent=`とうろくしました（${_ai.machines.length}台）`;facs();}

/* ============ ナビ ============ */
function go(id){document.querySelectorAll('nav a').forEach(x=>x.classList.toggle('on',x.dataset.p===id));
 document.querySelectorAll('.pane').forEach(p=>p.classList.remove('on'));
 const el=$('#p-'+id);if(el)el.classList.add('on');}
document.querySelectorAll('nav a[data-p]').forEach(a=>a.onclick=e=>{e.preventDefault();
 go(a.dataset.p);location.hash=a.dataset.p;window.scrollTo(0,0);});

(function(){if(localStorage.getItem('ogt_log'))return;const d=864e5,f='旭町南地区区民館';
 LS.s('ogt_log',[{f,m:'チェストプレス',w:26,r:10,t:Date.now()-6*d},
  {f,m:'ラットプルダウン',w:32,r:10,t:Date.now()-6*d},
  {f,m:'レッグプレス',w:68,r:12,t:Date.now()-3*d},
  {f,m:'チェストプレス',w:31,r:10,t:Date.now()-3*d}]);})();

facs();
(function(){const h=(location.hash||'').replace('#','');
 if(h==='coach'){go('log');setTimeout(()=>coach(),500);return;}
 if(h==='conf-demo'){go('conf');setTimeout(()=>ai(),300);return;}
 if(['home','find','log','body','conf'].includes(h))go(h);})();
