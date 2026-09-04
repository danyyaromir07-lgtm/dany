const CHECKBOX = '#batchRemoveRevisionClouds';
const STATUS = '#batchStatus';
const SUMMARY = '#batchSummary';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const q = (s) => document.querySelector(s);
let detectorPromise = null;

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
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let hit = 0;
    for (let dy = -1; dy <= 1 && !hit; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && xx < w && yy >= 0 && yy < h && mask[yy * w + xx]) { hit = 1; break; }
    }
    out[y * w + x] = hit;
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
      area++; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
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
      if (hi >= 0) { rows++; if (prev) rough += Math.abs(lo - prev[0]) + Math.abs(hi - prev[1]); prev = [lo, hi]; }
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
  } finally { doc.destroy(); }
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
      item.revisionClouds = []; item.revisionCloudCount = 0; item.revisionCloudError = err?.message || String(err); errors++;
    }
  }
  window.__revisionCloudDebug = { total, errors, filesChecked };
  report(total, errors, `archivos ${filesChecked}`);
}

function isRedStroke(color, alpha) {
  return Number(alpha) > 0 && color && color.length >= 3 && Number(color[0]) >= 0.65 && Number(color[0]) >= Number(color[1]) + 0.25 && Number(color[0]) >= Number(color[2]) + 0.25;
}

function pathRectToPixmap(pathRect, page, scale) {
  const b = page.getBounds();
  return [
    (pathRect[0] - b[0]) * scale,
    (pathRect[1] - b[1]) * scale,
    (pathRect[2] - b[0]) * scale,
    (pathRect[3] - b[1]) * scale
  ];
}

function pathTouchesCloud(pathRect, page, cloud) {
  const [x0, y0, x1, y1] = pathRectToPixmap(pathRect, page, cloud.scale || 0.18);
  const cx0 = cloud.minX, cy0 = cloud.minY, cx1 = cloud.minX + cloud.cropW, cy1 = cloud.minY + cloud.cropH;
  const ix0 = Math.max(cx0, Math.floor(Math.min(x0, x1)) - 2), iy0 = Math.max(cy0, Math.floor(Math.min(y0, y1)) - 2);
  const ix1 = Math.min(cx1, Math.ceil(Math.max(x0, x1)) + 2), iy1 = Math.min(cy1, Math.ceil(Math.max(y0, y1)) + 2);
  if (ix1 <= ix0 || iy1 <= iy0) return false;
  for (let y = iy0; y < iy1; y++) for (let x = ix0; x < ix1; x++) {
    if (cloud.crop[(y - cy0) * cloud.cropW + (x - cx0)]) return true;
  }
  return false;
}

function redPaths(mupdf, page, cloud) {
  const hits = [];
  const device = new mupdf.Device({
    strokePath(path, stroke, ctm, colorSpace, color, alpha) {
      if (!isRedStroke(color, alpha)) return;
      try {
        const r = path.getBounds(stroke, ctm);
        const rect = [Number(r[0]), Number(r[1]), Number(r[2]), Number(r[3])];
        if (rect.every(Number.isFinite) && pathTouchesCloud(rect, page, cloud)) hits.push(rect);
      } catch (_) {}
    },
    fillPath() {}, clipPath() {}, clipStrokePath() {}, fillText() {}, clipText() {}, strokeText() {}, clipStrokeText() {}, ignoreText() {},
    fillShade() {}, fillImage() {}, fillImageMask() {}, clipImageMask() {}, beginMask() {}, endMask() {}, popClip() {}, beginGroup() {}, endGroup() {}, beginTile() { return 0; }, endTile() {}, beginLayer() {}, endLayer() {}, beginStructure() {}, endStructure() {}, beginMetatext() {}, endMetatext() {}, renderFlags() {}, setDefaultColorSpaces() {}, close() {}
  });
  try { page.run(device, mupdf.Matrix.identity); } finally { try { device.close?.(); } catch (_) {} }
  return hits;
}

function pointInsideAnyPathPixel(x, y, pathPixels) {
  for (const r of pathPixels) if (x >= r[0] - 2 && x <= r[2] + 2 && y >= r[1] - 2 && y <= r[3] + 2) return true;
  return false;
}

function createMaskRedactions(mupdf, page, cloud, paths) {
  const scale = cloud.scale || 0.18;
  const b = page.getBounds();
  const pathPixels = paths.map(r => pathRectToPixmap(r, page, scale));
  let created = 0;
  for (let localY = 0; localY < cloud.cropH; localY++) {
    let runStart = -1;
    for (let localX = 0; localX <= cloud.cropW; localX++) {
      const gx = cloud.minX + localX, gy = cloud.minY + localY;
      const maskHit = localX < cloud.cropW && !!cloud.crop[localY * cloud.cropW + localX];
      const pathHit = maskHit && pointInsideAnyPathPixel(gx, gy, pathPixels);
      if (pathHit && runStart < 0) runStart = localX;
      if ((!pathHit || localX === cloud.cropW) && runStart >= 0) {
        const x0 = b[0] + (cloud.minX + runStart - 1) / scale;
        const y0 = b[1] + (cloud.minY + localY - 1) / scale;
        const x1 = b[0] + (cloud.minX + localX + 1) / scale;
        const y1 = b[1] + (cloud.minY + localY + 2) / scale;
        if (x1 > x0 && y1 > y0) {
          const a = page.createAnnotation('Redact');
          a.setRect([x0, y0, x1, y1]);
          created++;
        }
        runStart = -1;
      }
    }
  }
  return created;
}

async function eraseCloud(mupdf, page, cloud) {
  const paths = redPaths(mupdf, page, cloud);
  if (!paths.length) return { paths: 0, redactions: 0 };
  const created = createMaskRedactions(mupdf, page, cloud, paths);
  if (!created) return { paths: paths.length, redactions: 0 };
  const imageNone = mupdf.PDFPage?.REDACT_IMAGE_NONE ?? 0;
  const lineRemoveTouched = mupdf.PDFPage?.REDACT_LINE_ART_REMOVE_IF_TOUCHED ?? 2;
  const textNone = mupdf.PDFPage?.REDACT_TEXT_NONE ?? 1;
  page.applyRedactions(false, imageNone, lineRemoveTouched, textNone);
  return { paths: paths.length, redactions: created };
}

async function applyClouds() {
  const box = ensureCheckbox();
  if (!box?.checked) return;
  const batch = Array.isArray(window.__batchAnalysis) ? window.__batchAnalysis : [];
  if (!batch.length) return;
  const mupdf = await loadMuPDF();
  let removed = 0, errors = 0;
  const diagnostics = [];
  for (const item of batch) {
    if (item?.error || !item.data || !Array.isArray(item.revisionClouds) || !item.revisionClouds.length) continue;
    const doc = mupdf.PDFDocument.openDocument(new Uint8Array(item.data), 'application/pdf');
    try {
      let itemRemoved = 0;
      for (const p of item.revisionClouds) {
        const page = doc.loadPage(p.page - 1);
        for (const cloud of p.clouds) {
          try {
            const result = await eraseCloud(mupdf, page, cloud);
            diagnostics.push(`${item.name}: página ${p.page}: paths=${result.paths}, redactions=${result.redactions}`);
            if (result.redactions > 0) itemRemoved++;
          } catch (err) {
            errors++;
            diagnostics.push(`${item.name}: página ${p.page}: ${err?.message || String(err)}`);
          }
        }
      }
      if (!errors && itemRemoved) {
        const buffer = doc.saveToBuffer('garbage=4,compress=yes,appearance=yes');
        item.data = buffer?.asUint8Array ? new Uint8Array(buffer.asUint8Array()) : new Uint8Array(buffer);
        item.revisionCloudApplied = itemRemoved;
        removed += itemRemoved;
      }
    } finally { doc.destroy(); }
  }
  window.__revisionCloudApplyDebug = { removed, errors, diagnostics };
  if (errors) throw new Error(`Nubes: ${diagnostics.join(' | ')}`.slice(0, 2500));
  if (!removed) throw new Error('La nube fue detectada pero no se localizaron sus trazos vectoriales rojos para eliminarla.');
  const status = q(STATUS);
  if (status) status.textContent = `☁️ ${removed} nube${removed === 1 ? '' : 's'} de revisión eliminada${removed === 1 ? '' : 's'}.`;
}

function wrapApply() {
  const base = window.__prepareBatchAnnotationOperations;
  if (typeof base !== 'function' || base.__cloudSafeWrap) return false;
  const wrapped = async function () { await base(); await applyClouds(); };
  wrapped.__cloudSafeWrap = true;
  window.__prepareBatchAnnotationOperations = wrapped;
  return true;
}

function wire() {
  ensureCheckbox();
  document.addEventListener('change', e => { if (e.target?.matches?.(CHECKBOX) && e.target.checked) loadMuPDF().catch(() => {}); });
  const retry = () => { if (!wrapApply()) setTimeout(retry, 50); };
  retry();
  let current = window.__batchAnalysis;
  try {
    Object.defineProperty(window, '__batchAnalysis', {
      configurable: true, enumerable: true,
      get() { return current; },
      set(value) { current = value; if (q(CHECKBOX)?.checked && Array.isArray(value) && value.length) setTimeout(() => analyzeClouds().catch(() => {}), 0); }
    });
  } catch (_) {}
}

window.__detectRevisionClouds = detectRevisionClouds;
window.__analyzeRevisionClouds = analyzeClouds;
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
