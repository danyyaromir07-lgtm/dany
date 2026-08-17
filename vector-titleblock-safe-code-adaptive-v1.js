import * as mupdf from 'https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js';

const ANALYZE = '#batchAnalyze';
const OCR = '#batchEnableOCR';
const STATUS = '#batchStatus';
const SCALE = 2.8;
const RIGHT_FRACTION = 0.30;
let workerPromise = null;
let runToken = 0;

function diag(stage, extra = {}) {
  try { window.__ocrDiagnostic?.({ time: new Date().toISOString(), stage, detail: 'titleblock-safe-code-adaptive-v1', ...extra }); } catch (_) {}
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
  return [
    fullBox[0] + width * (hit.rawStart / len),
    fullBox[1],
    fullBox[0] + width * (hit.rawEnd / len),
    fullBox[3],
  ];
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
    .catch(error => { workerPromise = null; throw error; });
  return workerPromise;
}
function renderRegion(page, region) {
  const bbox = [
    Math.floor(region[0] * SCALE),
    Math.floor(region[1] * SCALE),
    Math.ceil(region[2] * SCALE),
    Math.ceil(region[3] * SCALE),
  ];
  const pix = new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB, bbox, false);
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
    found.push({
      bbox: bboxForSubstring(fullBox, text, hit),
      confidence: Number(confidence || 0),
      similarity: 1,
      exact: true,
      titleBlockFallback: true,
      safeTitleblockCode: true,
      focusedSafeTitleblockCode: true,
      adaptiveSafeTitleblockCode: true,
      matchedText: hit.rawText,
      normalizedMatch: hit.normalized,
      ocrText: hit.rawText,
      containerText: String(text),
      sourceType,
    });
  };
  for (const line of data?.lines || []) add(line?.text, line?.bbox, line?.confidence, 'adaptive-line');
  for (const word of data?.words || []) add(word?.text, word?.bbox, word?.confidence, 'adaptive-word');
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
        add(text, { x0: box[0], y0: box[1], x1: box[2], y1: box[3] }, confidence, 'adaptive-word-sequence');
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
async function recognizePass(page, target, region, label, psm, whitelist = false) {
  diag('titleblock.code.adaptive.pass', { target, label, psm, region, whitelist });
  const pix = renderRegion(page, region);
  try {
    const canvas = await pixmapCanvas(pix);
    const worker = await getWorker();
    const params = { tessedit_pageseg_mode: String(psm), preserve_interword_spaces: '1' };
    params.tessedit_char_whitelist = whitelist ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-. ' : '';
    try { await worker.setParameters(params); } catch (_) {}
    const data = (await worker.recognize(canvas))?.data || null;
    const matches = matchesFromData(data, target, region);
    if (!matches.length) {
      diag('titleblock.code.adaptive.reject', {
        target, label, psm, whitelist, reason: 'no-exact-token',
        ocrText: String(data?.text || '').slice(0, 500),
      });
    }
    return matches;
  } finally { try { pix.destroy?.(); } catch (_) {} }
}
function adaptiveRegions(page) {
  const pb = page.getBounds();
  const width = pb[2] - pb[0];
  const height = pb[3] - pb[1];
  const right30 = pb[2] - width * RIGHT_FRACTION;
  const right25 = pb[2] - width * 0.25;
  const region = (x0, bottomFraction) => [x0, pb[3] - height * bottomFraction, pb[2], pb[3]];
  return [
    { label: 'lower-right-30pct-24pct-psm12', region: region(right30, 0.24), psm: 12, whitelist: false },
    { label: 'bottom-right-25pct-10pct-psm12', region: region(right25, 0.10), psm: 12, whitelist: false },
    { label: 'bottom-right-25pct-10pct-codeonly', region: region(right25, 0.10), psm: 12, whitelist: true },
    { label: 'lower-right-30pct-38pct-psm12', region: region(right30, 0.38), psm: 12, whitelist: false },
    { label: 'lower-right-30pct-24pct-psm11', region: region(right30, 0.24), psm: 11, whitelist: false },
  ];
}
async function findAdaptive(page, target, textLines, file, pageNo) {
  diag('titleblock.code.adaptive.start', { file, page: pageNo, target, strategy: 'psm12-narrow-band-fallback' });
  for (const pass of adaptiveRegions(page)) {
    const matches = await recognizePass(page, target, pass.region, pass.label, pass.psm, pass.whitelist);
    const safe = [];
    for (const match of matches) {
      const real = overlappingPdfText(textLines, match.bbox);
      if (real.length) {
        diag('titleblock.code.pdftext.reject', {
          file, page: pageNo, target, ocr: match.matchedText, bbox: match.bbox,
          pdfText: real.map(line => line.text).join(' | ').slice(0, 500), source: 'adaptive-ocr',
        });
        continue;
      }
      if (normalizedCode(match.matchedText) !== normalizedCode(target)) {
        diag('titleblock.code.exact.reject', { file, page: pageNo, target, ocr: match.matchedText, bbox: match.bbox, source: 'adaptive-ocr' });
        continue;
      }
      safe.push(match);
      diag('titleblock.code.exact.accept', {
        file, page: pageNo, target, ocr: match.matchedText, normalized: match.normalizedMatch,
        bbox: match.bbox, source: 'adaptive-ocr', pass: pass.label,
      });
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
      Number(rule.count || 0) === 0 && Number(rule.annotationCount || 0) === 0 && Number(rule.ocrCount || 0) === 0
    );
    if (!candidates.length) continue;
    const doc = mupdf.PDFDocument.openDocument(item.data, 'application/pdf');
    try {
      for (let pageIndex = 0; pageIndex < doc.countPages() && candidates.some(rule => Number(rule.ocrCount || 0) === 0); pageIndex++) {
        if (token !== runToken) return;
        const page = doc.loadPage(pageIndex);
        const textLines = structuredLines(page);
        for (const rule of candidates) {
          if (Number(rule.ocrCount || 0) > 0) continue;
          const status = document.querySelector(STATUS);
          if (status) status.textContent = `OCR cartela adaptativo · ${item.name} · página ${pageIndex + 1}`;
          let matches = [];
          try { matches = await findAdaptive(page, rule.find, textLines, item.name, pageIndex + 1); }
          catch (error) {
            diag('titleblock.code.adaptive.reject', { file: item.name, page: pageIndex + 1, target: rule.find, reason: error?.message || String(error) });
          }
          if (!matches.length) continue;
          const withPage = matches.map(match => ({ ...match, page: pageIndex + 1 }));
          rule.ocrMatches = withPage;
          rule.ocrCount = withPage.length;
          rule.pages = [...new Set(withPage.map(match => Math.max(1, Number(match.page || 1))))];
          total += withPage.length;
          diag('titleblock.code.adaptive.match', {
            file: item.name, page: pageIndex + 1, target: rule.find,
            count: withPage.length, ocr: withPage[0]?.matchedText,
          });
          updateResultLine(fileIndex, rule);
        }
      }
    } finally { doc.destroy(); }
  }
  refreshTotals(batch);
  const status = document.querySelector(STATUS);
  if (status) status.textContent = total
    ? `Reconocimiento adaptativo terminado: ${total} coincidencia${total === 1 ? '' : 's'} exacta${total === 1 ? '' : 's'} en cartela. No se ha modificado ningún PDF.`
    : 'Análisis completado. Sin coincidencias exactas adicionales en cartela adaptativa.';
  window.__safeTitleblockCodeAdaptiveOCR = { total, version: 1 };
}
function waitForSafeCode(token, previous) {
  let ticks = 0;
  const timer = setInterval(() => {
    if (token !== runToken) { clearInterval(timer); return; }
    const marker = window.__safeTitleblockCodeOCR;
    if (marker && marker !== previous) {
      clearInterval(timer);
      setTimeout(() => supplement(token).catch(error => console.warn('adaptive safe titleblock code OCR', error)), 100);
      return;
    }
    if (++ticks > 3000) clearInterval(timer);
  }, 200);
}
document.querySelector(ANALYZE)?.addEventListener('click', () => {
  if (document.querySelector(OCR)?.checked !== true) return;
  const previous = window.__safeTitleblockCodeOCR;
  runToken++;
  waitForSafeCode(runToken, previous);
});
window.__safeTitleblockCodeAdaptiveOCRLoaded = { version: 1 };
