import * as mupdf from 'https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js';

let workerPromise=null;
const norm=s=>String(s||'').replace(/[|]/g,' ').replace(/\s+/g,' ').trim().toLowerCase();

async function getWorker(){
  if(workerPromise)return workerPromise;
  workerPromise=(async()=>{
    const {createWorker}=await import('https://esm.sh/tesseract.js@5.1.0');
    return createWorker('spa+eng');
  })().catch(e=>{workerPromise=null;throw e});
  return workerPromise;
}

function boxesForTarget(data,target,scale){
  const wanted=norm(target), words=(data?.words||[]).filter(w=>w?.text?.trim()&&w.bbox);
  if(!wanted||!words.length)return[];
  const out=[];
  for(let i=0;i<words.length;i++){
    let text='', box=null;
    for(let j=i;j<Math.min(words.length,i+32);j++){
      const w=words[j], t=norm(w.text); if(!t)continue;
      text=text?`${text} ${t}`:t;
      box=box?[Math.min(box[0],w.bbox.x0),Math.min(box[1],w.bbox.y0),Math.max(box[2],w.bbox.x1),Math.max(box[3],w.bbox.y1)]:[w.bbox.x0,w.bbox.y0,w.bbox.x1,w.bbox.y1];
      if(text===wanted||text.includes(wanted)){
        out.push({bbox:box.map(v=>v/scale),confidence:Number(w.confidence||0)});break;
      }
      if(text.length>wanted.length+40)break;
    }
  }
  return out;
}

async function recognizePage(page,target){
  const scale=2;
  const pix=page.toPixmap(mupdf.Matrix.scale(scale,scale),mupdf.ColorSpace.DeviceRGB,false,false);
  const worker=await getWorker();
  const res=await worker.recognize(new Blob([pix.asPNG()],{type:'image/png'}));
  return boxesForTarget(res?.data,target,scale);
}

async function runRecognition(){
  const batch=window.__batchAnalysis;
  if(!Array.isArray(batch)||!batch.length)return;
  const status=document.querySelector('#batchStatus'), table=document.querySelector('#batchTable'), summary=document.querySelector('#batchSummary');
  let totalOcr=0;
  for(let ai=0;ai<batch.length;ai++){
    const a=batch[ai]; if(!a||a.error||!a.data)continue;
    const doc=mupdf.PDFDocument.openDocument(a.data,'application/pdf');
    try{
      const pages=doc.countPages();
      for(let pi=0;pi<pages;pi++){
        const page=doc.loadPage(pi);
        let hasVector=false;
        try{const dev=new mupdf.Device({fillPath(){hasVector=true},strokePath(){hasVector=true}});page.runPageContents(dev,mupdf.Matrix.identity);dev.close()}catch(_){ }
        if(!hasVector)continue;
        if(status)status.textContent=`Reconociendo texto vectorial · ${ai+1}/${batch.length} · página ${pi+1}/${pages}`;
        for(const c of (a.counts||[])){
          if(!c.find?.trim())continue;
          try{
            const boxes=await recognizePage(page,c.find);
            if(!boxes.length)continue;
            c.ocrCount=(c.ocrCount||0)+boxes.length;
            c.ocrPages=c.ocrPages||[];
            c.ocrMatches=c.ocrMatches||[];
            c.ocrPages.push(pi+1);
            c.ocrMatches.push(...boxes.map(b=>({...b,page:pi+1})));
            if(!c.pages?.length)c.pages=[];
            if(!c.pages.includes(pi+1))c.pages.push(pi+1);
            totalOcr+=boxes.length;
          }catch(e){console.warn('OCR vectorial:',e)}
        }
        await new Promise(r=>setTimeout(r,0));
      }
    }finally{doc.destroy()}
  }
  if(totalOcr){
    const rows=[...(table?.querySelectorAll('.batch-result')||[])];
    batch.forEach((a,i)=>{
      const row=rows[i]; if(!row||a.error)return;
      const span=row.querySelector(':scope > span'); if(!span)return;
      const extras=(a.counts||[]).filter(c=>c.ocrCount).map(c=>`${c.ocrCount}× ${c.find} (vector/OCR)`);
      if(extras.length&&!span.textContent.includes('vector/OCR')){
        const btn=span.querySelector('button');
        const text=extras.join(' · ');
        if(btn)span.insertBefore(document.createTextNode(` · ${text} `),btn);else span.append(document.createTextNode(` · ${text}`));
      }
    });
    if(summary)summary.textContent+=` · ${totalOcr} coincidencia${totalOcr===1?'':'s'} vectorial${totalOcr===1?'':'es'}/OCR · ningún archivo modificado`;
    const stat=document.querySelector('#statEdits');
    if(stat){const n=parseInt(stat.textContent||'0',10)||0;stat.textContent=String(n+totalOcr)}
  }
  if(status)status.textContent=totalOcr?`Reconocimiento terminado: ${totalOcr} coincidencia${totalOcr===1?'':'s'} vectorial${totalOcr===1?'':'es'} detectada${totalOcr===1?'':'s'}. No se ha modificado ningún PDF.`:'Reconocimiento terminado. No se encontraron coincidencias vectoriales para las sustituciones configuradas.';
}

let lastBatch=null;
document.addEventListener('DOMContentLoaded',()=>{
  const btn=document.querySelector('#batchAnalyze');
  if(!btn)return;
  btn.addEventListener('click',()=>{
    if(lastBatch)clearTimeout(lastBatch);
    const started=Date.now();
    const wait=()=>{
      const a=window.__batchAnalysis;
      if(Array.isArray(a)&&a.length){runRecognition();return}
      if(Date.now()-started<120000)lastBatch=setTimeout(wait,250);
    };
    lastBatch=setTimeout(wait,300);
  });
});
