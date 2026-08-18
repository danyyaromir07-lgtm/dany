// Passive performance diagnostics for Analyze PDFs and Apply.
// Observes existing signals and optional timing hooks only. It never opens PDFs, changes bytes,
// calls OCR/cloud detectors, enables buttons, or participates in completion decisions.
const ANALYZE='#batchAnalyze',APPLY='#batchApply',FILES='#batchFiles',STATUS='#batchStatus',PROGRESS_TEXT='#batchProgressText';
const PANEL_ID='performanceDiagnosticsPanel',MAX_EVENTS=800;
const q=s=>document.querySelector(s);
const events=[];
let cycle=null,applyCycle=null,statusObserver=null,progressObserver=null,lagTimer=null,longTaskObserver=null;

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
function batchSnapshot(){
  const batch=Array.isArray(window.__batchAnalysis)?window.__batchAnalysis:[];
  return{count:batch.length,total:batch.reduce((n,x)=>n+Number(x?.data?.byteLength||x?.data?.length||0),0)};
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
  panel.innerHTML='<details><summary><strong>⏱ Diagnóstico de rendimiento</strong> — análisis + aplicación, tiempos, memoria y bloqueos</summary><div style="margin-top:10px"><div id="perfDiagSummary" style="font-size:.9rem;margin-bottom:8px">Diagnóstico pasivo cargado. Sin actividad todavía.</div><pre id="perfDiagLog" style="max-height:420px;overflow:auto;white-space:pre-wrap;margin:0;padding:10px;background:rgba(0,0,0,.04);border-radius:8px;font-size:12px">Pulsa Analizar PDFs para medir el ciclo sin modificar el procesamiento.</pre><div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap"><button id="perfDiagCopy" class="secondary small" type="button">Copiar diagnóstico</button><button id="perfDiagClear" class="secondary small" type="button">Limpiar</button></div></div></details>';
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
    e.index!=null&&e.total!=null&&`PDF=${e.index}/${e.total}`,
    e.sizeBytes!=null&&`tamaño=${fmtMB(e.sizeBytes)}`,
    e.outputBytes!=null&&`salida=${fmtMB(e.outputBytes)}`,
    e.ms!=null&&`tiempo=${fmtMs(e.ms)}`,
    e.memUsed!=null&&`memoria=${fmtMB(e.memUsed)}`,
    e.memDelta!=null&&`Δmem=${e.memDelta>=0?'+':''}${fmtMB(e.memDelta)}`,
    e.peakMem!=null&&`pico=${fmtMB(e.peakMem)}`,
    e.longTasks!=null&&`long-tasks=${e.longTasks}`,
    e.longTaskMs!=null&&`bloqueado=${fmtMs(e.longTaskMs)}`,
    e.maxLag!=null&&`lag-máx=${fmtMs(e.maxLag)}`,
    e.removed!=null&&`eliminadas=${e.removed}`,
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
function applyStageRows(){
  if(!applyCycle)return[];
  return[...applyCycle.stageTotals.entries()].map(([name,ms])=>({name,ms})).sort((a,b)=>b.ms-a.ms);
}
function buildSummaryText(){
  const lines=[];
  if(cycle?.finished){
    const stageRows=displayStageRows(),fileRows=[...cycle.fileTimes].sort((a,b)=>b.ms-a.ms),total=cycle.totalMs||0;
    lines.push('','📊 RESUMEN DE RENDIMIENTO',`Tiempo total análisis: ${fmtMs(total)}`);
    if(stageRows.length){lines.push('','Etapas más costosas:');stageRows.slice(0,8).forEach((r,i)=>lines.push(`${i+1}. ${r.name}: ${fmtMs(r.ms)}${total?` · ${(r.ms/total*100).toFixed(1)}%`:''}`));}
    if(fileRows.length){lines.push('','PDFs más lentos en análisis base:');fileRows.slice(0,5).forEach((r,i)=>lines.push(`${i+1}. ${r.file}: ${fmtMs(r.ms)}`));}
    if(Number.isFinite(cycle.peakMem)){const delta=cycle.startMem==null?null:cycle.peakMem-cycle.startMem;lines.push('',`Memoria JS análisis: inicio=${cycle.startMem==null?'n/d':fmtMB(cycle.startMem)} · pico=${fmtMB(cycle.peakMem)}${delta==null?'':` · aumento pico=${delta>=0?'+':''}${fmtMB(delta)}`}`);}else lines.push('','Memoria JS análisis: n/d en este navegador.');
    lines.push(`Bloqueos análisis: ${cycle.longTaskCount} · ${fmtMs(cycle.longTaskMs)} acumulados · mayor=${fmtMs(cycle.maxLongTask)}`);
    lines.push(`Retraso máximo análisis: ${fmtMs(cycle.maxLag)}`);
    if(cycle.hiddenMs>0)lines.push(`Tiempo de análisis con pestaña en segundo plano: ${fmtMs(cycle.hiddenMs)}.`);
    const bottleneck=stageRows[0];if(bottleneck)lines.push('',`🔴 Principal cuello de botella observado en análisis: ${bottleneck.name} (${fmtMs(bottleneck.ms)}).`);
  }
  if(applyCycle?.finished){
    const stageRows=applyStageRows(),fileRows=[...applyCycle.fileTimes].sort((a,b)=>b.ms-a.ms),total=applyCycle.totalMs||0;
    lines.push('','📦 RESUMEN DE APLICACIÓN',`Tiempo total Apply + ZIP: ${fmtMs(total)}`);
    if(stageRows.length){lines.push('','Etapas Apply más costosas:');stageRows.slice(0,10).forEach((r,i)=>lines.push(`${i+1}. ${r.name}: ${fmtMs(r.ms)}${total?` · ${(r.ms/total*100).toFixed(1)}%`:''}`));}
    if(fileRows.length){lines.push('','PDFs más lentos durante Apply:');fileRows.slice(0,8).forEach((r,i)=>lines.push(`${i+1}. ${r.file}: ${fmtMs(r.ms)}`));}
    if(Number.isFinite(applyCycle.peakMem)){const delta=applyCycle.startMem==null?null:applyCycle.peakMem-applyCycle.startMem;lines.push('',`Memoria JS Apply: inicio=${applyCycle.startMem==null?'n/d':fmtMB(applyCycle.startMem)} · pico=${fmtMB(applyCycle.peakMem)}${delta==null?'':` · aumento pico=${delta>=0?'+':''}${fmtMB(delta)}`}`);}else lines.push('','Memoria JS Apply: n/d en este navegador.');
    lines.push(`Bloqueos Apply: ${applyCycle.longTaskCount} · ${fmtMs(applyCycle.longTaskMs)} acumulados · mayor=${fmtMs(applyCycle.maxLongTask)}`);
    lines.push(`Retraso máximo Apply: ${fmtMs(applyCycle.maxLag)}`);
    if(applyCycle.hiddenMs>0)lines.push(`Tiempo de Apply con pestaña en segundo plano: ${fmtMs(applyCycle.hiddenMs)}.`);
    const bottleneck=stageRows[0];if(bottleneck)lines.push('',`🔴 Principal cuello de botella observado en Apply: ${bottleneck.name} (${fmtMs(bottleneck.ms)}).`);
  }
  return lines.join('\n');
}
function render(){
  ensurePanel();
  const summary=q('#perfDiagSummary'),log=q('#perfDiagLog'),mem=memorySnapshot();
  if(summary){
    if(applyCycle&&!applyCycle.finished)summary.textContent=`Midiendo Apply · ${applyCycle.currentStage||'preparación inicial'}${mem?` · memoria ${fmtMB(mem.used)}`:''}`;
    else if(applyCycle?.finished){const rows=applyStageRows();summary.textContent=rows.length?`Apply FIN · total ${fmtMs(applyCycle.totalMs)} · cuello de botella: ${rows[0].name} (${fmtMs(rows[0].ms)})`:`Apply FIN · total ${fmtMs(applyCycle.totalMs)}`;}
    else if(cycle?.finished){const rows=displayStageRows();summary.textContent=rows.length?`Análisis FIN · total ${fmtMs(cycle.totalMs)} · cuello de botella: ${rows[0].name} (${fmtMs(rows[0].ms)})`:`Análisis FIN · total ${fmtMs(cycle.totalMs)}`;}
    else if(cycle)summary.textContent=`Midiendo análisis · ${cycle.currentStage||'iniciando'}${mem?` · memoria ${fmtMB(mem.used)}`:''}`;
    else summary.textContent='Diagnóstico pasivo cargado. Sin actividad todavía.';
  }
  if(log)log.textContent=events.map(eventLine).join('\n')+buildSummaryText();
}
function reset(){
  events.length=0;if(cycle?.finished)cycle=null;if(applyCycle?.finished)applyCycle=null;if(!activeRun())stopSamplers();render();
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
function analysisStatusChanged(text){
  if(!cycle||cycle.finished||!text||text===cycle.lastStatus)return;cycle.lastStatus=text;
  push('perf.status',text);
  const m=/^Analizando\s+\d+\s+de\s+\d+:\s*(.+)$/i.exec(text);
  if(m){closeCurrentFile();cycle.currentFile=m[1].trim();cycle.fileStarted=pnow();}
  else if(/Iniciando búsqueda OCR/i.test(text)){closeCurrentFile();if(cycle.ocrPrincipalStarted==null)cycle.ocrPrincipalStarted=pnow();}
  else if(/Análisis terminado|ERROR/i.test(text))closeCurrentFile();
}
function activeRun(){if(applyCycle&&!applyCycle.finished)return applyCycle;if(cycle&&!cycle.finished)return cycle;return null;}
function sample(){
  const run=activeRun();if(!run)return;
  const mem=memorySnapshot();if(mem){run.peakMem=Math.max(run.peakMem??mem.used,mem.used);run.lastMem=mem.used;}
  if(run===applyCycle&&pnow()-Number(run.lastHeartbeat||0)>=5000){run.lastHeartbeat=pnow();events.push({stage:'perf.apply.heartbeat',detail:run.currentStage||'esperando siguiente etapa',memUsed:mem?.used,time:Date.now()});if(events.length>MAX_EVENTS)events.shift();}
  render();
}
function scheduleLag(){
  if(!activeRun())return;
  const planned=pnow()+1000;
  lagTimer=setTimeout(()=>{
    const run=activeRun();if(!run)return;
    const lag=Math.max(0,pnow()-planned);run.maxLag=Math.max(run.maxLag,lag);scheduleLag();
  },1000);
}
function startSamplers(){
  stopSamplers();const run=activeRun();if(!run)return;run.sampleTimer=setInterval(sample,1000);scheduleLag();
  if(typeof PerformanceObserver==='function'){
    try{
      longTaskObserver=new PerformanceObserver(list=>{
        const current=activeRun();if(!current)return;
        for(const e of list.getEntries()){const d=Number(e.duration||0);current.longTaskCount++;current.longTaskMs+=d;current.maxLongTask=Math.max(current.maxLongTask,d);}
      });
      longTaskObserver.observe({entryTypes:['longtask']});
    }catch(_){longTaskObserver=null;}
  }
}
function stopSamplers(){
  if(cycle?.sampleTimer){clearInterval(cycle.sampleTimer);cycle.sampleTimer=null;}
  if(applyCycle?.sampleTimer){clearInterval(applyCycle.sampleTimer);applyCycle.sampleTimer=null;}
  if(lagTimer){clearTimeout(lagTimer);lagTimer=null;}
  try{longTaskObserver?.disconnect();}catch(_){}longTaskObserver=null;
}
function runBase(startMem=null){return{startMem,peakMem:startMem,lastMem:startMem,longTaskCount:0,longTaskMs:0,maxLongTask:0,maxLag:0,hiddenMs:0,hiddenStarted:document.hidden?pnow():null,sampleTimer:null};}
function startCycle(detail){
  stopSamplers();
  const fs=filesSnapshot(),mem=memorySnapshot(),at=pnow(),base=runBase(mem?.used??null);
  cycle={...base,id:detail?.cycle??Date.now(),startedPerf:at,startedAt:Number(detail?.startedAt||Date.now()),finished:false,currentStage:null,stageStarted:null,stageStartMem:null,stageTotals:new Map(),fileTimes:[],currentFile:null,fileStarted:null,ocrPrincipalStarted:null,ocrPrincipalMs:0,lastStatus:'',totalMs:0};
  events.length=0;applyCycle=null;push('perf.analysis.start','INICIO diagnóstico pasivo',{files:fs.count,sizeBytes:fs.total,memUsed:mem?.used});
  startSamplers();enterStage(detail?.stage||'iniciando análisis',at);
  analysisStatusChanged(String(q(STATUS)?.textContent||'').trim());
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
function beginApplyCycle(){
  const snap=batchSnapshot();if(!snap.count)return;
  stopSamplers();const mem=memorySnapshot(),at=pnow(),base=runBase(mem?.used??null);
  applyCycle={...base,startedPerf:at,startedAt:Date.now(),finished:false,totalMs:0,currentStage:'preparación previa a Apply',stageTotals:new Map(),marks:new Map(),fileTimes:[],lastStatus:'',lastProgress:'',lastHeartbeat:at,preflightStarted:at,preflightClosed:false,engineStarted:null,currentFile:null,currentFileStarted:null,zipStarted:null};
  push('perf.apply.start','INICIO Apply',{files:snap.count,sizeBytes:snap.total,memUsed:mem?.used});
  startSamplers();
}
function closeApplyStatusFile(at=pnow()){
  if(!applyCycle?.currentFile||applyCycle.currentFileStarted==null)return;
  const ms=Math.max(0,at-applyCycle.currentFileStarted);applyCycle.fileTimes.push({file:applyCycle.currentFile,ms});
  applyCycle.stageTotals.set('procesamiento secuencial de PDFs',(applyCycle.stageTotals.get('procesamiento secuencial de PDFs')||0)+ms);
  push('perf.apply.file',applyCycle.currentFile,{ms,memUsed:memorySnapshot()?.used});
  applyCycle.currentFile=null;applyCycle.currentFileStarted=null;
}
function closeApplyPreflight(at=pnow(),detail='preparación previa a Apply (anotaciones + nubes)'){
  if(!applyCycle||applyCycle.preflightClosed)return;
  const ms=Math.max(0,at-applyCycle.preflightStarted);applyCycle.preflightClosed=true;
  applyCycle.stageTotals.set(detail,(applyCycle.stageTotals.get(detail)||0)+ms);applyCycle.currentStage=detail;
  const mem=memorySnapshot();
  push('perf.apply.stage.end',detail,{ms,memUsed:mem?.used,memDelta:mem&&applyCycle.startMem!=null?mem.used-applyCycle.startMem:null});
}
function finishApplyCycle(detail='FIN'){
  if(!applyCycle||applyCycle.finished)return;
  const at=pnow();closeApplyStatusFile(at);closeApplyPreflight(at);
  if(applyCycle.engineStarted!=null){const ms=Math.max(0,at-applyCycle.engineStarted);applyCycle.stageTotals.set('carga motores Apply',(applyCycle.stageTotals.get('carga motores Apply')||0)+ms);applyCycle.engineStarted=null;}
  if(applyCycle.zipStarted!=null){const ms=Math.max(0,at-applyCycle.zipStarted);applyCycle.stageTotals.set('generación ZIP',(applyCycle.stageTotals.get('generación ZIP')||0)+ms);applyCycle.zipStarted=null;}
  if(applyCycle.hiddenStarted!=null){applyCycle.hiddenMs+=Math.max(0,at-applyCycle.hiddenStarted);applyCycle.hiddenStarted=null;}
  for(const [key,mark] of [...applyCycle.marks.entries()]){
    const ms=Math.max(0,at-mark.at);applyCycle.stageTotals.set(mark.stage,(applyCycle.stageTotals.get(mark.stage)||0)+ms);applyCycle.marks.delete(key);
    push('perf.apply.stage.end',`${mark.stage} · cierre forzado`,{file:mark.file,ms,memUsed:memorySnapshot()?.used,warning:'etapa sin señal final explícita'});
  }
  sample();applyCycle.finished=true;applyCycle.totalMs=Math.max(0,at-applyCycle.startedPerf);stopSamplers();
  const mem=memorySnapshot();if(mem)applyCycle.peakMem=Math.max(applyCycle.peakMem??mem.used,mem.used);
  push('perf.apply.end',detail,{ms:applyCycle.totalMs,memUsed:mem?.used,peakMem:applyCycle.peakMem,longTasks:applyCycle.longTaskCount,longTaskMs:applyCycle.longTaskMs,maxLag:applyCycle.maxLag});render();
}
function applyStatusChanged(text){
  if(!applyCycle||applyCycle.finished||!text||text===applyCycle.lastStatus)return;applyCycle.lastStatus=text;
  const at=pnow();push('perf.apply.status',text);
  const m=/^Aplicando\s+(\d+)\s+de\s+(\d+):\s*(.+)$/i.exec(text);
  if(m){
    closeApplyPreflight(at);if(applyCycle.engineStarted!=null){const ms=Math.max(0,at-applyCycle.engineStarted);applyCycle.stageTotals.set('carga motores Apply',(applyCycle.stageTotals.get('carga motores Apply')||0)+ms);push('perf.apply.stage.end','carga motores Apply',{ms,memUsed:memorySnapshot()?.used});applyCycle.engineStarted=null;}
    closeApplyStatusFile(at);applyCycle.currentFile=m[3].trim();applyCycle.currentFileStarted=at;applyCycle.currentStage=`procesando PDF ${m[1]}/${m[2]}`;return;
  }
  if(/^Generando ZIP/i.test(text)){
    closeApplyStatusFile(at);closeApplyPreflight(at);applyCycle.zipStarted=at;applyCycle.currentStage='generación ZIP';push('perf.apply.stage.start','generación ZIP',{memUsed:memorySnapshot()?.used});return;
  }
  if(/^☁️/u.test(text))push('perf.apply.marker','finalizó etapa de nubes dentro de la preparación previa',{memUsed:memorySnapshot()?.used});
  if(/Aplicación terminada|ZIP generado|ERROR AL APLICAR/i.test(text))finishApplyCycle(text);
}
function applyProgressChanged(text){
  if(!applyCycle||applyCycle.finished||!text||text===applyCycle.lastProgress)return;applyCycle.lastProgress=text;
  const at=pnow();push('perf.apply.progress',text);
  if(/Cargando motores/i.test(text)){
    closeApplyPreflight(at);if(applyCycle.engineStarted==null){applyCycle.engineStarted=at;applyCycle.currentStage='carga motores Apply';push('perf.apply.stage.start','carga motores Apply',{memUsed:memorySnapshot()?.used});}
  }
  if(/ZIP listo/i.test(text)&&applyCycle.zipStarted!=null){const ms=Math.max(0,at-applyCycle.zipStarted);applyCycle.stageTotals.set('generación ZIP',(applyCycle.stageTotals.get('generación ZIP')||0)+ms);push('perf.apply.stage.end','generación ZIP',{ms,memUsed:memorySnapshot()?.used});applyCycle.zipStarted=null;}
}
function performanceSignal(e={}){
  if(e.scope!=='apply'){push('perf.signal',String(e.stage||e.detail||'señal'),e);return;}
  if(!applyCycle||applyCycle.finished)return;
  const action=String(e.action||'event'),stage=String(e.stage||'etapa Apply'),file=String(e.file||''),key=String(e.key||`${stage}::${file}::${e.index??''}`),at=pnow(),mem=memorySnapshot();
  if(action==='start'){
    applyCycle.marks.set(key,{at,mem:mem?.used??null,stage,file,index:e.index,total:e.total});applyCycle.currentStage=stage;
    push('perf.apply.stage.start',stage,{file,index:e.index,total:e.total,sizeBytes:e.sizeBytes,memUsed:mem?.used});return;
  }
  if(action==='end'){
    const mark=applyCycle.marks.get(key),ms=mark?Math.max(0,at-mark.at):Number(e.ms||0),startMem=mark?.mem??null;
    if(mark)applyCycle.marks.delete(key);applyCycle.stageTotals.set(stage,(applyCycle.stageTotals.get(stage)||0)+ms);applyCycle.currentStage=stage;
    if(file&&/procesar PDF|preparar anotaciones/i.test(stage))applyCycle.fileTimes.push({file,ms});
    push('perf.apply.stage.end',stage,{file,index:e.index,total:e.total,sizeBytes:e.sizeBytes,outputBytes:e.outputBytes,removed:e.removed,ms,memUsed:mem?.used,memDelta:mem&&startMem!=null?mem.used-startMem:null,warning:e.warning});return;
  }
  push('perf.apply.event',stage,{file,index:e.index,total:e.total,sizeBytes:e.sizeBytes,outputBytes:e.outputBytes,memUsed:mem?.used,warning:e.warning});
}
function statusChanged(){const text=String(q(STATUS)?.textContent||'').trim();analysisStatusChanged(text);applyStatusChanged(text);}
function visibilityChanged(){
  const run=activeRun();if(!run)return;const at=pnow(),stage=run===applyCycle?'perf.apply.visibility':'perf.visibility';
  if(document.hidden){if(run.hiddenStarted==null){run.hiddenStarted=at;push(stage,'Pestaña en segundo plano');}}
  else if(run.hiddenStarted!=null){run.hiddenMs+=Math.max(0,at-run.hiddenStarted);run.hiddenStarted=null;push(stage,'Pestaña visible de nuevo',{ms:run.hiddenMs});}
}
function wire(){
  ensurePanel();window.addEventListener('analysis-completion-state',onCompletion);document.addEventListener('visibilitychange',visibilityChanged);
  const status=q(STATUS);if(status){statusObserver=new MutationObserver(statusChanged);statusObserver.observe(status,{childList:true,subtree:true,characterData:true});}
  const progressText=q(PROGRESS_TEXT);if(progressText){progressObserver=new MutationObserver(()=>applyProgressChanged(String(progressText.textContent||'').trim()));progressObserver.observe(progressText,{childList:true,subtree:true,characterData:true});}
  q(APPLY)?.addEventListener('click',beginApplyCycle,true);
  render();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
window.__performanceDiagnostic=performanceSignal;
window.__performanceDiagnosticsV1={version:2,events,reset};
