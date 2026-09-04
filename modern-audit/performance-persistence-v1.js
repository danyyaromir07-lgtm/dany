// Persistencia pasiva del diagnóstico de rendimiento.
// Solo guarda valores primitivos/diagnósticos en localStorage; nunca abre PDFs,
// nunca conserva bytes de archivos y nunca participa en Analyze/Apply/ZIP.
const STORAGE_KEY='pdf-tools::performance-diagnostic-snapshot-v1';
const APPLY_CRUMB_KEY='pdf-tools::apply-breadcrumb-v1';
const HEAVY_CRUMB_KEY='pdf_tools_heavy_text_breadcrumb_v1';
const STATUS='#batchStatus',PROGRESS='#batchProgressText',APPLY='#batchApply',ANALYZE='#batchAnalyze';
const MAX_EVENTS=800;
const q=s=>document.querySelector(s);
let timer=null,observer=null,settleTimer=null,lastSavedText='';

function mem(){
  try{
    const m=performance?.memory;
    return m&&Number.isFinite(Number(m.usedJSHeapSize))?Number(m.usedJSHeapSize):null;
  }catch(_){return null;}
}
function cleanEvent(e){
  if(!e||typeof e!=='object')return null;
  const out={};
  for(const [k,v] of Object.entries(e)){
    if(v==null||typeof v==='string'||typeof v==='number'||typeof v==='boolean')out[k]=v;
  }
  return out;
}
function readSmall(key){try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):null;}catch(_){return null;}}
function writeApplyCrumb(stage,extra={}){try{localStorage.setItem(APPLY_CRUMB_KEY,JSON.stringify({at:new Date().toISOString(),stage,...extra}));}catch(_){}}
function crumbLine(label,data){if(!data)return '';const parts=[String(data.stage||'')];for(const [k,v] of Object.entries(data)){if(k==='stage'||k==='at'||v==null||typeof v==='object')continue;parts.push(`${k}=${v}`);}return `${label}: ${parts.filter(Boolean).join(' · ')}${data.at?` · ${data.at}`:''}`;}
function currentLog(){
  try{return String(q('#perfDiagLog')?.textContent||'');}catch(_){return '';}
}
function updateInfo(data){
  try{
    const info=q('#perfDiagRecoveredInfo');
    if(!info)return;
    info.textContent=data?`Última copia persistente: ${fmtDate(data.savedAt)} · ${data.status||data.reason||''}`:'Sin copia persistente todavía.';
  }catch(_){}
}
function snapshot(reason='intervalo'){
  try{
    const api=window.__performanceDiagnosticsV1;
    const events=Array.isArray(api?.events)?api.events.slice(-MAX_EVENTS).map(cleanEvent).filter(Boolean):[];
    const data={
      version:3,
      savedAt:Date.now(),
      reason:String(reason||''),
      href:String(location.href||''),
      status:String(q(STATUS)?.textContent||''),
      progress:String(q(PROGRESS)?.textContent||''),
      memoryUsed:mem(),
      liveText:currentLog(),
      events
    };
    const text=JSON.stringify(data);
    if(text!==lastSavedText){localStorage.setItem(STORAGE_KEY,text);lastSavedText=text;}
    updateInfo(data);
    return data;
  }catch(_){return null;}
}
function settledSnapshot(reason){
  if(settleTimer)clearTimeout(settleTimer);
  settleTimer=setTimeout(()=>snapshot(reason||'estado estabilizado'),150);
}
function read(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);return raw?JSON.parse(raw):null;
  }catch(_){return null;}
}
function fmtMB(n){return Number.isFinite(Number(n))?`${(Number(n)/1048576).toFixed(1)} MB`:'n/d';}
function fmtDate(ms){try{return new Date(Number(ms)).toLocaleString();}catch(_){return String(ms||'');}}
function eventLine(e,i){
  const name=String(e?.stage||'evento'),detail=String(e?.detail||'');
  const meta=[];
  for(const k of ['file','files','index','total','sizeBytes','outputBytes','ms','memUsed','memDelta','peakMem','longTasks','longTaskMs','maxLag','removed','warning']){
    if(e?.[k]!=null)meta.push(`${k}=${e[k]}`);
  }
  return `${String(i+1).padStart(3,'0')} | ${name}${detail?` | ${detail}`:''}${meta.length?` | ${meta.join(' · ')}`:''}`;
}
function toText(data=read()){
  if(!data)return 'No hay diagnóstico persistido.';
  const applyCrumb=readSmall(APPLY_CRUMB_KEY),heavyCrumb=readSmall(HEAVY_CRUMB_KEY);
  const lines=[
    'DIAGNÓSTICO DE RENDIMIENTO RECUPERADO',
    `Guardado: ${fmtDate(data.savedAt)}`,
    `Motivo: ${data.reason||''}`,
    `Estado: ${data.status||''}`,
    `Progreso: ${data.progress||''}`,
    `Memoria JS: ${fmtMB(data.memoryUsed)}`
  ];
  const a=crumbLine('Último breadcrumb Apply',applyCrumb),h=crumbLine('Último breadcrumb texto pesado',heavyCrumb);
  if(a)lines.push(a);if(h)lines.push(h);lines.push('');
  if(String(data.liveText||'').trim()){
    lines.push('DIAGNÓSTICO COMPLETO CAPTURADO','',String(data.liveText));
  }else{
    lines.push('EVENTOS');
    (Array.isArray(data.events)?data.events:[]).forEach((e,i)=>lines.push(eventLine(e,i)));
  }
  return lines.join('\n');
}
function saveText(text,filename){
  const blob=new Blob([String(text||'')],{type:'text/plain;charset=utf-8'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=filename;document.body.appendChild(a);a.click();
  setTimeout(()=>{try{a.remove();URL.revokeObjectURL(url);}catch(_){}},1000);
}
function downloadRecovered(){
  saveText(toText(),'diagnostico_rendimiento_recuperado.txt');
}
function downloadCurrent(){
  const data=snapshot('descarga diagnóstico actual');
  const live=currentLog();
  if(live.trim()){
    const applyCrumb=readSmall(APPLY_CRUMB_KEY),heavyCrumb=readSmall(HEAVY_CRUMB_KEY);
    const extras=[crumbLine('Último breadcrumb Apply',applyCrumb),crumbLine('Último breadcrumb texto pesado',heavyCrumb)].filter(Boolean);
    const header=[
      'DIAGNÓSTICO DE RENDIMIENTO ACTUAL',
      `Guardado: ${fmtDate(data?.savedAt||Date.now())}`,
      `Estado: ${String(q(STATUS)?.textContent||'')}`,
      `Progreso: ${String(q(PROGRESS)?.textContent||'')}`,
      `Memoria JS: ${fmtMB(mem())}`,
      ...extras,
      '',
      live
    ].join('\n');
    saveText(header,'diagnostico_rendimiento_actual.txt');
  }else saveText(toText(data),'diagnostico_rendimiento_actual.txt');
}
function clear(){try{localStorage.removeItem(STORAGE_KEY);localStorage.removeItem(APPLY_CRUMB_KEY);localStorage.removeItem(HEAVY_CRUMB_KEY);lastSavedText='';updateInfo(null);}catch(_){} }
function ensureButton(){
  const panel=q('#performanceDiagnosticsPanel');if(!panel)return;
  const host=panel.querySelector('details > div');if(!host)return;
  let row=q('#perfDiagPersistenceRow');
  if(!row){
    row=document.createElement('div');row.id='perfDiagPersistenceRow';row.style.cssText='margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;align-items:center';
    const current=document.createElement('button');current.id='perfDiagCurrentDownload';current.type='button';current.className='secondary small';current.textContent='Descargar diagnóstico actual';current.addEventListener('click',downloadCurrent);
    const recovered=document.createElement('button');recovered.id='perfDiagRecoveredDownload';recovered.type='button';recovered.className='secondary small';recovered.textContent='Descargar diagnóstico recuperado';recovered.addEventListener('click',downloadRecovered);
    const info=document.createElement('span');info.id='perfDiagRecoveredInfo';info.style.fontSize='12px';
    row.append(current,recovered,info);host.appendChild(row);
  }
  updateInfo(read());
}
function install(){
  ensureButton();
  observer=new MutationObserver(()=>{
    snapshot('cambio de estado/progreso');
    settledSnapshot('estado/progreso estabilizado');
    ensureButton();
  });
  const s=q(STATUS),p=q(PROGRESS);if(s)observer.observe(s,{childList:true,subtree:true,characterData:true});if(p)observer.observe(p,{childList:true,subtree:true,characterData:true});
  q(APPLY)?.addEventListener('click',()=>{writeApplyCrumb('clic Apply · captura');snapshot('clic Apply');settledSnapshot('Apply iniciado');},true);
  q(ANALYZE)?.addEventListener('click',()=>{snapshot('clic Analizar');settledSnapshot('Análisis iniciado');},true);
  window.addEventListener('pagehide',()=>snapshot('pagehide'));
  document.addEventListener('visibilitychange',()=>snapshot(document.hidden?'pestaña oculta':'pestaña visible'));
  timer=setInterval(()=>snapshot('intervalo 2 s'),2000);
  snapshot('módulo cargado');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
window.__performancePersistenceV1={version:3,read,toText,download:downloadRecovered,downloadCurrent,clear,snapshot};
