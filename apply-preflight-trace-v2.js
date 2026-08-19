const KEY='pdf-tools::apply-breadcrumb-v1';
const MAX=24;
let history=[];
function safeScalar(v){return v==null||['string','number','boolean'].includes(typeof v)?v:String(v);}
function push(stage,extra={}){
  try{
    const entry={at:new Date().toISOString(),stage:String(stage||'')};
    for(const [k,v] of Object.entries(extra||{})) if(v==null||typeof v!=='object') entry[k]=safeScalar(v);
    history.push(entry);if(history.length>MAX)history=history.slice(-MAX);
    const compact=history.map((e,i)=>`${i+1}:${e.stage}${e.file?`[${e.file}]`:''}`).join(' > ');
    localStorage.setItem(KEY,JSON.stringify({...entry,history:compact}));
  }catch(_){}
}
function flags(fn){
  if(typeof fn!=='function')return {prepare:'none'};
  return {
    prepare:'function',
    cloudSafe:!!fn.__cloudSafeWrap,
    exact:!!fn.__exactCloudStreamWrap,
    tolerance:!!fn.__cloudFailureToleranceWrap,
    oldProbe:!!fn.__preflightBreadcrumbWrap
  };
}
let lastFn=null;
function observePrepareIdentity(){
  const fn=window.__prepareBatchAnnotationOperations;
  if(fn===lastFn)return;
  lastFn=fn;
  push('prepare function changed',flags(fn));
}
let perfWrapped=null;
function installPerfObserver(){
  const current=window.__performanceDiagnostic;
  if(typeof current!=='function'||current===perfWrapped||current.__applyTraceV2)return;
  const base=current;
  perfWrapped=function(event){
    try{
      if(event?.scope==='apply') push(`perf:${String(event.action||'event')}:${String(event.stage||'')}`,{
        file:event.file||'',removed:event.removed??'',sizeBytes:event.sizeBytes??'',outputBytes:event.outputBytes??'',warning:event.warning||''
      });
    }catch(_){}
    return base.apply(this,arguments);
  };
  perfWrapped.__applyTraceV2=true;
  window.__performanceDiagnostic=perfWrapped;
  push('performance observer installed');
}
function installClickTrace(){
  const b=document.querySelector('#batchApply');if(!b)return false;
  b.addEventListener('click',()=>{
    history=[];
    push('click capture',flags(window.__prepareBatchAnnotationOperations));
  },true);
  b.addEventListener('click',()=>{
    push('click bubble after primary handler yielded',flags(window.__prepareBatchAnnotationOperations));
  });
  return true;
}
function install(){
  push('trace v2 loaded');
  installClickTrace();
  observePrepareIdentity();
  installPerfObserver();
  let ticks=0;
  const timer=setInterval(()=>{
    observePrepareIdentity();
    installPerfObserver();
    if(++ticks>1200)clearInterval(timer);
  },25);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
window.__applyPreflightTraceV2={version:2,push};
