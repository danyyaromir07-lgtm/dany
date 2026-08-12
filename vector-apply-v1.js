import * as mupdf from 'https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js';

function clamp(n,a,b){return Math.max(a,Math.min(b,n))}
function expandBox(b,pad){return [b[0]-pad,b[1]-pad,b[2]+pad,b[3]+pad]}
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
function pageBoundsSafe(page){try{return page.getBounds()}catch(_){return null}}

// Redactions must be applied at page level. We first create all redaction
// annotations for a page, apply them together, and only then add the editable
// replacement. This prevents the replacement FreeText from being affected by
// the same redaction operation.
function applyRedactions(page,boxes){
  for(const box of boxes){
    const red=page.createAnnotation('Redact');
    red.setRect(box);
    try{red.setBorderWidth(0)}catch(_){}
    red.update();
  }
  if(typeof page.applyRedactions!=='function')throw new Error('MuPDF no expone PDFPage.applyRedactions().');
  page.applyRedactions(false,0);
  page.update();
}

export function applyVectorOCR(doc,analysis){
  let count=0,preserved=new Set(),skipped=[];
  const byPage=new Map();
  for(const r of analysis?.counts||[]){
    if((r.count||0)>0)continue;
    for(const m of r.ocrMatches||[]){
      if(!m?.bbox||!r.replace?.trim())continue;
      const confidence=Number(m.confidence||0), similarity=Number(m.similarity||0);
      if(confidence<20 || (similarity>0 && similarity<0.70)){
        skipped.push(`${r.find}: OCR descartado por confianza (${confidence.toFixed(0)}%, similitud ${similarity.toFixed(2)})`); continue;
      }
      const pageNo=Math.max(1,Number(m.page||1));
      try{
        const page=doc.loadPage(pageNo-1);
        const raw=m.bbox;
        const w=Math.max(1,raw[2]-raw[0]), h=Math.max(1,raw[3]-raw[1]);
        const pad=Math.min(1.2,Math.max(.25,h*.035));
        const box=expandBox(raw,pad);
        const pb=pageBoundsSafe(page);
        if(w<=0||h<=0||(pb&&(box[0]<pb[0]-2||box[1]<pb[1]-2||box[2]>pb[2]+2||box[3]>pb[3]+2))){
          skipped.push(`${r.find}: bbox OCR fuera de los límites de la página`); continue;
        }
        const key=pageNo;
        if(!byPage.has(key))byPage.set(key,[]);
        byPage.get(key).push({page,box,raw,text:r.replace,size:fitSize(raw,r.replace,h),find:r.find});
      }catch(e){skipped.push(`${r.find}: ${e?.message||e}`)}
    }
  }
  for(const [pageNo,items] of byPage){
    try{
      applyRedactions(items[0].page,items.map(x=>x.box));
      for(const item of items){
        try{
          const a=createEditableReplacement(item.page,item.raw,item.text,item.size);
          preserved.add(a); count++;
        }catch(e){skipped.push(`${item.find}: no se pudo crear el texto editable (${e?.message||e})`)}
      }
    }catch(e){
      for(const item of items)skipped.push(`${item.find}: no se pudo aplicar la redacción (${e?.message||e})`);
    }
  }
  return{count,preserved,skipped};
}
