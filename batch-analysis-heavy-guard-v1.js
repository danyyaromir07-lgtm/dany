import * as mupdf from 'https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js';

const RAW_STREAM_LIMIT = 8 * 1024 * 1024;
const REMOVABLE = new Set(['Text','FreeText','Line','Square','Circle','Polygon','PolyLine','Highlight','Underline','Squiggly','StrikeOut','Stamp','Caret','Ink','Popup']);
const norm = s => String(s || '').replace(/\s+/g,' ').trim();
const resolve = o => { try { return o?.resolve?.() || o; } catch (_) { return o; } };
const num = o => { try { if (o?.asNumber) return Number(o.asNumber()) || 0; return Number(o?.valueOf?.() ?? o) || 0; } catch (_) { return 0; } };
function streamRef(o){ try { if (o?.isStream?.()) return o; const r=resolve(o); return r?.isStream?.()?r:null; } catch (_) { return null; } }
function refs(page){
  try{
    const c=page.getObject()?.get?.('Contents'); if(!c) return [];
    const r=resolve(c); if(r?.isArray?.()) return Array.from({length:Number(r.length||0)},(_,i)=>r.get(i));
    return [c];
  }catch(_){ return []; }
}
function rawLength(st){
  try { const n=num(st.get?.('Length')); if(n>0) return n; } catch(_){}
  try { const b=st.readRawStream?.(); return Number(b?.length||b?.byteLength||b?.asUint8Array?.()?.length||0); } catch(_) { return 0; }
}
function pageRisk(page){
  let max=0;
  for(const r of refs(page)){ const st=streamRef(r); if(!st) continue; max=Math.max(max,rawLength(st)); }
  return max;
}
function rulesFromDom(){
  const rows=[...document.querySelectorAll('#batchRows .batch-rule')];
  const out=[],seen=new Set();
  for(const row of rows){
    const find=row.querySelector('.bfind')?.value||'', replace=row.querySelector('.brepl')?.value||'';
    if(!find.trim()) continue;
    const key=norm(find).toLowerCase(); if(seen.has(key)) continue; seen.add(key);
    out.push({find,replace,count:0,annotationCount:0,ocrCount:0,ocrMatches:[],pages:[],annotationPages:[]});
  }
  return out;
}
function annInfo(page){
  const freeTexts=[]; let comments=0;
  let anns=[]; try{ anns=page.getAnnotations?.()||[]; }catch(_){}
  for(const a of anns){
    let type='',contents=''; try{type=a.getType?.()||''}catch(_){} try{contents=a.getContents?.()||''}catch(_){}
    if(REMOVABLE.has(type)) comments++;
    if(type==='FreeText') freeTexts.push({contents});
  }
  return {freeTexts,comments};
}
function countSearch(page,needle){
  try { const hits=page.search(String(needle||''),10000)||[]; return hits.length; } catch (_) { return 0; }
}
function kindLabel(a){ const x=[]; if(a.kinds.text)x.push('🟢 texto PDF'); if(a.kinds.annotation)x.push('🟠 FreeText'); if(a.kinds.vector)x.push('🟠 vectorial'); if(a.kinds.image)x.push('🔴 imagen'); return x.length?x.join(' · '):'Sin contenido clasificable'; }
function render(list){
  const table=document.querySelector('#batchTable'),summary=document.querySelector('#batchSummary'); if(!table)return;
  let totalHits=0,totalAnn=0,totalComments=0;
  for(const a of list){ if(a.error)continue; totalComments+=a.comments||0; totalHits+=(a.counts||[]).reduce((s,c)=>s+(c.count||0),0); totalAnn+=(a.counts||[]).reduce((s,c)=>s+(c.annotationCount||0),0); }
  const sf=document.querySelector('#statFiles'),se=document.querySelector('#statEdits'),sc=document.querySelector('#statComments'),sz=document.querySelector('#statZip');
  if(sf)sf.textContent=list.filter(a=>!a.error).length; if(se)se.textContent=totalHits+totalAnn; if(sc)sc.textContent=totalComments; if(sz)sz.textContent='Pendiente';
  if(summary){summary.textContent=`${list.length} PDF${list.length===1?'':'s'} analizado${list.length===1?'':'s'} · ${totalHits} coincidencia${totalHits===1?'':'s'} de texto · ${totalAnn} coincidencia${totalAnn===1?'':'s'} en FreeText · ${totalComments} comentario${totalComments===1?'':'s'}/anotación${totalComments===1?'':'es'} · modo memoria segura`;summary.classList.remove('hidden');}
  table.innerHTML='<div class="batch-head"><span>PDF</span><span>Resultado</span></div>';
  list.forEach(a=>{const row=document.createElement('div');row.className='batch-result';if(a.error){row.innerHTML=`<strong>${a.name}</strong><span class="error">Error: ${a.error}</span>`;}else{const hits=(a.counts||[]).flatMap(c=>[c.count?`${c.count}× ${c.find}`:null,c.annotationCount?`${c.annotationCount}× ${c.find} (FreeText)`:null]).filter(Boolean);row.innerHTML=`<div><strong>${a.name}</strong><small class="content-kinds">${kindLabel(a)}</small></div><span>${hits.length?hits.join(' · '):'<strong style="color:#b42318">Sin coincidencias</strong>'} · 💬 ${a.comments||0} <small>· memoria segura</small></span>`;}table.appendChild(row);});
  try{window.__refreshBatchResultLines?.()}catch(_){}
}
async function inspectRisk(file){
  const data=new Uint8Array(await file.arrayBuffer()); let doc=null,max=0;
  try{doc=mupdf.PDFDocument.openDocument(data,'application/pdf');for(let i=0;i<doc.countPages();i++)max=Math.max(max,pageRisk(doc.loadPage(i)));}
  finally{try{doc?.destroy()}catch(_){}}
  return {data,max};
}
async function safeAnalyze(files,prepared){
  const button=document.querySelector('#batchAnalyze'),clear=document.querySelector('#batchClear'),apply=document.querySelector('#batchApply'),status=document.querySelector('#batchStatus');
  if(button)button.disabled=true;if(clear)clear.disabled=true;if(apply)apply.disabled=true;
  const list=[];
  for(let fi=0;fi<files.length;fi++){
    const file=files[fi]; if(status)status.textContent=`Analizando ${fi+1} de ${files.length}: ${file.name} · memoria segura`;
    let doc=null;
    try{
      const data=prepared.get(file)?.data || new Uint8Array(await file.arrayBuffer()); doc=mupdf.PDFDocument.openDocument(data,'application/pdf');
      const counts=rulesFromDom(),kinds={text:false,annotation:false,vector:false,image:false}; let comments=0;
      for(let pi=0;pi<doc.countPages();pi++){
        const page=doc.loadPage(pi),ann=annInfo(page); comments+=ann.comments; if(ann.freeTexts.length)kinds.annotation=true;
        for(const c of counts){
          const n=countSearch(page,c.find); if(n){c.count+=n;c.pages.push(pi+1);kinds.text=true;}
          const target=norm(c.find),an=ann.freeTexts.filter(x=>norm(x.contents).includes(target)).length; if(an){c.annotationCount+=an;c.annotationPages.push(pi+1);}
        }
        await new Promise(r=>setTimeout(r,0));
      }
      list.push({name:file.name,pages:doc.countPages(),counts,comments,data,kinds,memorySafeAnalysis:true});
    }catch(e){list.push({name:file.name,error:e?.message||String(e)});}finally{try{doc?.destroy()}catch(_){}}
  }
  window.__batchAnalysis=list; render(list);
  if(status)status.textContent='Análisis terminado · modo memoria segura para streams grandes.';
  if(button)button.disabled=false;if(clear)clear.disabled=false;if(apply)apply.disabled=!list.some(a=>!a.error&&((a.counts||[]).some(c=>c.count||c.annotationCount)||a.comments>0));
}
function install(){
  const button=document.querySelector('#batchAnalyze'),input=document.querySelector('#batchFiles'); if(!button||!input)return;
  const original=button.onclick; if(typeof original!=='function'||button.dataset.heavyGuard==='1')return; button.dataset.heavyGuard='1';
  button.onclick=async function(ev){
    const files=[...(input.files||[])]; if(!files.length)return original.call(this,ev);
    const prepared=new Map(); let risky=false,max=0;
    try{
      for(const f of files){const z=await inspectRisk(f);prepared.set(f,z);max=Math.max(max,z.max);if(z.max>=RAW_STREAM_LIMIT)risky=true;}
    }catch(_){return original.call(this,ev);}
    if(!risky)return original.call(this,ev);
    try{window.__performanceDiagnostic?.({scope:'analysis',action:'start',stage:'large-stream-memory-safe',rawStreamBytes:max});}catch(_){}
    return safeAnalyze(files,prepared);
  };
  window.__batchHeavyAnalysisGuardV1={version:'1',rawStreamLimit:RAW_STREAM_LIMIT};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0));else setTimeout(install,0);
