// Low-memory empty replacement using StructuredText geometry and flexible normalization.
// Designed for Apply orchestration: no internal save/reopen trial; outer wrapper owns the transaction.
import * as mupdf from 'https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js';

const FLEX=/[\s\u00a0\u2000-\u200b\u2028\u2029\u202f\u205f\u3000‐‑‒–—−-]/u;
const isFlex=ch=>FLEX.test(String(ch||''));
const key=s=>{let out='';for(const ch of String(s||''))if(!isFlex(ch))out+=ch;return out};
function asChar(utf){if(typeof utf==='number'&&Number.isFinite(utf)){try{return String.fromCodePoint(utf)}catch(_){return''}}return String(utf??'')}
function quadRect(q){const a=Array.from(q||[]);if(a.length===8&&a.every(Number.isFinite)){const xs=[a[0],a[2],a[4],a[6]],ys=[a[1],a[3],a[5],a[7]];return[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)]}const pts=a.flatMap(p=>Array.isArray(p)?[p]:p&&Number.isFinite(p.x)&&Number.isFinite(p.y)?[[p.x,p.y]]:[]);if(!pts.length)return null;const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);return[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)]}
function pageChars(page){const chars=[];let line=0;try{const st=page.toStructuredText('preserve-spans');st.walk({beginLine(){line++},onChar(utf,_origin,_font,_size,quad){const ch=asChar(utf);if(ch)chars.push({ch,quad,line})}})}catch(_){return[]}return chars}
function normalized(chars){let text='',map=[];for(let i=0;i<chars.length;i++)if(!isFlex(chars[i].ch)){text+=chars[i].ch;map.push(i)}return{text,map}}
function matchRanges(chars,find){const target=key(find);if(!target)return[];const n=normalized(chars),out=[];let p=0;while((p=n.text.indexOf(target,p))>=0){const a=n.map[p],b=n.map[p+target.length-1];if(a==null||b==null)break;out.push([a,b]);p+=Math.max(1,target.length)}return out}
function mergeRect(a,b){return[Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[2],b[2]),Math.max(a[3],b[3])]}
function rectsForRanges(chars,ranges){const out=[];for(const [a,b] of ranges){let run=null,runLine=-1,runCount=0;const flush=()=>{if(run){out.push(run);run=null;runCount=0}};for(let i=a;i<=b;i++){const c=chars[i],r=quadRect(c?.quad);if(!c||!r||r[2]<=r[0]||r[3]<=r[1])continue;if(c.line!==runLine||runCount>=8){flush();runLine=c.line}run=run?mergeRect(run,r):r;runCount++}flush()}return out}
export function flexibleCount(doc,find){let total=0;for(let pi=0;pi<doc.countPages();pi++)total+=matchRanges(pageChars(doc.loadPage(pi)),find).length;return total}
export function editEmptyLowMemory(doc,find){const expected=flexibleCount(doc,find);if(expected<=0)return 0;let logical=0;for(let pi=0;pi<doc.countPages();pi++){const page=doc.loadPage(pi),chars=pageChars(page),ranges=matchRanges(chars,find);if(!ranges.length)continue;logical+=ranges.length;const rects=rectsForRanges(chars,ranges);for(const r of rects){const an=page.createAnnotation('Redact');an.setRect(r);try{an.update?.()}catch(_){}}if(rects.length)page.applyRedactions(false,mupdf.PDFPage.REDACT_IMAGE_NONE,mupdf.PDFPage.REDACT_LINE_ART_NONE,mupdf.PDFPage.REDACT_TEXT_REMOVE)}return logical}
if(typeof window!=='undefined')window.__textEditorEmptyGlyphRedactV17={version:'v17-lowmem-flex-redact1'};
