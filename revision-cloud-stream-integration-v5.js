import './revision-cloud-multicloud-v1.js?v=20260815-multicloud1';
import { removeDetectedRevisionCloudsByExactFamily } from './revision-cloud-manual-force-v2.js?v=20260818-curvedgray2';

const CHECKBOX='#batchRemoveRevisionClouds';
const STATUS='#batchStatus';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const VERSION='5+manual2+zeroexact1+singleexact1+coloroptional1+curvedgray2+dynamicvector3';
let vectorLoadState={status:'pending',error:null};

function diag(event){try{window.__cloudDiagnostic?.(event);}catch(_){}}
async function loadVectorFallback(){
  try{
    await import('./revision-cloud-vector-fallback-v3.js?v=20260820-sync1');
    vectorLoadState={status:'loaded',error:null};
  }catch(err){
    vectorLoadState={status:'error',error:err?.message||String(err)};
    console.error('[cloud-vector-fallback-loader]',err);
  }finally{
    window.__revisionCloudVectorFallbackLoadState={...vectorLoadState,version:VERSION};
  }
}
const vectorLoadPromise=loadVectorFallback();
function announceVectorLoader(){
  diag({stage:'cloud.fallback.loader',detail:'dynamic-vector-loader-v5',reason:`estado=${vectorLoadState.status}${vectorLoadState.error?` · ${vectorLoadState.error}`:''}`});
  if(vectorLoadState.status==='error')diag({stage:'cloud.fallback.load.error',detail:'dynamic-vector-loader-v5',error:vectorLoadState.error});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{vectorLoadPromise.finally(announceVectorLoader);});else vectorLoadPromise.finally(announceVectorLoader);

async function applyExactFamilyCloudRemoval(){
  const box=document.querySelector(CHECKBOX);
  if(!box?.checked) return;
  const manual=document.querySelector('#batchForceRevisionClouds')?.checked===true;
  const batch=Array.isArray(window.__batchAnalysis)?window.__batchAnalysis:[];
  if(!batch.length) return;
  let removed=0; const failures=[];
  for(const item of batch){
    if(item?.error||!item?.data) continue;
    const detected=Array.isArray(item.revisionClouds)?item.revisionClouds:[];
    if(!detected.length&&!manual) continue;
    try{
      const result=await removeDetectedRevisionCloudsByExactFamily(item.data,detected,{context:'apply',file:item.name});
      if(result.removed>0){ item.data=result.data; item.revisionCloudApplied=result.removed; removed+=result.removed; }
      else failures.push(`${item.name}: ${result.details.map(x=>x.reason||'sin eliminación segura').join(', ')}`);
      item.revisionCloudStreamDetails=result.details;
    }catch(err){ failures.push(`${item.name}: ${err?.message||String(err)}`); }
    await sleep(0);
  }
  window.__revisionCloudStreamApplyDebug={removed,failures,version:VERSION};
  if(failures.length) throw new Error(`Nubes: no se pudo validar eliminación segura en ${failures.length} archivo${failures.length===1?'':'s'} · ${failures.join(' | ')}`.slice(0,2500));
  if(removed){ const s=document.querySelector(STATUS); if(s)s.textContent=`☁️ ${removed} nube${removed===1?'':'s'} de revisión eliminada${removed===1?'':'s'}.`; }
}

function install(){
  const base=window.__prepareBatchAnnotationOperations;
  if(typeof base!=='function'||!base.__cloudSafeWrap||base.__exactCloudStreamWrap) return false;
  const wrapped=async function(){
    const box=document.querySelector(CHECKBOX),wanted=!!box?.checked;
    if(box&&wanted) box.checked=false;
    try{ await base(); } finally { if(box&&wanted) box.checked=true; }
    if(wanted) await applyExactFamilyCloudRemoval();
  };
  wrapped.__cloudSafeWrap=true;
  wrapped.__exactCloudStreamWrap=true;
  wrapped.__exactCloudStreamVersion=VERSION;
  window.__prepareBatchAnnotationOperations=wrapped;
  return true;
}
let ticks=0;const timer=setInterval(()=>{if(install()||++ticks>300)clearInterval(timer);},50);install();
window.__revisionCloudStreamIntegration={version:VERSION};
