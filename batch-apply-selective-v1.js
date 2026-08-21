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
function onlyVerifiedSelectiveText(list){
  if(q('#batchRemoveRevisionClouds')?.checked===true||q('#batchForceRevisionClouds')?.checked===true)return false;
  if(q('#batchRemoveSignatures')?.checked===true||q('#batchRemoveLinks')?.checked===true)return false;
  for(const a of list||[]){
    if(a?.error||!a?.data)return false;
    for(const r of a.counts||[]){
      if(Number(r.annotationCount||0)>0||Number(r.ocrCount||0)>0)return false;
      if(Number(r.count||0)>0&&r?.selectiveText?.enabled!==true)return false;
    }
  }
  return true;
}
async function downloadPreparedZip(prepared,applied){
  const status=q('#batchStatus'),summary=q('#batchSummary');
  if(status)status.textContent='Generando ZIP selectivo…';
  const {default:JSZip}=await import('https://esm.sh/jszip@3.10.1');
  const zip=new JSZip();
  let files=0;
  for(const item of prepared.analysis||[]){
    if(item?.error||!item?.data)continue;
    zip.file(String(item.name||'resultado.pdf').replace(/[\\/]/g,'_'),item.data);
    files++;
  }
  if(!files)throw new Error('No hay PDFs selectivos verificados para descargar.');
  const blob=await zip.generateAsync({type:'blob',compression:'STORE',streamFiles:true});
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download='PDF_tools_procesados.zip';document.body.appendChild(link);link.click();
  setTimeout(()=>{link.remove();URL.revokeObjectURL(url)},3000);
  if(q('#statFiles'))q('#statFiles').textContent=String(files);
  if(q('#statEdits'))q('#statEdits').textContent=String(applied);
  if(q('#statZip'))q('#statZip').textContent='✓ Descargado';
  if(summary){summary.textContent=`${files} PDF${files===1?'':'s'} procesado${files===1?'':'s'} · ${applied} edición${applied===1?'':'es'} de texto por selección individual · ✓ todas las coincidencias seleccionadas verificadas · ZIP descargado`;summary.classList.remove('hidden')}
  if(status)status.textContent=`Aplicación selectiva terminada correctamente. ${applied} edición${applied===1?'':'es'} verificada${applied===1?'':'s'}.`;
  for(let i=0;i<(prepared.analysis||[]).length;i++){
    const src=prepared.analysis[i],dst=(window.__batchAnalysis||[])[i];
    if(!src||!dst)continue;
    dst.batchApplyExpectedText=0;dst.batchApplyAppliedText=0;dst.batchApplyUnresolvedText=0;
    dst.batchApplySelectiveText=prepared.perFile.find(x=>x.name===dst.name)?.count||0;
  }
  return{files,applied,fastPath:true};
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
  if(onlyVerifiedSelectiveText(original))return downloadPreparedZip(prepared,prepared.applied);
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
