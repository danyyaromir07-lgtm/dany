// Isolated tolerance layer for unsafe revision-cloud candidates.
// It does not change detection or removal. It only prevents a non-removable
// candidate from aborting the whole batch after the stable v5 remover refuses it.
const STATUS='#batchStatus';
const CLOUD_ERROR_PREFIX='Nubes: no se pudo validar eliminación segura';

function install(){
  const base=window.__prepareBatchAnnotationOperations;
  if(typeof base!=='function'||!base.__exactCloudStreamWrap||base.__cloudFailureToleranceWrap)return false;

  const wrapped=async function(){
    try{
      return await base();
    }catch(err){
      const message=err?.message||String(err);
      if(!message.startsWith(CLOUD_ERROR_PREFIX))throw err;

      const applyDebug=window.__revisionCloudStreamApplyDebug||{};
      const removed=Math.max(0,Number(applyDebug.removed||0));
      const failures=Array.isArray(applyDebug.failures)?applyDebug.failures.slice():[];
      const skipped=failures.length;

      window.__revisionCloudFailureToleranceDebug={
        version:1,
        removed,
        skippedFiles:skipped,
        failures
      };

      try{
        window.__cloudDiagnostic?.({
          stage:'cloud.apply.partial',
          detail:`continuar lote · eliminadas=${removed} · archivos inseguros conservados=${skipped}`,
          reason:failures.join(' | ')
        });
      }catch(_){}

      const status=document.querySelector(STATUS);
      if(status){
        const removedText=`${removed} nube${removed===1?'':'s'} eliminada${removed===1?'':'s'}`;
        const skippedText=`${skipped} archivo${skipped===1?'':'s'} con candidato inseguro conservado${skipped===1?'':'s'}`;
        status.textContent=`☁️ ${removedText}${skipped?` · ${skippedText}`:''}.`;
      }
      return undefined;
    }
  };

  wrapped.__cloudSafeWrap=true;
  wrapped.__exactCloudStreamWrap=true;
  wrapped.__exactCloudStreamVersion=base.__exactCloudStreamVersion||5;
  wrapped.__cloudFailureToleranceWrap=true;
  window.__prepareBatchAnnotationOperations=wrapped;
  return true;
}

let ticks=0;
const timer=setInterval(()=>{if(install()||++ticks>300)clearInterval(timer);},50);
install();
window.__revisionCloudFailureTolerance={version:1};
