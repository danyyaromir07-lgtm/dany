import * as mupdf from 'https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js';

const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[‐‑‒–—−]/g,'-').replace(/\s+/g,' ').trim().toLowerCase();
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

function quadPoints(q){
  const pts=[q?.ul,q?.ur,q?.ll,q?.lr].filter(p=>p&&Number.isFinite(Number(p.x))&&Number.isFinite(Number(p.y)));
  return pts.length?pts.map(p=>[Number(p.x),Number(p.y)]):[];
}
function hitGeometry(hit){
  const quads=Array.isArray(hit)?hit.flatMap(quadPoints):[];
  if(!quads.length)return null;
  const xs=quads.map(p=>p[0]),ys=quads.map(p=>p[1]);
  const bbox=[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];
  let dir=null;
  const q=Array.isArray(hit)&&hit[0];
  if(q?.ul&&q?.ur){const dx=Number(q.ur.x)-Number(q.ul.x),dy=Number(q.ur.y)-Number(q.ul.y);if(Math.hypot(dx,dy)>0.01)dir=[dx,dy];}
  return {bbox,dir};
}
function nearestRightAngle(dir){
  if(!dir)return 0;
  const angle=Math.atan2(-dir[1],dir[0])*180/Math.PI;
  const snapped=Math.round(angle/90)*90;
  return ((snapped%360)+360)%360;
}
function fontAdvance(font,text){let u=0;for(const ch of String(text||'')){const gid=font.encodeCharacter(ch);u+=font.advanceGlyph(gid,0)}return u}
function fitMetrics(font,text,raw,angle){
  const w=Math.max(1,raw[2]-raw[0]),h=Math.max(1,raw[3]-raw[1]);
  const major=(angle===90||angle===270)?h:w,minor=(angle===90||angle===270)?w:h;
  const advance=Math.max(0.01,fontAdvance(font,text));
  let size=Math.max(3,Math.min(minor*0.90,major*0.92/advance));
  if(!Number.isFinite(size))size=Math.max(3,minor*0.9);
  return {size:clamp(size,3,minor*1.05)};
}
function addFontResource(doc,page,name='FTextFallback'){
  const obj=page.getObject();
  let res=obj.get('Resources');
  if(!res||!res.isDictionary?.()){res=doc.newDictionary();obj.put('Resources',res)}
  let fonts=res.get('Font');
  if(!fonts||!fonts.isDictionary?.()){fonts=doc.newDictionary();res.put('Font',fonts)}
  const existing=fonts.get(name);
  if(!existing||existing.isNull?.())fonts.put(name,doc.addSimpleFont(new mupdf.Font('Helvetica'),'Latin'));
}
function asciiBytes(s){return new TextEncoder().encode(s)}
function pdfEscapeBytes(text){const out=[];for(const ch of String(text||'')){const c=ch.codePointAt(0);let b=c===0x20AC?0x80:c>=0xA0&&c<=0xFF?c:c>=0&&c<=0x7F?c:0x3F;if(b===0x28||b===0x29||b===0x5C)out.push(0x5C);out.push(b)}return new Uint8Array(out)}
function makeContent(doc,page,raw,text,angle,size){
  const H=page.getBounds()[3];
  const rad=angle*Math.PI/180,cs=Math.cos(rad),sn=Math.sin(rad);
  let x=raw[0],y=H-raw[3];
  if(angle===90){x=raw[0];y=H-raw[3]}
  else if(angle===180){x=raw[2];y=H-raw[1]}
  else if(angle===270){x=raw[2];y=H-raw[1]}
  return asciiBytes(`q BT /FTextFallback ${size.toFixed(3)} Tf ${cs.toFixed(6)} ${sn.toFixed(6)} ${(-sn).toFixed(6)} ${cs.toFixed(6)} ${x.toFixed(3)} ${y.toFixed(3)} Tm (`).constructor===Uint8Array
    ? new Uint8Array([...asciiBytes(`q BT /FTextFallback ${size.toFixed(3)} Tf ${cs.toFixed(6)} ${sn.toFixed(6)} ${(-sn).toFixed(6)} ${cs.toFixed(6)} ${x.toFixed(3)} ${y.toFixed(3)} Tm (`),...pdfEscapeBytes(text),...asciiBytes(') Tj ET Q')])
    : new Uint8Array();
}
function appendContent(doc,page,content){
  const obj=page.getObject(),stream=doc.addStream(content,{}),contents=obj.get('Contents');
  if(!contents||contents.isNull?.()){obj.put('Contents',stream);return}
  if(contents.isArray?.()){contents.push(stream);return}
  const arr=doc.newArray();arr.push(contents);arr.push(stream);obj.put('Contents',arr);
}
function applyRedactions(page,boxes){for(const box of boxes){const red=page.createAnnotation('Redact');red.setRect(box);try{red.setBorderWidth(0)}catch(_){}red.update()}page.applyRedactions(false,0);page.update()}

export function editTextByPageSearch(doc,target,replacement,maxHits=50){
  let count=0;const wanted=String(target||'').trim();if(!wanted)return 0;
  for(let pi=0;pi<doc.countPages()&&count<maxHits;pi++){
    const page=doc.loadPage(pi);let hits=[];
    try{hits=page.search(wanted,Math.min(50,maxHits-count))||[]}catch(_){hits=[]}
    if(!hits.length)continue;
    const items=[];
    for(const hit of hits){
      const g=hitGeometry(hit);if(!g)continue;
      let angle=nearestRightAngle(g.dir);
      const raw=g.bbox;const w=raw[2]-raw[0],h=raw[3]-raw[1];
      if(Math.max(w,h)>0 && Math.min(w,h)/Math.max(w,h)<0.45 && !g.dir){angle=h>w?90:0}
      const font=new mupdf.Font('Helvetica');const {size}=fitMetrics(font,replacement,raw,angle);
      items.push({page,raw,text:replacement,angle,size});
    }
    if(!items.length)continue;
    applyRedactions(page,items.map(x=>x.raw));
    addFontResource(doc,page);
    for(const item of items){appendContent(doc,item.page,makeContent(doc,item.page,item.raw,item.text,item.angle,item.size));count++}
  }
  return count;
}
