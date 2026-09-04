const KEY='pdf-tools::apply-breadcrumb-v1';
function crumb(stage,extra={}){
  try{window.__applyPreflightTraceV2?.push?.(stage,extra)}catch(_){}
  try{localStorage.setItem(KEY,JSON.stringify({at:new Date().toISOString(),stage,...extra}))}catch(_){}
}
crumb('loader fallback evaluado');
export async function runFallback(){
  if(document.querySelector('#batchRemoveSignatures')?.checked===true){
    crumb('firma final · importando barrera');
    const sig=await import('./signature-final-cleanup-v1.js?v=20260819-finalbarrier1');
    if(typeof sig.cleanBatchSignaturesBeforeRunner!=='function')throw new Error('No se pudo cargar la barrera final de firmas.');
    const result=await sig.cleanBatchSignaturesBeforeRunner();
    crumb('firma final · verificada antes de runner',{files:result?.files??0,removed:result?.removed??0});
  }
  crumb('loader fallback · importando runner');
  const mod=await import('./batch-apply-verified-heavy-flate-v4-content-aware.js?v=20260904-contentaware1');
  crumb('loader fallback · runner cargado');
  if(typeof mod.runFallback!=='function')throw new Error('No se pudo cargar el runner de Apply.');
  crumb('loader fallback · entrando a runner');
  const result=await mod.runFallback();
  crumb('loader fallback · runner finalizado');
  return result;
}
window.__runBatchFallback=runFallback;
