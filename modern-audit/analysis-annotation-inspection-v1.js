// Read-only metadata inspection used by the completion barrier when signature/link operators are selected.
// It never saves or mutates a PDF.
import { PDFDocument, PDFName } from 'https://esm.sh/pdf-lib@1.17.1';
function resolve(doc,obj){try{return doc.context.lookup(obj)||obj}catch(_){return obj}}
function subtype(doc,ref){return resolve(doc,ref)?.get?.(PDFName.of('Subtype'))?.toString?.().replace(/^\//,'')||''}
function parent(doc,ref){return resolve(doc,ref)?.get?.(PDFName.of('Parent'))||null}
function isSignature(doc,ref){let cur=ref;for(let i=0;cur&&i<8;i++){if(resolve(doc,cur)?.get?.(PDFName.of('FT'))?.toString?.().replace(/^\//,'')==='Sig')return true;cur=parent(doc,cur)}return false}
function annots(page){const a=page.node.get(PDFName.of('Annots'));return a?.size&&a?.get?a:null}
export async function inspectSelectedAnnotationMetadata(batch){
  let errors=0;
  for(const a of batch||[]){
    if(a?.error||!a?.data)continue;
    try{
      const doc=await PDFDocument.load(a.data,{updateMetadata:false,ignoreEncryption:false});let annotationCount=0,signatureCount=0,linkCount=0;
      for(const page of doc.getPages()){const list=annots(page);if(!list)continue;for(let i=0;i<list.size();i++){const ref=list.get(i),st=subtype(doc,ref);if(st==='Widget'){if(isSignature(doc,ref))signatureCount++;}else if(st==='Link')linkCount++;else annotationCount++;}}
      a.annotationCount=annotationCount;a.signatureCount=signatureCount;a.linkCount=linkCount;
    }catch(err){errors++;a.signatureError=err?.message||String(err);}
    await new Promise(r=>setTimeout(r,0));
  }
  return{errors};
}
