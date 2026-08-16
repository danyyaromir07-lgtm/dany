import * as mupdf from 'https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js';

// Isolated second-pass OCR for short/simple targets in the lower title block.
// The existing title-block OCR remains untouched and always runs first.
const ANALYZE='#batchAnalyze';
const OCR='#batchEnableOCR';
const STATUS='#batchStatus';
const SCALE=2.2;
const RIGHT_FRACTION=.24;
const BOTTOM_FRACTION=.16;
const LOWER_FRACTION=.36;
let workerPromise=null;
let runToken=0;

const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[‐‑‒–—−]/g,'-').replace(/\s+/g,' ').trim().toLowerCase();
const canonical=s=>norm(s).replace(/\s*[-]\s*/g,'-').replace(/\s*([:/_.])\s*/g,'$1');
const key=s=>canonical(s).replace(/[^a-z0-9]/g,'').replace(/o/g,'0');
function lev(a,b){const p=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const q=[i];for(let j=1;j<=b.length;j++)q[j]=Math.min(q[j-1]+1,p[j]+1,p[j-1]+(a[i-1]===b[j-1]?0:1));for(let j=0;j<q.length;j++)p[j]=q[j]}return p[b.length]}
function sim(a,b){return a&&b?1-lev(a,b)/Math.max(a.length,b.length):0}
function simpleTarget(s){return key(s).length>=4&&key(s).length<=14&&String(s).split(/[_\-\s./:]+/).filter(Boolean).length<=3}
function iou(a,b){const x=Math.max(0,Math.min(a[2],b[2])-Math.max(a[0],b[0])),y=Math.max(0,Math.min(a[3],b[3])-Math.max(a[1],b[1]));const inter=x*y,aa=Math.max(1,(a[2]-a[0])*(a[3]-a[1])),bb=Math.max(1,(b[2]-b[0])*(b[3]-b[1]));return inter/(aa+bb-inter)}
function diag(stage,extra={}){try{window.__ocrDiagnostic?.({time:new Date().toISOString(),stage,detail:'titleblock-focused-retry-v1',...extra})}catch(_){}}

async function getWorker(){
  if(workerPromise)return workerPromise;
  workerPromise=import('https://esm.sh/tesseract.js@5.1.0')
    .then(({createWorker})=>createWorker('spa+eng'))
    .then(async w=>{try{await w.setParameters({tessedit_pageseg_mode:'6',preserve_interword_spaces:'1'})}catch(_){}return w})
    .catch(e=>{workerPromise=null;throw e});
  return workerPromise;
}

function renderRegion(page,region){
  const x0=Math.floor(region[0]*SCALE),y0=Math.floor(region[1]*SCALE),x1=Math.ceil(region[2]*SCALE),y1=Math.ceil(region[3]*SCALE);
  const pix=new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB,[x0,y0,x1,y1],false);
  pix.clear(255);
  const dev=new mupdf.DrawDevice(mupdf.Matrix.identity,pix);
  try{page.runPageContents(dev,mupdf.Matrix.scale(SCALE,SCALE))}finally{try{dev.close()}catch(_){}}
  return pix;
}

async function pixmapCanvas(pix){
  const bitmap=await createImageBitmap(new Blob([pix.asPNG()],{type:'image/png'}));
  try{const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;canvas.getContext('2d').drawImage(bitmap,0,0);return canvas}
  finally{bitmap.close?.()}
}

function indexedKey(text){const raw=canonical(text).replace(/o/g,'0'),positions=[];let k='';for(let i=0;i<raw.length;i++){const ch=raw[i];if(/[a-z0-9]/.test(ch)){positions.push(i);k+=ch}}return{raw,key:k,positions}}
function bestPartial(container,wanted){const direct=container.indexOf(wanted);if(direct>=0)return{start:direct,len:wanted.length,score:1,exact:true};let best=null;for(let len=Math.max(4,wanted.length-1);len<=Math.min(container.length,wanted.length+1);len++){for(let start=0;start+len<=container.length;start++){const score=sim(container.slice(start,start+len),wanted);if(!best||score>best.score)best={start,len,score,exact:false}}}return best}

function partialWordMatch(word,target,originX,originY){
  const wanted=key(target),idx=indexedKey(word?.text||''),confidence=Number(word?.confidence||0);
  if(wanted.length<8||idx.key.length<wanted.length+3||!word?.bbox)return null;
  const p=bestPartial(idx.key,wanted);
  if(!p||(p.exact?confidence<10:(confidence<15||p.score<.88)))return null;
  const startRaw=idx.positions[p.start],endPos=idx.positions[Math.min(idx.positions.length-1,p.start+p.len-1)];
  if(startRaw==null||endPos==null)return null;
  const endRaw=endPos+1,total=Math.max(1,idx.raw.length),b=word.bbox,width=Math.max(1,b.x1-b.x0);
  const x0=b.x0+width*(startRaw/total),x1=b.x0+width*(endRaw/total);
  return{bbox:[originX+x0/SCALE,originY+b.y0/SCALE,originX+x1/SCALE,originY+b.y1/SCALE],confidence,similarity:p.score,ocrText:word.text,exact:p.exact,titleBlockFallback:true,focusedTitleBlockRetry:true,partialWithinOCR:true,containerText:word.text,partialStart:startRaw,partialEnd:endRaw};
}

function findWords(data,target,originX,originY){
  const wanted=key(target),words=(data?.words||[]).filter(w=>w?.text?.trim()&&w.bbox),found=[];
  for(let i=0;i<words.length;i++){
    const partial=partialWordMatch(words[i],target,originX,originY);
    if(partial){found.push(partial);continue}
    let text='',box=null,confidence=100;
    for(let j=i;j<Math.min(words.length,i+12);j++){
      const w=words[j];text=text?text+' '+w.text:w.text;
      box=box?[Math.min(box[0],w.bbox.x0),Math.min(box[1],w.bbox.y0),Math.max(box[2],w.bbox.x1),Math.max(box[3],w.bbox.y1)]:[w.bbox.x0,w.bbox.y0,w.bbox.x1,w.bbox.y1];
      confidence=Math.min(confidence,Number(w.confidence||0));
      const k=key(text),score=sim(k,wanted),exact=k===wanted;
      if(exact||(confidence>=55&&score>=.84)){
        found.push({bbox:[originX+box[0]/SCALE,originY+box[1]/SCALE,originX+box[2]/SCALE,originY+box[3]/SCALE],confidence,similarity:score,ocrText:text,exact,titleBlockFallback:true,focusedTitleBlockRetry:true});
        break;
      }
      if(k.length>wanted.length+20)break;
    }
  }
  const unique=[];
  for(const m of found){const same=unique.find(u=>iou(u.bbox,m.bbox)>=.6);if(same){if(m.confidence>same.confidence)Object.assign(same,m)}else unique.push(m)}
  return unique;
}

async function recognizeRegion(page,target,region,label){
  const pix=renderRegion(page,region);
  try{
    const canvas=await pixmapCanvas(pix),worker=await getWorker();
    try{await worker.setParameters({tessedit_pageseg_mode:'6',preserve_interword_spaces:'1'})}catch(_){}
    const data=(await worker.recognize(canvas))?.data||null;
    diag('ocr.titleblock.focused.region',{target,label,ocrText:String(data?.text||'').slice(0,500)});
    return findWords(data,target,region[0],region[1]);
  }finally{try{pix.destroy?.()}catch(_){}}
}

async function findOnPage(page,target){
  const pb=page.getBounds(),w=pb[2]-pb[0],h=pb[3]-pb[1],x0=pb[2]-w*RIGHT_FRACTION;
  let matches=await recognizeRegion(page,target,[x0,pb[3]-h*BOTTOM_FRACTION,pb[2],pb[3]],'bottom-right');
  if(matches.length)return matches;
  return recognizeRegion(page,target,[x0,pb[3]-h*LOWER_FRACTION,pb[2],pb[3]],'lower-right');
}

function refreshRow(idx){
  const row=document.querySelectorAll('.batch-result')[idx],span=row?.querySelector(':scope > span'),item=window.__batchAnalysis?.[idx];
  if(!span||!item||item.error)return;
  const buttons=Array.from(span.querySelectorAll('button')),hits=[];
  for(const c of item.counts||[]){if(c?.count)hits.push(`${c.count}× ${c.find}`);if(c?.annotationCount)hits.push(`${c.annotationCount}× ${c.find} (FreeText)`);if(c?.ocrCount)hits.push(`${c.ocrCount}× ${c.find} (vector/OCR)`)}
  const hitWrap=document.createElement('div');hitWrap.className='batch-hit-lines';
  for(const text of(hits.length?hits:['Sin coincidencias'])){const line=document.createElement('span');line.className='batch-hit-line';line.textContent=text;hitWrap.appendChild(line)}
  const footer=document.createElement('div');footer.className='batch-result-actions';const comments=document.createElement('span');comments.textContent=`💬 ${Number(item.comments||0)}`;footer.appendChild(comments);for(const button of buttons)footer.appendChild(button);
  span.replaceChildren(hitWrap,footer);span.dataset.resultLines='1';
}

function refreshTotals(batch){
  let edits=0,ocrTotal=0;
  for(const item of batch){if(item?.error)continue;for(const c of item.counts||[]){edits+=Number(c.count||0)+Number(c.annotationCount||0)+Number(c.ocrCount||0);ocrTotal+=Number(c.ocrCount||0)}}
  const stat=document.querySelector('#statEdits');if(stat)stat.textContent=edits;
  const summary=document.querySelector('#batchSummary');
  if(summary){summary.textContent=(summary.textContent||'').replace(/\d+ coincidencia(?:s)? vectorial\/OCR/,`${ocrTotal} coincidencia${ocrTotal===1?'':'s'} vectorial/OCR`)}
  const apply=document.querySelector('#batchApply');if(apply&&edits>0)apply.disabled=false;
}

async function supplement(token){
  if(document.querySelector(OCR)?.checked!==true||token!==runToken)return;
  const batch=Array.isArray(window.__batchAnalysis)?window.__batchAnalysis:[];
  if(!batch.length)return;
  let total=0;
  for(let ai=0;ai<batch.length;ai++){
    const item=batch[ai];
    if(token!==runToken||item?.error||!item?.data||item?.kinds?.vector!==true)continue;
    const pending=(item.counts||[]).filter(c=>c?.find?.trim()&&simpleTarget(c.find)&&Number(c.count||0)===0&&Number(c.annotationCount||0)===0&&Number(c.ocrCount||0)===0);
    if(!pending.length)continue;
    const doc=mupdf.PDFDocument.openDocument(item.data,'application/pdf');
    try{
      for(let pi=0;pi<doc.countPages()&&pending.some(c=>Number(c.ocrCount||0)===0);pi++){
        if(token!==runToken)return;
        const page=doc.loadPage(pi),status=document.querySelector(STATUS);
        for(const c of pending){
          if(Number(c.ocrCount||0)>0)continue;
          if(status)status.textContent=`OCR cartela focalizado · ${item.name} · página ${pi+1}`;
          let matches=[];
          try{matches=await findOnPage(page,c.find)}catch(e){diag('ocr.titleblock.focused.error',{file:item.name,page:pi+1,target:c.find,error:e?.message||String(e)});console.warn('focused titleblock OCR',item.name,pi+1,e)}
          if(!matches.length)continue;
          c.ocrCount=(c.ocrCount||0)+matches.length;
          c.ocrMatches=(c.ocrMatches||[]).concat(matches.map(m=>({...m,page:pi+1})));
          c.pages=c.pages||[];if(!c.pages.includes(pi+1))c.pages.push(pi+1);
          total+=matches.length;
          diag('ocr.titleblock.focused.found',{file:item.name,page:pi+1,target:c.find,count:matches.length,ocrText:matches[0]?.ocrText,similarity:matches[0]?.similarity,confidence:matches[0]?.confidence});
          refreshRow(ai);
        }
      }
    }finally{doc.destroy()}
  }
  refreshTotals(batch);
  const status=document.querySelector(STATUS);
  if(total){if(status)status.textContent=`Reconocimiento terminado: ${total} coincidencia${total===1?'':'s'} adicional${total===1?'':'es'} detectada${total===1?'':'s'} en OCR focalizado de cartela.`}
  else if(status&&/^OCR cartela(?: focalizado)? ·/.test(status.textContent||''))status.textContent='Análisis completado. Sin coincidencias adicionales en OCR focalizado de cartela.';
  window.__focusedTitleBlockOCR={total,version:1};
}

function waitForPrimary(token,previousMarker){
  let ticks=0;
  const timer=setInterval(()=>{
    if(token!==runToken){clearInterval(timer);return}
    const marker=window.__titleBlockOCR;
    if(marker&&marker!==previousMarker){clearInterval(timer);setTimeout(()=>supplement(token).catch(e=>console.warn('focused titleblock OCR',e)),100);return}
    if(++ticks>3000)clearInterval(timer);
  },200);
}

document.querySelector(ANALYZE)?.addEventListener('click',()=>{
  if(document.querySelector(OCR)?.checked!==true)return;
  const previousMarker=window.__titleBlockOCR;
  runToken++;
  diag('ocr.titleblock.focused.wait',{version:1});
  waitForPrimary(runToken,previousMarker);
});

window.__focusedTitleBlockOCRLoaded={version:1};
