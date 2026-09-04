// Safe post-detection prevalidation for revision clouds.
// Runs only after raster + vector + multicloud detection finish.
// It validates on byte copies with the proven v5 remover and never mutates item.data.
import { removeDetectedRevisionCloudsByExactFamily } from './revision-cloud-stream-removal-v5.js?v=20260815-cloudstream-rastermulti1';

const CHECKBOX='#batchRemoveRevisionClouds';
const ANALYZE='#batchAnalyze';
const STATUS='#batchStatus';
const SUMMARY='#batchSummary';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const q=s=>document.querySelector(s);
let cycle=0;

function diag(event){try{window.__cloudDiagnostic?.(event);}catch(_){}}
function cloudWeight(cloud){return cloud?.source==='vector-family-multi'?Math.max(1,Number(cloud.vectorComponentCount||1)):1;}
function countPages(pages){let n=0;for(const p of pages||[])for(const c of p?.clouds||[])n+=cloudWeight(c);return n;}
function reasons(result){const list=(result?.details||[]).map(x=>x?.reason).filter(Boolean);return [...new Set(list)].join(', ')||'sin familia exacta segura';}

async function validatePage(data,pageGroup,context={}){
  const originalClouds=Array.isArray(pageGroup?.clouds)?pageGroup.clouds:[];
  if(!originalClouds.length)return{page:Number(pageGroup?.page||1),clouds:[],accepted:0,rejected:0,reasons:[]};
  const expected=countPages([pageGroup]);
  const grouped=await removeDetectedRevisionCloudsByExactFamily(new Uint8Array(data),[{page:pageGroup.page,clouds:originalClouds}]);
  if(Number(grouped?.removed||0)>=expected){
    diag({stage:'cloud.prevalidate.accept',detail:`página validada completa · ${expected} nube${expected===1?'':'s'} segura${expected===1?'':'s'}`,file:context.file,page:pageGroup.page,candidates:originalClouds.length});
    return{page:pageGroup.page,clouds:originalClouds,accepted:expected,rejected:0,reasons:[]};
  }
  if(originalClouds.length===1){
    const reason=reasons(grouped);
    diag({stage:'cloud.prevalidate.reject',detail:'candidato descartado: geometría roja no aislable',file:context.file,page:pageGroup.page,reason});
    return{page:pageGroup.page,clouds:[],accepted:0,rejected:expected,reasons:[reason]};
  }
  const safe=[];let accepted=0,rejected=0;const rejectedReasons=[];
  for(const cloud of originalClouds){
    const need=cloudWeight(cloud);
    const single=await removeDetectedRevisionCloudsByExactFamily(new Uint8Array(data),[{page:pageGroup.page,clouds:[cloud]}]);
    if(Number(single?.removed||0)>=need){safe.push(cloud);accepted+=need;}
    else{rejected+=need;rejectedReasons.push(reasons(single));}
    await sleep(0);
  }
  if(safe.length){
    diag({stage:'cloud.prevalidate.partial',detail:`página parcialmente validada · seguras=${accepted} · descartadas=${rejected}`,file:context.file,page:pageGroup.page,reason:[...new Set(rejectedReasons)].join(', ')});
  }else{
    diag({stage:'cloud.prevalidate.reject',detail:`candidatos descartados: geometría roja no aislable · ${rejected} descartado${rejected===1?'':'s'}`,file:context.file,page:pageGroup.page,reason:[...new Set(rejectedReasons)].join(', ')});
  }
  return{page:pageGroup.page,clouds:safe,accepted,rejected,reasons:[...new Set(rejectedReasons)]};
}

export async function prevalidateRevisionClouds(data,detectedPages,context={}){
  const safePages=[];let accepted=0,rejected=0;const details=[];
  for(const pageGroup of detectedPages||[]){
    const r=await validatePage(data,pageGroup,context);
    details.push(r);accepted+=r.accepted;rejected+=r.rejected;
    if(r.clouds.length)safePages.push({page:r.page,clouds:r.clouds});
    await sleep(0);
  }
  return{pages:safePages,accepted,rejected,details};
}

function refreshReport(batch,rejected){
  let total=0;for(const item of batch||[])total+=Number(item?.revisionCloudCount||0);
  const status=q(STATUS);
  if(status){
    if(total)status.textContent=`☁️ ${total} nube${total===1?'':'s'} de revisión validada${total===1?'':'s'}${rejected?` · ${rejected} candidato${rejected===1?'':'s'} inseguro${rejected===1?'':'s'} descartado${rejected===1?'':'s'}`:''}.`;
    else status.textContent=`☁️ 0 nubes seguras${rejected?` · ${rejected} candidato${rejected===1?'':'s'} raster descartado${rejected===1?'':'s'}`:''}.`;
  }
  const summary=q(SUMMARY);
  if(summary){
    const clean=(summary.textContent||'').replace(/ · ☁️[^·]*/g,'').trim();
    summary.textContent=`${clean} · ☁️ ${total} nube${total===1?'':'s'} segura${total===1?'':'s'}${rejected?` · ${rejected} candidato${rejected===1?'':'s'} descartado${rejected===1?'':'s'}`:''}`;
    summary.classList.remove('hidden');
  }
}

async function waitForDetectionCycle(prevVector,prevMulti,myCycle){
  for(let i=0;i<1200;i++){
    if(myCycle!==cycle)return null;
    const batch=Array.isArray(window.__batchAnalysis)?window.__batchAnalysis:[];
    const ready=batch.length&&batch.every(x=>x?.error||typeof x?.revisionCloudCount==='number');
    const vectorDone=window.__revisionCloudVectorFallbackDebug!==prevVector;
    const multiDone=window.__revisionCloudMultiDebug!==prevMulti;
    if(ready&&vectorDone&&multiDone){await sleep(50);return batch;}
    await sleep(100);
  }
  return null;
}

async function runPrevalidation(prevVector,prevMulti,myCycle){
  const batch=await waitForDetectionCycle(prevVector,prevMulti,myCycle);
  if(!batch||myCycle!==cycle||!q(CHECKBOX)?.checked)return;
  diag({stage:'cloud.prevalidate.start',detail:'prevalidación segura con eliminador v5'});
  let accepted=0,rejected=0,errors=0;const debug=[];
  for(const item of batch){
    if(myCycle!==cycle)return;
    if(item?.error||!item?.data||!Array.isArray(item.revisionClouds)||!item.revisionClouds.length){
      if(item&&!item.error){item.revisionCloudPrevalidated=true;item.revisionCloudPrevalidationRejected=0;}
      continue;
    }
    const before=countPages(item.revisionClouds);
    try{
      const result=await prevalidateRevisionClouds(item.data,item.revisionClouds,{file:item.name});
      item.revisionClouds=result.pages;
      item.revisionCloudCount=result.accepted;
      item.revisionCloudPrevalidated=true;
      item.revisionCloudPrevalidationRejected=result.rejected;
      item.revisionCloudPrevalidationDetails=result.details;
      accepted+=result.accepted;rejected+=result.rejected;
      debug.push({name:item.name,before,accepted:result.accepted,rejected:result.rejected,details:result.details});
    }catch(err){
      errors++;
      item.revisionCloudPrevalidationError=err?.message||String(err);
      debug.push({name:item.name,before,error:item.revisionCloudPrevalidationError});
      diag({stage:'cloud.prevalidate.error',detail:'prevalidación falló; se conserva la detección original',file:item.name,reason:item.revisionCloudPrevalidationError});
    }
    await sleep(0);
  }
  window.__revisionCloudPrevalidationDebug={version:1,accepted,rejected,errors,debug};
  refreshReport(batch,rejected);
  diag({stage:'cloud.prevalidate.end',detail:`FIN prevalidación · seguras=${accepted} · descartadas=${rejected} · errores=${errors}`});
}

function wire(){
  q(ANALYZE)?.addEventListener('click',()=>{
    if(!q(CHECKBOX)?.checked)return;
    const myCycle=++cycle;
    const prevVector=window.__revisionCloudVectorFallbackDebug;
    const prevMulti=window.__revisionCloudMultiDebug;
    runPrevalidation(prevVector,prevMulti,myCycle).catch(e=>console.error('[cloud-prevalidation]',e));
  });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
window.__revisionCloudPrevalidation={version:1,prevalidateRevisionClouds};
