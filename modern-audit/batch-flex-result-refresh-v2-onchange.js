// Refresh result rows only when flexible analysis publishes a genuinely new result.
// No PDF parsing/editing happens here; this replaces the old 50x/5s redraw window.
const ANALYZE='#batchAnalyze';
let timer=null,last='';
function signature(){
  try{
    const x=window.__flexTextAnalysis;
    if(!x)return '';
    return JSON.stringify(x.extra||[]);
  }catch(_){return ''}
}
function refreshIfChanged(){
  const s=signature();
  if(!s||s===last)return false;
  last=s;
  try{window.__refreshBatchResultLines?.()}catch(_){}
  return true;
}
function watch(){
  if(timer)clearInterval(timer);
  last='';
  let stable=0,ticks=0;
  timer=setInterval(()=>{
    const changed=refreshIfChanged();
    stable=changed?0:stable+1;
    // Once flexible analysis has published and remained unchanged for ~1 s, stop.
    if((last&&stable>=10)||++ticks>=600){clearInterval(timer);timer=null}
  },100);
}
document.querySelector(ANALYZE)?.addEventListener('click',watch);
