import * as mupdf from 'https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js';
import { PDFDocument, PDFName } from 'https://esm.sh/pdf-lib@1.17.1';
import { editFreeTextDetailed } from './adaptive-engine-v1.js?v=20260812-309';
import { editDoc } from './text-editor-v64.js';
import { applyVectorOCR } from './vector-apply-v2.js?v=20260812-307';

const q=s=>document.querySelector(s);
let resultUrl='', originalUrl='', currentMode='result', currentIndex=-1, currentPage=1;
const removableTypes=new Set(['Text','FreeText','Line','Square','Circle','Polygon','PolyLine','Highlight','Underline','Squiggly','StrikeOut','Stamp','Caret','Ink','Popup','FileAttachment']);
const resolve=(doc,obj)=>{try{return doc.context.lookup(obj)||obj}catch(_){return obj}};
const subtype=(doc,ref)=>resolve(doc,ref)?.get?.(PDFName.of('Subtype'))?.toString?.().replace(/^\//,'')||'';
const annContents=(doc,ref)=>{const o=resolve(doc,ref),c=o?.get?.(PDFName.of('Contents'));try{return c?.decodeText?.()||''}catch(_){return String(c||'').replace(/^\(|\)$/g,'')}};
const preservedFreeText=(doc,ref,rules)=>{if(subtype(doc,ref)!=='FreeText')return false;const s=annContents(doc,ref).replace(/\s+/g,' ').trim().toLowerCase();return rules.some(r=>{const n=String(r.find||'').replace(/\s+/g,' ').trim().toLowerCase();return n&&s.includes(n)})};
function sigParent(doc,ref){return resolve(doc,ref)?.get?.(PDFName.of('Parent'))||null}
function isSignature(doc,ref){let cur=ref;for(let i=0;cur&&i<8;i++){if(resolve(doc,cur)?.get?.(PDFName.of('FT'))?.toString?.().replace(/^\//,'')==='Sig')return true;cur=sigParent(doc,cur)}return false}
function rootField(doc,ref){let cur=ref;for(let i=0;i<8;i++){const p=sigParent(doc,cur);if(!p)return cur;cur=p}return cur}
function sameRef(a,b){return String(a?.objectNumber??'')===String(b?.objectNumber??'')&&String(a?.generationNumber??'')===String(b?.generationNumber??'')}
async function cleanSelectedAnnotations(data,rules,{removeComments=true,removeSignatures=false}={}){
  if(!removeComments&&!removeSignatures)return new Uint8Array(data);
  const doc=await PDFDocument.load(data,{updateMetadata:false,ignoreEncryption:false});
  const sigRoots=[];let changed=false;
  for(const page of doc.getPages()){
    const annRef=page.node.get(PDFName.of('Annots')),annots=resolve(doc,annRef);if(!annots?.size?.())continue;const keep=[];
    for(let i=0;i<annots.size();i++){
      const ref=annots.get(i),st=subtype(doc,ref),sig=st==='Widget'&&isSignature(doc,ref);
      if(sig){if(removeSignatures){sigRoots.push(rootField(doc,ref));changed=true}else keep.push(ref);continue}
      if(st==='Widget'||!removeComments||!removableTypes.has(st)||preservedFreeText(doc,ref,rules)){keep.push(ref);continue}
      changed=true;
    }
    if(keep.length)page.node.set(PDFName.of('Annots'),doc.context.obj(keep));else page.node.delete(PDFName.of('Annots'));
  }
  if(removeSignatures&&sigRoots.length){const acro=resolve(doc,doc.catalog.get(PDFName.of('AcroForm'))),fields=resolve(doc,acro?.get?.(PDFName.of('Fields')));if(fields?.size?.()){const keep=[];for(let i=0;i<fields.size();i++){const ref=fields.get(i);if(sigRoots.some(r=>sameRef(rootField(doc,ref),r)))continue;keep.push(ref)}if(keep.length)acro.set(PDFName.of('Fields'),doc.context.obj(keep));else acro.delete(PDFName.of('Fields'))}}
  return changed||sigRoots.length?await doc.save({useObjectStreams:true,addDefaultPage:false}):new Uint8Array(data);
}
function pageFor(a){let p=1;for(const c of a?.counts||[]){if(c?.pages?.length){p=c.pages[0];break}if(c?.annotationPages?.length){p=c.annotationPages[0];break}if(c?.ocrMatches?.length){p=c.ocrMatches[0]?.page||1;break}}return Math.max(1,p)}
function applyTextAndVector(doc,a){let textEdits=0,vectorEdits=0;for(const r of a.counts||[]){const expected=Math.max(0,Number(r.count||0));if(expected>0){let guard=0;while(guard<expected){const n=editDoc(doc,r.find,r.replace);if(!n)break;textEdits+=n;guard++}}const ft=editFreeTextDetailed(doc,r.find,r.replace)||{};textEdits+=Number(ft.count||0)}const result=applyVectorOCR(doc,a)||{};vectorEdits=Number(result.count||0);return{textEdits,vectorEdits,skipped:result.skipped||[]}}
function pixUrl(doc,pageNo){const page=doc.loadPage(pageNo-1),pix=page.toPixmap(mupdf.Matrix.scale(1.5,1.5),mupdf.ColorSpace.DeviceRGB,false,true),png=pix.asPNG();return URL.createObjectURL(new Blob([png],{type:'image/png'}))}
function addUi(){const host=q('.preview-card-head .preview-controls');if(!host||q('#previewOriginalBtn'))return;const wrap=document.createElement('span');wrap.style.display='inline-flex';wrap.style.gap='6px';wrap.style.marginRight='8px';wrap.innerHTML='<button id="previewOriginalBtn" class="secondary small" type="button">Original</button><button id="previewResultBtn" class="primary small" type="button">🔮 Resultado</button>';host.prepend(wrap);q('#previewOriginalBtn').onclick=()=>showMode('original');q('#previewResultBtn').onclick=()=>showMode('result');}
function showMode(mode){currentMode=mode;const img=q('#batchPreviewImg');if(!img)return;img.src=mode==='result'?resultUrl:originalUrl;q('#previewOriginalBtn')?.classList.toggle('primary',mode==='original');q('#previewOriginalBtn')?.classList.toggle('secondary',mode!=='original');q('#previewResultBtn')?.classList.toggle('primary',mode==='result');q('#previewResultBtn')?.classList.toggle('secondary',mode!=='result');const t=q('#batchPreviewTitle');if(t)t.textContent=`${window.__previewFileName||'PDF'} · página ${currentPage} · ${mode==='result'?'resultado previsto':'original'}`;}
async function makePreview(idx){const batch=window.__batchAnalysis||[],a=batch[idx];if(!a||a.error)return;currentIndex=idx;currentPage=pageFor(a);window.__previewFileName=a.name;const msg=q('#batchStatus');if(msg)msg.textContent='Generando previsualización…';addUi();try{if(originalUrl)URL.revokeObjectURL(originalUrl);if(resultUrl)URL.revokeObjectURL(resultUrl);const source=new Uint8Array(a.data);const originalDoc=mupdf.PDFDocument.openDocument(new Uint8Array(source),'application/pdf');originalUrl=pixUrl(originalDoc,currentPage);originalDoc.destroy();
  let work=source.slice();
  const rules=(a.counts||[]).filter(r=>String(r.find||'').trim()&&String(r.replace??'')!=='');
  const removeComments=q('#batchRemoveComments')?.checked!==false;
  const removeSignatures=q('#batchRemoveSignatures')?.checked===true;
  work=await cleanSelectedAnnotations(work,rules,{removeComments,removeSignatures});
  const resultDoc=mupdf.PDFDocument.openDocument(new Uint8Array(work),'application/pdf');
  const applied=applyTextAndVector(resultDoc,a);
  const out=resultDoc.saveToBuffer('garbage=4,compress=yes,appearance=yes').asUint8Array();
  resultUrl=URL.createObjectURL(new Blob([out],{type:'image/png'}));
  // The previous URL intentionally stores PDF bytes only temporarily; render it below before replacing with the final PNG URL.
  resultUrl=URL.revokeObjectURL(resultUrl)||null;
  const rendered=mupdf.PDFDocument.openDocument(new Uint8Array(out),'application/pdf');
  resultUrl=pixUrl(rendered,currentPage);rendered.destroy();resultDoc.destroy();
  q('#batchPreview')?.classList.remove('hidden');setModeTitle(applied);showMode('result');q('#batchPreview')?.scrollIntoView({behavior:'smooth',block:'center'});
  if(msg)msg.textContent=applied.skipped.length?'Previsualización generada con avisos. Revisa el resultado antes de aplicar.':'Previsualización generada. El PDF original no se ha modificado.';
}catch(e){console.error(e);if(msg)msg.textContent='No se pudo generar la previsualización: '+(e?.message||String(e));}}
function setModeTitle(applied){const t=q('#batchPreviewTitle');if(t)t.textContent=`${window.__previewFileName||'PDF'} · página ${currentPage} · resultado previsto · ${applied.textEdits||0} cambios de texto · ${applied.vectorEdits||0} vector/OCR`}
function ensureButtons(){addUi();document.querySelectorAll('.bpreview').forEach(b=>{if(b.dataset.previewBound)return;b.dataset.previewBound='1';const idx=b.dataset.idx;const x=document.createElement('button');x.type='button';x.className='secondary small bpreviewResult';x.dataset.idx=idx;x.textContent='🔮 Previsualizar cambios';x.style.marginLeft='6px';x.onclick=e=>{e.preventDefault();e.stopPropagation();makePreview(Number(idx))};b.parentElement?.appendChild(x)})}
const tableObserver=new MutationObserver(ensureButtons);tableObserver.observe(q('#batchTable')||document.body,{childList:true,subtree:true});
addUi();ensureButtons();
