// Post-pass additive rescue for proven revision-cloud families.
// Stable v16 runs first unchanged. Then, in Preview/Apply, the additive detector
// re-checks the bytes returned by v16 even when an earlier route already removed something.
import {
  removeDetectedRevisionCloudsByExactFamily as baseRemove,
  isManualCloudForceEnabled as baseManualEnabled,
  clearManualCloudForcePreviewApprovals as baseClearApprovals
} from './revision-cloud-manual-force-v16.js?v=20260821-additive1';
import {
  detectAdditiveRevisionCloudFamilies,
  removeAdditiveRevisionCloudFamilies
} from './revision-cloud-additive-families-v1.js?v=20260821-additive1';

function diag(stage,extra={}){try{window.__cloudDiagnostic?.({stage,detail:'manual-force-v17-post-additive',...extra});}catch(_){}}

export async function removeDetectedRevisionCloudsByExactFamily(data,detectedPages,options={}){
  const base=await baseRemove(data,detectedPages,options);
  const context=String(options?.context||'');
  if(context!=='preview'&&context!=='apply')return base;
  const file=String(options?.file||'');
  const current=base?.data||data;
  try{
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
if(typeof window!=='undefined')window.__revisionCloudManualForceV17={version:'17+post-additive1'};
