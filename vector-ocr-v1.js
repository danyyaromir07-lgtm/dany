import * as mupdf from 'https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js';

let workerPromise=null;
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
const compact=s=>norm(s).replace(/[^a-z0-9]/g,'');

async function getWorker(){
  if(workerPromise)return workerPromise;
  workerPromise=(async()=>{
    const {createWorker}=await import('https://esm.sh/tesseract.js@5.1.0');
    const w=await createWorker('spa+eng');
    try{await w.setParameters({tessedit_pageseg_mode:'11'})}catch(_){ }
    return w;
  })().catch(e=>{workerPromise=null;throw e});
  return workerPromise;
}

function levenshtein(a,b){
  if(a===b)return 0;if(!a)return b.length;if(!b)return a.length;
  let p=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){const c=[i];for(let j=1;j<=b.length;j++)c[j]=Math.min(c[j-1]+1,p[j]+1,p[j-1]+(a[i-1]===b[j-1]?0:1));p=c}return p[b.length];
}
function similarity(a,b){return !a||!b?0:1-levenshtein(a,b)/Math.max(a.length,b.length)}

function matchWords(data,target,scale){
  const wanted=norm(target),wc=compact(target),words=(data?.words||[]).filter(w=>w?.text?.trim()&&w.bbox),out=[],seen=new Set();
  for(let i=0;i<words.length;i++){
    let text='',box=null,confidence=100;
    for(let j=i;j<Math.min(words.length,i+40);j++){
      const w=words[j],t=norm(w.text);if(!t)continue;
      text=text?`${text} ${t}`:t;
      box=box?[Math.min(box[0],w.bbox.x0),Math.min(box[1],w.bbox.y0),Math.max(box[2],w.bbox.x1),Math.max(box[3],w.bbox.y1)]:[w.bbox.x0,w.bbox.y0,w.bbox.x1,w.bbox.y1];
      confidence=Math.min(confidence,Number(w.confidence||0));
      const tc=compact(text), exact=text===wanted||text.includes(wanted)||tc===wc||tc.includes(wc), sim=similarity(tc,wc);
      if(exact||(wc.length>=6&&sim>=.70&&confidence>=25)){
        const key=box.map(v=>Math.round(v/scale)).join(':');
        if(!seen.has(key)){seen.add(key);out.push({bbox:box.map(v=>v/scale),confidence,similarity:sim,ocrText:text})}break;
      }
      if(tc.length>wc.length+80)break;
    }
  }
  return out;
}

async function pixFor(page,deg){
  const s=2.5;
  // MuPDF page matrices use degrees for Matrix.rotate().
  const m=mupdf.Matrix.concat(mupdf.Matrix.rotate(deg),mupdf.Matrix.scale(s,s));
  const pix=page.toPixmap(m,mupdf.ColorSpace.DeviceRGB,false,false);
  return {blob:new Blob([pix.asPNG()],{type:'image/png'}),scale:s};
}

async function recognizePage(page,target){
  const worker=await getWorker();let diagnostic='',best=null;
  for(const deg of [0,90,270,180]){
    try{
      const {blob,scale}=await pixFor(page,deg);
      const res=await worker.recognize(blob);
      const text=String(res?.data?.text||'').replace(/\s+/g,' ').trim();
      if(text)diagnostic+=`[${deg}°] ${text.slice(0,700)} `;
      const boxes=matchWords(res?.data,target,scale);
      if(boxes.length)return {boxes,text,diagnostic,rotation:deg};
      if(!best||text.length>best.length)best=text;
    }catch(e){diagnostic+=`[${deg}° ERROR] ${e?.message||e} `}
  }
  return {boxes:[],text:best||'',diagnostic:diagnostic.slice(0,3000)};
}

async function runRecognition(){
  const batch=window.__batchAnalysis;if(!Array.isArray(batch)||!batch.length)return;
  const status=document.querySelector('#batchStatus'),table=document.querySelector('#batchTable'),summary=document.querySelector('#batchSummary');
  let total=0,scanned=0,diagnostics=[];
  for(let ai=0;ai<batch.length;ai++){
    const a=batch[ai];if(!a||a.error||!a.data)continue;
    const doc=mupdf.PDFDocument.openDocument(a.data,'application/pdf');
    try{
      const pages=doc.countPages();
      for(let pi=0;pi<pages;pi++){
        const page=doc.loadPage(pi);scanned++;
        if(status)status.textContent=`Reconociendo vector/OCR · ${ai+1}/${batch.length} · página ${pi+1}/${pages}`;
        for(const c of(a.counts||[])){
          if(!c.find?.trim())continue;
          try{
            const o=await recognizePage(page,c.find);
            if(o.diagnostic)diagnostics.push(`PDF ${ai+1}, pág. ${pi+1}: ${o.diagnostic}`);
            if(!o.boxes.length)continue;
            c.ocrCount=(c.ocrCount||0)+o.boxes.length;c.ocrPages=c.ocrPages||[];c.ocrMatches=c.ocrMatches||[];
            c.ocrPages.push(pi+1);c.ocrMatches.push(...o.boxes.map(b=>({...b,page:pi+1})));c.pages=c.pages||[];
            if(!c.pages.includes(pi+1))c.pages.push(pi+1);total+=o.boxes.length;
          }catch(e){diagnostics.push(`PDF ${ai+1}, pág. ${pi+1}: ERROR ${e?.message||e}`)}
        }
        await new Promise(r=>setTimeout(r,0));
      }
    }finally{doc.destroy()}
  }
  const rows=[...(table?.querySelectorAll('.batch-result')||[])];
  batch.forEach((a,i)=>{const row=rows[i];if(!row||a.error)return;const span=row.querySelector(':scope > span');if(!span)return;const extras=(a.counts||[]).filter(c=>c.ocrCount).map(c=>`${c.ocrCount}× ${c.find} (vector/OCR)`);if(extras.length&&!span.textContent.includes('vector/OCR'))span.append(document.createTextNode(` · ${extras.join(' · ')}`))});
  if(total){if(summary)summary.textContent+=` · ${total} coincidencia${total===1?'':'s'} vectorial${total===1?'':'es'}/OCR · ningún archivo modificado`;if(status)status.textContent=`Reconocimiento terminado: ${total} coincidencia${total===1?'':'s'} detectada${total===1?'':'s'}.`}
  else if(status){
    const sample=diagnostics.join('\n\n').slice(0,5000);
    status.textContent=`Sin coincidencias. Se revisaron ${scanned} página${scanned===1?'':'s'} con OCR. Texto OCR de diagnóstico: ${sample||'(OCR no devolvió texto)'}`;
  }
}

let timer=null;document.addEventListener('DOMContentLoaded',()=>{const btn=document.querySelector('#batchAnalyze');if(!btn)return;btn.addEventListener('click',()=>{clearTimeout(timer);const start=Date.now();const wait=()=>{const a=window.__batchAnalysis;if(Array.isArray(a)&&a.length){runRecognition();return}if(Date.now()-start<120000)timer=setTimeout(wait,250)};timer=setTimeout(wait,300)})});