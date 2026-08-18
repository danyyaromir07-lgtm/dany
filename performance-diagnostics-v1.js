// Passive performance diagnostics for Analyze PDFs.
// Observes existing completion/status signals only. It never opens PDFs, changes bytes,
// calls OCR/cloud detectors, enables buttons, or participates in completion decisions.
const ANALYZE='#batchAnalyze', FILES='#batchFiles', STATUS='#batchStatus';
const PANEL_ID='performanceDiagnosticsPanel', MAX_EVENTS=500;
const q=s=>document.querySelector(s);
const events=[];
let cycle=null, statusObserver=null, lagTimer=null, longTaskObserver=null;

const pnow=()=>performance.now();
function fmtMs(ms){const n=Number(ms||0);return n>=1000?`${(n/1000).toFixed(n>=10000?1:2)} s`:`${Math.round(n)} ms`;}
function fmtMB(bytes){const n=Number(bytes);return Number.isFinite(n)?`${(n/1048576).toFixed(1)} MB`:'n/d';}
function memorySnapshot(){
  const m=performance?.memory;
  if(!m||!Number.isFinite(Number(m.usedJSHeapSize)))return null;
  return{used:Number(m.usedJSHeapSize),total:Number(m.totalJSHeapSize||0),limit:Number(m.jsHeapSizeLimit||0)};
}
function filesSnapshot(){
  const fs=Array.from(q(FILES)?.files||[]);
  return{count:fs.length,total:fs.reduce((n,f)=>n+Number(f.size||0),0),names:fs.map(f=>f.name)};
}
function push(stage,detail='',extra={}){
  events.push({stage,detail,...extra,time:Date.now()});
  if(events.length>MAX_EVENTS)events.shift();
  render();
}
function ensurePanel(){
  let panel=q(`#${PANEL_ID}`);if(panel)return panel;
  const host=q('#analysisTool');if(!host)return null;
  panel=document.createElement('section');panel.id=PANEL_ID;panel.className='text-warning';panel.style.marginTop='12px';
  panel.innerHTML='<details><summary><strong>⏱ Diagnóstico de rendimiento</strong> — tiempos, memoria y bloqueos del navegador</summary><div style="margin-top:10px"><div id="perfDiagSummary" style="font-size:.9rem;margin-bottom:8px">Diagnóstico pasivo cargado. Sin actividad todavía.</div><pre id="perfDiagLog" style="max-height:360px;overflow:auto;white-space:pre-wrap;margin:0;padding:10px;background:rgba(0,0,0,.04);border-radius:8px;font-size:12px">Pulsa Analizar PDFs para medir el ciclo sin modificar el procesamiento.</pre><div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap"><button id="perfDiagCopy" class="secondary small" type="button">Copiar diagnóstico</button><button id="perfDiagClear" class="secondary small" type="button">Limpiar</button></div></div></details>';
  const anchor=q('#cloudDiagnosticsPanel')||q('#ocrDiagnosticsBox')||q('#batchStatus');
  if(anchor?.parentElement)anchor.parentElement.insertBefore(panel,anchor.nextSibling);else host.appendChild(panel);
  q('#perfDiagCopy')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(q('#perfDiagLog')?.textContent||'');}catch(_){}});
  q('#perfDiagClear')?.addEventListener('click',reset);
  return panel;
}
function eventLine(e,i){
  const meta=[
    e.file&&`archivo=${e.file}`,
    e.files!=null&&`PDFs=${e.files}`,
    e.sizeBytes!=null&&`tamaño=${fmtMB(e.sizeBytes)}`,
    e.ms!=null&&`tiempo=${fmtMs(e.ms)}`,
    e.memUsed!=null&&`memoria=${fmtMB(e.memUsed)}`,
    e.memDelta!=null&&`Δmem=${e.memDelta>=0?'+':''}${fmtMB(e.memDelta)}`,
    e.peakMem!=null&&`pico=${fmtMB(e.peakMem)}`,
    e.longTasks!=null&&`long-tasks=${e.longTasks}`,
    e.longTaskMs!=null&&`bloqueado=${fmtMs(e.longTaskMs)}`,
    e.maxLag!=null&&`lag-máx=${fmtMs(e.maxLag)}`,
    e.warning&&`⚠ ${e.warning}`
  ].filter(Boolean).join(' · ');
  return `${String(i+1).padStart(3,'0')} | ${e.stage} | ${e.detail}${meta?` | ${meta}`:''}`;
}
function displayStageRows(){
  if(!cycle)return[];const rows=new Map(cycle.stageTotals);const broad=Number(rows.get('análisis base / OCR principal')||0);
  if(broad>0){const base=Math.min(broad,cycle.fileTimes.reduce((n,r)=>n+r.ms,0)),ocr=Math.min(Math.max(0,broad-base),Number(cycle.ocrPrincipalMs||0));rows.delete('análisis base / OCR principal');if(base>0)rows.set('análisis base de archivos',base);if(ocr>0)rows.set('OCR principal',ocr);const other=Math.max(0,broad-base-ocr);if(other>=50)rows.set('preparación/cierre de análisis base',other);}
  if(rows.has('comprobación de nubes por estructura/color')){const ms=rows.get('comprobación de nubes por estructura/color');rows.delete('comprobación de nubes por estructura/color');rows.set('nubes por estructura/color + fallback gris',ms);}
  return[...rows.entries()].map(([name,ms])=>({name,ms})).sort((a,b)=>b.ms-a.ms);
}
function buildSummaryText(){
  if(!cycle?.finished)return '';
  const stageRows=displayStageRows();
  const fileRows=[...cycle.fileTimes].sort((a,b)=>b.ms-a.ms);
  const total=cycle.totalMs||0;
  const lines=['','📊 RESUMEN DE RENDIMIENTO',`Tiempo total: ${fmtMs(total)}`];
  if(stageRows.length){lines.push('','Etapas más costosas:');stageRows.slice(0,8).forEach((r,i)=>lines.push(`${i+1}. ${r.name}: ${fmtMs(r.ms)}${total?` · ${(r.ms/total*100).toFixed(1)}%`:''}`));}
  if(fileRows.length){lines.push('','PDFs más lentos en análisis base:');fileRows.slice(0,5).forEach((r,i)=>lines.push(`${i+1}. ${r.file}: ${fmtMs(r.ms)}`));}
  if(Number.isFinite(cycle.peakMem)){const delta=cycle.startMem==null?null:cycle.peakMem-cycle.startMem;lines.push('',`Memoria JS: inicio=${cycle.startMem==null?'n/d':fmtMB(cycle.startMem)} · pico=${fmtMB(cycle.peakMem)}${delta==null?'':` · aumento pico=${delta>=0?'+':''}${fmtMB(delta)}`}`);}else lines.push('','Memoria JS: n/d en este navegador.');
  lines.push(`Bloqueos del hilo principal: ${cycle.longTaskCount} · ${fmtMs(cycle.longTaskMs)} acumulados · mayor=${fmtMs(cycle.maxLongTask)}`);
  lines.push(`Retraso máximo del bucle de eventos: ${fmtMs(cycle.maxLag)}`);
  if(cycle.hiddenMs>0)lines.push(`Tiempo con la pestaña en segundo plano: ${fmtMs(cycle.hiddenMs)}.`);
  const bottleneck=stageRows[0];if(bottleneck)lines.push('',`🔴 Principal cuello de botella observado: ${bottleneck.name} (${fmtMs(bottleneck.ms)}).`);
  return lines.join('\n');
}
function render(){
  ensurePanel();
  const summary=q('#perfDiagSummary'),log=q('#perfDiagLog');
  if(summary){
    if(cycle?.finished){const rows=displayStageRows();summary.textContent=rows.length?`FIN · total ${fmtMs(cycle.totalMs)} · cuello de botella: ${rows[0].name} (${fmtMs(rows[0].ms)})`:`FIN · total ${fmtMs(cycle.totalMs)}`;}
    else if(cycle){const mem=memorySnapshot();summary.textContent=`Midiendo · ${cycle.currentStage||'iniciando'}${mem?` · memoria ${fmtMB(mem.used)}`:''}`;}
    else summary.textContent='Diagnóstico pasivo cargado. Sin actividad todavía.';
  }
  if(log)log.textContent=events.map(eventLine).join('\n')+buildSummaryText();
}
function reset(){
  events.length=0;if(cycle?.finished){stopSamplers();cycle=null;}render();
}
function closeCurrentStage(at=pnow()){
  if(!cycle||!cycle.currentStage||cycle.stageStarted==null)return;
  const ms=Math.max(0,at-cycle.stageStarted),name=cycle.currentStage;
  cycle.stageTotals.set(name,(cycle.stageTotals.get(name)||0)+ms);
  const mem=memorySnapshot(),start=cycle.stageStartMem;
  push('perf.stage',name,{ms,memUsed:mem?.used,memDelta:mem&&start!=null?mem.used-start:null});
  cycle.stageStarted=null;cycle.stageStartMem=null;
}
function enterStage(name,at=pnow()){
  if(!cycle||!name||name===cycle.currentStage)return;
  if(cycle.ocrPrincipalStarted!=null&&name!=='análisis base / OCR principal'){cycle.ocrPrincipalMs+=Math.max(0,at-cycle.ocrPrincipalStarted);cycle.ocrPrincipalStarted=null;}
  closeCurrentStage(at);cycle.currentStage=name;cycle.stageStarted=at;cycle.stageStartMem=memorySnapshot()?.used??null;render();
}
function closeCurrentFile(at=pnow()){
  if(!cycle?.currentFile||cycle.fileStarted==null)return;
  cycle.fileTimes.push({file:cycle.currentFile,ms:Math.max(0,at-cycle.fileStarted)});cycle.currentFile=null;cycle.fileStarted=null;
}
function statusChanged(text){
  if(!cycle||cycle.finished||!text||text===cycle.lastStatus)return;cycle.lastStatus=text;
  push('perf.status',text);
  const m=/^Analizando\s+\d+\s+de\s+\d+:\s*(.+)$/i.exec(text);
  if(m){closeCurrentFile();cycle.currentFile=m[1].trim();cycle.fileStarted=pnow();}
  else if(/Iniciando búsqueda OCR/i.test(text)){closeCurrentFile();if(cycle.ocrPrincipalStarted==null)cycle.ocrPrincipalStarted=pnow();}
  else if(/Análisis terminado|ERROR/i.test(text))closeCurrentFile();
}
function sample(){
  if(!cycle||cycle.finished)return;
  const mem=memorySnapshot();if(mem){cycle.peakMem=Math.max(cycle.peakMem??mem.used,mem.used);cycle.lastMem=mem.used;}
  render();
}
function scheduleLag(){
  if(!cycle||cycle.finished)return;
  const planned=pnow()+1000;
  lagTimer=setTimeout(()=>{
    if(!cycle||cycle.finished)return;
    const lag=Math.max(0,pnow()-planned);cycle.maxLag=Math.max(cycle.maxLag,lag);scheduleLag();
  },1000);
}
function startSamplers(){
  stopSamplers();cycle.sampleTimer=setInterval(sample,1000);scheduleLag();
  if(typeof PerformanceObserver==='function'){
    try{
      longTaskObserver=new PerformanceObserver(list=>{
        if(!cycle||cycle.finished)return;
        for(const e of list.getEntries()){const d=Number(e.duration||0);cycle.longTaskCount++;cycle.longTaskMs+=d;cycle.maxLongTask=Math.max(cycle.maxLongTask,d);}
      });
      longTaskObserver.observe({entryTypes:['longtask']});
    }catch(_){longTaskObserver=null;}
  }
}
function stopSamplers(){
  if(cycle?.sampleTimer){clearInterval(cycle.sampleTimer);cycle.sampleTimer=null;}
  if(lagTimer){clearTimeout(lagTimer);lagTimer=null;}
  try{longTaskObserver?.disconnect();}catch(_){}longTaskObserver=null;
}
function startCycle(detail){
  stopSamplers();
  const fs=filesSnapshot(),mem=memorySnapshot(),at=pnow();
  cycle={id:detail?.cycle??Date.now(),startedPerf:at,startedAt:Number(detail?.startedAt||Date.now()),finished:false,currentStage:null,stageStarted:null,stageStartMem:null,stageTotals:new Map(),fileTimes:[],currentFile:null,fileStarted:null,ocrPrincipalStarted:null,ocrPrincipalMs:0,lastStatus:'',startMem:mem?.used??null,peakMem:mem?.used??null,lastMem:mem?.used??null,longTaskCount:0,longTaskMs:0,maxLongTask:0,maxLag:0,hiddenMs:0,hiddenStarted:document.hidden?at:null,totalMs:0,sampleTimer:null};
  events.length=0;push('perf.analysis.start','INICIO diagnóstico pasivo',{files:fs.count,sizeBytes:fs.total,memUsed:mem?.used});
  startSamplers();enterStage(detail?.stage||'iniciando análisis',at);
  statusChanged(String(q(STATUS)?.textContent||'').trim());
}
function finishCycle(detail){
  if(!cycle||cycle.finished)return;
  const at=pnow();closeCurrentFile(at);if(cycle.ocrPrincipalStarted!=null){cycle.ocrPrincipalMs+=Math.max(0,at-cycle.ocrPrincipalStarted);cycle.ocrPrincipalStarted=null;}if(cycle.hiddenStarted!=null){cycle.hiddenMs+=Math.max(0,at-cycle.hiddenStarted);cycle.hiddenStarted=null;}closeCurrentStage(at);sample();cycle.finished=true;cycle.totalMs=Math.max(0,at-cycle.startedPerf);stopSamplers();
  const mem=memorySnapshot();if(mem)cycle.peakMem=Math.max(cycle.peakMem??mem.used,mem.used);
  push('perf.analysis.end',detail?.complete===false?'FIN con advertencias':'FIN',{ms:cycle.totalMs,memUsed:mem?.used,peakMem:cycle.peakMem,longTasks:cycle.longTaskCount,longTaskMs:cycle.longTaskMs,maxLag:cycle.maxLag,warning:Number(detail?.warnings||0)?`${detail.warnings} advertencia(s)`:''});
  render();
}
function onCompletion(ev){
  const d=ev?.detail||{};
  if(d.running){if(!cycle||cycle.finished||d.cycle!==cycle.id)startCycle(d);else enterStage(d.stage||cycle.currentStage);}
  else if(cycle&&d.cycle===cycle.id)finishCycle(d);
}
function visibilityChanged(){if(!cycle||cycle.finished)return;const at=pnow();if(document.hidden){if(cycle.hiddenStarted==null){cycle.hiddenStarted=at;push('perf.visibility','Pestaña en segundo plano');}}else if(cycle.hiddenStarted!=null){cycle.hiddenMs+=Math.max(0,at-cycle.hiddenStarted);cycle.hiddenStarted=null;push('perf.visibility','Pestaña visible de nuevo',{ms:cycle.hiddenMs});}}
function wire(){
  ensurePanel();window.addEventListener('analysis-completion-state',onCompletion);document.addEventListener('visibilitychange',visibilityChanged);
  const status=q(STATUS);if(status){statusObserver=new MutationObserver(()=>statusChanged(String(status.textContent||'').trim()));statusObserver.observe(status,{childList:true,subtree:true,characterData:true});}
  q(ANALYZE)?.addEventListener('click',()=>{if(cycle&&!cycle.finished)push('perf.note','Se solicitó un nuevo análisis antes de finalizar el anterior.');},true);
  render();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
window.__performanceDiagnosticsV1={version:1,events,reset};
