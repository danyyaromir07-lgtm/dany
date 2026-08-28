// Batch empty replacement for Adobe FillSign text Form XObjects.
// Plans all eligible rules against pristine streams and writes each stream once.
// Matching mirrors flexible analysis for whitespace/hyphen variants while preserving case.
const FLEX=/[\s\u00a0\u2000-\u200b\u2028\u2029\u202f\u205f\u3000‐‑‒–—−-]/u;
const U=b=>b?.asUint8Array?.()||b;
const A=b=>{const u=U(b);let s='';for(let i=0;i<u.length;i+=0x8000)s+=String.fromCharCode(...u.subarray(i,Math.min(u.length,i+0x8000)));return s};
const rawBytes=s=>{const t=String(s),o=new Uint8Array(t.length);for(let i=0;i<t.length;i++)o[i]=t.charCodeAt(i)&255;return o};
const resolve=o=>{try{return o?.resolve?.()||o}catch(_){return o}};
const nameOf=o=>{const r=resolve(o);try{if(r?.isName?.())return String(r.asName?.()||r.valueOf?.()||'').replace(/^\//,'')}catch(_){}return String(r?.valueOf?.()??r??'').replace(/^\//,'')};
const isFlex=ch=>FLEX.test(String(ch||''));
const key=s=>{let out='';for(const ch of String(s||''))if(!isFlex(ch))out+=ch;return out};
function streamRef(o){try{if(o?.isStream?.())return o;const r=resolve(o);return r?.isStream?.()?r:null}catch(_){return null}}
function isFillSignText(form){try{const f=resolve(form),adbe=resolve(f?.get?.('ADBE_FillSign'));return nameOf(f?.get?.('Subtype'))==='Form'&&nameOf(adbe?.get?.('Subtype'))==='text'}catch(_){return false}}
function forms(doc){const out=[];let n=0;try{n=Number(doc.countObjects?.()||0)}catch(_){return out}for(let xref=1;xref<n;xref++){try{const f=streamRef(doc.newIndirect(xref,0));if(f&&isFillSignText(f))out.push({xref,form:f})}catch(_){}}return out}
function scanLiteral(s,i){let dep=1,j=i+1;while(j<s.length&&dep){if(s[j]==='\\'){j++;if(j<s.length&&s[j]==='\r'){j++;if(s[j]==='\n')j++}else if(j<s.length&&s[j]==='\n')j++;else j++;continue}if(s[j]==='(')dep++;else if(s[j]===')')dep--;j++}return dep===0?j:-1}
function decodeChars(raw,base,tokenIndex){const out=[];for(let i=1;i<raw.length-1;){let rs=i,c=raw.charCodeAt(i)&255,emit=null;if(c!==92){emit=new TextDecoder('windows-1252').decode(new Uint8Array([c]));i++}else{const slash=i;i++;if(i>=raw.length-1)break;c=raw.charCodeAt(i)&255;if(c===13){i++;if(i<raw.length-1&&raw.charCodeAt(i)===10)i++;continue}if(c===10){i++;continue}if(c===110){emit='\n';i++}else if(c===114){emit='\r';i++}else if(c===116){emit='\t';i++}else if(c===98){emit='\b';i++}else if(c===102){emit='\f';i++}else if(c===40||c===41||c===92){emit=String.fromCharCode(c);i++}else if(c>=48&&c<=55){let v=c-48;i++;for(let q=0;q<2&&i<raw.length-1;q++){const d=raw.charCodeAt(i)&255;if(d<48||d>55)break;v=v*8+d-48;i++}emit=new TextDecoder('windows-1252').decode(new Uint8Array([v&255]))}else{emit=new TextDecoder('windows-1252').decode(new Uint8Array([c]));i++}rs=slash}if(emit!=null)out.push({ch:emit,start:base+rs,end:base+i,tokenIndex})}return out}
function tokens(text){const out=[];let i=0,idx=0;while(i<text.length){if(text[i]!=='('){i++;continue}const end=scanLiteral(text,i);if(end<0)break;let j=end;while(j<text.length&&/\s/.test(text[j]))j++;if(text.slice(j,j+2)==='Tj')out.push({index:idx,chars:decodeChars(text.slice(i,end),i,idx++)});i=end}return out}
function normalized(ts){let text='',map=[];for(const t of ts)for(const c of t.chars)if(!isFlex(c.ch)){text+=c.ch;map.push(c)}return{text,map}}
function tokenCharIndex(t,c){for(let i=0;i<t.chars.length;i++)if(t.chars[i]===c)return i;return-1}
function rangesForMatch(ts,map,start,len,find){const chosen=map.slice(start,start+len);if(!chosen.length)return[];const by=new Map();for(const c of chosen){const cur=by.get(c.tokenIndex);if(!cur)by.set(c.tokenIndex,[c.start,c.end,c,c]);else{cur[0]=Math.min(cur[0],c.start);cur[1]=Math.max(cur[1],c.end);cur[2]=cur[2].start<=c.start?cur[2]:c;cur[3]=cur[3].end>=c.end?cur[3]:c}}
  const first=chosen[0],last=chosen[chosen.length-1],fs=String(find||'');
  if(isFlex(fs[0])){const t=ts[first.tokenIndex],r=by.get(first.tokenIndex);let q=tokenCharIndex(t,first)-1;while(q>=0&&isFlex(t.chars[q].ch)){r[0]=t.chars[q].start;q--}}
  if(isFlex(fs[fs.length-1])){const t=ts[last.tokenIndex],r=by.get(last.tokenIndex);let q=tokenCharIndex(t,last)+1;while(q<t.chars.length&&isFlex(t.chars[q].ch)){r[1]=t.chars[q].end;q++}}
  return[...by.values()].map(r=>[r[0],r[1]])}
function patch(text,ranges){const uniq=[];for(const r of ranges.sort((a,b)=>a[0]-b[0])){const last=uniq[uniq.length-1];if(last&&r[0]<=last[1])last[1]=Math.max(last[1],r[1]);else uniq.push([r[0],r[1]])}let out=text;for(let i=uniq.length-1;i>=0;i--)out=out.slice(0,uniq[i][0])+out.slice(uniq[i][1]);return out}
function analyzeForm(text,rules){const ts=tokens(text),n=normalized(ts),counts=rules.map(()=>0),ranges=rules.map(()=>[]);for(let ri=0;ri<rules.length;ri++){const target=key(rules[ri]?.find);if(!target)continue;let p=0;while((p=n.text.indexOf(target,p))>=0){counts[ri]++;ranges[ri].push(...rangesForMatch(ts,n.map,p,target.length,rules[ri].find));p+=Math.max(1,target.length)}}return{counts,ranges}}
export function countFillSignRules(doc,rules){const totals=rules.map(()=>0);for(const {form} of forms(doc)){let text='';try{text=A(form.readStream())}catch(_){continue}const a=analyzeForm(text,rules);for(let i=0;i<totals.length;i++)totals[i]+=a.counts[i]}return totals}
export function applyFillSignRules(doc,rules){const fs=forms(doc),plans=[],totals=rules.map(()=>0);for(const x of fs){let text='';try{text=A(x.form.readStream())}catch(_){continue}const a=analyzeForm(text,rules);plans.push({...x,text,a});for(let i=0;i<totals.length;i++)totals[i]+=a.counts[i]}
  const eligible=rules.map((r,i)=>Math.max(0,Number(r?.count||0))>0&&totals[i]===Math.max(0,Number(r?.count||0)));
  for(const p of plans){const rr=[];for(let i=0;i<rules.length;i++)if(eligible[i])rr.push(...p.a.ranges[i]);if(rr.length)p.form.writeStream(rawBytes(patch(p.text,rr)))}
  return{eligible,counts:totals,applied:eligible.reduce((n,x,i)=>n+(x?totals[i]:0),0)}
}
if(typeof window!=='undefined')window.__fillSignBatchEmptyV18={version:'v18-batch-flex-tj1'};
