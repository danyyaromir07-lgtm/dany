import * as mupdf from 'https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js';

const ANALYZE = '#batchAnalyze';
const OCR = '#batchEnableOCR';
const STATUS = '#batchStatus';
const SCALE = 2.4;
const RIGHT_FRACTION = 0.30;
const BOTTOM_FRACTION = 0.24;
const LOWER_FRACTION = 0.38;
let workerPromise = null;
let runToken = 0;

function diag(stage, extra = {}) {
  try { window.__ocrDiagnostic?.({ time: new Date().toISOString(), stage, detail: 'titleblock-safe-code-v1', ...extra }); } catch (_) {}
}
function normalizedCode(s) {
  return String(s || '').toUpperCase().replace(/O/g, '0');
}
function isShortStructuredCode(s) {
  const raw = String(s || '').trim();
  const parts = raw.split('_').filter(Boolean);
  const normalized = normalizedCode(raw);
  return raw.includes('_') && parts.length >= 2 && normalized.length >= 6 && normalized.length <= 22;
}
function locateExact(rawText, target) {
  const source = String(rawText || '');
  const normalizedSource = normalizedCode(source);
  const normalizedTarget = normalizedCode(String(target || '').trim());
  if (!normalizedTarget || !normalizedSource) return null;
  let start = normalizedSource.indexOf(normalizedTarget);
  while (start >= 0) {
    const end = start + normalizedTarget.length;
    const before = start > 0 ? normalizedSource[start - 1] : '';
    const after = end < normalizedSource.length ? normalizedSource[end] : '';
    if (!/[A-Z0-9]/.test(before) && !/[A-Z0-9]/.test(after)) {
      return { rawStart: start, rawEnd: end, rawText: source.slice(start, end), normalized: normalizedTarget };
    }
    start = normalizedSource.indexOf(normalizedTarget, start + 1);
  }
  return null;
}
function bboxForSubstring(fullBox, sourceText, hit) {
  const width = Math.max(1, fullBox[2] - fullBox[0]);
  const len = Math.max(1, String(sourceText || '').length);
  const x0 = fullBox[0] + width * (hit.rawStart / len);
  const x1 = fullBox[0] + width * (hit.rawEnd / len);
  return [x0, fullBox[1], x1, fullBox[3]];
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
function structuredLines(page) {
  try {
    const data = JSON.parse(page.toStructuredText('preserve-spans').asJSON());
    const lines = [];
    for (const block of data?.blocks || []) {
      if (block?.type !== 'text') continue;
      for (const line of block?.lines || []) {
        const b = line?.bbox;
        if (Number(line?.wmode || 0) !== 0 || !String(line?.text || '').trim() || !b || ![b.x, b.y, b.w, b.h].every(Number.isFinite)) continue;
        lines.push({ text: String(line.text), bbox: [b.x, b.y, b.x + b.w, b.y + b.h] });
      }
    }
    return lines;
  } catch (error) {
    diag('titleblock.code.pdftext.reject', { reason: 'structured-text-error', error: error?.message || String(error) });
    return [];
  }
}
function overlappingPdfText(lines, bbox) {
  return lines.filter(line => overlapRatio(bbox, line.bbox) >= 0.18);
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
async function renderRegionCanvas(page, region) {
  const pageBox = page.getBounds();
  const pix = page.toPixmap(mupdf.Matrix.scale(SCALE, SCALE), mupdf.ColorSpace.DeviceRGB, false, false);
  const bitmap = await createImageBitmap(new Blob([pix.asPNG()], { type: 'image/png' }));
  try {
    const sx = Math.max(0, Math.floor((region[0] - pageBox[0]) * SCALE));
    const sy = Math.max(0, Math.floor((region[1] - pageBox[1]) * SCALE));
    const sw = Math.max(1, Math.min(bitmap.width - sx, Math.ceil((region[2] - region[0]) * SCALE)));
    const sh = Math.max(1, Math.min(bitmap.height - sy, Math.ceil((region[3] - region[1]) * SCALE)));
    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    canvas.getContext('2d').drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh);
    return canvas;
  } finally {
    bitmap.close?.();
    try { pix.destroy?.(); } catch (_) {}
  }
}
function tesseractBoxToPage(box, region) {
  return [
    region[0] + box.x0 / SCALE,
    region[1] + box.y0 / SCALE,
    region[0] + box.x1 / SCALE,
    region[1] + box.y1 / SCALE,
  ];
}
function matchesFromData(data, target, region) {
  const found = [];
  const add = (text, box, confidence, sourceType) => {
    if (!box || !String(text || '').trim()) return;
    const hit = locateExact(text, target);
    if (!hit) return;
    const fullBox = tesseractBoxToPage(box, region);
    const bbox = bboxForSubstring(fullBox, text, hit);
    found.push({
      bbox,
      confidence: Number(confidence || 0),
      similarity: 1,
      exact: true,
      titleBlockFallback: true,
      safeTitleblockCode: true,
      focusedSafeTitleblockCode: true,
      matchedText: hit.rawText,
      normalizedMatch: hit.normalized,
      ocrText: hit.rawText,
      containerText: String(text),
      sourceType,
    });
  };
  for (const line of data?.lines || []) add(line?.text, line?.bbox, line?.confidence, 'line');
  for (const word of data?.words || []) add(word?.text, word?.bbox, word?.confidence, 'word');

  const words = (data?.words || []).filter(word => word?.bbox && String(word?.text || '').trim());
  for (let i = 0; i < words.length; i++) {
    let text = '';
    let box = null;
    let confidence = 100;
    for (let j = i; j < Math.min(words.length, i + 12); j++) {
      const word = words[j];
      text = text ? `${text} ${word.text}` : String(word.text);
      box = box
        ? [Math.min(box[0], word.bbox.x0), Math.min(box[1], word.bbox.y0), Math.max(box[2], word.bbox.x1), Math.max(box[3], word.bbox.y1)]
        : [word.bbox.x0, word.bbox.y0, word.bbox.x1, word.bbox.y1];
      confidence = Math.min(confidence, Number(word.confidence || 0));
      if (locateExact(text, target)) {
        add(text, { x0: box[0], y0: box[1], x1: box[2], y1: box[3] }, confidence, 'word-sequence');
        break;
      }
      if (text.length > String(target || '').length + 80) break;
    }
  }

  const unique = [];
  for (const match of found) {
    if (match.confidence < 12) continue;
    const duplicate = unique.find(existing => iou(existing.bbox, match.bbox) >= 0.60);
    if (duplicate) {
      if (match.confidence > duplicate.confidence) Object.assign(duplicate, match);
    } else unique.push(match);
  }
  return unique;
}
async function recognizeRegion(page, target, region, label) {
  diag('titleblock.code.focused.start', { target, label, region });
  const canvas = await renderRegionCanvas(page, region);
  const worker = await getWorker();
  try { await worker.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' }); } catch (_) {}
  const data = (await worker.recognize(canvas))?.data || null;
  const matches = matchesFromData(data, target, region);
  if (!matches.length) diag('titleblock.code.exact.reject', { target, label, ocrText: String(data?.text || '').slice(0, 500), reason: 'no-exact-token' });
  return matches;
}
async function findFocused(page, target, textLines, file, pageNo) {
  const pb = page.getBounds();
  const width = pb[2] - pb[0];
  const height = pb[3] - pb[1];
  const x0 = pb[2] - width * RIGHT_FRACTION;
  const regions = [
    [x0, pb[3] - height * BOTTOM_FRACTION, pb[2], pb[3]],
    [x0, pb[3] - height * LOWER_FRACTION, pb[2], pb[3]],
  ];
  for (let i = 0; i < regions.length; i++) {
    const matches = await recognizeRegion(page, target, regions[i], i === 0 ? 'bottom-right-30pct' : 'lower-right-30pct');
    const safe = [];
    for (const match of matches) {
      const real = overlappingPdfText(textLines, match.bbox);
      if (real.length) {
        diag('titleblock.code.pdftext.reject', {
          file, page: pageNo, target, ocr: match.matchedText, bbox: match.bbox,
          pdfText: real.map(line => line.text).join(' | ').slice(0, 500),
        });
        continue;
      }
      if (normalizedCode(match.matchedText) !== normalizedCode(target)) {
        diag('titleblock.code.exact.reject', { file, page: pageNo, target, ocr: match.matchedText, bbox: match.bbox });
        continue;
      }
      diag('titleblock.code.exact.accept', { file, page: pageNo, target, ocr: match.matchedText, normalized: match.normalizedMatch, bbox: match.bbox });
      safe.push(match);
    }
    if (safe.length) return safe;
  }
  return [];
}
function updateResultLine(index, rule) {
  const row = document.querySelectorAll('.batch-result')[index];
  const hitWrap = row?.querySelector('.batch-hit-lines');
  if (!hitWrap) return;
  const key = `safe-code-${String(rule.find || '').replace(/[^a-z0-9]/gi, '_')}`;
  const needle = `${rule.find} (vector/OCR`;
  for (const line of [...hitWrap.querySelectorAll('.batch-hit-line')]) {
    if (line.dataset.safeCodeKey === key || line.textContent.includes(needle) || line.textContent.trim() === 'Sin coincidencias') line.remove();
  }
  const n = Number(rule.ocrCount || 0);
  if (n > 0) {
    const line = document.createElement('span');
    line.className = 'batch-hit-line';
    line.dataset.safeCodeKey = key;
    line.textContent = `${n}× ${rule.find} (vector/OCR cartela segura)`;
    hitWrap.appendChild(line);
  }
  if (!hitWrap.querySelector('.batch-hit-line')) {
    const empty = document.createElement('span');
    empty.className = 'batch-hit-line';
    empty.textContent = 'Sin coincidencias';
    hitWrap.appendChild(empty);
  }
}
function refreshTotals(batch) {
  const total = batch.reduce((sum, item) => sum + (item?.error ? 0 : (item.counts || []).reduce((n, rule) => n + Number(rule.count || 0) + Number(rule.annotationCount || 0) + Number(rule.ocrCount || 0), 0)), 0);
  const stat = document.querySelector('#statEdits');
  if (stat) stat.textContent = total;
  const apply = document.querySelector('#batchApply');
  if (apply) apply.disabled = !batch.some(item => !item?.error && ((item.counts || []).some(rule => rule.count || rule.annotationCount || rule.ocrCount) || Number(item.comments || 0) > 0));
}
function validateExistingOCR(doc, item, rule) {
  const accepted = [];
  for (const match of rule.ocrMatches || []) {
    if (match?.safeTitleblockCode === true) { accepted.push(match); continue; }
    const pageNo = Math.max(1, Number(match?.page || 1));
    const source = String(match?.ocrText || '');
    const hit = locateExact(source, rule.find);
    const raw = Array.isArray(match?.bbox) ? match.bbox.map(Number) : [];
    if (!hit || Number(match?.confidence || 0) < 12 || raw.length !== 4 || !raw.every(Number.isFinite) || raw[2] <= raw[0] || raw[3] <= raw[1]) {
      diag('titleblock.code.exact.reject', { file: item.name, page: pageNo, target: rule.find, ocr: source, reason: 'existing-ocr-not-exact' });
      continue;
    }
    const bbox = bboxForSubstring(raw, source, hit);
    let page;
    try { page = doc.loadPage(pageNo - 1); }
    catch (_) {
      diag('titleblock.code.exact.reject', { file: item.name, page: pageNo, target: rule.find, ocr: source, reason: 'invalid-page' });
      continue;
    }
    const real = overlappingPdfText(structuredLines(page), bbox);
    if (real.length) {
      diag('titleblock.code.pdftext.reject', {
        file: item.name, page: pageNo, target: rule.find, ocr: hit.rawText, bbox,
        pdfText: real.map(line => line.text).join(' | ').slice(0, 500), source: 'existing-ocr',
      });
      continue;
    }
    const safe = {
      ...match,
      bbox,
      confidence: Number(match.confidence || 0),
      similarity: 1,
      exact: true,
      titleBlockFallback: true,
      safeTitleblockCode: true,
      matchedText: hit.rawText,
      normalizedMatch: hit.normalized,
      sourceType: 'existing-ocr-validated',
    };
    accepted.push(safe);
    diag('titleblock.code.exact.accept', { file: item.name, page: pageNo, target: rule.find, ocr: hit.rawText, normalized: hit.normalized, bbox, source: 'existing-ocr' });
  }
  rule.ocrMatches = accepted;
  rule.ocrCount = accepted.length;
  const ocrPages = accepted.map(match => Math.max(1, Number(match.page || 1)));
  const nonOcrPages = Number(rule.count || 0) > 0 || Number(rule.annotationCount || 0) > 0 ? (rule.pages || []) : [];
  rule.pages = [...new Set([...nonOcrPages, ...ocrPages])];
  return accepted.length;
}
async function supplement(token) {
  if (document.querySelector(OCR)?.checked !== true || token !== runToken) return;
  const batch = Array.isArray(window.__batchAnalysis) ? window.__batchAnalysis : [];
  if (!batch.length) return;
  let total = 0;
  for (let fileIndex = 0; fileIndex < batch.length; fileIndex++) {
    const item = batch[fileIndex];
    if (token !== runToken || item?.error || !item?.data) continue;
    const candidates = (item.counts || []).filter(rule =>
      rule?.find?.trim() && isShortStructuredCode(rule.find) &&
      Number(rule.count || 0) === 0 && Number(rule.annotationCount || 0) === 0
    );
    if (!candidates.length) continue;
    const doc = mupdf.PDFDocument.openDocument(item.data, 'application/pdf');
    try {
      for (const rule of candidates) {
        diag('titleblock.code.start', { file: item.name, target: rule.find, source: 'existing-ocr-validation' });
        total += validateExistingOCR(doc, item, rule);
        updateResultLine(fileIndex, rule);
      }
      const pending = candidates.filter(rule => Number(rule.ocrCount || 0) === 0);
      for (let pageIndex = 0; pageIndex < doc.countPages() && pending.some(rule => Number(rule.ocrCount || 0) === 0); pageIndex++) {
        if (token !== runToken) return;
        const page = doc.loadPage(pageIndex);
        const textLines = structuredLines(page);
        for (const rule of pending) {
          if (Number(rule.ocrCount || 0) > 0) continue;
          diag('titleblock.code.start', { file: item.name, page: pageIndex + 1, target: rule.find, source: 'focused-ocr' });
          const status = document.querySelector(STATUS);
          if (status) status.textContent = `OCR cartela seguro · ${item.name} · página ${pageIndex + 1}`;
          let matches = [];
          try { matches = await findFocused(page, rule.find, textLines, item.name, pageIndex + 1); }
          catch (error) {
            diag('titleblock.code.exact.reject', { file: item.name, page: pageIndex + 1, target: rule.find, reason: error?.message || String(error) });
          }
          if (!matches.length) continue;
          const withPage = matches.map(match => ({ ...match, page: pageIndex + 1 }));
          rule.ocrMatches = withPage;
          rule.ocrCount = withPage.length;
          rule.pages = [...new Set(withPage.map(match => Math.max(1, Number(match.page || 1))))];
          total += withPage.length;
          diag('titleblock.code.focused.match', { file: item.name, page: pageIndex + 1, target: rule.find, count: withPage.length, ocr: withPage[0]?.matchedText });
          updateResultLine(fileIndex, rule);
        }
      }
    } finally { doc.destroy(); }
  }
  refreshTotals(batch);
  const status = document.querySelector(STATUS);
  if (status) status.textContent = total
    ? `Reconocimiento seguro terminado: ${total} coincidencia${total === 1 ? '' : 's'} exacta${total === 1 ? '' : 's'} en cartela. No se ha modificado ningún PDF.`
    : 'Análisis completado. Sin coincidencias exactas adicionales en cartela segura.';
  window.__safeTitleblockCodeOCR = { total, version: 1 };
}
function waitForPrimary(token, previous) {
  let ticks = 0;
  const timer = setInterval(() => {
    if (token !== runToken) { clearInterval(timer); return; }
    const marker = window.__titleBlockOCR;
    if (marker && marker !== previous) {
      clearInterval(timer);
      setTimeout(() => supplement(token).catch(error => console.warn('safe titleblock code OCR', error)), 100);
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
