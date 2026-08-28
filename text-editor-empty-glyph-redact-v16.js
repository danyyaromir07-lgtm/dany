// Last-resort empty replacement using the same flexible Unicode normalization as analysis,
// but with per-character StructuredText geometry. This removes the matched glyphs even when
// exact page.search() cannot locate the phrase because of line breaks, spacing or fragmentation.
import * as mupdf from 'https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js';
import { editDoc as editV15 } from './text-editor-empty-redact-v15.js?v=20260828-redactempty1';

const FLEX=/[\s\u00a0\u2000-\u200b\u2028\u2029\u202f\u205f\u3000‐‑‒–—−-]/u;
const U=b=>b?.asUint8Array?.()||b;
const bytes=b=>{const u=U(b);return u instanceof Uint8Array?new Uint8Array(u):new Uint8Array(u||0)};
const isFlex=ch=>FLEX.test(String(ch||''));
const key=s=>{let out='';for(const ch of String(s||''))if(!isFlex(ch))out+=ch;return out};
function snapshot(doc){return bytes(doc.saveToBuffer('garbage=0,compress=yes,appearance=yes'))}
function asChar(utf){if(typeof utf==='number'&&Number.isFinite(utf)){try{return String.fromCodePoint(utf)}catch(_){return''}}return String(utf??'')}
function quadRect(q){const a=Array.from(q||[]);if(a.length===8&&a.every(Number.isFinite)){const xs=[a[0],a[2],a[4],a[6]],ys=[a[1],a[3],a[5],a[7]];return[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)]}const pts=a.flatMap(p=>Array.isArray(p)?[p]:p&&Number.isFinite(p.x)&&Number.isFinite(p.y)?[[p.x,p.y]]:[]);if(!pts.length)return null;const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);return[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)]}
function pageChars(page){const chars=[];let line=0;try{const st=page.toStructuredText('preserve-spans');st.walk({beginLine(){line++},onChar(utf,_origin,_font,_size,quad){const ch=asChar(utf);if(!ch)return;chars.push({ch,quad,line})}})}catch(_){return[]}return chars}
function normalized(chars){let text='',map=[];for(let i=0;i<chars.length;i++)if(!isFlex(chars[i].ch)){text+=chars[i].ch;map.push(i)}return{text,map}}
function matchRanges(chars,find){const target=key(find);if(!target)return[];const n=normalized(chars),out=[];let p=0;while((p=n.text.indexOf(target,p))>=0){let a=n.map[p],b=n.map[p+target.length-1];if(a==null||b==null)break;if(isFlex(String(find||'')[0])){const line=chars[a]?.line;while(a>0&&chars[a-1]?.line===line&&isFlex(chars[a-1]?.ch))a--}const fs=String(find||'');if(isFlex(fs[fs.length-1])){const line=chars[b]?.line;while(b+1<chars.length&&chars[b+1]?.line===line&&isFlex(chars[b+1]?.ch))b++}out.push([a,b]);p+=Math.max(1,target.length)}return out}
function rectsForRanges(chars,ranges){const groups=new Map();for(const [a,b] of ranges)for(let i=a;i<=b;i++){const c=chars[i],r=quadRect(c?.quad);if(!c||!r)continue;const k=`${a}:${b}:${c.line}`,old=groups.get(k);if(!old)groups.set(k,r);else{old[0]=Math.min(old[0],r[0]);old[1]=Math.min(old[1],r[1]);old[2]=Math.max(old[2],r[2]);old[3]=Math.max(old[3],r[3])}}return[...groups.values()]}
function flexibleCount(doc,find){let total=0;for(let pi=0;pi<doc.countPages();pi++)total+=matchRanges(pageChars(doc.loadPage(pi)),find).length;return total}
function redactFlexible(doc,find){let logical=0;for(let pi=0;pi<doc.countPages();pi++){const page=doc.loadPage(pi),chars=pageChars(page),ranges=matchRanges(chars,find);if(!ranges.length)continue;logical+=ranges.length;const rects=rectsForRanges(chars,ranges);for(const r of rects){const an=page.createAnnotation('Redact');an.setRect(r);try{an.update?.()}catch(_){}}if(rects.length)page.applyRedactions(false,mupdf.PDFPage.REDACT_IMAGE_NONE,mupdf.PDFPage.REDACT_LINE_ART_NONE,mupdf.PDFPage.REDACT_TEXT_REMOVE)}return logical}
function trial(pristine,find){let d=null,re=null;try{d=mupdf.PDFDocument.openDocument(pristine,'application/pdf');const old=flexibleCount(d,find);if(!old)return 0;const n=redactFlexible(d,find);if(n!==old)return 0;re=mupdf.PDFDocument.openDocument(snapshot(d),'application/pdf');const after=flexibleCount(re,find);return old>0&&old-after===old?old:0}catch(_){return 0}finally{try{re?.destroy()}catch(_){}try{d?.destroy()}catch(_){}}}
export function editDoc(doc,find,replace){const first=Number(editV15(doc,find,replace)||0);if(first>0||String(replace??'')!=='')return first;if(!String(find||'').trim())return 0;let pristine;try{pristine=snapshot(doc)}catch(_){return 0}const expected=trial(pristine,find);if(expected<=0)return 0;try{const real=redactFlexible(doc,find);return real===expected?real:0}catch(_){return 0}}
if(typeof window!=='undefined')window.__textEditorEmptyGlyphRedactV16={version:'v16-structuredtext-flex-redact1'};
