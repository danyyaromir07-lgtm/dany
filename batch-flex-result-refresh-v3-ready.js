// Change-driven result refresh with renderer-readiness retry.
// Never marks a flexible-analysis result as consumed until the existing
// result-line renderer is actually available and has been called.
const ANALYZE='#batchAnalyze';
let timer=null,last='';
function signature(){
  try{
    const x=window.__flexTextAnalysis;
    if(!x)return '';
    return JSON.stringify(x.extra||[]);
  }catch(_){return ''}
}
function refreshIfReady(){
  const s=signature();
  if(!s||s===last)return false;
  const refresh=window.__refreshBatchResultLines;
  if(typeof refresh!=='function')return false;
  try{refresh()}catch(_){return false}
  last=s;
  return true;
}
function watch(){
  if(timer)clearInterval(timer);
  last='';
  let stable=0,ticks=0;
  timer=setInterval(()=>{
    const published=!!signature();
    const changed=refreshIfReady();
    stable=changed?0:(published&&last?stable+1:0);
    if((last&&stable>=10)||++ticks>=600){clearInterval(timer);timer=null}
  },100);
}
document.querySelector(ANALYZE)?.addEventListener('click',watch);
