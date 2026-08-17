// Additive wrapper. Stable v3 runs first unchanged; chromatic Optional Content fallback runs only if v3 removed nothing.
import { removeDetectedRevisionCloudsByExactFamily as baseRemove } from './revision-cloud-manual-force-v3.js?v=20260817-singleexact1';
import { removeColoredOptionalClouds } from './revision-cloud-colored-optional-v1.js?v=20260817-coloroptional1';
import './analysis-completion-coordinator-v1.js?v=20260817-completion1';

function hasColoredOptional(pages){return(pages||[]).some(p=>(p?.clouds||[]).some(c=>c?.source==='vector-optional-color'));}
export async function removeDetectedRevisionCloudsByExactFamily(data,detectedPages,options={}){
  const base=await baseRemove(data,detectedPages,options);
  if(Number(base?.removed||0)>0||!hasColoredOptional(detectedPages))return base;
  const context=String(options?.context||'');
  if(context!=='preview'&&context!=='apply')return base;
  try{
    const extra=await removeColoredOptionalClouds(data,detectedPages,options);
    if(Number(extra?.removed||0)>0)return{...extra,details:[...(base?.details||[]),...(extra?.details||[])]};
    return{...base,details:[...(base?.details||[]),...(extra?.details||[])]};
  }catch(err){try{window.__cloudDiagnostic?.({stage:'cloud.coloroptional.remove.error',detail:'manual-cloud-force-v4',file:String(options?.file||''),error:err?.message||String(err)});}catch(_){}return base;}
}
export { isManualCloudForceEnabled, clearManualCloudForcePreviewApprovals } from './revision-cloud-manual-force-v3.js?v=20260817-singleexact1';
window.__revisionCloudManualForceV4={version:'4+coloroptional1'};
