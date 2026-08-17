// Makes raster=0 files reachable by the existing Preview/Apply cloud hooks without fabricating a cloud.
// Only active when BOTH cloud removal and explicit manual force are checked.
const MAIN='#batchRemoveRevisionClouds';
const FORCE='#batchForceRevisionClouds';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function enabled(){return document.querySelector(MAIN)?.checked===true&&document.querySelector(FORCE)?.checked===true;}
function armCurrent(){if(!enabled())return;const batch=Array.isArray(window.__batchAnalysis)?window.__batchAnalysis:[];for(const item of batch){if(item?.error||!item?.data)continue;if(Number(item.revisionCloudCount||0)!==0)continue;if(Array.isArray(item.revisionClouds)&&item.revisionClouds.length)continue;item.revisionClouds=[{page:1,clouds:[]}];item.revisionCloudManualZeroArmed=true;try{window.__cloudDiagnostic?.({stage:'cloud.manual.zero.armed',detail:'manual-cloud-zero-arm-v1',file:item.name,page:1,reason:'raster=0 · habilitado solo para Preview/Apply manual'});}catch(_){}}}
async function armAfterAnalysis(){for(let i=0;i<900;i++){const batch=Array.isArray(window.__batchAnalysis)?window.__batchAnalysis:[];if(batch.length&&batch.every(x=>x?.error||typeof x?.revisionCloudCount==='number'))break;await sleep(100);}armCurrent();}
function wire(){document.querySelector('#batchAnalyze')?.addEventListener('click',()=>{if(enabled())armAfterAnalysis();},true);document.addEventListener('change',e=>{if(e.target?.matches?.(FORCE)||e.target?.matches?.(MAIN))setTimeout(armCurrent,0);});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
window.__revisionCloudManualZeroArm={version:1,armCurrent};
