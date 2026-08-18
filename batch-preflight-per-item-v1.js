// Per-PDF Apply preflight. This module changes only orchestration: the same
// annotation rules and exact revision-cloud remover are executed immediately
// before the corresponding PDF enters the existing Apply engine.
// It never analyzes a second PDF while the current PDF is waiting for Apply.
const COMMENTS='#batchRemoveComments',SIG='#batchRemoveSignatures',LINKS='#batchRemoveLinks',CLOUDS='#batchRemoveRevisionClouds',MANUAL_CLOUDS='#batchForceRevisionClouds';
const REMOVABLE=new Set(['Text','FreeText','Line','Square','Circle','Polygon','PolyLine','Highlight','Underline','Squiggly','StrikeOut','Stamp','Caret','Ink','Popup','FileAttachment']);
const BREADCRUMB_KEY='pdfTools.apply.preflight.breadcrumb.v1';
const q=s=>document.querySelector(s);
const yieldUI=()=>new Promise(resolve=>setTimeout(resolve,0));
const byteLength=data=>Number(data?.byteLength??data?.length??0);
let pdfLibPromise=null,cloudRemoverPromise=null;

function perf(event){try{window.__performanceDiagnostic?.({scope:'apply',...event});}catch(_){}}
function breadcrumb(stage,extra={}){
  try{localStorage.setItem(BREADCRUMB_KEY,JSON.stringify({state:'running',stage,time:Date.now(),...extra}));}catch(_){}
}
function restoreBreadcrumb(){
  let saved=null;try{saved=JSON.parse(localStorage.getItem(BREADCRUMB_KEY)||'null');}catch(_){}
  if(!saved||saved.state==='completed'||!saved.stage)return;
  const age=Date.now()-Number(saved.time||0);if(!Number.isFinite(age)||age>86400000)return;
  let tries=0;const timer=setInterval(()=>{
    if(typeof window.__performanceDiagnostic==='function'){
      clearInterval(timer);
      try{window.__performanceDiagnostic({stage:'apply.preflight.previous',detail:`Último Apply interrumpido: ${saved.stage}`,file:saved.file||'',index:saved.index,total:saved.total,warning:'breadcrumb recuperado tras recarga/cierre'});}catch(_){}
    }else if(++tries>200)clearInterval(timer);
  },50);
}
restoreBreadcrumb();

async function loadPdfLib(){if(!pdfLibPromise)pdfLibPromise=import('https://esm.sh/pdf-lib@1.17.1');return pdfLibPromise;}
async function loadCloudRemover(){if(!cloudRemoverPromise)cloudRemoverPromise=import('./revision-cloud-manual-force-v2.js?v=20260818-curvedgray2');return cloudRemoverPromise;}

function resolve(doc,obj){try{return doc.context.lookup(obj)||obj;}catch(_){return obj;}}
function subtype(doc,ref,PDFName){const obj=resolve(doc,ref),value=obj?.get?.(PDFName.of('Subtype'));return value?.toString?.().replace(/^\//,'')||'';}
function parent(doc,ref,PDFName){return resolve(doc,ref)?.get?.(PDFName.of('Parent'))||null;}
function isSignature(doc,ref,PDFName){let cur=ref;for(let i=0;i<8&&cur;i++){const ft=resolve(doc,cur)?.get?.(PDFName.of('FT'))?.toString?.().replace(/^\//,'')||'';if(ft==='Sig')return true;cur=parent(doc,cur,PDFName);}return false;}
function rootField(doc,ref,PDFName){let cur=ref;for(let i=0;i<8;i++){const p=parent(doc,cur,PDFName);if(!p)return cur;cur=p;}return cur;}
function sameRef(a,b){return String(a?.objectNumber??'')===String(b?.objectNumber??'')&&String(a?.generationNumber??'')===String(b?.generationNumber??'');}
function annotationArray(page,PDFName){const a=page.node.get(PDFName.of('Annots'));return a?.size&&a?.get?a:null;}
function annotationContents(doc,ref,PDFName){const obj=resolve(doc,ref),c=obj?.get?.(PDFName.of('Contents'));try{return c?.decodeText?.()||'';}catch(_){return String(c||'').replace(/^\(|\)$/g,'');}}
function preservedFreeText(doc,ref,rules,PDFName){if(subtype(doc,ref,PDFName)!=='FreeText')return false;const text=annotationContents(doc,ref,PDFName).replace(/\s+/g,' ').trim().toLowerCase();return rules.some(r=>{const needle=String(r.find||'').replace(/\s+/g,' ').trim().toLowerCase();return needle&&text.includes(needle);});}

async function prepareAnnotations(item,index,total){
  const removeComments=!!q(COMMENTS)?.checked,removeSignatures=!!q(SIG)?.checked,removeLinks=!!q(LINKS)?.checked;
  if(!removeComments&&!removeSignatures&&!removeLinks)return;
  const rules=(item.counts||[]).filter(r=>String(r.find||'').trim()&&String(r.replace??'')!=='');
  const file=String(item.name||'');
  const outerKey=`preflight-annotations::${index}::${file}`;
  perf({action:'start',stage:'preflight anotaciones del PDF',key:outerKey,file,index,total,sizeBytes:byteLength(item.data)});
  breadcrumb('preflight anotaciones: cargar PDF',{file,index,total});
  await yieldUI();
  const {PDFDocument,PDFName}=await loadPdfLib();
  let doc=null;
  const loadKey=`preflight-annotations-load::${index}::${file}`;
  perf({action:'start',stage:'preflight anotaciones: cargar PDF',key:loadKey,file,index,total,sizeBytes:byteLength(item.data)});
  try{
    doc=await PDFDocument.load(item.data,{updateMetadata:false,ignoreEncryption:false});
    perf({action:'end',stage:'preflight anotaciones: cargar PDF',key:loadKey,file,index,total,sizeBytes:byteLength(item.data)});
  }catch(error){
    perf({action:'end',stage:'preflight anotaciones: cargar PDF',key:loadKey,file,index,total,sizeBytes:byteLength(item.data),warning:error?.message||String(error)});
    throw error;
  }
  let changed=false;
  try{
    const signatureRoots=[];
    for(const page of doc.getPages()){
      const annots=annotationArray(page,PDFName);if(!annots)continue;
      const keep=[];
      for(let i=0;i<annots.size();i++){
        const ref=annots.get(i),st=subtype(doc,ref,PDFName);
        if(st==='Widget'){
          if(removeSignatures&&isSignature(doc,ref,PDFName)){signatureRoots.push(rootField(doc,ref,PDFName));changed=true;}else keep.push(ref);
          continue;
        }
        if(st==='Link'){if(removeLinks)changed=true;else keep.push(ref);continue;}
        if(removeComments&&REMOVABLE.has(st)&&!preservedFreeText(doc,ref,rules,PDFName))changed=true;else keep.push(ref);
      }
      if(keep.length)page.node.set(PDFName.of('Annots'),doc.context.obj(keep));else page.node.delete(PDFName.of('Annots'));
    }
    if(removeSignatures&&signatureRoots.length){
      const acro=resolve(doc,doc.catalog.get(PDFName.of('AcroForm'))),fields=resolve(doc,acro?.get?.(PDFName.of('Fields')));
      if(fields?.size&&fields?.get){
        const keep=[];for(let i=0;i<fields.size();i++){const ref=fields.get(i);if(signatureRoots.some(root=>sameRef(rootField(doc,ref,PDFName),root)))continue;keep.push(ref);}
        if(keep.length)acro.set(PDFName.of('Fields'),doc.context.obj(keep));else acro.delete(PDFName.of('Fields'));
      }
    }
    if(changed){
      breadcrumb('preflight anotaciones: guardar PDF',{file,index,total});
      const saveKey=`preflight-annotations-save::${index}::${file}`;
      perf({action:'start',stage:'preflight anotaciones: guardar PDF',key:saveKey,file,index,total,sizeBytes:byteLength(item.data)});
      await yieldUI();
      try{
        const output=await doc.save({useObjectStreams:true,addDefaultPage:false});
        item.data=output;
        perf({action:'end',stage:'preflight anotaciones: guardar PDF',key:saveKey,file,index,total,sizeBytes:byteLength(item.data),outputBytes:byteLength(output)});
      }catch(error){
        perf({action:'end',stage:'preflight anotaciones: guardar PDF',key:saveKey,file,index,total,sizeBytes:byteLength(item.data),warning:error?.message||String(error)});
        throw error;
      }
    }
  }finally{
    doc=null;
  }
  perf({action:'end',stage:'preflight anotaciones del PDF',key:outerKey,file,index,total,sizeBytes:byteLength(item.data),outputBytes:byteLength(item.data),warning:changed?'':'sin cambios: buffer original conservado'});
  await yieldUI();
}

function recordCloudFailure(item,message,removed=0){
  const prev=window.__revisionCloudStreamApplyDebug||{removed:0,failures:[],version:'5+manual2+zeroexact1+singleexact1+coloroptional1+curvedgray2'};
  const failures=Array.isArray(prev.failures)?prev.failures.slice():[];failures.push(`${item.name}: ${message}`);
  window.__revisionCloudStreamApplyDebug={removed:Number(prev.removed||0)+Number(removed||0),failures,version:'5+manual2+zeroexact1+singleexact1+coloroptional1+curvedgray2+peritem1'};
  window.__revisionCloudFailureToleranceDebug={version:1,removed:Number(window.__revisionCloudStreamApplyDebug.removed||0),skippedFiles:failures.length,failures};
  try{window.__cloudDiagnostic?.({stage:'cloud.apply.partial',detail:`continuar lote · archivo inseguro conservado=1`,file:item.name,reason:message});}catch(_){}
}
async function prepareClouds(item,index,total){
  if(!q(CLOUDS)?.checked)return;
  if(index===1)window.__revisionCloudStreamApplyDebug={removed:0,failures:[],version:'5+manual2+zeroexact1+singleexact1+coloroptional1+curvedgray2+peritem1'};
  const manual=q(MANUAL_CLOUDS)?.checked===true,detected=Array.isArray(item.revisionClouds)?item.revisionClouds:[];
  if(!detected.length&&!manual)return;
  const file=String(item.name||''),before=item.data,key=`preflight-cloud::${index}::${file}`;
  perf({action:'start',stage:'preflight nubes del PDF',key,file,index,total,sizeBytes:byteLength(before)});
  breadcrumb('preflight nubes: eliminación exacta',{file,index,total});
  await yieldUI();
  try{
    const mod=await loadCloudRemover(),remove=mod.removeDetectedRevisionCloudsByExactFamily;
    if(typeof remove!=='function')throw new Error('No se pudo cargar el eliminador exacto de nubes.');
    const result=await remove(item.data,detected,{context:'apply',file:item.name});
    item.revisionCloudStreamDetails=Array.isArray(result?.details)?result.details:[];
    const removed=Math.max(0,Number(result?.removed||0));
    if(removed>0){
      item.data=result.data;item.revisionCloudApplied=removed;
      const prev=window.__revisionCloudStreamApplyDebug||{removed:0,failures:[]};
      window.__revisionCloudStreamApplyDebug={removed:Number(prev.removed||0)+removed,failures:Array.isArray(prev.failures)?prev.failures:[],version:'5+manual2+zeroexact1+singleexact1+coloroptional1+curvedgray2+peritem1'};
      perf({action:'end',stage:'preflight nubes del PDF',key,file,index,total,sizeBytes:byteLength(before),outputBytes:byteLength(item.data),removed});
    }else{
      const reason=item.revisionCloudStreamDetails.map(x=>x?.reason||'sin eliminación segura').join(', ')||'sin eliminación segura';
      recordCloudFailure(item,reason,0);
      perf({action:'end',stage:'preflight nubes del PDF',key,file,index,total,sizeBytes:byteLength(before),outputBytes:byteLength(item.data),removed:0,warning:`candidato inseguro conservado: ${reason}`});
    }
  }catch(error){
    const message=error?.message||String(error);recordCloudFailure(item,message,0);
    perf({action:'end',stage:'preflight nubes del PDF',key,file,index,total,sizeBytes:byteLength(before),outputBytes:byteLength(item.data),warning:`candidato conservado: ${message}`});
  }
  await yieldUI();
}

export async function prepareItemForApply(item,index,total){
  if(!item||item.error||!item.data)return item;
  const file=String(item.name||''),key=`preflight-item::${index}::${file}`,before=item.data;
  perf({action:'start',stage:'preflight por PDF',key,file,index,total,sizeBytes:byteLength(before)});
  breadcrumb('preflight por PDF',{file,index,total});
  try{
    await prepareAnnotations(item,index,total);
    await prepareClouds(item,index,total);
    perf({action:'end',stage:'preflight por PDF',key,file,index,total,sizeBytes:byteLength(before),outputBytes:byteLength(item.data)});
    breadcrumb('preflight PDF completado',{file,index,total});
    await yieldUI();
    return item;
  }catch(error){
    perf({action:'end',stage:'preflight por PDF',key,file,index,total,sizeBytes:byteLength(before),outputBytes:byteLength(item.data),warning:error?.message||String(error)});
    breadcrumb('preflight ERROR',{file,index,total,error:error?.message||String(error)});
    throw error;
  }
}

export function markApplyCompleted(){try{localStorage.setItem(BREADCRUMB_KEY,JSON.stringify({state:'completed',stage:'Apply + ZIP completado',time:Date.now()}));}catch(_){}}
export function clearApplyBreadcrumb(){try{localStorage.removeItem(BREADCRUMB_KEY);}catch(_){}}
window.__batchPreflightPerItemV1={version:1,prepareItemForApply};
