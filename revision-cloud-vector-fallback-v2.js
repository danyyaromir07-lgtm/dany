const CHECKBOX='#batchRemoveRevisionClouds';
const STATUS='#batchStatus';
const SUMMARY='#batchSummary';
const EPS=1e-6;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let mupdfPromise=null;
const VERSION='union-density-2+sweep-perf1';
const now=()=>performance?.now?.()??Date.now();

function q(s){return document.querySelector(s);}
function diag(event){try{window.__cloudDiagnostic?.(event);}catch(_){}}
function sameNumber(a,b){return Math.abs(Number(a)-Number(b))<=EPS;}
function isRed(rgb){if(!rgb||rgb.length<3)return false;const[r,g,b]=Array.from(rgb).slice(0,3).map(Number);return r>=.50&&r>=g+.12&&r>=b+.12;}
function colorKey(cs,color){const name=String(cs||'');if(!/DeviceRGB|RGB/i.test(name)||!color||typeof color.length!=='number'||color.length<3)return null;return Array.from(color).slice(0,3).map(v=>Number(v).toPrecision(12)).join('|');}
function widthKey(w){return Number(w||0).toPrecision(12);}
function unionRect(a,b){if(!a)return b.slice();return[Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[2],b[2]),Math.max(a[3],b[3])];}
function rectGap(a,b){const dx=Math.max(0,Math.max(a[0],b[0])-Math.min(a[2],b[2])),dy=Math.max(0,Math.max(a[1],b[1])-Math.min(a[3],b[3]));return Math.hypot(dx,dy);}
function area(r){return Math.max(0,r[2]-r[0])*Math.max(0,r[3]-r[1]);}
function rectUnionArea(rects){
  if(!Array.isArray(rects)||!rects.length)return 0;
  const xs=[];for(const r of rects){if(!r||r.length<4)continue;if(Number.isFinite(r[0])&&Number.isFinite(r[2]))xs.push(r[0],r[2]);}
  xs.sort((a,b)=>a-b);const unique=[];for(const x of xs)if(!unique.length||Math.abs(x-unique.at(-1))>EPS)unique.push(x);
  let total=0;
  for(let i=0;i+1<unique.length;i++){
    const x0=unique[i],x1=unique[i+1];if(x1<=x0)continue;const spans=[];
    for(const r of rects){if(!r||r.length<4||r[0]>=x1||r[2]<=x0)continue;const y0=Number(r[1]),y1=Number(r[3]);if(Number.isFinite(y0)&&Number.isFinite(y1)&&y1>y0)spans.push([y0,y1]);}
    if(!spans.length)continue;spans.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);let y0=spans[0][0],y1=spans[0][1],covered=0;
    for(let j=1;j<spans.length;j++){const s=spans[j];if(s[0]<=y1+EPS){if(s[1]>y1)y1=s[1];}else{covered+=Math.max(0,y1-y0);y0=s[0];y1=s[1];}}
    covered+=Math.max(0,y1-y0);total+=(x1-x0)*covered;
  }
  return total;
}
async function loadMuPDF(){if(!mupdfPromise)mupdfPromise=import('https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js');return mupdfPromise;}
function collectFamilies(mupdf,page){
  const groups=new Map();
  const device=new mupdf.Device({strokePath(path,stroke,ctm,colorSpace,color,alpha){
    const ck=colorKey(colorSpace,color);if(!ck||!isRed(color))return;let bbox;try{bbox=Array.from(path.getBounds(stroke,ctm));}catch(_){return;}if(!bbox||bbox.length<4)return;
    const w=Number(stroke?.getLineWidth?.()??stroke?.lineWidth??0),key=`${ck}::${widthKey(w)}`,rec={bbox,rgb:[Number(color[0]),Number(color[1]),Number(color[2])],lineWidth:w,alpha:Number(alpha??1)};
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push(rec);
  }});
  page.runPageContents(device,mupdf.Matrix.identity);device.close?.();return groups;
}

/* Exact replacement for the old O(n²) flood scan.
   Sweep-line only removes impossible x-separated pairs; the final edge test is still rectGap <= gapLimit. */
function connectedComponents(strokes,gapLimit){
  const n=strokes.length;if(!n)return[];
  const parent=Int32Array.from({length:n},(_,i)=>i),rank=new Uint8Array(n),order=Array.from({length:n},(_,i)=>i).sort((a,b)=>strokes[a].bbox[0]-strokes[b].bbox[0]);
  const find=x=>{let r=x;while(parent[r]!==r)r=parent[r];while(parent[x]!==x){const p=parent[x];parent[x]=r;x=p;}return r;};
  const union=(a,b)=>{let ra=find(a),rb=find(b);if(ra===rb)return;if(rank[ra]<rank[rb]){const t=ra;ra=rb;rb=t;}parent[rb]=ra;if(rank[ra]===rank[rb])rank[ra]++;};
  let active=[];
  for(const i of order){
    const r=strokes[i].bbox,minX=r[0]-gapLimit,next=[];
    for(const j of active){
      const b=strokes[j].bbox;if(b[2]<minX)continue;next.push(j);
      const dy=Math.max(0,Math.max(r[1],b[1])-Math.min(r[3],b[3]));if(dy<=gapLimit&&rectGap(r,b)<=gapLimit)union(i,j);
    }
    next.push(i);active=next;
  }
  const map=new Map();for(let i=0;i<n;i++){const r=find(i);if(!map.has(r))map.set(r,[]);map.get(r).push(strokes[i]);}
  return [...map.values()].sort((a,b)=>b.length-a.length);
}

function evaluateFamily(key,strokes,pageBounds){
  const base={key,strokes:strokes.length,rgb:strokes[0]?.rgb,lineWidth:strokes[0]?.lineWidth};
  if(strokes.length<20)return{candidate:null,reason:'menos de 20 trazos',metrics:base};
  if(strokes.length>1200)return{candidate:null,reason:'más de 1200 trazos',metrics:base};
  const lw=Math.abs(Number(strokes[0].lineWidth||0)),gapLimit=Math.max(8,Math.min(22,lw*30+8)),comps=connectedComponents(strokes,gapLimit);
  if(!comps.length)return{candidate:null,reason:'sin componentes conectados',metrics:{...base,gapLimit}};
  const main=comps[0],mainRatio=main.length/strokes.length;
  if(main.length<20)return{candidate:null,reason:'componente principal menor de 20 trazos',metrics:{...base,gapLimit,components:comps.length,main:main.length,mainRatio}};
  if(mainRatio<.90)return{candidate:null,reason:`familia dispersa ${main.length}/${strokes.length}`,metrics:{...base,gapLimit,components:comps.length,main:main.length,mainRatio}};
  let union=null,sumBoxArea=0;for(const s of main){union=unionRect(union,s.bbox);sumBoxArea+=area(s.bbox);}
  const w=Math.max(1,union[2]-union[0]),h=Math.max(1,union[3]-union[1]);
  if(w<40||h<40)return{candidate:null,reason:'bbox menor de 40×40',metrics:{...base,gapLimit,components:comps.length,main:main.length,mainRatio,bbox:union,width:w,height:h}};
  const pageArea=Math.max(1,area(pageBounds)),frac=area(union)/pageArea;
  if(frac<.00015)return{candidate:null,reason:'familia demasiado pequeña respecto a la página',metrics:{...base,gapLimit,components:comps.length,main:main.length,mainRatio,bbox:union,width:w,height:h,fraction:frac}};
  if(frac>.08)return{candidate:null,reason:'familia ocupa demasiado de la página',metrics:{...base,gapLimit,components:comps.length,main:main.length,mainRatio,bbox:union,width:w,height:h,fraction:frac}};
  const bboxArea=Math.max(1,area(union)),rawDensity=sumBoxArea/bboxArea,occupiedArea=rectUnionArea(main.map(s=>s.bbox)),sparse=occupiedArea/bboxArea;
  if(sparse>.25)return{candidate:null,reason:'densidad de unión demasiado alta',metrics:{...base,gapLimit,components:comps.length,main:main.length,mainRatio,bbox:union,width:w,height:h,fraction:frac,density:sparse,rawDensity,occupiedArea}};
  const aspect=Math.min(w,h)/Math.max(w,h);
  if(aspect<.10)return{candidate:null,reason:'geometría demasiado lineal/alargada',metrics:{...base,gapLimit,components:comps.length,main:main.length,mainRatio,bbox:union,width:w,height:h,fraction:frac,density:sparse,rawDensity,occupiedArea,aspect}};
  const outside=strokes.length-main.length,outsideLimit=Math.max(2,Math.floor(strokes.length*.05));
  if(outside>outsideLimit)return{candidate:null,reason:`demasiados trazos fuera del componente principal (${outside})`,metrics:{...base,gapLimit,components:comps.length,main:main.length,mainRatio,bbox:union,width:w,height:h,fraction:frac,density:sparse,rawDensity,occupiedArea,aspect,outside,outsideLimit}};
  return{candidate:{key,bbox:union,rgb:main[0].rgb,lineWidth:main[0].lineWidth,strokeCount:main.length,sparse,fraction:frac,source:'vector-family'},reason:null,metrics:{...base,gapLimit,components:comps.length,main:main.length,mainRatio,bbox:union,width:w,height:h,fraction:frac,density:sparse,rawDensity,occupiedArea,aspect,outside,outsideLimit}};
}

export async function detectVectorCloudFallback(data,context={}){
  const t0=now(),mupdf=await loadMuPDF(),doc=mupdf.PDFDocument.openDocument(new Uint8Array(data),'application/pdf'),out=[],debugPages=[];
  try{
    for(let i=0;i<doc.countPages();i++){
      const pt=now(),page=doc.loadPage(i),groups=collectFamilies(mupdf,page),pageBounds=Array.from(page.getBounds()),candidates=[],families=[];
      for(const[key,strokes]of groups){const ft=now(),ev=evaluateFamily(key,strokes,pageBounds);families.push({accepted:!!ev.candidate,reason:ev.reason,...ev.metrics,ms:Math.round((now()-ft)*10)/10});if(ev.candidate)candidates.push(ev.candidate);}
      const pageMs=Math.round((now()-pt)*10)/10;debugPages.push({page:i+1,groups:groups.size,candidates:candidates.length,families,ms:pageMs});
      if(context.file){
        diag({stage:'cloud.fallback.real.page',detail:`detector real · familias=${groups.size} · candidatas=${candidates.length}`,file:context.file,page:i+1,candidates:candidates.length});
        diag({stage:'cloud.perf.vector.page',detail:'vector-fallback-perf-v2-sweep',file:context.file,page:i+1,reason:`${pageMs} ms · familias=${groups.size}`});
        for(const f of families.filter(x=>x.strokes>=20&&x.strokes<=1200))diag({stage:f.accepted?'cloud.fallback.real.accept':'cloud.fallback.real.reject',detail:f.accepted?'familia aceptada por detector real':'familia rechazada por detector real',file:context.file,page:i+1,strokes:f.strokes,rgb:f.rgb,lineWidth:f.lineWidth,bbox:f.bbox,reason:f.reason,components:f.components,main:f.main,fraction:f.fraction,density:f.density,rawDensity:f.rawDensity,aspect:f.aspect,outside:f.outside});
      }
      if(candidates.length===1){const c=candidates[0];out.push({page:i+1,clouds:[{bbox:c.bbox,source:'vector-family',exactRGB:c.rgb,exactLineWidth:c.lineWidth,vectorFamilyKey:c.key,vectorStrokeCount:c.strokeCount}]});}
    }
  }finally{doc.destroy();}
  out.debugPages=debugPages;
  if(context.file)diag({stage:'cloud.perf.vector.file',detail:'vector-fallback-perf-v2-sweep',file:context.file,reason:`${Math.round((now()-t0)*10)/10} ms`});
  return out;
}

function refreshCloudReport(batch){
  let total=0;for(const item of batch)total+=Number(item?.revisionCloudCount||0);
  const status=q(STATUS);if(status&&total)status.textContent=`☁️ ${total} nube${total===1?'':'s'} de revisión detectada${total===1?'':'s'}.`;
  const summary=q(SUMMARY);if(summary){const clean=(summary.textContent||'').replace(/ · ☁️[^·]*/g,'').trim();summary.textContent=`${clean} · ☁️ ${total} nube${total===1?'':'s'} detectada${total===1?'':'s'}`;summary.classList.remove('hidden');}
}

async function runFallbackAfterRaster(){
  const started=now(),selected=q(CHECKBOX)?.checked===true;let batch=[],added=0,debug=[],status='not-selected',error=null;
  try{
    if(!selected)return;
    status='waiting-base';
    for(let i=0;i<900;i++){
      batch=Array.isArray(window.__batchAnalysis)?window.__batchAnalysis:[];
      const ready=batch.length&&batch.every(x=>x?.error||typeof x?.revisionCloudCount==='number');
      if(ready){status='running';break;}
      await sleep(100);
    }
    if(!batch.length){status='no-batch';return;}
    for(const item of batch){
      if(item?.error||!item?.data||Number(item.revisionCloudCount||0)>0)continue;
      const t=now();
      try{
        const found=await detectVectorCloudFallback(item.data,{file:item.name});debug.push({name:item.name,pages:found.debugPages||[],ms:Math.round((now()-t)*10)/10});
        if(found.length){item.revisionClouds=found;item.revisionCloudCount=found.reduce((n,p)=>n+(p.clouds?.length||0),0);item.revisionCloudVectorFallback=true;added+=item.revisionCloudCount;}
      }catch(err){item.revisionCloudVectorError=err?.message||String(err);}
      await sleep(0);
    }
    status='done';if(added)refreshCloudReport(batch);
  }catch(err){error=err?.message||String(err);status='error';throw err;}
  finally{
    const elapsed=Math.round((now()-started)*10)/10;
    window.__revisionCloudVectorFallbackDebug={added,version:VERSION,debug,batch:batch.map(x=>({name:x?.name,count:x?.revisionCloudCount||0,vector:!!x?.revisionCloudVectorFallback,error:x?.revisionCloudVectorError||null})),status,elapsedMs:elapsed,error};
    diag({stage:'cloud.fallback.done',detail:'vector-fallback-perf-v2-sweep',reason:`estado=${status} · ${elapsed} ms · añadidas=${added}`});
  }
}

function wire(){q('#batchAnalyze')?.addEventListener('click',()=>{runFallbackAfterRaster().catch(e=>console.error('[cloud-vector-fallback-v2]',e));});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
window.__revisionCloudVectorFallbackV2={version:VERSION};
