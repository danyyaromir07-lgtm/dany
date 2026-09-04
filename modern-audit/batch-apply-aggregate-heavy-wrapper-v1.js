import * as mupdf from 'https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js';
import { hasAggregateHeavyPage, editAggregateHeavyType0 } from './text-editor-heavy-flate-v10-aggregate-type0.js?v=20260904-aggregate1';

const U=x=>x instanceof Uint8Array?new Uint8Array(x):new Uint8Array(x||0);
const open=data=>mupdf.PDFDocument.openDocument(U(data),'application/pdf');
const save=doc=>{const b=doc.saveToBuffer('garbage=0,compress=yes,appearance=yes');return b?.asUint8Array?new Uint8Array(b.asUint8Array()):new Uint8Array(b)};

async function prepareAggregateType0(list){
  const backups=[],notes=[];let total=0;
  for(const item of list||[]){
    if(item?.error||!item?.data||!Array.isArray(item.counts))continue;
    const rules=item.counts.filter(r=>String(r?.find||'').trim()&&String(r?.replace??'')!==''&&Math.max(0,Number(r?.count||0))>0);
    if(!rules.length)continue;
    let doc=null,backup=null;
    try{
      doc=open(item.data);
      if(!hasAggregateHeavyPage(doc))continue;
      backup={item,data:item.data,counts:rules.map(r=>({r,count:r.count}))};
      let changed=0;
      for(const r of rules){
        const expected=Math.max(0,Number(r.count||0));
        const res=await editAggregateHeavyType0(doc,String(r.find),String(r.replace),expected,item.name||'');
        if(res?.verified===true&&Number(res.count||0)===expected){
          r.count=0;changed+=expected;total+=expected;
          notes.push(`${item.name}: ruta Flate agregada aplicada para «${r.find}» (${expected})`);
        }else if(Number(res?.found||0)>0){
          notes.push(`${item.name}: texto agregado «${r.find}» no aplicado (${res?.reason||'ruta Type0 agregada no verificada'})`);
        }
      }
      if(changed>0){item.data=save(doc);backups.push(backup)}
    }catch(error){
      if(backup){item.data=backup.data;for(const x of backup.counts)x.r.count=x.count}
      notes.push(`${item.name}: pre-pase Flate agregado falló (${error?.message||String(error)})`);
    }finally{try{doc?.destroy()}catch(_){}}
  }
  return{backups,total,notes};
}
function restore(backups){for(const b of backups||[]){b.item.data=b.data;for(const x of b.counts)x.r.count=x.count}}

export async function runFallback(){
  const list=Array.isArray(window.__batchAnalysis)?window.__batchAnalysis:[];
  let prep={backups:[],total:0,notes:[]};
  try{
    prep=await prepareAggregateType0(list);
    const base=await import('./batch-apply-empty-wrapper-v4-fillsign-batch.js?v=20260828-fillsignbatch1');
    if(typeof base.runFallback!=='function')throw new Error('El Apply canónico no está disponible.');
    const result=await base.runFallback();
    if(prep.total){const stat=document.querySelector('#statEdits'),n=Number(stat?.textContent||0);if(stat&&Number.isFinite(n))stat.textContent=String(n+prep.total)}
    if(prep.notes.length){const s=document.querySelector('#batchStatus');if(s&&/terminada|generado|descargado|correctamente/i.test(String(s.textContent||'')))s.textContent=`${s.textContent} | ${prep.notes.join(' | ')}`.slice(0,3500)}
    window.__aggregateHeavyApply={version:1,prepared:prep.total,notes:prep.notes,complete:true};
    return result;
  }finally{restore(prep.backups)}
}
