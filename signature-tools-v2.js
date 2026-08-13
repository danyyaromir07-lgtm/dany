import { PDFDocument, PDFName } from 'https://esm.sh/pdf-lib@1.17.1';

const SIG = '#batchRemoveSignatures';
const COMMENTS = '#batchRemoveComments';
const LINKS = '#batchRemoveLinks';
const ANALYZE = '#batchAnalyze';
const APPLY = '#batchApply';
const SUMMARY = '#batchSummary';

const q=s=>document.querySelector(s);
const resolve=(doc,obj)=>{try{return doc.context.lookup(obj)||obj}catch(_){return obj}};
const type=(doc,ref,name)=>resolve(doc,ref)?.get?.(PDFName.of(name))?.toString?.().replace(/^\//,'')||'';
const subtype=(doc,ref)=>type(doc,ref,'Subtype');
function parent(doc,ref){return resolve(doc,ref)?.get?.(PDFName.of('Parent'))||null}
function isSignature(doc,ref){let cur=ref;for(let i=0;cur&&i<8;i++){if(type(doc,cur,'FT')==='Sig')return true;cur=parent(doc,cur)}return false}
function eq(a,b){return a===b||String(a?.objectNumber??'')===String(b?.objectNumber??'')&&String(a?.generationNumber??'')===String(b?.generationNumber??'')}
function rootField(doc,ref){let cur=ref;for(let i=0;i<8;i++){const p=parent(doc,cur);if(!p)return cur;cur=p}return cur}
function annArray(page){const a=page.node.get(PDFName.of('Annots'));return a?.size&&a?.get?a:null}
function preservedFreeText(doc,ref,rules){if(subtype(doc,ref)!=='FreeText')return false;const o=resolve(doc,ref),c=o?.get?.(PDFName.of('Contents'));let text='';try{text=c?.decodeText?.()||''}catch(_){text=String(c||'').replace(/^\(|\)$/g,'')}const s=text.replace(/\s+/g,' ').trim().toLowerCase();return rules.some(r=>{const n=String(r.find||'').replace(/\s+/g,' ').trim().toLowerCase();return n&&s.includes(n)})}

async function inspect(data){
  const doc=await PDFDocument.load(data,{updateMetadata:false,ignoreEncryption:false});
  let annotations=0,signatures=0,links=0;
  try{for(const page of doc.getPages()){const arr=annArray(page);if(!arr)continue;for(let i=0;i<arr.size();i++){const ref=arr.get(i),st=subtype(doc,ref);if(st==='Widget'){if(isSignature(doc,ref))signatures++;continue}if(st==='Link'){links++;continue}annotations++}}}
  finally{doc.flush?.()}
  return {annotations,signatures,links};
}

async function strip(data,rules,removeComments,removeSignatures,removeLinks){
  if(!removeComments&&!removeSignatures&&!removeLinks)return {bytes:new Uint8Array(data),annotations:0,signatures:0,links:0};
  const doc=await PDFDocument.load(data,{updateMetadata:false,ignoreEncryption:false});
  const sigRoots=[]; let removedAnnotations=0,removedSignatures=0,removedLinks=0;
  try{
    for(const page of doc.getPages()){
      const arr=annArray(page);if(!arr)continue;
      const keep=[];
      for(let i=0;i<arr.size();i++){
        const ref=arr.get(i),st=subtype(doc,ref),sig=st==='Widget'&&isSignature(doc,ref);
        if(sig){
          if(removeSignatures){removedSignatures++;sigRoots.push(rootField(doc,ref));}
          else keep.push(ref);
          continue;
        }
        if(st==='Widget'){keep.push(ref);continue}
        if(st==='Link'){
          if(removeLinks)removedLinks++;else keep.push(ref);
          continue;
        }
        if(!removeComments||preservedFreeText(doc,ref,rules)){keep.push(ref);continue}
        removedAnnotations++;
      }
      if(keep.length)page.node.set(PDFName.of('Annots'),doc.context.obj(keep));else page.node.delete(PDFName.of('Annots'));
    }
    if(removedSignatures){
      const acro=resolve(doc,doc.catalog.get(PDFName.of('AcroForm'))),fields=resolve(doc,acro?.get?.(PDFName.of('Fields')));
      if(fields?.size&&fields?.get){const keep=[];for(let i=0;i<fields.size();i++){const ref=fields.get(i);if(sigRoots.some(r=>eq(r,ref)))continue;keep.push(ref)}if(keep.length)acro.set(PDFName.of('Fields'),doc.context.obj(keep));else acro.delete(PDFName.of('Fields'))}
    }
    const changed=removedAnnotations||removedSignatures||removedLinks;
    const bytes=changed?await doc.save({useObjectStreams:true,addDefaultPage:false}):new Uint8Array(data);
    return {bytes,annotations:removedAnnotations,signatures:removedSignatures,links:removedLinks};
  }finally{doc.flush?.()}
}

function inject(){
  if(q(SIG))return;
  const host=q(COMMENTS)?.closest('.option-box');if(!host)return;
  const boxSig=document.createElement('div');boxSig.className='option-box';boxSig.style.marginTop='10px';boxSig.innerHTML='<label><input id="batchRemoveSignatures" type="checkbox"><span>✍️ Eliminar firmas digitales</span></label><small>Detecta las firmas antes de aplicar. Solo se eliminan al marcar esta opción. El PDF resultante quedará modificado y la firma digital dejará de ser válida.</small>';
  host.parentElement?.insertBefore(boxSig,host.nextElementSibling);
  const boxLinks=document.createElement('div');boxLinks.className='option-box';boxLinks.style.marginTop='10px';boxLinks.innerHTML='<label><input id="batchRemoveLinks" type="checkbox"><span>🔗 Eliminar enlaces del PDF</span></label><small>Los enlaces son elementos funcionales de navegación y se conservan por defecto. Activa esta opción solo cuando quieras eliminarlos deliberadamente.</small>';
  host.parentElement?.insertBefore(boxLinks,boxSig.nextElementSibling);
}

function updateView(){
  const batch=window.__batchAnalysis||[],rows=[...document.querySelectorAll('.batch-result')];
  let totalAnn=0,totalSig=0,totalLinks=0;
  batch.forEach((a,i)=>{if(a?.error)return;totalAnn+=a.annotationCount||0;totalSig+=a.signatureCount||0;totalLinks+=a.linkCount||0;const span=rows[i]?.querySelector(':scope > span');if(!span)return;if((a.annotationCount||0)&&!span.textContent.includes('📎'))span.append(document.createTextNode(` · 📎 ${a.annotationCount} anotación${a.annotationCount===1?'':'es'}`));if((a.signatureCount||0)&&!span.textContent.includes('✍️'))span.append(document.createTextNode(` · ✍️ ${a.signatureCount} firma${a.signatureCount===1?'':'s'}`));if((a.linkCount||0)&&!span.textContent.includes('🔗'))span.append(document.createTextNode(` · 🔗 ${a.linkCount} enlace${a.linkCount===1?'':'s'}`));});
  const s=q(SUMMARY);if(s){let t=s.textContent.replace(/ · 📎 \d+ anotaciones?/,'').replace(/ · ✍️ \d+ firmas?/,'').replace(/ · 🔗 \d+ enlaces?/,'');if(totalAnn)t+=` · 📎 ${totalAnn} anotación${totalAnn===1?'':'es'} detectada${totalAnn===1?'':'s'}`;if(totalSig)t+=` · ✍️ ${totalSig} firma${totalSig===1?'':'s'} detectada${totalSig===1?'':'s'}`;if(totalLinks)t+=` · 🔗 ${totalLinks} enlace${totalLinks===1?'':'s'} detectado${totalLinks===1?'':'s'}`;s.textContent=t;s.classList.remove('hidden')}
  const b=q(APPLY);if(b)b.disabled=!batch.some(a=>!a?.error&&(a.comments>0||a.annotationCount>0||a.signatureCount>0||a.linkCount>0||a.counts?.some(c=>c.count||c.annotationCount||c.ocrCount)));
}

async function afterAnalysis(){
  const start=Date.now();
  while(Date.now()-start<30000){const b=window.__batchAnalysis,s=q(SUMMARY);if(Array.isArray(b)&&b.length&&s&&!s.classList.contains('hidden'))break;await new Promise(r=>setTimeout(r,120))}
  const batch=window.__batchAnalysis||[];if(!batch.length)return;
  for(const a of batch){if(a?.error||!a.data)continue;try{const r=await inspect(a.data);a.annotationCount=r.annotations;a.signatureCount=r.signatures;a.linkCount=r.links;a.comments=Math.max(Number(a.comments||0),r.annotations)}catch(e){a.annotationCount=0;a.signatureCount=0;a.linkCount=0;a.signatureError=e?.message||String(e)}}
  updateView();
}

async function prepareApply(){
  const removeComments=!!q(COMMENTS)?.checked,removeSignatures=!!q(SIG)?.checked,removeLinks=!!q(LINKS)?.checked;if(!removeComments&&!removeSignatures&&!removeLinks)return;
  const batch=window.__batchAnalysis||[];
  for(const a of batch){if(a?.error||!a.data)continue;const rules=(a.counts||[]).filter(r=>String(r.find||'').trim()&&String(r.replace??'')!=='');const r=await strip(a.data,rules,removeComments,removeSignatures,removeLinks);a.data=r.bytes;a.annotationCount=Math.max(0,(a.annotationCount||0)-r.annotations);a.signatureCount=Math.max(0,(a.signatureCount||0)-r.signatures);a.linkCount=Math.max(0,(a.linkCount||0)-r.links);a.comments=Math.max(0,(a.comments||0)-r.annotations)}
}

async function runApplyAfterPrepare(){
  if(typeof window.__runBatchFallback==='function')return window.__runBatchFallback();
  const mod=await import('./batch-apply-fallback.js?v=20260813-signatures2');return mod.runFallback();
}

function wire(){
  inject();
  q(ANALYZE)?.addEventListener('click',()=>{afterAnalysis().catch(e=>console.error('[annotations]',e))});
  q(APPLY)?.addEventListener('click',async e=>{
    const rc=q(COMMENTS)?.checked,rs=q(SIG)?.checked,rl=q(LINKS)?.checked;if(!rc&&!rs&&!rl)return;
    e.preventDefault();e.stopImmediatePropagation();
    try{const s=q('#batchStatus');if(s)s.textContent=rs&&rl?'Eliminando firmas, anotaciones y enlaces…':rs?'Eliminando firmas y anotaciones…':rl?'Eliminando anotaciones y enlaces…':'Eliminando anotaciones…';await prepareApply();await runApplyAfterPrepare()}catch(err){const s=q('#batchStatus');if(s)s.textContent='ERROR AL LIMPIAR ANOTACIONES: '+(err?.message||String(err));console.error(err)}
  },true);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
