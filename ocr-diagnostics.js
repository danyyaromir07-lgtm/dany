const panel=document.createElement('section');
panel.className='text-warning';
panel.id='ocrDiagnosticsPanel';
panel.style.marginTop='12px';
panel.innerHTML=`<details><summary><strong>🧪 Diagnóstico OCR</strong> — ver en qué etapa está, cuánto tarda y dónde falla</summary><div style="margin-top:10px"><div id="ocrDiagSummary" style="font-size:.9rem;margin-bottom:8px">Sin actividad OCR.</div><pre id="ocrDiagLog" style="max-height:280px;overflow:auto;white-space:pre-wrap;margin:0;padding:10px;background:rgba(0,0,0,.04);border-radius:8px;font-size:12px"></pre><div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap"><button id="ocrDiagCopy" class="secondary small" type="button">Copiar diagnóstico</button><button id="ocrDiagClear" class="secondary small" type="button">Limpiar</button></div></div></details>`;
const anchor=document.querySelector('#analysisTool .text-warning:last-of-type')||document.querySelector('#analysisTool');
anchor?.parentElement?.insertBefore(panel,anchor.nextSibling);

// OCR es opcional en este proyecto: se activa explícitamente desde el checkbox.
const optionsPanel=document.querySelector('#analysisTool .option-box');
if(optionsPanel&&!document.querySelector('#batchEnableOCR')){
  const wrap=document.createElement('label');
  wrap.style.marginTop='10px';
  wrap.innerHTML='<input id="batchEnableOCR" type="checkbox"><span>🔎 Buscar también en vectorial/OCR (avanzado)</span>';
  optionsPanel.appendChild(wrap);
  const hint=document.createElement('small');
  hint.textContent='Desactivado por defecto para mantener el análisis rápido. Actívalo solo para PDFs donde el texto no exista como texto PDF o FreeText.';
  optionsPanel.appendChild(hint);
}

const logEl=document.querySelector('#ocrDiagLog'),summaryEl=document.querySelector('#ocrDiagSummary');
const events=[];
function render(){const last=events.at(-1);if(summaryEl)summaryEl.textContent=last?`${last.stage} · ${last.detail}${last.ms!=null?` · ${last.ms} ms`:''}`:'Sin actividad OCR.';if(logEl)logEl.textContent=events.map((e,i)=>{const meta=[e.file&&`archivo=${e.file}`,e.page!=null&&`página=${e.page}`,e.target&&`buscar=\"${e.target}\"`,e.quadrant&&`cuadrante=${e.quadrant}`,e.mode&&`PSM=${e.mode}`,e.px&&`px=${e.px}`,e.ms!=null&&`tiempo=${e.ms}ms`,e.ocrText&&`OCR=\"${e.ocrText}\"`].filter(Boolean).join(' · ');return `${String(i+1).padStart(3,'0')} | ${e.stage} | ${e.detail}${meta?` | ${meta}`:''}`}).join('\n')}
window.__ocrDiagnostic=(e)=>{events.push({...e,file:e.file||window.__ocrCurrentFile});if(events.length>500)events.shift();render()};
window.__ocrDiagnosticsReset=()=>{events.length=0;render()};
document.querySelector('#ocrDiagCopy')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(logEl?.textContent||'');}catch(_){}});
document.querySelector('#ocrDiagClear')?.addEventListener('click',()=>window.__ocrDiagnosticsReset());
import './batch-preview-v1.js?v=20260813-preview1';
