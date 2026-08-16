import * as mupdf from 'https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js';

const ANALYZE = '#batchAnalyze';
const OCR = '#batchEnableOCR';
const STATUS = '#batchStatus';
const SCALE = 2.2;
const RIGHT_FRACTION = .55;
const BOTTOM_FRACTION = .20;
const LOWER_FRACTION = .32;
let workerPromise = null;
let runToken = 0;

const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[‐‑‒–—−]/g, '-').toLowerCase();
function codeKey(s) {
  let out = '';
  for (const ch of norm(s)) {
    if (/[a-z0-9]/.test(ch)) out += ch === 'o' ? '0' : ch;
  }
  return out;
}
function isShortStructuredCode(s) {
  const raw = String(s || '').trim();
  const parts = raw.split('_').filter(Boolean);
  const k = codeKey(raw);
  return raw.includes('_') && parts.length >= 2 && k.length >= 6 && k.length <= 18;
}
function indexedCode(text) {
  const src = String(text || '');
  let key = '';
  const starts = [];
  const ends = [];
  for (let i = 0; i < src.length;) {
    const cp = src.codePointAt(i);
    const raw = String.fromCodePoint(cp);
    const j = i + raw.length;
    const clean = norm(raw).replace(/[^a-z0-9]/g, '');
    for (const ch0 of clean) {
      const ch = ch0 === 'o' ? '0' : ch0;
      key += ch;
      starts.push(i);
      ends.push(j);
    }
    i = j;
  }
  return { src, key, starts, ends };
}
function locateExact(text, target) {
  const idx = indexedCode(text);
  const wanted = codeKey(target);
  if (!wanted || !idx.key) return null;
  const pos = idx.key.indexOf(wanted);
  if (pos < 0) return null;
  const a = idx.starts[pos];
  const b = idx.ends[pos + wanted.length - 1];
  if (a == null || b == null) return null;
  return {
    keyStart: pos,
    keyEnd: pos + wanted.length,
    keyLength: idx.key.length,
    rawStart: a,
    rawEnd: b,
    rawText: idx.src.slice(a, b),
  };
}
function bboxFromFraction(box, hit) {
  const w = Math.max(1, box[2] - box[0]);
  const a = hit.keyStart / Math.max(1, hit.keyLength);
  const b = hit.keyEnd / Math.max(1, hit.keyLength);
  return [box[0] + w * a, box[1], box[0] + w * b, box[3]];
}
function area(b) { return Math.max(0, b[2] - b[0]) * Math.max(0, b[3] - b[1]); }
function overlapRatio(a, b) {
  const x = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]));
  const y = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  return x * y / Math.max(1, area(a));
}
function iou(a, b) {
  const x = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]));
  const y = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  const inter = x * y;
  return inter / Math.max(1, area(a) + area(b) - inter);
}
function diag(stage, extra = {}) {
  try { window.__ocrDiagnostic?.({ time: new Date().toISOString(), stage, detail: 'titleblock-safe-code-v1', ...extra }); } catch (_) {}
}
function structuredLines(page) {
  try {
    const data = JSON.parse(page.toStructuredText('preserve-spans').asJSON());
    const out = [];
    for (const block of data?.blocks || []) {
      if (block?.type !== 'text') continue;
      for (const line of block?.lines || []) {
        if (Number(line?.wmode || 0) !== 0 || !String(line?.text || '').trim()) continue;
        const b = line?.bbox;
        if (!b || ![b.x, b.y, b.w, b.h].every(Number.isFinite)) continue;
        out.push({ text: String(line.text), bbox: [b.x, b.y, b.x + b.w, b.y + b.h] });
      }
    }
    return out;
  } catch (e) {
    diag('ocr.titleblock.safe.structured.error', { error: e?.message || String(e) });
    return [];
  }
}
function findInStructuredText(lines, target) {
  const found = [];
  for (const line of lines) {
    const hit = locateExact(line.text, target);
    if (!hit) continue;
    found.push({
      bbox: bboxFromFraction(line.bbox, hit),
      confidence: 100,
      similarity: 1,
      ocrText: hit.rawText,
      exact: true,
      titleBlockFallback: true,
      safeTitleblockCode: true,
      pdfTextExact: true,
      pdfTextSource: hit.rawText,
      sourceLineText: line.text,
    });
  }
  return found;
}
function overlapsPdfText(lines, bbox) {
  return lines.some(line => overlapRatio(bbox, line.bbox) >= .18);
}
async function getWorker() {
  if (workerPromise) return workerPromise;
  workerPromise = import('https://esm.sh/tesseract.js@5.1.0')
    .then(({ createWorker }) => createWorker('spa+eng'))
    .then(async worker => {
      try { await worker.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' }); } catch (_) {}
      return worker;
    })
    .catch(error => { workerPromise = null; throw error; });
  return workerPromise;
}
function renderRegion(page, region) {
  const x0 = Math.floor(region[0] * SCALE), y0 = Math.floor(region[1] * SCALE);
  const x1 = Math.ceil(region[2] * SCALE), y1 = Math.ceil(region[3] * SCALE);
  const pix = new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB, [x0, y0, x1, y1], false);
  pix.clear(255);
  const dev = new mupdf.DrawDevice(mupdf.Matrix.identity, pix);
  try { page.runPageContents(dev, mupdf.Matrix.scale(SCALE, SCALE)); }
  finally { try { dev.close(); } catch (_) {} }
  return pix;
}
async function pixmapCanvas(pix) {
  const bitmap = await createImageBitmap(new Blob([pix.asPNG()], { type: 'image/png' }));
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext('2d').drawImage(bitmap, 0, 0);
    return canvas;
  } finally { bitmap.close?.(); }
}
function fromTesseractBox(box, originX, originY) {
  return [originX + box.x0 / SCALE, originY + box.y0 / SCALE, originX + box.x1 / SCALE, originY + box.y1 / SCALE];
}
function exactFromTesseract(data, target, originX, originY) {
  const found = [];
  for (const line of data?.lines || []) {
    if (!line?.bbox || !String(line?.text || '').trim()) continue;
    const hit = locateExact(line.text, target);
    if (!hit) continue;
    const full = fromTesseractBox(line.bbox, originX, originY);
    found.push({
      bbox: bboxFromFraction(full, hit),
      confidence: Number(line.confidence || 0), similarity: 1, ocrText: hit.rawText, exact: true,
      titleBlockFallback: true, safeTitleblockCode: true, focusedSafeTitleblockCode: true,
      pdfTextExact: false, partialWithinOCR: true, containerText: line.text,
    });
  }
  for (const word of data?.words || []) {
    if (!word?.bbox || !String(word?.text || '').trim()) continue;
    const hit = locateExact(word.text, target);
    if (!hit) continue;
    const full = fromTesseractBox(word.bbox, originX, originY);
    found.push({
      bbox: bboxFromFraction(full, hit),
      confidence: Number(word.confidence || 0), similarity: 1, ocrText: hit.rawText, exact: true,
      titleBlockFallback: true, safeTitleblockCode: true, focusedSafeTitleblockCode: true,
      pdfTextExact: false, partialWithinOCR: true, containerText: word.text,
    });
  }
  const words = (data?.words || []).filter(w => w?.bbox && String(w?.text || '').trim());
  for (let i = 0; i < words.length; i++) {
    let text = '', box = null, confidence = 100;
    for (let j = i; j < Math.min(words.length, i + 12); j++) {
      const w = words[j];
      text = text ? `${text} ${w.text}` : String(w.text);
      box = box ? [Math.min(box[0], w.bbox.x0), Math.min(box[1], w.bbox.y0), Math.max(box[2], w.bbox.x1), Math.max(box[3], w.bbox.y1)] : [w.bbox.x0, w.bbox.y0, w.bbox.x1, w.bbox.y1];
      confidence = Math.min(confidence, Number(w.confidence || 0));
      const hit = locateExact(text, target);
      if (hit) {
        const full = [originX + box[0] / SCALE, originY + box[1] / SCALE, originX + box[2] / SCALE, originY + box[3] / SCALE];
        found.push({ bbox: bboxFromFraction(full, hit), confidence, similarity: 1, ocrText: hit.rawText, exact: true, titleBlockFallback: true, safeTitleblockCode: true, focusedSafeTitleblockCode: true, pdfTextExact: false, partialWithinOCR: true, containerText: text });
        break;
      }
      if (codeKey(text).length > codeKey(target).length + 28) break;
    }
  }
  const unique = [];
  for (const m of found) {
    if (m.confidence < 12) continue;
    const same = unique.find(u => iou(u.bbox, m.bbox) >= .60);
    if (same) { if (m.confidence > same.confidence) Object.assign(same, m); }
    else unique.push(m);
  }
  return unique;
}
async function recognizeRegion(page, target, region, label) {
  const pix = renderRegion(page, region);
  try {
    const canvas = await pixmapCanvas(pix);
    const worker = await getWorker();
    try { await worker.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' }); } catch (_) {}
    const data = (await worker.recognize(canvas))?.data || null;
    diag('ocr.titleblock.safe.region', { target, label, ocrText: String(data?.text || '').slice(0, 600) });
    return exactFromTesseract(data, target, region[0], region[1]);
  } finally { try { pix.destroy?.(); } catch (_) {} }
}
async function findFocused(page, target, textLines) {
  const pb = page.getBounds(), w = pb[2] - pb[0], h = pb[3] - pb[1];
  const x0 = pb[0] + w * (1 - RIGHT_FRACTION);
  const regions = [
    [x0, pb[1] + h * (1 - BOTTOM_FRACTION), pb[2], pb[3]],
    [x0, pb[1] + h * (1 - LOWER_FRACTION), pb[2], pb[3]],
  ];
  for (let i = 0; i < regions.length; i++) {
    const matches = await recognizeRegion(page, target, regions[i], i ? 'lower-right' : 'bottom-right');
    const safe = matches.filter(m => !overlapsPdfText(textLines, m.bbox));
    for (const m of matches) if (!safe.includes(m)) diag('ocr.titleblock.safe.reject.pdftext', { target, bbox: m.bbox, ocrText: m.ocrText });
    if (safe.length) return safe;
  }
  return [];
}
function updateResultLine(index, rule) {
  const row = document.querySelectorAll('.batch-result')[index];
  const hitWrap = row?.querySelector('.batch-hit-lines');
  if (!hitWrap) return;
  for (const line of [...hitWrap.querySelectorAll('.batch-hit-line')]) if (line.textContent.trim() === 'Sin coincidencias') line.remove();
  const key = `safe-code-${(rule.find || '').replace(/[^a-z0-9]/gi, '_')}`;
  let line = hitWrap.querySelector(`[data-safe-code-key="${key}"]`);
  if (!line) {
    line = document.createElement('span');
    line.className = 'batch-hit-line';
    line.dataset.safeCodeKey = key;
    const anchor = hitWrap.querySelector('.batch-cloud-inline, .batch-titleblock-inline');
    if (anchor) hitWrap.insertBefore(line, anchor); else hitWrap.appendChild(line);
  }
  const n = Number(rule.ocrCount || 0);
  const hasPdf = (rule.ocrMatches || []).some(m => m.safeTitleblockCode && m.pdfTextExact);
  line.textContent = `${n}× ${rule.find} (${hasPdf ? 'texto PDF/cartela segura' : 'vector/OCR cartela segura'})`;
}
function refreshTotals(batch) {
  const total = batch.reduce((sum, item) => sum + (item?.error ? 0 : (item.counts || []).reduce((q, c) => q + Number(c.count || 0) + Number(c.annotationCount || 0) + Number(c.ocrCount || 0), 0)), 0);
  const stat = document.querySelector('#statEdits'); if (stat) stat.textContent = total;
  const apply = document.querySelector('#batchApply');
  if (apply) apply.disabled = !batch.some(item => !item?.error && ((item.counts || []).some(c => c.count || c.annotationCount || c.ocrCount) || Number(item.comments || 0) > 0));
}
async function supplement(token) {
  if (document.querySelector(OCR)?.checked !== true || token !== runToken) return;
  const batch = Array.isArray(window.__batchAnalysis) ? window.__batchAnalysis : [];
  if (!batch.length) return;
  let total = 0, pdfText = 0, vector = 0;
  for (let ai = 0; ai < batch.length; ai++) {
    const item = batch[ai];
    if (token !== runToken || item?.error || !item?.data) continue;
    const pending = (item.counts || []).filter(c => c?.find?.trim() && isShortStructuredCode(c.find) && Number(c.count || 0) === 0 && Number(c.annotationCount || 0) === 0 && Number(c.ocrCount || 0) === 0);
    if (!pending.length) continue;
    const doc = mupdf.PDFDocument.openDocument(item.data, 'application/pdf');
    try {
      for (let pi = 0; pi < doc.countPages() && pending.some(c => Number(c.ocrCount || 0) === 0); pi++) {
        if (token !== runToken) return;
        const page = doc.loadPage(pi), lines = structuredLines(page), status = document.querySelector(STATUS);
        for (const c of pending) {
          if (Number(c.ocrCount || 0) > 0) continue;
          let matches = findInStructuredText(lines, c.find);
          if (matches.length) {
            matches = matches.map(m => ({ ...m, page: pi + 1 }));
            pdfText += matches.length;
            diag('ocr.titleblock.safe.pdftext', { file: item.name, page: pi + 1, target: c.find, source: matches[0]?.pdfTextSource });
          } else {
            if (status) status.textContent = `OCR cartela seguro · ${item.name} · página ${pi + 1}`;
            try { matches = (await findFocused(page, c.find, lines)).map(m => ({ ...m, page: pi + 1 })); }
            catch (e) { diag('ocr.titleblock.safe.error', { file: item.name, page: pi + 1, target: c.find, error: e?.message || String(e) }); matches = []; }
            vector += matches.length;
          }
          if (!matches.length) continue;
          c.ocrMatches = (c.ocrMatches || []).concat(matches);
          c.ocrCount = Number(c.ocrCount || 0) + matches.length;
          c.pages = c.pages || [];
          if (!c.pages.includes(pi + 1)) c.pages.push(pi + 1);
          total += matches.length;
          updateResultLine(ai, c);
        }
      }
    } finally { doc.destroy(); }
  }
  refreshTotals(batch);
  const status = document.querySelector(STATUS);
  if (status) {
    status.textContent = total
      ? `Reconocimiento seguro terminado: ${total} coincidencia${total === 1 ? '' : 's'} exacta${total === 1 ? '' : 's'} en cartela (${pdfText} texto PDF, ${vector} vector/OCR). No se ha modificado ningún PDF.`
      : 'Análisis completado. Sin coincidencias adicionales exactas en cartela segura.';
  }
  window.__safeTitleblockCodeOCR = { total, pdfText, vector, version: 1 };
}
function waitForPrimary(token, previous) {
  let ticks = 0;
  const timer = setInterval(() => {
    if (token !== runToken) { clearInterval(timer); return; }
    const marker = window.__titleBlockOCR;
    if (marker && marker !== previous) {
      clearInterval(timer);
      setTimeout(() => supplement(token).catch(e => console.warn('safe titleblock code OCR', e)), 100);
      return;
    }
    if (++ticks > 3000) clearInterval(timer);
  }, 200);
}
document.querySelector(ANALYZE)?.addEventListener('click', () => {
  if (document.querySelector(OCR)?.checked !== true) return;
  const previous = window.__titleBlockOCR;
  runToken++;
  waitForPrimary(runToken, previous);
});
window.__safeTitleblockCodeOCRLoaded = { version: 1 };
