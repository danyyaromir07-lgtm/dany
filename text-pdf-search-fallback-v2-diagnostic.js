import { editTextByPageSearch as baseEditTextByPageSearch } from './text-pdf-search-fallback-v1.js?v=20260821-diagbase1';

function phase(){
  const s=String(document.querySelector('#batchStatus')?.textContent||'');
  if(/previsual/i.test(s))return 'PREVIEW';
  if(/aplic/i.test(s))return 'APPLY';
  return 'OTHER';
}
function searchCount(doc,text){
  const needle=String(text||'').trim();
  if(!needle)return 0;
  let total=0;
  try{for(let i=0;i<doc.countPages();i++)total+=Number((doc.loadPage(i).search(needle)||[]).length||0)}catch(_){}
  return total;
}
function box(){
  let pre=document.querySelector('#textRouteDiag');
  if(pre)return pre;
  const status=document.querySelector('#batchStatus');
  if(!status)return null;
  const details=document.createElement('details');
  details.open=true;
  details.style.marginTop='8px';
  details.innerHTML='<summary><strong>🧭 Diagnóstico ruta texto</strong></summary><pre id="textRouteDiag" style="max-height:260px;overflow:auto;white-space:pre-wrap;margin:8px 0 0;padding:10px;background:rgba(0,0,0,.04);border-radius:8px;font-size:12px"></pre>';
  status.parentElement?.insertBefore(details,status.nextSibling);
  return details.querySelector('#textRouteDiag');
}
function log(line){try{const pre=box();if(pre){pre.textContent+=(pre.textContent?'\n':'')+line;pre.scrollTop=pre.scrollHeight}}catch(_){}
}
export function editTextByPageSearch(doc,find,replace,maxHits=50){
  const p=phase(),beforeOld=searchCount(doc,find),beforeNew=searchCount(doc,replace);
  const count=Number(baseEditTextByPageSearch(doc,find,replace,maxHits)||0);
  const afterOld=searchCount(doc,find),afterNew=searchCount(doc,replace);
  log(`${p} FALLBACK «${find}» → «${replace}» | max=${maxHits} | count=${count} | old ${beforeOld}→${afterOld} | new ${beforeNew}→${afterNew}`);
  return count;
}
if(typeof window!=='undefined')window.__textFallbackDiagnostic={version:'2+route-diagnostic1'};
