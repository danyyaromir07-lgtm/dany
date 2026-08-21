import { hasSelectiveRules, prepareSelectiveAnalysis, selectedExpected } from './text-occurrence-prepare-v1.js?v=20260821-selective1';

const q=s=>document.querySelector(s);
function patchUi(applied){
  if(!applied)return;
  const stat=q('#statEdits');
  if(stat)stat.textContent=String((Number(stat.textContent)||0)+applied);
  const summary=q('#batchSummary');
  if(summary&&summary.textContent&&!summary.textContent.includes('selección individual')){
    summary.textContent+=` · ${applied} edición${applied===1?'':'es'} por selección individual`;
  }
  const status=q('#batchStatus');
  if(status&&status.textContent&&!/ERROR/i.test(status.textContent)){
    status.textContent+=` · Selección individual aplicada: ${applied}`;
  }
}
export async function runSelectiveFallback(){
  const original=window.__batchAnalysis||[];
  if(!hasSelectiveRules(original)){
    const stable=await import('./batch-apply-fallback.js?v=20260821-canonical-capture1');
    return stable.runFallback();
  }
  const expected=selectedExpected(original);
  const prepared=prepareSelectiveAnalysis(original);
  if(prepared.applied!==expected)throw new Error(`Selección individual no verificada: esperado=${expected}, aplicado=${prepared.applied}.`);
  window.__batchAnalysis=prepared.analysis;
  try{
    const stable=await import('./batch-apply-fallback.js?v=20260821-canonical-capture1');
    const result=await stable.runFallback();
    for(let i=0;i<original.length;i++){
      const src=prepared.analysis[i],dst=original[i];
      if(!src||!dst)continue;
      for(const k of ['batchApplyExpectedText','batchApplyAppliedText','batchApplyUnresolvedText'])if(k in src)dst[k]=src[k];
      dst.batchApplySelectiveText=prepared.perFile.find(x=>x.name===dst.name)?.count||0;
    }
    patchUi(prepared.applied);
    return result;
  }finally{
    window.__batchAnalysis=original;
  }
}
