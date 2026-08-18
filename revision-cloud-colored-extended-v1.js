// Completion gate for cloud fallbacks. Existing colored-optional logic stays unchanged.
// Its completion signal is exposed only after the additive curved-cloud fallback has also finished.
import { detectCurvedGrayClouds } from './revision-cloud-curved-gray-v2.js?v=20260818-curvedgray2';
const q=s=>document.querySelector(s);
let exposed=window.__revisionCloudColoredOptionalState,seq=0;
async function finishWithCurved(baseState,ticket){
  let added=0,errors=0;
  try{
    if(q('#batchRemoveRevisionClouds')?.checked===true){
      const batch=Array.isArray(window.__batchAnalysis)?window.__batchAnalysis:[];
      for(const item of batch){
        if(item?.error||!item?.data||Number(item.revisionCloudCount||0)>0||Number(item?.revisionCloudPending?.count||0)>0)continue;
        try{
          const pages=await detectCurvedGrayClouds(item.data,{file:item.name});
          if(pages.length){
            item.revisionClouds=pages;
            item.revisionCloudCount=pages.reduce((n,p)=>n+(p.clouds?.length||0),0);
            item.revisionCloudCurvedGray=true;
            added+=item.revisionCloudCount;
          }
        }catch(err){errors++;try{window.__cloudDiagnostic?.({stage:'cloud.curved.error',detail:'curved-cloud-v2',file:item?.name||'',error:err?.message||String(err)});}catch(_){}}
        await new Promise(r=>setTimeout(r,0));
      }
      if(added){window.__refreshBatchResultLines?.();window.__revisionCloudApplyEnableV1?.sync?.();}
    }
  }finally{
    if(ticket===seq)exposed={...(baseState&&typeof baseState==='object'?baseState:{}),curvedGrayAdded:added,curvedGrayErrors:errors,extendedVersion:2};
  }
}
try{
  Object.defineProperty(window,'__revisionCloudColoredOptionalState',{
    configurable:true,enumerable:true,
    get(){return exposed;},
    set(v){const ticket=++seq;finishWithCurved(v,ticket);}
  });
}catch(_){/* If the gate cannot be installed, do not interfere with the existing cloud system. */}
import('./revision-cloud-colored-optional-v1.js?v=20260817-coloroptional1').catch(err=>{try{window.__cloudDiagnostic?.({stage:'cloud.coloroptional.loader.error',detail:'colored-extended-v2',error:err?.message||String(err)});}catch(_){}});
window.__revisionCloudColoredExtendedV1={version:2};
