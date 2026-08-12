import * as mupdf from 'https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js';

let workerPromise=null;
const norm=s=>String(s||'').replace(/[|]/g,' ').replace(/\s+/g,' ').trim().toLowerCase();
const compact=s=>norm(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
const ocrKey=s=>compact(s).replace(/[o0]/g,'0').replace(/[il1]/g,'1').replace(/[s5]/g,'5').replace(/[b8]/g,'8');

async function getWorker(){
  if(workerPromise)return workerPromise;
  workerPromise=(async()=>{
    const {createWorker}=await import('https://esm.sh/tesseract.js@5.1.0');
    try{return await createWorker('spa+eng')}catch(e){console.warn('spa+eng OCR failed, using eng',e);return await createWorker('eng')}
  })().catch(e=>{workerPromise=null;throw e});
  return workerPromise;
}

function levenshtein(a,b){
  if(a===b)return 0;if(!a)return b.length;if(!b)return a.length;
  let prev=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){const cur=[i];for(let j=1;j<=b.length;j++)cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));prev=cur}
  return prev[b.length];
}
function similarity(a,b){if(!a||!b)return 0;return 1-levenshtein(a,b)/Math.max(a.length,b.length)}

function targetMatches(data,target,scale,rotation,srcW,srcH){
  const wanted=norm(target),wantedCompact=compact(target),wantedKey=ocrKey(target);
  const words=(data?.words||[]).filter(w=>w?.text?.trim()&&w.bbox);
  if(!wanted||!words.length)return[];
  const out=[],seen=new Set();
  const mapPoint=(x,y)=>{
    if(rotation===0)return[x,y];
    if(rotation===90)return[y,srcW-x];
    if(rotation===180)return[srcW-x,srcH-y];
    return[srcH-y,x];
  };
  const mapBox=b=>{const p=[[b.x0,b.y0],[b.x1,b.y0],[b.x1,b.y1],[b.x0,b.y1]].map(([x,y])=>mapPoint(x,y));return[Math.min(...p.map(p=>p[0]))/scale,Math.min(...p.map(p=>p[1]))/scale,Math.max(...p.map(p=>p[0]))/scale,Math.max(...p.map(p=>p[1]))/scale]};
  for(let i=0;i<words.length;i++){
    let text='',box=null,confidence=100;
    for(let j=i;j<Math.min(words.length,i+40);j++){
      const w=words[j],t=norm(w.text);if(!t)continue;
      text=text?`${text} ${t}`:t;
      box=box?[Math.min(box[0],w.bbox.x0),Math.min(box[1],w.bbox.y0),Math.max(box[2],w.bbox.x1),Math.max(box[3],w.bbox.y1)]:[w.bbox.x0,w.bbox.y0,w.bbox.x1,w.bbox.y1];
      confidence=Math.min(confidence,Number(w.confidence||0));
      const tc=compact(text),tk=ocrKey(text);
      const exact=text===wanted||text.includes(wanted)||tc===wantedCompact||tc.includes(wantedCompact)||tk===wantedKey||tk.includes(wantedKey);
      const sim=Math.max(similarity(tc,wantedCompact),similarity(tk,wantedKey));
      const fuzzy=wantedCompact.length>=6&&sim>=0.68&&confidence>=20;
      if(exact||fuzzy){
        const mapped=mapBox({x0:box[0],y0:box[1],x1:box[2],y1:box[3]});
        const key=`${Math.round(mapped[0])}:${Math.round(mapped[1])}:${Math.round(mapped[2])}:${Math.round(mapped[3])}`;
        if(!seen.has(key)){seen.add(key);out.push({bbox:mapped,confidence,similarity:sim,ocrText:text,rotation})}
        break;
      }
      if(tc.length>wantedCompact.length+64)break;
    }
  }
  return out;
}

async function rotateBlob(blob,angle){
  if(angle===0)return{blob,width:null,height:null};
  const img=await createImageBitmap(blob),w=img.width,h=img.height;
  const canvas=document.createElement('canvas');canvas.width=(angle%180===0)?w:h;canvas.height=(angle%180===0)?h:w;
  const ctx=canvas.getContext('2d');ctx.translate(canvas.width/2,canvas.height/2);ctx.rotate(angle*Math.PI/180);ctx.drawImage(img,-w/2,-h/2);img.close();
  return{blob:await new Promise(r=>canvas.toBlob(r,'image/png')),width:canvas.width,height:canvas.height};
}

async function recognizePage(page,target){
  const scale=3;
  const pix=page.toPixmap(mupdf.Matrix.scale(scale,scale),mupdf.ColorSpace.DeviceRGB,false,false);
  const baseBlob=new Blob([pix.asPNG()],{type:'image/png'});
  const img=await createImageBitmap(baseBlob),srcW=img.width,srcH=img.height;img.close();
  const worker=await getWorker();
  try{await worker.setParameters({tessedit_pageseg_mode:'11',preserve_interword_spaces:'1'})}catch(_){ }
  let best={boxes:[],text:'',rotation:0};
  for(const rotation of [0,90,270,180]){
    const rb=await rotateBlob(baseBlob,rotation);
    const res=await worker.recognize(rb.blob);
    const boxes=targetMatches(res?.data,target,scale,rotation,srcW,srcH);
    const text=res?.data?.text||'';
    if(boxes.length)return{boxes,text,rotation};
    if(text.length>(best.text||'').length)best={boxes:[],text,rotation};
  }
  return best;
}

async function runRecognition(){
  const batch=window.__batchAnalysis;if(!Array.isArray(batch)||!batch.length)return;
  const status=document.querySelector('#batchStatus'),table=document.querySelector('#batchTable'),summary=document.querySelector('#batchSummary');
  let totalOcr=0,scannedPages=0,lastOcrSample='';
  for(let ai=0;ai<batch.length;ai++){
    const a=batch[ai];if(!a||a.error||!a.data)continue;
    const doc=mupdf.PDFDocument.openDocument(a.data,'application/pdf');
    try{
      const pages=doc.countPages();
      for(let pi=0;pi<pages;pi++){
        const page=doc.loadPage(pi);scannedPages++;
        if(status)status.textContent=`Reconociendo texto vectorial/OCR · ${ai+1}/${batch.length} · página ${pi+1}/${pages}`;
        for(const c of(a.counts||[])){
          if(!c.find?.trim())continue;
          try{
            const o=await recognizePage(page,c.find);
            if(o.text)lastOcrSample=o.text.replace(/\s+/g,' ').trim().slice(0,220);
            if(!o.boxes.length)continue;
            c.ocrCount=(c.ocrCount||0)+o.boxes.length;c.ocrPages=c.ocrPages||[];c.ocrMatches=c.ocrMatches||[];
            c.ocrPages.push(pi+1);c.ocrMatches.push(...o.boxes.map(b=>({...b,page:pi+1})));c.pages=c.pages||[];
            if(!c.pages.includes(pi+1))c.pages.push(pi+1);totalOcr+=o.boxes.length;
          }catch(e){console.warn('OCR vectorial:',e)}
        }
        await new Promise(r=>setTimeout(r,0));
      }
    }finally{doc.destroy()}
  }
  const rows=[...(table?.querySelectorAll('.batch-result')||[])];
  batch.forEach((a,i)=>{const row=rows[i];if(!row||a.error)return;const span=row.querySelector(':scope > span');if(!span)return;const extras=(a.counts||[]).filter(c=>c.ocrCount).map(c=>`${c.ocrCount}× ${c.find} (vector/OCR)`);if(extras.length&&!span.textContent.includes('vector/OCR')){const btn=span.querySelector('button'),text=extras.join(' · ');if(btn)span.insertBefore(document.createTextNode(` · ${text} `),btn);else span.append(document.createTextNode(` · ${text}`))}});
  if(totalOcr){
    if(summary)summary.textContent+=` · ${totalOcr} coincidencia${totalOcr===1?'':'s'} vectorial${totalOcr===1?'':'es'}/OCR · ningún archivo modificado`;
    const stat=document.querySelector('#statEdits');if(stat){const n=parseInt(stat.textContent||'0',10)||0;stat.textContent=String(n+totalOcr)}
    if(status)status.textContent=`Reconocimiento terminado: ${totalOcr} coincidencia${totalOcr===1?'':'s'} vectorial${totalOcr===1?'':'es'} detectada${totalOcr===1?'':'s'} en ${scannedPages} página${scannedPages===1?'':'s'}. No se ha modificado ningún PDF.`;
  }else if(status){status.textContent=`Reconocimiento terminado: se revisaron ${scannedPages} página${scannedPages===1?'':'s'} con OCR y no hubo coincidencias. ${lastOcrSample?`OCR leído: “${lastOcrSample}”`:''}`}
}

let lastBatch=null;
document.addEventListener('DOMContentLoaded',()=>{const btn=document.querySelector('#batchAnalyze');if(!btn)return;btn.addEventListener('click',()=>{if(lastBatch)clearTimeout(lastBatch);const started=Date.now();const wait=()=>{const a=window.__batchAnalysis;if(Array.isArray(a)&&a.length){runRecognition();return}if(Date.now()-started<120000)lastBatch=setTimeout(wait,250)};lastBatch=setTimeout(wait,300)});});