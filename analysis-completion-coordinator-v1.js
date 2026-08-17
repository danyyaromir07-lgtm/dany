// Completion coordinator for Analyze PDFs.
// UI/orchestration only: does not inspect or modify PDF bytes and does not alter detector/remover algorithms.
const ANALYZE='#batchAnalyze', APPLY='#batchApply', STATUS='#batchStatus', CLOUD='#batchRemoveRevisionClouds', OCR='#batchEnableOCR', OCR_DIAG='#ocrDiagLog';
const q=s=>document.querySelector(s);
let cycle=0, timer=null;

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const now=()=>Date.now();
function longCodeKey(s){return String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'').replace(/o/g,'0').replace(/i/g,'1');}
function isLongDrawingCode(s){const raw=String(s||'').trim(),parts=raw.split('_').filter(Boolean),key=longCodeKey(raw);return raw.includes('_')&&key.length>=20&&key.length<=90&&parts.length>=5&&parts.every(p=>/^[A-Za-z0-9.-]+$/.test(p));}
function hasLongDrawingCode(batch){return(batch||[]).some(item=>(item?.counts||[]).some(rule=>isLongDrawingCode(rule?.find)));}

function nonErrorBatch(){const batch=Array.isArray(window.__batchAnalysis)?window.__batchAnalysis:[];return batch.filter(x=>x&&!x.error);}
function selectedClouds(){return q(CLOUD)?.checked===true;}

function hasApplyWork(){
  const batch=nonErrorBatch();if(!batch.length)return false;
  const removeComments=q('#batchRemoveComments')?.checked!==false,removeClouds=selectedClouds(),removeSignatures=q('#batchRemoveSignatures')?.checked===true,removeLinks=q('#batchRemoveLinks')?.checked===true;
  return batch.some(a=>{
    const edit=Array.isArray(a.counts)&&a.counts.some(c=>Number(c?.count||0)>0||Number(c?.annotationCount||0)>0||Number(c?.ocrCount||0)>0);
    const comments=removeComments&&Number(a?.comments||0)>0;
    const clouds=removeClouds&&(Number(a?.revisionCloudCount||0)>0||Number(a?.revisionCloudPending?.count||0)>0);
    const signatures=removeSignatures&&Number(a?.signatureCount||0)>0;
    const links=removeLinks&&Number(a?.linkCount||0)>0;
    return edit||comments||clouds||signatures||links;
  });
}

function cloudEventAfter(startedAt,stages){const ev=Array.isArray(window.__cloudDiagnosticsEvents)?window.__cloudDiagnosticsEvents:[];return ev.find(e=>Number(e?.time||0)>=startedAt&&stages.includes(e?.stage));}
function cloudErrorsAfter(startedAt){const ev=Array.isArray(window.__cloudDiagnosticsEvents)?window.__cloudDiagnosticsEvents:[];return ev.filter(e=>Number(e?.time||0)>=startedAt&&(/error$/.test(String(e?.stage||''))||e?.error));}

function deferredOcrDone(state,batch){
  const enabled=q(OCR)?.checked===true;if(!enabled)return true;
  const diag=String(q(OCR_DIAG)?.textContent||'');if(diag!==state.lastOcrDiag){state.lastOcrDiag=diag;state.lastOcrDiagChange=now();}
  if(hasLongDrawingCode(batch)){
    const horizontal=!!window.__longTitleBlockOCR&&window.__longTitleBlockOCR!==state.previousLong&&Number(window.__longTitleBlockOCR?.version)===5;
    const vertical=!!window.__longTitleBlockVerticalOCR&&window.__longTitleBlockVerticalOCR!==state.previousVertical&&Number(window.__longTitleBlockVerticalOCR?.version)===1;
    const legacy=!!window.__longTitleBlockVerticalLegacyOCR&&window.__longTitleBlockVerticalLegacyOCR!==state.previousLegacy&&Number(window.__longTitleBlockVerticalLegacyOCR?.version)===1;
    state.ocrHorizontalDone=horizontal;state.ocrVerticalDone=vertical;state.ocrLegacyDone=legacy;
    return horizontal&&vertical&&legacy;
  }
  return state.baseDone&&now()-state.baseDoneAt>=1200&&now()-state.lastOcrDiagChange>=1800;
}

function stageLabel(s){
  if(!s.baseDone)return 'análisis base / OCR principal';
  if(!s.deferredOcrDone){if(!s.ocrHorizontalDone&&hasLongDrawingCode(Array.isArray(window.__batchAnalysis)?window.__batchAnalysis:[]))return 'OCR de código completo horizontal';if(!s.ocrVerticalDone)return 'OCR de código completo vertical';if(!s.ocrLegacyDone)return 'comprobación vertical final';return 'comprobaciones OCR/adaptativas';}
  if(!s.cloudSelected)return 'consolidando resultados';
  if(!s.cloudAnalysisDone)return 'detección de nubes raster/vectoriales';
  if(!s.zeroPendingDone)return 'comprobación de nubes raster=0';
  if(!s.colorOptionalDone)return 'comprobación de nubes por estructura/color';
  return 'consolidando resultados';
}

function writeBusy(label){const st=q(STATUS);if(st)st.textContent=`⏳ Comprobación en curso · ${label}…`;const apply=q(APPLY);if(apply)apply.disabled=true;}

function publishState(state,extra={}){window.__analysisCompletionState={version:1,cycle:state.id,startedAt:state.startedAt,running:!state.finished,complete:false,...extra};window.dispatchEvent(new CustomEvent('analysis-completion-state',{detail:window.__analysisCompletionState}));}

function finalize(state){
  if(state.finished)return;state.finished=true;if(timer){clearInterval(timer);timer=null;}
  window.__refreshBatchResultLines?.();window.__revisionCloudApplyEnableV1?.sync?.();
  const apply=q(APPLY);if(apply)apply.disabled=!hasApplyWork();
  const itemErrors=(Array.isArray(window.__batchAnalysis)?window.__batchAnalysis:[]).filter(x=>x?.error).length,cloudErrors=cloudErrorsAfter(state.startedAt),warnings=itemErrors+cloudErrors.length;
  const st=q(STATUS);if(st)st.textContent=warnings?`⚠️ Comprobación finalizada con avisos · todos los operadores seleccionados han terminado · ${warnings} aviso${warnings===1?'':'s'}.`:'✅ Comprobación completa · todos los operadores seleccionados han terminado.';
  window.__analysisCompletionState={version:1,cycle:state.id,startedAt:state.startedAt,finishedAt:now(),running:false,complete:warnings===0,warnings,stages:{base:true,deferredOcr:true,cloudAnalysis:!state.cloudSelected||state.cloudAnalysisDone,zeroPending:!state.cloudSelected||state.zeroPendingDone,colorOptional:!state.cloudSelected||state.colorOptionalDone}};
  window.dispatchEvent(new CustomEvent('analysis-completion-state',{detail:window.__analysisCompletionState}));
}

function beginCycle(){
  const id=++cycle;if(timer){clearInterval(timer);timer=null;}
  const previousBatch=window.__batchAnalysis;
  const state={id,startedAt:now(),previousBatch,cloudSelected:selectedClouds(),zeroBaseline:Number(window.__revisionCloudZeroPendingVersion||0),colorBaseline:window.__revisionCloudColoredOptionalState,previousLong:window.__longTitleBlockOCR,previousVertical:window.__longTitleBlockVerticalOCR,previousLegacy:window.__longTitleBlockVerticalLegacyOCR,lastOcrDiag:String(q(OCR_DIAG)?.textContent||''),lastOcrDiagChange:now(),baseDone:false,baseDoneAt:0,deferredOcrDone:false,ocrHorizontalDone:false,ocrVerticalDone:false,ocrLegacyDone:false,cloudAnalysisDone:false,zeroPendingDone:false,colorOptionalDone:false,settledSince:0,finished:false};
  publishState(state,{running:true});writeBusy('iniciando análisis');
  timer=setInterval(()=>{
    if(id!==cycle||state.finished)return;
    const batch=Array.isArray(window.__batchAnalysis)?window.__batchAnalysis:[],batchChanged=batch!==state.previousBatch,baseShape=batch.length>0&&batch.every(x=>x?.error||x?.data),analyzeIdle=q(ANALYZE)?.disabled===false;
    state.baseDone=!!(batchChanged&&baseShape&&analyzeIdle);if(state.baseDone&&!state.baseDoneAt)state.baseDoneAt=now();
    state.deferredOcrDone=state.baseDone&&deferredOcrDone(state,batch);

    if(state.cloudSelected&&state.baseDone){
      const end=cloudEventAfter(state.startedAt,['cloud.analysis.end']),fatal=cloudEventAfter(state.startedAt,['cloud.error']);state.cloudAnalysisDone=!!(end||fatal);
      state.zeroPendingDone=Number(window.__revisionCloudZeroPendingVersion||0)>state.zeroBaseline;
      state.colorOptionalDone=window.__revisionCloudColoredOptionalState!==state.colorBaseline;
    }else if(!state.cloudSelected&&state.baseDone){state.cloudAnalysisDone=state.zeroPendingDone=state.colorOptionalDone=true;}

    const allDone=state.baseDone&&state.deferredOcrDone&&state.cloudAnalysisDone&&state.zeroPendingDone&&state.colorOptionalDone;
    if(!allDone){state.settledSince=0;writeBusy(stageLabel(state));publishState(state,{running:true,stage:stageLabel(state)});return;}
    if(!state.settledSince)state.settledSince=now();
    if(now()-state.settledSince<700){writeBusy('consolidando resultados');publishState(state,{running:true,stage:'consolidando resultados'});return;}
    finalize(state);
  },100);

  // Never report a false success. A stalled operator leaves Apply blocked instead of publishing a green completion state.
  (async()=>{await sleep(30*60*1000);if(id!==cycle||state.finished)return;if(timer){clearInterval(timer);timer=null;}state.finished=true;const st=q(STATUS);if(st)st.textContent='⚠️ Comprobación detenida: un operador no publicó su señal de finalización. No se habilitó Aplicar para evitar un estado incompleto.';const apply=q(APPLY);if(apply)apply.disabled=true;window.__analysisCompletionState={version:1,cycle:id,startedAt:state.startedAt,finishedAt:now(),running:false,complete:false,timeout:true};window.dispatchEvent(new CustomEvent('analysis-completion-state',{detail:window.__analysisCompletionState}));})();
}

function wire(){
  q(ANALYZE)?.addEventListener('click',beginCycle,true);
  const apply=q(APPLY);if(apply)new MutationObserver(()=>{if(window.__analysisCompletionState?.running===true)apply.disabled=true;}).observe(apply,{attributes:true,attributeFilter:['disabled']});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
window.__analysisCompletionCoordinatorV1={beginCycle,hasApplyWork};
