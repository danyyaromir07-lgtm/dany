// Additive detection wrapper for isolated red curved revision-cloud cycles.
// Stable multicloud v1 installs and runs first unchanged; this pass only promotes a unique structural cycle afterwards.
import './revision-cloud-multicloud-v1.js?v=20260821-redcurve-base1';
import { detectRedCurvedCycleClouds } from './revision-cloud-red-curved-cycle-v1.js?v=20260821-redcurve1';

const CHECKBOX='#batchRemoveRevisionClouds';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const q=s=>document.querySelector(s);
const intersects=(a,b)=>a&&b&&a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];

function diag(stage,extra={}){try{window.__cloudDiagnostic?.({stage,detail:'multicloud-v2-redcurve',...extra});}catch(_){}}
function clouds(pages){const out=[];for(const p of pages||[])for(const c of p?.clouds||[])out.push({page:Number(p?.page||0),cloud:c});return out;}
function established(c){const s=String(c?.source||'');return s.startsWith('vector-')||s.includes('bmc')||s.includes('BMC');}
function refresh(batch){
  let total=0;for(const item of batch)total+=Number(item?.revisionCloudCount||0);
  const status=q('#batchStatus');if(status&&total)status.textContent=`☁️ ${total} nube${total===1?'':'s'} de revisión detectada${total===1?'':'s'}.`;
  const summary=q('#batchSummary');if(summary){const clean=(summary.textContent||'').replace(/ · ☁️[^·]*/g,'').trim();summary.textContent=`${clean} · ☁️ ${total} nube${total===1?'':'s'} detectada${total===1?'':'s'}`;summary.classList.remove('hidden');}
  try{window.__refreshBatchResultLines?.();}catch(_){}
}
async function waitForBaseRun(before){
  for(let i=0;i<1800;i++){const now=window.__revisionCloudMultiDebug;if(now&&now!==before)return true;await sleep(50);}
  return false;
}
async function run(before){
  if(!q(CHECKBOX)?.checked)return;
  const baseFinished=await waitForBaseRun(before),batch=Array.isArray(window.__batchAnalysis)?window.__batchAnalysis:[];
  if(!batch.length)return;
  let refined=0,skipped=0,errors=0;
  for(const item of batch){
    if(item?.error||!item?.data)continue;
    try{
      const found=await detectRedCurvedCycleClouds(item.data,{file:item.name});
      if(found.length!==1)continue;
      const current=clouds(item.revisionClouds),candidate=found[0]?.clouds?.[0],page=Number(found[0]?.page||0);
      if(!candidate||page<1)continue;
      if(current.some(x=>established(x.cloud))){skipped++;diag('cloud.redcurve.route.skip',{file:item.name,page,reason:'ya existe una detección vectorial/estructural prioritaria'});continue;}
      const rasters=current.filter(x=>Array.isArray(x.cloud?.bbox)&&x.cloud.bbox.length>=4);
      if(rasters.length&&!rasters.some(x=>x.page===page&&intersects(x.cloud.bbox,candidate.bbox))){skipped++;diag('cloud.redcurve.route.skip',{file:item.name,page,reason:'la candidata estructural no coincide con la evidencia raster existente'});continue;}
      item.revisionClouds=found;
      item.revisionCloudCount=1;
      item.revisionCloudMultiRefined=true;
      item.revisionCloudRedCycleRefined=true;
      refined++;
      diag('cloud.redcurve.route.accept',{file:item.name,page,paths:candidate.vectorCurvedCyclePathCount,lineWidth:candidate.exactLineWidth,baseFinished});
    }catch(err){errors++;item.revisionCloudRedCycleError=err?.message||String(err);diag('cloud.redcurve.route.error',{file:item.name,error:item.revisionCloudRedCycleError});}
    await sleep(0);
  }
  window.__revisionCloudRedCycleDebug={version:1,refined,skipped,errors,baseFinished,batch:batch.map(x=>({name:x?.name,count:Number(x?.revisionCloudCount||0),redCycle:!!x?.revisionCloudRedCycleRefined,error:x?.revisionCloudRedCycleError||null}))};
  if(refined)refresh(batch);
}
function wire(){
  const button=q('#batchAnalyze');if(!button)return;
  button.addEventListener('click',()=>{const before=window.__revisionCloudMultiDebug;run(before).catch(e=>console.error('[cloud-redcurve]',e));});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
if(typeof window!=='undefined')window.__revisionCloudMultiV2={version:'2+red-curved-cycle1'};
