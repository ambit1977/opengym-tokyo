const $=s=>document.querySelector(s);
const LS={g:(k,d)=>JSON.parse(localStorage.getItem(k)||JSON.stringify(d)),s:(k,v)=>localStorage.setItem(k,JSON.stringify(v))};
const esc=t=>String(t==null?'':t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
for(let a=10;a<=70;a+=10)$('#age').insertAdjacentHTML('beforeend',`<option value="${a}">${a}代</option>`);
function anonId(){let v=localStorage.getItem('ogt_anon');
 if(!v){v=(crypto.randomUUID?crypto.randomUUID():String(Math.random()).slice(2)+Date.now());
 localStorage.setItem('ogt_anon',v);}return v;}
function bests(){const log=LS.g('ogt_log',[]),m={};
 for(const l of log){if(!l.m||!(l.w>0))continue;
  if(!m[l.m]||l.w>m[l.m].weight)m[l.m]={machine:l.m,weight:l.w,reps:l.r||0};}
 return Object.values(m);}
const say=(el,t,ok)=>{const e=$(el);e.className='msg '+(ok?'ok':'ng');e.innerHTML=t;};

if(new URLSearchParams(location.search).get('demo')){
 if(!LS.g('ogt_log',[]).length){const d=864e5,f='旭町南地区区民館';
  LS.s('ogt_log',[{f,m:'チェストプレス',w:31,r:10,t:Date.now()-3*d},
   {f,m:'ラットプルダウン',w:32,r:10,t:Date.now()-6*d},{f,m:'レッグプレス',w:68,r:12,t:Date.now()-3*d}]);}
 LS.s('ogt_prof',{age:'40',sex:'男性',goal:'筋力アップ'});}

const P=LS.g('ogt_prof',null);
if(P){$('#age').value=P.age||'';$('#sex').value=P.sex||'';$('#goal').value=P.goal||'';
 $('#cons').checked=true;say('#join-st','参加中です。',1);}

async function join(){
 if(!$('#cons').checked){say('#join-st','同意にチェックを入れてください',0);return;}
 const rec=bests();
 if(!rec.length){say('#join-st','先に「記録」で1件記録してください',0);return;}
 const prof={age:$('#age').value,sex:$('#sex').value,goal:$('#goal').value};
 LS.s('ogt_prof',prof);
 try{const j=await (await fetch('/api/cluster',{method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({consent:true,anonId:anonId(),...prof,records:rec})})).json();
  say('#join-st',j.ok?`${j.machines.length}種目を匿名で共有しました。`:esc(j.error),j.ok);fillMach();
 }catch(e){say('#join-st','共有に失敗しました',0);}}
function leave(){localStorage.removeItem('ogt_prof');$('#cons').checked=false;
 say('#join-st','参加を停止しました。以後は共有されません。',1);}

function fillMach(){const b=bests();
 $('#mach').innerHTML='<option value="">選択してください</option>'+
  b.map(x=>`<option value="${esc(x.machine)}" data-w="${x.weight}">${esc(x.machine)}（自己ベスト ${x.weight}kg）</option>`).join('');}
fillMach();

async function showPos(){
 const el=$('#mach'),m=el.value;if(!m){$('#pos').innerHTML='';return;}
 const my=+el.selectedOptions[0].dataset.w,p=LS.g('ogt_prof',{});
 $('#pos').innerHTML='<div class="sub">集計しています…</div>';
 try{const q=new URLSearchParams({machine:m,weight:my,age:p.age||'',sex:p.sex||'',goal:p.goal||''});
  const j=await (await fetch('/api/cluster?'+q)).json();
  if(!j.ok||!j.stats){$('#pos').innerHTML='<div class="sub">まだ比較できるデータがありません。</div>';return;}
  const s=j.stats,lo=s.min,hi=s.max,rng=(hi-lo)||1,px=x=>((x-lo)/rng*100);
  const rank=j.percentile==null?null:Math.max(1,Math.round(s.n*(100-j.percentile)/100));
  const W=680,H=120;
  $('#pos').innerHTML=`
   <div class="num" style="color:#E8620F">${rank?`${s.n}人中 ${rank}番`:'—'}<u>${esc(j.scope)}のなかで</u></div>
   <svg viewBox="0 0 ${W} ${H}" style="width:100%;margin-top:10px" role="img" aria-label="みんなの中での位置">
     <rect x="20" y="56" width="${W-40}" height="14" rx="7" fill="#F1ECE5"/>
     <rect x="${20+px(s.q1)/100*(W-40)}" y="56" width="${(px(s.q3)-px(s.q1))/100*(W-40)}" height="14" rx="7" fill="#C6DCF0"/>
     <line x1="${20+px(s.med)/100*(W-40)}" y1="48" x2="${20+px(s.med)/100*(W-40)}" y2="78" stroke="#2B6CB0" stroke-width="4" stroke-linecap="round"/>
     <g transform="translate(${20+px(my)/100*(W-40)},0)">
       <circle cx="0" cy="30" r="11" fill="#E8620F"/><rect x="-9" y="44" width="18" height="26" rx="8" fill="#E8620F"/>
       <text x="0" y="16" font-size="15" font-weight="900" fill="#E8620F" text-anchor="middle">あなた ${my}kg</text>
     </g>
     <text x="20" y="98" font-size="14" fill="#6B6560" font-weight="700">かるい ${s.min}kg</text>
     <text x="${20+px(s.med)/100*(W-40)}" y="98" font-size="14" fill="#2B6CB0" font-weight="700" text-anchor="middle">まんなか ${s.med}kg</text>
     <text x="${W-20}" y="98" font-size="14" fill="#6B6560" font-weight="700" text-anchor="end">おもい ${s.max}kg</text>
   </svg>
   <div class="small">青いおびは、まんなかあたりの半分の人（${s.q1}〜${s.q3}kg）。<br>
   この種目は、ぜんぶで ${j.total} 人が出しています。</div>`;
 }catch(e){$('#pos').innerHTML='<div class="msg ng">集計に失敗しました</div>';}}
$('#mach').onchange=showPos;
if(new URLSearchParams(location.search).get('demo'))
 setTimeout(()=>{const o=$('#mach').querySelector('option[value="チェストプレス"]');
  if(o){$('#mach').value='チェストプレス';showPos();}},250);

async function loadEv(){
 try{const j=await (await fetch('/api/event')).json();if(!j.ok)throw 0;
  const pct=Math.min(100,Math.round(j.total/(j.goal||1)*100));
  $('#ev').innerHTML=`
   <div class="ttl">${esc(j.title)}</div>
   <div class="sub">${esc(j.body)}</div>
   <div class="track" style="margin:16px 0 8px"><i class="f-or" style="width:${pct}%"></i></div>
   <div class="sub">みんなで <b>${j.total}</b> / ${j.goal}${esc(j.unit)}　　参加 ${j.people} 人</div>
   <div style="display:flex;gap:12px;align-items:center;margin-top:16px;flex-wrap:wrap">
     <input id="amt" type="number" value="10" min="1" max="500" inputmode="numeric" style="width:120px;margin:0">
     <span style="font-size:18px;font-weight:700">${esc(j.unit)}やった</span>
     <button class="green" onclick="push()">つたえる</button>
   </div>
   <div id="cheer"></div>
   <div class="small" style="margin-top:12px">この企画はAIが毎週生成しています。</div>`;
 }catch(e){$('#ev').innerHTML='<div class="msg ng">読み込みに失敗しました</div>';}}
loadEv();

async function push(){const a=+($('#amt').value||0);
 $('#cheer').innerHTML='<div class="sub">送信しています…</div>';
 try{const j=await (await fetch('/api/event',{method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({anonId:anonId(),amount:a})})).json();
  if(!j.ok)throw new Error(j.error);
  $('#cheer').innerHTML=`<div class="card" style="background:#fff;margin-top:14px">
    <div style="font-size:19px;font-weight:900;line-height:1.7">${esc(j.cheer)}</div>
    <div class="small" style="margin-top:6px">みんなより</div></div>`;
  loadEv();}catch(e){$('#cheer').innerHTML='<div class="msg ng">'+esc(e.message)+'</div>';}}
