// Additive wrapper. Stable v4 runs first unchanged; curved-cloud fallback runs only if v4 removed nothing.
import { removeDetectedRevisionCloudsByExactFamily as baseRemove } from './revision-cloud-manual-force-v4.js?v=20260817-coloroptional1';
import { removeCurvedGrayClouds } from './revision-cloud-curved-gray-v2.js?v=20260818-curvedgray2';
function hasCurved(pages){return(pages||[]).some(p=>(p?.clouds||[]).some(c=>c?.source==='vector-curved-cloud'));}
export async function removeDetectedRevisionCloudsByExactFamily(data,detectedPages,options={}){
  const base=await baseRemove(data,detectedPages,options);
  if(Number(base?.removed||0)>0||!hasCurved(detectedPages))return base;
  const context=String(options?.context||'');if(context!=='preview'&&context!=='apply')return base;
  try{
    const extra=await removeCurvedGrayClouds(data,detectedPages,options);
    if(Number(extra?.removed||0)>0)return{...extra,details:[...(base?.details||[]),...(extra?.details||[])]};
    return{...base,details:[...(base?.details||[]),...(extra?.details||[])]};
  }catch(err){try{window.__cloudDiagnostic?.({stage:'cloud.curved.remove.error',detail:'manual-cloud-force-v5',file:String(options?.file||''),error:err?.message||String(err)});}catch(_){}return base;}
}
export { isManualCloudForceEnabled, clearManualCloudForcePreviewApprovals } from './revision-cloud-manual-force-v4.js?v=20260817-coloroptional1';
window.__revisionCloudManualForceV5={version:'5+curvedgray2'};
