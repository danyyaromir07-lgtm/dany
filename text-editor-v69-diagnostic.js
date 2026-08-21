import { editDoc as baseEditDoc } from './text-editor-v68.js?v=20260821-diagbase1';

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
function log(line){
  try{
    const pre=box();
    if(pre){pre.textContent+=(pre.textContent?'\n':'')+line;pre.scrollTop=pre.scrollHeight}
  }catch(_){}
}
export function editDoc(doc,find,replace){
  const p=phase(),beforeOld=searchCount(doc,find),beforeNew=searchCount(doc,replace);
  try{
    const count=Number(baseEditDoc(doc,find,replace)||0);
    const afterOld=searchCount(doc,find),afterNew=searchCount(doc,replace);
    log(`${p} DIRECT «${find}» → «${replace}» | count=${count} | old ${beforeOld}→${afterOld} | new ${beforeNew}→${afterNew} | v68=${window.__textEditorV68?.version||'?'}`);
    return count;
  }catch(error){
    const afterOld=searchCount(doc,find),afterNew=searchCount(doc,replace);
    log(`${p} DIRECT ERROR «${find}» → «${replace}» | error=${error?.message||String(error)} | old ${beforeOld}→${afterOld} | new ${beforeNew}→${afterNew} | v68=${window.__textEditorV68?.version||'?'}`);
    throw error;
  }
}
if(typeof window!=='undefined')window.__textEditorV69={version:'69+route-diagnostic2'};
