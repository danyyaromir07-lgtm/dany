import { PDFDocument, PDFName } from 'https://esm.sh/pdf-lib@1.17.1';

const SELECTOR = '#batchRemoveSignatures';
const ANALYZE = '#batchAnalyze';
const APPLY = '#batchApply';
const TABLE = '#batchTable';
const SUMMARY = '#batchSummary';

function q(s){ return document.querySelector(s); }
function say(t){ const el=q('#batchStatus'); if(el) el.textContent=t; }
function resolve(doc,obj){ try{return doc.context.lookup(obj)||obj}catch(_){return obj} }
function subtype(doc,ref){ const o=resolve(doc,ref); return o?.get?.(PDFName.of('Subtype'))?.toString?.().replace(/^\//,'')||''; }
function fieldType(doc,ref){ const o=resolve(doc,ref); return o?.get?.(PDFName.of('FT'))?.toString?.().replace(/^\//,'')||''; }
function parentRef(doc,ref){ const o=resolve(doc,ref); return o?.get?.(PDFName.of('Parent'))||null; }
function isSignatureField(doc,ref){
  let cur=ref;
  for(let depth=0;cur&&depth<8;depth++){
    if(fieldType(doc,cur)==='Sig') return true;
    cur=parentRef(doc,cur);
  }
  return false;
}
function objectRefEquals(a,b){ return String(a?.objectNumber??'')===String(b?.objectNumber??'') && String(a?.generationNumber??'')===String(b?.generationNumber??''); }
function removeRefArray(arr,ref,doc){
  const keep=[]; let removed=false;
  for(let i=0;i<arr.size();i++){
    const r=arr.get(i);
    if(objectRefEquals(r,ref)){removed=true;continue}
    keep.push(r);
  }
  return {removed,keep};
}

async function inspectSignatureCount(data){
  const doc=await PDFDocument.load(data,{updateMetadata:false,ignoreEncryption:false});
  let count=0;
  try{
    for(const page of doc.getPages()){
      const refs=page.node.get(PDFName.of('Annots'));
      const arr=refs?.size&&refs?.get?refs:null;
      if(!arr) continue;
      for(let i=0;i<arr.size();i++){
        const ref=arr.get(i);
        if(subtype(doc,ref)==='Widget' && isSignatureField(doc,ref)) count++;
      }
    }
  }finally{doc.flush?.()}
  return count;
}

async function removeSignatures(data){
  const doc=await PDFDocument.load(data,{updateMetadata:false,ignoreEncryption:false});
  const signatureRoots=[];
  let removedWidgets=0;
  try{
    for(const page of doc.getPages()){
      const refs=page.node.get(PDFName.of('Annots'));
      const arr=refs?.size&&refs?.get?refs:null;
      if(!arr) continue;
      const keep=[];
      for(let i=0;i<arr.size();i++){
        const ref=arr.get(i);
        if(subtype(doc,ref)!=='Widget' || !isSignatureField(doc,ref)){ keep.push(ref); continue; }
        removedWidgets++;
        let root=ref;
        for(let depth=0;depth<8;depth++){
          const p=parentRef(doc,root); if(!p) break; root=p;
        }
        if(!signatureRoots.some(x=>objectRefEquals(x,root))) signatureRoots.push(root);
      }
      if(keep.length) page.node.set(PDFName.of('Annots'),doc.context.obj(keep));
      else page.node.delete(PDFName.of('Annots'));
    }

    // Remove the corresponding signature field(s) from the AcroForm field tree.
    const acroRef=doc.catalog.get(PDFName.of('AcroForm'));
    const acro=resolve(doc,acroRef);
    const fieldsRef=acro?.get?.(PDFName.of('Fields'));
    const fields=resolve(doc,fieldsRef);
    if(fields?.size&&fields?.get){
      const keep=[];
      for(let i=0;i<fields.size();i++){
        const ref=fields.get(i);
        if(signatureRoots.some(x=>objectRefEquals(x,ref))) continue;
        keep.push(ref);
      }
      if(keep.length) acro.set(PDFName.of('Fields'),doc.context.obj(keep));
      else acro.delete(PDFName.of('Fields'));
    }

    const bytes=removedWidgets?doc.save({useObjectStreams:true,addDefaultPage:false}):new Uint8Array(data);
    return {bytes,count:removedWidgets};
  }finally{doc.flush?.()}
}

function injectUI(){
  if(q(SELECTOR)) return q(SELECTOR);
  const comments=q('#batchRemoveComments')?.closest('.option-box');
  if(!comments) return null;
  const box=document.createElement('div');
  box.className='option-box'; box.style.marginTop='10px';
  box.innerHTML='<label><input id="batchRemoveSignatures" type="checkbox"><span>✍️ Eliminar firmas digitales</span></label><small>Primero se detectan. Solo se eliminan al marcar esta opción. Al borrar una firma digital, el PDF modificado deja de conservar la validez criptográfica de esa firma.</small>';
  comments.parentElement?.insertBefore(box,comments.nextElementSibling);
  return box.querySelector(SELECTOR);
}

function updateRows(){
  const batch=window.__batchAnalysis||[];
  const rows=[...document.querySelectorAll('.batch-result')];
  batch.forEach((a,i)=>{
    const row=rows[i]; if(!row||a.error) return;
    const span=row.querySelector(':scope > span'); if(!span) return;
    const sig=a.signatureCount||0;
    const label=sig?` · ✍️ ${sig} firma${sig===1?'':'s'}`:'';
    if(label && !span.textContent.includes('✍️')) span.append(document.createTextNode(label));
  });
  const total=batch.reduce((n,a)=>n+(a.signatureCount||0),0);
  const summary=q(SUMMARY);
  if(summary && total){
    const base=summary.textContent.replace(/ · ✍️ \d+ firmas?/,'');
    summary.textContent=base+` · ✍️ ${total} firma${total===1?'':'s'} detectada${total===1?'':'s'}`;
  }
  const apply=q(APPLY);
  if(apply) apply.disabled=!batch.some(a=>!a.error&&(a.counts?.some(c=>c.count||c.annotationCount||c.ocrCount)||a.comments>0||a.signatureCount>0));
}

async function annotateAfterAnalysis(){
  const started=Date.now();
  while(Date.now()-started<30000){
    const summary=q(SUMMARY);
    const batch=window.__batchAnalysis;
    if(Array.isArray(batch)&&batch.length && summary && !summary.classList.contains('hidden') && /PDF/.test(summary.textContent||'')) break;
    await new Promise(r=>setTimeout(r,120));
  }
  const batch=window.__batchAnalysis||[];
  if(!batch.length) return;
  for(const item of batch){
    if(item?.error||!item.data) continue;
    try{ item.signatureCount=await inspectSignatureCount(item.data); }
    catch(e){ item.signatureCount=0; item.signatureError=e?.message||String(e); }
  }
  updateRows();
}

async function beforeApply(){
  const cb=q(SELECTOR);
  if(!cb?.checked) return false;
  const batch=window.__batchAnalysis||[];
  for(const item of batch){
    if(item?.error||!item.data||!(item.signatureCount>0)) continue;
    const r=await removeSignatures(item.data);
    item.data=r.bytes;
    item.signatureCount=Math.max(0,(item.signatureCount||0)-r.count);
  }
  return true;
}

function wire(){
  injectUI();
  q(ANALYZE)?.addEventListener('click',()=>{ annotateAfterAnalysis().catch(e=>console.error('[signature]',e)); });
  const apply=q(APPLY);
  apply?.addEventListener('click',async e=>{
    const cb=q(SELECTOR); if(!cb?.checked) return;
    e.preventDefault(); e.stopImmediatePropagation();
    try{
      say('Eliminando firmas…');
      await beforeApply();
      if(typeof window.__runBatchFallback==='function') await window.__runBatchFallback();
      else {
        const mod=await import('./batch-apply-fallback.js?v=20260813-signatures1');
        await mod.runFallback();
      }
    }catch(err){ say('ERROR AL ELIMINAR FIRMAS: '+(err?.message||String(err))); console.error(err); }
  },true);
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',wire); else wire();
