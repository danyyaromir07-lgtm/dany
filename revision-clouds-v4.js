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
          if (xx >= 0 && xx < w && yy >= 0 && yy < h && mask[yy * w + xx]) {
            hit = 1;
            break;
          }
        }
      }
      out[y * w + x] = hit;
    }
  }
  return out;
}

function components(mask, w, h) {
  const seen = new Uint8Array(w * h), stack = new Int32Array(w * h), out = [];
  for (let sy = 0; sy < h; sy++) for (let sx = 0; sx < w; sx++) {
    const seed = sy * w + sx;
    if (!mask[seed] || seen[seed]) continue;
    let top = 0, area = 0, minX = sx, maxX = sx, minY = sy, maxY = sy;
    stack[top++] = seed; seen[seed] = 1;
    while (top) {
      const idx = stack[--top], y = (idx / w) | 0, x = idx - y * w;
      area++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      const n = [idx - 1, idx + 1, idx - w, idx + w];
      if (x > 0 && mask[n[0]] && !seen[n[0]]) { seen[n[0]] = 1; stack[top++] = n[0]; }
      if (x + 1 < w && mask[n[1]] && !seen[n[1]]) { seen[n[1]] = 1; stack[top++] = n[1]; }
      if (y > 0 && mask[n[2]] && !seen[n[2]]) { seen[n[2]] = 1; stack[top++] = n[2]; }
      if (y + 1 < h && mask[n[3]] && !seen[n[3]]) { seen[n[3]] = 1; stack[top++] = n[3]; }
    }
    const bw = maxX - minX + 1, bh = maxY - minY + 1;
    const density = area / Math.max(1, bw * bh), fraction = bw * bh / Math.max(1, w * h);
    if (area < 250 || bw < 50 || bh < 50 || density > 0.20 || fraction > 0.70) continue;
    let rough = 0, rows = 0, prev = null;
    for (let y = minY; y <= maxY; y++) {
      let lo = w, hi = -1;
      for (let x = minX; x <= maxX; x++) if (mask[y * w + x]) { lo = Math.min(lo, x); hi = Math.max(hi, x); }
      if (hi >= 0) {
        rows++;
        if (prev) rough += Math.abs(lo - prev[0]) + Math.abs(hi - prev[1]);
        prev = [lo, hi];
      }
    }
    const roughness = rough / Math.max(1, rows);
    if (roughness < 0.03) continue;
    const crop = new Uint8Array(bw * bh);
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) crop[y * bw + x] = mask[(minY + y) * w + (minX + x)];
    out.push({ minX, minY, bw, bh, density, roughness, area, crop, cropW: bw, cropH: bh });
  }
  return out.sort((a, b) => b.area - a.area).slice(0, 4);
}

async function detectPage(mupdf, page, scale = 0.18) {
  const pix = page.toPixmap(mupdf.Matrix.scale(scale, scale), mupdf.ColorSpace.DeviceRGB, false, false);
  const w = pix.getWidth(), h = pix.getHeight(), c = pix.getNumberOfComponents();
  if (!w || !h || c < 3) return [];
  const px = pix.getPixels(), red = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < red.length; i++, p += c) red[i] = isRed(px[p], px[p + 1], px[p + 2]) ? 1 : 0;
  const mask = dilate(red, w, h), found = components(mask, w, h), bounds = page.getBounds();
  return found.map(x => ({ ...x, scale, bbox: [bounds[0] + x.minX / scale, bounds[1] + x.minY / scale, bounds[0] + (x.minX + x.bw) / scale, bounds[1] + (x.minY + x.bh) / scale] }));
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
  } finally {
    doc.destroy();
  }
  return out;
}

async function waitForAnalysis() {
  for (let i = 0; i < 600; i++) {
    const a = window.__batchAnalysis;
    if (Array.isArray(a) && a.length && a.every(x => x?.error || x?.data)) return a;
    await sleep(100);
  }
  return Array.isArray(window.__batchAnalysis) ? window.__batchAnalysis : [];
}

function report(total, errors, debug = '') {
  const status = q(STATUS);
  if (status) status.textContent = total ? `☁️ ${total} nube${total === 1 ? '' : 's'} de revisión detectada${total === 1 ? '' : 's'}.` : `☁️ Detector de nubes: 0 detectadas${errors ? ` · errores: ${errors}` : ''}${debug ? ` · ${debug}` : ''}.`;
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
  if (!batch.length) { report(0, 1, 'sin datos de análisis'); return; }
  let total = 0, errors = 0, filesChecked = 0;
  for (const item of batch) {
    if (item?.error || !item?.data) continue;
    filesChecked++;
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
  window.__revisionCloudDebug = { total, errors, filesChecked, batch: batch.map(x => ({ name: x?.name, count: x?.revisionCloudCount || 0, error: x?.revisionCloudError || null })) };
  report(total, errors, errors ? `archivos ${filesChecked}` : `archivos ${filesChecked}`);
}

/*
 * Eliminación segura de la nube:
 * reutiliza el bbox ya detectado, vuelve a rasterizar únicamente esa pequeña
 * zona y crea micro-redacciones solo sobre los píxeles rojos. Así no se cubre
 * todo el bbox y no se usa pdf-lib ni se toca el motor de aplicación estable.
 */
async function eraseCloudWithRedactions(mupdf, page, cloud) {
  const scale = 0.45;
  const pix = page.toPixmap(mupdf.Matrix.scale(scale, scale), mupdf.ColorSpace.DeviceRGB, false, false);
  const w = pix.getWidth(), h = pix.getHeight(), c = pix.getNumberOfComponents();
  if (!w || !h || c < 3) return 0;
  const px = pix.getPixels();
  const bounds = page.getBounds();
  const bx0 = Math.max(0, Math.floor((cloud.bbox[0] - bounds[0]) * scale) - 2);
  const by0 = Math.max(0, Math.floor((cloud.bbox[1] - bounds[1]) * scale) - 2);
  const bx1 = Math.min(w, Math.ceil((cloud.bbox[2] - bounds[0]) * scale) + 2);
  const by1 = Math.min(h, Math.ceil((cloud.bbox[3] - bounds[1]) * scale) + 2);
  const maskW = Math.max(1, bx1 - bx0), maskH = Math.max(1, by1 - by0);
  const red = new Uint8Array(maskW * maskH);
  for (let y = 0; y < maskH; y++) {
    for (let x = 0; x < maskW; x++) {
      const gx = bx0 + x, gy = by0 + y, p = (gy * w + gx) * c;
      red[y * maskW + x] = isRed(px[p], px[p + 1], px[p + 2]) ? 1 : 0;
    }
  }
  const mask = dilate(red, maskW, maskH);
  let rects = 0;
  const REDACT_IMAGE_NONE = mupdf.PDFPage?.REDACT_IMAGE_NONE ?? 0;

  // Agrupar cada fila contigua de máscara en una sola redacción fina.
  // El espesor queda limitado a ~2-3 píxeles del render, no al bbox completo.
  for (let y = 0; y < maskH; y++) {
    let runStart = -1;
    for (let x = 0; x <= maskW; x++) {
      const hit = x < maskW && mask[y * maskW + x];
      if (hit && runStart < 0) runStart = x;
      if ((!hit || x === maskW) && runStart >= 0) {
        const x0 = runStart, x1 = x;
        const r = [
          bounds[0] + (bx0 + x0 - 1) / scale,
          bounds[1] + (by0 + y - 1) / scale,
          bounds[0] + (bx0 + x1 + 1) / scale,
          bounds[1] + (by0 + y + 2) / scale
        ];
        if (r[2] > r[0] && r[3] > r[1]) {
          const annot = page.createAnnotation('Redact');
          annot.setRect(r);
          annot.applyRedaction(false, REDACT_IMAGE_NONE);
          rects++;
        }
        runStart = -1;
      }
    }
  }
  return rects;
}

async function applyClouds() {
  const box = ensureCheckbox();
  if (!box?.checked) return;
  const batch = Array.isArray(window.__batchAnalysis) ? window.__batchAnalysis : [];
  if (!batch.length) return;
  const mupdf = await loadMuPDF();
  let removed = 0;
  let errors = 0;
  const diagnostics = [];

  for (const item of batch) {
    if (item?.error || !item.data || !Array.isArray(item.revisionClouds) || !item.revisionClouds.length) continue;
    const doc = mupdf.PDFDocument.openDocument(new Uint8Array(item.data), 'application/pdf');
    try {
      for (const p of item.revisionClouds) {
        const page = doc.loadPage(p.page - 1);
        for (const cloud of p.clouds) {
          try {
            const n = await eraseCloudWithRedactions(mupdf, page, cloud);
            removed += n > 0 ? 1 : 0;
          } catch (err) {
            errors++;
            diagnostics.push(`${item.name}: página ${p.page}: ${err?.message || String(err)}`);
          }
        }
      }
      if (errors === 0) {
        const buffer = doc.saveToBuffer('garbage=4,compress=yes,appearance=yes');
        item.data = buffer?.asUint8Array ? new Uint8Array(buffer.asUint8Array()) : new Uint8Array(buffer);
        item.revisionCloudApplied = item.revisionCloudCount || 0;
      }
    } finally {
      doc.destroy();
    }
  }
  window.__revisionCloudApplyDebug = { removed, errors, diagnostics };
  if (errors) throw new Error(`Nubes: ${diagnostics.join(' | ')}`.slice(0, 2500));
  if (removed) {
    const status = q(STATUS);
    if (status) status.textContent = `☁️ ${removed} nube${removed === 1 ? '' : 's'} de revisión eliminada${removed === 1 ? '' : 's'}.`;
  }
}

function wrapApply() {
  const base = window.__prepareBatchAnnotationOperations;
  if (typeof base !== 'function' || base.__cloudSafeWrap) return false;
  const wrapped = async function () {
    await base();
    await applyClouds();
  };
  wrapped.__cloudSafeWrap = true;
  window.__prepareBatchAnnotationOperations = wrapped;
  return true;
}

function installBatchAssignmentHook() {
  if (window.__revisionCloudAssignmentHook) return;
  let current = window.__batchAnalysis;
  try {
    Object.defineProperty(window, '__batchAnalysis', {
      configurable: true,
      enumerable: true,
      get() { return current; },
      set(value) {
        current = value;
        if (q(CHECKBOX)?.checked && Array.isArray(value) && value.length) {
          setTimeout(() => analyzeClouds().catch(err => {
            window.__revisionCloudDebug = { total: 0, errors: 1, filesChecked: 0, hookError: err?.message || String(err) };
            report(0, 1, err?.message || String(err));
          }), 0);
        }
      }
    });
    window.__revisionCloudAssignmentHook = true;
  } catch (_) {
    window.__revisionCloudAssignmentHook = false;
  }
}

function wire() {
  ensureCheckbox();
  installBatchAssignmentHook();
  document.addEventListener('change', event => {
    if (event.target?.matches?.(CHECKBOX) && event.target.checked) {
      loadMuPDF().catch(err => {
        window.__revisionCloudDebug = { total: 0, errors: 1, error: err?.message || String(err) };
        report(0, 1, err?.message || String(err));
      });
    }
  });
  const retry = () => { if (!wrapApply()) setTimeout(retry, 50); };
  retry();
}

window.__detectRevisionClouds = detectRevisionClouds;
window.__analyzeRevisionClouds = analyzeClouds;
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
