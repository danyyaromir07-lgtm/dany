// v7 additive safety layer: keep structural transactional v6 unchanged, then neutralize
// only large TJ spacing values that split the replacement text inside a single TJ array.
import { editDoc as editV6 } from './text-editor-v65-safe-font-fallback-v6-structural.js?v=20260826-structural1';

const U=b=>b?.asUint8Array?.()||b;
const bytes=b=>{const u=U(b);return u instanceof Uint8Array?new Uint8Array(u):new Uint8Array(u||0)};
const A=b=>{const u=U(b);let s='';for(let i=0;i<u.length;i+=0x8000)s+=String.fromCharCode(...u.subarray(i,Math.min(u.length,i+0x8000)));return s};
const ascii=s=>new TextEncoder().encode(String(s));
const WS=new Set([0,9,10,12,13,32]);
const FLEX=/[\s\u00a0\u2000-\u200b\u2028\u2029\u202f\u205f\u3000]/gu;
const key=s=>String(s||'').replace(FLEX,'');
const resolve=o=>{try{return o?.resolve?.()||o}catch(_){return o}};
function streamRef(o){try{if(o?.isStream?.())return o;const r=resolve(o);return r?.isStream?.()?r:null}catch(_){return null}}
function contentRefs(page){try{const co=page.getObject()?.get?.('Contents');if(!co)return[];return co?.isArray?.()?Array.from({length:Number(co.length||0)},(_,i)=>co.get(i)):[co]}catch(_){return[]}}
function cat(parts){const n=parts.reduce((q,x)=>q+x.length,0),o=new Uint8Array(n);let p=0;for(const x of parts){o.set(x,p);p+=x.length}return o}
function scanLiteral(d,i,e){i++;let dep=1;while(i<e&&dep){if(d[i]===92){i+=2;continue}if(d[i]===40)dep++;else if(d[i]===41)dep--;i++}return i}
function scanHex(d,i,e){i++;while(i<e&&d[i]!==62)i++;return i<e?i+1:i}
function rawStringText(tok){
  const r=tok.raw;
  if(tok.kind==='hex'){
    let h=A(r.slice(1,-1)).replace(/\s+/g,'');if(h.length%2)h+='0';let s='';
    for(let i=0;i<h.length;i+=2){const v=parseInt(h.slice(i,i+2),16);if(!Number.isFinite(v))return null;s+=String.fromCharCode(v)}
    return s;
  }
  let s='';for(let i=1;i<r.length-1;i++){let x=r[i];if(x!==92){s+=String.fromCharCode(x);continue}x=r[++i];if(x===110)s+='\n';else if(x===114)s+='\r';else if(x===116)s+='\t';else if(x===98)s+='\b';else if(x===102)s+='\f';else if(x===40||x===41||x===92)s+=String.fromCharCode(x);else if(x>=48&&x<=55){let v=x-48;for(let q=0;q<2&&i+1<r.length-1&&r[i+1]>=48&&r[i+1]<=55;q++){i++;v=v*8+r[i]-48}s+=String.fromCharCode(v)}else s+=String.fromCharCode(x)}return s;
}
function parseTJArrays(data){
  const d=bytes(data),out=[];let i=0;
  while(i<d.length){
    if(d[i]!==91){if(d[i]===40){i=scanLiteral(d,i,d.length);continue}if(d[i]===60&&d[i+1]!==60){i=scanHex(d,i,d.length);continue}i++;continue}
    const start=i++,items=[];let depth=1;
    while(i<d.length&&depth){
      while(i<d.length&&WS.has(d[i]))i++;
      if(i>=d.length)break;
      const st=i,b=d[i];
      if(b===40){i=scanLiteral(d,i,d.length);items.push({type:'string',kind:'literal',start:st,end:i,raw:d.slice(st,i)});continue}
      if(b===60&&d[i+1]!==60){i=scanHex(d,i,d.length);items.push({type:'string',kind:'hex',start:st,end:i,raw:d.slice(st,i)});continue}
      if(b===91){depth++;i++;continue}
      if(b===93){depth--;i++;if(!depth)break;continue}
      while(i<d.length&&!WS.has(d[i])&&d[i]!==40&&d[i]!==41&&d[i]!==60&&d[i]!==62&&d[i]!==91&&d[i]!==93)i++;
      if(i>st)items.push({type:'word',start:st,end:i,raw:d.slice(st,i)});else i++;
    }
    if(depth)break;
    const endArray=i;let j=i;while(j<d.length&&WS.has(d[j]))j++;
    if(j+1<d.length&&d[j]===84&&d[j+1]===74)out.push({start,end:endArray,items});
    i=endArray;
  }
  return {d,arrays:out};
}
function normalizedTokenMap(strings){
  let joined='',ranges=[];
  for(const item of strings){const text=rawStringText(item);if(text==null)return null;const k=key(text),start=joined.length;joined+=k;ranges.push({item,start,end:joined.length})}
  return {joined,ranges};
}
function normalizeStreamTJSpacing(data,replacement){
  const target=key(replacement);if(!target)return{bytes:bytes(data),count:0};
  const {d,arrays}=parseTJArrays(data),changes=[];let count=0;
  for(const arr of arrays){
    const strings=arr.items.filter(x=>x.type==='string');if(strings.length<2)continue;
    const map=normalizedTokenMap(strings);if(!map||!map.joined.includes(target))continue;
    let pos=0;
    while((pos=map.joined.indexOf(target,pos))>=0){
      const end=pos+target.length;
      const touched=map.ranges.filter(r=>end>r.start&&pos<r.end);
      if(touched.length>1){
        const lo=touched[0].item.end,hi=touched[touched.length-1].item.start;
        for(const item of arr.items){
          if(item.type!=='word'||item.start<lo||item.end>hi)continue;
          const raw=A(item.raw),v=Number(raw);
          // Only neutralize clearly large positioning jumps. Small kerning is preserved.
          if(Number.isFinite(v)&&Math.abs(v)>=120)changes.push({start:item.start,end:item.end,replacement:ascii('0')});
        }
      }
      count++;pos=end;
    }
  }
  if(!changes.length)return{bytes:d,count:0};
  changes.sort((a,b)=>a.start-b.start);const uniq=[];for(const c of changes){const p=uniq[uniq.length-1];if(!p||c.start!==p.start||c.end!==p.end)uniq.push(c)}
  const parts=[];let p=0;for(const c of uniq){parts.push(d.slice(p,c.start),c.replacement);p=c.end}parts.push(d.slice(p));return{bytes:cat(parts),count:uniq.length};
}
function normalizeDocTJSpacing(doc,replacement){
  let changed=0;
  for(let pi=0;pi<doc.countPages();pi++){
    const page=doc.loadPage(pi);
    for(const ref of contentRefs(page)){
      const st=streamRef(ref);if(!st)continue;
      const z=normalizeStreamTJSpacing(st.readStream(),replacement);
      if(z.count){st.writeStream(z.bytes);changed+=z.count}
    }
  }
  return changed;
}
export function editDoc(doc,find,replace){
  const count=Number(editV6(doc,find,replace)||0);
  if(count>0){try{normalizeDocTJSpacing(doc,replace)}catch(_){/* v6 result remains intact */}}
  return count;
}
if(typeof window!=='undefined')window.__textEditorV65V7={version:'v7-tjspacing-largejump1'};
