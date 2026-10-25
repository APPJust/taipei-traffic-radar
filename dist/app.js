const SOURCE='https://tcgbusfs.blob.core.windows.net/blobtisv/GetVD.xml.gz';
const $=id=>document.getElementById(id);
let rows=[],history=[],dataDate=null,lastFetch=null,nextUpdate=Date.now()+60000,busy=false,limit=30,failed=false;
const fmtDate=d=>d?new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(d):'—';
const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const read=(node,name)=>node.getElementsByTagNameNS('*',name)[0]?.textContent.trim()||'';
const number=s=>s!==''&&Number.isFinite(Number(s))?Number(s):null;
function parseXML(xml){
 const doc=new DOMParser().parseFromString(xml,'application/xml');
 if(doc.querySelector('parsererror'))throw Error('XML 格式異常');
 const stamp=read(doc,'ExchangeTime');
 const date=new Date(stamp.replace(/\//g,'-').replace(/T?\s+/,'T')+'+08:00');
 if(!Number.isFinite(date.getTime()))throw Error('資料時間格式異常');
 const records=Array.from(doc.getElementsByTagNameNS('*','SectionData')).map((el,i)=>{
  const speed=number(read(el,'AvgSpd')),vol=number(read(el,'TotalVol'));
  return{id:read(el,'SectionId')||String(i),name:read(el,'SectionName')||'未命名路段',speed,vol,valid:speed!==null&&speed>=0&&!(speed===0&&(vol===null||vol<=0))};
 });
 if(!records.length)throw Error('來源未包含路段資料');
 return{records,date};
}
function selectRows(){let q=$('search').value.trim().toLocaleLowerCase(),f=$('filter').value;return rows.filter(r=>(r.name+' '+r.id).toLocaleLowerCase().includes(q)&&(f==='all'||(f==='slow'&&r.valid&&r.speed<20)||(f==='normal'&&r.valid&&r.speed>=20)||(f==='invalid'&&!r.valid))).sort((a,b)=>$('sort').value==='name'?a.name.localeCompare(b.name,'zh-Hant'):(Number(b.valid)-Number(a.valid))||($('sort').value==='desc'?b.speed-a.speed:a.speed-b.speed)||a.id.localeCompare(b.id));}
function render(){
 const valid=rows.filter(r=>r.valid),slow=valid.filter(r=>r.speed<20),average=valid.length?valid.reduce((a,r)=>a+r.speed,0)/valid.length:null;
 $('total').textContent=rows.length.toLocaleString();$('coverage').textContent=`有效車速 ${valid.length} 段 · 無效 ${rows.length-valid.length} 段`;
 $('average').textContent=average===null?'—':average.toFixed(1);$('slow').textContent=slow.length;
 const min=[...valid].sort((a,b)=>a.speed-b.speed)[0];$('minimum').textContent=min?min.speed.toFixed(1):'—';$('slowestName').textContent=min?.name||'無有效車速';
 const selected=selectRows();$('resultCount').textContent=`${selected.length} / ${rows.length} 路段`;
 $('roads').innerHTML=selected.length?selected.slice(0,limit).map((r,i)=>`<article class="road ${!r.valid?'invalid':r.speed<20?'slow':''}"><span class="rank">${String(i+1).padStart(2,'0')}</span><div><h3>${escapeHTML(r.name)}</h3><small>${escapeHTML(r.id)} · 車流量 ${r.vol!==null&&r.vol>=0?r.vol:'—'}</small></div><div class="speed">${r.valid?r.speed.toFixed(1):'—'}<small>km/h</small></div><span class="badge">${!r.valid?'無有效車速':r.speed<20?'⚠ 低速警示':'正常'}</span></article>`).join(''):'<p class="empty">找不到符合條件的路段，請調整搜尋或篩選。</p>';
 $('more').hidden=selected.length<=limit;$('more').textContent=`顯示更多路段（剩餘 ${Math.max(0,selected.length-limit)}）`;
 const top=selected.filter(r=>r.valid).sort((a,b)=>a.speed-b.speed).slice(0,10),max=Math.max(20,...top.map(r=>r.speed));
 $('bars').innerHTML=top.length?top.map(r=>`<div class="barrow"><span class="barname" title="${escapeHTML(r.name)}">${escapeHTML(r.name)}</span><div class="track"><div class="fill ${r.speed<20?'slow':''}" style="width:${Math.max(1,r.speed/max*100)}%"></div></div><b>${r.speed.toFixed(1)}</b></div>`).join(''):'<p class="empty">沒有符合條件的有效車速</p>';
 drawTrend();updateStatus();
}
function drawTrend(){
 const w=600,h=270,left=36,right=18,top=18,bottom=35,max=Math.max(40,...history.map(p=>p.avg+10));
 const y=v=>h-bottom-v/max*(h-top-bottom),x=i=>left+(history.length===1?0:i/(history.length-1))*(w-left-right);
 let svg=[0,max/2,max].map(v=>`<line x1="${left}" x2="${w-right}" y1="${y(v)}" y2="${y(v)}" stroke="#e8eeeb"/><text x="4" y="${y(v)+4}">${Math.round(v)}</text>`).join('');
 svg+=`<line x1="${left}" x2="${w-right}" y1="${y(20)}" y2="${y(20)}" stroke="#bd4938" stroke-dasharray="5 5"/>`;
 if(history.length){svg+=`<polyline fill="none" stroke="#287866" stroke-width="3" points="${history.map((p,i)=>`${x(i)},${y(p.avg)}`).join(' ')}"/>`;
 history.forEach((p,i)=>{svg+=`<circle cx="${x(i)}" cy="${y(p.avg)}" r="4" fill="#287866"><title>${escapeHTML(fmtDate(new Date(p.t)))}：${p.avg.toFixed(1)} km/h</title></circle>`;});
 [0,...(history.length>1?[history.length-1]:[])].forEach((i,k)=>{svg+=`<text x="${x(i)}" y="${h-8}" text-anchor="${k?'end':'start'}">${new Date(history[i].t).toLocaleTimeString('zh-TW',{timeZone:'Asia/Taipei',hour12:false})}</text>`;});}
 else svg+='<text x="300" y="130" text-anchor="middle">等待第一次成功更新</text>';
 $('trend').innerHTML=svg;$('trendNote').textContent=history.length?`已記錄 ${history.length} 筆成功擷取；${history.length===1?'下一次更新後連成折線。':'各點為當次全市有效路段的平均車速。'}`:'開啟後開始記錄；累積兩筆資料即可連成折線。';
}
function updateStatus(){
 $('dataTime').textContent=fmtDate(dataDate);$('fetchTime').textContent=fmtDate(lastFetch);
 const stale=dataDate&&Date.now()-dataDate.getTime()>30*60000;
 $('status').textContent=busy?'正在更新即時路況…':failed?'更新失敗，稍後自動重試':lastFetch?'● 已連線 · 臺北市全市路段':'等待即時資料';
 $('warning').hidden=!(stale||failed);$('warning').textContent=[failed?`更新失敗，稍後自動重試。${lastFetch?'目前保留上一次成功資料。':'尚無成功資料，請檢查網路連線。'}`:'',stale?'資料可能延遲：來源資料時間已超過 30 分鐘。':''].filter(Boolean).join(' ');
}
async function refresh(){if(busy)return;busy=true;$('refresh').disabled=true;updateStatus();
 try{
  const res=await fetch(SOURCE,{cache:'no-store',signal:AbortSignal.timeout(20000)});if(!res.ok)throw Error(`HTTP ${res.status}`);
  const buffer=new Uint8Array(await res.arrayBuffer());let text;
  if(buffer[0]===0x1f&&buffer[1]===0x8b){if(!globalThis.DecompressionStream)throw Error('瀏覽器不支援 gzip 解壓縮');text=await new Response(new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'))).text();}else text=new TextDecoder().decode(buffer);
  const parsed=parseXML(text);rows=parsed.records;dataDate=parsed.date;lastFetch=new Date();failed=false;
  const valid=rows.filter(r=>r.valid);if(valid.length){history.push({t:lastFetch.getTime(),avg:valid.reduce((a,r)=>a+r.speed,0)/valid.length});history=history.slice(-120);}render();
 }catch(e){failed=true;console.warn('路況更新失敗:',e.message);updateStatus();}
 finally{busy=false;$('refresh').disabled=false;nextUpdate=Date.now()+60000;updateStatus();}
}
['search','filter','sort'].forEach(id=>$(id).addEventListener(id==='search'?'input':'change',()=>{limit=30;render();}));
 $('more').addEventListener('click',()=>{limit+=30;render();});$('refresh').addEventListener('click',refresh);
 setInterval(()=>{const seconds=Math.max(0,Math.ceil((nextUpdate-Date.now())/1000));$('countdown').textContent=seconds;if(!seconds&&!busy)refresh();else updateStatus();},1000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()>=nextUpdate)refresh();});refresh();

