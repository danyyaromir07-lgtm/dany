// Last-resort empty replacement using MuPDF text search + text-only redaction.
// Existing structural editors run first. This fallback is encoding/operator agnostic and preserves images/line art.
import * as mupdf from 'https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js';
import { editDoc as editV14 } from './text-editor-empty-flex-v14.js?v=20260828-flexempty1';

const U=b=>b?.asUint8Array?.()||b;
const bytes=b=>{const u=U(b);return u instanceof Uint8Array?new Uint8Array(u):new Uint8Array(u||0)};
function snapshot(doc){return bytes(doc.saveToBuffer('garbage=0,compress=yes,appearance=yes'))}
function hits(page,find){try{return page.search(String(find||''))||[]}catch(_){return[]}}
function count(doc,find){let n=0;for(let i=0;i<doc.countPages();i++)n+=hits(doc.loadPage(i),find).length;return n}
function quadRect(q){
  const a=Array.from(q||[]);
  if(a.length===8&&a.every(Number.isFinite)){const xs=[a[0],a[2],a[4],a[6]],ys=[a[1],a[3],a[5],a[7]];return[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)]}
  const pts=a.flatMap(p=>Array.isArray(p)?[p]:p&&Number.isFinite(p.x)&&Number.isFinite(p.y)?[[p.x,p.y]]:[]);
  if(pts.length){const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);return[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)]}
  return null;
}
function isQuadLike(v){const a=Array.from(v||[]);return a.length===8&&a.every(Number.isFinite)}
function redact(doc,find){let logical=0;for(let pi=0;pi<doc.countPages();pi++){const page=doc.loadPage(pi),hh=hits(page,find);if(!hh.length)continue;logical+=hh.length;let made=0;for(const hit of hh){const qq=isQuadLike(hit)?[hit]:Array.from(hit||[]);for(const q of qq){const r=quadRect(q);if(!r)continue;const an=page.createAnnotation('Redact');an.setRect(r);try{an.update?.()}catch(_){}made++}}if(made)page.applyRedactions(false,mupdf.PDFPage.REDACT_IMAGE_NONE,mupdf.PDFPage.REDACT_LINE_ART_NONE,mupdf.PDFPage.REDACT_TEXT_REMOVE)}return logical}
function trial(pristine,find){let d=null,re=null;try{d=mupdf.PDFDocument.openDocument(pristine,'application/pdf');const old=count(d,find);if(!old)return 0;const n=redact(d,find);if(n!==old)return 0;re=mupdf.PDFDocument.openDocument(snapshot(d),'application/pdf');const after=count(re,find);return old>0&&old-after===old?old:0}catch(_){return 0}finally{try{re?.destroy()}catch(_){}try{d?.destroy()}catch(_){}}}
export function editDoc(doc,find,replace){const first=Number(editV14(doc,find,replace)||0);if(first>0||String(replace??'')!=='')return first;if(!String(find||'').trim())return 0;let pristine;try{pristine=snapshot(doc)}catch(_){return 0}const expected=trial(pristine,find);if(expected<=0)return 0;try{const real=redact(doc,find);return real===expected?real:0}catch(_){return 0}}
if(typeof window!=='undefined')window.__textEditorEmptyRedactV15={version:'v15-text-only-redact1'};
