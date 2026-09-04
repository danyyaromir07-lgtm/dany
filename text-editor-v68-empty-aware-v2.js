// Empty-aware verification wrapper v2: same verification policy, with flexible empty fallback v14 underneath.
import * as mupdf from 'https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js';
import { editDoc as baseEditDoc } from './text-editor-empty-flex-v14.js?v=20260828-flexempty1';

function searchCount(doc,text){
  const needle=String(text||'').trim();
  if(!needle)return 0;
  let total=0;
  try{for(let i=0;i<doc.countPages();i++)total+=Number((doc.loadPage(i).search(needle)||[]).length||0)}catch(_){return 0}
  return total;
}
function savedBytes(doc){const buffer=doc.saveToBuffer('garbage=4,compress=yes,appearance=yes');return buffer?.asUint8Array?new Uint8Array(buffer.asUint8Array()):new Uint8Array(buffer)}
function verifiedCountAfterReopen(doc,find,replace,beforeOld,beforeNew){
  let reopened=null;
  try{
    reopened=mupdf.PDFDocument.openDocument(savedBytes(doc),'application/pdf');
    const afterOld=searchCount(reopened,find),oldRemoved=Math.max(0,beforeOld-afterOld);
    if(String(replace??'')==='')return oldRemoved;
    const afterNew=searchCount(reopened,replace),newAdded=Math.max(0,afterNew-beforeNew);
    return Math.min(oldRemoved,newAdded);
  }catch(_){return 0}finally{try{reopened?.destroy()}catch(_){}}
}
export function editDoc(doc,find,replace){
  const beforeOld=searchCount(doc,find),beforeNew=String(replace??'')===''?0:searchCount(doc,replace);
  const reported=Number(baseEditDoc(doc,find,replace)||0);
  if(reported>0)return reported;
  return verifiedCountAfterReopen(doc,find,replace,beforeOld,beforeNew);
}
if(typeof window!=='undefined')window.__textEditorV68EmptyAware={version:'68-empty-aware-v2-flex14'};
