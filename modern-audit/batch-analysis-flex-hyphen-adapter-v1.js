import * as mupdf from 'https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js';
import { normalize } from './adaptive-engine-v1.js';

const FLEX_DASH=/[‐‑‒–—−]/g;
const q=s=>document.querySelector(s);
let running=false,timer=null;

function flexKey(s){
  return normalize(String(s||''))
    .replace(FLEX_DASH,'-')
    .replace(/\s*-\s*/g,'-')
    .replace(/\s+/g,' ')
    .trim()
    .toLowerCase();
}
function lineText(page){
  try{return JSON.parse(page.toStructuredText('preserve-spans').asJSON()).blocks.flatMap(b=>b.type==='text'?b.lines.map(l=>l.text):[])}catch(_){return[]}
}
function countRule(lines,needle){
  const target=flexKey(needle);if(!target)return 0;
  let n=0;
  for(const line of lines){
    const s=flexKey(line);let p=0;
    while((p=s.indexOf(target,p))>=0){n++;p+=Math.max(1,target.length)}
  }
  return n;
}
function hasFlexibleHyphenRule(a){
  return (a?.counts||[]).some(c=>Number(c?.count||0)===0&&/[-‐‑‒–—−]/.test(String(c?.find||'')));
}
function refreshVisibleRows(changed){
  const rows=[...document.querySelectorAll('#batchTable .batch-result')];
  for(const idx of changed){
    const a=window.__batchAnalysis?.[idx],row=rows[idx];if(!a||!row)continue;
    const hits=(a.counts||[]).flatMap(c=>[c.count?`${c.count}× ${c.find}`:null,c.annotationCount?`${c.annotationCount}× ${c.find} (FreeText)`:null,c.ocrCount?`${c.ocrCount}× ${c.find} (vector/OCR)`:null]).filter(Boolean);
    const red=[...row.querySelectorAll('span')].find(x=>x.textContent?.trim()==='Sin coincidencias');
    if(red&&hits.length)red.replaceWith(document.createTextNode(hits.join(' · ')));
  }
  const all=window.__batchAnalysis||[];
  const edits=all.reduce((sum,a)=>sum+(a?.error?0:(a.counts||[]).reduce((s,c)=>s+Number(c.count||0)+Number(c.annotationCount||0)+Number(c.ocrCount||0),0)),0);
  const stat=q('#statEdits');if(stat)stat.textContent=String(edits);
  const apply=q('#batchApply');if(apply&&all.some(a=>!a?.error&&(a.counts||[]).some(c=>Number(c.count||0)||Number(c.annotationCount||0)||Number(c.ocrCount||0))))apply.disabled=false;
}
async function repair(){
  if(running)return;
  const batch=window.__batchAnalysis;
  if(!Array.isArray(batch)||!batch.length)return;
  const pending=batch.map((a,i)=>({a,i})).filter(({a})=>!a?.error&&!a.__flexHyphenAnalysisDone&&hasFlexibleHyphenRule(a));
  if(!pending.length)return;
  running=true;const changed=[];
  try{
    for(const {a,i} of pending){
      let doc=null;
      try{
        doc=mupdf.PDFDocument.openDocument(new Uint8Array(a.data),'application/pdf');
        const rules=(a.counts||[]).filter(c=>Number(c?.count||0)===0&&/[-‐‑‒–—−]/.test(String(c?.find||'')));
        for(const c of rules){let total=0,pages=[];for(let p=0;p<doc.countPages();p++){const n=countRule(lineText(doc.loadPage(p)),c.find);if(n){total+=n;pages.push(p+1)}}if(total){c.count=total;c.pages=pages;if(!changed.includes(i))changed.push(i)}}
      }catch(e){console.warn('Flexible-hyphen analysis adapter:',a?.name||'PDF',e)}
      finally{try{doc?.destroy()}catch(_){}a.__flexHyphenAnalysisDone=true}
    }
    if(changed.length){refreshVisibleRows(changed);window.__refreshBatchResultLines?.()}
  }finally{running=false}
}
function schedule(){clearTimeout(timer);timer=setTimeout(repair,80)}
const host=q('#batchTable')||document.body;
new MutationObserver(schedule).observe(host,{childList:true,subtree:true});
document.addEventListener('click',e=>{if(e.target?.closest?.('#batchAnalyze'))setTimeout(schedule,120)},true);
