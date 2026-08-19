const TRACE_KEY='pdf-tools::apply-crash-trace-v2';
const LEGACY_KEY='pdf-tools::apply-breadcrumb-v1';
const MAX=24;
const HEAVY_FILE_BYTES=16*1024*1024;
const COMMENTS='#batchRemoveComments',SIG='#batchRemoveSignatures',LINKS='#batchRemoveLinks',CLOUDS='#batchRemoveRevisionClouds';
let history=[];
function safeScalar(v){return v==null||['string','number','boolean'].includes(typeof v)?v:String(v);}
function persist(data){
  try{
    const json=JSON.stringify(data);
    localStorage.setItem(TRACE_KEY,json);
    localStorage.setItem(LEGACY_KEY,json);
  }catch(_){}
}
function push(stage,extra={}){
  try{
    const entry={at:new Date().toISOString(),stage:String(stage||'')};
    for(const [k,v] of Object.entries(extra||{}))if(v==null||typeof v!=='object')entry[k]=safeScalar(v);
    history.push(entry);if(history.length>MAX)history=history.slice(-MAX);
    persist({...entry,history:history.map((e,i)=>`${i+1}:${e.stage}${e.file?`[${e.file}]`:''}`).join(' > ')});
  }catch(_){}
}
function flags(fn){
  if(typeof fn!=='function')return{prepare:'none'};
  return{prepare:'function',cloudSafe:!!fn.__cloudSafeWrap,exact:!!fn.__exactCloudStreamWrap,tolerance:!!fn.__cloudFailureToleranceWrap,oldProbe:!!fn.__preflightBreadcrumbWrap};
}
function activeReplacement(item){
  return (item?.counts||[]).some(r=>String(r?.find||'').trim()&&String(r?.replace??'')!==''&&(Number(r?.count||0)>0||Number(r?.annotationCount||0)>0||Number(r?.ocrCount||0)>0));
}
function clearDeferredFlags(){
  for(const item of Array.isArray(window.__batchAnalysis)?window.__batchAnalysis:[]){try{delete item.__deferHeavyCommentsToApply;}catch(_){}}
}
function deferredSingleHeavyItem(){
  const list=(Array.isArray(window.__batchAnalysis)?window.__batchAnalysis:[]).filter(item=>item&&!item.error&&item.data);
  if(list.length!==1)return null;
  if(document.querySelector(COMMENTS)?.checked!==true)return null;
  if(document.querySelector(SIG)?.checked===true||document.querySelector(LINKS)?.checked===true||document.querySelector(CLOUDS)?.checked===true)return null;
  const item=list[0],size=Number(item.data?.byteLength||item.data?.length||0);
  if(size<HEAVY_FILE_BYTES||!activeReplacement(item))return null;
  item.__deferHeavyCommentsToApply=true;
  return item;
}
let perfWrapped=null;
function installPerfObserver(){
  const current=window.__performanceDiagnostic;
  if(typeof current!=='function'||current===perfWrapped||current.__applyCrashTraceV5)return;
  const base=current;
  perfWrapped=function(event){
    try{if(event?.scope==='apply')push(`perf:${String(event.action||'event')}:${String(event.stage||'')}`,{file:event.file||'',removed:event.removed??'',sizeBytes:event.sizeBytes??'',outputBytes:event.outputBytes??'',warning:event.warning||''});}catch(_){}
    return base.apply(this,arguments);
  };
  perfWrapped.__applyCrashTraceV5=true;
  window.__performanceDiagnostic=perfWrapped;
}
function wrapCurrentPreflightAtClick(){
  const base=window.__prepareBatchAnnotationOperations;
  push('click capture',flags(base));
  if(typeof base!=='function'){push('preflight ausente');return;}
  const wrapped=async function(...args){
    push('preflight enter',flags(base));
    const deferred=deferredSingleHeavyItem();
    if(deferred){
      push('preflight · comentarios diferidos a Apply pesado',{file:deferred.name||'',sizeBytes:Number(deferred.data?.byteLength||deferred.data?.length||0)});
      push('preflight exit',{deferredComments:true});
      return;
    }
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
  clearDeferredFlags();
  try{localStorage.removeItem(TRACE_KEY);}catch(_){}
  installPerfObserver();
  wrapCurrentPreflightAtClick();
}
function restorePreviousCrashTrace(){
  try{
    const saved=localStorage.getItem(TRACE_KEY);
    if(saved)localStorage.setItem(LEGACY_KEY,saved);
  }catch(_){}
}
function install(){
  restorePreviousCrashTrace();
  document.addEventListener('click',onDocumentClick,true);
  installPerfObserver();
  let ticks=0;
  const timer=setInterval(()=>{installPerfObserver();if(++ticks>1200)clearInterval(timer);},25);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
window.__applyPreflightTraceV2={version:5,push,traceKey:TRACE_KEY};
