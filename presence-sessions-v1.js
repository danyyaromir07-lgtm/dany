// Completely isolated active-session indicator.
// Never reads files, batch state, OCR state, PDF bytes, diagnostics, Preview or Apply.
// If configuration/backend is unavailable, it fails closed and removes its own UI.
const CFG=window.__PDFTOOLS_PRESENCE_CONFIG||{};
const HEARTBEAT=Math.max(15,Number(CFG.heartbeatSeconds||25))*1000;
const ACTIVE_WINDOW=Math.max(45,Number(CFG.activeWindowSeconds||90));
let timer=null,sessionId=null,chip=null,stopped=false;

function validConfig(){return CFG.enabled===true&&/^https:\/\/[^/]+\.supabase\.co\/?$/i.test(String(CFG.supabaseUrl||''))&&/^sb_publishable_/i.test(String(CFG.publishableKey||''));}
function getSessionId(){try{let id=sessionStorage.getItem('pdftools_presence_session');if(!id){id=crypto.randomUUID();sessionStorage.setItem('pdftools_presence_session',id);}return id;}catch(_){return crypto.randomUUID();}}
function ensureChip(){if(chip?.isConnected)return chip;const host=document.querySelector('.hero-actions');if(!host)return null;chip=document.createElement('div');chip.id='presenceSessions';chip.setAttribute('role','status');chip.setAttribute('aria-live','polite');chip.title='Sesiones activas aproximadas en los últimos '+ACTIVE_WINDOW+' segundos';chip.style.cssText='display:inline-flex;align-items:center;gap:6px;padding:7px 10px;border-radius:999px;border:1px solid rgba(34,197,94,.28);background:rgba(34,197,94,.08);font-size:12px;font-weight:700;white-space:nowrap;user-select:none';chip.innerHTML='<span aria-hidden="true" style="width:7px;height:7px;border-radius:50%;background:#22c55e;display:inline-block"></span><span>Sesiones activas: …</span>';host.prepend(chip);return chip;}
function render(n){const el=ensureChip();if(!el)return;const v=Math.max(0,Number(n||0));el.querySelector('span:last-child').textContent=`Sesiones activas: ${v}`;}
function hide(){try{chip?.remove();}catch(_){}chip=null;}
function headers(){return{'apikey':CFG.publishableKey,'Authorization':'Bearer '+CFG.publishableKey,'Content-Type':'application/json'};}
async function rpc(name,body,{keepalive=false}={}){const base=String(CFG.supabaseUrl).replace(/\/$/,'');const r=await fetch(`${base}/rest/v1/rpc/${name}`,{method:'POST',headers:headers(),body:JSON.stringify(body),cache:'no-store',keepalive});if(!r.ok)throw new Error(`presence ${name}: HTTP ${r.status}`);return r.json();}
async function beat(){if(stopped||document.visibilityState==='hidden')return;try{const result=await rpc('pdftools_presence_heartbeat',{p_session_id:sessionId,p_active_window_seconds:ACTIVE_WINDOW});const count=Array.isArray(result)?result[0]?.active_count:result?.active_count??result;render(count);}catch(err){console.warn('[presence]',err);hide();}}
async function leave(){if(!validConfig()||!sessionId)return;try{await rpc('pdftools_presence_leave',{p_session_id:sessionId},{keepalive:true});}catch(_){}}
function start(){if(!validConfig()){hide();return;}sessionId=getSessionId();ensureChip();beat();timer=setInterval(beat,HEARTBEAT);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')beat();});window.addEventListener('pagehide',()=>{stopped=true;if(timer)clearInterval(timer);leave();},{once:true});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
window.__PDFToolsPresenceV1={version:1,beat};
