import * as mupdf from 'https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js';

let workerPromise=null;
const norm=s=>String(s||'').replace(/[|]/g,' ').replace(/\s+/g,' ').trim().toLowerCase();
const compact=s=>norm(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');

async function getWorker(){
  if(workerPromise)return workerPromise;
  workerPromise=(async()=>{
    const {createWorker}=await import('https://esm.sh/tesseract.js@5.1.0');
    try{return await createWorker('spa+eng')}catch(e){console.warn('spa+eng OCR failed, using eng',e);return await createWorker('eng')}
  })().catch(e=>{workerPromise=null;throw e});
  return workerPromise;
}

function levenshtein(a,b){
  if(a===b)return 0;
  if(!a)return b.length;
  if(!b)return a.length;
  let prev=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){
    const cur=[i];
    for(let j=1;j<=b.length;j++)cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));
    prev=cur;
  }
  return prev[b.length];
}
function similarity(a,b){if(!a||!b)return 0;return 1-levenshtein(a,b)/Math.max(a.length,b.length)}

function targetMatches(data,target,scale){
  const wanted=norm(target), wantedCompact=compact(target);
  const words=(data?.words||[]).filter(w=>w?.text?.trim()&&w.bbox);
  if(!wanted||!words.length)return[];
  const out=[],seen=new Set();
  for(let i=0;i<words.length;i++){
    let text='',box=null,confidence=100;
    for(let j=i;j<Math.min(words.length,i+40);j++){
      const w=words[j],t=norm(w.text); if(!t)continue;
      text=text?`${text} ${t}`:t;
      box=box?[Math.min(box[0],w.bbox.x0),Math.min(box[1],w.bbox.y0),Math.max(box[2],w.bbox.x1),Math.max(box[3],w.bbox.y1)]:[w.bbox.x0,w.bbox.y0,w.bbox.x1,w.bbox.y1];
      confidence=Math.min(confidence,Number(w.confidence||0));
      const tc=compact(text);
      const exact=text===wanted||text.includes(wanted)||tc===wantedCompact||tc.includes(wantedCompact);
      const sim=similarity(tc,wantedCompact);
      const fuzzy=wantedCompact.length>=6&&sim>=0.76&&confidence>=30;
      if(exact||fuzzy){
        const key=`${Math.round(box[0])}:${Math.round(box[1])}:${Math.round(box[2])}:${Math.round(box[3])}`;
        if(!seen.has(key)){seen.add(key);out.push({bbox:box.map(v=>v/scale),confidence,similarity:sim,ocrText:text})}
        break;
      }
      if(tc.length>wantedCompact.length+64)break;
    }
  }
  return out;
}

async function recognizePage(page,target){
  const scale=3;
  const pix=page.toPixmap(mupdf.Matrix.scale(scale,scale),mupdf.ColorSpace.DeviceRGB,false,false);
  const worker=await getWorker();
  const res=await worker.recognize(new Blob([pix.asPNG()],{type:'image/png'}));
  return {boxes:targetMatches(res?.data,target,scale),text:res?.data?.text||''};
}

async function runRecognition(){
  const batch=window.__batchAnalysis;
  if(!Array.isArray(batch)||!batch.length)return;
  const status=document.querySelector('#batchStatus'),table=document.querySelector('#batchTable'),summary=document.querySelector('#batchSummary');
  let totalOcr=0,scannedPages=0;
  for(let ai=0;ai<batch.length;ai++){
    const a=batch[ai]; if(!a||a.error||!a.data)continue;
    const doc=mupdf.PDFDocument.openDocument(a.data,'application/pdf');
    try{
      const pages=doc.countPages();
      for(let pi=0;pi<pages;pi++){
        const page=doc.loadPage(pi); scannedPages++;
        if(status)status.textContent=`Reconociendo texto vectorial/OCR · ${ai+1}/${batch.length} · página ${pi+1}/${pages}`;
        for(const c of (a.counts||[])){
          if(!c.find?.trim())continue;
          try{
            const o=await recognizePage(page,c.find);
            if(!o.boxes.length)continue;
            c.ocrCount=(c.ocrCount||0)+o.boxes.length;
            c.ocrPages=c.ocrPages||[]; c.ocrMatches=c.ocrMatches||[];
            c.ocrPages.push(pi+1); c.ocrMatches.push(...o.boxes.map(b=>({...b,page:pi+1})));
            c.pages=c.pages||[]; if(!c.pages.includes(pi+1))c.pages.push(pi+1);
            totalOcr+=o.boxes.length;
          }catch(e){console.warn('OCR vectorial:',e)}
        }
        await new Promise(r=>setTimeout(r,0));
      }
    }finally{doc.destroy()}
  }
  const rows=[...(table?.querySelectorAll('.batch-result')||[])];
  batch.forEach((a,i)=>{
    const row=rows[i];if(!row||a.error)return;const span=row.querySelector(':scope > span');if(!span)return;
    const extras=(a.counts||[]).filter(c=>c.ocrCount).map(c=>`${c.ocrCount}× ${c.find} (vector/OCR)`);
    if(extras.length&&!span.textContent.includes('vector/OCR')){const btn=span.querySelector('button'),text=extras.join(' · ');if(btn)span.insertBefore(document.createTextNode(` · ${text} `),btn);else span.append(document.createTextNode(` · ${text}`))}
  });
  if(totalOcr){
    if(summary)summary.textContent+=` · ${totalOcr} coincidencia${totalOcr===1?'':'s'} vectorial${totalOcr===1?'':'es'}/OCR · ningún archivo modificado`;
    const stat=document.querySelector('#statEdits');if(stat){const n=parseInt(stat.textContent||'0',10)||0;stat.textContent=String(n+totalOcr)}
    if(status)status.textContent=`Reconocimiento terminado: ${totalOcr} coincidencia${totalOcr===1?'':'s'} vectorial${totalOcr===1?'':'es'} detectada${totalOcr===1?'':'s'} en ${scannedPages} página${scannedPages===1?'':'s'}. No se ha modificado ningún PDF.`;
  }else if(status)status.textContent=`Reconocimiento terminado: se revisaron ${scannedPages} página${scannedPages===1?'':'s'} con OCR y no hubo coincidencias con las sustituciones configuradas.`;
}

let lastBatch=null;
document.addEventListener('DOMContentLoaded',()=>{
  const btn=document.querySelector('#batchAnalyze');if(!btn)return;
  btn.addEventListener('click',()=>{if(lastBatch)clearTimeout(lastBatch);const started=Date.now();const wait=()=>{const a=window.__batchAnalysis;if(Array.isArray(a)&&a.length){runRecognition();return}if(Date.now()-started<120000)lastBatch=setTimeout(wait,250)};lastBatch=setTimeout(wait,300)});
});