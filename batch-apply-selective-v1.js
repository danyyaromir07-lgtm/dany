import { hasSelectiveRules, prepareSelectiveAnalysis, selectedExpected } from './text-occurrence-prepare-v1.js?v=20260821-selective1';

const q=s=>document.querySelector(s);
function patchUi(applied){
  if(!applied)return;
  const stat=q('#statEdits');
  if(stat)stat.textContent=String((Number(stat.textContent)||0)+applied);
  const summary=q('#batchSummary');
  if(summary&&summary.textContent&&!summary.textContent.includes('selección individual'))summary.textContent+=` · ${applied} edición${applied===1?'':'es'} por selección individual`;
  const status=q('#batchStatus');
  if(status&&status.textContent&&!/ERROR/i.test(status.textContent))status.textContent+=` · Selección individual aplicada: ${applied}`;
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
function fmtBytes(n){const x=Number(n||0);if(x<1024)return `${x} B`;if(x<1024*1024)return `${(x/1024).toFixed(1)} KB`;return `${(x/(1024*1024)).toFixed(2)} MB`}
const CRC_TABLE=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);t[n]=c>>>0}return t})();
async function crc32Yielding(bytes,onProgress){
  let c=0xffffffff;const step=1024*1024;
  for(let start=0;start<bytes.length;start+=step){
    const end=Math.min(bytes.length,start+step);
    for(let i=start;i<end;i++)c=CRC_TABLE[(c^bytes[i])&255]^(c>>>8);
    onProgress?.(end,bytes.length);
    if(end<bytes.length)await new Promise(resolve=>setTimeout(resolve,0));
  }
  return (c^0xffffffff)>>>0;
}
function put16(v,x,o){v[o]=x&255;v[o+1]=(x>>>8)&255}
function put32(v,x,o){v[o]=x&255;v[o+1]=(x>>>8)&255;v[o+2]=(x>>>16)&255;v[o+3]=(x>>>24)&255}
function concatSmall(parts){const n=parts.reduce((s,p)=>s+p.length,0),out=new Uint8Array(n);let o=0;for(const p of parts){out.set(p,o);o+=p.length}return out}
function dosDateTime(){const d=new Date(),year=Math.max(1980,d.getFullYear());return{time:((d.getHours()&31)<<11)|((d.getMinutes()&63)<<5)|((Math.floor(d.getSeconds()/2))&31),date:(((year-1980)&127)<<9)|(((d.getMonth()+1)&15)<<5)|(d.getDate()&31)}}
async function buildStoreZipBlob(entries,status){
  const enc=new TextEncoder(),parts=[],centrals=[];let offset=0;
  const dt=dosDateTime();
  for(let ei=0;ei<entries.length;ei++){
    const entry=entries[ei],name=enc.encode(entry.name),data=bytesOf(entry.data),size=data.length;
    const crc=await crc32Yielding(data,(done,total)=>{if(status)status.textContent=`ZIP selectivo · archivo ${ei+1}/${entries.length} · CRC ${fmtBytes(done)} / ${fmtBytes(total)}`});
    const local=new Uint8Array(30+name.length);
    put32(local,0x04034b50,0);put16(local,20,4);put16(local,0x0800,6);put16(local,0,8);put16(local,dt.time,10);put16(local,dt.date,12);put32(local,crc,14);put32(local,size,18);put32(local,size,22);put16(local,name.length,26);put16(local,0,28);local.set(name,30);
    parts.push(local,data);
    const central=new Uint8Array(46+name.length);
    put32(central,0x02014b50,0);put16(central,20,4);put16(central,20,6);put16(central,0x0800,8);put16(central,0,10);put16(central,dt.time,12);put16(central,dt.date,14);put32(central,crc,16);put32(central,size,20);put32(central,size,24);put16(central,name.length,28);put16(central,0,30);put16(central,0,32);put16(central,0,34);put16(central,0,36);put32(central,0,38);put32(central,offset,42);central.set(name,46);
    centrals.push(central);offset+=local.length+data.length;
  }
  const centralData=concatSmall(centrals),end=new Uint8Array(22);
  put32(end,0x06054b50,0);put16(end,0,4);put16(end,0,6);put16(end,entries.length,8);put16(end,entries.length,10);put32(end,centralData.length,12);put32(end,offset,16);put16(end,0,20);
  parts.push(centralData,end);
  return new Blob(parts,{type:'application/zip'});
}
async function downloadPreparedZip(prepared,applied,original){
  const status=q('#batchStatus'),summary=q('#batchSummary'),entries=[];
  let preparedBytes=0,originalBytes=0;
  for(const item of prepared.analysis||[]){if(item?.error||!item?.data)continue;const data=bytesOf(item.data);preparedBytes+=data.length;entries.push({name:String(item.name||'resultado.pdf').replace(/[\\/]/g,'_'),data})}
  for(const item of original||[]){if(item?.error||!item?.data)continue;originalBytes+=bytesOf(item.data).length}
  if(!entries.length)throw new Error('No hay PDFs selectivos verificados para descargar.');
  if(status)status.textContent=`Preparando ZIP selectivo · PDF ${fmtBytes(originalBytes)} → preparado ${fmtBytes(preparedBytes)}`;
  await new Promise(resolve=>setTimeout(resolve,0));
  const blob=await buildStoreZipBlob(entries,status);
  if(status)status.textContent=`ZIP selectivo construido · ${fmtBytes(blob.size)} · iniciando descarga…`;
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download='PDF_tools_procesados.zip';document.body.appendChild(link);link.click();
  setTimeout(()=>{link.remove();URL.revokeObjectURL(url)},3000);
  const files=entries.length;
  if(q('#statFiles'))q('#statFiles').textContent=String(files);
  if(q('#statEdits'))q('#statEdits').textContent=String(applied);
  if(q('#statZip'))q('#statZip').textContent='✓ Descargado';
  if(summary){summary.textContent=`${files} PDF${files===1?'':'s'} procesado${files===1?'':'s'} · ${applied} edición${applied===1?'':'es'} de texto por selección individual · ${fmtBytes(originalBytes)} → ${fmtBytes(preparedBytes)} · ✓ coincidencias seleccionadas verificadas · ZIP descargado`;summary.classList.remove('hidden')}
  if(status)status.textContent=`Aplicación selectiva terminada correctamente. ${applied} edición${applied===1?'':'es'} verificada${applied===1?'':'s'}.`;
  for(let i=0;i<(prepared.analysis||[]).length;i++){
    const src=prepared.analysis[i],dst=(window.__batchAnalysis||[])[i];if(!src||!dst)continue;
    dst.batchApplyExpectedText=0;dst.batchApplyAppliedText=0;dst.batchApplyUnresolvedText=0;dst.batchApplySelectiveText=prepared.perFile.find(x=>x.name===dst.name)?.count||0;
  }
  return{files,applied,fastPath:true,originalBytes,preparedBytes};
}
export async function runSelectiveFallback(){
  const original=window.__batchAnalysis||[];
  if(!hasSelectiveRules(original)){const stable=await import('./batch-apply-fallback.js?v=20260821-canonical-capture1');return stable.runFallback()}
  const expected=selectedExpected(original),prepared=prepareSelectiveAnalysis(original);
  if(prepared.applied!==expected)throw new Error(`Selección individual no verificada: esperado=${expected}, aplicado=${prepared.applied}.`);
  if(onlyVerifiedSelectiveText(original))return downloadPreparedZip(prepared,prepared.applied,original);
  window.__batchAnalysis=prepared.analysis;
  try{
    const stable=await import('./batch-apply-fallback.js?v=20260821-canonical-capture1');const result=await stable.runFallback();
    for(let i=0;i<original.length;i++){const src=prepared.analysis[i],dst=original[i];if(!src||!dst)continue;for(const k of ['batchApplyExpectedText','batchApplyAppliedText','batchApplyUnresolvedText'])if(k in src)dst[k]=src[k];dst.batchApplySelectiveText=prepared.perFile.find(x=>x.name===dst.name)?.count||0}
    patchUi(prepared.applied);return result;
  }finally{window.__batchAnalysis=original}
}
