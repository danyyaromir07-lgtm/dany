import * as mupdf from 'https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js';
import { detectSelectableWinAnsi, editSelectedWinAnsi } from './text-winansi-selective-v1.js?v=20260821-selective1';

function asBytes(data){
  if(data instanceof Uint8Array)return new Uint8Array(data);
  if(data instanceof ArrayBuffer)return new Uint8Array(data.slice(0));
  if(ArrayBuffer.isView(data))return new Uint8Array(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength));
  throw new Error('Datos PDF no válidos para selección individual.');
}
function savePdf(doc){
  const b=doc.saveToBuffer('garbage=4,compress=yes,appearance=yes');
  return b?.asUint8Array?new Uint8Array(b.asUint8Array()):new Uint8Array(b);
}
function sameOccurrence(a,b){
  return !!a&&!!b&&a.id===b.id&&a.page===b.page&&a.stream===b.stream&&a.ordinal===b.ordinal&&String(a.match)===String(b.match)&&String(a.before)===String(b.before)&&String(a.after)===String(b.after);
}
function validateRule(doc,rule,state){
  if(state.supported===false)throw new Error(`«${rule.find}» no dispone de prueba estructural selectiva.`);
  const current=detectSelectableWinAnsi(doc,rule.find);
  const baseline=Array.isArray(state.occurrences)?state.occurrences:[];
  if(current.length!==baseline.length)throw new Error(`«${rule.find}»: cambió el número de coincidencias desde el análisis.`);
  const byId=new Map(current.map(x=>[x.id,x]));
  const baselineById=new Map(baseline.map(x=>[x.id,x]));
  for(const id of state.selectedIds||[]){
    if(!sameOccurrence(byId.get(id),baselineById.get(id)))throw new Error(`«${rule.find}»: una coincidencia seleccionada ya no coincide con la prueba estructural del análisis.`);
  }
}
export function hasSelectiveRules(list){
  return (list||[]).some(a=>!a?.error&&(a.counts||[]).some(r=>r?.selectiveText?.enabled===true));
}
export function selectedExpected(list){
  let n=0;
  for(const a of list||[])for(const r of a?.counts||[])if(r?.selectiveText?.enabled===true)n+=Array.isArray(r.selectiveText.selectedIds)?r.selectiveText.selectedIds.length:0;
  return n;
}
export function prepareSelectiveAnalysis(list){
  const prepared=[],perFile=[];let applied=0;
  for(const item of list||[]){
    if(item?.error||!item?.data){prepared.push(item);continue}
    const clone={...item,counts:(item.counts||[]).map(r=>({...r,selectiveText:r.selectiveText?{...r.selectiveText,occurrences:Array.isArray(r.selectiveText.occurrences)?r.selectiveText.occurrences.map(o=>({...o})):[],selectedIds:Array.isArray(r.selectiveText.selectedIds)?[...r.selectiveText.selectedIds]:[]}:undefined}))};
    const selective=clone.counts.filter(r=>r?.selectiveText?.enabled===true);
    if(!selective.length){prepared.push(clone);continue}
    let doc=null,fileApplied=0;
    try{
      doc=mupdf.PDFDocument.openDocument(asBytes(item.data),'application/pdf');
      for(const r of selective)validateRule(doc,r,r.selectiveText);
      for(const r of selective){
        const ids=r.selectiveText.selectedIds||[];
        if(ids.length){
          const result=editSelectedWinAnsi(doc,r.find,r.replace,ids);
          if(!result.verified||result.count!==ids.length)throw new Error(`«${r.find}»: no se pudieron revalidar todas las coincidencias seleccionadas.`);
          fileApplied+=result.count;
        }
        const chosenPages=(r.selectiveText.occurrences||[]).filter(o=>(r.selectiveText.selectedIds||[]).includes(o.id)).map(o=>o.page);
        if(chosenPages.length)r.pages=[...new Set(chosenPages)];
        r.count=0;
      }
      if(fileApplied)clone.data=savePdf(doc);
      applied+=fileApplied;
      perFile.push({name:item.name,count:fileApplied});
      prepared.push(clone);
    }finally{try{doc?.destroy()}catch(_){}}
  }
  return{analysis:prepared,applied,perFile};
}
