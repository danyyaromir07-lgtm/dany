import * as mupdf from 'https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js';

const ANALYZE = '#batchAnalyze';
const OCR = '#batchEnableOCR';
const STATUS = '#batchStatus';
const SCALE = 2.2;
const RIGHT_FRACTION = .16;
let workerPromise = null;
let runToken = 0;

const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[‐‑‒–—−]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase();
const canonical = s => norm(s).replace(/\s*[-]\s*/g, '-').replace(/\s*([:/_.])\s*/g, '$1');
const key = s => canonical(s).replace(/[^a-z0-9]/g, '').replace(/o/g, '0');

function levenshtein(a, b) {
  const p = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const q = [i];
    for (let j = 1; j <= b.length; j++) q[j] = Math.min(q[j - 1] + 1, p[j] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    for (let j = 0; j < q.length; j++) p[j] = q[j];
  }
  return p[b.length];
}

function similarity(a, b) {
  return a && b ? 1 - levenshtein(a, b) / Math.max(a.length, b.length) : 0;
}

function isLongDrawingCode(value) {
  const raw = String(value || '').trim();
  const k = key(raw);
  const parts = raw.split('_').filter(Boolean);
  return raw.includes('_') && k.length >= 20 && k.length <= 80 && parts.length >= 5 && parts.every(p => /^[A-Za-z0-9.-]+$/.test(p));
}

async function getWorker() {
  if (workerPromise) return workerPromise;
  workerPromise = import('https://esm.sh/tesseract.js@5.1.0')
    .then(({ createWorker }) => createWorker('spa+eng'))
    .then(async w => {
      try { await w.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' }); } catch (_) {}
      return w;
    })
    .catch(e => { workerPromise = null; throw e; });
  return workerPromise;
}

async function recognizeRightStrip(page) {
  const pix = page.toPixmap(mupdf.Matrix.scale(SCALE, SCALE), mupdf.ColorSpace.DeviceRGB, false, false);
  const bitmap = await createImageBitmap(new Blob([pix.asPNG()], { type: 'image/png' }));
  try {
    const sw = Math.max(1, Math.ceil(bitmap.width * RIGHT_FRACTION));
    const sx = bitmap.width - sw;
    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = bitmap.height;
    canvas.getContext('2d').drawImage(bitmap, sx, 0, sw, bitmap.height, 0, 0, sw, bitmap.height);
    const worker = await getWorker();
    try { await worker.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' }); } catch (_) {}
    const data = (await worker.recognize(canvas))?.data || null;
    return { data, ox: sx };
  } finally {
    bitmap.close?.();
  }
}

function findCode(data, target, ox) {
  const wanted = key(target);
  const words = (data?.words || []).filter(w => w?.text?.trim() && w.bbox);
  const found = [];
  for (let i = 0; i < words.length; i++) {
    let text = '';
    let box = null;
    let confidence = 100;
    for (let j = i; j < Math.min(words.length, i + 24); j++) {
      const w = words[j];
      text = text ? `${text} ${w.text}` : w.text;
      box = box ? [Math.min(box[0], w.bbox.x0), Math.min(box[1], w.bbox.y0), Math.max(box[2], w.bbox.x1), Math.max(box[3], w.bbox.y1)] : [w.bbox.x0, w.bbox.y0, w.bbox.x1, w.bbox.y1];
      confidence = Math.min(confidence, Number(w.confidence || 0));
      const k = key(text);
      const score = similarity(k, wanted);
      const exact = k === wanted;
      const safeFuzzy = confidence >= 55 && score >= .90 && Math.abs(k.length - wanted.length) <= 3;
      if ((exact && confidence >= 5) || safeFuzzy) {
        found.push({
          bbox: [(box[0] + ox) / SCALE, box[1] / SCALE, (box[2] + ox) / SCALE, box[3] / SCALE],
          confidence,
          similarity: score,
          ocrText: text,
          exact,
          titleBlockFallback: true,
          longDrawingCode: true
        });
        break;
      }
      if (k.length > wanted.length + 25) break;
    }
  }
  if (!found.length) return [];
  found.sort((a, b) => (b.exact - a.exact) || (b.similarity - a.similarity) || (b.confidence - a.confidence));
  return [found[0]];
}

function updateRow(item, idx) {
  const row = document.querySelectorAll('.batch-result')[idx];
  const span = row?.querySelector(':scope > span');
  if (!span) return;
  span.dataset.resultLines = '';
  queueMicrotask(() => {
    try { window.__formatBatchResultLines?.(); } catch (_) {}
  });
}

async function supplement(token) {
  if (document.querySelector(OCR)?.checked !== true || token !== runToken) return;
  const batch = Array.isArray(window.__batchAnalysis) ? window.__batchAnalysis : [];
  if (!batch.length) return;
  let total = 0;

  for (let ai = 0; ai < batch.length; ai++) {
    const item = batch[ai];
    if (token !== runToken || item?.error || !item?.data || item?.kinds?.vector !== true) continue;
    const pending = (item.counts || []).filter(c => c?.find?.trim() && isLongDrawingCode(c.find) && Number(c.count || 0) === 0 && Number(c.annotationCount || 0) === 0 && Number(c.ocrCount || 0) === 0);
    if (!pending.length) continue;

    const doc = mupdf.PDFDocument.openDocument(item.data, 'application/pdf');
    try {
      for (let pi = 0; pi < doc.countPages() && pending.some(c => Number(c.ocrCount || 0) === 0); pi++) {
        if (token !== runToken) return;
        const status = document.querySelector(STATUS);
        if (status) status.textContent = `OCR código de plano · ${item.name} · página ${pi + 1}`;
        const page = doc.loadPage(pi);
        let rec;
        try { rec = await recognizeRightStrip(page); } catch (e) { console.warn('long titleblock OCR', item.name, pi + 1, e); continue; }
        for (const c of pending) {
          if (Number(c.ocrCount || 0) > 0) continue;
          const matches = findCode(rec.data, c.find, rec.ox);
          if (!matches.length) continue;
          c.ocrCount = (c.ocrCount || 0) + matches.length;
          c.ocrMatches = (c.ocrMatches || []).concat(matches.map(m => ({ ...m, page: pi + 1 })));
          c.pages = c.pages || [];
          if (!c.pages.includes(pi + 1)) c.pages.push(pi + 1);
          total += matches.length;
          updateRow(item, ai);
        }
      }
    } finally {
      doc.destroy();
    }
  }

  if (total) {
    const stat = document.querySelector('#statEdits');
    if (stat) {
      const n = batch.reduce((sum, a) => sum + (a?.error ? 0 : (a.counts || []).reduce((q, c) => q + Number(c.count || 0) + Number(c.annotationCount || 0) + Number(c.ocrCount || 0), 0)), 0);
      stat.textContent = n;
    }
    const status = document.querySelector(STATUS);
    if (status) status.textContent = `Reconocimiento terminado: ${total} código${total === 1 ? '' : 's'} largo${total === 1 ? '' : 's'} de plano detectado${total === 1 ? '' : 's'} en cartela.`;
  }
  window.__longTitleBlockOCR = { total };
}

function waitForAnalysis(token) {
  let ticks = 0;
  const timer = setInterval(() => {
    if (token !== runToken) { clearInterval(timer); return; }
    const btn = document.querySelector(ANALYZE);
    if (btn && !btn.disabled && Array.isArray(window.__batchAnalysis) && window.__batchAnalysis.length) {
      clearInterval(timer);
      setTimeout(() => supplement(token).catch(e => console.warn('long titleblock OCR supplement', e)), 300);
      return;
    }
    if (++ticks > 2400) clearInterval(timer);
  }, 250);
}

document.querySelector(ANALYZE)?.addEventListener('click', () => {
  if (document.querySelector(OCR)?.checked !== true) return;
  runToken++;
  waitForAnalysis(runToken);
});
