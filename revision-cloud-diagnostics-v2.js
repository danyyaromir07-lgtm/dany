const PANEL_ID='cloudDiagnosticsPanel';
const CHECKBOX='#batchRemoveRevisionClouds';
const MAX_EVENTS=600;
const EPS=1e-6;
const events=[];
let mupdfPromise=null;

function q(s){return document.querySelector(s);}
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
function fmtNum(v,d=4){const n=Number(v);return Number.isFinite(n)?n.toFixed(d):String(v??'');}
function fmtBBox(v){return Array.isArray(v)&&v.length>=4?`[${v.slice(0,4).map(x=>fmtNum(x,1)).join(', ')}]`:'';}
function fmtRGB(v){return Array.isArray(v)&&v.length>=3?`(${v.slice(0,3).map(x=>fmtNum(x,5)).join(', ')})`:'';}
function emit(event){window.__cloudDiagnostic?.(event);}
function area(r){return Math.max(0,r[2]-r[0])*Math.max(0,r[3]-r[1]);}
function unionRect(a,b){if(!a)return b.slice();return[Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[2],b[2]),Math.max(a[3],b[3])];}
function rectGap(a,b){const dx=Math.max(0,Math.max(a[0],b[0])-Math.min(a[2],b[2]));const dy=Math.max(0,Math.max(a[1],b[1])-Math.min(a[3],b[3]));return Math.hypot(dx,dy);}
function colorKey(cs,color){const name=String(cs||'');if(!/DeviceRGB|RGB/i.test(name)||!Array.isArray(color)||color.length<3)return null;return color.slice(0,3).map(v=>Number(v).toPrecision(12)).join('|');}
function widthKey(w){return Number(w||0).toPrecision(12);}
function isRed(rgb){if(!rgb||rgb.length<3)return false;const[r,g,b]=rgb.map(Number);return r>=0.50&&r>=g+0.12&&r>=b+0.12;}

function ensurePanel(){
  if(q('#'+PANEL_ID))return;
  const host=q('#analysisTool');if(!host)return;
  const panel=document.createElement('section');
  panel.className='text-warning';panel.id=PANEL_ID;panel.style.marginTop='12px';
  panel.innerHTML=`<details><summary><strong>🧪 Diagnóstico de nubes</strong> — detección raster, familia vectorial y borrado seguro</summary><div style="margin-top:10px"><div id="cloudDiagSummary" style="font-size:.9rem;margin-bottom:8px">Sin actividad de nubes.</div><pre id="cloudDiagLog" style="max-height:340px;overflow:auto;white-space:pre-wrap;margin:0;padding:10px;background:rgba(0,0,0,.04);border-radius:8px;font-size:12px"></pre><div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap"><button id="cloudDiagCopy" class="secondary small" type="button">Copiar diagnóstico</button><button id="cloudDiagClear" class="secondary small" type="button">Limpiar</button></div></div></details>`;
  const anchor=q('#revisionCloudLocationBox')||q('#ocrDiagnosticsPanel')||q('#ocrDiagnosticsBox')||q('#batchStatus');
  if(anchor?.parentElement)anchor.parentElement.insertBefore(panel,anchor.nextSibling);else host.appendChild(panel);
  q('#cloudDiagCopy')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(q('#cloudDiagLog')?.textContent||'');}catch(_){}});
  q('#cloudDiagClear')?.addEventListener('click',()=>window.__cloudDiagnosticsReset?.());
}

function render(){
  ensurePanel();
  const log=q('#cloudDiagLog'),summary=q('#cloudDiagSummary'),last=events.at(-1);
  if(summary)summary.textContent=last?`${last.stage} · ${last.detail}`:'Sin actividad de nubes.';
  if(!log)return;
  log.textContent=events.map((e,i)=>{
    const meta=[e.file&&`archivo=${e.file}`,e.page!=null&&`página=${e.page}`,e.rotation!=null&&`rotación=${e.rotation}°`,e.source&&`fuente=${e.source}`,e.rgb&&`RGB=${fmtRGB(e.rgb)}`,e.lineWidth!=null&&`grosor=${fmtNum(e.lineWidth,5)}`,e.strokes!=null&&`trazos=${e.strokes}`,e.groups!=null&&`familias=${e.groups}`,e.candidates!=null&&`candidatas=${e.candidates}`,e.components!=null&&`componentes=${e.components}`,e.main!=null&&`principal=${e.main}`,e.density!=null&&`densidad=${fmtNum(e.density,4)}`,e.fraction!=null&&`fracción=${fmtNum(e.fraction,5)}`,e.bbox&&`bbox=${fmtBBox(e.bbox)}`,e.block&&`bloque=${e.block}`,e.reason&&`motivo=${e.reason}`,e.error&&`error=${e.error}`].filter(Boolean).join(' · ');
    return `${String(i+1).padStart(3,'0')} | ${e.stage} | ${e.detail}${meta?` | ${meta}`:''}`;
  }).join('\n');
}
window.__cloudDiagnostic=(event={})=>{events.push({...event,time:Date.now()});if(events.length>MAX_EVENTS)events.shift();render();};
window.__cloudDiagnosticsReset=()=>{events.length=0;render();};
window.__cloudDiagnosticsEvents=events;

async function loadMuPDF(){if(!mupdfPromise)mupdfPromise=import('https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js');return mupdfPromise;}
function connectedComponents(strokes,gapLimit){const n=strokes.length,seen=new Uint8Array(n),comps=[];for(let i=0;i<n;i++){if(seen[i])continue;const stack=[i],comp=[];seen[i]=1;while(stack.length){const j=stack.pop();comp.push(strokes[j]);for(let k=0;k<n;k++){if(seen[k])continue;if(rectGap(strokes[j].bbox,strokes[k].bbox)<=gapLimit){seen[k]=1;stack.push(k);}}}comps.push(comp);}return comps.sort((a,b)=>b.length-a.length);}

async function diagnoseVectorFamilies(item){
  const mupdf=await loadMuPDF();
  const doc=mupdf.PDFDocument.openDocument(new Uint8Array(item.data),'application/pdf');
  try{
    for(let pi=0;pi<doc.countPages();pi++){
      const page=doc.loadPage(pi),groups=new Map(),bounds=Array.from(page.getBounds());
      let rotation=0;try{const v=page.getObject()?.getInheritable?.('Rotate');rotation=((Number(v?.valueOf?.()??v??0)%360)+360)%360;}catch(_){}
      const device=new mupdf.Device({strokePath(path,stroke,ctm,colorSpace,color){const ck=colorKey(colorSpace,color);if(!ck||!isRed(color))return;let bbox;try{bbox=Array.from(path.getBounds(stroke,ctm));}catch(_){return;}const lw=Number(stroke?.lineWidth??0),key=`${ck}::${widthKey(lw)}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push({bbox,rgb:[Number(color[0]),Number(color[1]),Number(color[2])],lineWidth:lw});}});
      page.runPageContents(device,mupdf.Matrix.identity);device.close?.();
      emit({stage:'cloud.vector.inspect',detail:'familias rojas exactas inspeccionadas',file:item.name,page:pi+1,rotation,groups:groups.size});
      const ranked=[...groups.entries()].sort((a,b)=>b[1].length-a[1].length).slice(0,12);
      let accepted=0;
      for(const [key,strokes] of ranked){
        const base={file:item.name,page:pi+1,rgb:strokes[0]?.rgb,lineWidth:strokes[0]?.lineWidth,strokes:strokes.length};
        let reason='';
        if(strokes.length<20)reason='menos de 20 trazos';
        else if(strokes.length>1200)reason='más de 1200 trazos; familia demasiado global';
        let comps=[];
        if(!reason){const lw=Math.abs(Number(strokes[0].lineWidth||0)),gapLimit=Math.max(8,Math.min(22,lw*30+8));comps=connectedComponents(strokes,gapLimit);const main=comps[0]||[];if(main.length<20)reason='componente principal menor de 20 trazos';else if(main.length/strokes.length<0.90)reason=`familia dispersa; principal ${main.length}/${strokes.length}`;else{let union=null,sumBoxArea=0;for(const s of main){union=unionRect(union,s.bbox);sumBoxArea+=area(s.bbox);}const w=Math.max(1,union[2]-union[0]),h=Math.max(1,union[3]-union[1]),fraction=area(union)/Math.max(1,area(bounds)),density=sumBoxArea/Math.max(1,area(union)),aspect=Math.min(w,h)/Math.max(w,h),outside=strokes.length-main.length;if(w<40||h<40)reason='bbox menor de 40×40';else if(fraction<0.00015)reason='familia demasiado pequeña respecto a la página';else if(fraction>0.08)reason='familia ocupa demasiado de la página';else if(density>0.25)reason='densidad demasiado alta';else if(aspect<0.10)reason='geometría demasiado lineal/alargada';else if(outside>Math.max(2,Math.floor(strokes.length*0.05)))reason=`demasiados trazos fuera del componente principal (${outside})`;else{accepted++;emit({stage:'cloud.vector.candidate',detail:'familia compatible con nube',...base,components:comps.length,main:main.length,density,fraction,bbox:union});continue;}emit({stage:'cloud.vector.reject',detail:'familia descartada',...base,components:comps.length,main:main.length,density,fraction,bbox:union,reason});continue;}}}
        emit({stage:'cloud.vector.reject',detail:'familia descartada',...base,components:comps.length||undefined,reason});
      }
      emit({stage:'cloud.vector.result',detail:accepted===1?'1 familia candidata':'sin candidato único seguro',file:item.name,page:pi+1,candidates:accepted});
    }
  }finally{doc.destroy();}
}

async function monitorAnalysis(previousFallback){
  let batch=[];
  for(let i=0;i<900;i++){batch=Array.isArray(window.__batchAnalysis)?window.__batchAnalysis:[];if(batch.length&&batch.every(x=>x?.error||typeof x?.revisionCloudCount==='number'))break;await sleep(100);}
  if(!batch.length){emit({stage:'cloud.error',detail:'sin datos de análisis',reason:'window.__batchAnalysis vacío'});return;}
  for(const item of batch){if(item?.error)continue;const count=Number(item.revisionCloudCount||0);if(count>0&&!item.revisionCloudVectorFallback){for(const p of item.revisionClouds||[])for(const c of p.clouds||[])emit({stage:'cloud.raster.detected',detail:'nube detectada por raster',file:item.name,page:p.page,source:c.source||'raster',bbox:c.bbox});}else emit({stage:'cloud.raster.none',detail:'raster sin nube segura',file:item.name});}
  for(let i=0;i<900;i++){if(window.__revisionCloudVectorFallbackDebug&&window.__revisionCloudVectorFallbackDebug!==previousFallback)break;await sleep(100);}
  for(const item of batch){if(item?.error)continue;if(item.revisionCloudVectorFallback){for(const p of item.revisionClouds||[])for(const c of p.clouds||[])emit({stage:'cloud.vector.accept',detail:'fallback vectorial aceptado',file:item.name,page:p.page,source:c.source||'vector-family',rgb:c.exactRGB,lineWidth:c.exactLineWidth,strokes:c.vectorStrokeCount,bbox:c.bbox});}else if(Number(item.revisionCloudCount||0)===0){try{await diagnoseVectorFamilies(item);}catch(err){emit({stage:'cloud.vector.error',detail:'falló diagnóstico vectorial',file:item.name,error:err?.message||String(err)});}}}
  const total=batch.reduce((n,x)=>n+Number(x?.revisionCloudCount||0),0);emit({stage:'cloud.analysis.end',detail:`FIN · ${total} nube${total===1?'':'s'} detectada${total===1?'':'s'}`});
}

async function monitorApply(previousApply){
  emit({stage:'cloud.apply.start',detail:'INICIO borrado seguro'});
  for(let i=0;i<1800;i++){if(window.__revisionCloudStreamApplyDebug&&window.__revisionCloudStreamApplyDebug!==previousApply)break;await sleep(100);}
  const batch=Array.isArray(window.__batchAnalysis)?window.__batchAnalysis:[];
  for(const item of batch){for(const d of item?.revisionCloudStreamDetails||[]){const family=d.family||{};if(d.removed)emit({stage:'cloud.remove.ok',detail:'nube eliminada del stream',file:item.name,page:d.page,source:item.revisionCloudVectorFallback?'vector-family':'raster',rgb:family.rgb,lineWidth:family.exactLineWidth??family.lineWidthRange?.[0],strokes:family.strokes?.length,bbox:family.union,block:d.blockType});else emit({stage:'cloud.remove.abort',detail:'borrado cancelado por seguridad',file:item.name,page:d.page,reason:d.reason});}}
  const dbg=window.__revisionCloudStreamApplyDebug;for(const f of dbg?.failures||[])emit({stage:'cloud.remove.error',detail:'error de eliminación',error:f});
  emit({stage:'cloud.apply.end',detail:`FIN · ${Number(dbg?.removed||0)} nube${Number(dbg?.removed||0)===1?'':'s'} eliminada${Number(dbg?.removed||0)===1?'':'s'}`});
}

function wire(){
  ensurePanel();
  q('#batchAnalyze')?.addEventListener('click',()=>{if(!q(CHECKBOX)?.checked)return;window.__cloudDiagnosticsReset();emit({stage:'cloud.start',detail:'INICIO'});const previous=window.__revisionCloudVectorFallbackDebug;monitorAnalysis(previous).catch(err=>emit({stage:'cloud.error',detail:'error de diagnóstico',error:err?.message||String(err)}));},true);
  q('#batchApply')?.addEventListener('click',()=>{if(!q(CHECKBOX)?.checked)return;const previous=window.__revisionCloudStreamApplyDebug;monitorApply(previous).catch(err=>emit({stage:'cloud.apply.error',detail:'error de diagnóstico de aplicación',error:err?.message||String(err)}));},true);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
