// UI-only bridge: keep Apply enabled when revision-cloud analysis finds work after batch-analysis finishes.
// Does not detect, validate, remove, or modify any PDF bytes.
const CLOUD='#batchRemoveRevisionClouds',APPLY='#batchApply',ANALYZE='#batchAnalyze',CLEAR='#batchClear';
const q=s=>document.querySelector(s);
function hasCloudWork(){
  if(q(CLOUD)?.checked!==true)return false;
  const batch=Array.isArray(window.__batchAnalysis)?window.__batchAnalysis:[];
  return batch.some(item=>!item?.error&&(Number(item?.revisionCloudCount||0)>0||Number(item?.revisionCloudPending?.count||0)>0));
}
function sync(){const b=q(APPLY);if(b&&hasCloudWork())b.disabled=false;}
function watch(){let ticks=0;const t=setInterval(()=>{sync();if(++ticks>900)clearInterval(t);},100);}
function wire(){q(ANALYZE)?.addEventListener('click',watch,true);q(CLEAR)?.addEventListener('click',()=>{},true);document.addEventListener('change',e=>{if(e.target?.matches?.(CLOUD)){if(e.target.checked)watch();}});watch();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
window.__revisionCloudApplyEnableV1={sync,hasCloudWork};
