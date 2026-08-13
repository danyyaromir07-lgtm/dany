import * as mupdf from 'https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js';

const BOX = '#batchRemoveRevisionClouds';
const SUMMARY = '#batchSummary';
const STATUS = '#batchStatus';
const q = (s) => document.querySelector(s);

function isRed(r, g, b) {
  return r >= 165 && g <= 135 && b <= 135 && r >= g + 60 && r >= b + 60;
}

function closeMask(mask, w, h) {
  const out = new Uint8Array(mask);
  const near = new Uint8Array(mask);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (mask[i]) continue;
      if (mask[i - 1] || mask[i + 1] || mask[i - w] || mask[i + w]) near[i] = 1;
    }
  }
  for (let i = 0; i < out.length; i++) if (near[i]) out[i] = 1;
  return out;
}

function findClouds(page, scale = 0.35) {
  const pix = page.toPixmap(mupdf.Matrix.scale(scale, scale), mupdf.ColorSpace.DeviceRGB, false, false);
  const w = pix.getWidth(), h = pix.getHeight(), comps = pix.getNumberOfComponents();
  if (!w || !h || comps < 3) return [];
  const px = pix.getPixels();
  const red = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < red.length; i++, p += comps) {
    red[i] = isRed(px[p], px[p + 1], px[p + 2]) ? 1 : 0;
  }
  const closed = closeMask(red, w, h);
  const seen = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  const bounds = page.getBounds();
  const sx = (bounds[2] - bounds[0]) / w;
  const sy = (bounds[3] - bounds[1]) / h;
  const found = [];

  for (let y0 = 0; y0 < h; y0++) {
    for (let x0 = 0; x0 < w; x0++) {
      const seed = y0 * w + x0;
      if (!closed[seed] || seen[seed]) continue;
      let top = 0, area = 0;
      let minX = x0, maxX = x0, minY = y0, maxY = y0;
      stack[top++] = seed;
      seen[seed] = 1;
      while (top) {
        const idx = stack[--top];
        const y = (idx / w) | 0;
        const x = idx - y * w;
        area++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        const n1 = idx - 1, n2 = idx + 1, n3 = idx - w, n4 = idx + w;
        if (x > 0 && closed[n1] && !seen[n1]) { seen[n1] = 1; stack[top++] = n1; }
        if (x + 1 < w && closed[n2] && !seen[n2]) { seen[n2] = 1; stack[top++] = n2; }
        if (y > 0 && closed[n3] && !seen[n3]) { seen[n3] = 1; stack[top++] = n3; }
        if (y + 1 < h && closed[n4] && !seen[n4]) { seen[n4] = 1; stack[top++] = n4; }
      }
      const rw = maxX - minX + 1, rh = maxY - minY + 1;
      const density = area / Math.max(1, rw * rh);
      if (area < 350 || rw < 80 || rh < 80 || density > 0.10) continue;
      let rough = 0, rows = 0, prev = null;
      for (let y = minY; y <= maxY; y++) {
        let lo = w, hi = -1;
        for (let x = minX; x <= maxX; x++) if (closed[y * w + x]) { lo = Math.min(lo, x); hi = Math.max(hi, x); }
        if (hi >= 0) {
          rows++;
          if (prev) rough += Math.abs(lo - prev[0]) + Math.abs(hi - prev[1]);
          prev = [lo, hi];
        }
      }
      const roughness = rough / Math.max(1, rows);
      if (roughness < 0.8) continue;
      const pixelBox = [minX, minY, maxX + 1, maxY + 1];
      const pageBox = [
        bounds[0] + pixelBox[0] * sx,
        bounds[1] + pixelBox[1] * sy,
        bounds[0] + pixelBox[2] * sx,
        bounds[1] + pixelBox[3] * sy,
      ];
      found.push({ pageBox, pixelBox, scale, red, closed, width: w, height: h, area, density, roughness });
    }
  }
  return found.sort((a, b) => b.area - a.area).slice(0, 4);
}

function runsForCloud(cloud) {
  const { red, closed, width: w, height: h, pixelBox } = cloud;
  const [minX, minY, maxX, maxY] = pixelBox;
  const keep = new Uint8Array(red.length);
  for (let y = Math.max(0, minY - 2); y < Math.min(h, maxY + 2); y++) {
    for (let x = Math.max(0, minX - 2); x < Math.min(w, maxX + 2); x++) {
      const i = y * w + x;
      if (red[i] && closed[i]) keep[i] = 1;
    }
  }
  const runs = [];
  for (let y = minY; y < maxY; y++) {
    let x = minX;
    while (x < maxX) {
      while (x < maxX && !keep[y * w + x]) x++;
      if (x >= maxX) break;
      const start = x;
      while (x < maxX && keep[y * w + x]) x++;
      runs.push([start, y, x, y + 1]);
    }
  }
  return runs;
}

export async function detectRevisionClouds(data) {
  const doc = mupdf.PDFDocument.openDocument(new Uint8Array(data), 'application/pdf');
  const out = [];
  try {
    for (let i = 0; i < doc.countPages(); i++) {
      const page = doc.loadPage(i);
      const clouds = findClouds(page);
      if (clouds.length) out.push({ page: i + 1, clouds });
    }
  } finally { doc.destroy(); }
  return out;
}

export async function removeRevisionClouds(data, detected) {
  if (!detected?.length) return { bytes: new Uint8Array(data), count: 0 };
  const doc = mupdf.PDFDocument.openDocument(new Uint8Array(data), 'application/pdf');
  let count = 0;
  try {
    for (const pageInfo of detected) {
      const page = doc.loadPage(pageInfo.page - 1);
      const bounds = page.getBounds();
      for (const cloud of pageInfo.clouds) {
        const runs = runsForCloud(cloud);
        const [minX, minY, maxX, maxY] = cloud.pixelBox;
        const sx = (bounds[2] - bounds[0]) / cloud.width;
        const sy = (bounds[3] - bounds[1]) / cloud.height;
        // Merge consecutive runs with the same x-range to reduce annotations.
        const merged = [];
        const last = new Map();
        for (const r of runs) {
          const key = `${r[0]}:${r[2]}`;
          const prev = last.get(key);
          if (prev && prev[3] === r[1]) prev[3] = r[3];
          else { const m = [r[0], r[1], r[2], r[3]]; merged.push(m); last.set(key, m); }
        }
        for (const r of merged) {
          const rect = [
            bounds[0] + r[0] * sx,
            bounds[1] + r[1] * sy,
            bounds[0] + r[2] * sx,
            bounds[1] + r[3] * sy,
          ];
          const a = page.createAnnotation('Redact');
          a.setRect(rect);
          try { a.setBorderWidth(0); } catch (_) {}
          a.update();
        }
        if (merged.length) {
          if (typeof page.applyRedactions !== 'function') throw new Error('MuPDF no expone applyRedactions().');
          page.applyRedactions(false, 0);
          page.update();
          count++;
        }
      }
    }
    const b = doc.saveToBuffer('garbage=4,compress=yes,appearance=yes');
    return { bytes: new Uint8Array(b.asUint8Array()), count };
  } finally { doc.destroy(); }
}

function inject() {
  if (q(BOX)) return;
  const comments = q('#batchRemoveComments');
  const host = comments?.closest('.option-box');
  if (!host) return;
  const box = document.createElement('div');
  box.className = 'option-box';
  box.style.marginTop = '10px';
  box.innerHTML = '<label><input id="batchRemoveRevisionClouds" type="checkbox"><span>☁️ Eliminar nubes de revisión gráficas</span></label><small>Detecta automáticamente nubes gráficas rojas de revisión. Solo se ejecuta al activar esta opción.</small>';
  host.parentElement?.insertBefore(box, host.nextElementSibling);
}

async function analyze() {
  if (!q(BOX)?.checked) return;
  const batch = window.__batchAnalysis || [];
  let total = 0;
  for (const item of batch) {
    if (item?.error || !item.data) continue;
    try {
      const detected = await detectRevisionClouds(item.data);
      item.revisionClouds = detected;
      item.revisionCloudCount = detected.reduce((s, p) => s + p.clouds.length, 0);
      total += item.revisionCloudCount;
    } catch (e) {
      item.revisionClouds = [];
      item.revisionCloudError = e?.message || String(e);
    }
  }
  const summary = q(SUMMARY);
  if (summary) {
    const base = (summary.textContent || '').replace(/ · ☁️[^·]*/g, '').trim();
    summary.textContent = total ? `${base} · ☁️ ${total} nube${total === 1 ? '' : 's'} de revisión detectada${total === 1 ? '' : 's'}` : `${base} · ☁️ 0 nubes de revisión detectadas`;
    summary.classList.remove('hidden');
  }
  if (q(STATUS)) q(STATUS).textContent = total ? `Detectadas ${total} nube${total === 1 ? '' : 's'} de revisión gráfica${total === 1 ? '' : 's'}.` : 'No se detectaron nubes de revisión gráficas.';
}

async function prepare() {
  if (!q(BOX)?.checked) return;
  const batch = window.__batchAnalysis || [];
  for (const item of batch) {
    if (item?.error || !item.data) continue;
    const detected = Array.isArray(item.revisionClouds) ? item.revisionClouds : await detectRevisionClouds(item.data);
    if (!detected.length) continue;
    const cleaned = await removeRevisionClouds(item.data, detected);
    item.data = cleaned.bytes;
    item.revisionCloudApplied = cleaned.count;
  }
}

function hook() {
  inject();
  q('#batchAnalyze')?.addEventListener('click', () => setTimeout(() => analyze().catch(e => console.error('[revision-clouds]', e)), 120));
  const wrap = () => {
    const current = window.__prepareBatchAnnotationOperations;
    if (typeof current !== 'function') return setTimeout(wrap, 20);
    if (current.__revisionCloudsWrapped) return;
    const wrapped = async () => { await current(); await prepare(); };
    wrapped.__revisionCloudsWrapped = true;
    window.__prepareBatchAnnotationOperations = wrapped;
  };
  wrap();
}

window.__prepareRevisionCloudOperations = prepare;
window.__detectRevisionClouds = detectRevisionClouds;

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hook);
else hook();
