import { PDFDocument, PDFName } from 'https://esm.sh/pdf-lib@1.17.1';

const SIG = '#batchRemoveSignatures';
const q = (s) => document.querySelector(s);

function resolve(doc, obj) {
  try { return doc.context.lookup(obj) || obj; } catch (_) { return obj; }
}
function parent(doc, ref) {
  return resolve(doc, ref)?.get?.(PDFName.of('Parent')) || null;
}
function isSignature(doc, ref) {
  let cur = ref;
  for (let i = 0; i < 8 && cur; i++) {
    const ft = resolve(doc, cur)?.get?.(PDFName.of('FT'))?.toString?.().replace(/^\//, '') || '';
    if (ft === 'Sig') return true;
    cur = parent(doc, cur);
  }
  return false;
}
function rootField(doc, ref) {
  let cur = ref;
  for (let i = 0; i < 8; i++) {
    const p = parent(doc, cur);
    if (!p) return cur;
    cur = p;
  }
  return cur;
}
function sameRef(a, b) {
  return String(a?.objectNumber ?? '') === String(b?.objectNumber ?? '') &&
    String(a?.generationNumber ?? '') === String(b?.generationNumber ?? '');
}
function annotationArray(doc, page) {
  const raw = page.node.get(PDFName.of('Annots'));
  const annots = resolve(doc, raw);
  return annots?.size && annots?.get ? annots : null;
}

async function removeSignaturesFixed(data, fileName = '') {
  const doc = await PDFDocument.load(data, { updateMetadata: false, ignoreEncryption: false });
  const signatureRoots = [];
  let changed = false;

  for (const page of doc.getPages()) {
    const annots = annotationArray(doc, page);
    if (!annots) continue;
    const keep = [];
    for (let i = 0; i < annots.size(); i++) {
      const ref = annots.get(i);
      const obj = resolve(doc, ref);
      const subtype = obj?.get?.(PDFName.of('Subtype'))?.toString?.().replace(/^\//, '') || '';
      if (subtype === 'Widget' && isSignature(doc, ref)) {
        signatureRoots.push(rootField(doc, ref));
        changed = true;
      } else keep.push(ref);
    }
    if (keep.length) page.node.set(PDFName.of('Annots'), doc.context.obj(keep));
    else page.node.delete(PDFName.of('Annots'));
  }

  if (signatureRoots.length) {
    const acro = resolve(doc, doc.catalog.get(PDFName.of('AcroForm')));
    const fields = resolve(doc, acro?.get?.(PDFName.of('Fields')));
    if (fields?.size && fields?.get) {
      const keep = [];
      for (let i = 0; i < fields.size(); i++) {
        const ref = fields.get(i);
        if (signatureRoots.some((root) => sameRef(rootField(doc, ref), root))) continue;
        keep.push(ref);
      }
      if (keep.length) acro.set(PDFName.of('Fields'), doc.context.obj(keep));
      else acro.delete(PDFName.of('Fields'));
    }
  }

  if (!changed) return new Uint8Array(data);
  const out = await doc.save({ useObjectStreams: true, addDefaultPage: false });
  try {
    window.__performanceDiagnostic?.({ scope: 'apply', action: 'signature.fixed', stage: 'firma digital eliminada · Annots indirecto resuelto', file: fileName, removed: signatureRoots.length });
  } catch (_) {}
  return out;
}

function install() {
  const base = window.__prepareBatchAnnotationOperations;
  if (typeof base !== 'function' || base.__signatureIndirectAnnotsFixV1) return false;

  const wrapped = async function() {
    const box = q(SIG);
    const wanted = !!box?.checked;
    if (!wanted) return base();

    if (box) box.checked = false;
    try { await base(); }
    finally { if (box) box.checked = true; }

    const batch = Array.isArray(window.__batchAnalysis) ? window.__batchAnalysis : [];
    for (const item of batch) {
      if (item?.error || !item?.data) continue;
      item.data = await removeSignaturesFixed(item.data, item.name || '');
    }
  };

  wrapped.__signatureIndirectAnnotsFixV1 = true;
  wrapped.__signatureIndirectAnnotsFixVersion = '1+resolve-indirect-annots';
  window.__prepareBatchAnnotationOperations = wrapped;
  window.__signatureIndirectAnnotsFixV1 = { version: '1+resolve-indirect-annots' };
  return true;
}

let ticks = 0;
const timer = setInterval(() => {
  if (install() || ++ticks > 300) clearInterval(timer);
}, 50);
install();
