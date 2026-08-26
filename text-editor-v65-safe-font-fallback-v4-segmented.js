// Additive segmented compatible-font fallback.
// Keeps v3 as the first editor, then handles matches split across consecutive Tj
// operators/fonts inside the same text run. All edits are preflighted on a clone
// and verified after save/reopen using StructuredText.asText().
import * as mupdf from 'https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js';
import { editDoc as baseEditDoc } from './text-editor-v65-safe-font-fallback-v3.js?v=20260826-compatiblefont1-internal';

const U=b=>b?.asUint8Array?.()||b;
const A=b=>String.fromCharCode(...U(b));
const WS=new Set([0,9,10,12,13,32]);
const DEL=new Set([40,41,60,62,91,93,123,125,47,37]);
const ws=x=>WS.has(x),del=x=>ws(x)||DEL.has(x);
const resolve=o=>{try{return o?.resolve?.()||o}catch(_){return o}};
const FLEX_SEP=/[\s\u00a0\u2000-\u200b\u2028\u2029\u202f\u205f\u3000‐‑‒–—−-]/u;
const BARRIER=new Set(['Tm','Td','TD','T*','TJ',"'",'"']);
const CP1252=['€','�','‚','ƒ','„','…','†','‡','ˆ','‰','Š','‹','Œ','�','Ž','�','�','‘','’','“','”','•','–','—','˜','™','š','›','œ','�','ž','Ÿ'];
const CP1252_REV=new Map(CP1252.map((c,i)=>[c,0x80+i]).filter(([c])=>c!=='�'));

function streamRef(o){try{if(o?.isStream?.())return o;const r=resolve(o);return r?.isStream?.()?r:null}catch(_){return null}}
function primitive(o){try{return o?.valueOf?.()??o}catch(_){return o}}
function nameOf(o){const r=resolve(o);try{if(r?.isName?.())return String(r.asName?.()||r.valueOf?.()||'').replace(/^\//,'')}catch(_){}return String(primitive(r)||'').replace(/^\//,'')}
function numberOf(o){try{if(o?.asNumber)return Number(o.asNumber());const n=Number(primitive(o));return Number.isFinite(n)?n:0}catch(_){return 0}}
function bytesOf(b){const u=U(b);return u instanceof Uint8Array?new Uint8Array(u):new Uint8Array(u||0)}
function ascii(s){return new TextEncoder().encode(String(s))}
function concat(parts){const n=parts.reduce((q,x)=>q+x.length,0),o=new Uint8Array(n);let p=0;for(const x of parts){o.set(x,p);p+=x.length}return o}
function key(s){let out='';for(const ch of String(s||''))if(!FLEX_SEP.test(ch))out+=ch;return out}

function nextToken(d,i,e){
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
function literalBytes(raw){const b=[];for(let i=1;i<raw.length-1;i++){let x=raw[i];if(x!==92){b.push(x);continue}x=raw[++i];if(x===110)b.push(10);else if(x===114)b.push(13);else if(x===116)b.push(9);else if(x===98)b.push(8);else if(x===102)b.push(12);else if(x===40||x===41||x===92)b.push(x);else if(x===10){}else if(x===13){if(raw[i+1]===10)i++}else if(x>=48&&x<=55){let v=x-48;for(let q=0;q<2&&i+1<raw.length-1&&raw[i+1]>=48&&raw[i+1]<=55;q++){i++;v=v*8+raw[i]-48}b.push(v)}else b.push(x)}return b}
function tokenBytes(t){return t.kind==='hex'?[...hexBytes(t.raw.slice(1,-1))]:literalBytes(t.raw)}
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
function decodeType0(t,c){const b=tokenBytes(t);let s='';for(let i=0;i<b.length;i+=c.bytes){let v=0;for(let j=0;j<c.bytes&&i+j<b.length;j++)v=(v<<8)|b[i+j];s+=c.map.get(v)||'�'}return s}
function encodeType0(text,c){const out=[];for(const ch of String(text)){const v=c.rev.get(ch);if(v==null)return null;for(let q=c.bytes-1;q>=0;q--)out.push((v>>(8*q))&255)}return ascii('<'+out.map(x=>x.toString(16).padStart(2,'0')).join('')+'>')}
function decodeWinAnsi(t){let s='';for(const b of tokenBytes(t))s+=b>=0x80&&b<=0x9f?CP1252[b-0x80]:String.fromCharCode(b);return s}
function encodeWinAnsi(text,font){const out=[],first=font.first,last=font.last,widths=font.widths;for(const ch of String(text)){let b=CP1252_REV.get(ch);if(b==null){const cp=ch.codePointAt(0);if(cp>255)return null;b=cp}if(b<first||b>last)return null;const idx=b-first;if(text!==''&&Number(widths[idx]||0)<=0)return null;out.push(b)}return ascii('<'+out.map(x=>x.toString(16).padStart(2,'0')).join('')+'>')}
function fontFamilyName(f){return nameOf(f?.get?.('BaseFont')).replace(/^[A-Z]{6}\+/,'').toLowerCase().replace(/[^a-z0-9]/g,'')}
function pageFonts(page){const out=[];try{const po=page.getObject(),res=resolve(po.getInheritable?.('Resources')||po.get?.('Resources')),fonts=resolve(res?.get?.('Font'));if(!fonts?.isDictionary?.())return out;fonts.forEach((a,b)=>{let n=null,r=null;const av=typeof a==='string'?a:String(a?.valueOf?.()??''),bv=typeof b==='string'?b:String(b?.valueOf?.()??'');if(typeof a==='string'||(/^\/?[A-Za-z0-9_.-]+$/.test(av)&&b&&typeof b==='object')){n=av;r=b}else{n=bv;r=a}n=String(n||'').replace(/^\//,'');if(n&&r)out.push({name:n,ref:r})})}catch(_){}return out}
function codecFor(entry){try{const f=resolve(entry.ref),family=fontFamilyName(f);if(!family)return null;const subtype=nameOf(f?.get?.('Subtype')),enc=nameOf(f?.get?.('Encoding'));if(subtype==='Type0'&&enc==='Identity-H'){const c=cmap(f?.get?.('ToUnicode'));if(!c)return null;return{kind:'type0',family,decode:t=>decodeType0(t,c),encode:t=>encodeType0(t,c)}}if((subtype==='TrueType'||subtype==='Type1')&&enc==='WinAnsiEncoding'){const first=numberOf(f?.get?.('FirstChar')),last=numberOf(f?.get?.('LastChar')),wa=resolve(f?.get?.('Widths')),widths=[];if(!wa?.isArray?.()||last<first)return null;for(let i=0;i<Number(wa.length||0);i++)widths.push(numberOf(wa.get(i)));const font={first,last,widths};return{kind:'winansi',family,decode:decodeWinAnsi,encode:t=>encodeWinAnsi(t,font)}}}catch(_){}return null}
function fontTable(page){const out=new Map();for(const f of pageFonts(page)){const codec=codecFor(f);if(codec)out.set(f.name,{...f,codec})}return out}
function candidate(fonts,current,text){const cur=fonts.get(current);if(!cur)return null;const a=[];for(const [name,f] of fonts){if(f.codec.family!==cur.codec.family)continue;const encoded=f.codec.encode(text);if(encoded)a.push({name,encoded,kind:f.codec.kind})}a.sort((x,y)=>(x.name===current?-1:y.name===current?1:0)||((x.kind==='type0'?0:1)-(y.kind==='type0'?0:1))||x.name.localeCompare(y.name));return a[0]||null}
function keyMap(s){let k='',starts=[],ends=[];for(let i=0;i<s.length;){const ch=String.fromCodePoint(s.codePointAt(i)),j=i+ch.length;if(!FLEX_SEP.test(ch)){k+=ch;starts.push(i);ends.push(j)}i=j}return{k,starts,ends}}
function matches(full,needle){const f=keyMap(full),t=key(needle),out=[];if(!f.k||!t)return out;let p=0;while((p=f.k.indexOf(t,p))>=0){out.push({start:f.starts[p],end:f.ends[p+t.length-1]});p+=Math.max(1,t.length)}return out}
function mapEqualLength(old,repl){const r=[...key(repl)];let q=0,out='';for(const ch of old){if(FLEX_SEP.test(ch))out+=ch;else out+=r[q++]??ch}return q===r.length?out:null}
function encodeSegment(seg,text,fonts){const cur=fonts.get(seg.font);if(!cur)return null;let enc=cur.codec.encode(text),font=seg.font;if(!enc){const c=candidate(fonts,seg.font,text);if(!c)return null;enc=c.encoded;font=c.name}if(font===seg.font)return{start:seg.token.start,end:seg.token.end,replacement:enc};return{start:seg.token.start,end:seg.opEnd,replacement:concat([ascii(`/${font} ${seg.size} Tf\n`),enc,ascii(` Tj\n/${seg.font} ${seg.size} Tf`)])}}
function planGroup(segs,needle,repl,fonts){
  if(!segs.length)return[];const full=segs.map(s=>s.text).join(''),ms=matches(full,needle);if(!ms.length)return[];
  const offsets=[];let off=0;for(const s of segs){offsets.push(off);off+=s.text.length}
  const texts=segs.map(s=>s.text),equal=key(needle).length===key(repl).length;
  for(const m of [...ms].sort((a,b)=>b.start-a.start)){
    let fi=-1,li=-1;for(let i=0;i<segs.length;i++){const st=offsets[i],en=st+segs[i].text.length;if(fi<0&&m.start<en)fi=i;if(m.end>st)li=i}
    if(fi<0||li<fi)continue;const fs=offsets[fi],ls=offsets[li],a=m.start-fs,b=m.end-ls;
    if(equal){const old=full.slice(m.start,m.end),mapped=mapEqualLength(old,repl);if(mapped==null||mapped.length!==old.length)continue;let q=0;for(let i=fi;i<=li;i++){const st=Math.max(m.start,offsets[i]),en=Math.min(m.end,offsets[i]+segs[i].text.length),n=en-st;if(n<=0)continue;const la=st-offsets[i],lb=en-offsets[i];texts[i]=texts[i].slice(0,la)+mapped.slice(q,q+n)+texts[i].slice(lb);q+=n}}
    else {
      const suffix=texts[li].slice(b);if(fi!==li&&suffix.length)continue;
      if(fi===li)texts[fi]=texts[fi].slice(0,a)+String(repl)+suffix;
      else {texts[fi]=texts[fi].slice(0,a)+String(repl);for(let i=fi+1;i<li;i++)texts[i]='';texts[li]=suffix}
    }
  }
  const changes=[];for(let i=0;i<segs.length;i++)if(texts[i]!==segs[i].text){const c=encodeSegment(segs[i],texts[i],fonts);if(!c)return[];changes.push(c)}return changes;
}
function editStreamSegmented(bytes,needle,repl,page){
  const d=bytesOf(bytes),fonts=fontTable(page);if(!fonts.size)return{bytes:d,count:0,changed:false};const changes=[];let inText=false,font=null,size=null,i=0,p1=null,p2=null,group=[];
  const flush=()=>{if(!group.length)return;const before=group.map(s=>s.text).join(''),n=matches(before,needle).length;if(n){const cs=planGroup(group,needle,repl,fonts);if(cs.length)changes.push(...cs)}group=[]};
  while(i<d.length){const z=nextToken(d,i,d.length);if(!z)break;i=z.next;const t=z.tok,w=t.type==='word'?A(t.raw):'';
    if(w==='BT'){flush();inText=true;font=null;size=null}
    else if(w==='ET'){flush();inText=false}
    else if(inText&&w==='Tf'){if(p2?.type==='name'&&p1?.type==='word'){font=A(p2.raw).slice(1);size=A(p1.raw)}}
    else if(inText&&BARRIER.has(w)){flush()}
    else if(inText&&w==='Tj'&&p1?.type==='string'&&font&&size){const f=fonts.get(font);if(!f){flush()}else{let text='';try{text=f.codec.decode(p1)}catch(_){flush();p2=p1;p1=t;continue}group.push({token:p1,opEnd:t.end,font,size,text})}}
    p2=p1;p1=t;
  }
  flush();if(!changes.length)return{bytes:d,count:0,changed:false};changes.sort((a,b)=>a.start-b.start);for(let k=1;k<changes.length;k++)if(changes[k].start<changes[k-1].end)return{bytes:d,count:0,changed:false};const parts=[];let pos=0;for(const c of changes){parts.push(d.slice(pos,c.start),c.replacement);pos=c.end}parts.push(d.slice(pos));return{bytes:concat(parts),count:changes.length,changed:true}
}
function applySegmented(doc,needle,repl){let n=0;for(let pi=0;pi<doc.countPages();pi++){const page=doc.loadPage(pi),po=page.getObject(),co=po.get('Contents');if(!co)continue;const refs=co?.isArray?.()?Array.from({length:Number(co.length||0)},(_,k)=>co.get(k)):[co];for(const ref of refs){const st=streamRef(ref);if(!st)continue;const z=editStreamSegmented(st.readStream(),needle,repl,page);if(z.changed){st.writeStream(z.bytes);n+=Number(z.count||1)}}}return n}
function countTextLines(doc,text){const t=key(text);if(!t)return 0;let total=0;for(let pi=0;pi<doc.countPages();pi++){let s='';try{s=doc.loadPage(pi).toStructuredText('preserve-spans').asText()}catch(_){return 0}for(const line of String(s).split(/[\r\n]+/)){const k=key(line);let p=0;while((p=k.indexOf(t,p))>=0){total++;p+=Math.max(1,t.length)}}}return total}
function snapshot(doc){return bytesOf(doc.saveToBuffer('garbage=0,compress=yes,appearance=yes'))}
function runBoth(doc,needle,repl){let b=0,s=0;try{b=Number(baseEditDoc(doc,needle,repl)||0)}catch(_){}try{s=Number(applySegmented(doc,needle,repl)||0)}catch(_){}return b+s}

export function editDoc(doc,needle,repl){
  const target=key(needle),replacement=key(repl);if(!target)return 0;
  if(replacement.includes(target))return Number(baseEditDoc(doc,needle,repl)||0);
  const original=snapshot(doc);let trial=null,reopened=null;
  try{
    trial=mupdf.PDFDocument.openDocument(original,'application/pdf');const beforeOld=countTextLines(trial,needle),beforeNew=countTextLines(trial,repl);if(beforeOld<=0)return Number(baseEditDoc(doc,needle,repl)||0);
    runBoth(trial,needle,repl);const trialBytes=snapshot(trial);reopened=mupdf.PDFDocument.openDocument(trialBytes,'application/pdf');const afterOld=countTextLines(reopened,needle),afterNew=countTextLines(reopened,repl),visible=beforeOld-afterOld;
    if(visible<=0||afterNew<beforeNew+visible)return Number(baseEditDoc(doc,needle,repl)||0);
    runBoth(doc,needle,repl);const realBytes=snapshot(doc);let check=null;try{check=mupdf.PDFDocument.openDocument(realBytes,'application/pdf');const realOld=countTextLines(check,needle),realNew=countTextLines(check,repl);if(realOld!==afterOld||realNew<afterNew)throw new Error('Fallback segmentado no superó la verificación final.')}finally{try{check?.destroy()}catch(_){}}
    return visible;
  } finally {try{trial?.destroy()}catch(_){}try{reopened?.destroy()}catch(_){}}
}
