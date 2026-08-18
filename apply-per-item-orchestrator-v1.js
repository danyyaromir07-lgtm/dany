// Capture-phase Apply router loaded AFTER performance-diagnostics-v1.
// The diagnostic listener therefore records the click first; this router then prevents
// the legacy whole-batch preflight handler in index.html from running.
const APPLY='#batchApply',STATUS='#batchStatus';
let running=false;
function q(s){return document.querySelector(s);}
function perf(event){try{window.__performanceDiagnostic?.({scope:'apply',...event});}catch(_){}}

// Lightweight import: restores the persisted last-preflight breadcrumb after a crash.
import('./batch-preflight-per-item-v1.js?v=20260818-peritem1').catch(()=>{});

function install(){
  const button=q(APPLY);if(!button||button.__perItemApplyRouter)return false;
  button.__perItemApplyRouter=true;
  button.addEventListener('click',async(event)=>{
    // performance-diagnostics-v1 registered its capture listener before this module.
    // Stop the older bubble handler so it cannot run __prepareBatchAnnotationOperations()
    // over the entire batch before Apply starts.
    event.preventDefault();event.stopImmediatePropagation();
    if(running)return;
    running=true;
    const status=q(STATUS),key=`apply-router::${Date.now()}`;
    if(status)status.textContent='Iniciando aplicación por PDF…';
    perf({action:'start',stage:'arranque del motor Apply por PDF',key});
    try{
      const mod=await import('./batch-apply-fallback-per-item-v1.js?v=20260818-peritem1');
      if(typeof mod.runFallback!=='function')throw new Error('El ejecutor por PDF no exporta runFallback.');
      perf({action:'end',stage:'arranque del motor Apply por PDF',key});
      await mod.runFallback();
    }catch(error){
      perf({action:'end',stage:'arranque del motor Apply por PDF',key,warning:error?.message||String(error)});
      console.error(error);
      if(status)status.textContent='ERROR AL APLICAR: '+(error?.message||String(error));
    }finally{running=false;}
  },true);
  return true;
}
function wire(){if(install())return;let ticks=0;const timer=setInterval(()=>{if(install()||++ticks>200)clearInterval(timer);},50);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
window.__applyPerItemOrchestratorV1={version:1};
