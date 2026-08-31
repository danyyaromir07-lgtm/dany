// Direct v23 diagnostic route. v17 behavior is preserved; only the additive import is direct and cache-busted.
import {
  removeDetectedRevisionCloudsByExactFamily as baseRemove,
  isManualCloudForceEnabled as baseManualEnabled,
  clearManualCloudForcePreviewApprovals as baseClearApprovals
} from './revision-cloud-manual-force-v16.js?v=20260821-additive1';
import {
  detectAdditiveRevisionCloudFamilies,
  removeAdditiveRevisionCloudFamilies
} from './revision-cloud-additive-families-v23.js?v=20260831-tokendiag-direct1';

function diag(stage,extra={}){try{window.__cloudDiagnostic?.({stage,detail:'manual-force-v18-direct-v23',...extra});}catch(_){}}

export async function removeDetectedRevisionCloudsByExactFamily(data,detectedPages,options={}){
  const base=await baseRemove(data,detectedPages,options);
  const context=String(options?.context||'');
  if(context!=='preview'&&context!=='apply')return base;
  const file=String(options?.file||'');
  const current=base?.data||data;
  try{
    diag('cloud.v23.direct.start',{file,baseRemoved:Number(base?.removed||0)});
    const proofPages=await detectAdditiveRevisionCloudFamilies(current,{file});
    const entries=(proofPages||[]).reduce((n,p)=>n+Number(p?.clouds?.length||0),0);
    if(!entries){diag('cloud.additive.postpass.none',{file,baseRemoved:Number(base?.removed||0)});return base}
    diag('cloud.additive.postpass.accept',{file,entries,baseRemoved:Number(base?.removed||0)});
    const extra=await removeAdditiveRevisionCloudFamilies(current,proofPages,options);
    if(Number(extra?.removed||0)>0){
      return{
        ...extra,
        removed:Number(base?.removed||0)+Number(extra?.removed||0),
        details:[...(base?.details||[]),...(extra?.details||[])]
      };
    }
    return{...base,details:[...(base?.details||[]),...(extra?.details||[])]};
  }catch(err){
    diag('cloud.additive.postpass.error',{file,error:err?.message||String(err)});
    return base;
  }
}

export function isManualCloudForceEnabled(){return baseManualEnabled()}
export function clearManualCloudForcePreviewApprovals(){baseClearApprovals()}
if(typeof window!=='undefined')window.__revisionCloudManualForceV18={version:'18-direct-v23-diagnostic1'};
