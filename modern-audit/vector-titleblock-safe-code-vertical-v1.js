import * as mupdf from 'https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js';

const ANALYZE = '#batchAnalyze';
const OCR = '#batchEnableOCR';
const STATUS = '#batchStatus';
const SCALE = 2.2;
const EDGE_FRACTION = 0.16;
let workerPromise = null;
let runToken = 0;

function diag(stage, extra = {}) {
  try { window.__ocrDiagnostic?.({ time: new Date().toISOString(), stage, detail: 'titleblock-safe-code-vertical-v1', ...extra }); } catch (_) {}
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
function area(b) { return Math.max(0, b[2] - b[0]) * Math.max(0, b[3] - b[1]); }
function intersectionArea(a, b) {
  const x = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]));
  const y = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  return x * y;
}
function overlapRatio(a, b) {
  return intersectionArea(a, b) / Math.max(1, area(a));
}
function iou(a, b) {
  const inter = intersectionArea(a, b);
  return inter / Math.max(1, area(a) + area(b) - inter);
}
function samePhysical(a, b) {
  if (!Array.isArray(a?.bbox) || !Array.isArray(b?.bbox)) return false;
  if (Number(a?.page || 0) && Number(b?.page || 0) && Number(a.page) !== Number(b.page)) return false;
  const inter = intersectionArea(a.bbox, b.bbox);
  if (!inter) return false;
  const minOverlap = inter / Math.max(1, Math.min(area(a.bbox), area(b.bbox)));
  return iou(a.bbox, b.bbox) >= 0.32 || minOverlap >= 0.72;
}
function sourceRank(match) {
  return match?.sourceType === 'vertical-word' ? 0 : 1;
}
function betterMatch(a, b) {
  const ra = sourceRank(a), rb = sourceRank(b);
  if (ra !== rb) return ra < rb ? a : b;
  const aa = area(a.bbox), ab = area(b.bbox);
  if (Math.abs(aa - ab) > 0.01) return aa < ab ? a : b;
  return Number(a.confidence || 0) >= Number(b.confidence || 0) ? a : b;
}
function mergePhysical(matches) {
  const out = [];
  for (const match of matches || []) {
    if (!Array.isArray(match?.bbox) || match.bbox.length !== 4 || !match.bbox.every(Number.isFinite)) continue;
    const index = out.findIndex(existing => samePhysical(existing, match));
    if (index < 0) out.push(match);
    else out[index] = betterMatch(out[index], match);
  }
  return out;
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
    diag('titleblock.code.pdftext.reject', { reason: 'structured-text-error', error: error?.message || String(error), source: 'vertical-safe' });
    return [];
  }
}
function overlappingPdfText(lines, bbox) {
  return lines.filter(line => overlapRatio(bbox, line.bbox) >= 0.18);
}
async function getWorker() {
  if (workerPromise) return workerPromise;
  workerPromise = import('https://esm.sh/tesseract.js@5.1.0')
    .then(({ createWorker }) => createWorker('eng'))
    .catch(error => { workerPromise = null; throw error; });
  return workerPromise;
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
async function renderPage(page) {
  const pix = page.toPixmap(mupdf.Matrix.scale(SCALE, SCALE), mupdf.ColorSpace.DeviceRGB, false, false);
  const pixX = Number(pix.getX?.() || 0), pixY = Number(pix.getY?.() || 0);
  try {
    return { canvas: await pixmapCanvas(pix), pixX, pixY };
  } finally { try { pix.destroy?.(); } catch (_) {} }
}
function cropCanvas(source, edge) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(edge.width));
  canvas.height = Math.max(1, Math.floor(edge.height));
  canvas.getContext('2d').drawImage(source, edge.x, edge.y, edge.width, edge.height, 0, 0, canvas.width, canvas.height);
  return canvas;
}
function rotateCanvas(source, orientation) {
  const canvas = document.createElement('canvas');
  canvas.width = source.height;
  canvas.height = source.width;
  const ctx = canvas.getContext('2d');
  if (orientation === 90) {
    ctx.translate(0, source.width);
    ctx.rotate(-Math.PI / 2);
  } else {
    ctx.translate(source.height, 0);
    ctx.rotate(Math.PI / 2);
  }
  ctx.drawImage(source, 0, 0);
  return canvas;
}
function tokenBoxInRotated(box, text, hit) {
  const width = Math.max(1, box.x1 - box.x0);
  const len = Math.max(1, String(text || '').length);
  return {
    x0: box.x0 + width * (hit.rawStart / len),
    y0: box.y0,
    x1: box.x0 + width * (hit.rawEnd / len),
    y1: box.y1,
  };
}
function rotatedBoxToPage(box, edge, orientation, pixX, pixY) {
  const W = edge.width, H = edge.height;
  const b = orientation === 90
    ? [W - box.y1, box.x0, W - box.y0, box.x1]
    : [box.y0, H - box.x1, box.y1, H - box.x0];
  return [
    (b[0] + edge.x + pixX) / SCALE,
    (b[1] + edge.y + pixY) / SCALE,
    (b[2] + edge.x + pixX) / SCALE,
    (b[3] + edge.y + pixY) / SCALE,
  ];
}
function matchesFromData(data, target, edge, orientation, pixX, pixY) {
  const found = [];
  const add = (text, box, confidence, sourceType) => {
    if (!box || !String(text || '').trim()) return;
    const hit = locateExact(text, target);
    if (!hit) return;
    const bbox = rotatedBoxToPage(tokenBoxInRotated(box, text, hit), edge, orientation, pixX, pixY);
    const width = bbox[2] - bbox[0], height = bbox[3] - bbox[1];
    if (!(height > width * 1.35)) return;
    found.push({
      bbox,
      confidence: Number(confidence || 0),
      similarity: 1,
      exact: true,
      titleBlockFallback: true,
      safeTitleblockCode: true,
      focusedSafeTitleblockCode: true,
      adaptiveSafeTitleblockCode: true,
      verticalSafeTitleblockCode: true,
      matchedText: hit.rawText,
      normalizedMatch: hit.normalized,
      ocrText: hit.rawText,
      containerText: String(text),
      sourceType,
      localOrientation: orientation,
      edge: edge.edge,
    });
  };
  for (const word of data?.words || []) add(word?.text, word?.bbox, word?.confidence, 'vertical-word');
  for (const line of data?.lines || []) add(line?.text, line?.bbox, line?.confidence, 'vertical-line');
  return mergePhysical(found);
}
function edgesFor(canvas) {
  const ew = Math.max(1, Math.ceil(canvas.width * EDGE_FRACTION));
  const eh = Math.max(1, Math.ceil(canvas.height * EDGE_FRACTION));
  return {
    sides: [
      { edge: 'right', x: canvas.width - ew, y: 0, width: ew, height: canvas.height },
      { edge: 'left', x: 0, y: 0, width: ew, height: canvas.height },
    ],
    fallback: [
      { edge: 'bottom', x: 0, y: canvas.height - eh, width: canvas.width, height: eh },
      { edge: 'top', x: 0, y: 0, width: canvas.width, height: eh },
    ],
  };
}
async function scanEdge(source, edge, target, file, pageNo, pixX, pixY) {
  const edgeCanvas = cropCanvas(source, edge);
  const worker = await getWorker();
  const found = [];
  for (const orientation of [90, 270]) {
    const rotated = rotateCanvas(edgeCanvas, orientation);
    diag('titleblock.code.vertical.pass', { file, page: pageNo, target, edge: edge.edge, orientation, psm: 11 });
    try { await worker.setParameters({ tessedit_pageseg_mode: '11', preserve_interword_spaces: '1', tessedit_char_whitelist: '' }); } catch (_) {}
    const data = (await worker.recognize(rotated))?.data || null;
    const matches = matchesFromData(data, target, edge, orientation, pixX, pixY);
    if (matches.length) {
      found.push(...matches);
      for (const match of matches) {
        diag('titleblock.code.vertical.match', {
          file, page: pageNo, target, edge: edge.edge, orientation,
          ocrText: `${match.matchedText} | bbox=${match.bbox.map(v => Number(v).toFixed(2)).join(',')} | conf=${Number(match.confidence || 0).toFixed(1)}`,
        });
      }
    } else {
      diag('titleblock.code.vertical.reject', {
        file, page: pageNo, target, edge: edge.edge, orientation, reason: 'no-exact-vertical-token',
        ocrText: String(data?.text || '').slice(0, 300),
      });
    }
  }
  return mergePhysical(found);
}
async function findVertical(page, target, textLines, file, pageNo) {
  diag('titleblock.code.vertical.start', { file, page: pageNo, target, scale: SCALE, edgeFraction: EDGE_FRACTION });
  const rendered = await renderPage(page);
  const edges = edgesFor(rendered.canvas);
  const found = [];
  for (const edge of edges.sides) found.push(...await scanEdge(rendered.canvas, edge, target, file, pageNo, rendered.pixX, rendered.pixY));
  if (!found.length) {
    for (const edge of edges.fallback) found.push(...await scanEdge(rendered.canvas, edge, target, file, pageNo, rendered.pixX, rendered.pixY));
  }
  const safe = [];
  for (const match of mergePhysical(found)) {
    const real = overlappingPdfText(textLines, match.bbox);
    if (real.length) {
      diag('titleblock.code.pdftext.reject', {
        file, page: pageNo, target, bbox: match.bbox, source: 'vertical-safe',
        pdfText: real.map(line => line.text).join(' | ').slice(0, 500),
      });
      continue;
    }
    if (normalizedCode(match.matchedText) !== normalizedCode(target)) continue;
    safe.push(match);
    diag('titleblock.code.exact.accept', {
      file, page: pageNo, target, source: 'vertical-safe', orientation: match.localOrientation, bbox: match.bbox,
      ocrText: `${match.matchedText} | ${match.edge} | ${match.sourceType} | bbox=${match.bbox.map(v => Number(v).toFixed(2)).join(',')}`,
    });
  }
  return mergePhysical(safe);
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
  let addedTotal = 0;
  for (let fileIndex = 0; fileIndex < batch.length; fileIndex++) {
    const item = batch[fileIndex];
    if (token !== runToken || item?.error || !item?.data) continue;
    const rules = (item.counts || []).filter(rule =>
      rule?.find?.trim() && isShortStructuredCode(rule.find) &&
      Number(rule.count || 0) === 0 && Number(rule.annotationCount || 0) === 0
    );
    if (!rules.length) continue;
    const doc = mupdf.PDFDocument.openDocument(item.data, 'application/pdf');
    try {
      for (let pageIndex = 0; pageIndex < doc.countPages(); pageIndex++) {
        if (token !== runToken) return;
        const page = doc.loadPage(pageIndex);
        const textLines = structuredLines(page);
        for (const rule of rules) {
          const status = document.querySelector(STATUS);
          if (status) status.textContent = `OCR vertical seguro · ${item.name} · página ${pageIndex + 1}`;
          let matches = [];
          try { matches = await findVertical(page, rule.find, textLines, item.name, pageIndex + 1); }
          catch (error) {
            diag('titleblock.code.vertical.reject', { file: item.name, page: pageIndex + 1, target: rule.find, reason: error?.message || String(error) });
          }
          if (!matches.length) continue;
          const existing = (rule.ocrMatches || []).filter(match => match?.safeTitleblockCode === true);
          const before = existing.length;
          const combined = mergePhysical([...existing, ...matches.map(match => ({ ...match, page: pageIndex + 1 }))]);
          rule.ocrMatches = combined;
          rule.ocrCount = combined.length;
          rule.pages = [...new Set(combined.map(match => Math.max(1, Number(match.page || 1))))];
          const added = Math.max(0, combined.length - before);
          addedTotal += added;
          if (added) updateResultLine(fileIndex, rule);
          diag('titleblock.code.vertical.result', {
            file: item.name, page: pageIndex + 1, target: rule.find, count: combined.length, added,
            ocrText: combined.map(match => `${match.matchedText || ''}@${Number(match.localOrientation || 0)}°[${match.bbox.map(v => Number(v).toFixed(2)).join(',')}]`).join(' | ').slice(0, 700),
          });
        }
      }
    } finally { doc.destroy(); }
  }
  refreshTotals(batch);
  const status = document.querySelector(STATUS);
  if (status && addedTotal) status.textContent = `Reconocimiento vertical seguro terminado: ${addedTotal} coincidencia${addedTotal === 1 ? '' : 's'} adicional${addedTotal === 1 ? '' : 'es'}. No se ha modificado ningún PDF.`;
  window.__safeTitleblockCodeVerticalOCR = { total: addedTotal, version: 1 };
}
function waitForAdaptive(token, previous) {
  let ticks = 0;
  const timer = setInterval(() => {
    if (token !== runToken) { clearInterval(timer); return; }
    const marker = window.__safeTitleblockCodeAdaptiveOCR;
    if (marker && marker !== previous) {
      clearInterval(timer);
      setTimeout(() => supplement(token).catch(error => console.warn('vertical safe titleblock OCR', error)), 120);
      return;
    }
    if (++ticks > 3000) clearInterval(timer);
  }, 200);
}
document.querySelector(ANALYZE)?.addEventListener('click', () => {
  if (document.querySelector(OCR)?.checked !== true) return;
  const previous = window.__safeTitleblockCodeAdaptiveOCR;
  runToken++;
  waitForAdaptive(runToken, previous);
});
window.__safeTitleblockCodeVerticalOCRLoaded = { version: 1 };
