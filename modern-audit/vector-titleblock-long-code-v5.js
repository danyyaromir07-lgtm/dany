import * as mupdf from 'https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js';

const ANALYZE='#batchAnalyze', OCR='#batchEnableOCR', STATUS='#batchStatus';
const SCALE=1.4, RIGHT_FRACTION=.22, BOTTOM_FRACTION=.12;
let workerPromise=null, runToken=0;

const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[‐‑‒–—−]/g,'-').replace(/\s+/g,' ').trim().toLowerCase();
const canonical=s=>norm(s).replace(/\s*[-]\s*/g,'-').replace(/\s*([:/_.])\s*/g,'$1');
const baseKey=s=>canonical(s).replace(/[^a-z0-9]/g,'');
const codeKey=s=>baseKey(s).replace(/o/g,'0').replace(/i/g,'1');
function lev(a,b){const p=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const q=[i];for(let j=1;j<=b.length;j++)q[j]=Math.min(q[j-1]+1,p[j]+1,p[j-1]+(a[i-1]===b[j-1]?0:1));for(let j=0;j<q.length;j++)p[j]=q[j]}return p[b.length]}
function sim(a,b){return a&&b?1-lev(a,b)/Math.max(a.length,b.length):0}
function isLongDrawingCode(v){const raw=String(v||'').trim(),k=codeKey(raw),parts=raw.split('_').filter(Boolean);return raw.includes('_')&&k.length>=20&&k.length<=90&&parts.length>=5&&parts.every(p=>/^[A-Za-z0-9.-]+$/.test(p))}
function diag(stage,extra={}){try{window.__ocrDiagnostic?.({time:new Date().toISOString(),stage,detail:'long-code-v5',...extra})}catch(_){}}

async function getWorker(){
  if(workerPromise)return workerPromise;
  diag('ocr.longcode.worker',{target:'eng'});
  workerPromise=import('https://esm.sh/tesseract.js@5.1.0')
    .then(({createWorker})=>createWorker('eng'))
    .then(w=>{diag('ocr.longcode.worker.ready');return w})
    .catch(e=>{workerPromise=null;throw e});
  return workerPromise;
}
async function recognize(canvas,mode){const w=await getWorker();try{await w.setParameters({tessedit_pageseg_mode:String(mode),preserve_interword_spaces:'1'})}catch(_){}return (await w.recognize(canvas))?.data||null}

function renderRegion(page,region){
  const x0=Math.floor(region[0]*SCALE),y0=Math.floor(region[1]*SCALE),x1=Math.ceil(region[2]*SCALE),y1=Math.ceil(region[3]*SCALE);
  const pix=new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB,[x0,y0,x1,y1],false);
  pix.clear(255);
  const dev=new mupdf.DrawDevice(mupdf.Matrix.identity,pix);
  try{page.runPageContents(dev,mupdf.Matrix.scale(SCALE,SCALE));}finally{try{dev.close()}catch(_){}}
  return pix;
}
async function pixmapCanvas(pix){const blob=new Blob([pix.asPNG()],{type:'image/png'}),bitmap=await createImageBitmap(blob);try{const c=document.createElement('canvas');c.width=bitmap.width;c.height=bitmap.height;c.getContext('2d').drawImage(bitmap,0,0);return c}finally{bitmap.close?.()}}

function matchBox(data,target,originX,originY){
  const wanted=codeKey(target),candidates=[];
  for(const l of data?.lines||[]){if(!l?.text?.trim()||!l.bbox)continue;const k=codeKey(l.text),score=sim(k,wanted),contains=k.includes(wanted);if(contains||score>=.86)candidates.push({text:l.text,bbox:[l.bbox.x0,l.bbox.y0,l.bbox.x1,l.bbox.y1],confidence:Number(l.confidence||0),score,exact:contains||k===wanted,key:k})}
  const words=(data?.words||[]).filter(w=>w?.text?.trim()&&w.bbox);
  for(let i=0;i<words.length;i++){
    let text='',box=null,confidence=100;
    for(let j=i;j<Math.min(words.length,i+32);j++){
      const w=words[j];text=text?`${text} ${w.text}`:w.text;box=box?[Math.min(box[0],w.bbox.x0),Math.min(box[1],w.bbox.y0),Math.max(box[2],w.bbox.x1),Math.max(box[3],w.bbox.y1)]:[w.bbox.x0,w.bbox.y0,w.bbox.x1,w.bbox.y1];confidence=Math.min(confidence,Number(w.confidence||0));
      const k=codeKey(text),score=sim(k,wanted),contains=k.includes(wanted),near=score>=.88&&Math.abs(k.length-wanted.length)<=4;
      if(contains||near){candidates.push({text,bbox:box,confidence,score,exact:contains||k===wanted,key:k});break}
      if(k.length>wanted.length+30)break;
    }
  }
  diag('ocr.longcode.match',{target,wanted,ocrText:String(data?.text||'').slice(0,500)});
  if(!candidates.length)return[];
  candidates.sort((a,b)=>(Number(b.exact)-Number(a.exact))||(b.score-a.score)||(b.confidence-a.confidence));
  const m=candidates[0],b=m.bbox;
  diag('ocr.longcode.found',{target,ocrText:m.text,score:m.score,confidence:m.confidence,exact:m.exact,key:m.key});
  return[{bbox:[originX+b[0]/SCALE,originY+b[1]/SCALE,originX+b[2]/SCALE,originY+b[3]/SCALE],confidence:m.confidence,similarity:m.score,ocrText:m.text,exact:m.exact,titleBlockFallback:true,longDrawingCode:true}];
}

async function recognizeRegion(page,target,region,label){
  const pix=renderRegion(page,region);
  try{
    diag('ocr.longcode.region',{target,ocrText:`${label} ${pix.getWidth()}x${pix.getHeight()}`});
    const canvas=await pixmapCanvas(pix),data=await recognize(canvas,6);
    return matchBox(data,target,region[0],region[1]);
  }finally{try{pix.destroy?.()}catch(_){}}
}
async function findOnPage(page,target){
  const pb=page.getBounds(),w=pb[2]-pb[0],h=pb[3]-pb[1],x0=pb[2]-w*RIGHT_FRACTION,y0=pb[3]-h*BOTTOM_FRACTION;
  let m=await recognizeRegion(page,target,[x0,y0,pb[2],pb[3]],'bottom-right');
  if(m.length)return m;
  return recognizeRegion(page,target,[x0,pb[1],pb[2],pb[3]],'right-strip');
}

function refreshRow(idx){const row=document.querySelectorAll('.batch-result')[idx],span=row?.querySelector(':scope > span'),item=window.__batchAnalysis?.[idx];if(!span||!item||item.error)return;const buttons=Array.from(span.querySelectorAll('button')),hits=[];for(const c of item.counts||[]){if(c?.count)hits.push(`${c.count}× ${c.find}`);if(c?.annotationCount)hits.push(`${c.annotationCount}× ${c.find} (FreeText)`);if(c?.ocrCount)hits.push(`${c.ocrCount}× ${c.find} (vector/OCR)`)}const hitWrap=document.createElement('div');hitWrap.className='batch-hit-lines';for(const text of(hits.length?hits:['Sin coincidencias'])){const line=document.createElement('span');line.className='batch-hit-line';line.textContent=text;hitWrap.appendChild(line)}const footer=document.createElement('div');footer.className='batch-result-actions';const comments=document.createElement('span');comments.textContent=`💬 ${Number(item.comments||0)}`;footer.appendChild(comments);for(const button of buttons)footer.appendChild(button);span.replaceChildren(hitWrap,footer);span.dataset.resultLines='1'}

async function supplement(token){
  if(document.querySelector(OCR)?.checked!==true||token!==runToken)return;
  const batch=window.__batchAnalysis;if(!Array.isArray(batch)||!batch.length)return;let total=0;
  for(let ai=0;ai<batch.length;ai++){
    const item=batch[ai];if(token!==runToken||item?.error||!item?.data)continue;
    const pending=(item.counts||[]).filter(c=>c?.find?.trim()&&isLongDrawingCode(c.find)&&Number(c.count||0)===0&&Number(c.annotationCount||0)===0&&Number(c.ocrCount||0)===0);if(!pending.length)continue;
    const doc=mupdf.PDFDocument.openDocument(item.data,'application/pdf');
    try{for(let pi=0;pi<doc.countPages()&&pending.some(c=>Number(c.ocrCount||0)===0);pi++){
      if(token!==runToken)return;const s=document.querySelector(STATUS);if(s)s.textContent=`OCR código largo · ${item.name} · página ${pi+1}`;const page=doc.loadPage(pi);
      for(const c of pending){if(Number(c.ocrCount||0)>0)continue;let matches=[];try{matches=await findOnPage(page,c.find)}catch(e){const msg=e?.message||String(e);diag('ocr.longcode.error',{file:item.name,page:pi+1,target:c.find,detail:`long-code-v5 ERROR: ${msg}`});console.warn('long titleblock OCR v5',item.name,pi+1,e)}if(!matches.length)continue;c.ocrCount=(c.ocrCount||0)+matches.length;c.ocrMatches=(c.ocrMatches||[]).concat(matches.map(m=>({...m,page:pi+1})));c.pages=c.pages||[];if(!c.pages.includes(pi+1))c.pages.push(pi+1);total+=matches.length;refreshRow(ai)}
    }}finally{doc.destroy()}
  }
  if(total){const stat=document.querySelector('#statEdits');if(stat)stat.textContent=batch.reduce((sum,a)=>sum+(a?.error?0:(a.counts||[]).reduce((q,c)=>q+Number(c.count||0)+Number(c.annotationCount||0)+Number(c.ocrCount||0),0)),0);const apply=document.querySelector('#batchApply');if(apply)apply.disabled=false;const s=document.querySelector(STATUS);if(s)s.textContent=`Reconocimiento terminado: ${total} código${total===1?'':'s'} largo${total===1?'':'s'} detectado${total===1?'':'s'} en cartela.`}
  window.__longTitleBlockOCR={total,version:5};
}
function waitForNewAnalysis(token,previous){let ticks=0;const timer=setInterval(()=>{if(token!==runToken){clearInterval(timer);return}const current=window.__batchAnalysis,btn=document.querySelector(ANALYZE);if(current!==previous&&Array.isArray(current)&&current.length&&btn&&!btn.disabled){clearInterval(timer);setTimeout(()=>supplement(token).catch(e=>console.warn('long titleblock OCR v5',e)),150);return}if(++ticks>2400)clearInterval(timer)},200)}

document.querySelector(ANALYZE)?.addEventListener('click',()=>{if(document.querySelector(OCR)?.checked!==true)return;const previous=window.__batchAnalysis;runToken++;diag('ocr.longcode.start',{version:5});waitForNewAnalysis(runToken,previous)},true);
window.__longTitleBlockOCRLoaded={version:5};
