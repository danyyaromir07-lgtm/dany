// Thin manual wrapper: existing proven v2-next runs first unchanged.
// Only when it removes nothing, raster=0, and explicit manual force is enabled, try the isolated zero-exact fallback.
import { removeDetectedRevisionCloudsByExactFamily as baseRemove } from './revision-cloud-manual-force-v2-next.js?v=20260817-vectorzero1';
import { removeManualZeroExact } from './revision-cloud-manual-zero-exact-v1.js?v=20260817-zeroexact1';

const MAIN='#batchRemoveRevisionClouds',FORCE='#batchForceRevisionClouds';
const approvals=new Set();
const q=s=>document.querySelector(s);
function manual(){return q(MAIN)?.checked===true&&q(FORCE)?.checked===true;}
function rasterCount(pages){return(pages||[]).reduce((n,p)=>n+(p?.clouds||[]).filter(c=>c?.source!=='vector-family'&&c?.source!=='vector-family-multi').length,0);}
function reset(){approvals.clear();window.__manualCloudZeroExactApprovedFiles=[];}
function sync(){window.__manualCloudZeroExactApprovedFiles=Array.from(approvals);}
function wire(){q('#batchAnalyze')?.addEventListener('click',reset,true);q('#batchClear')?.addEventListener('click',reset,true);document.addEventListener('change',e=>{if(e.target?.matches?.(MAIN)||e.target?.matches?.(FORCE))reset();});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
function appendFailure(base,reason){return{...base,manualForce:false,details:[...(base?.details||[]),{removed:false,manualForce:true,mode:'manual-zero-exact-block',reason}]};}
export async function removeDetectedRevisionCloudsByExactFamily(data,detectedPages,options={}){
  const base=await baseRemove(data,detectedPages,options);
  if(Number(base?.removed||0)>0||!manual()||rasterCount(detectedPages)!==0)return base;
  const context=String(options?.context||''),file=String(options?.file||'');
  if(context==='apply'&&(!file||!approvals.has(file)))return appendFailure(base,'modo manual raster=0: primero abre «Previsualizar cambios» y verifica visualmente las nubes antes de Aplicar');
  if(context!=='preview'&&context!=='apply')return base;
  try{
    const exact=await removeManualZeroExact(data,detectedPages,{context,file});
    if(Number(exact?.removed||0)>0){if(context==='preview'&&file){approvals.add(file);sync();}return{...exact,details:[...(base?.details||[]),...(exact?.details||[])]};}
    const why=(exact?.details||[]).map(x=>x?.reason).filter(Boolean).join(', ')||'sin bloque exacto raster=0';
    return appendFailure(base,why);
  }catch(err){try{window.__cloudDiagnostic?.({stage:'cloud.manual.zeroexact.error',detail:'manual-cloud-force-v3',file,error:err?.message||String(err)});}catch(_){}return appendFailure(base,`modo manual raster=0: ${err?.message||String(err)}`);}
}
export { isManualCloudForceEnabled, clearManualCloudForcePreviewApprovals } from './revision-cloud-manual-force-v2-next.js?v=20260817-vectorzero1';
window.__revisionCloudManualForceV3={version:3,get approvedFiles(){return Array.from(approvals);}};
