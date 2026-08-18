// Persistencia pasiva del diagnóstico de rendimiento.
// Solo guarda valores primitivos/diagnósticos en localStorage; nunca abre PDFs,
// nunca conserva bytes de archivos y nunca participa en Analyze/Apply/ZIP.
const STORAGE_KEY='pdf-tools::performance-diagnostic-snapshot-v1';
const STATUS='#batchStatus',PROGRESS='#batchProgressText',APPLY='#batchApply',ANALYZE='#batchAnalyze';
const MAX_EVENTS=160;
const q=s=>document.querySelector(s);
let timer=null,observer=null,lastSavedText='';

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
function snapshot(reason='intervalo'){
  try{
    const api=window.__performanceDiagnosticsV1;
    const events=Array.isArray(api?.events)?api.events.slice(-MAX_EVENTS).map(cleanEvent).filter(Boolean):[];
    const data={
      version:1,
      savedAt:Date.now(),
      reason:String(reason||''),
      href:String(location.href||''),
      status:String(q(STATUS)?.textContent||''),
      progress:String(q(PROGRESS)?.textContent||''),
      memoryUsed:mem(),
      events
    };
    const text=JSON.stringify(data);
    if(text!==lastSavedText){localStorage.setItem(STORAGE_KEY,text);lastSavedText=text;}
    return data;
  }catch(_){return null;}
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
  const lines=[
    'DIAGNÓSTICO DE RENDIMIENTO RECUPERADO',
    `Guardado: ${fmtDate(data.savedAt)}`,
    `Motivo: ${data.reason||''}`,
    `Estado: ${data.status||''}`,
    `Progreso: ${data.progress||''}`,
    `Memoria JS: ${fmtMB(data.memoryUsed)}`,
    '',
    'EVENTOS'
  ];
  (Array.isArray(data.events)?data.events:[]).forEach((e,i)=>lines.push(eventLine(e,i)));
  return lines.join('\n');
}
function download(){
  const text=toText();
  const blob=new Blob([text],{type:'text/plain;charset=utf-8'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='diagnostico_rendimiento_recuperado.txt';document.body.appendChild(a);a.click();
  setTimeout(()=>{try{a.remove();URL.revokeObjectURL(url);}catch(_){}},1000);
}
function clear(){try{localStorage.removeItem(STORAGE_KEY);lastSavedText='';}catch(_){} }
function ensureButton(){
  const panel=q('#performanceDiagnosticsPanel');if(!panel||q('#perfDiagRecoveredDownload'))return;
  const host=panel.querySelector('details > div');if(!host)return;
  const row=document.createElement('div');row.style.cssText='margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;align-items:center';
  const b=document.createElement('button');b.id='perfDiagRecoveredDownload';b.type='button';b.className='secondary small';b.textContent='Descargar diagnóstico recuperado';b.addEventListener('click',download);
  const info=document.createElement('span');info.id='perfDiagRecoveredInfo';info.style.fontSize='12px';
  const old=read();info.textContent=old?`Última copia persistente: ${fmtDate(old.savedAt)} · ${old.status||old.reason||''}`:'Sin copia persistente todavía.';
  row.append(b,info);host.appendChild(row);
}
function install(){
  ensureButton();
  observer=new MutationObserver(()=>{snapshot('cambio de estado/progreso');ensureButton();});
  const s=q(STATUS),p=q(PROGRESS);if(s)observer.observe(s,{childList:true,subtree:true,characterData:true});if(p)observer.observe(p,{childList:true,subtree:true,characterData:true});
  q(APPLY)?.addEventListener('click',()=>snapshot('clic Apply'),true);
  q(ANALYZE)?.addEventListener('click',()=>snapshot('clic Analizar'),true);
  window.addEventListener('pagehide',()=>snapshot('pagehide'));
  document.addEventListener('visibilitychange',()=>snapshot(document.hidden?'pestaña oculta':'pestaña visible'));
  timer=setInterval(()=>snapshot('intervalo 2 s'),2000);
  snapshot('módulo cargado');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
window.__performancePersistenceV1={version:1,read,toText,download,clear,snapshot};
