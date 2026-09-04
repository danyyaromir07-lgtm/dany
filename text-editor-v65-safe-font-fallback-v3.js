// Additive compatible-font fallback for the large-stream text editor.
// The stable v2 editor remains the first path. This module only intervenes when v2
// proves the text but cannot encode the replacement because the active Type0 font's
// ToUnicode map is incomplete. It switches only the affected Tj locally to another
// page resource with the same BaseFont family, then restores the original font.
import * as mupdf from 'https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js';
import { editDoc as baseEditDoc } from './text-editor-v65-safe-delimiters-v2-large-stream.js?v=20260826-largestream1-internal';

const U=b=>b?.asUint8Array?.()||b;
const A=b=>String.fromCharCode(...U(b));
const WS=new Set([0,9,10,12,13,32]);
const DEL=new Set([40,41,60,62,91,93,123,125,47,37]);
const ws=x=>WS.has(x),del=x=>ws(x)||DEL.has(x);
const resolve=o=>{try{return o?.resolve?.()||o}catch(_){return o}};
const FLEX_SEP=/[\s\u00a0\u2000-\u200b\u2028\u2029\u202f\u205f\u3000‐‑‒–—−-]/u;

function streamRef(o){try{if(o?.isStream?.())return o;const r=resolve(o);return r?.isStream?.()?r:null}catch(_){return null}}
function primitive(o){try{return o?.valueOf?.()??o}catch(_){return o}}
function nameOf(o){const r=resolve(o);try{if(r?.isName?.())return String(r.asName?.()||r.valueOf?.()||'').replace(/^\//,'')}catch(_){}return String(primitive(r)||'').replace(/^\//,'')}
function numberOf(o){try{if(o?.asNumber)return Number(o.asNumber());const n=Number(primitive(o));return Number.isFinite(n)?n:0}catch(_){return 0}}
function bytesOf(b){const u=U(b);return u instanceof Uint8Array?new Uint8Array(u):new Uint8Array(u||0)}
function ascii(s){return new TextEncoder().encode(String(s))}
function concat(parts){const n=parts.reduce((q,x)=>q+x.length,0),o=new Uint8Array(n);let p=0;for(const x of parts){o.set(x,p);p+=x.length}return o}

function nextToken(d,i,e,inText){
  while(i<e){
    while(i<e&&ws(d[i]))i++;
    if(i>=e)return null;
    if(d[i]===37){while(i<e&&d[i]!==10&&d[i]!==13)i++;continue}
    const st=i,b=d[i];
    if(b===40){i++;let dep=1;while(i<e&&dep){if(d[i]===92)i+=2;else{if(d[i]===40)dep++;else if(d[i]===41)dep--;i++}}return{tok:{type:'string',kind:'literal',start:st,end:i,raw:d.slice(st,i)},next:i}}
    if(b===60&&d[i+1]!==60){i++;while(i<e&&d[i]!==62)i++;if(i<e)i++;return{tok:{type:'string',kind:'hex',start:st,end:i,raw:d.slice(st,i)},next:i}}
    if(b===91){i++;let dep=1;while(i<e&&dep){if(d[i]===40){i++;let sd=1;while(i<e&&sd){if(d[i]===92)i+=2;else{if(d[i]===40)sd++;else if(d[i]===41)sd--;i++}}continue}if(d[i]===60&&d[i+1]!==60){i++;while(i<e&&d[i]!==62)i++;if(i<e)i++;continue}if(d[i]===91)dep++;else if(d[i]===93)dep--;i++}return{tok:{type:'array',start:st,end:i,raw:d.slice(st,i)},next:i}}
    if(b===47){i++;while(i<e&&!del(d[i]))i++;return{tok:{type:'name',start:st,end:i,raw:d.slice(st,i)},next:i}}
    if(DEL.has(b)){i+=((b===60&&d[i+1]===60)||(b===62&&d[i+1]===62))?2:1;return{tok:{type:'delimiter',start:st,end:i,raw:d.slice(st,i)},next:i}}
    while(i<e&&!del(d[i]))i++;
    return{tok:{type:'word',start:st,end:i,raw:d.slice(st,i)},next:i};
  }
  return null;
}
function hexBytes(x){const s=(typeof x==='string'?x:A(x)).replace(/\s+/g,''),h=s.length%2?s+'0':s,o=new Uint8Array(h.length/2);for(let i=0;i<o.length;i++)o[i]=parseInt(h.slice(i*2,i*2+2),16);return o}
function unicodeHex(x){const b=hexBytes(x);let s='';for(let i=0;i+1<b.length;i+=2)s+=String.fromCharCode((b[i]<<8)|b[i+1]);return s}
function cmap(ref){
  const o=streamRef(ref);if(!o)return null;let t='';try{t=A(o.readStream())}catch(_){return null}
  const map=new Map(),rev=new Map();let bytes=0;
  for(const z of t.matchAll(/(?:\d+\s+)?begincodespacerange([\s\S]*?)endcodespacerange/g))for(const x of z[1].matchAll(/<([0-9a-f]+)>\s*<([0-9a-f]+)>/gi))bytes=Math.max(bytes,x[1].length/2);
  for(const z of t.matchAll(/(?:\d+\s+)?beginbfchar([\s\S]*?)endbfchar/g))for(const x of z[1].matchAll(/<([0-9a-f]+)>\s*<([0-9a-f]+)>/gi))map.set(parseInt(x[1],16),unicodeHex(x[2]));
  for(const z of t.matchAll(/(?:\d+\s+)?beginbfrange([\s\S]*?)endbfrange/g)){
    for(const x of z[1].matchAll(/<([0-9a-f]+)>\s*<([0-9a-f]+)>\s*<([0-9a-f]+)>/gi)){const aa=parseInt(x[1],16),bb=parseInt(x[2],16),u=parseInt(x[3],16);for(let k=aa;k<=bb;k++)map.set(k,String.fromCodePoint(u+k-aa))}
    for(const x of z[1].matchAll(/<([0-9a-f]+)>\s*<([0-9a-f]+)>\s*\[([\s\S]*?)\]/gi)){const aa=parseInt(x[1],16),bb=parseInt(x[2],16),v=[...x[3].matchAll(/<([0-9a-f]+)>/gi)];for(let k=aa;k<=bb&&k-aa<v.length;k++)map.set(k,unicodeHex(v[k-aa][1]))}
  }
  if(!map.size)return null;if(!bytes)bytes=2;for(const[k,v]of map)if([...v].length===1&&!rev.has(v))rev.set(v,k);return{map,rev,bytes};
}
function decodeToken(t,c){const raw=t.raw,b=[];if(t.kind==='hex')b.push(...hexBytes(raw.slice(1,-1)));else{for(let i=1;i<raw.length-1;i++){let x=raw[i];if(x!==92){b.push(x);continue}x=raw[++i];if(x===110)b.push(10);else if(x===114)b.push(13);else if(x===116)b.push(9);else if(x===98)b.push(8);else if(x===102)b.push(12);else if(x===40||x===41||x===92)b.push(x);else if(x>=48&&x<=55){let v=x-48;for(let q=0;q<2&&i+1<raw.length-1&&raw[i+1]>=48&&raw[i+1]<=55;q++){i++;v=v*8+raw[i]-48}b.push(v)}else b.push(x)}}let s='';for(let i=0;i<b.length;i+=c.bytes){let v=0;for(let j=0;j<c.bytes&&i+j<b.length;j++)v=(v<<8)|b[i+j];s+=c.map.get(v)||'�'}return s}
function encodeType0(text,c){const out=[];for(const ch of String(text)){const v=c.rev.get(ch);if(v==null)return null;for(let q=c.bytes-1;q>=0;q--)out.push((v>>(8*q))&255)}return ascii('<'+out.map(x=>x.toString(16).padStart(2,'0')).join('')+'>')}
function encodeWinAnsi(text,font){const out=[],first=font.first,last=font.last,widths=font.widths;for(const ch of String(text)){const cp=ch.codePointAt(0);if(cp>255)return null;const b=cp;if(b<first||b>last)return null;const idx=b-first,w=Number(widths[idx]||0);if(w<=0)return null;out.push(b)}return ascii('<'+out.map(x=>x.toString(16).padStart(2,'0')).join('')+'>')}
function fontFamilyName(f){return nameOf(f?.get?.('BaseFont')).replace(/^[A-Z]{6}\+/,'').toLowerCase().replace(/[^a-z0-9]/g,'')}
function pageFonts(page){const out=[];try{const po=page.getObject(),res=resolve(po.getInheritable?.('Resources')||po.get?.('Resources')),fonts=resolve(res?.get?.('Font'));if(!fonts?.isDictionary?.())return out;fonts.forEach((a,b)=>{let key=null,ref=null;const av=typeof a==='string'?a:String(a?.valueOf?.()??''),bv=typeof b==='string'?b:String(b?.valueOf?.()??'');if(typeof a==='string'||(/^\/?[A-Za-z0-9_.-]+$/.test(av)&&b&&typeof b==='object')){key=av;ref=b}else{key=bv;ref=a}key=String(key||'').replace(/^\//,'');if(key&&ref)out.push({name:key,ref})})}catch(_){}return out}
function codecFor(fontEntry){try{const f=resolve(fontEntry.ref),family=fontFamilyName(f);if(!family)return null;const subtype=nameOf(f?.get?.('Subtype')),enc=nameOf(f?.get?.('Encoding'));if(subtype==='Type0'&&enc==='Identity-H'){const c=cmap(f?.get?.('ToUnicode'));if(!c)return null;return{kind:'type0',family,c,encode:text=>encodeType0(text,c),decode:(tok)=>decodeToken(tok,c)}}if((subtype==='TrueType'||subtype==='Type1')&&enc==='WinAnsiEncoding'){const first=numberOf(f?.get?.('FirstChar')),last=numberOf(f?.get?.('LastChar')),wa=resolve(f?.get?.('Widths')),widths=[];if(!wa?.isArray?.()||last<first)return null;for(let i=0;i<Number(wa.length||0);i++)widths.push(numberOf(wa.get(i)));const font={first,last,widths};return{kind:'winansi',family,encode:text=>encodeWinAnsi(text,font)}}}catch(_){}return null}
function fontTable(page){const out=new Map();for(const f of pageFonts(page)){const codec=codecFor(f);if(codec)out.set(f.name,{...f,codec})}return out}
export function flexibleTextKey(s){let out='';for(const ch of String(s||''))if(!FLEX_SEP.test(ch))out+=ch;return out}
function keyWithMap(s){let key='',starts=[],ends=[];for(let i=0;i<s.length;){const cp=s.codePointAt(i),ch=String.fromCodePoint(cp),j=i+ch.length;if(!FLEX_SEP.test(ch)){key+=ch;starts.push(i);ends.push(j)}i=j}return{key,starts,ends}}
function findMatches(full,needle){const f=keyWithMap(full),target=flexibleTextKey(needle),out=[];if(!target||!f.key)return out;let p=0;while((p=f.key.indexOf(target,p))>=0){out.push({start:f.starts[p],end:f.ends[p+target.length-1]});p+=Math.max(1,target.length)}return out}
function replaceMatches(text,matches,repl){let out=text;for(const m of [...matches].sort((a,b)=>b.start-a.start))out=out.slice(0,m.start)+String(repl)+out.slice(m.end);return out}
function sameFamilyCandidates(fonts,currentName,newText){const cur=fonts.get(currentName);if(!cur)return[];const a=[];for(const [name,f] of fonts){if(name===currentName||f.codec.family!==cur.codec.family)continue;const encoded=f.codec.encode(newText);if(encoded)a.push({name,encoded,kind:f.codec.kind})}a.sort((x,y)=>(x.kind==='type0'?0:1)-(y.kind==='type0'?0:1)||x.name.localeCompare(y.name));return a}
function editStreamCompatible(bytes,needle,repl,page){const d=bytesOf(bytes),fonts=fontTable(page);if(!fonts.size)return{bytes:d,count:0};const changes=[];let count=0,inText=false,font=null,fontSizeRaw=null,i=0,prev1=null,prev2=null;while(i<d.length){const z=nextToken(d,i,d.length,inText);if(!z)break;i=z.next;const t=z.tok,w=t.type==='word'?A(t.raw):'';if(w==='Tf'){if(prev2?.type==='name'&&prev1?.type==='word'){font=A(prev2.raw).slice(1);fontSizeRaw=A(prev1.raw)}}else if(w==='BT')inText=true;else if(w==='ET')inText=false;else if(inText&&font&&fontSizeRaw&&w==='Tj'&&prev1?.type==='string'){const cur=fonts.get(font);if(cur?.codec.kind==='type0'){const text=cur.codec.decode(prev1),matches=findMatches(text,needle);if(matches.length){const rewritten=replaceMatches(text,matches,repl);if(!cur.codec.encode(rewritten)){const candidates=sameFamilyCandidates(fonts,font,rewritten);if(candidates.length){const c=candidates[0],replacement=concat([ascii(`/${c.name} ${fontSizeRaw} Tf\n`),c.encoded,ascii(` Tj\n/${font} ${fontSizeRaw} Tf`)]);changes.push({start:prev1.start,end:t.end,replacement});count+=matches.length}}}}}prev2=prev1;prev1=t}if(!changes.length)return{bytes:d,count:0};changes.sort((a,b)=>a.start-b.start);for(let k=1;k<changes.length;k++)if(changes[k].start<changes[k-1].end)throw new Error('Fallback de fuente compatible detectó ediciones solapadas; no se modifica el PDF.');const parts=[];let pos=0;for(const c of changes){parts.push(d.slice(pos,c.start),c.replacement);pos=c.end}parts.push(d.slice(pos));return{bytes:concat(parts),count}}
function applyCompatibleFontFallback(doc,needle,repl){let count=0;for(let i=0;i<doc.countPages();i++){const page=doc.loadPage(i),po=page.getObject(),co=po.get('Contents');if(!co)continue;const refs=co?.isArray?.()?Array.from({length:Number(co.length||0)},(_,k)=>co.get(k)):[co];for(const ref of refs){const st=streamRef(ref);if(!st)continue;const z=editStreamCompatible(st.readStream(),needle,repl,page);if(z.count){st.writeStream(z.bytes);count+=z.count}}}return count}
function countVisibleFlexible(doc,text){const target=flexibleTextKey(text);if(!target)return 0;let total=0;for(let i=0;i<doc.countPages();i++){let lines=[];try{const page=doc.loadPage(i),j=JSON.parse(page.toStructuredText('preserve-spans').asJSON());lines=(j.blocks||[]).flatMap(b=>b.type==='text'?(b.lines||[]).map(l=>String(l.text||'')):[])}catch(_){}for(const line of lines){const key=flexibleTextKey(line);let p=0;while((p=key.indexOf(target,p))>=0){total++;p+=Math.max(1,target.length)}}}return total}
function snapshot(doc){return bytesOf(doc.saveToBuffer('garbage=0,compress=yes,appearance=yes'))}
function verifiedFallback(snapshotBytes,needle,repl){let trial=null,reopened=null;try{trial=mupdf.PDFDocument.openDocument(snapshotBytes,'application/pdf');const beforeOld=countVisibleFlexible(trial,needle),beforeNew=countVisibleFlexible(trial,repl),applied=applyCompatibleFontFallback(trial,needle,repl);if(!applied)return{ok:false,count:0};const out=snapshot(trial);reopened=mupdf.PDFDocument.openDocument(out,'application/pdf');const afterOld=countVisibleFlexible(reopened,needle),afterNew=countVisibleFlexible(reopened,repl),oldRemoved=Math.max(0,beforeOld-afterOld),newAdded=Math.max(0,afterNew-beforeNew);return{ok:oldRemoved===applied&&newAdded===applied,count:applied,oldRemoved,newAdded}}finally{try{trial?.destroy()}catch(_){}try{reopened?.destroy()}catch(_){}}}
export function editDoc(doc,find,replace){const snap=snapshot(doc);let trial=null,baseError=null;try{trial=mupdf.PDFDocument.openDocument(snap,'application/pdf');const n=Number(baseEditDoc(trial,find,replace)||0);trial.destroy();trial=null;if(n>0)return Number(baseEditDoc(doc,find,replace)||0);return n}catch(error){baseError=error;try{trial?.destroy()}catch(_){}trial=null;if(!/no existe en ToUnicode/i.test(String(error?.message||error)))throw error}const proof=verifiedFallback(snap,find,replace);if(!proof.ok||proof.count<=0)throw baseError;const applied=applyCompatibleFontFallback(doc,find,replace);if(applied!==proof.count)throw new Error(`Fallback de fuente compatible aplicado=${applied}, probado=${proof.count}; revisar PDF.`);return applied}
if(typeof window!=='undefined')window.__textEditorCompatibleFontFallback={version:'v3',mode:'same-basefont-local-tj-verified'};
