// Additive removal wrapper for structurally proven isolated red curved revision-cloud cycles.
// Stable v13 always runs first unchanged.
import { removeDetectedRevisionCloudsByExactFamily as baseRemove, isManualCloudForceEnabled as baseManualEnabled, clearManualCloudForcePreviewApprovals as baseClearApprovals } from './revision-cloud-manual-force-v13.js?v=20260821-redcurve-base1';
import { removeRedCurvedCycleClouds } from './revision-cloud-red-curved-cycle-v1.js?v=20260821-redcurve1';

function diag(stage,extra={}){try{window.__cloudDiagnostic?.({stage,detail:'manual-force-v14-redcurve',...extra});}catch(_){}}
function hasRedCycle(pages){return(pages||[]).some(p=>(p?.clouds||[]).some(c=>c?.source==='vector-red-curved-cycle'&&c?.vectorCurvedCycleProof===true));}

export async function removeDetectedRevisionCloudsByExactFamily(data,detectedPages,options={}){
  const base=await baseRemove(data,detectedPages,options);
  if(Number(base?.removed||0)>0||!hasRedCycle(detectedPages))return base;
  const context=String(options?.context||'');if(context!=='preview'&&context!=='apply')return base;
  try{
    const extra=await removeRedCurvedCycleClouds(data,detectedPages,options);
    if(Number(extra?.removed||0)>0)return{...extra,details:[...(base?.details||[]),...(extra?.details||[])]};
    return{...base,details:[...(base?.details||[]),...(extra?.details||[])]};
  }catch(err){diag('cloud.redcurve.remove.error',{file:String(options?.file||''),error:err?.message||String(err)});return base;}
}
export function isManualCloudForceEnabled(){return baseManualEnabled();}
export function clearManualCloudForcePreviewApprovals(){baseClearApprovals();}
if(typeof window!=='undefined')window.__revisionCloudManualForceV14={version:'14+red-curved-cycle1'};
