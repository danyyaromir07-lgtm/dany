import { prepareSelectiveAnalysis } from './text-occurrence-prepare-v1.js?v=20260821-selective1';

const q=s=>document.querySelector(s);
function active(){return q('#batchSelectTextOccurrences')?.checked===true}
function doneText(){return String(q('#batchStatus')?.textContent||'')}
async function handle(btn){
  const idx=Number(btn.dataset.idx);
  const original=window.__batchAnalysis||[],item=original[idx];
  if(!item||item.error)return;
  const one=prepareSelectiveAnalysis([item]);
  const temp=original.slice(); temp[idx]=one.analysis[0];
  const before=window.__batchAnalysis;
  window.__batchAnalysis=temp;
  let restored=false;
  const restore=()=>{if(restored)return;restored=true;window.__batchAnalysis=before;observer.disconnect();clearTimeout(timer)};
  const observer=new MutationObserver(()=>{
    const s=doneText();
    if(/Previsualización generada|No se pudo generar la previsualización/i.test(s))restore();
  });
  observer.observe(q('#batchStatus')||document.body,{childList:true,subtree:true,characterData:true});
  const timer=setTimeout(restore,30000);
  try{
    if(typeof btn.onclick==='function')btn.onclick({preventDefault(){},stopPropagation(){}});
    else restore();
  }catch(e){restore();throw e}
}
document.addEventListener('click',e=>{
  const btn=e.target?.closest?.('.bpreviewResult');
  if(!btn||!active())return;
  e.preventDefault();e.stopImmediatePropagation();
  handle(btn).catch(err=>{console.error(err);const s=q('#batchStatus');if(s)s.textContent='No se pudo generar la previsualización selectiva: '+(err?.message||String(err))});
},true);
