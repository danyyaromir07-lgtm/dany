// Preview status UI v1 — reads existing analysis/checkbox state only.
// It never opens, edits, saves or replaces PDF bytes.
const q=(s)=>document.querySelector(s);
const WATCHED_IDS=new Set(['batchRemoveComments','batchEnableOCR','batchRemoveRevisionClouds','batchRemoveSignatures','batchRemoveLinks']);
let queued=false;

function ensureStyles(){
  if(document.querySelector('link[data-preview-ui="1"]'))return;
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href='./ui-preview-v1.css?v=20260816-preview1';
  link.dataset.previewUi='1';
  document.head.appendChild(link);
}

function currentItem(){
  const batch=Array.isArray(window.__batchAnalysis)?window.__batchAnalysis:[];
  const name=String(window.__previewFileName||'');
  return batch.find((item)=>String(item?.name||'')===name)||null;
}

function ensureSummary(){
  let box=q('#previewOperationSummary');
  if(box)return box;
  const head=q('.preview-card-head'),preview=q('#batchPreview');
  if(!head||!preview||!head.parentElement)return null;
  box=document.createElement('div');
  box.id='previewOperationSummary';
  box.className='hidden';
  box.setAttribute('aria-live','polite');
  head.parentElement.insertBefore(box,preview);
  return box;
}

function chip(text,className=''){
  const el=document.createElement('span');
  el.className=`preview-op-chip${className?` ${className}`:''}`;
  el.textContent=text;
  return el;
}

function relevantOperations(item){
  const rules=Array.isArray(item?.counts)?item.counts:[];
  const hasPdfOrFreeText=rules.some((r)=>Number(r?.count||0)>0||Number(r?.annotationCount||0)>0);
  const hasVectorOCR=rules.some((r)=>Number(r?.ocrCount||0)>0||(Array.isArray(r?.ocrMatches)&&r.ocrMatches.length>0));
  const out=[];
  if(hasPdfOrFreeText)out.push('✏️ Texto');
  if(q('#batchEnableOCR')?.checked&&hasVectorOCR)out.push('🔎 Vector/OCR');
  if(q('#batchRemoveComments')?.checked&&(Number(item?.comments||0)>0||Number(item?.annotationCount||0)>0))out.push('🧹 Anotaciones');
  if(q('#batchRemoveRevisionClouds')?.checked&&Number(item?.revisionCloudCount||0)>0)out.push('☁️ Nubes');
  if(q('#batchRemoveSignatures')?.checked&&Number(item?.signatureCount||0)>0)out.push('✍️ Firmas');
  return out;
}

function renderSummary(){
  const box=ensureSummary(),preview=q('#batchPreview');
  if(!box||!preview||preview.classList.contains('hidden')||!window.__previewFileName){
    box?.classList.add('hidden');
    return;
  }
  const item=currentItem();
  if(!item){box.classList.add('hidden');return;}
  box.replaceChildren();
  const label=document.createElement('span');
  label.className='preview-op-label';
  label.textContent='Incluido en preview:';
  box.appendChild(label);
  const ops=relevantOperations(item);
  if(ops.length){for(const text of ops)box.appendChild(chip(text));}
  else{
    const empty=document.createElement('span');
    empty.className='preview-op-empty';
    empty.textContent='sin cambios detectados para este archivo';
    box.appendChild(empty);
  }
  if(q('#batchRemoveLinks')?.checked){
    const deferredLabel=document.createElement('span');
    deferredLabel.className='preview-op-label';
    deferredLabel.textContent='Solo al aplicar:';
    box.appendChild(deferredLabel);
    box.appendChild(chip('🔗 Enlaces','preview-op-deferred'));
  }
  box.classList.remove('hidden');
}

function normalizeButtons(){
  const original=q('#previewOriginalBtn'),result=q('#previewResultBtn');
  if(original&&original.textContent!=='Original')original.textContent='Original';
  if(result&&result.textContent!=='Resultado previsto')result.textContent='Resultado previsto';
}

function normalizeTitle(){
  const title=q('#batchPreviewTitle');
  if(!title||!window.__previewFileName)return;
  const current=String(title.textContent||'');
  const pageMatch=current.match(/página\s+(\d+)/i);
  const page=pageMatch?.[1]||'1';
  const next=`${window.__previewFileName} · Página ${page}`;
  if(current!==next)title.textContent=next;
}

function compactNote(){
  const note=q('.preview-note');
  if(!note||note.dataset.previewUiCompact==='1')return;
  note.dataset.previewUiCompact='1';
  const strong=document.createElement('strong');
  strong.textContent='ⓘ Vista de control.';
  const text=document.createElement('span');
  text.textContent='El PDF original permanece intacto hasta Aplicar cambios.';
  note.replaceChildren(strong,text);
}

function refresh(){
  queued=false;
  ensureStyles();
  ensureSummary();
  normalizeButtons();
  normalizeTitle();
  compactNote();
  renderSummary();
}

function scheduleRefresh(){
  if(queued)return;
  queued=true;
  queueMicrotask(refresh);
}

function wire(){
  ensureStyles();
  refresh();
  const card=q('.preview-card');
  if(card){
    const observer=new MutationObserver(scheduleRefresh);
    observer.observe(card,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  }
  document.addEventListener('change',(event)=>{
    if(WATCHED_IDS.has(event.target?.id))scheduleRefresh();
  });
  document.addEventListener('click',(event)=>{
    if(event.target?.closest?.('.bpreviewResult,#previewOriginalBtn,#previewResultBtn'))setTimeout(scheduleRefresh,0);
  });
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
window.__previewStatusUI={version:1,refresh};
