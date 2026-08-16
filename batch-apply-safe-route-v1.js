const applyButton = document.querySelector('#batchApply');
if (applyButton && !window.__safeBatchApplyRouteV1) {
  window.__safeBatchApplyRouteV1 = true;
  applyButton.addEventListener('click', async event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    const status = document.querySelector('#batchStatus');
    if (status) status.textContent = 'Iniciando aplicación segura…';
    try {
      if (typeof window.__prepareBatchAnnotationOperations === 'function') await window.__prepareBatchAnnotationOperations();
      const mod = await import('./batch-apply-fallback-safe-v1.js?v=20260817-safecode1');
      if (typeof mod.runFallback !== 'function') throw new Error('El ejecutor seguro no exporta runFallback.');
      await mod.runFallback();
    } catch (error) {
      console.error(error);
      if (status) status.textContent = 'ERROR AL APLICAR: ' + (error?.message || String(error));
    }
  }, true);
}
