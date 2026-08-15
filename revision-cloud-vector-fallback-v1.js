const CHECKBOX = '#batchRemoveRevisionClouds';
const STATUS = '#batchStatus';
const SUMMARY = '#batchSummary';
const EPS = 1e-6;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let mupdfPromise = null;

function q(s){ return document.querySelector(s); }
function sameNumber(a,b){ return Math.abs(Number(a)-Number(b)) <= EPS; }
function isRed(rgb){
  if(!rgb || rgb.length < 3) return false;
  const [r,g,b]=Array.from(rgb).slice(0,3).map(Number);
  return r >= 0.50 && r >= g + 0.12 && r >= b + 0.12;
}
function colorKey(cs,color){
  const name=String(cs||'');
  if(!/DeviceRGB|RGB/i.test(name) || !color || typeof color.length!=='number' || color.length<3) return null;
  return Array.from(color).slice(0,3).map(v=>Number(v).toPrecision(12)).join('|');
}
function widthKey(w){ return Number(w||0).toPrecision(12); }
function unionRect(a,b){
  if(!a) return b.slice();
  return [Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[2],b[2]),Math.max(a[3],b[3])];
}
function rectGap(a,b){
  const dx=Math.max(0, Math.max(a[0],b[0])-Math.min(a[2],b[2]));
  const dy=Math.max(0, Math.max(a[1],b[1])-Math.min(a[3],b[3]));
  return Math.hypot(dx,dy);
}
function area(r){ return Math.max(0,r[2]-r[0])*Math.max(0,r[3]-r[1]); }

async function loadMuPDF(){
  if(!mupdfPromise) mupdfPromise=import('https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js');
  return mupdfPromise;
}

function collectFamilies(mupdf,page){
  const groups=new Map();
  const device=new mupdf.Device({
    strokePath(path,stroke,ctm,colorSpace,color,alpha){
      const ck=colorKey(colorSpace,color);
      if(!ck || !isRed(color)) return;
      let bbox;
      try{ bbox=Array.from(path.getBounds(stroke,ctm)); }catch(_){ return; }
      if(!bbox || bbox.length<4) return;
      const w=Number(stroke?.getLineWidth?.() ?? stroke?.lineWidth ?? 0);
      const key=`${ck}::${widthKey(w)}`;
      const rec={
        bbox,
        rgb:[Number(color[0]),Number(color[1]),Number(color[2])],
        lineWidth:w,
        alpha:Number(alpha??1)
      };
      if(!groups.has(key)) groups.set(key,[]);
      groups.get(key).push(rec);
    }
  });
  page.runPageContents(device,mupdf.Matrix.identity);
  device.close?.();
  return groups;
}

function connectedComponents(strokes,gapLimit){
  const n=strokes.length, seen=new Uint8Array(n), comps=[];
  for(let i=0;i<n;i++){
    if(seen[i]) continue;
    const stack=[i], comp=[]; seen[i]=1;
    while(stack.length){
      const j=stack.pop(); comp.push(strokes[j]);
      for(let k=0;k<n;k++){
        if(seen[k]) continue;
        if(rectGap(strokes[j].bbox,strokes[k].bbox) <= gapLimit){ seen[k]=1; stack.push(k); }
      }
    }
    comps.push(comp);
  }
  return comps.sort((a,b)=>b.length-a.length);
}

function candidateFromFamily(key,strokes,pageBounds){
  if(strokes.length < 20 || strokes.length > 1200) return null;
  const lw=Math.abs(Number(strokes[0].lineWidth||0));
  const gapLimit=Math.max(8,Math.min(22,lw*30+8));
  const comps=connectedComponents(strokes,gapLimit);
  if(!comps.length) return null;
  const main=comps[0];
  if(main.length < 20 || main.length / strokes.length < 0.90) return null;
  let union=null, sumBoxArea=0;
  for(const s of main){ union=unionRect(union,s.bbox); sumBoxArea+=area(s.bbox); }
  const w=Math.max(1,union[2]-union[0]), h=Math.max(1,union[3]-union[1]);
  if(w < 40 || h < 40) return null;
  const pageArea=Math.max(1,area(pageBounds));
  const frac=area(union)/pageArea;
  if(frac < 0.00015 || frac > 0.08) return null;
  const sparse=sumBoxArea/Math.max(1,area(union));
  if(sparse > 0.25) return null;
  const aspect=Math.min(w,h)/Math.max(w,h);
  if(aspect < 0.10) return null;
  const outside=strokes.length-main.length;
  if(outside > Math.max(2,Math.floor(strokes.length*0.05))) return null;
  return {
    key,
    bbox:union,
    rgb:main[0].rgb,
    lineWidth:main[0].lineWidth,
    strokeCount:main.length,
    sparse,
    fraction:frac,
    source:'vector-family'
  };
}

export async function detectVectorCloudFallback(data){
  const mupdf=await loadMuPDF();
  const doc=mupdf.PDFDocument.openDocument(new Uint8Array(data),'application/pdf');
  const out=[];
  try{
    for(let i=0;i<doc.countPages();i++){
      const page=doc.loadPage(i);
      const groups=collectFamilies(mupdf,page);
      const pageBounds=Array.from(page.getBounds());
      const candidates=[];
      for(const [key,strokes] of groups){
        const c=candidateFromFamily(key,strokes,pageBounds);
        if(c) candidates.push(c);
      }
      if(candidates.length===1){
        const c=candidates[0];
        out.push({page:i+1,clouds:[{
          bbox:c.bbox,
          source:'vector-family',
          exactRGB:c.rgb,
          exactLineWidth:c.lineWidth,
          vectorFamilyKey:c.key,
          vectorStrokeCount:c.strokeCount
        }]});
      }
    }
  }finally{ doc.destroy(); }
  return out;
}

function refreshCloudReport(batch){
  let total=0;
  for(const item of batch) total+=Number(item?.revisionCloudCount||0);
  const status=q(STATUS);
  if(status && total) status.textContent=`☁️ ${total} nube${total===1?'':'s'} de revisión detectada${total===1?'':'s'}.`;
  const summary=q(SUMMARY);
  if(summary){
    const clean=(summary.textContent||'').replace(/ · ☁️[^·]*/g,'').trim();
    summary.textContent=`${clean} · ☁️ ${total} nube${total===1?'':'s'} detectada${total===1?'':'s'}`;
    summary.classList.remove('hidden');
  }
}

async function runFallbackAfterRaster(){
  if(!q(CHECKBOX)?.checked) return;
  let batch=[];
  for(let i=0;i<900;i++){
    batch=Array.isArray(window.__batchAnalysis)?window.__batchAnalysis:[];
    const ready=batch.length && batch.every(x=>x?.error || typeof x?.revisionCloudCount==='number');
    if(ready) break;
    await sleep(100);
  }
  if(!batch.length) return;
  let added=0;
  for(const item of batch){
    if(item?.error || !item?.data || Number(item.revisionCloudCount||0)>0) continue;
    try{
      const found=await detectVectorCloudFallback(item.data);
      if(found.length){
        item.revisionClouds=found;
        item.revisionCloudCount=found.reduce((n,p)=>n+(p.clouds?.length||0),0);
        item.revisionCloudVectorFallback=true;
        added+=item.revisionCloudCount;
      }
    }catch(err){ item.revisionCloudVectorError=err?.message||String(err); }
    await sleep(0);
  }
  window.__revisionCloudVectorFallbackDebug={added,batch:batch.map(x=>({name:x?.name,count:x?.revisionCloudCount||0,vector:!!x?.revisionCloudVectorFallback,error:x?.revisionCloudVectorError||null}))};
  if(added) refreshCloudReport(batch);
}

function wire(){
  q('#batchAnalyze')?.addEventListener('click',()=>{ runFallbackAfterRaster().catch(e=>console.error('[cloud-vector-fallback]',e)); });
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',wire); else wire();
