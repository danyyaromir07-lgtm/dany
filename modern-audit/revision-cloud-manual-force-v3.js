// Thin wrapper: existing proven v2-next always runs first unchanged.
// If that removes nothing, one already-confirmed vector-family may use an isolated exact BMC fallback in Preview/Apply.
// Manual raster=0 zero-exact remains unchanged and still requires explicit force + Preview approval.
import { removeDetectedRevisionCloudsByExactFamily as baseRemove } from './revision-cloud-manual-force-v2-next.js?v=20260817-vectorzero1';
import { removeManualZeroExact } from './revision-cloud-manual-zero-exact-v1.js?v=20260817-zeroexact1';
import { removeSingleDetectedVectorExact } from './revision-cloud-single-vector-exact-v1.js?v=20260817-singleexact1';

const MAIN='#batchRemoveRevisionClouds',FORCE='#batchForceRevisionClouds';
const approvals=new Set();
const q=s=>document.querySelector(s);
function manual(){return q(MAIN)?.checked===true&&q(FORCE)?.checked===true;}
function rasterCount(pages){return(pages||[]).reduce((n,p)=>n+(p?.clouds||[]).filter(c=>c?.source!=='vector-family'&&c?.source!=='vector-family-multi').length,0);}
function singleVectorCount(pages){return(pages||[]).reduce((n,p)=>n+(p?.clouds||[]).filter(c=>c?.source==='vector-family').length,0);}
function reset(){approvals.clear();window.__manualCloudZeroExactApprovedFiles=[];}
function sync(){window.__manualCloudZeroExactApprovedFiles=Array.from(approvals);}
function wire(){q('#batchAnalyze')?.addEventListener('click',reset,true);q('#batchClear')?.addEventListener('click',reset,true);document.addEventListener('change',e=>{if(e.target?.matches?.(MAIN)||e.target?.matches?.(FORCE))reset();});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
function appendFailure(base,reason){return{...base,manualForce:false,details:[...(base?.details||[]),{removed:false,manualForce:true,mode:'manual-zero-exact-block',reason}]};}
export async function removeDetectedRevisionCloudsByExactFamily(data,detectedPages,options={}){
  const base=await baseRemove(data,detectedPages,options);
  if(Number(base?.removed||0)>0)return base;
  const context=String(options?.context||''),file=String(options?.file||'');

  // Confirmed automatic single vector-family fallback. No detection thresholds are changed here:
  // it only consumes the exact candidate metadata already produced by the detector and removes one unique safe BMC.
  if(singleVectorCount(detectedPages)===1&&(context==='preview'||context==='apply')){
    try{
      const single=await removeSingleDetectedVectorExact(data,detectedPages,{context,file});
      if(Number(single?.removed||0)>0)return{...single,details:[...(base?.details||[]),...(single?.details||[])]};
      try{window.__cloudDiagnostic?.({stage:'cloud.singleexact.fallback.reject',detail:'manual-cloud-force-v3',file,reason:(single?.details||[]).map(x=>x?.reason).filter(Boolean).join(', ')||'sin bloque exacto'});}catch(_){}
    }catch(err){try{window.__cloudDiagnostic?.({stage:'cloud.singleexact.error',detail:'manual-cloud-force-v3',file,error:err?.message||String(err)});}catch(_){} }
  }

  if(!manual()||rasterCount(detectedPages)!==0)return base;
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
window.__revisionCloudManualForceV3={version:'3+singleexact1',get approvedFiles(){return Array.from(approvals);}};
