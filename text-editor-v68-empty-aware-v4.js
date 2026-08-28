// Empty-aware verification wrapper v4: structural/flexible/redaction fallbacks first,
// then StructuredText-character geometry v16 for flexible matches that exact search cannot locate.
import * as mupdf from 'https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js';
import { editDoc as baseEditDoc } from './text-editor-empty-glyph-redact-v16.js?v=20260828-glyphredact1';
function searchCount(doc,text){const q=String(text||'').trim();if(!q)return 0;let n=0;try{for(let i=0;i<doc.countPages();i++)n+=Number((doc.loadPage(i).search(q)||[]).length||0)}catch(_){return 0}return n}
function savedBytes(doc){const b=doc.saveToBuffer('garbage=4,compress=yes,appearance=yes');return b?.asUint8Array?new Uint8Array(b.asUint8Array()):new Uint8Array(b)}
function verify(doc,find,replace,beforeOld,beforeNew){let re=null;try{re=mupdf.PDFDocument.openDocument(savedBytes(doc),'application/pdf');const afterOld=searchCount(re,find),removed=Math.max(0,beforeOld-afterOld);if(String(replace??'')==='')return removed;const afterNew=searchCount(re,replace),added=Math.max(0,afterNew-beforeNew);return Math.min(removed,added)}catch(_){return 0}finally{try{re?.destroy()}catch(_){}}}
export function editDoc(doc,find,replace){const beforeOld=searchCount(doc,find),beforeNew=String(replace??'')===''?0:searchCount(doc,replace);const n=Number(baseEditDoc(doc,find,replace)||0);return n>0?n:verify(doc,find,replace,beforeOld,beforeNew)}
if(typeof window!=='undefined')window.__textEditorV68EmptyAware={version:'68-empty-aware-v4-glyphredact16'};
