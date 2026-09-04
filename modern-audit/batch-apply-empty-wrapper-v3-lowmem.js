// Transactional empty-replacement orchestrator v17 low-memory.
// Prefer one StructuredText geometry pass when it observes exactly the analysis count.
// Fall back to the existing editor chain for structures StructuredText cannot represent.
import * as mupdf from 'https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js';
import { editDoc } from './text-editor-v68.js?v=20260821-apply-explicit1';
import { editEmptyLowMemory, flexibleCount } from './text-editor-empty-glyph-redact-v17-lowmem.js?v=20260828-lowmem1';

const asBytes=data=>data instanceof Uint8Array?new Uint8Array(data):new Uint8Array(data||0);
const save=doc=>{const b=doc.saveToBuffer('garbage=0,compress=yes,appearance=yes');return b?.asUint8Array?new Uint8Array(b.asUint8Array()):new Uint8Array(b)};
const open=data=>mupdf.PDFDocument.openDocument(asBytes(data),'application/pdf');
function applyOne(pristine,rule){
  const find=String(rule?.find||''),expected=Math.max(0,Number(rule?.count||0));
  let doc=null,re=null;
  try{
    doc=open(pristine);
    const beforeFlex=flexibleCount(doc,find);
    let reported=0,mode='legacy';
    if(beforeFlex===expected&&expected>0){reported=Number(editEmptyLowMemory(doc,find)||0);mode='lowmem-flex'}
    else reported=Number(editDoc(doc,find,'')||0);
    const candidate=save(doc);
    try{doc.destroy()}catch(_){}doc=null;
    re=open(candidate);
    const afterFlex=flexibleCount(re,find);
    const removedFlex=Math.max(0,beforeFlex-afterFlex);
    const observable=beforeFlex>0;
    const ok=observable?removedFlex===expected:reported===expected;
    if(!ok)throw new Error(`Borrado «${find}»: esperado=${expected}, aplicado=${reported}, verificado=${removedFlex}, modo=${mode}`);
    return{data:candidate,applied:expected,before:beforeFlex,after:afterFlex,reported,removed:removedFlex,mode};
  }finally{try{re?.destroy()}catch(_){}try{doc?.destroy()}catch(_){}}
}
export async function prepareEmptyRules(list){
  const backups=[];let total=0;
  for(const item of list||[]){
    if(item?.error||!item?.data||!Array.isArray(item.counts))continue;
    const empty=item.counts.filter(r=>String(r?.find||'').trim()&&String(r?.replace??'')===''&&Math.max(0,Number(r?.count||0))>0);
    if(!empty.length)continue;
    const backup={item,data:item.data,counts:empty.map(r=>({r,count:r.count}))};
    let current=asBytes(item.data),applied=0;
    try{
      for(const r of empty){const step=applyOne(current,r);current=step.data;applied+=step.applied}
      item.data=current;for(const r of empty)r.count=0;backups.push(backup);total+=applied;
    }catch(error){item.data=backup.data;for(const x of backup.counts)x.r.count=x.count;throw error}
  }
  return{backups,total};
}
export function restoreEmptyRules(backups){for(const b of backups||[]){b.item.data=b.data;for(const x of b.counts)x.r.count=x.count}}
export async function runFallback(){
  const list=Array.isArray(window.__batchAnalysis)?window.__batchAnalysis:[];let prepared={backups:[],total:0};
  try{
    prepared=await prepareEmptyRules(list);window.__emptyReplacementApply={version:3,mode:'lowmem-flex-first',prepared:prepared.total};
    const base=await import('./batch-apply-fallback.js?v=20260827-empty-base1');
    if(typeof base.runFallback!=='function')throw new Error('El Apply canónico no está disponible.');
    const result=await base.runFallback();const stat=document.querySelector('#statEdits');
    if(stat&&prepared.total){const n=Number(stat.textContent||0);if(Number.isFinite(n))stat.textContent=String(n+prepared.total)}
    window.__emptyReplacementApply={version:3,mode:'lowmem-flex-first',prepared:prepared.total,complete:true};return result;
  }finally{restoreEmptyRules(prepared.backups)}
}
