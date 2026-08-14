import * as mupdf from 'https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js';

const ANALYZE='#batchAnalyze', OCR='#batchEnableOCR', STATUS='#batchStatus';
const SCALE=2.6, RIGHT_FRACTION=.22, BOTTOM_FRACTION=.12;
let workerPromise=null, runToken=0;

const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[‐‑‒–—−]/g,'-').replace(/\s+/g,' ').trim().toLowerCase();
const canonical=s=>norm(s).replace(/\s*[-]\s*/g,'-').replace(/\s*([:/_.])\s*/g,'$1');
const key=s=>canonical(s).replace(/[^a-z0-9]/g,'').replace(/o/g,'0');
function lev(a,b){const p=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const q=[i];for(let j=1;j<=b.length;j++)q[j]=Math.min(q[j-1]+1,p[j]+1,p[j-1]+(a[i-1]===b[j-1]?0:1));for(let j=0;j<q.length;j++)p[j]=q[j]}return p[b.length]}
function sim(a,b){return a&&b?1-lev(a,b)/Math.max(a.length,b.length):0}
function isLongDrawingCode(v){const raw=String(v||'').trim(),k=key(raw),parts=raw.split('_').filter(Boolean);return raw.includes('_')&&k.length>=20&&k.length<=90&&parts.length>=5&&parts.every(p=>/^[A-Za-z0-9.-]+$/.test(p))}

async function getWorker(){if(workerPromise)return workerPromise;workerPromise=import('https://esm.sh/tesseract.js@5.1.0').then(({createWorker})=>createWorker('spa+eng')).catch(e=>{workerPromise=null;throw e});return workerPromise}
async function recognize(canvas,mode){const w=await getWorker();try{await w.setParameters({tessedit_pageseg_mode:String(mode),preserve_interword_spaces:'1'})}catch(_){}return (await w.recognize(canvas))?.data||null}
function canvasCrop(bitmap,x,y,w,h){const c=document.createElement('canvas');c.width=Math.max(1,w);c.height=Math.max(1,h);c.getContext('2d').drawImage(bitmap,x,y,w,h,0,0,w,h);return c}

function matchBox(data,target,ox,oy){
  const wanted=key(target),candidates=[];
  for(const l of data?.lines||[]){
    if(!l?.text?.trim()||!l.bbox)continue;
    const k=key(l.text),score=sim(k,wanted),contains=k.includes(wanted);
    if(contains||score>=.86)candidates.push({text:l.text,bbox:[l.bbox.x0,l.bbox.y0,l.bbox.x1,l.bbox.y1],confidence:Number(l.confidence||0),score,exact:contains||k===wanted});
  }
  const words=(data?.words||[]).filter(w=>w?.text?.trim()&&w.bbox);
  for(let i=0;i<words.length;i++){
    let text='',box=null,confidence=100;
    for(let j=i;j<Math.min(words.length,i+32);j++){
      const w=words[j];
      text=text?`${text} ${w.text}`:w.text;
      box=box?[Math.min(box[0],w.bbox.x0),Math.min(box[1],w.bbox.y0),Math.max(box[2],w.bbox.x1),Math.max(box[3],w.bbox.y1)]:[w.bbox.x0,w.bbox.y0,w.bbox.x1,w.bbox.y1];
      confidence=Math.min(confidence,Number(w.confidence||0));
      const k=key(text),score=sim(k,wanted),contains=k.includes(wanted),near=score>=.88&&Math.abs(k.length-wanted.length)<=4;
      if(contains||near){candidates.push({text,bbox,confidence,score,exact:contains||k===wanted});break}
      if(k.length>wanted.length+30)break;
    }
  }
  if(!candidates.length)return[];
  candidates.sort((a,b)=>(Number(b.exact)-Number(a.exact))||(b.score-a.score)||(b.confidence-a.confidence));
  const m=candidates[0],b=m.bbox;
  return[{bbox:[(b[0]+ox)/SCALE,(b[1]+oy)/SCALE,(b[2]+ox)/SCALE,(b[3]+oy)/SCALE],confidence:m.confidence,similarity:m.score,ocrText:m.text,exact:m.exact,titleBlockFallback:true,longDrawingCode:true}];
}

async function findOnPage(page,target){
  const pix=page.toPixmap(mupdf.Matrix.scale(SCALE,SCALE),mupdf.ColorSpace.DeviceRGB,false,false);
  const bitmap=await createImageBitmap(new Blob([pix.asPNG()],{type:'image/png'}));
  try{
    const rw=Math.max(1,Math.ceil(bitmap.width*RIGHT_FRACTION)),rx=bitmap.width-rw;
    const bh=Math.max(1,Math.ceil(bitmap.height*BOTTOM_FRACTION)),by=bitmap.height-bh;
    const bottom=canvasCrop(bitmap,rx,by,rw,bh);
    let data=await recognize(bottom,6),m=matchBox(data,target,rx,by);
    if(m.length)return m;
    const strip=canvasCrop(bitmap,rx,0,rw,bitmap.height);
    data=await recognize(strip,6);
    return matchBox(data,target,rx,0);
  }finally{bitmap.close?.()}
}

function refreshRow(idx){
  const row=document.querySelectorAll('.batch-result')[idx],span=row?.querySelector(':scope > span'),item=window.__batchAnalysis?.[idx];
  if(!span||!item||item.error)return;
  const buttons=Array.from(span.querySelectorAll('button')),hits=[];
  for(const c of item.counts||[]){
    if(c?.count)hits.push(`${c.count}× ${c.find}`);
    if(c?.annotationCount)hits.push(`${c.annotationCount}× ${c.find} (FreeText)`);
    if(c?.ocrCount)hits.push(`${c.ocrCount}× ${c.find} (vector/OCR)`);
  }
  const hitWrap=document.createElement('div');hitWrap.className='batch-hit-lines';
  const values=hits.length?hits:['Sin coincidencias'];
  for(const text of values){const line=document.createElement('span');line.className='batch-hit-line';line.textContent=text;hitWrap.appendChild(line)}
  const footer=document.createElement('div');footer.className='batch-result-actions';
  const comments=document.createElement('span');comments.textContent=`💬 ${Number(item.comments||0)}`;footer.appendChild(comments);
  for(const button of buttons)footer.appendChild(button);
  span.replaceChildren(hitWrap,footer);span.dataset.resultLines='1';
}

async function supplement(token){
  if(document.querySelector(OCR)?.checked!==true||token!==runToken)return;
  const batch=window.__batchAnalysis;
  if(!Array.isArray(batch)||!batch.length)return;
  let total=0;
  for(let ai=0;ai<batch.length;ai++){
    const item=batch[ai];
    if(token!==runToken||item?.error||!item?.data)continue;
    const pending=(item.counts||[]).filter(c=>c?.find?.trim()&&isLongDrawingCode(c.find)&&Number(c.count||0)===0&&Number(c.annotationCount||0)===0&&Number(c.ocrCount||0)===0);
    if(!pending.length)continue;
    const doc=mupdf.PDFDocument.openDocument(item.data,'application/pdf');
    try{
      for(let pi=0;pi<doc.countPages()&&pending.some(c=>Number(c.ocrCount||0)===0);pi++){
        if(token!==runToken)return;
        const s=document.querySelector(STATUS);if(s)s.textContent=`OCR código largo · ${item.name} · página ${pi+1}`;
        const page=doc.loadPage(pi);
        for(const c of pending){
          if(Number(c.ocrCount||0)>0)continue;
          let matches=[];
          try{matches=await findOnPage(page,c.find)}catch(e){console.warn('long titleblock OCR v3',item.name,pi+1,e)}
          if(!matches.length)continue;
          c.ocrCount=(c.ocrCount||0)+matches.length;
          c.ocrMatches=(c.ocrMatches||[]).concat(matches.map(m=>({...m,page:pi+1})));
          c.pages=c.pages||[];if(!c.pages.includes(pi+1))c.pages.push(pi+1);
          total+=matches.length;refreshRow(ai);
        }
      }
    }finally{doc.destroy()}
  }
  if(total){
    const stat=document.querySelector('#statEdits');
    if(stat)stat.textContent=batch.reduce((sum,a)=>sum+(a?.error?0:(a.counts||[]).reduce((q,c)=>q+Number(c.count||0)+Number(c.annotationCount||0)+Number(c.ocrCount||0),0)),0);
    const apply=document.querySelector('#batchApply');if(apply)apply.disabled=false;
    const s=document.querySelector(STATUS);if(s)s.textContent=`Reconocimiento terminado: ${total} código${total===1?'':'s'} largo${total===1?'':'s'} detectado${total===1?'':'s'} en cartela.`;
  }
  window.__longTitleBlockOCR={total,version:3};
}

function waitForNewAnalysis(token,previous){
  let ticks=0;
  const timer=setInterval(()=>{
    if(token!==runToken){clearInterval(timer);return}
    const current=window.__batchAnalysis,btn=document.querySelector(ANALYZE);
    if(current!==previous&&Array.isArray(current)&&current.length&&btn&&!btn.disabled){
      clearInterval(timer);setTimeout(()=>supplement(token).catch(e=>console.warn('long titleblock OCR v3',e)),150);return;
    }
    if(++ticks>2400)clearInterval(timer);
  },200);
}

document.querySelector(ANALYZE)?.addEventListener('click',()=>{
  if(document.querySelector(OCR)?.checked!==true)return;
  const previous=window.__batchAnalysis;runToken++;waitForNewAnalysis(runToken,previous);
},true);
