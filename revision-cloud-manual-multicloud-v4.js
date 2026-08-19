// Emergency safety fuse for the legacy manual multi-cloud fallback.
//
// This module intentionally preserves the public API expected by
// revision-cloud-manual-force-v2-next.js, but it NEVER modifies PDF bytes.
// The previous implementation could accept a broad multicloud family and then
// rewrite a marked-content block with MuPDF. On some technical drawings that
// removed valid plan content. Until that route is redesigned and verified in
// isolation, fail closed: keep the original PDF unchanged and let later/safer
// fallbacks continue normally.

function diag(stage, extra = {}) {
  try {
    window.__cloudDiagnostic?.({
      stage,
      detail: 'manual-cloud-multicloud-v4-safety-fuse',
      ...extra,
    });
  } catch (_) {}
}

function originalBytes(data) {
  if (data instanceof Uint8Array) return new Uint8Array(data);
  return new Uint8Array(data || 0);
}

export async function removeManualMultiCloudBlock(data, detectedPages, options = {}) {
  const file = String(options?.file || '');
  diag('cloud.manual.multi.blocked', {
    file,
    reason: 'ruta multicloud manual desactivada por seguridad; PDF original conservado',
  });

  return {
    data: originalBytes(data),
    removed: 0,
    manualForce: false,
    details: [{
      removed: false,
      manualForce: true,
      mode: 'manual-unique-multicloud-block-disabled',
      reason: 'ruta multicloud manual desactivada por seguridad; PDF original conservado',
    }],
  };
}

window.__revisionCloudManualMultiCloudV4 = {
  version: '4-safety-fuse-disabled',
  destructiveWritesDisabled: true,
};
