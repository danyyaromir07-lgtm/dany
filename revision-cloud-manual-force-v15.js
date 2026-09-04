// Final additive rescue for structurally proven red curved revision-cloud cycles.
// Stable v14 always runs first unchanged. Only when every existing route removes 0,
// Preview/Apply re-runs the structural detector on the current bytes and removes one
// uniquely proven red curved cycle. This avoids analysis-routing priority blocking Apply.
import { removeDetectedRevisionCloudsByExactFamily as baseRemove, isManualCloudForceEnabled as baseManualEnabled, clearManualCloudForcePreviewApprovals as baseClearApprovals } from './revision-cloud-manual-force-v14.js?v=20260821-redcurve1';
import { detectRedCurvedCycleClouds, removeRedCurvedCycleClouds } from './revision-cloud-red-curved-cycle-v1.js?v=20260821-redcurve1';

function diag(stage,extra={}){try{window.__cloudDiagnostic?.({stage,detail:'manual-force-v15-redcurve-rescue',...extra});}catch(_){}}

export async function removeDetectedRevisionCloudsByExactFamily(data,detectedPages,options={}){
  const base=await baseRemove(data,detectedPages,options);
  if(Number(base?.removed||0)>0)return base;
  const context=String(options?.context||'');
  if(context!=='preview'&&context!=='apply')return base;
  const file=String(options?.file||'');
  try{
    const proofPages=await detectRedCurvedCycleClouds(data,{file});
    const entries=(proofPages||[]).reduce((n,p)=>n+Number(p?.clouds?.length||0),0);
    if(entries!==1){
      diag('cloud.redcurve.rescue.reject',{file,reason:`prueba estructural final=${entries}`});
      return base;
    }
    diag('cloud.redcurve.rescue.accept',{file,page:Number(proofPages[0]?.page||0),reason:'rutas previas=0 · prueba estructural final única'});
    const extra=await removeRedCurvedCycleClouds(data,proofPages,options);
    if(Number(extra?.removed||0)>0)return{...extra,details:[...(base?.details||[]),...(extra?.details||[])]};
    return{...base,details:[...(base?.details||[]),...(extra?.details||[])]};
  }catch(err){
    diag('cloud.redcurve.rescue.error',{file,error:err?.message||String(err)});
    return base;
  }
}
export function isManualCloudForceEnabled(){return baseManualEnabled();}
export function clearManualCloudForcePreviewApprovals(){baseClearApprovals();}
if(typeof window!=='undefined')window.__revisionCloudManualForceV15={version:'15+red-curved-cycle-final-rescue1'};
