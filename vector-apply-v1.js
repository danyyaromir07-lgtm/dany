import * as mupdf from 'https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js';
function clamp(n,a,b){return Math.max(a,Math.min(b,n))}
function expandBox(b,padX,padY=padX){return [b[0]-padX,b[1]-padY,b[2]+padX,b[3]+padY]}
// Keep the replacement on ONE line. Do not estimate width by character count:
// the actual writer (pdf-lib) measures each glyph using the selected font.
// Here we only derive the initial size from the original glyph height.
function fitSize(box,replacement,baseSize){const h=Math.max(1,box[3]-box[1]);return clamp(baseSize||h*.82,4,h*.95)}
function pageBoundsSafe(page){try{return page.getBounds()}catch(_){return null}}
function applyRedactions(page,boxes){for(const box of boxes){const red=page.createAnnotation('Redact');red.setRect(box);try{red.setBorderWidth(0)}catch(_){}red.update()}if(typeof page.applyRedactions!=='function')throw new Error('MuPDF no expone PDFPage.applyRedactions().');page.applyRedactions(false,0);page.update()}
// Vector/OCR detection supplies the exact replacement placement. The replacement
// itself is written later into the PDF content stream, NOT as an annotation.
export function applyVectorOCR(doc,analysis){let count=0,skipped=[],replacements=[];const byPage=new Map();for(const r of analysis?.counts||[]){if((r.count||0)>0)continue;for(const m of r.ocrMatches||[]){if(!m?.bbox||!r.replace?.trim())continue;const confidence=Number(m.confidence||0),similarity=Number(m.similarity||0);if(confidence<20||(similarity>0&&similarity<.70)){skipped.push(`${r.find}: OCR descartado por confianza (${confidence.toFixed(0)}%, similitud ${similarity.toFixed(2)})`);continue}const pageNo=Math.max(1,Number(m.page||1));try{const page=doc.loadPage(pageNo-1),raw=m.bbox,w=Math.max(1,raw[2]-raw[0]),h=Math.max(1,raw[3]-raw[1]);
// The expansion removes the complete vector glyphs while staying deliberately
// bounded so nearby geometry is not modified.
const padX=Math.min(4.5,Math.max(1.2,h*.10)),padY=Math.min(4.5,Math.max(1.5,h*.14)),box=expandBox(raw,padX,padY),pb=pageBoundsSafe(page);if(w<=0||h<=0||(pb&&(box[0]<pb[0]-2||box[1]<pb[1]-2||box[2]>pb[2]+2||box[3]>pb[3]+2))){skipped.push(`${r.find}: bbox OCR fuera de los límites de la página`);continue}if(!byPage.has(pageNo))byPage.set(pageNo,[]);byPage.get(pageNo).push({page,box,raw,text:r.replace,size:fitSize(raw,r.replace,h),find:r.find})}catch(e){skipped.push(`${r.find}: ${e?.message||e}`)}}}for(const [pageNo,items] of byPage){try{applyRedactions(items[0].page,items.map(x=>x.box));for(const item of items){replacements.push({page:pageNo,bbox:item.raw,text:item.text,size:item.size,find:item.find});count++}}catch(e){for(const item of items)skipped.push(`${item.find}: no se pudo aplicar la redacción (${e?.message||e})`)}}return{count,preserved:new Set(),replacements,skipped}}
