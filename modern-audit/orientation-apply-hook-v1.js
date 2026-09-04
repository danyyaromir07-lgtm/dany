const button=document.querySelector('#batchApply');
if(button&&!window.__orientationApplyHookV1){
  window.__orientationApplyHookV1=true;
  button.addEventListener('click',async event=>{
    event.stopImmediatePropagation();
    const status=document.querySelector('#batchStatus');
    if(status)status.textContent='Iniciando aplicación…';
    try{
      if(typeof window.__prepareBatchAnnotationOperations==='function')await window.__prepareBatchAnnotationOperations();
      const mod=await import('./batch-apply-fallback-v8.js?v=20260813-orientation1');
      if(typeof mod.runFallback!=='function')throw new Error('El ejecutor con orientación no exporta runFallback.');
      await mod.runFallback();
    }catch(error){
      console.error(error);
      if(status)status.textContent='ERROR AL APLICAR: '+(error?.message||String(error));
    }
  },true);
}
