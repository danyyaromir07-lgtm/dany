import { PDFDocument, PDFName } from 'https://esm.sh/pdf-lib@1.17.1';

const ANALYZE = '#batchAnalyze';
const SUMMARY = '#batchSummary';
const q = (s) => document.querySelector(s);
let timer = null;
let lastToken = '';

function resolve(doc, obj) {
  try { return doc.context.lookup(obj) || obj; } catch (_) { return obj; }
}
function subtype(doc, ref) {
  const obj = resolve(doc, ref);
  const value = obj?.get?.(PDFName.of('Subtype'));
  return value?.toString?.().replace(/^\//, '') || '';
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
function annotationArray(page) {
  const a = page.node.get(PDFName.of('Annots'));
  return a?.size && a?.get ? a : null;
}
function tokenFor(batch) {
  return batch.map((a) => `${a?.name || ''}:${a?.data?.length || 0}`).join('|');
}
function updateSummary(batch) {
  const summary = q(SUMMARY);
  if (!summary) return;
  let text = summary.textContent || '';
  text = text
    .replace(/ · 📎[^·]*/g, '')
    .replace(/ · ✍️[^·]*/g, '')
    .replace(/ · 🔗[^·]*/g, '');
  let ann = 0, sig = 0, links = 0;
  for (const a of batch) {
    ann += Number(a?.annotationCount || 0);
    sig += Number(a?.signatureCount || 0);
    links += Number(a?.linkCount || 0);
  }
  if (ann) text += ` · 📎 ${ann} anotación${ann === 1 ? '' : 'es'} detectada${ann === 1 ? '' : 's'}`;
  if (sig) text += ` · ✍️ ${sig} firma${sig === 1 ? '' : 's'} detectada${sig === 1 ? '' : 's'}`;
  if (links) text += ` · 🔗 ${links} enlace${links === 1 ? '' : 's'} detectado${links === 1 ? '' : 's'}`;
  summary.textContent = text;
  summary.classList.remove('hidden');
}
async function scanBatch(batch) {
  for (const a of batch) {
    if (a?.error || !a?.data) continue;
    try {
      const doc = await PDFDocument.load(a.data, { updateMetadata: false, ignoreEncryption: false });
      let annotationCount = 0, signatureCount = 0, linkCount = 0;
      for (const page of doc.getPages()) {
        const annots = annotationArray(page);
        if (!annots) continue;
        for (let i = 0; i < annots.size(); i++) {
          const ref = annots.get(i);
          const st = subtype(doc, ref);
          if (st === 'Widget') {
            if (isSignature(doc, ref)) signatureCount++;
          } else if (st === 'Link') {
            linkCount++;
          } else {
            annotationCount++;
          }
        }
      }
      a.annotationCount = annotationCount;
      a.signatureCount = signatureCount;
      a.linkCount = linkCount;
      a.signatureError = '';
    } catch (e) {
      a.signatureError = e?.message || String(e);
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  updateSummary(batch);
}
function startWatcher() {
  lastToken = '';
  if (timer) clearInterval(timer);
  let ticks = 0;
  timer = setInterval(() => {
    const analyze = q(ANALYZE);
    const batch = Array.isArray(window.__batchAnalysis) ? window.__batchAnalysis : [];
    const finished = !!batch.length && analyze?.disabled === false;
    if (!finished) {
      if (++ticks > 7200) { clearInterval(timer); timer = null; }
      return;
    }
    const token = tokenFor(batch);
    if (!token || token === lastToken) return;
    lastToken = token;
    clearInterval(timer);
    timer = null;
    scanBatch(batch).catch((e) => console.error('[signature-sync]', e));
  }, 100);
}
function wire() {
  q(ANALYZE)?.addEventListener('click', startWatcher);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
else wire();
