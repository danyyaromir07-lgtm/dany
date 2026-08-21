import { hasSelectiveRules, prepareSelectiveAnalysis, selectedExpected } from './text-occurrence-prepare-v1.js?v=20260821-selective1';

const q=s=>document.querySelector(s);
function patchUi(applied){
  if(!applied)return;
  const stat=q('#statEdits');
  if(stat)stat.textContent=String((Number(stat.textContent)||0)+applied);
  const summary=q('#batchSummary');
  if(summary&&summary.textContent&&!summary.textContent.includes('selección individual')){
    summary.textContent+=` · ${applied} edición${applied===1?'':'es'} por selección individual`;
  }
  const status=q('#batchStatus');
  if(status&&status.textContent&&!/ERROR/i.test(status.textContent)){
    status.textContent+=` · Selección individual aplicada: ${applied}`;
  }
}
function onlyVerifiedSelectiveText(list){
  if(q('#batchRemoveRevisionClouds')?.checked===true||q('#batchForceRevisionClouds')?.checked===true)return false;
  if(q('#batchRemoveSignatures')?.checked===true||q('#batchRemoveLinks')?.checked===true)return false;
  for(const a of list||[]){
    if(a?.error||!a?.data)return false;
    for(const r of a.counts||[]){
      if(Number(r.annotationCount||0)>0||Number(r.ocrCount||0)>0)return false;
      if(Number(r.count||0)>0&&r?.selectiveText?.enabled!==true)return false;
    }
  }
  return true;
}
function bytesOf(data){
  if(data instanceof Uint8Array)return data;
  if(data instanceof ArrayBuffer)return new Uint8Array(data);
  if(ArrayBuffer.isView(data))return new Uint8Array(data.buffer,data.byteOffset,data.byteLength);
  throw new Error('Datos binarios no válidos para ZIP selectivo.');
}
const CRC_TABLE=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);t[n]=c>>>0}return t})();
function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=CRC_TABLE[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0}
function put16(v,x,o){v[o]=x&255;v[o+1]=(x>>>8)&255}
function put32(v,x,o){v[o]=x&255;v[o+1]=(x>>>8)&255;v[o+2]=(x>>>16)&255;v[o+3]=(x>>>24)&255}
function concat(parts){const n=parts.reduce((s,p)=>s+p.length,0),out=new Uint8Array(n);let o=0;for(const p of parts){out.set(p,o);o+=p.length}return out}
function dosDateTime(){const d=new Date(),year=Math.max(1980,d.getFullYear());return{time:((d.getHours()&31)<<11)|((d.getMinutes()&63)<<5)|((Math.floor(d.getSeconds()/2))&31),date:(((year-1980)&127)<<9)|(((d.getMonth()+1)&15)<<5)|(d.getDate()&31)}}
function buildStoreZip(entries){
  const enc=new TextEncoder(),locals=[],centrals=[];let offset=0;
  const dt=dosDateTime();
  for(const entry of entries){
    const name=enc.encode(entry.name),data=bytesOf(entry.data),crc=crc32(data),size=data.length;
    const local=new Uint8Array(30+name.length);
    put32(local,0x04034b50,0);put16(local,20,4);put16(local,0x0800,6);put16(local,0,8);put16(local,dt.time,10);put16(local,dt.date,12);put32(local,crc,14);put32(local,size,18);put32(local,size,22);put16(local,name.length,26);put16(local,0,28);local.set(name,30);
    locals.push(local,data);
    const central=new Uint8Array(46+name.length);
    put32(central,0x02014b50,0);put16(central,20,4);put16(central,20,6);put16(central,0x0800,8);put16(central,0,10);put16(central,dt.time,12);put16(central,dt.date,14);put32(central,crc,16);put32(central,size,20);put32(central,size,24);put16(central,name.length,28);put16(central,0,30);put16(central,0,32);put16(central,0,34);put16(central,0,36);put32(central,0,38);put32(central,offset,42);central.set(name,46);
    centrals.push(central);offset+=local.length+data.length;
  }
  const centralData=concat(centrals),end=new Uint8Array(22);
  put32(end,0x06054b50,0);put16(end,0,4);put16(end,0,6);put16(end,entries.length,8);put16(end,entries.length,10);put32(end,centralData.length,12);put32(end,offset,16);put16(end,0,20);
  return concat([...locals,centralData,end]);
}
async function downloadPreparedZip(prepared,applied){
  const status=q('#batchStatus'),summary=q('#batchSummary');
  if(status)status.textContent='Generando ZIP selectivo local…';
  const entries=[];
  for(const item of prepared.analysis||[]){
    if(item?.error||!item?.data)continue;
    entries.push({name:String(item.name||'resultado.pdf').replace(/[\\/]/g,'_'),data:item.data});
  }
  if(!entries.length)throw new Error('No hay PDFs selectivos verificados para descargar.');
  const zipBytes=buildStoreZip(entries);
  const blob=new Blob([zipBytes],{type:'application/zip'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download='PDF_tools_procesados.zip';document.body.appendChild(link);link.click();
  setTimeout(()=>{link.remove();URL.revokeObjectURL(url)},3000);
  const files=entries.length;
  if(q('#statFiles'))q('#statFiles').textContent=String(files);
  if(q('#statEdits'))q('#statEdits').textContent=String(applied);
  if(q('#statZip'))q('#statZip').textContent='✓ Descargado';
  if(summary){summary.textContent=`${files} PDF${files===1?'':'s'} procesado${files===1?'':'s'} · ${applied} edición${applied===1?'':'es'} de texto por selección individual · ✓ todas las coincidencias seleccionadas verificadas · ZIP descargado`;summary.classList.remove('hidden')}
  if(status)status.textContent=`Aplicación selectiva terminada correctamente. ${applied} edición${applied===1?'':'es'} verificada${applied===1?'':'s'}.`;
  for(let i=0;i<(prepared.analysis||[]).length;i++){
    const src=prepared.analysis[i],dst=(window.__batchAnalysis||[])[i];
    if(!src||!dst)continue;
    dst.batchApplyExpectedText=0;dst.batchApplyAppliedText=0;dst.batchApplyUnresolvedText=0;
    dst.batchApplySelectiveText=prepared.perFile.find(x=>x.name===dst.name)?.count||0;
  }
  return{files,applied,fastPath:true};
}
export async function runSelectiveFallback(){
  const original=window.__batchAnalysis||[];
  if(!hasSelectiveRules(original)){
    const stable=await import('./batch-apply-fallback.js?v=20260821-canonical-capture1');
    return stable.runFallback();
  }
  const expected=selectedExpected(original);
  const prepared=prepareSelectiveAnalysis(original);
  if(prepared.applied!==expected)throw new Error(`Selección individual no verificada: esperado=${expected}, aplicado=${prepared.applied}.`);
  if(onlyVerifiedSelectiveText(original))return downloadPreparedZip(prepared,prepared.applied);
  window.__batchAnalysis=prepared.analysis;
  try{
    const stable=await import('./batch-apply-fallback.js?v=20260821-canonical-capture1');
    const result=await stable.runFallback();
    for(let i=0;i<original.length;i++){
      const src=prepared.analysis[i],dst=original[i];
      if(!src||!dst)continue;
      for(const k of ['batchApplyExpectedText','batchApplyAppliedText','batchApplyUnresolvedText'])if(k in src)dst[k]=src[k];
      dst.batchApplySelectiveText=prepared.perFile.find(x=>x.name===dst.name)?.count||0;
    }
    patchUi(prepared.applied);
    return result;
  }finally{
    window.__batchAnalysis=original;
  }
}
