import { PDFDocument, PDFName } from 'https://esm.sh/pdf-lib@1.17.1';

const SIG = '#batchRemoveSignatures';
const q = (s) => document.querySelector(s);

function resolve(doc, obj) {
  try { return doc.context.lookup(obj) || obj; } catch (_) { return obj; }
}
function parent(doc, ref) {
  return resolve(doc, ref)?.get?.(PDFName.of('Parent')) || null;
}
function subtype(doc, ref) {
  const value = resolve(doc, ref)?.get?.(PDFName.of('Subtype'));
  return value?.toString?.().replace(/^\//, '') || '';
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
function sameObject(a, b) {
  if (a === b) return true;
  const ao = a?.objectNumber, bo = b?.objectNumber;
  if (ao == null || bo == null) return false;
  return String(ao) === String(bo) && String(a?.generationNumber ?? 0) === String(b?.generationNumber ?? 0);
}
function annotationArray(doc, page) {
  const a = resolve(doc, page.node.get(PDFName.of('Annots')));
  return a?.size && a?.get ? a : null;
}
function countReachableSignatures(doc) {
  let widgets = 0, fields = 0;
  for (const page of doc.getPages()) {
    const annots = annotationArray(doc, page);
    if (!annots) continue;
    for (let i = 0; i < annots.size(); i++) {
      const ref = annots.get(i);
      if (subtype(doc, ref) === 'Widget' && isSignature(doc, ref)) widgets++;
    }
  }
  const acro = resolve(doc, doc.catalog.get(PDFName.of('AcroForm')));
  const rootFields = resolve(doc, acro?.get?.(PDFName.of('Fields')));
  if (rootFields?.size && rootFields?.get) {
    for (let i = 0; i < rootFields.size(); i++) if (isSignature(doc, rootFields.get(i))) fields++;
  }
  return { widgets, fields, total: widgets + fields };
}
async function cleanOne(data, fileName = '') {
  const source = data instanceof Uint8Array ? data : new Uint8Array(data);
  const doc = await PDFDocument.load(source, { updateMetadata: false, ignoreEncryption: false });
  const before = countReachableSignatures(doc);
  if (!before.total) return { data: new Uint8Array(source), before, after: before, removedWidgets: 0, removedFields: 0 };

  const roots = [];
  let removedWidgets = 0, removedFields = 0;
  for (const page of doc.getPages()) {
    const annots = annotationArray(doc, page);
    if (!annots) continue;
    const keep = [];
    for (let i = 0; i < annots.size(); i++) {
      const ref = annots.get(i);
      if (subtype(doc, ref) === 'Widget' && isSignature(doc, ref)) {
        roots.push(rootField(doc, ref));
        removedWidgets++;
      } else keep.push(ref);
    }
    if (keep.length) page.node.set(PDFName.of('Annots'), doc.context.obj(keep));
    else page.node.delete(PDFName.of('Annots'));
  }

  const acro = resolve(doc, doc.catalog.get(PDFName.of('AcroForm')));
  const fields = resolve(doc, acro?.get?.(PDFName.of('Fields')));
  if (fields?.size && fields?.get) {
    const keep = [];
    for (let i = 0; i < fields.size(); i++) {
      const ref = fields.get(i);
      const root = rootField(doc, ref);
      if (isSignature(doc, ref) || roots.some((r) => sameObject(root, r))) removedFields++;
      else keep.push(ref);
    }
    if (keep.length) acro.set(PDFName.of('Fields'), doc.context.obj(keep));
    else acro.delete(PDFName.of('Fields'));
  }

  const saved = await doc.save({ useObjectStreams: true, addDefaultPage: false });
  const verifyDoc = await PDFDocument.load(saved, { updateMetadata: false, ignoreEncryption: false });
  const after = countReachableSignatures(verifyDoc);
  if (after.total > 0) throw new Error(`${fileName || 'PDF'}: la barrera final de firmas dejó ${after.total} referencia${after.total === 1 ? '' : 's'} /Sig alcanzable${after.total === 1 ? '' : 's'}.`);
  return { data: new Uint8Array(saved), before, after, removedWidgets, removedFields };
}

export async function cleanBatchSignaturesBeforeRunner() {
  if (q(SIG)?.checked !== true) return { enabled: false, files: 0, removed: 0 };
  const batch = Array.isArray(window.__batchAnalysis) ? window.__batchAnalysis : [];
  let files = 0, removed = 0;
  for (const item of batch) {
    if (item?.error || !item?.data) continue;
    const result = await cleanOne(item.data, item.name || '');
    if (result.before.total > 0) {
      item.data = result.data;
      files++;
      removed += result.removedWidgets;
    }
    item.signatureFinalBarrier = {
      before: result.before,
      after: result.after,
      removedWidgets: result.removedWidgets,
      removedFields: result.removedFields,
      verified: result.after.total === 0
    };
    try {
      window.__performanceDiagnostic?.({
        scope: 'apply', action: 'end', stage: 'firma digital · barrera final antes de runner',
        file: item.name || '', removed: result.removedWidgets,
        signatureBefore: result.before.total, signatureAfter: result.after.total,
        verified: result.after.total === 0
      });
    } catch (_) {}
  }
  window.__signatureFinalBarrierV1 = { version: 1, files, removed, verified: true };
  return { enabled: true, files, removed };
}
