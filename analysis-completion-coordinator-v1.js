// Completion coordinator for Analyze PDFs.
// UI/orchestration only: does not inspect or modify PDF bytes and does not alter detector/remover algorithms.
const ANALYZE='#batchAnalyze', APPLY='#batchApply', STATUS='#batchStatus', CLOUD='#batchRemoveRevisionClouds';
const q=s=>document.querySelector(s);
let cycle=0, timer=null;

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const now=()=>Date.now();

function nonErrorBatch(){
  const batch=Array.isArray(window.__batchAnalysis)?window.__batchAnalysis:[];
  return batch.filter(x=>x&&!x.error);
}

function selectedClouds(){return q(CLOUD)?.checked===true;}

function hasApplyWork(){
  const batch=nonErrorBatch();
  if(!batch.length)return false;
  const removeComments=q('#batchRemoveComments')?.checked!==false;
  const removeClouds=selectedClouds();
  const removeSignatures=q('#batchRemoveSignatures')?.checked===true;
  const removeLinks=q('#batchRemoveLinks')?.checked===true;
  return batch.some(a=>{
    const edit=Array.isArray(a.counts)&&a.counts.some(c=>Number(c?.count||0)>0||Number(c?.annotationCount||0)>0||Number(c?.ocrCount||0)>0);
    const comments=removeComments&&Number(a?.comments||0)>0;
    const clouds=removeClouds&&(Number(a?.revisionCloudCount||0)>0||Number(a?.revisionCloudPending?.count||0)>0);
    const signatures=removeSignatures&&Number(a?.signatureCount||0)>0;
    const links=removeLinks&&Number(a?.linkCount||0)>0;
    return edit||comments||clouds||signatures||links;
  });
}

function cloudEventAfter(startedAt, stages){
  const ev=Array.isArray(window.__cloudDiagnosticsEvents)?window.__cloudDiagnosticsEvents:[];
  return ev.find(e=>Number(e?.time||0)>=startedAt&&stages.includes(e?.stage));
}

function cloudErrorsAfter(startedAt){
  const ev=Array.isArray(window.__cloudDiagnosticsEvents)?window.__cloudDiagnosticsEvents:[];
  return ev.filter(e=>Number(e?.time||0)>=startedAt&&(/error$/.test(String(e?.stage||''))||e?.error));
}

function stageLabel(s){
  if(!s.baseDone)return 'análisis base / OCR';
  if(!s.cloudSelected)return 'consolidando resultados';
  if(!s.cloudAnalysisDone)return 'detección de nubes raster/vectoriales';
  if(!s.zeroPendingDone)return 'comprobación de nubes raster=0';
  if(!s.colorOptionalDone)return 'comprobación de nubes por estructura/color';
  return 'consolidando resultados';
}

function writeBusy(label){
  const st=q(STATUS);if(st)st.textContent=`⏳ Comprobación en curso · ${label}…`;
  const apply=q(APPLY);if(apply)apply.disabled=true;
}

function finalize(state){
  if(state.finished)return;state.finished=true;
  if(timer){clearInterval(timer);timer=null;}
  window.__refreshBatchResultLines?.();
  window.__revisionCloudApplyEnableV1?.sync?.();
  const apply=q(APPLY);if(apply)apply.disabled=!hasApplyWork();
  const itemErrors=(Array.isArray(window.__batchAnalysis)?window.__batchAnalysis:[]).filter(x=>x?.error).length;
  const cloudErrors=cloudErrorsAfter(state.startedAt);
  const warnings=itemErrors+cloudErrors.length;
  const st=q(STATUS);
  if(st)st.textContent=warnings
    ?`⚠️ Comprobación finalizada con avisos · todos los operadores seleccionados han terminado · ${warnings} aviso${warnings===1?'':'s'}.`
    :'✅ Comprobación completa · todos los operadores seleccionados han terminado.';
  window.__analysisCompletionState={
    version:1,cycle:state.id,startedAt:state.startedAt,finishedAt:now(),complete:warnings===0,warnings,
    stages:{base:true,cloudAnalysis:!state.cloudSelected||state.cloudAnalysisDone,zeroPending:!state.cloudSelected||state.zeroPendingDone,colorOptional:!state.cloudSelected||state.colorOptionalDone}
  };
}

function beginCycle(){
  const id=++cycle;
  if(timer){clearInterval(timer);timer=null;}
  const previousBatch=window.__batchAnalysis;
  const state={
    id,startedAt:now(),previousBatch,
    cloudSelected:selectedClouds(),
    zeroBaseline:Number(window.__revisionCloudZeroPendingVersion||0),
    colorBaseline:window.__revisionCloudColoredOptionalState,
    baseDone:false,cloudAnalysisDone:false,zeroPendingDone:false,colorOptionalDone:false,
    settledSince:0,finished:false
  };
  window.__analysisCompletionState={version:1,cycle:id,startedAt:state.startedAt,complete:false,running:true};
  writeBusy('iniciando análisis');
  timer=setInterval(()=>{
    if(id!==cycle||state.finished)return;
    const batch=Array.isArray(window.__batchAnalysis)?window.__batchAnalysis:[];
    const batchChanged=batch!==state.previousBatch;
    const baseShape=batch.length>0&&batch.every(x=>x?.error||x?.data);
    const analyzeIdle=q(ANALYZE)?.disabled===false;
    state.baseDone=!!(batchChanged&&baseShape&&analyzeIdle);

    if(state.cloudSelected&&state.baseDone){
      const end=cloudEventAfter(state.startedAt,['cloud.analysis.end']);
      const fatal=cloudEventAfter(state.startedAt,['cloud.error']);
      state.cloudAnalysisDone=!!(end||fatal);
      state.zeroPendingDone=Number(window.__revisionCloudZeroPendingVersion||0)>state.zeroBaseline;
      state.colorOptionalDone=window.__revisionCloudColoredOptionalState!==state.colorBaseline;
    }else if(!state.cloudSelected&&state.baseDone){
      state.cloudAnalysisDone=state.zeroPendingDone=state.colorOptionalDone=true;
    }

    const allDone=state.baseDone&&state.cloudAnalysisDone&&state.zeroPendingDone&&state.colorOptionalDone;
    if(!allDone){state.settledSince=0;writeBusy(stageLabel(state));return;}
    if(!state.settledSince)state.settledSince=now();
    // Small quiet window lets result-line observers and late UI-only counters settle.
    if(now()-state.settledSince<700){writeBusy('consolidando resultados');return;}
    finalize(state);
  },100);

  // Never report a false success. If something fails to publish its completion signal,
  // leave Apply blocked and expose a clear warning instead of saying "completa".
  (async()=>{
    await sleep(30*60*1000);
    if(id!==cycle||state.finished)return;
    if(timer){clearInterval(timer);timer=null;}
    const st=q(STATUS);if(st)st.textContent='⚠️ Comprobación detenida: un operador no publicó su señal de finalización. No se habilitó Aplicar para evitar un estado incompleto.';
    const apply=q(APPLY);if(apply)apply.disabled=true;
    window.__analysisCompletionState={version:1,cycle:id,startedAt:state.startedAt,finishedAt:now(),complete:false,running:false,timeout:true};
  })();
}

function wire(){
  q(ANALYZE)?.addEventListener('click',beginCycle,true);
  // If another module tries to enable Apply while a cycle is still running, keep it blocked.
  const apply=q(APPLY);if(apply)new MutationObserver(()=>{
    if(window.__analysisCompletionState?.running===true)apply.disabled=true;
  }).observe(apply,{attributes:true,attributeFilter:['disabled']});
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
window.__analysisCompletionCoordinatorV1={beginCycle,hasApplyWork};
