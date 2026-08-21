// Text-only verification wrapper for editors that may mutate the PDF while reporting zero edits.
// It never invents edits: a recovered count requires the old text to decrease and the replacement text to increase.
// Use an internal v67 URL that is intentionally not redirected by the production import map.
import * as mupdf from 'https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js';
import { editDoc as baseEditDoc } from './text-editor-v67.js?v=20260821-subengine-diagnostic1';

function searchCount(doc,text){
  const needle=String(text||'').trim();
  if(!needle)return 0;
  let total=0;
  try{
    for(let i=0;i<doc.countPages();i++){
      const page=doc.loadPage(i);
      const hits=page.search(needle)||[];
      total+=Number(hits.length||0);
    }
  }catch(_){return 0}
  return total;
}

function savedBytes(doc){
  const buffer=doc.saveToBuffer('garbage=4,compress=yes,appearance=yes');
  return buffer?.asUint8Array?new Uint8Array(buffer.asUint8Array()):new Uint8Array(buffer);
}

function verifiedCountAfterReopen(doc,find,replace,beforeOld,beforeNew){
  let reopened=null;
  try{
    reopened=mupdf.PDFDocument.openDocument(savedBytes(doc),'application/pdf');
    const afterOld=searchCount(reopened,find);
    const afterNew=searchCount(reopened,replace);
    const oldRemoved=Math.max(0,beforeOld-afterOld);
    const newAdded=Math.max(0,afterNew-beforeNew);
    return Math.min(oldRemoved,newAdded);
  }catch(_){return 0}
  finally{try{reopened?.destroy()}catch(_){}}
}

export function editDoc(doc,find,replace){
  const beforeOld=searchCount(doc,find);
  const beforeNew=searchCount(doc,replace);
  const reported=Number(baseEditDoc(doc,find,replace)||0);
  if(reported>0)return reported;
  return verifiedCountAfterReopen(doc,find,replace,beforeOld,beforeNew);
}

if(typeof window!=='undefined')window.__textEditorV68={version:'68+verified-reopen3+subengine-diagnostic1'};
