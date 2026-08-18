import './revision-cloud-vector-fallback-v1.js?v=20260815-vectorcloud-uniondensity1';
import './revision-cloud-multicloud-v1.js?v=20260815-multicloud1';
import { removeDetectedRevisionCloudsByExactFamily } from './revision-cloud-manual-force-v2.js?v=20260818-curvedgray2';

const CHECKBOX='#batchRemoveRevisionClouds';
const STATUS='#batchStatus';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const byteLength=data=>Number(data?.byteLength??data?.length??0);
function perf(event){try{window.__performanceDiagnostic?.({scope:'apply',...event});}catch(_){}}

async function applyExactFamilyCloudRemoval(){
  const box=document.querySelector(CHECKBOX);
  if(!box?.checked) return;
  const manual=document.querySelector('#batchForceRevisionClouds')?.checked===true;
  const batch=Array.isArray(window.__batchAnalysis)?window.__batchAnalysis:[];
  if(!batch.length) return;
  let removed=0; const failures=[];
  for(let i=0;i<batch.length;i++){
    const item=batch[i];
    if(item?.error||!item?.data) continue;
    const detected=Array.isArray(item.revisionClouds)?item.revisionClouds:[];
    if(!detected.length&&!manual) continue;
    const key=`cloud-apply::${i+1}::${item.name||''}`;
    const before=item.data;
    perf({action:'start',stage:'aplicar nubes del PDF',key,file:item.name,index:i+1,total:batch.length,sizeBytes:byteLength(before)});
    // Cede un turno antes de una operación pesada para que el navegador pueda pintar el diagnóstico.
    await sleep(0);
    try{
      const result=await removeDetectedRevisionCloudsByExactFamily(item.data,detected,{context:'apply',file:item.name});
      if(result.removed>0){ item.data=result.data; item.revisionCloudApplied=result.removed; removed+=result.removed; }
      else failures.push(`${item.name}: ${result.details.map(x=>x.reason||'sin eliminación segura').join(', ')}`);
      item.revisionCloudStreamDetails=result.details;
      perf({action:'end',stage:'aplicar nubes del PDF',key,file:item.name,index:i+1,total:batch.length,sizeBytes:byteLength(before),outputBytes:byteLength(item.data),removed:Number(result.removed||0)});
    }catch(err){
      failures.push(`${item.name}: ${err?.message||String(err)}`);
      perf({action:'end',stage:'aplicar nubes del PDF',key,file:item.name,index:i+1,total:batch.length,sizeBytes:byteLength(before),outputBytes:byteLength(item.data),warning:err?.message||String(err)});
    }
    await sleep(0);
  }
  window.__revisionCloudStreamApplyDebug={removed,failures,version:'5+manual2+zeroexact1+singleexact1+coloroptional1+curvedgray2'};
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
  wrapped.__exactCloudStreamVersion='5+manual2+zeroexact1+singleexact1+coloroptional1+curvedgray2';
  window.__prepareBatchAnnotationOperations=wrapped;
  return true;
}
let ticks=0;const timer=setInterval(()=>{if(install()||++ticks>300)clearInterval(timer);},50);install();
window.__revisionCloudStreamIntegration={version:'5+manual2+zeroexact1+singleexact1+coloroptional1+curvedgray2'};