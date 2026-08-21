// Additive analysis wrapper. Stable multicloud v2 runs first unchanged.
// This stage only installs new structural-family detections when no prior cloud route exists.
// Existing vector/BMC/raster detections are never replaced.
import './revision-cloud-multicloud-v2.js?v=20260821-additive-base1';
import { detectAdditiveRevisionCloudFamilies } from './revision-cloud-additive-families-v1.js?v=20260821-additive1';

const CHECKBOX='#batchRemoveRevisionClouds',q=s=>document.querySelector(s),sleep=ms=>new Promise(r=>setTimeout(r,ms));
function diag(stage,extra={}){try{window.__cloudDiagnostic?.({stage,detail:'multicloud-v3-additive-families',...extra});}catch(_){}}
function countPages(pages){let n=0;for(const p of pages||[])n+=Number(p?.clouds?.length||0);return n}
function refresh(batch){let total=0;for(const item of batch)total+=Number(item?.revisionCloudCount||0);const status=q('#batchStatus');if(status&&total)status.textContent=`☁️ ${total} nube${total===1?'':'s'} de revisión detectada${total===1?'':'s'}.`;try{window.__refreshBatchResultLines?.()}catch(_){}}
async function waitForRedCycle(before){for(let i=0;i<1800;i++){if(Number(window.__revisionCloudRedCycleVersion||0)>before)return true;await sleep(50)}return false}
async function run(before){
  if(!q(CHECKBOX)?.checked)return;
  const priorFinished=await waitForRedCycle(before),batch=Array.isArray(window.__batchAnalysis)?window.__batchAnalysis:[];
  let installed=0,deferred=0,errors=0;
  for(const item of batch){
    if(item?.error||!item?.data)continue;
    try{
      const found=await detectAdditiveRevisionCloudFamilies(item.data,{file:item.name}),n=countPages(found);
      if(!n)continue;
      const existing=Number(item?.revisionCloudCount||0);
      if(existing>0||(Array.isArray(item?.revisionClouds)&&item.revisionClouds.length)){
        deferred+=n;item.revisionCloudAdditiveDetected=found;
        diag('cloud.additive.route.defer',{file:item.name,entries:n,reason:'detección previa conservada; Apply revalidará familia adicional'});
        continue;
      }
      item.revisionClouds=found;item.revisionCloudCount=n;item.revisionCloudAdditiveDetected=found;item.revisionCloudAdditiveInstalled=true;installed+=n;
      diag('cloud.additive.route.accept',{file:item.name,entries:n,priorFinished});
    }catch(err){errors++;item.revisionCloudAdditiveError=err?.message||String(err);diag('cloud.additive.route.error',{file:item.name,error:item.revisionCloudAdditiveError})}
    await sleep(0);
  }
  window.__revisionCloudAdditiveFamilyDebug={version:1,installed,deferred,errors,priorFinished};
  if(installed)refresh(batch);
}
async function launch(before){try{await run(before)}finally{window.__revisionCloudAdditiveFamilyVersion=Number(window.__revisionCloudAdditiveFamilyVersion||0)+1}}
function wire(){const b=q('#batchAnalyze');if(!b)return;b.addEventListener('click',()=>{const before=Number(window.__revisionCloudRedCycleVersion||0);launch(before).catch(e=>console.error('[cloud-additive-families]',e))})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
if(typeof window!=='undefined')window.__revisionCloudMultiV3={version:'3+additive-families1'};
