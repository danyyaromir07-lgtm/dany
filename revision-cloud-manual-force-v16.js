// Additive rescue for newly proven structural cloud families.
// Stable v15 always runs first unchanged. Only if every existing route removes 0,
// Preview/Apply re-detects the additional isolated marked-content families.
import { removeDetectedRevisionCloudsByExactFamily as baseRemove, isManualCloudForceEnabled as baseManualEnabled, clearManualCloudForcePreviewApprovals as baseClearApprovals } from './revision-cloud-manual-force-v15.js?v=20260821-additive-base1';
import { detectAdditiveRevisionCloudFamilies, removeAdditiveRevisionCloudFamilies } from './revision-cloud-additive-families-v1.js?v=20260821-additive1';

function diag(stage,extra={}){try{window.__cloudDiagnostic?.({stage,detail:'manual-force-v16-additive-families',...extra});}catch(_){}}

export async function removeDetectedRevisionCloudsByExactFamily(data,detectedPages,options={}){
  const base=await baseRemove(data,detectedPages,options);
  if(Number(base?.removed||0)>0)return base;
  const context=String(options?.context||'');
  if(context!=='preview'&&context!=='apply')return base;
  const file=String(options?.file||'');
  try{
    const proofPages=await detectAdditiveRevisionCloudFamilies(data,{file});
    const entries=(proofPages||[]).reduce((n,p)=>n+Number(p?.clouds?.length||0),0);
    if(!entries){diag('cloud.additive.rescue.reject',{file,reason:'prueba estructural adicional=0'});return base}
    diag('cloud.additive.rescue.accept',{file,entries,reason:'rutas previas=0 · familias adicionales revalidadas'});
    const extra=await removeAdditiveRevisionCloudFamilies(data,proofPages,options);
    if(Number(extra?.removed||0)>0)return{...extra,details:[...(base?.details||[]),...(extra?.details||[])]};
    return{...base,details:[...(base?.details||[]),...(extra?.details||[])]};
  }catch(err){diag('cloud.additive.rescue.error',{file,error:err?.message||String(err)});return base}
}
export function isManualCloudForceEnabled(){return baseManualEnabled()}
export function clearManualCloudForcePreviewApprovals(){baseClearApprovals()}
if(typeof window!=='undefined')window.__revisionCloudManualForceV16={version:'16+additive-families1'};
