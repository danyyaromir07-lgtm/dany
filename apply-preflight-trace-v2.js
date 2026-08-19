const KEY='pdf-tools::apply-inline-trace-v1';
const MAX=24;
let history=[];
function safeScalar(v){return v==null||['string','number','boolean'].includes(typeof v)?v:String(v);}
function push(stage,extra={}){
  try{
    const entry={at:new Date().toISOString(),stage:String(stage||'')};
    for(const [k,v] of Object.entries(extra||{}))if(v==null||typeof v!=='object')entry[k]=safeScalar(v);
    history.push(entry);if(history.length>MAX)history=history.slice(-MAX);
    localStorage.setItem(KEY,JSON.stringify({...entry,history:history.map((e,i)=>`${i+1}:${e.stage}${e.file?`[${e.file}]`:''}`).join(' > ')}));
  }catch(_){}
}
function flags(fn){
  if(typeof fn!=='function')return{prepare:'none'};
  return{prepare:'function',cloudSafe:!!fn.__cloudSafeWrap,exact:!!fn.__exactCloudStreamWrap,tolerance:!!fn.__cloudFailureToleranceWrap,oldProbe:!!fn.__preflightBreadcrumbWrap};
}
let perfWrapped=null;
function installPerfObserver(){
  const current=window.__performanceDiagnostic;
  if(typeof current!=='function'||current===perfWrapped||current.__applyInlineTraceV1)return;
  const base=current;
  perfWrapped=function(event){
    try{if(event?.scope==='apply')push(`perf:${String(event.action||'event')}:${String(event.stage||'')}`,{file:event.file||'',removed:event.removed??'',sizeBytes:event.sizeBytes??'',outputBytes:event.outputBytes??'',warning:event.warning||''});}catch(_){}
    return base.apply(this,arguments);
  };
  perfWrapped.__applyInlineTraceV1=true;
  window.__performanceDiagnostic=perfWrapped;
}
function wrapCurrentPreflightAtClick(){
  const base=window.__prepareBatchAnnotationOperations;
  push('click capture',flags(base));
  if(typeof base!=='function'){push('preflight ausente');return;}
  const wrapped=async function(...args){
    push('preflight enter',flags(base));
    try{
      const result=await base.apply(this,args);
      push('preflight exit');
      return result;
    }catch(error){
      push('preflight error',{error:error?.message||String(error)});
      throw error;
    }
  };
  for(const k of ['__cloudSafeWrap','__exactCloudStreamWrap','__exactCloudStreamVersion','__cloudFailureToleranceWrap']){try{if(base[k]!=null)wrapped[k]=base[k];}catch(_){}}
  wrapped.__applyInlineClickWrap=true;
  window.__prepareBatchAnnotationOperations=wrapped;
  push('preflight wrapped at click',flags(wrapped));
}
function onDocumentClick(event){
  const target=event?.target;
  if(!target?.closest?.('#batchApply'))return;
  history=[];
  installPerfObserver();
  wrapCurrentPreflightAtClick();
}
function install(){
  document.addEventListener('click',onDocumentClick,true);
  installPerfObserver();
  push('delegated trace installed');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
window.__applyPreflightTraceV2={version:3,push};
