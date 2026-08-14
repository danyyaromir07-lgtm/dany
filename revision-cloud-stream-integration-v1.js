import { removeDetectedRevisionCloudsByExactFamily } from './revision-cloud-stream-removal-v1.js?v=20260814-cloudstream3';

const CHECKBOX='#batchRemoveRevisionClouds';
const STATUS='#batchStatus';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function applyExactFamilyCloudRemoval(){
  const box=document.querySelector(CHECKBOX);
  if(!box?.checked) return;
  const batch=Array.isArray(window.__batchAnalysis)?window.__batchAnalysis:[];
  if(!batch.length) return;
  let removed=0;
  const failures=[];
  for(const item of batch){
    if(item?.error||!item?.data||!Array.isArray(item.revisionClouds)||!item.revisionClouds.length) continue;
    try{
      const result=await removeDetectedRevisionCloudsByExactFamily(item.data,item.revisionClouds);
      if(result.removed>0){
        item.data=result.data;
        item.revisionCloudApplied=result.removed;
        removed+=result.removed;
      }else{
        failures.push(`${item.name}: ${result.details.map(x=>x.reason||'sin eliminación segura').join(', ')}`);
      }
      item.revisionCloudStreamDetails=result.details;
    }catch(err){
      failures.push(`${item.name}: ${err?.message||String(err)}`);
    }
    await sleep(0);
  }
  window.__revisionCloudStreamApplyDebug={removed,failures};
  if(failures.length) throw new Error(`Nubes: no se pudo validar eliminación segura en ${failures.length} archivo${failures.length===1?'':'s'} · ${failures.join(' | ')}`.slice(0,2500));
  if(removed){
    const s=document.querySelector(STATUS);
    if(s)s.textContent=`☁️ ${removed} nube${removed===1?'':'s'} de revisión eliminada${removed===1?'':'s'}.`;
  }
}

function install(){
  const base=window.__prepareBatchAnnotationOperations;
  // Only replace the cloud-v6 wrapper. Never wrap the signature/comments/links preparer directly.
  if(typeof base!=='function'||!base.__cloudSafeWrap||base.__exactCloudStreamWrap) return false;
  const wrapped=async function(){
    const box=document.querySelector(CHECKBOX);
    const wanted=!!box?.checked;
    // Keep v6 for its proven detector/UI, but disable only its experimental micro-redaction
    // apply path while all other annotation/signature/link preparation continues underneath.
    if(box&&wanted) box.checked=false;
    try{
      await base();
    }finally{
      if(box&&wanted) box.checked=true;
    }
    if(wanted) await applyExactFamilyCloudRemoval();
  };
  wrapped.__cloudSafeWrap=true;
  wrapped.__exactCloudStreamWrap=true;
  window.__prepareBatchAnnotationOperations=wrapped;
  return true;
}

let ticks=0;
const timer=setInterval(()=>{
  if(install()||++ticks>300){clearInterval(timer);}
},50);
install();

window.__revisionCloudStreamIntegration={version:1};
