// Manual revision-cloud fallback v2. The proven automatic remover always runs first and is never relaxed.
// v2 keeps the proven single-family manual route and adds one isolated exact BMC multi-cloud route.
import { removeDetectedRevisionCloudsByExactFamily as removeSafe } from './revision-cloud-stream-removal-v5.js?v=20260815-cloudstream-rastermulti1';
import { detectVectorCloudFallback } from './revision-cloud-vector-fallback-v1.js?v=20260815-vectorcloud-uniondensity1';
import { removeManualMultiCloudBlock } from './revision-cloud-manual-multicloud-v2.js?v=20260817-multicoord1';

const MAIN = '#batchRemoveRevisionClouds';
const FORCE = '#batchForceRevisionClouds';
const approvals = new Set();

function q(s){ return document.querySelector(s); }
function diag(stage, extra={}){ try{ window.__cloudDiagnostic?.({stage,detail:'manual-cloud-force-v2',...extra}); }catch(_){} }
function countClouds(pages){ return (pages||[]).reduce((n,p)=>n+(p?.clouds||[]).length,0); }
function isRasterCloud(c){ return c?.source!=='vector-family' && c?.source!=='vector-family-multi'; }
function rasterOnlyPages(pages){
  return (pages||[]).map(p=>({page:Number(p?.page||0),clouds:(p?.clouds||[]).filter(isRasterCloud)})).filter(p=>p.page>0&&p.clouds.length);
}
function resetApprovals(){ approvals.clear(); window.__manualCloudForcePreviewApprovedFiles=[]; }
function syncApprovals(){ window.__manualCloudForcePreviewApprovedFiles=Array.from(approvals); }
function manualRequested(){ return q(MAIN)?.checked===true && q(FORCE)?.checked===true; }

function ensureCheckbox(){
  const main=q(MAIN);
  if(!main) return null;
  let force=q(FORCE);
  if(force) return force;
  const mainBox=main.closest('.option-box');
  if(!mainBox?.parentElement) return null;
  const box=document.createElement('div');
  box.className='option-box';
  box.dataset.manualCloudForce='1';
  box.style.marginTop='8px';
  box.style.borderStyle='dashed';
  box.innerHTML='<label><input id="batchForceRevisionClouds" type="checkbox"><span>⚠️ Forzar nube no validada (modo manual)</span></label><small>Desactivado por defecto. La eliminación automática se intenta primero. Si falla, esta ruta solo acepta una familia o bloque vectorial inequívoco y exige verlo antes en Previsualizar cambios.</small>';
  mainBox.parentElement.insertBefore(box,mainBox.nextElementSibling);
  force=box.querySelector(FORCE);
  const sync=()=>{ force.disabled=!main.checked; if(!main.checked)force.checked=false; resetApprovals(); };
  main.addEventListener('change',sync);
  force.addEventListener('change',()=>{ resetApprovals(); box.style.opacity=force.checked?'1':'0.78'; });
  q('#batchAnalyze')?.addEventListener('click',resetApprovals,true);
  q('#batchClear')?.addEventListener('click',()=>{ force.checked=false; resetApprovals(); });
  sync();
  return force;
}

let uiTicks=0;
const uiTimer=setInterval(()=>{ if(ensureCheckbox()||++uiTicks>400) clearInterval(uiTimer); },50);
ensureCheckbox();

function manualFailure(normal, reason, extra={}){
  return {
    ...normal,
    manualForce:false,
    details:[...(normal?.details||[]),{removed:false,manualForce:true,reason,...extra}],
  };
}

async function tryManualVectorFamily(data, detectedPages, options, normal){
  const rasterPages=rasterOnlyPages(detectedPages);
  const rasterCount=countClouds(rasterPages);
  if(rasterCount!==1) return manualFailure(normal,`modo manual exige exactamente 1 candidata raster no validada; detectadas=${rasterCount}`);

  const targetPage=rasterPages[0].page;
  diag('cloud.manual.vector.start',{file:options.file||'',page:targetPage,rasterCandidates:rasterCount});
  const vector=await detectVectorCloudFallback(data,{file:options.file||''});
  const onPage=(vector||[]).filter(p=>Number(p?.page||0)===targetPage);
  const vectorCount=countClouds(onPage);
  if(vectorCount!==1){
    diag('cloud.manual.vector.reject',{file:options.file||'',page:targetPage,reason:`familias vectoriales candidatas=${vectorCount}`});
    return manualFailure(normal,`modo manual: familias vectoriales candidatas=${vectorCount}`,{page:targetPage});
  }
  const candidate=onPage[0].clouds[0];
  if(candidate?.source!=='vector-family'||!Array.isArray(candidate?.exactRGB)||!Number.isFinite(Number(candidate?.exactLineWidth))||Number(candidate?.vectorStrokeCount||0)<20){
    diag('cloud.manual.vector.reject',{file:options.file||'',page:targetPage,reason:'metadatos vectoriales insuficientes'});
    return manualFailure(normal,'modo manual: familia vectorial sin metadatos exactos suficientes',{page:targetPage});
  }

  const exact=await removeSafe(data,onPage);
  if(Number(exact?.removed||0)!==1){
    const why=(exact?.details||[]).map(x=>x?.reason).filter(Boolean).join(', ')||'la familia exacta no pudo eliminarse';
    diag('cloud.manual.vector.reject',{file:options.file||'',page:targetPage,reason:why});
    return manualFailure(normal,`modo manual: ${why}`,{page:targetPage});
  }

  const result={
    ...exact,
    manualForce:true,
    manualCandidate:{page:targetPage,bbox:candidate.bbox,exactRGB:candidate.exactRGB,exactLineWidth:candidate.exactLineWidth,vectorStrokeCount:candidate.vectorStrokeCount},
    details:[...(normal?.details||[]),{removed:true,manualForce:true,page:targetPage,mode:'manual-unique-vector-family',rgb:candidate.exactRGB,lineWidth:candidate.exactLineWidth,strokes:candidate.vectorStrokeCount},...(exact?.details||[])],
  };
  diag('cloud.manual.vector.accept',{file:options.file||'',page:targetPage,strokes:candidate.vectorStrokeCount,rgb:candidate.exactRGB,lineWidth:candidate.exactLineWidth,bbox:candidate.bbox});
  return result;
}

function approvePreview(result,options){
  if(Number(result?.removed||0)>0&&options.context==='preview'&&options.file){ approvals.add(options.file); syncApprovals(); }
  return result;
}

export async function removeDetectedRevisionCloudsByExactFamily(data, detectedPages, options={}){
  ensureCheckbox();
  const normal=await removeSafe(data,detectedPages);
  if(Number(normal?.removed||0)>0 || !manualRequested()) return normal;

  const context=String(options?.context||'');
  const file=String(options?.file||'');
  if(context==='apply' && (!file || !approvals.has(file))){
    diag('cloud.manual.preview.required',{file,reason:'previsualización manual no aprobada'});
    return manualFailure(normal,'modo manual: primero abre «Previsualizar cambios» y verifica visualmente la nube antes de Aplicar');
  }
  if(context!=='preview' && context!=='apply'){
    return manualFailure(normal,'modo manual no autorizado fuera de Preview/Apply');
  }

  let single=normal;
  try{
    single=await tryManualVectorFamily(data,detectedPages,{context,file},normal);
    if(Number(single?.removed||0)>0) return approvePreview(single,{context,file});
  }catch(err){
    diag('cloud.manual.vector.error',{file,error:err?.message||String(err)});
    single=manualFailure(normal,`modo manual vectorial: ${err?.message||String(err)}`);
  }

  try{
    const multi=await removeManualMultiCloudBlock(data,detectedPages,{context,file});
    if(Number(multi?.removed||0)>0){
      const result={...multi,manualForce:true,details:[...(single?.details||[]),...(multi?.details||[])]};
      return approvePreview(result,{context,file});
    }
    const why=(multi?.details||[]).map(x=>x?.reason).filter(Boolean).join(', ')||'sin bloque multicloud inequívoco';
    return manualFailure(single,`modo manual multicloud: ${why}`);
  }catch(err){
    diag('cloud.manual.multi.error',{file,error:err?.message||String(err)});
    return manualFailure(single,`modo manual multicloud: ${err?.message||String(err)}`);
  }
}

export function isManualCloudForceEnabled(){ ensureCheckbox(); return manualRequested(); }
export function clearManualCloudForcePreviewApprovals(){ resetApprovals(); }
window.__revisionCloudManualForce={version:2,get approvedFiles(){return Array.from(approvals);}};
