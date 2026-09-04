// Completion coordinator v3: waits for flexible text, final result refresh and optional
// selective-text hydration before publishing COMPROBACIÓN COMPLETA.
// It does not edit PDF bytes or change detector/remover algorithms.
import { inspectSelectedAnnotationMetadata } from './analysis-annotation-inspection-v1.js?v=20260817-completion1';
const ANALYZE='#batchAnalyze',CLOUD='#batchRemoveRevisionClouds',OCR='#batchEnableOCR',OCR_DIAG='#ocrDiagLog',FILES='#batchFiles',SELECT='#batchSelectTextOccurrences';
const q=s=>document.querySelector(s);
let cycle=0,timer=null;
const now=()=>Date.now();
function hasSelectedFiles(){return Number(q(FILES)?.files?.length||0)>0;}
function selectedClouds(){return q(CLOUD)?.checked===true;}
function needsAnnotationMetadata(){return q('#batchRemoveSignatures')?.checked===true||q('#batchRemoveLinks')?.checked===true;}
function codeKey(s){return String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'').replace(/o/g,'0').replace(/i/g,'1');}
function isLongDrawingCode(v){const raw=String(v||'').trim(),parts=raw.split('_').filter(Boolean),k=codeKey(raw);return raw.includes('_')&&k.length>=20&&k.length<=90&&parts.length>=5&&parts.every(p=>/^[A-Za-z0-9.-]+$/.test(p));}
function batchHasLongCode(batch){return(batch||[]).some(item=>(item?.counts||[]).some(rule=>isLongDrawingCode(rule?.find)));}
function cloudErrorsAfter(startedAt){const ev=Array.isArray(window.__cloudDiagnosticsEvents)?window.__cloudDiagnosticsEvents:[];return ev.filter(e=>Number(e?.time||0)>=startedAt&&(/error$/.test(String(e?.stage||''))||e?.error));}
function publish(state,extra={}){window.__analysisCompletionState={version:7,cycle:state.id,startedAt:state.startedAt,running:!state.finished,complete:false,...extra};window.dispatchEvent(new CustomEvent('analysis-completion-state',{detail:window.__analysisCompletionState}));}
function startAnnotationStage(state,batch){if(state.annotationStarted)return;state.annotationStarted=true;if(!state.annotationRequired){state.annotationDone=true;return;}inspectSelectedAnnotationMetadata(batch).then(r=>{state.annotationWarnings=Number(r?.errors||0);state.annotationDone=true;}).catch(()=>{state.annotationWarnings++;state.annotationDone=true;});}
function updateOcr(state,batch){
  if(q(OCR)?.checked!==true){state.ocrQuiet=true;state.horizontalDone=true;state.verticalDone=true;state.legacyDone=true;state.ocrDone=true;return;}
  const text=String(q(OCR_DIAG)?.textContent||'');if(text!==state.lastOcrDiag){state.lastOcrDiag=text;state.lastOcrChange=now();}
  if(!state.baseDone){state.ocrDone=false;return;}
  state.ocrQuiet=now()-state.baseDoneAt>=1200&&now()-state.lastOcrChange>=2500;
  state.longCodeRequired=batchHasLongCode(batch);
  if(!state.longCodeRequired){state.horizontalDone=state.verticalDone=state.legacyDone=true;state.ocrDone=state.ocrQuiet;return;}
  state.horizontalDone=window.__longTitleBlockOCR!==state.longBaseline&&Number(window.__longTitleBlockOCR?.version)===5;
  state.verticalDone=window.__longTitleBlockVerticalOCR!==state.verticalBaseline&&Number(window.__longTitleBlockVerticalOCR?.version)===1;
  state.legacyDone=window.__longTitleBlockVerticalLegacyOCR!==state.legacyBaseline&&Number(window.__longTitleBlockVerticalLegacyOCR?.version)===1;
  state.ocrDone=state.ocrQuiet&&state.horizontalDone&&state.verticalDone&&state.legacyDone;
}
function updateCloudStages(state){
  if(!state.cloudSelected){state.vectorDone=state.zeroDone=state.colorDone=state.redCycleDone=state.additiveDone=true;return;}
  state.vectorDone=window.__revisionCloudVectorFallbackDebug!==state.vectorBaseline;
  state.zeroDone=Number(window.__revisionCloudZeroPendingVersion||0)>state.zeroBaseline;
  state.colorDone=window.__revisionCloudColoredOptionalState!==state.colorBaseline;
  state.redCycleDone=Number(window.__revisionCloudRedCycleVersion||0)>state.redCycleBaseline;
  state.additiveDone=Number(window.__revisionCloudAdditiveFamilyVersion||0)>state.additiveBaseline;
}
function selectiveHydrated(batch){
  if(q(SELECT)?.checked!==true)return true;
  return(batch||[]).every(item=>item?.error||(item?.counts||[]).every(rule=>Number(rule?.count||0)<=0||rule?.selectiveText?.enabled===true));
}
function updatePostAnalysis(state,batch){
  if(!state.baseDone)return;
  if(!state.flexDone){const flex=window.__flexTextAnalysis;if(flex&&flex!==state.flexBaseline)state.flexDone=true;}
  if(!state.flexDone)return;
  const extra=Array.isArray(window.__flexTextAnalysis?.extra)?window.__flexTextAnalysis.extra:[];
  if(!extra.length)state.resultsDone=true;
  else if(!state.resultsDone&&typeof window.__refreshBatchResultLines==='function'){
    try{window.__refreshBatchResultLines();state.resultsDone=true;}catch(_){}
  }
  if(!state.resultsDone)return;
  state.selectionRequired=q(SELECT)?.checked===true;
  state.selectionDone=selectiveHydrated(batch);
}
function label(state){
  if(!state.baseDone)return 'análisis base / OCR principal';
  if(state.longCodeRequired&&!state.horizontalDone)return 'OCR de código completo horizontal';
  if(state.longCodeRequired&&!state.verticalDone)return 'OCR de código completo vertical';
  if(state.longCodeRequired&&!state.legacyDone)return 'comprobación vertical heredada';
  if(!state.ocrDone)return 'cerrando comprobaciones OCR/adaptativas';
  if(!state.annotationDone)return 'inspección de firmas/enlaces seleccionados';
  if(state.cloudSelected&&!state.vectorDone)return 'detección vectorial de nubes';
  if(state.cloudSelected&&!state.zeroDone)return 'comprobación de nubes raster=0';
  if(state.cloudSelected&&!state.colorDone)return 'comprobación de nubes por estructura/color';
  if(state.cloudSelected&&!state.redCycleDone)return 'comprobación de ciclo curvo rojo';
  if(state.cloudSelected&&!state.additiveDone)return 'comprobación de familias estructurales adicionales';
  if(!state.flexDone)return 'comprobando coincidencias de texto fragmentado';
  if(!state.resultsDone)return 'actualizando resultados finales';
  if(state.selectionRequired&&!state.selectionDone)return 'preparando selección individual de coincidencias';
  return 'consolidando resultados';
}
function finalize(state){if(state.finished)return;state.finished=true;if(timer){clearInterval(timer);timer=null;}const itemErrors=(Array.isArray(window.__batchAnalysis)?window.__batchAnalysis:[]).filter(x=>x?.error).length,warnings=itemErrors+cloudErrorsAfter(state.startedAt).length+Number(state.annotationWarnings||0);window.__analysisCompletionState={version:7,cycle:state.id,startedAt:state.startedAt,finishedAt:now(),running:false,complete:warnings===0,warnings,stages:{base:true,ocr:true,horizontalLongCode:!state.longCodeRequired||state.horizontalDone,verticalLongCode:!state.longCodeRequired||state.verticalDone,legacyVertical:!state.longCodeRequired||state.legacyDone,annotation:true,vectorCloud:!state.cloudSelected||state.vectorDone,zeroPending:!state.cloudSelected||state.zeroDone,colorOptional:!state.cloudSelected||state.colorDone,redCurvedCycle:!state.cloudSelected||state.redCycleDone,additiveCloudFamilies:!state.cloudSelected||state.additiveDone,flexibleText:state.flexDone,resultRefresh:state.resultsDone,selectiveHydration:!state.selectionRequired||state.selectionDone}};window.dispatchEvent(new CustomEvent('analysis-completion-state',{detail:window.__analysisCompletionState}));}
function beginCycle(){if(!hasSelectedFiles())return;const id=++cycle;if(timer){clearInterval(timer);timer=null;}const state={id,startedAt:now(),previousBatch:window.__batchAnalysis,cloudSelected:selectedClouds(),annotationRequired:needsAnnotationMetadata(),annotationStarted:false,annotationDone:!needsAnnotationMetadata(),annotationWarnings:0,vectorBaseline:window.__revisionCloudVectorFallbackDebug,zeroBaseline:Number(window.__revisionCloudZeroPendingVersion||0),colorBaseline:window.__revisionCloudColoredOptionalState,redCycleBaseline:Number(window.__revisionCloudRedCycleVersion||0),additiveBaseline:Number(window.__revisionCloudAdditiveFamilyVersion||0),longBaseline:window.__longTitleBlockOCR,verticalBaseline:window.__longTitleBlockVerticalOCR,legacyBaseline:window.__longTitleBlockVerticalLegacyOCR,flexBaseline:window.__flexTextAnalysis,lastOcrDiag:String(q(OCR_DIAG)?.textContent||''),lastOcrChange:now(),baseDone:false,baseDoneAt:0,longCodeRequired:false,ocrQuiet:false,ocrDone:false,horizontalDone:false,verticalDone:false,legacyDone:false,vectorDone:false,zeroDone:false,colorDone:false,redCycleDone:false,additiveDone:false,flexDone:false,resultsDone:false,selectionRequired:q(SELECT)?.checked===true,selectionDone:q(SELECT)?.checked!==true,settledSince:0,finished:false};publish(state,{running:true,stage:'iniciando análisis'});timer=setInterval(()=>{if(id!==cycle||state.finished)return;const batch=Array.isArray(window.__batchAnalysis)?window.__batchAnalysis:[],baseShape=batch.length>0&&batch.every(x=>x?.error||x?.data),batchChanged=batch!==state.previousBatch,analyzeIdle=q(ANALYZE)?.disabled===false;if(!state.baseDone&&batchChanged&&baseShape&&analyzeIdle){state.baseDone=true;state.baseDoneAt=now();startAnnotationStage(state,batch);}updateOcr(state,batch);if(state.baseDone)updateCloudStages(state);updatePostAnalysis(state,batch);const done=state.baseDone&&state.ocrDone&&state.annotationDone&&state.vectorDone&&state.zeroDone&&state.colorDone&&state.redCycleDone&&state.additiveDone&&state.flexDone&&state.resultsDone&&(!state.selectionRequired||state.selectionDone);if(!done){state.settledSince=0;publish(state,{running:true,stage:label(state)});return;}if(!state.settledSince)state.settledSince=now();if(now()-state.settledSince<900){publish(state,{running:true,stage:'consolidando resultados'});return;}finalize(state);},120);}
function wire(){q(ANALYZE)?.addEventListener('click',beginCycle,true);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
window.__analysisCompletionCoordinatorV3={beginCycle,version:7};
