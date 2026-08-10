import * as mupdf from 'https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js';

const findInput=document.querySelector('#findText');
const replaceInput=document.querySelector('#replaceText');
const fileInput=document.querySelector('#textFileInput');
const processBtn=document.querySelector('#textProcessBtn');
const clearBtn=document.querySelector('#textClearBtn');
const status=document.querySelector('#textStatus');
const summary=document.querySelector('#textSummary');
const results=document.querySelector('#textResults');
const openBtn=document.querySelector('#textOpenBtn');

const resolve=o=>{try{return o?.resolve?.()||o}catch(_){return o}};
const ascii=b=>{let s='';for(const x of b)s+=String.fromCharCode(x);return s};
const hexBytes=h=>{h=h.replace(/\s+/g,'');if(h.length%2)h+='0';return Uint8Array.from(h.match(/../g)?.map(x=>parseInt(x,16))||[])};
function hexUnicode(h){const b=hexBytes(h);if(!b.length)return '';if(b.length%2===0){let s='';for(let i=0;i<b.length;i+=2)s+=String.fromCharCode((b[i]<<8)|b[i+1]);return s}return String.fromCodePoint(parseInt(h,16));}
function ws(x){return x===0||x===9||x===10||x===12||x===13||x===32}
function delim(x){return ws(x)||x===40||x===41||x===60||x===62||x===91||x===93||x===123||x===125||x===47||x===37}

function tokenize(data,start=0,end=data.length){
  const a=[];let i=start;
  while(i<end){
    while(i<end&&ws(data[i]))i++;if(i>=end)break;
    if(data[i]===37){while(i<end&&data[i]!==10&&data[i]!==13)i++;continue}
    const s=i,b=data[i];
    if(b===40){i++;let d=1;while(i<end&&d){if(data[i]===92)i+=2;else{if(data[i]===40)d++;else if(data[i]===41)d--;i++}}a.push({type:'string',start:s,end:i,raw:data.slice(s,i),kind:'literal'});continue}
    if(b===60&&data[i+1]!==60){i++;while(i<end&&data[i]!==62)i++;if(i<end)i++;a.push({type:'string',start:s,end:i,raw:data.slice(s,i),kind:'hex'});continue}
    if(b===91){i++;const q=i;let d=1;while(i<end&&d){if(data[i]===91)d++;else if(data[i]===93)d--;i++}a.push({type:'array',start:s,end:i,raw:data.slice(s,i),items:tokenize(data,q,i-1)});continue}
    if(b===47){i++;while(i<end&&!delim(data[i]))i++;a.push({type:'name',start:s,end:i,raw:data.slice(s,i)});continue}
    while(i<end&&!delim(data[i]))i++;a.push({type:'word',start:s,end:i,raw:data.slice(s,i)})
  }
  return a;
}

function parseCMap(obj){
  obj=resolve(obj);if(!obj?.isStream?.())return null;
  const t=ascii(obj.readStream()),map=new Map();
  const cs=t.match(/begincodespacerange([\s\S]*?)endcodespacerange/);
  let codeBytes=1;
  if(cs){const m=cs[1].match(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/);if(m)codeBytes=Math.max(1,Math.ceil(m[1].length/2))}
  const bfchar=t.match(/beginbfchar([\s\S]*?)endbfchar/);
  if(bfchar){for(const m of bfchar[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g))map.set(parseInt(m[1],16),hexUnicode(m[2]))}
  const bfrange=t.match(/beginbfrange([\s\S]*?)endbfrange/);
  if(bfrange){
    for(const m of bfrange[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*([^\s]+)/g)){
      const a=parseInt(m[1],16),b=parseInt(m[2],16),dst=m[3];
      if(dst.startsWith('<')&&dst.endsWith('>')){const base=parseInt(dst.slice(1,-1),16);for(let c=a;c<=b;c++)map.set(c,String.fromCodePoint(base+c-a))}
    }
  }
  if(!map.size)return null;
  return {map,reverse:new Map([...map].flatMap(([k,v])=>[...v].map(ch=>[ch,k]))),codeBytes};
}

function fontMaps(page){
  const po=page.getObject?.()||page;
  const resources=resolve(po.getInheritable?.('Resources')||po.get?.('Resources'));
  const fonts=resolve(resources?.get?.('Font'));
  const out=new Map();
  if(!fonts?.isDictionary?.())return out;
  fonts.forEach((value,key)=>{
    try{
      const name=String(key),font=resolve(value);
      let c=parseCMap(font?.get?.('ToUnicode'));
      if(!c){const ds=resolve(font?.get?.('DescendantFonts'));if(ds?.isArray?.()&&ds.length)c=parseCMap(resolve(ds.get(0))?.get?.('ToUnicode'))}
      if(c)out.set(name,c);
    }catch(_){ }
  });
  return out;
}

function decodeString(tok,c){
  let bytes;
  if(tok.kind==='hex')bytes=hexBytes(ascii(tok.raw.slice(1,-1)));
  else{
    const a=[];
    for(let i=1;i<tok.raw.length-1;i++){
      let b=tok.raw.charCodeAt(i);if(b!==92){a.push(b);continue}
      i++;const x=tok.raw.charCodeAt(i);
      if(x===110)a.push(10);else if(x===114)a.push(13);else if(x===116)a.push(9);else if(x===98)a.push(8);else if(x===102)a.push(12);else if(x===40||x===41||x===92)a.push(x);
      else if(x>=48&&x<=55){let v=x-48;for(let k=0;k<2&&i+1<tok.raw.length-1&&tok.raw.charCodeAt(i+1)>=48&&tok.raw.charCodeAt(i+1)<=55;k++){i++;v=v*8+tok.raw.charCodeAt(i)-48}a.push(v)}else a.push(x);
    }
    bytes=Uint8Array.from(a);
  }
  const chars=[];
  for(let i=0;i+c.codeBytes<=bytes.length;i+=c.codeBytes){let v=0;for(let j=0;j<c.codeBytes;j++)v=(v<<8)|bytes[i+j];chars.push(c.map.get(v)||'�')}
  return chars.join('');
}

function encodeText(text,c){
  const a=[];
  for(const ch of text){const v=c.reverse.get(ch);if(v==null)throw Error(`El carácter «${ch}» no existe en la codificación de la fuente original.`);for(let s=c.codeBytes-1;s>=0;s--)a.push((v>>(8*s))&255)}
  return `<${a.map(x=>x.toString(16).padStart(2,'0')).join('')}>`;
}

function findInText(text,needle){
  let i=text.indexOf(needle);if(i>=0)return[i,i+needle.length];
  const norm=text.replace(/\s+/g,' '),n=needle.replace(/\s+/g,' '),j=norm.indexOf(n);if(j<0)return null;
  let p=0,s=-1,e=-1;for(let k=0;k<text.length;k++){if(/\s/.test(text[k]))continue;if(p===j&&s<0)s=k;if(p===j+n.length){e=k;break}p++}
  return[s<0?0:s,e<0?text.length:e];
}

function editStream(bytes,needle,repl,maps){
  const data=new Uint8Array(bytes),ts=tokenize(data),edits=[];let font=null,foundText=false;
  for(let i=0;i<ts.length;i++){
    const t=ts[i];
    if(t.type==='word'&&ascii(t.raw)==='Tf'){const n=ts[i-2];if(n?.type==='name')font=ascii(n.raw).slice(1);continue}
    if(t.type!=='word')continue;
    const op=ascii(t.raw),c=maps.get(font);if(!c)continue;
    if(op==='Tj'){
      const s=ts[i-1];if(!s||s.type!=='string')continue;
      const text=decodeString(s,c),m=findInText(text,needle);if(!m)continue;
      foundText=true;s.replacement=encodeText(text.slice(0,m[0])+repl+text.slice(m[1]),c);edits.push(s);
    }else if(op==='TJ'){
      const arr=ts[i-1];if(!arr||arr.type!=='array')continue;
      const parts=[];let full='';
      for(const s of arr.items.filter(x=>x.type==='string')){const text=decodeString(s,c);parts.push({s,text,start:full.length,end:full.length+text.length});full+=text}
      const m=findInText(full,needle);if(!m)continue;
      foundText=true;
      let first=-1,last=-1;for(let k=0;k<parts.length;k++){if(m[0]<parts[k].end&&m[1]>parts[k].start){if(first<0)first=k;last=k}}
      if(first<0)continue;
      if(first===last){const p=parts[first],localA=m[0]-p.start,localB=m[1]-p.start;p.s.replacement=encodeText(p.text.slice(0,localA)+repl+p.text.slice(localB),c);edits.push(p.s)}
      else{
        const a=parts[first],z=parts[last];a.s.replacement=encodeText(a.text.slice(0,m[0]-a.start)+repl,c);z.s.replacement=encodeText(z.text.slice(m[1]-z.start),c);
        for(let k=first+1;k<last;k++)parts[k].s.replacement='<> ';
        edits.push(a.s,z.s,...parts.slice(first+1,last).map(x=>x.s));
      }
    }
  }
  if(!edits.length)return{bytes:data,count:0,foundText};
  const seen=new Set(),parts=[],encoder=new TextEncoder();let pos=0;
  for(const t of ts){if(t.replacement===undefined||seen.has(t))continue;seen.add(t);parts.push(data.slice(pos,t.start),encoder.encode(t.replacement));pos=t.end}
  parts.push(data.slice(pos));const n=parts.reduce((q,x)=>q+x.length,0),out=new Uint8Array(n);let o=0;for(const p of parts){out.set(p,o);o+=p.length}
  return{bytes:out,count:seen.size,foundText:true};
}

function editDoc(doc,needle,repl){
  let count=0,found=false;
  for(let i=0;i<doc.countPages();i++){
    const page=doc.findPage(i),maps=fontMaps(page),po=page.getObject?.()||page,co=po.get?.('Contents');if(!co||co.isNull?.())continue;
    const refs=co.isArray?.()?Array.from({length:co.length},(_,k)=>co.get(k)):[co];
    for(const ref of refs){if(!ref?.isStream?.())continue;const z=editStream(ref.readStream(),needle,repl,maps);if(z.count){ref.writeStream(z.bytes);count+=z.count}if(z.foundText)found=true}
  }
  return{count,found};
}

function addResult(name,msg,error=false){const row=document.createElement('div');row.className=`result-row${error?' error':''}`;const a=document.createElement('span');a.className='filename';a.textContent=name;const b=document.createElement('span');b.className='count';b.textContent=msg;row.append(a,b);results.appendChild(row)}
function sync(){processBtn.disabled=!findInput.value.trim()||!fileInput.files.length}
openBtn.addEventListener('click',()=>fileInput.click());
findInput.addEventListener('input',sync);replaceInput.addEventListener('input',sync);fileInput.addEventListener('change',sync);sync();

async function run(){
  const needle=findInput.value,repl=replaceInput.value,files=[...fileInput.files];if(!needle.trim()||!files.length)return;processBtn.disabled=true;results.innerHTML='';summary.classList.add('hidden');let total=0,modified=0,failed=0;
  for(const file of files){try{status.textContent=`Editando ${file.name}…`;const bytes=new Uint8Array(await file.arrayBuffer()),doc=mupdf.PDFDocument.openDocument(bytes,'application/pdf');try{const r=editDoc(doc,needle,repl);if(!r.count){addResult(file.name,r.foundText?'Texto encontrado, pero no se pudo modificar el stream original':'Sin coincidencias');continue}const out=doc.saveToBuffer('garbage=2,compress=yes').asUint8Array(),u=URL.createObjectURL(new Blob([out],{type:'application/pdf'})),a=document.createElement('a');a.href=u;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(u),2000);total+=r.count;modified++;addResult(file.name,`${r.count} edición${r.count===1?'':'es'} aplicada · PDF descargado`)}finally{doc.destroy()}}catch(e){failed++;addResult(file.name,`Error: ${e?.message||e}`,true)}}summary.textContent=`${files.length-failed} PDF${files.length-failed===1?'':'s'} procesado${files.length-failed===1?'':'s'} · ${total} edición${total===1?'':'es'} aplicadas · ${modified} archivos modificados${failed?` · ${failed} con error`:''}`;summary.classList.remove('hidden');status.textContent=failed?`Proceso terminado con ${failed} error${failed===1?'':'es'}.`:'Proceso terminado correctamente.';sync();clearBtn.disabled=false}
processBtn.addEventListener('click',run);clearBtn.addEventListener('click',()=>{findInput.value='';replaceInput.value='';fileInput.value='';results.innerHTML='';summary.classList.add('hidden');status.textContent='';sync();clearBtn.disabled=true});
