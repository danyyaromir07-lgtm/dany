const KEY='pdf-tools::apply-breadcrumb-v1';
function crumb(stage,extra={}){try{localStorage.setItem(KEY,JSON.stringify({at:new Date().toISOString(),stage,...extra}))}catch(_){}}

let wrappedPrepare=null;
function tryWrapPrepare(){
  const current=window.__prepareBatchAnnotationOperations;
  if(typeof current!=='function'||current===wrappedPrepare||current.__preflightBreadcrumbWrap)return false;
  const base=current;
  const wrapped=async function(...args){
    crumb('preflight · entrando a __prepareBatchAnnotationOperations');
    try{
      const out=await base.apply(this,args);
      crumb('preflight · __prepareBatchAnnotationOperations finalizado');
      return out;
    }catch(error){
      crumb('preflight · error capturado',{error:error?.message||String(error)});
      throw error;
    }
  };
  for(const k of ['__cloudSafeWrap','__exactCloudStreamWrap','__exactCloudStreamVersion']){try{if(base[k]!=null)wrapped[k]=base[k]}catch(_){}}
  wrapped.__preflightBreadcrumbWrap=true;
  wrappedPrepare=wrapped;
  window.__prepareBatchAnnotationOperations=wrapped;
  crumb('preflight · wrapper diagnóstico instalado');
  return true;
}

let perfBase=null,perfWrapped=null;
function tryWrapPerf(){
  const current=window.__performanceDiagnostic;
  if(typeof current!=='function'||current===perfWrapped||current.__preflightBreadcrumbPerf)return false;
  perfBase=current;
  perfWrapped=function(event){
    try{
      if(event?.scope==='apply')crumb(`perf Apply · ${String(event.action||'evento')} · ${String(event.stage||'')}`,{
        file:event.file||'',sizeBytes:event.sizeBytes??'',outputBytes:event.outputBytes??'',removed:event.removed??'',warning:event.warning||''
      });
    }catch(_){}
    return perfBase.apply(this,arguments);
  };
  perfWrapped.__preflightBreadcrumbPerf=true;
  window.__performanceDiagnostic=perfWrapped;
  crumb('preflight · observador perf instalado');
  return true;
}

let ticks=0;
const timer=setInterval(()=>{
  tryWrapPrepare();
  tryWrapPerf();
  if(++ticks>400)clearInterval(timer);
},25);
tryWrapPrepare();
tryWrapPerf();

window.__applyPreflightBreadcrumbV1={version:1,crumb};
