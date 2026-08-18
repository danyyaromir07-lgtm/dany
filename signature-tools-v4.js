import { PDFDocument, PDFName } from 'https://esm.sh/pdf-lib@1.17.1';
import * as mupdf from 'https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js';

const COMMENTS = '#batchRemoveComments';
const SIG = '#batchRemoveSignatures';
const LINKS = '#batchRemoveLinks';
const ANALYZE = '#batchAnalyze';
const SUMMARY = '#batchSummary';
const q = (s) => document.querySelector(s);
const REMOVABLE = new Set(['Text','FreeText','Line','Square','Circle','Polygon','PolyLine','Highlight','Underline','Squiggly','StrikeOut','Stamp','Caret','Ink','Popup','FileAttachment']);
const HEAVY_SAFE_BYTES = 16 * 1024 * 1024;

function resolve(doc, obj) { try { return doc.context.lookup(obj) || obj; } catch (_) { return obj; } }
function subtype(doc, ref) { const obj = resolve(doc, ref); const value = obj?.get?.(PDFName.of('Subtype')); return value?.toString?.().replace(/^\//, '') || ''; }
function parent(doc, ref) { return resolve(doc, ref)?.get?.(PDFName.of('Parent')) || null; }
function isSignature(doc, ref) { let cur = ref; for (let i = 0; i < 8 && cur; i++) { const ft = resolve(doc, cur)?.get?.(PDFName.of('FT'))?.toString?.().replace(/^\//, '') || ''; if (ft === 'Sig') return true; cur = parent(doc, cur); } return false; }
function rootField(doc, ref) { let cur = ref; for (let i = 0; i < 8; i++) { const p = parent(doc, cur); if (!p) return cur; cur = p; } return cur; }
function sameRef(a, b) { return String(a?.objectNumber ?? '') === String(b?.objectNumber ?? '') && String(a?.generationNumber ?? '') === String(b?.generationNumber ?? ''); }
function annotationArray(page) { const a = page.node.get(PDFName.of('Annots')); return a?.size && a?.get ? a : null; }
function annotationContents(doc, ref) { const obj = resolve(doc, ref); const c = obj?.get?.(PDFName.of('Contents')); try { return c?.decodeText?.() || ''; } catch (_) { return String(c || '').replace(/^\(|\)$/g, ''); } }
function normalized(s) { return String(s || '').replace(/\s+/g, ' ').trim().toLowerCase(); }
function preserveText(contents, rules) { const text = normalized(contents); return rules.some((r) => { const needle = normalized(r.find); return needle && text.includes(needle); }); }
function preservedFreeText(doc, ref, rules) { if (subtype(doc, ref) !== 'FreeText') return false; return preserveText(annotationContents(doc, ref), rules); }

// Historical pdf-lib path, intentionally unchanged for normal files and for signature/link operations.
async function prepare(data, rules, removeComments, removeSignatures, removeLinks) {
  if (!removeComments && !removeSignatures && !removeLinks) return new Uint8Array(data);
  const doc = await PDFDocument.load(data, { updateMetadata: false, ignoreEncryption: false });
  let changed = false;
  const signatureRoots = [];
  for (const page of doc.getPages()) {
    const annots = annotationArray(page);
    if (!annots) continue;
    const keep = [];
    for (let i = 0; i < annots.size(); i++) {
      const ref = annots.get(i), st = subtype(doc, ref);
      if (st === 'Widget') {
        if (removeSignatures && isSignature(doc, ref)) { signatureRoots.push(rootField(doc, ref)); changed = true; }
        else keep.push(ref);
        continue;
      }
      if (st === 'Link') { if (removeLinks) changed = true; else keep.push(ref); continue; }
      if (removeComments && REMOVABLE.has(st) && !preservedFreeText(doc, ref, rules)) changed = true;
      else keep.push(ref);
    }
    if (keep.length) page.node.set(PDFName.of('Annots'), doc.context.obj(keep));
    else page.node.delete(PDFName.of('Annots'));
  }
  if (removeSignatures && signatureRoots.length) {
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
  return doc.save({ useObjectStreams: true, addDefaultPage: false });
}

function perf(action, stage, extra = {}) {
  try { window.__performanceDiagnostic?.({ scope: 'apply', action, stage, ...extra }); } catch (_) {}
}

// Safe path only for large files when the requested operation is comment removal alone.
// It preserves the same removable annotation types and the same FreeText exception as the historical path.
async function prepareHeavyComments(data, rules, fileName = '') {
  const key = `comentarios-mupdf::${fileName}`;
  perf('start', 'comentarios · ruta segura MuPDF', { key, file: fileName, sizeBytes: Number(data?.byteLength || data?.length || 0) });
  let doc = null;
  let removed = 0;
  try {
    const source = data instanceof Uint8Array ? data : new Uint8Array(data);
    doc = mupdf.PDFDocument.openDocument(source, 'application/pdf');
    for (let i = 0; i < doc.countPages(); i++) {
      const page = doc.loadPage(i);
      const annots = Array.from(page.getAnnotations?.() || []);
      for (const annot of annots) {
        let type = '';
        try { type = String(annot.getType?.() || ''); } catch (_) {}
        if (!REMOVABLE.has(type)) continue;
        if (type === 'FreeText') {
          let contents = '';
          try { contents = String(annot.getContents?.() || ''); } catch (_) {}
          if (preserveText(contents, rules)) continue;
        }
        page.deleteAnnotation(annot);
        removed++;
      }
    }
    if (!removed) {
      perf('end', 'comentarios · ruta segura MuPDF', { key, file: fileName, removed: 0, outputBytes: Number(data?.byteLength || data?.length || 0) });
      return new Uint8Array(data);
    }
    const buffer = doc.saveToBuffer('garbage=4,compress=yes');
    const output = buffer?.asUint8Array ? new Uint8Array(buffer.asUint8Array()) : new Uint8Array(buffer);
    perf('end', 'comentarios · ruta segura MuPDF', { key, file: fileName, removed, outputBytes: output.byteLength });
    return output;
  } catch (error) {
    perf('end', 'comentarios · ruta segura MuPDF', { key, file: fileName, warning: error?.message || String(error) });
    throw error;
  } finally {
    try { doc?.destroy(); } catch (_) {}
  }
}

function injectOptions() {
  const commentsBox = q(COMMENTS); const host = commentsBox?.closest('.option-box'); if (!host) return;
  if (!q(SIG)) { const box = document.createElement('div'); box.className = 'option-box'; box.style.marginTop = '10px'; box.innerHTML = '<label><input id="batchRemoveSignatures" type="checkbox"><span>✍️ Eliminar firmas digitales</span></label><small>Solo se eliminan al activar esta opción. La firma dejará de ser válida al modificar el PDF.</small>'; host.parentElement?.insertBefore(box, host.nextElementSibling); }
  if (!q(LINKS)) { const box = document.createElement('div'); box.className = 'option-box'; box.style.marginTop = '10px'; box.innerHTML = '<label><input id="batchRemoveLinks" type="checkbox"><span>🔗 Eliminar enlaces del PDF</span></label><small>Los enlaces se conservan por defecto.</small>'; host.parentElement?.appendChild(box); }
}

async function afterAnalysis() {
  const batch = window.__batchAnalysis || []; if (!batch.length) return;
  for (const a of batch) {
    if (a?.error || !a.data) continue;
    try {
      const doc = await PDFDocument.load(a.data, { updateMetadata: false, ignoreEncryption: false });
      let annotationCount = 0, signatureCount = 0, linkCount = 0;
      for (const page of doc.getPages()) {
        const annots = annotationArray(page); if (!annots) continue;
        for (let i = 0; i < annots.size(); i++) {
          const ref = annots.get(i), st = subtype(doc, ref);
          if (st === 'Widget') { if (isSignature(doc, ref)) signatureCount++; }
          else if (st === 'Link') linkCount++;
          else annotationCount++;
        }
      }
      a.annotationCount = annotationCount; a.signatureCount = signatureCount; a.linkCount = linkCount;
    } catch (e) { a.signatureError = e?.message || String(e); }
  }
  const summary = q(SUMMARY); if (!summary) return;
  let text = summary.textContent || '';
  text = text.replace(/ · 📎[^·]*/g, '').replace(/ · ✍️[^·]*/g, '').replace(/ · 🔗[^·]*/g, '');
  let ann = 0, sig = 0, links = 0;
  for (const a of batch) { ann += Number(a.annotationCount || 0); sig += Number(a.signatureCount || 0); links += Number(a.linkCount || 0); }
  if (ann) text += ` · 📎 ${ann} anotación${ann === 1 ? '' : 'es'} detectada${ann === 1 ? '' : 's'}`;
  if (sig) text += ` · ✍️ ${sig} firma${sig === 1 ? '' : 's'} detectada${sig === 1 ? '' : 's'}`;
  if (links) text += ` · 🔗 ${links} enlace${links === 1 ? '' : 's'} detectado${links === 1 ? '' : 's'}`;
  summary.textContent = text; summary.classList.remove('hidden');
}

async function prepareForApply() {
  const removeComments = !!q(COMMENTS)?.checked;
  const removeSignatures = !!q(SIG)?.checked;
  const removeLinks = !!q(LINKS)?.checked;
  if (!removeComments && !removeSignatures && !removeLinks) return;
  const batch = window.__batchAnalysis || [];
  for (const a of batch) {
    if (a?.error || !a.data) continue;
    const rules = (a.counts || []).filter((r) => String(r.find || '').trim() && String(r.replace ?? '') !== '');
    const size = Number(a.data?.byteLength || a.data?.length || 0);
    const heavyCommentsOnly = removeComments && !removeSignatures && !removeLinks && size >= HEAVY_SAFE_BYTES;
    if (heavyCommentsOnly) a.data = await prepareHeavyComments(a.data, rules, a.name || '');
    else a.data = await prepare(a.data, rules, removeComments, removeSignatures, removeLinks);
  }
}

window.__prepareBatchAnnotationOperations = prepareForApply;
window.__signatureToolsHeavySafeV1 = { version: 1, heavySafeBytes: HEAVY_SAFE_BYTES };
function wire() { injectOptions(); q(ANALYZE)?.addEventListener('click', () => { afterAnalysis().catch((e) => console.error('[annotations]', e)); }); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
