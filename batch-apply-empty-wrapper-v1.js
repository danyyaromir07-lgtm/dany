// Apply adapter for explicit deletion rules: find text + empty replacement.
// It pre-applies only those rules on an in-memory PDF, verifies exact counts through v10,
// then delegates all remaining work to the unchanged canonical Apply runner.
import * as mupdf from 'https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js';
import { editDoc } from './text-editor-v68.js?v=20260821-apply-explicit1';

const asBytes=data=>data instanceof Uint8Array?new Uint8Array(data):new Uint8Array(data||0);
const save=doc=>{const b=doc.saveToBuffer('garbage=4,compress=yes,appearance=yes');return b?.asUint8Array?new Uint8Array(b.asUint8Array()):new Uint8Array(b)};

async function prepareEmptyRules(list){
  const backups=[];let total=0;
  for(const item of list||[]){
    if(item?.error||!item?.data||!Array.isArray(item.counts))continue;
    const empty=item.counts.filter(r=>String(r?.find||'').trim()&&String(r?.replace??'')===''&&Math.max(0,Number(r?.count||0))>0);
    if(!empty.length)continue;
    const backup={item,data:item.data,counts:empty.map(r=>({r,count:r.count}))};
    let doc=null;
    try{
      doc=mupdf.PDFDocument.openDocument(asBytes(item.data),'application/pdf');
      let applied=0;
      for(const r of empty){
        const expected=Math.max(0,Number(r.count||0));
        const n=Number(editDoc(doc,r.find,'')||0);
        if(n!==expected)throw new Error(`Borrado «${r.find}»: esperado=${expected}, aplicado=${n}`);
        applied+=n;
      }
      item.data=save(doc);
      for(const r of empty)r.count=0;
      backups.push(backup);total+=applied;
    }catch(error){
      item.data=backup.data;
      for(const x of backup.counts)x.r.count=x.count;
      throw error;
    }finally{try{doc?.destroy()}catch(_){}}
  }
  return{backups,total};
}
function restore(backups){for(const b of backups||[]){b.item.data=b.data;for(const x of b.counts)x.r.count=x.count}}

export async function runFallback(){
  const list=Array.isArray(window.__batchAnalysis)?window.__batchAnalysis:[];
  let prepared={backups:[],total:0};
  try{
    prepared=await prepareEmptyRules(list);
    window.__emptyReplacementApply={version:1,prepared:prepared.total};
    const base=await import('./batch-apply-fallback.js?v=20260827-empty-base1');
    if(typeof base.runFallback!=='function')throw new Error('El Apply canónico no está disponible.');
    const result=await base.runFallback();
    const stat=document.querySelector('#statEdits');
    if(stat&&prepared.total){const n=Number(stat.textContent||0);if(Number.isFinite(n))stat.textContent=String(n+prepared.total)}
    window.__emptyReplacementApply={version:1,prepared:prepared.total,complete:true};
    return result;
  }finally{restore(prepared.backups)}
}
