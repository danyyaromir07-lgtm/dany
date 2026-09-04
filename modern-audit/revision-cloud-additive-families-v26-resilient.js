// Resilient dispatcher for additive revision-cloud families.
// v25 remains the preferred route. If its historical dependency chain throws,
// fall back to the original stable v1 family instead of failing the whole file.
import {
  detectAdditiveRevisionCloudFamilies as detectV25,
  removeAdditiveRevisionCloudFamilies as removeV25
} from './revision-cloud-additive-families-v25.js?v=20260831-compactscan1-direct';
import {
  detectAdditiveRevisionCloudFamilies as detectV1,
  removeAdditiveRevisionCloudFamilies as removeV1
} from './revision-cloud-additive-families-v1.js?v=20260904-rescue-direct1';

function diag(stage,extra={}){try{window.__cloudDiagnostic?.({stage,detail:'additive-resilient-v26',...extra})}catch(_){}}

export async function detectAdditiveRevisionCloudFamilies(data,context={}){
  try{
    return await detectV25(data,context);
  }catch(error){
    const reason=error?.message||String(error);
    diag('cloud.additive.v26.fallback',{file:context?.file||'',reason});
    try{
      const result=await detectV1(data,context);
      diag('cloud.additive.v26.fallback.ok',{file:context?.file||'',entries:(result||[]).reduce((n,p)=>n+Number(p?.clouds?.length||0),0)});
      return result;
    }catch(fallbackError){
      const fallbackReason=fallbackError?.message||String(fallbackError);
      diag('cloud.additive.v26.fallback.error',{file:context?.file||'',reason:fallbackReason,primary:reason});
      throw fallbackError;
    }
  }
}

export async function removeAdditiveRevisionCloudFamilies(data,pages,options={}){
  try{
    return await removeV25(data,pages,options);
  }catch(error){
    const reason=error?.message||String(error);
    diag('cloud.additive.v26.remove.fallback',{file:options?.file||'',reason});
    return removeV1(data,pages,options);
  }
}

if(typeof window!=='undefined')window.__revisionCloudAdditiveV26={version:'26-resilient1'};
