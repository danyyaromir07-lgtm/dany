import * as mupdf from 'https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js';

const BOX = '#batchRemoveRevisionClouds';
const SUMMARY = '#batchSummary';
const STATUS = '#batchStatus';
const q = (s) => document.querySelector(s);

function rgbRed(color) {
  if (!Array.isArray(color) || color.length < 3) return false;
  const [r, g, b] = color.map(Number);
  return r >= 0.78 && g <= 0.30 && b <= 0.30 && r >= g + 0.45 && r >= b + 0.45;
}
function rectArray(r) { return r ? [Number(r[0]), Number(r[1]), Number(r[2]), Number(r[3])] : null; }
function rectArea(r) { return Math.max(0, r[2] - r[0]) * Math.max(0, r[3] - r[1]); }
function rectIntersects(a, b, pad = 0) { return !(a[2] < b[0] - pad || a[0] > b[2] + pad || a[3] < b[1] - pad || a[1] > b[3] + pad); }
function transformPoint(x, y, m) { return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; }
function pathOps(path, ctm) {
  const ops = [];
  path.walk({
    moveTo(x, y) { const p = transformPoint(x, y, ctm); ops.push(['m', p[0], p[1]]); },
    lineTo(x, y) { const p = transformPoint(x, y, ctm); ops.push(['l', p[0], p[1]]); },
    curveTo(x1, y1, x2, y2, x3, y3) { const a = transformPoint(x1, y1, ctm), b = transformPoint(x2, y2, ctm), c = transformPoint(x3, y3, ctm); ops.push(['c', a[0], a[1], b[0], b[1], c[0], c[1]]); },
    closePath() { ops.push(['h']); },
  });
  return ops;
}
function rasterComponents(page, scale = 0.35) {
  const pix = page.toPixmap(mupdf.Matrix.scale(scale, scale), mupdf.ColorSpace.DeviceRGB, false, false);
  const w = pix.getWidth(), h = pix.getHeight(), comps = pix.getNumberOfComponents();
  if (comps < 3 || !w || !h) return [];
  const px = pix.getPixels();
  const red = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < red.length; i++, p += comps) { const r = px[p], g = px[p + 1], b = px[p + 2]; red[i] = (r >= 170 && g <= 125 && b <= 125 && r >= g + 70 && r >= b + 70) ? 1 : 0; }
  const seen = new Uint8Array(w * h), stack = new Int32Array(w * h), pageBounds = rectArray(page.getBounds()), out = [];
  for (let sy = 0; sy < h; sy++) for (let sx = 0; sx < w; sx++) {
    const seed = sy * w + sx; if (!red[seed] || seen[seed]) continue;
    let top = 0, area = 0, minX = sx, maxX = sx, minY = sy, maxY = sy; stack[top++] = seed; seen[seed] = 1;
    while (top) {
      const idx = stack[--top], y = (idx / w) | 0, x = idx - y * w;
      area++; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
      const n1 = idx - 1, n2 = idx + 1, n3 = idx - w, n4 = idx + w;
      if (x > 0 && red[n1] && !seen[n1]) { seen[n1] = 1; stack[top++] = n1; }
      if (x + 1 < w && red[n2] && !seen[n2]) { seen[n2] = 1; stack[top++] = n2; }
      if (y > 0 && red[n3] && !seen[n3]) { seen[n3] = 1; stack[top++] = n3; }
      if (y + 1 < h && red[n4] && !seen[n4]) { seen[n4] = 1; stack[top++] = n4; }
    }
    const rw = maxX - minX + 1, rh = maxY - minY + 1, density = area / Math.max(1, rw * rh);
    if (area < 80 || rw < 40 || rh < 40 || density > 0.12) continue;
    let rough = 0, prev = null;
    for (let y = minY; y <= maxY; y++) {
      let lo = w, hi = -1;
      for (let x = minX; x <= maxX; x++) if (seen[y * w + x] && red[y * w + x]) { lo = Math.min(lo, x); hi = Math.max(hi, x); }
      if (hi >= 0) { if (prev) rough += Math.abs(lo - prev[0]) + Math.abs(hi - prev[1]); prev = [lo, hi]; }
    }
    const roughness = rough / Math.max(1, rh);
    if (roughness < 0.35) continue;
    const scaleX = (pageBounds[2] - pageBounds[0]) / Math.max(1, w), scaleY = (pageBounds[3] - pageBounds[1]) / Math.max(1, h);
    out.push({ box: [pageBounds[0] + minX * scaleX, pageBounds[1] + minY * scaleY, pageBounds[0] + (maxX + 1) * scaleX, pageBounds[1] + (maxY + 1) * scaleY], area, density, roughness });
  }
  return out.sort((a, b) => (b.area * b.roughness) - (a.area * a.roughness)).slice(0, 4);
}
function collectRedPaths(page, cloudBoxes) {
  const paths = []; if (!cloudBoxes.length) return paths;
  const device = new mupdf.Device({
    strokePath(path, stroke, ctm, _cs, color, alpha) {
      if (!rgbRed(color) || Number(alpha ?? 1) < 0.35) return;
      const width = Number(stroke?.lineWidth ?? 0); if (width <= 0 || width > 1.5) return;
      let bounds; try { bounds = rectArray(path.getBounds(stroke, ctm)); } catch (_) { return; }
      if (!bounds || rectArea(bounds) <= 0) return;
      if (!cloudBoxes.some(c => rectIntersects(bounds, c.box, Math.max(1.5, width * 2.5)))) return;
      paths.push({ ops: pathOps(path, ctm), width, bounds });
    },
  });
  page.runPageContents(device, mupdf.Matrix.identity); device.close(); return paths;
}
function appendContent(doc, page, content) {
  const obj = page.getObject(), stream = doc.addStream(content, {}), contents = obj.get('Contents');
  if (!contents || contents.isNull()) { obj.put('Contents', stream); return; }
  if (contents.isArray()) { contents.push(stream); return; }
  const arr = doc.newArray(); arr.push(contents); arr.push(stream); obj.put('Contents', arr);
}
function n(v) { return Number(v).toFixed(3); }
function serializeMask(paths) {
  const out = ['q', '1 1 1 RG', '1.1 J', '1.1 j'];
  for (const p of paths) {
    out.push(`${n(Math.max(0.32, Math.min(1.6, p.width * 2.2)))} w`);
    for (const op of p.ops) {
      if (op[0] === 'm') out.push(`${n(op[1])} ${n(op[2])} m`);
      else if (op[0] === 'l') out.push(`${n(op[1])} ${n(op[2])} l`);
      else if (op[0] === 'c') out.push(`${n(op[1])} ${n(op[2])} ${n(op[3])} ${n(op[4])} ${n(op[5])} ${n(op[6])} c`);
      else if (op[0] === 'h') out.push('h');
    }
    out.push('S');
  }
  out.push('Q'); return new TextEncoder().encode(out.join('\n'));
}
export async function detectRevisionClouds(data) {
  const doc = mupdf.PDFDocument.openDocument(new Uint8Array(data), 'application/pdf'), results = [];
  try {
    for (let i = 0; i < doc.countPages(); i++) {
      const page = doc.loadPage(i), boxes = rasterComponents(page); if (!boxes.length) continue;
      const paths = collectRedPaths(page, boxes); if (!paths.length) continue; const matched = [];
      for (const box of boxes) { const inside = paths.filter(p => rectIntersects(p.bounds, box.box, 1.5)); if (inside.length >= 20) matched.push({ box: box.box, pathCount: inside.length, density: box.density, roughness: box.roughness }); }
      if (matched.length) results.push({ page: i + 1, clouds: matched });
    }
  } finally { doc.destroy(); }
  return results;
}
export async function removeRevisionClouds(data, detected) {
  if (!detected?.length) return { bytes: new Uint8Array(data), count: 0 };
  const doc = mupdf.PDFDocument.openDocument(new Uint8Array(data), 'application/pdf'); let count = 0;
  try {
    for (const pageInfo of detected) {
      const page = doc.loadPage(pageInfo.page - 1), paths = collectRedPaths(page, pageInfo.clouds); if (!paths.length) continue;
      appendContent(doc, page, serializeMask(paths)); count += pageInfo.clouds.length;
    }
    const buffer = doc.saveToBuffer('garbage=4,compress=yes,appearance=yes'); return { bytes: new Uint8Array(buffer.asUint8Array()), count };
  } finally { doc.destroy(); }
}
async function analyzeVisibleBatch() {
  if (!q(BOX)?.checked) return; const batch = window.__batchAnalysis || [];
  for (const item of batch) {
    if (item?.error || !item.data) continue;
    try { const detected = await detectRevisionClouds(item.data); item.revisionClouds = detected; item.revisionCloudCount = detected.reduce((sum, p) => sum + p.clouds.length, 0); }
    catch (e) { item.revisionClouds = []; item.revisionCloudError = e?.message || String(e); }
  }
  const total = batch.reduce((s, a) => s + Number(a?.revisionCloudCount || 0), 0);
  if (total) { const s = q(SUMMARY); if (s) { s.textContent = (s.textContent || '').replace(/ · ☁️[^·]*/g, '') + ` · ☁️ ${total} nube${total === 1 ? '' : 's'} de revisión detectada${total === 1 ? '' : 's'}`; s.classList.remove('hidden'); } }
  if (q(STATUS)) q(STATUS).textContent = total ? `Detectadas ${total} nube${total === 1 ? '' : 's'} de revisión gráfica${total === 1 ? '' : 's'}.` : 'No se detectaron nubes de revisión gráficas.';
}
async function prepareRevisionClouds() {
  if (!q(BOX)?.checked) return; const batch = window.__batchAnalysis || [];
  for (const item of batch) {
    if (item?.error || !item.data) continue;
    const detected = Array.isArray(item.revisionClouds) ? item.revisionClouds : await detectRevisionClouds(item.data); if (!detected.length) continue;
    const cleaned = await removeRevisionClouds(item.data, detected); item.data = cleaned.bytes; item.revisionCloudApplied = cleaned.count;
  }
}
function inject() {
  if (q(BOX)) return; const comments = q('#batchRemoveComments'), host = comments?.closest('.option-box'); if (!host) return;
  const box = document.createElement('div'); box.className = 'option-box'; box.style.marginTop = '10px';
  box.innerHTML = '<label><input id="batchRemoveRevisionClouds" type="checkbox"><span>☁️ Eliminar nubes de revisión gráficas</span></label><small>Detecta automáticamente nubes rojas de revisión dibujadas como vector. Solo se ejecuta al activar esta opción.</small>';
  host.parentElement?.insertBefore(box, host.nextElementSibling);
}
function hookApply() {
  const current = window.__prepareBatchAnnotationOperations;
  if (typeof current !== 'function' || current.__withRevisionClouds) { if (typeof current !== 'function') setTimeout(hookApply, 0); return; }
  const wrapped = async function() { await current(); await prepareRevisionClouds(); };
  wrapped.__withRevisionClouds = true; window.__prepareBatchAnnotationOperations = wrapped;
}
function wire() {
  inject();
  q('#batchAnalyze')?.addEventListener('click', () => setTimeout(() => analyzeVisibleBatch().catch(e => console.error('[revision-clouds]', e)), 900));
  hookApply();
}
window.__prepareRevisionCloudOperations = prepareRevisionClouds;
window.__detectRevisionClouds = detectRevisionClouds;
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
