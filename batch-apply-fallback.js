const KEY='pdf-tools::apply-breadcrumb-v1';
function crumb(stage,extra={}){
  try{window.__applyPreflightTraceV2?.push?.(stage,extra)}catch(_){}
  try{localStorage.setItem(KEY,JSON.stringify({at:new Date().toISOString(),stage,...extra}))}catch(_){}
}
crumb('loader fallback evaluado');
export async function runFallback(){
  crumb('loader fallback · importando runner');
  const mod=await import('./batch-apply-verified-heavy-flate-v3.js?v=20260819-heavyflate3-trace2');
  crumb('loader fallback · runner cargado');
  if(typeof mod.runFallback!=='function')throw new Error('El runner pesado no exporta runFallback.');
  crumb('loader fallback · entrando a runner');
  const result=await mod.runFallback();
  crumb('loader fallback · runner finalizado');
  return result;
}
window.__runBatchFallback=runFallback;
