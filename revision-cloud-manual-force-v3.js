// Manual revision-cloud router v3.
// It preserves v2 unchanged and adds one final raster=0 vector-block route for explicit manual mode only.
import { removeDetectedRevisionCloudsByExactFamily as removeV2, isManualCloudForceEnabled } from './revision-cloud-manual-force-v2.js?v=20260817-smalldensity1';
import { removeManualVectorZeroBlock } from './revision-cloud-manual-vectorzero-v1.js?v=20260817-vectorzero1';

const approvals=new Set();
function diag(stage,extra={}){try{window.__cloudDiagnostic?.({stage,detail:'manual-cloud-force-v3',...extra});}catch(_){}}
function sync(){window.__manualCloudVectorZeroPreviewApprovedFiles=Array.from(approvals);}
function approve(result,options){if(Number(result?.removed||0)>0&&options.context==='preview'&&options.file){approvals.add(options.file);sync();}return result;}
function rasterCount(pages){return(pages||[]).reduce((n,p)=>n+(p?.clouds||[]).filter(c=>c?.source!=='vector-family'&&c?.source!=='vector-family-multi').length,0);}

export async function removeDetectedRevisionCloudsByExactFamily(data,detectedPages,options={}){
  const prior=await removeV2(data,detectedPages,options);
  if(Number(prior?.removed||0)>0||!isManualCloudForceEnabled()||rasterCount(detectedPages)!==0)return prior;
  const context=String(options?.context||''),file=String(options?.file||'');
  if(context!=='preview'&&context!=='apply')return prior;
  if(context==='apply'&&(!file||!approvals.has(file))){diag('cloud.manual.zero.preview.required',{file,reason:'previsualización raster=0 no aprobada'});return prior;}
  try{
    const zero=await removeManualVectorZeroBlock(data,detectedPages,{context,file});
    if(Number(zero?.removed||0)>0){const result={...zero,manualForce:true,details:[...(prior?.details||[]),...(zero?.details||[])]};return approve(result,{context,file});}
    return {...prior,details:[...(prior?.details||[]),...(zero?.details||[])]};
  }catch(err){diag('cloud.manual.zero.error',{file,error:err?.message||String(err)});return prior;}
}

export { isManualCloudForceEnabled };
window.__revisionCloudManualForceV3={version:3,get approvedZeroFiles(){return Array.from(approvals);}};
