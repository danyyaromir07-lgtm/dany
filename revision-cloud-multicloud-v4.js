// Additive routing guard. Stable multicloud v3 runs unchanged.
// Preserve raster evidence when a generic non-pure-red vector-family-multi refinement would replace it.
import './revision-cloud-multicloud-v3.js?v=20260821-routingguard-base1';
const q=s=>document.querySelector(s),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const pureRed=c=>Array.isArray(c)&&c.length>=3&&Math.abs(Number(c[0])-1)<=5e-5&&Math.abs(Number(c[1]))<=5e-5&&Math.abs(Number(c[2]))<=5e-5;
const clonePages=p=>Array.isArray(p)?p.map(x=>({...x,clouds:Array.isArray(x?.clouds)?x.clouds.map(c=>({...c,bbox:Array.isArray(c?.bbox)?c.bbox.slice():c?.bbox})):[]})):[];
function diag(stage,extra={}){try{window.__cloudDiagnostic?.({stage,detail:'multicloud-v4-raster-preservation',...extra})}catch(_){}}
function isRasterPages(pages){let n=0;for(const p of pages||[])for(const c of p?.clouds||[]){const s=String(c?.source||'');if(s.startsWith('vector-')||s.toLowerCase().includes('bmc'))return false;if(Array.isArray(c?.bbox)&&c.bbox.length>=4)n++;}return n>0}
function genericNonPure(pages){const cs=[];for(const p of pages||[])for(const c of p?.clouds||[])cs.push(c);return cs.length>0&&cs.every(c=>c?.source==='vector-family-multi')&&cs.some(c=>!pureRed(c?.exactRGB))}
async function captureAndGuard(beforeBatch,beforeAdditive){
  let batch=null;
  for(let i=0;i<3000;i++){
    const b=Array.isArray(window.__batchAnalysis)?window.__batchAnalysis:null;
    if(b&&b!==beforeBatch&&b.length){batch=b;for(const item of b)if(item?.data&&isRasterPages(item.revisionClouds)&&!item.revisionCloudRasterEvidence)item.revisionCloudRasterEvidence=clonePages(item.revisionClouds);break}
    await sleep(10);
  }
  if(!batch)return;
  for(let i=0;i<3000;i++){if(Number(window.__revisionCloudAdditiveFamilyVersion||0)>beforeAdditive)break;for(const item of batch)if(item?.data&&isRasterPages(item.revisionClouds)&&!item.revisionCloudRasterEvidence)item.revisionCloudRasterEvidence=clonePages(item.revisionClouds);await sleep(10)}
  let restored=0;
  for(const item of batch){const snap=item?.revisionCloudRasterEvidence;if(!snap?.length||!genericNonPure(item.revisionClouds))continue;const old=item.revisionClouds;item.revisionClouds=clonePages(snap);item.revisionCloudCount=item.revisionClouds.reduce((n,p)=>n+Number(p?.clouds?.length||0),0);item.revisionCloudMultiRefined=false;item.revisionCloudRoutingGuarded=true;restored++;diag('cloud.multicloud.route.guard',{file:item.name,reason:'vector-family-multi no rojo puro no sustituye evidencia raster',rejectedSources:(old||[]).flatMap(p=>(p.clouds||[]).map(c=>c?.source||''))})}
  window.__revisionCloudRasterGuardVersion=Number(window.__revisionCloudRasterGuardVersion||0)+1;
  if(restored){try{window.__refreshBatchResultLines?.()}catch(_){}}
}
function wire(){const b=q('#batchAnalyze');if(!b)return;b.addEventListener('click',()=>{const beforeBatch=window.__batchAnalysis,beforeAdditive=Number(window.__revisionCloudAdditiveFamilyVersion||0);captureAndGuard(beforeBatch,beforeAdditive).catch(e=>console.error('[cloud-raster-guard]',e))},true)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
if(typeof window!=='undefined')window.__revisionCloudMultiV4={version:'4+raster-preservation1'};
