import * as mupdf from 'https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js';

const ANALYZE = '#batchAnalyze';
const OCR = '#batchEnableOCR';
const STATUS = '#batchStatus';
const SCALE = 2.2;
const EDGE_FRACTION = 0.18;
let workerPromise = null;
let runToken = 0;

const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[‐‑‒–—−]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase();
const canonical = s => norm(s).replace(/\s*[-]\s*/g, '-').replace(/\s*([:/_.])\s*/g, '$1');
const baseKey = s => canonical(s).replace(/[^a-z0-9]/g, '');
const codeKey = s => baseKey(s).replace(/o/g, '0').replace(/i/g, '1');
function lev(a, b) { const p = Array.from({ length: b.length + 1 }, (_, i) => i); for (let i = 1; i <= a.length; i++) { const q = [i]; for (let j = 1; j <= b.length; j++) q[j] = Math.min(q[j - 1] + 1, p[j] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); for (let j = 0; j < q.length; j++) p[j] = q[j]; } return p[b.length]; }
function sim(a, b) { return a && b ? 1 - lev(a, b) / Math.max(a.length, b.length) : 0; }
function isLongDrawingCode(v) { const raw = String(v || '').trim(), k = codeKey(raw), parts = raw.split('_').filter(Boolean); return raw.includes('_') && k.length >= 20 && k.length <= 90 && parts.length >= 5 && parts.every(p => /^[A-Za-z0-9.-]+$/.test(p)); }
function diag(stage, extra = {}) { try { window.__ocrDiagnostic?.({ time: new Date().toISOString(), stage, detail: 'long-code-vertical-v1', ...extra }); } catch (_) {} }
function area(b) { return Math.max(0, b[2] - b[0]) * Math.max(0, b[3] - b[1]); }
function intersectionArea(a, b) { const x = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])); const y = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1])); return x * y; }
function samePhysical(a, b) { if (!a?.bbox || !b?.bbox) return false; if (Number(a.page || 0) && Number(b.page || 0) && Number(a.page) !== Number(b.page)) return false; const inter = intersectionArea(a.bbox, b.bbox); if (!inter) return false; return inter / Math.max(1, Math.min(area(a.bbox), area(b.bbox))) >= 0.70; }

async function getWorker() {
  if (workerPromise) return workerPromise;
  workerPromise = import('https://esm.sh/tesseract.js@5.1.0').then(({ createWorker }) => createWorker('eng')).catch(error => { workerPromise = null; throw error; });
  return workerPromise;
}
async function pixmapCanvas(pix) {
  const bitmap = await createImageBitmap(new Blob([pix.asPNG()], { type: 'image/png' }));
  try { const c = document.createElement('canvas'); c.width = bitmap.width; c.height = bitmap.height; c.getContext('2d').drawImage(bitmap, 0, 0); return c; }
  finally { bitmap.close?.(); }
}
async function renderPage(page) {
  const pix = page.toPixmap(mupdf.Matrix.scale(SCALE, SCALE), mupdf.ColorSpace.DeviceRGB, false, false);
  const pixX = Number(pix.getX?.() || 0), pixY = Number(pix.getY?.() || 0);
  try { return { canvas: await pixmapCanvas(pix), pixX, pixY }; }
  finally { try { pix.destroy?.(); } catch (_) {} }
}
function cropCanvas(source, edge) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.floor(edge.width)); c.height = Math.max(1, Math.floor(edge.height)); c.getContext('2d').drawImage(source, edge.x, edge.y, edge.width, edge.height, 0, 0, c.width, c.height); return c; }
function rotateCanvas(source, orientation) {
  const c = document.createElement('canvas'); c.width = source.height; c.height = source.width; const ctx = c.getContext('2d');
  if (orientation === 90) { ctx.translate(0, source.width); ctx.rotate(-Math.PI / 2); }
  else { ctx.translate(source.height, 0); ctx.rotate(Math.PI / 2); }
  ctx.drawImage(source, 0, 0); return c;
}
function rotatedBoxToPage(box, edge, orientation, pixX, pixY) {
  const W = edge.width, H = edge.height;
  const b = orientation === 90 ? [W - box[3], box[0], W - box[1], box[2]] : [box[1], H - box[2], box[3], H - box[0]];
  return [(b[0] + edge.x + pixX) / SCALE, (b[1] + edge.y + pixY) / SCALE, (b[2] + edge.x + pixX) / SCALE, (b[3] + edge.y + pixY) / SCALE];
}
function candidate(text, bbox, confidence, target, sourceType) {
  if (!bbox || !String(text || '').trim()) return null;
  const wanted = codeKey(target), got = codeKey(text), contains = got.includes(wanted), score = sim(got, wanted), near = score >= 0.88 && Math.abs(got.length - wanted.length) <= 6;
  if (!contains && !near) return null;
  return { text: String(text), bbox: [bbox.x0, bbox.y0, bbox.x1, bbox.y1], confidence: Number(confidence || 0), score, exact: contains || got === wanted, sourceType, key: got };
}
function bestCandidate(data, target) {
  const found = [];
  for (const line of data?.lines || []) { const c = candidate(line?.text, line?.bbox, line?.confidence, target, 'vertical-line'); if (c) found.push(c); }
  const words = (data?.words || []).filter(w => w?.text?.trim() && w.bbox);
  for (let i = 0; i < words.length; i++) {
    let text = '', box = null, confidence = 100;
    for (let j = i; j < Math.min(words.length, i + 42); j++) {
      const w = words[j]; text = text ? `${text} ${w.text}` : w.text;
      box = box ? { x0: Math.min(box.x0, w.bbox.x0), y0: Math.min(box.y0, w.bbox.y0), x1: Math.max(box.x1, w.bbox.x1), y1: Math.max(box.y1, w.bbox.y1) } : { ...w.bbox };
      confidence = Math.min(confidence, Number(w.confidence || 0));
      const c = candidate(text, box, confidence, target, 'vertical-words'); if (c) { found.push(c); break; }
      if (codeKey(text).length > codeKey(target).length + 24) break;
    }
  }
  if (!found.length) return null;
  found.sort((a, b) => (Number(b.exact) - Number(a.exact)) || (b.score - a.score) || (b.confidence - a.confidence) || (area(a.bbox) - area(b.bbox)));
  return found[0];
}
async function scanEdge(source, edge, target, file, pageNo, pixX, pixY) {
  const worker = await getWorker(), edgeCanvas = cropCanvas(source, edge), out = [];
  for (const orientation of [90, 270]) {
    const rotated = rotateCanvas(edgeCanvas, orientation);
    for (const psm of [11, 6]) {
      diag('ocr.longcode.vertical.pass', { file, page: pageNo, target, edge: edge.edge, orientation, psm });
      try { await worker.setParameters({ tessedit_pageseg_mode: String(psm), preserve_interword_spaces: '1' }); } catch (_) {}
      const data = (await worker.recognize(rotated))?.data || null;
      const c = bestCandidate(data, target);
      if (!c) { diag('ocr.longcode.vertical.reject', { file, page: pageNo, target, edge: edge.edge, orientation, psm, ocrText: String(data?.text || '').slice(0, 350) }); continue; }
      const bbox = rotatedBoxToPage(c.bbox, edge, orientation, pixX, pixY);
      if (!bbox.every(Number.isFinite) || bbox[2] <= bbox[0] || bbox[3] <= bbox[1] || (bbox[3] - bbox[1]) <= (bbox[2] - bbox[0]) * 1.6) continue;
      const hit = { bbox, confidence: c.confidence, similarity: c.score, exact: c.exact, ocrText: c.text, matchedText: c.text, titleBlockFallback: true, longDrawingCode: true, verticalLongDrawingCode: true, localOrientation: orientation, sourceType: c.sourceType, edge: edge.edge, page: pageNo };
      diag('ocr.longcode.vertical.found', { file, page: pageNo, target, orientation, edge: edge.edge, score: c.score, confidence: c.confidence, ocrText: `${c.text} | bbox=${bbox.map(v => v.toFixed(2)).join(',')}` });
      out.push(hit); break;
    }
  }
  return out;
}
function refreshRow(index) {
  const row = document.querySelectorAll('.batch-result')[index], span = row?.querySelector(':scope > span'), item = window.__batchAnalysis?.[index]; if (!span || !item || item.error) return;
  const buttons = Array.from(span.querySelectorAll('button')), hits = [];
  for (const c of item.counts || []) { if (c?.count) hits.push(`${c.count}× ${c.find}`); if (c?.annotationCount) hits.push(`${c.annotationCount}× ${c.find} (FreeText)`); if (c?.ocrCount) hits.push(`${c.ocrCount}× ${c.find} (vector/OCR)`); }
  const hitWrap = document.createElement('div'); hitWrap.className = 'batch-hit-lines'; for (const text of (hits.length ? hits : ['Sin coincidencias'])) { const line = document.createElement('span'); line.className = 'batch-hit-line'; line.textContent = text; hitWrap.appendChild(line); }
  const footer = document.createElement('div'); footer.className = 'batch-result-actions'; const comments = document.createElement('span'); comments.textContent = `💬 ${Number(item.comments || 0)}`; footer.appendChild(comments); for (const button of buttons) footer.appendChild(button); span.replaceChildren(hitWrap, footer); span.dataset.resultLines = '1';
}
function refreshTotals(batch) { const total = batch.reduce((sum, a) => sum + (a?.error ? 0 : (a.counts || []).reduce((n, c) => n + Number(c.count || 0) + Number(c.annotationCount || 0) + Number(c.ocrCount || 0), 0)), 0); const stat = document.querySelector('#statEdits'); if (stat) stat.textContent = total; const apply = document.querySelector('#batchApply'); if (apply) apply.disabled = !batch.some(a => !a?.error && ((a.counts || []).some(c => c.count || c.annotationCount || c.ocrCount) || Number(a.comments || 0) > 0)); }
async function supplement(token) {
  if (document.querySelector(OCR)?.checked !== true || token !== runToken) return;
  const batch = Array.isArray(window.__batchAnalysis) ? window.__batchAnalysis : []; let added = 0;
  for (let ai = 0; ai < batch.length; ai++) {
    const item = batch[ai]; if (token !== runToken || item?.error || !item?.data) continue;
    const rules = (item.counts || []).filter(c => c?.find?.trim() && isLongDrawingCode(c.find)); if (!rules.length) continue;
    const doc = mupdf.PDFDocument.openDocument(item.data, 'application/pdf');
    try {
      for (let pi = 0; pi < doc.countPages(); pi++) {
        const page = doc.loadPage(pi), rendered = await renderPage(page), ew = Math.max(1, Math.ceil(rendered.canvas.width * EDGE_FRACTION));
        const edges = [{ edge: 'right', x: rendered.canvas.width - ew, y: 0, width: ew, height: rendered.canvas.height }, { edge: 'left', x: 0, y: 0, width: ew, height: rendered.canvas.height }];
        for (const rule of rules) {
          const found = [];
          for (const edge of edges) found.push(...await scanEdge(rendered.canvas, edge, rule.find, item.name, pi + 1, rendered.pixX, rendered.pixY));
          const existing = rule.ocrMatches || [];
          for (const hit of found) { if (existing.some(e => samePhysical(e, hit))) continue; existing.push(hit); rule.ocrCount = Number(rule.ocrCount || 0) + 1; if (!Array.isArray(rule.pages)) rule.pages = []; if (!rule.pages.includes(pi + 1)) rule.pages.push(pi + 1); added++; }
          rule.ocrMatches = existing;
        }
      }
    } finally { doc.destroy(); }
    refreshRow(ai);
  }
  refreshTotals(batch); window.__longTitleBlockVerticalOCR = { total: added, version: 1 };
  if (added) { const status = document.querySelector(STATUS); if (status) status.textContent = `Reconocimiento vertical de código completo terminado: ${added} coincidencia${added === 1 ? '' : 's'} adicional${added === 1 ? '' : 'es'}.`; }
}
function waitForHorizontal(token, previousAnalysis, previousLong) {
  let ticks = 0;
  const timer = setInterval(() => {
    if (token !== runToken) { clearInterval(timer); return; }
    const current = window.__batchAnalysis, analyze = document.querySelector(ANALYZE), longDone = window.__longTitleBlockOCR;
    if (current !== previousAnalysis && Array.isArray(current) && current.length && analyze && !analyze.disabled && longDone && longDone !== previousLong && Number(longDone.version) === 5) {
      clearInterval(timer); setTimeout(() => supplement(token).catch(e => console.warn('long-code vertical v1', e)), 150); return;
    }
    if (++ticks > 3000) clearInterval(timer);
  }, 200);
}
document.querySelector(ANALYZE)?.addEventListener('click', () => { if (document.querySelector(OCR)?.checked !== true) return; const previousAnalysis = window.__batchAnalysis, previousLong = window.__longTitleBlockOCR; runToken++; diag('ocr.longcode.vertical.start', { version: 1 }); waitForHorizontal(runToken, previousAnalysis, previousLong); }, true);
window.__longTitleBlockVerticalOCRLoaded = { version: 1 };
