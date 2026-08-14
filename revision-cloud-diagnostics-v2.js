const PANEL_ID='cloudDiagnosticsPanel';
const MAX_EVENTS=600;
const events=[];

function q(s){return document.querySelector(s);}
function fmtNum(v,d=4){const n=Number(v);return Number.isFinite(n)?n.toFixed(d):String(v??'');}
function fmtBBox(v){return Array.isArray(v)&&v.length>=4?`[${v.slice(0,4).map(x=>fmtNum(x,1)).join(', ')}]`:'';}
function fmtRGB(v){return Array.isArray(v)&&v.length>=3?`(${v.slice(0,3).map(x=>fmtNum(x,5)).join(', ')})`:'';}

function ensurePanel(){
  if(q('#'+PANEL_ID)) return;
  const host=q('#analysisTool');
  if(!host) return;
  const panel=document.createElement('section');
  panel.className='text-warning';
  panel.id=PANEL_ID;
  panel.style.marginTop='12px';
  panel.innerHTML=`<details><summary><strong>🧪 Diagnóstico de nubes</strong> — detección raster, familia vectorial y borrado seguro</summary><div style="margin-top:10px"><div id="cloudDiagSummary" style="font-size:.9rem;margin-bottom:8px">Sin actividad de nubes.</div><pre id="cloudDiagLog" style="max-height:320px;overflow:auto;white-space:pre-wrap;margin:0;padding:10px;background:rgba(0,0,0,.04);border-radius:8px;font-size:12px"></pre><div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap"><button id="cloudDiagCopy" class="secondary small" type="button">Copiar diagnóstico</button><button id="cloudDiagClear" class="secondary small" type="button">Limpiar</button></div></div></details>`;
  const anchor=q('#ocrDiagnosticsPanel')||q('#ocrDiagnosticsBox')||q('#batchStatus');
  if(anchor?.parentElement) anchor.parentElement.insertBefore(panel,anchor.nextSibling); else host.appendChild(panel);
  q('#cloudDiagCopy')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(q('#cloudDiagLog')?.textContent||'');}catch(_){}});
  q('#cloudDiagClear')?.addEventListener('click',()=>window.__cloudDiagnosticsReset?.());
}

function render(){
  ensurePanel();
  const log=q('#cloudDiagLog'),summary=q('#cloudDiagSummary'),last=events.at(-1);
  if(summary) summary.textContent=last?`${last.stage} · ${last.detail}`:'Sin actividad de nubes.';
  if(!log) return;
  log.textContent=events.map((e,i)=>{
    const meta=[
      e.file&&`archivo=${e.file}`,
      e.page!=null&&`página=${e.page}`,
      e.rotation!=null&&`rotación=${e.rotation}°`,
      e.source&&`fuente=${e.source}`,
      e.rgb&&`RGB=${fmtRGB(e.rgb)}`,
      e.lineWidth!=null&&`grosor=${fmtNum(e.lineWidth,5)}`,
      e.strokes!=null&&`trazos=${e.strokes}`,
      e.groups!=null&&`familias=${e.groups}`,
      e.candidates!=null&&`candidatas=${e.candidates}`,
      e.components!=null&&`componentes=${e.components}`,
      e.main!=null&&`principal=${e.main}`,
      e.density!=null&&`densidad=${fmtNum(e.density,4)}`,
      e.fraction!=null&&`fracción=${fmtNum(e.fraction,5)}`,
      e.bbox&&`bbox=${fmtBBox(e.bbox)}`,
      e.block&&`bloque=${e.block}`,
      e.reason&&`motivo=${e.reason}`,
      e.error&&`error=${e.error}`
    ].filter(Boolean).join(' · ');
    return `${String(i+1).padStart(3,'0')} | ${e.stage} | ${e.detail}${meta?` | ${meta}`:''}`;
  }).join('\n');
}

window.__cloudDiagnostic=(event={})=>{
  events.push({...event,time:Date.now()});
  if(events.length>MAX_EVENTS) events.shift();
  render();
};
window.__cloudDiagnosticsReset=()=>{events.length=0;render();};
window.__cloudDiagnosticsEvents=events;

function wire(){
  ensurePanel();
  q('#batchAnalyze')?.addEventListener('click',()=>{
    if(!q('#batchRemoveRevisionClouds')?.checked) return;
    window.__cloudDiagnosticsReset();
    window.__cloudDiagnostic({stage:'cloud.start',detail:'INICIO'});
  },true);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
