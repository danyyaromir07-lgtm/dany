let detectorPromise = null;
const CHECKBOX = '#batchRemoveRevisionClouds';
const STATUS = '#batchStatus';
const SUMMARY = '#batchSummary';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const q = (s) => document.querySelector(s);

function ensureCheckbox() {
  if (q(CHECKBOX)) return q(CHECKBOX);
  const host = q('#batchRemoveComments')?.closest('.option-box');
  if (!host) return null;
  const box = document.createElement('div');
  box.className = 'option-box';
  box.style.marginTop = '10px';
  box.innerHTML = '<label><input id="batchRemoveRevisionClouds" type="checkbox"><span>☁️ Eliminar nubes de revisión gráficas</span></label><small>Detector opcional. Solo se ejecuta cuando lo activas.</small>';
  host.parentElement?.insertBefore(box, host.nextElementSibling);
  return box.querySelector(CHECKBOX);
}

async function loadMuPDF() {
  if (!detectorPromise) detectorPromise = import('https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js');
  return detectorPromise;
}

function isRed(r, g, b) {
  return r >= 135 && r >= g + 35 && r >= b + 35 && g <= 190 && b <= 190;
}

function dilate(mask, w, h) {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let hit = 0;
      for (let dy = -1; dy <= 1 && !hit; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx >= 0 && xx < w && yy >= 0 && yy < h && mask[yy * w + xx]) { hit = 1; break; }
        }
      }
      out[y * w + x] = hit;
    }
  }
  return out;
}

function components(mask, w, h) {
  const seen = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  const out = [];
  for (let sy = 0; sy < h; sy++) {
    for (let sx = 0; sx < w; sx++) {
      const seed = sy * w + sx;
      if (!mask[seed] || seen[seed]) continue;
      let top = 0, area = 0, minX = sx, maxX = sx, minY = sy, maxY = sy;
      stack[top++] = seed; seen[seed] = 1;
      while (top) {
        const idx = stack[--top], y = (idx / w) | 0, x = idx - y * w;
        area++;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        const n = [idx - 1, idx + 1, idx - w, idx + w];
        if (x > 0 && mask[n[0]] && !seen[n[0]]) { seen[n[0]] = 1; stack[top++] = n[0]; }
        if (x + 1 < w && mask[n[1]] && !seen[n[1]]) { seen[n[1]] = 1; stack[top++] = n[1]; }
        if (y > 0 && mask[n[2]] && !seen[n[2]]) { seen[n[2]] = 1; stack[top++] = n[2]; }
        if (y + 1 < h && mask[n[3]] && !seen[n[3]]) { seen[n[3]] = 1; stack[top++] = n[3]; }
      }
      const bw = maxX - minX + 1, bh = maxY - minY + 1;
      const density = area / Math.max(1, bw * bh);
      const fraction = (bw * bh) / Math.max(1, w * h);
      if (area < 250 || bw < 50 || bh < 50 || density > 0.20 || fraction > 0.70) continue;
      let rough = 0, rows = 0, prev = null;
      for (let y = minY; y <= maxY; y++) {
        let lo = w, hi = -1;
        for (let x = minX; x <= maxX; x++) if (mask[y * w + x]) { lo = Math.min(lo, x); hi = Math.max(hi, x); }
        if (hi >= 0) { rows++; if (prev) rough += Math.abs(lo - prev[0]) + Math.abs(hi - prev[1]); prev = [lo, hi]; }
      }
      const roughness = rough / Math.max(1, rows);
      if (roughness < 0.03) continue;
      const crop = new Uint8Array(bw * bh);
      for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) crop[y * bw + x] = mask[(minY + y) * w + (minX + x)];
      out.push({ minX, minY, bw, bh, density, roughness, area, crop, cropW: bw, cropH: bh, scale: 0.18 });
    }
  }
  return out.sort((a, b) => b.area - a.area).slice(0, 4);
}

async function detectPage(mupdf, page, scale = 0.18) {
  const pix = page.toPixmap(mupdf.Matrix.scale(scale, scale), mupdf.ColorSpace.DeviceRGB, false, false);
  const w = pix.getWidth(), h = pix.getHeight(), c = pix.getNumberOfComponents();
  if (!w || !h || c < 3) return [];
  const px = pix.getPixels();
  const red = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < red.length; i++, p += c) red[i] = isRed(px[p], px[p + 1], px[p + 2]) ? 1 : 0;
  const mask = dilate(red, w, h);
  const found = components(mask, w, h);
  const bounds = page.getBounds();
  return found.map((x) => ({ ...x, scale, bbox: [bounds[0] + x.minX / scale, bounds[1] + x.minY / scale, bounds[0] + (x.minX + x.bw) / scale, bounds[1] + (x.minY + x.bh) / scale] }));
}

export async function detectRevisionClouds(data) {
  const mupdf = await loadMuPDF();
  const doc = mupdf.PDFDocument.openDocument(new Uint8Array(data), 'application/pdf');
  const out = [];
  try {
    for (let i = 0; i < doc.countPages(); i++) {
      const page = doc.loadPage(i);
      let found = await detectPage(mupdf, page, 0.18);
      if (!found.length) found = await detectPage(mupdf, page, 0.30);
      if (found.length) out.push({ page: i + 1, clouds: found });
    }
  } finally { doc.destroy(); }
  return out;
}

async function waitForAnalysis() {
  for (let i = 0; i < 600; i++) {
    const a = window.__batchAnalysis;
    if (Array.isArray(a) && a.length && a.every((x) => x?.error || x?.data)) return a;
    await sleep(100);
  }
  return Array.isArray(window.__batchAnalysis) ? window.__batchAnalysis : [];
}

function report(total, errors) {
  const status = q(STATUS);
  if (status) status.textContent = total ? `☁️ ${total} nube${total === 1 ? '' : 's'} de revisión detectada${total === 1 ? '' : 's'}.` : `☁️ Detector de nubes: 0 detectadas${errors ? ` · errores: ${errors}` : ''}.`;
  const summary = q(SUMMARY);
  if (summary) {
    const clean = (summary.textContent || '').replace(/ · ☁️[^·]*/g, '').trim();
    summary.textContent = `${clean} · ☁️ ${total} nube${total === 1 ? '' : 's'} detectada${total === 1 ? '' : 's'}`;
    summary.classList.remove('hidden');
  }
}

async function analyzeClouds() {
  const box = ensureCheckbox();
  if (!box?.checked) return;
  const batch = await waitForAnalysis();
  if (!batch.length) { report(0, 1); return; }
  let total = 0, errors = 0;
  for (const item of batch) {
    if (item?.error || !item?.data) continue;
    try {
      const found = await detectRevisionClouds(item.data);
      item.revisionClouds = found;
      item.revisionCloudCount = found.reduce((n, p) => n + p.clouds.length, 0);
      total += item.revisionCloudCount;
    } catch (err) {
      item.revisionClouds = [];
      item.revisionCloudCount = 0;
      item.revisionCloudError = err?.message || String(err);
      errors++;
    }
  }
  window.__revisionCloudDebug = { total, errors, batch: batch.map((x) => ({ name: x?.name, count: x?.revisionCloudCount || 0, error: x?.revisionCloudError || null })) };
  report(total, errors);
}

async function prepareClouds() {
  const box = ensureCheckbox();
  if (!box?.checked) return;
  const batch = Array.isArray(window.__batchAnalysis) ? window.__batchAnalysis : [];
  if (!batch.length) return;
  /* The first safe version only prepares the detection metadata here.
     Actual vector removal is intentionally left disabled until detection is verified on user PDFs. */
}

function wrapApply() {
  const base = window.__prepareBatchAnnotationOperations;
  if (typeof base !== 'function' || base.__cloudSafeWrap) return false;
  const wrapped = async function () { await base(); await prepareClouds(); };
  wrapped.__cloudSafeWrap = true;
  window.__prepareBatchAnnotationOperations = wrapped;
  return true;
}

function wire() {
  ensureCheckbox();
  document.addEventListener('change', (event) => { if (event.target?.matches?.(CHECKBOX) && event.target.checked) { loadMuPDF().catch(() => {}); } });
  document.addEventListener('click', (event) => {
    if (event.target?.closest?.('#batchAnalyze') && q(CHECKBOX)?.checked) setTimeout(() => analyzeClouds().catch(() => {}), 0);
  }, true);
  const retry = () => { if (!wrapApply()) setTimeout(retry, 50); };
  retry();
}

window.__detectRevisionClouds = detectRevisionClouds;
window.__analyzeRevisionClouds = analyzeClouds;
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
