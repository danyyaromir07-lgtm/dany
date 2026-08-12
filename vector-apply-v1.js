import * as mupdf from 'https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js';

function clamp(n,a,b){return Math.max(a,Math.min(b,n))}
function expandBox(b,pad){return [b[0]-pad,b[1]-pad,b[2]+pad,b[3]+pad]}
function area(b){return Math.max(0,b[2]-b[0])*Math.max(0,b[3]-b[1])}

function fitSize(box,replacement,baseSize){
  const h=Math.max(1,box[3]-box[1]);
  let size=clamp(h*.82,4,baseSize||h*.82);
  const available=Math.max(1,box[2]-box[0]);
  const estimatedWidth=Math.max(1,replacement.length*size*.52);
  if(estimatedWidth>available*.96)size*=Math.max(.35,(available*.96)/estimatedWidth);
  return clamp(size,4,h*.95)
}
function createEditableReplacement(page,box,text,size){
  const a=page.createAnnotation('FreeText');
  a.setRect(box); a.setContents(text);
  try{a.setDefaultAppearance('Helv',Math.round(size),[0,0,0])}catch(_){}
  try{a.setBorderWidth(0)}catch(_){}
  try{a.setQuadding(0)}catch(_){}
  try{a.setOpacity(1)}catch(_){}
  a.update(); page.update(); return a;
}
function redactBox(page,box){
  const red=page.createAnnotation('Redact');
  red.setRect(box);
  try{red.setBorderWidth(0)}catch(_){}
  red.update();
  // Prefer the annotation-level API. MuPDF documents both this and the page-level API.
  if(typeof red.applyRedaction==='function'){
    red.applyRedaction(false,0,0,0);
    return;
  }
  if(typeof page.applyRedactions==='function'){
    page.applyRedactions(false,0);
    return;
  }
  throw new Error('La versión de MuPDF no expone applyRedaction(s).');
}
export function applyVectorOCR(doc,analysis){
  let count=0,preserved=new Set(),skipped=[];
  for(const r of analysis?.counts||[]){
    if((r.count||0)>0)continue;
    for(const m of r.ocrMatches||[]){
      if(!m?.bbox||!r.replace?.trim())continue;
      const confidence=Number(m.confidence||0), similarity=Number(m.similarity||0);
      if(confidence<20 || (similarity>0 && similarity<0.70)){
        skipped.push(`${r.find}: OCR descartado por confianza (${confidence.toFixed(0)}%, similitud ${similarity.toFixed(2)})`); continue;
      }
      try{
        const page=doc.loadPage(Math.max(0,(m.page||1)-1));
        const raw=m.bbox;
        const w=Math.max(1,raw[2]-raw[0]), h=Math.max(1,raw[3]-raw[1]);
        const pad=Math.min(1.2,Math.max(.25,h*.035));
        const box=expandBox(raw,pad);
        let pageBounds=null; try{pageBounds=page.getBounds()}catch(_){}
        if(area(box)<=0 || (pageBounds && (w>pageBounds[2]*.95 || h>pageBounds[3]*.5))){
          skipped.push(`${r.find}: área OCR no segura`); continue;
        }
        redactBox(page,box);
        const size=fitSize(raw,r.replace,h);
        const a=createEditableReplacement(page,raw,r.replace,size);
        preserved.add(a); count++;
      }catch(e){
        skipped.push(`${r.find}: ${e?.message||e}`);
      }
    }
  }
  return{count,preserved,skipped};
}
