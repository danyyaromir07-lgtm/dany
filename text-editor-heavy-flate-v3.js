// Structurally-proven, memory-bounded editor for exceptionally large Flate page streams.
// Family: Type0 + Identity-H + ToUnicode + direct hexadecimal Tj inside BT/ET.
// Never materializes decoded page streams in JavaScript, never redacts, and fails closed.

const RAW_STREAM_MIN_BYTES = 8 * 1024 * 1024;
const MAX_RAW_OUTPUT_BYTES = 96 * 1024 * 1024;
const MAX_CONTEXT_BYTES = 64 * 1024;
const AFTER_BYTES = 128;
const MAX_SPACE_RUN = 4;
const MAX_VARIANTS_PER_FONT = 128;
const enc = new TextEncoder();

const U = (b) => b?.asUint8Array?.() || b;
const resolve = (o) => { try { return o?.resolve?.() || o; } catch (_) { return o; } };
const streamRef = (o) => { try { if (o?.isStream?.()) return o; const r = resolve(o); return r?.isStream?.() ? r : null; } catch (_) { return null; } };
const ws = (b) => b === 0 || b === 9 || b === 10 || b === 12 || b === 13 || b === 32;
const delim = (b) => ws(b) || b === 40 || b === 41 || b === 60 || b === 62 || b === 91 || b === 93 || b === 123 || b === 125 || b === 47 || b === 37;

function asText(bytes) { const u=U(bytes); let s=''; for(let i=0;i<u.length;i+=0x8000)s+=String.fromCharCode(...u.subarray(i,Math.min(u.length,i+0x8000))); return s; }
function primitive(o){try{return o?.valueOf?.()??o}catch(_){return o}}
function nameOf(o){const r=resolve(o);try{if(r?.isName?.())return String(r.asName?.()||r.valueOf?.()||'').replace(/^\//,'')}catch(_){}return String(primitive(r)||'').replace(/^\//,'')}
function numberOf(o){try{if(o?.asNumber)return Number(o.asNumber());const n=Number(primitive(o));return Number.isFinite(n)?n:0}catch(_){return 0}}
function contentRefs(page){try{const co=page.getObject()?.get?.('Contents');if(!co)return[];const r=resolve(co);if(r?.isArray?.())return Array.from({length:Number(r.length||0)},(_,i)=>r.get(i));return[co]}catch(_){return[]}}
function isPlainFlate(st){try{const f=resolve(st.get?.('Filter')),dp=resolve(st.get?.('DecodeParms'));if(dp&&!dp.isNull?.())return false;if(f?.isArray?.())return Number(f.length||0)===1&&nameOf(f.get(0))==='FlateDecode';return nameOf(f)==='FlateDecode'}catch(_){return false}}
function rawLength(st){try{const n=numberOf(st.get?.('Length'));if(n>0)return n}catch(_){}try{const b=U(st.readRawStream?.());return Number(b?.byteLength||b?.length||0)}catch(_){return 0}}

function hexBytes(x){const s=String(x||'').replace(/\s+/g,''),h=s.length%2?s+'0':s,out=new Uint8Array(h.length/2);for(let i=0;i<out.length;i++)out[i]=parseInt(h.slice(i*2,i*2+2),16);return out}
function unicodeFromHex(x){const b=hexBytes(x);let s='';for(let i=0;i+1<b.length;i+=2)s+=String.fromCharCode((b[i]<<8)|b[i+1]);return s}
function parseCMap(ref){const o=streamRef(ref);if(!o)return null;let t='';try{t=asText(o.readStream())}catch(_){return null}const map=new Map(),rev=new Map();let bytes=0;
  for(const z of t.matchAll(/(?:\d+\s+)?begincodespacerange([\s\S]*?)endcodespacerange/g))for(const x of z[1].matchAll(/<([0-9a-f]+)>\s*<([0-9a-f]+)>/gi))bytes=Math.max(bytes,x[1].length/2);
  for(const z of t.matchAll(/(?:\d+\s+)?beginbfchar([\s\S]*?)endbfchar/g))for(const x of z[1].matchAll(/<([0-9a-f]+)>\s*<([0-9a-f]+)>/gi))map.set(parseInt(x[1],16),unicodeFromHex(x[2]));
  for(const z of t.matchAll(/(?:\d+\s+)?beginbfrange([\s\S]*?)endbfrange/g)){
    for(const x of z[1].matchAll(/<([0-9a-f]+)>\s*<([0-9a-f]+)>\s*<([0-9a-f]+)>/gi)){const a=parseInt(x[1],16),b=parseInt(x[2],16),u=parseInt(x[3],16);for(let k=a;k<=b;k++)map.set(k,String.fromCodePoint(u+k-a))}
    for(const x of z[1].matchAll(/<([0-9a-f]+)>\s*<([0-9a-f]+)>\s*\[([\s\S]*?)\]/gi)){const a=parseInt(x[1],16),b=parseInt(x[2],16),vals=[...x[3].matchAll(/<([0-9a-f]+)>/gi)];for(let k=a;k<=b&&k-a<vals.length;k++)map.set(k,unicodeFromHex(vals[k-a][1]))}
  }
  if(!map.size)return null;if(!bytes)bytes=2;if(bytes!==2)return null;
  for(const[code,text]of map)if([...text].length===1&&!rev.has(text))rev.set(text,code);
  return{rev,bytes};
}
function type0IdentityHCMap(fontRef){try{const f=resolve(fontRef);if(!/Type0/.test(nameOf(f?.get?.('Subtype'))))return null;if(nameOf(f?.get?.('Encoding'))!=='Identity-H')return null;return parseCMap(f?.get?.('ToUnicode'))}catch(_){return null}}
function codeHex(ch,cmap){const c=cmap.rev.get(ch);return c==null?null:Number(c).toString(16).padStart(4,'0').toUpperCase()}
function encodeExact(text,cmap){let out='';for(const ch of String(text||'')){const h=codeHex(ch,cmap);if(!h)return null;out+=h}return out}
function spaceVariants(text,cmap){const parts=String(text||'').split(/( +)/);let variants=[''];for(const part of parts){if(!part)continue;if(/^ +$/.test(part)){const sh=codeHex(' ',cmap);if(!sh)return[];const next=[];for(const base of variants)for(let n=1;n<=MAX_SPACE_RUN;n++)next.push(base+sh.repeat(n));variants=next;if(variants.length>MAX_VARIANTS_PER_FONT)return[]}else{const h=encodeExact(part,cmap);if(!h)return[];variants=variants.map(v=>v+h)}}return[...new Set(variants)]}
function resourceFonts(page){const out=[];try{const po=page.getObject(),res=resolve(po.getInheritable?.('Resources')||po.get?.('Resources')),fonts=resolve(res?.get?.('Font'));if(!fonts?.isDictionary?.())return out;fonts.forEach((a,b)=>{let key=null,ref=null;const av=typeof a==='string'?a:String(a?.valueOf?.()??''),bv=typeof b==='string'?b:String(b?.valueOf?.()??'');if(typeof a==='string'||(/^\/?[A-Za-z0-9_.-]+$/.test(av)&&b&&typeof b==='object')){key=av;ref=b}else{key=bv;ref=a}key=String(key||'').replace(/^\//,'');if(key&&ref)out.push({name:key,ref})})}catch(_){}return out}
function fontPatterns(page,needle,replacement){const raw=[];for(const f of resourceFonts(page)){const cmap=type0IdentityHCMap(f.ref);if(!cmap)continue;const repl=encodeExact(replacement,cmap);if(!repl)continue;for(const find of spaceVariants(needle,cmap))raw.push({fontName:f.name,findHex:find,replaceHex:repl})}
  const by=new Map();let ambiguous=false;for(const p of raw){const key=p.findHex.toUpperCase(),val=p.replaceHex.toUpperCase();if(!by.has(key))by.set(key,{findHex:key,replaceHex:val,fontNames:new Set([p.fontName])});else{const q=by.get(key);if(q.replaceHex!==val)ambiguous=true;q.fontNames.add(p.fontName)}}
  return{ambiguous,patterns:[...by.values()].map(p=>({...p,fontNames:[...p.fontNames],findToken:enc.encode('<'+p.findHex+'>'),replaceToken:enc.encode('<'+p.replaceHex+'>')}))}}

function upperAscii(b){return b>=97&&b<=102?b-32:b}
function matchAt(buf,pat,i){if(i+pat.length>buf.length)return false;for(let j=0;j<pat.length;j++)if(upperAscii(buf[i+j])!==upperAscii(pat[j]))return false;return true}
function findAll(buf,pat,maxStart){const out=[];for(let i=0;i<Math.min(maxStart,buf.length-pat.length+1);i++)if(matchAt(buf,pat,i)){out.push(i);i+=pat.length-1}return out}
function patternGroups(patterns){const by=new Map();for(const p of patterns){const n=Math.min(17,p.findToken.length),a=p.findToken.subarray(0,n),key=asText(a);if(!by.has(key))by.set(key,{anchor:a,patterns:[]});by.get(key).patterns.push(p)}return[...by.values()]}
function tokenBoundaryBefore(buf,i){return i<=0||delim(buf[i-1])}
function proveWindow(window,relStart,relEnd,fontNames){if(!tokenBoundaryBefore(window,relStart))return false;const suffix=asText(window.subarray(relEnd,Math.min(window.length,relEnd+AFTER_BYTES)));if(!/^\s*Tj(?=\s|$|[<>\[\]()\/%])/.test(suffix))return false;const prefix=asText(window.subarray(0,relStart));const ops=[...prefix.matchAll(/(?:^|[\s<>\[\]()])(?:BT|ET)(?=$|[\s<>\[\]()])/g)];if(!ops.length)return false;const last=ops.at(-1);const op=/BT/.test(last[0])?'BT':'ET';if(op!=='BT')return false;const scope=prefix.slice(last.index+last[0].lastIndexOf('BT')+2);if(scope.length>MAX_CONTEXT_BYTES)return false;if(/(?:^|\s)(?:BI|ID|EI)(?=\s|$)/.test(scope))return false;const tf=[...scope.matchAll(/\/([A-Za-z0-9_.-]+)\s+[-+]?(?:\d+(?:\.\d*)?|\.\d+)\s+Tf(?=\s|$)/g)];if(!tf.length)return false;return fontNames.includes(tf.at(-1)[1])}
function concat2(a,b){if(!a.length)return b instanceof Uint8Array?b:new Uint8Array(b);const bb=b instanceof Uint8Array?b:new Uint8Array(b),o=new Uint8Array(a.length+bb.length);o.set(a);o.set(bb,a.length);return o}
function coalesceTransform(size=4*1024*1024){let parts=[],total=0;function emit(controller,force=false){if(!force&&total<size)return;const out=new Uint8Array(total);let at=0;for(const p of parts){out.set(p,at);at+=p.length}parts=[];total=0;controller.enqueue(out)}return new TransformStream({transform(chunk,controller){const c=chunk instanceof Uint8Array?chunk:new Uint8Array(chunk);parts.push(c);total+=c.length;if(total>=size)emit(controller,true)},flush(controller){if(total)emit(controller,true)}})}
function makeStructuralReplaceTransform(patterns){const groups=patternGroups(patterns),maxPat=Math.max(...patterns.map(p=>p.findToken.length)),tailKeep=maxPat+AFTER_BYTES;let tail=new Uint8Array(0),history=new Uint8Array(0),rawHits=0,proven=0;
  function contextFor(data,at){const before=data.subarray(0,at);if(before.length>=MAX_CONTEXT_BYTES)return before.subarray(before.length-MAX_CONTEXT_BYTES);const need=MAX_CONTEXT_BYTES-before.length,pre=history.subarray(Math.max(0,history.length-need)),out=new Uint8Array(pre.length+before.length);out.set(pre);out.set(before,pre.length);return out}
  function process(data,emitLimit,controller,flush=false){const hits=[];for(const g of groups)for(const at of findAll(data,g.anchor,flush?data.length:emitLimit)){const p=g.patterns.find(x=>matchAt(data,x.findToken,at));if(!p)continue;const end=at+p.findToken.length;if(!flush&&end+AFTER_BYTES>data.length)continue;rawHits++;const pre=contextFor(data,at),post=data.subarray(at,Math.min(data.length,end+AFTER_BYTES)),win=new Uint8Array(pre.length+post.length);win.set(pre);win.set(post,pre.length);const relStart=pre.length,relEnd=relStart+p.findToken.length;if(proveWindow(win,relStart,relEnd,p.fontNames)){hits.push({at,end,p});proven++}}
    hits.sort((a,b)=>a.at-b.at);let pos=0;for(const h of hits){if(h.at<pos)continue;if(h.at>pos)controller.enqueue(data.subarray(pos,h.at));controller.enqueue(h.p.replaceToken);pos=h.end}if(emitLimit>pos)controller.enqueue(data.subarray(pos,emitLimit));
    const emittedOriginal=data.subarray(0,emitLimit);if(emittedOriginal.length>=MAX_CONTEXT_BYTES)history=emittedOriginal.slice(emittedOriginal.length-MAX_CONTEXT_BYTES);else if(emittedOriginal.length){const h0=history.subarray(Math.max(0,history.length-(MAX_CONTEXT_BYTES-emittedOriginal.length))),joined=new Uint8Array(h0.length+emittedOriginal.length);joined.set(h0);joined.set(emittedOriginal,h0.length);history=joined}return data.slice(emitLimit)}
  const stream=new TransformStream({transform(chunk,controller){const data=concat2(tail,chunk),emitLimit=Math.max(0,data.length-tailKeep);tail=process(data,emitLimit,controller,false)},flush(controller){tail=process(tail,tail.length,controller,true);if(tail.length)controller.enqueue(tail);tail=new Uint8Array(0)}});return{stream,rawHits:()=>rawHits,proven:()=>proven}}
async function transformRawStructural(raw,patterns){if(typeof DecompressionStream!=='function'||typeof CompressionStream!=='function'||typeof TransformStream!=='function')throw new Error('El navegador no dispone de compresión por streaming.');const source=U(raw);const input=new Blob([source]).stream();const repl=makeStructuralReplaceTransform(patterns);const compressed=input.pipeThrough(new DecompressionStream('deflate')).pipeThrough(coalesceTransform()).pipeThrough(repl.stream).pipeThrough(new CompressionStream('deflate')),reader=compressed.getReader(),parts=[];let total=0;while(true){const{value,done}=await reader.read();if(done)break;const chunk=value instanceof Uint8Array?value:new Uint8Array(value);total+=chunk.length;if(total>MAX_RAW_OUTPUT_BYTES)throw new Error(`Salida comprimida demasiado grande (${(total/1048576).toFixed(1)} MB).`);parts.push(chunk)}const out=new Uint8Array(total);let at=0;for(const part of parts){out.set(part,at);at+=part.length}return{bytes:out,count:repl.proven(),rawHits:repl.rawHits()}}

function perf(action,stage,extra={}){try{window.__performanceDiagnostic?.({scope:'apply',action,stage,...extra})}catch(_){}}
function crumb(stage,extra={}){try{localStorage.setItem('pdf_tools_heavy_text_breadcrumb_v2',JSON.stringify({at:new Date().toISOString(),stage,...extra}))}catch(_){}}

export async function editHeavyTextFlate(doc,needle,replacement,expected=0,fileName=''){
  const stage='texto PDF · Type0 Flate streaming probado',key=`heavy-type0::${fileName}::${needle}`;perf('start',stage,{key,file:fileName,find:needle,expected});crumb(stage+' · inicio',{file:fileName,find:needle,expected});
  try{const candidates=[];for(let pi=0;pi<doc.countPages();pi++){const page=doc.loadPage(pi),fp=fontPatterns(page,needle,replacement);if(fp.ambiguous){const reason='codificación Type0 ambigua entre fuentes';return{count:0,verified:false,reason}}const patterns=fp.patterns;if(!patterns.length)continue;for(const ref of contentRefs(page)){const st=streamRef(ref);if(!st||!isPlainFlate(st))continue;const len=rawLength(st);if(len<RAW_STREAM_MIN_BYTES)continue;candidates.push({st,patterns,page:pi+1,rawLength:len})}}
    if(!candidates.length){const reason='sin stream Type0/Identity-H Flate pesado compatible';perf('end',stage,{key,file:fileName,applied:0,warning:reason});return{count:0,verified:false,reason}}
    const pending=[];let total=0,rawOutput=0;for(const c of candidates){const raw=U(c.st.readRawStream()),result=await transformRawStructural(raw,c.patterns);if(result.rawHits!==result.count){const reason=`secuencias CID=${result.rawHits}, Tj estructuralmente probados=${result.count}; no se modifica el PDF`;return{count:0,verified:false,found:result.count,reason}}total+=result.count;rawOutput+=Number(result.bytes?.byteLength||0);if(rawOutput>MAX_RAW_OUTPUT_BYTES)throw new Error('Presupuesto de memoria de salida excedido.');pending.push({st:c.st,bytes:result.bytes,count:result.count,page:c.page})}
    if(total!==Number(expected||0)){const reason=`Tj Type0 probados=${total}, esperados=${Number(expected||0)}; no se modifica el PDF`;perf('end',stage,{key,file:fileName,expected,applied:0,found:total,warning:reason});crumb(stage+' · no aplicado',{file:fileName,reason});return{count:0,verified:false,found:total,reason}}
    for(const p of pending)if(p.count>0&&p.bytes)p.st.writeRawStream(p.bytes);perf('end',stage,{key,file:fileName,expected,applied:total,found:total});crumb(stage+' · aplicado',{file:fileName,applied:total});return{count:total,verified:true,found:total,source:'type0-identityh-tj-flate-v1'}
  }catch(error){const reason=error?.message||String(error);perf('end',stage,{key,file:fileName,expected,applied:0,warning:reason});crumb(stage+' · error',{file:fileName,reason});return{count:0,verified:false,reason}}
}