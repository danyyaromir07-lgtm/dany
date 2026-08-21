// Text-only WinAnsi priority with corrected page-resource and PDF-null lookup. No cloud or graphics routing is changed.
import { editDoc as baseEditDoc } from './text-editor-v65.js?v=20260821-textonly-base2';
import { editSimpleWinAnsiDirect } from './text-winansi-direct-v2.js?v=20260821-pdfnull1';

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
  details.innerHTML='<summary><strong>🧭 Diagnóstico ruta texto</strong></summary><pre id="textRouteDiag" style="max-height:320px;overflow:auto;white-space:pre-wrap;margin:8px 0 0;padding:10px;background:rgba(0,0,0,.04);border-radius:8px;font-size:12px"></pre>';
  status.parentElement?.insertBefore(details,status.nextSibling);
  return details.querySelector('#textRouteDiag');
}
function log(line){try{const pre=box();if(pre){pre.textContent+=(pre.textContent?'\n':'')+line;pre.scrollTop=pre.scrollHeight}}catch(_){}}

export function editDoc(doc,find,replace){
  let count=0;
  const p=phase();
  const beforeOld=searchCount(doc,find),beforeNew=searchCount(doc,replace);
  try{
    const direct=Number(editSimpleWinAnsiDirect(doc,find,replace)||0);
    count+=direct;
    log(`${p} V67 WINANSI «${find}» → «${replace}» | count=${direct} | total=${count} | old ${beforeOld}→${searchCount(doc,find)} | new ${beforeNew}→${searchCount(doc,replace)}`);
  }catch(error){
    log(`${p} V67 WINANSI ERROR «${find}» → «${replace}» | error=${error?.message||String(error)} | total=${count} | old ${beforeOld}→${searchCount(doc,find)} | new ${beforeNew}→${searchCount(doc,replace)}`);
    /* stable v65 still gets a chance */
  }
  const beforeV65Old=searchCount(doc,find),beforeV65New=searchCount(doc,replace);
  try{
    const base=Number(baseEditDoc(doc,find,replace)||0);
    count+=base;
    log(`${p} V67 V65 «${find}» → «${replace}» | count=${base} | total=${count} | old ${beforeV65Old}→${searchCount(doc,find)} | new ${beforeV65New}→${searchCount(doc,replace)}`);
  }catch(err){
    log(`${p} V67 V65 ERROR «${find}» → «${replace}» | error=${err?.message||String(err)} | total=${count} | old ${beforeV65Old}→${searchCount(doc,find)} | new ${beforeV65New}→${searchCount(doc,replace)}`);
    if(!count)throw err;
  }
  return count;
}
if(typeof window!=='undefined')window.__textEditorV67={version:'67+winansi-pdfnull1+subengine-diagnostic1'};
