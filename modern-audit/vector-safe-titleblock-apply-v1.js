import * as mupdf from 'https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js';

const RENDER_SCALE = 1.0;
const FONT_BASE = 'FSafeCode';

function diag(stage, extra = {}) {
  try { window.__ocrDiagnostic?.({ time: new Date().toISOString(), stage, detail: 'titleblock-safe-apply-v1', ...extra }); } catch (_) {}
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
function asBytes(buffer) {
  return buffer?.asUint8Array ? new Uint8Array(buffer.asUint8Array()) : new Uint8Array(buffer);
}
function saveBytes(doc) {
  return asBytes(doc.saveToBuffer('garbage=0,compress=no,appearance=yes'));
}
function ascii(s) { return new TextEncoder().encode(s); }
function concat(...parts) {
  const size = parts.reduce((n, part) => n + part.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
}
function pdfEscapeBytes(text) {
  const out = [];
  for (const ch of String(text || '')) {
    const code = ch.codePointAt(0);
    let byte = code >= 0 && code <= 127 ? code : code >= 0xA0 && code <= 0xFF ? code : 63;
    if (code === 0x20AC) byte = 0x80;
    if (byte === 40 || byte === 41 || byte === 92) out.push(92);
    out.push(byte);
  }
  return new Uint8Array(out);
}
function fontAdvance(font, text) {
  let total = 0;
  for (const ch of String(text || '')) total += font.advanceGlyph(font.encodeCharacter(ch), 0);
  return total;
}
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function metrics(raw, replacement) {
  const width = Math.max(1, raw[2] - raw[0]);
  const height = Math.max(1, raw[3] - raw[1]);
  const font = new mupdf.Font('Helvetica');
  const size = clamp(height * 0.84, 3.2, 72);
  const advance = Math.max(0.01, fontAdvance(font, replacement) * size);
  const scaleX = clamp((width * 0.98) / advance, 0.48, 1.18);
  return { width, height, size, scaleX, replacementWidth: fontAdvance(font, replacement) * size * scaleX };
}
function pageTransform(page) {
  const base = Array.from(page.getTransform?.() || [], Number);
  if (base.length !== 6 || !base.every(Number.isFinite)) throw new Error('No se pudo obtener page.getTransform().');
  let rotation = 0;
  try {
    const dict = resolved(page.getObject());
    const rotateObject = dict?.getInheritable?.('Rotate') || dict?.get?.('Rotate');
    const rotateValue = resolved(rotateObject);
    rotation = Number(rotateValue?.asNumber?.() ?? rotateValue?.valueOf?.() ?? 0);
  } catch (_) {}
  rotation = ((rotation % 360) + 360) % 360;
  if (rotation !== 90 && rotation !== 180 && rotation !== 270) return base;
  const bounds = Array.from(page.getBounds?.() || [], Number);
  if (bounds.length !== 4 || !bounds.every(Number.isFinite)) return base;
  const [x0, y0, x1, y1] = bounds;
  const width = Math.abs(x1 - x0);
  const height = Math.abs(y1 - y0);
  let derotate;
  if (rotation === 90) derotate = [0, -1, 1, 0, -y0, width + x0];
  else if (rotation === 180) derotate = [-1, 0, 0, -1, width + x0, height + y0];
  else derotate = [0, 1, -1, 0, height + y0, -x0];
  const [a1, b1, c1, d1, e1, f1] = derotate;
  const [a2, b2, c2, d2, e2, f2] = base;
  return [
    a2 * a1 + c2 * b1,
    b2 * a1 + d2 * b1,
    a2 * c1 + c2 * d1,
    b2 * c1 + d2 * d1,
    a2 * e1 + c2 * f1 + e2,
    b2 * e1 + d2 * f1 + f2,
  ];
}
function resolved(obj) {
  try { return obj?.resolve?.() || obj; } catch (_) { return obj; }
}
function pageHandle(page) {
  const ref = page.getObject();
  const dict = resolved(ref);
  if (!dict?.isDictionary?.()) throw new Error('No se pudo resolver el diccionario de página.');
  return { ref, dict, indirect: !ref?.isDictionary?.() };
}
function commitIndirect(ref, obj, indirect) {
  if (indirect && typeof ref?.writeObject === 'function') ref.writeObject(obj);
}
function chooseFontResource(doc, page) {
  const pageObj = pageHandle(page);
  const resourceRef = pageObj.dict.get('Resources');
  let resources = resolved(resourceRef);
  const resourceIndirect = !!resourceRef && !resourceRef?.isDictionary?.();
  if (!resources || !resources.isDictionary?.()) {
    resources = doc.newDictionary();
    pageObj.dict.put('Resources', resources);
  }
  let fontRef = resources.get('Font');
  let fonts = resolved(fontRef);
  const fontIndirect = !!fontRef && !fontRef?.isDictionary?.();
  if (!fonts || !fonts.isDictionary?.()) {
    fonts = doc.newDictionary();
    resources.put('Font', fonts);
    fontRef = null;
  }
  let suffix = 1;
  let name = `${FONT_BASE}${suffix}`;
  while (fonts.get(name) && !fonts.get(name).isNull?.()) { suffix++; name = `${FONT_BASE}${suffix}`; }
  fonts.put(name, doc.addSimpleFont(new mupdf.Font('Helvetica'), 'Latin'));
  if (fontIndirect && fontRef?.writeObject) fontRef.writeObject(fonts);
  if (resourceIndirect && resourceRef?.writeObject) resourceRef.writeObject(resources);
  commitIndirect(pageObj.ref, pageObj.dict, pageObj.indirect);
  return name;
}
function appendContent(doc, page, content) {
  const pageObj = pageHandle(page);
  const stream = doc.addStream(content);
  const contentsRef = pageObj.dict.get('Contents');
  if (!contentsRef || contentsRef.isNull?.()) {
    pageObj.dict.put('Contents', stream);
    commitIndirect(pageObj.ref, pageObj.dict, pageObj.indirect);
    return;
  }
  const contents = resolved(contentsRef);
  const array = doc.newArray();
  if (contents?.isArray?.()) {
    for (let i = 0; i < contents.length; i++) array.push(contents.get(i));
  } else {
    array.push(contentsRef);
  }
  array.push(stream);
  pageObj.dict.put('Contents', array);
  commitIndirect(pageObj.ref, pageObj.dict, pageObj.indirect);
}
function makeOverlayContent(page, raw, replacement, m, fontName) {
  const [a, b, c, d, e, f] = pageTransform(page);
  const padX = Math.min(0.25, Math.max(0.06, m.height * 0.015));
  const padY = Math.min(0.65, Math.max(0.22, m.height * 0.055));
  const x = raw[0] - padX;
  const y = raw[1] - padY;
  const width = (raw[2] - raw[0]) + padX * 2;
  const height = (raw[3] - raw[1]) + padY * 2;
  const baseline = raw[3] - Math.max(0.15, m.height * 0.12);
  const prefix = `q ${a.toFixed(8)} ${b.toFixed(8)} ${c.toFixed(8)} ${d.toFixed(8)} ${e.toFixed(4)} ${f.toFixed(4)} cm 1 1 1 rg ${x.toFixed(3)} ${y.toFixed(3)} ${width.toFixed(3)} ${height.toFixed(3)} re f 0 0 0 rg BT /${fontName} ${m.size.toFixed(3)} Tf ${(m.scaleX * 100).toFixed(3)} Tz 1 0 0 -1 ${raw[0].toFixed(3)} ${baseline.toFixed(3)} Tm (`;
  return concat(ascii(prefix), pdfEscapeBytes(replacement), ascii(') Tj ET Q'));
}
function applyOverlay(doc, pageNo, raw, replacement) {
  const page = doc.loadPage(pageNo - 1);
  const m = metrics(raw, replacement);
  const fontName = chooseFontResource(doc, page);
  appendContent(doc, page, makeOverlayContent(page, raw, replacement, m, fontName));
  try { page.update?.(); } catch (_) {}
  return m;
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
  } catch (_) { return []; }
}
function area(b) { return Math.max(0, b[2] - b[0]) * Math.max(0, b[3] - b[1]); }
function overlapRatio(a, b) {
  const x = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]));
  const y = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  return x * y / Math.max(1, area(a));
}
function pdfTextUnder(page, raw) {
  return structuredLines(page).filter(line => overlapRatio(raw, line.bbox) >= 0.18);
}
function renderPage(doc, pageNo) {
  const page = doc.loadPage(pageNo - 1);
  const pix = page.toPixmap(mupdf.Matrix.scale(RENDER_SCALE, RENDER_SCALE), mupdf.ColorSpace.DeviceRGB, false, false);
  try {
    return {
      pixels: new Uint8Array(pix.getPixels()),
      width: pix.getWidth(), height: pix.getHeight(), components: pix.getNumberOfComponents(), stride: pix.getStride(),
      x: pix.getX(), y: pix.getY(),
    };
  } finally { try { pix.destroy?.(); } catch (_) {} }
}
function diffCheck(before, after, allowedPageBox) {
  if (!before || !after || before.width !== after.width || before.height !== after.height || before.components !== after.components || before.stride !== after.stride) {
    return { safe: false, reason: 'render incompatible' };
  }
  const [ax0, ay0, ax1, ay1] = allowedPageBox;
  const px0 = ax0 * RENDER_SCALE - before.x;
  const py0 = ay0 * RENDER_SCALE - before.y;
  const px1 = ax1 * RENDER_SCALE - before.x;
  const py1 = ay1 * RENDER_SCALE - before.y;
  let changed = 0;
  let outside = 0;
  for (let y = 0; y < before.height; y++) {
    const row = y * before.stride;
    for (let x = 0; x < before.width; x++) {
      const offset = row + x * before.components;
      let delta = 0;
      for (let component = 0; component < Math.min(3, before.components); component++) {
        delta = Math.max(delta, Math.abs(before.pixels[offset + component] - after.pixels[offset + component]));
      }
      if (delta <= 10) continue;
      changed++;
      if (x < px0 || x > px1 || y < py0 || y > py1) outside++;
    }
  }
  if (changed < 8) return { safe: false, reason: 'el overlay no produjo un cambio visual verificable', changed, outside };
  const outsideLimit = Math.max(16, Math.ceil(changed * 0.0025));
  if (outside > outsideLimit) return { safe: false, reason: `cambios fuera de la zona autorizada (${outside}/${changed} píxeles)`, changed, outside };
  return { safe: true, changed, outside };
}
function preflightOverlay(doc, pageNo, raw, replacement) {
  let baselineDoc = null;
  let trialDoc = null;
  let renderedDoc = null;
  try {
    const baselineBytes = saveBytes(doc);
    baselineDoc = mupdf.PDFDocument.openDocument(new Uint8Array(baselineBytes), 'application/pdf');
    const before = renderPage(baselineDoc, pageNo);
    trialDoc = mupdf.PDFDocument.openDocument(new Uint8Array(baselineBytes), 'application/pdf');
    const m = applyOverlay(trialDoc, pageNo, raw, replacement);
    const trialBytes = saveBytes(trialDoc);
    renderedDoc = mupdf.PDFDocument.openDocument(new Uint8Array(trialBytes), 'application/pdf');
    const after = renderPage(renderedDoc, pageNo);
    const margin = 4.0;
    const allowed = [raw[0] - margin, raw[1] - margin, Math.max(raw[2], raw[0] + m.replacementWidth) + margin, raw[3] + margin];
    return { ...diffCheck(before, after, allowed), metrics: m, allowed };
  } finally {
    try { baselineDoc?.destroy(); } catch (_) {}
    try { trialDoc?.destroy(); } catch (_) {}
    try { renderedDoc?.destroy(); } catch (_) {}
  }
}

export function applySafeTitleblockCodes(doc, analysis) {
  let count = 0;
  const replacements = [];
  const skipped = [];
  for (const rule of analysis?.counts || []) {
    if (!isShortStructuredCode(rule?.find)) continue;
    const replacement = String(rule?.replace ?? '');
    if (!replacement.trim()) continue;
    const matches = (rule?.ocrMatches || []).filter(match => match?.safeTitleblockCode === true && match?.bbox);
    for (const hit of matches) {
      const pageNo = Math.max(1, Number(hit.page || 1));
      const raw = hit.bbox.map(Number);
      const ocrToken = String(hit.matchedText || hit.ocrText || '');
      if (normalizedCode(ocrToken) !== normalizedCode(rule.find)) {
        diag('titleblock.code.exact.reject', { target: rule.find, ocrText: `${ocrToken} | apply-double-check`, page: pageNo, reason: 'apply-double-check' });
        skipped.push(`${rule.find}: coincidencia OCR rechazada en la segunda comprobación exacta`);
        continue;
      }
      if (raw.length !== 4 || !raw.every(Number.isFinite) || raw[2] <= raw[0] || raw[3] <= raw[1]) {
        skipped.push(`${rule.find}: bbox seguro inválido`);
        continue;
      }
      const page = doc.loadPage(pageNo - 1);
      const realText = pdfTextUnder(page, raw);
      if (realText.length) {
        diag('titleblock.code.pdftext.reject', { target: rule.find, ocr: ocrToken, page: pageNo, bbox: raw, pdfText: realText.map(line => line.text).join(' | ').slice(0, 500), phase: 'apply' });
        skipped.push(`${rule.find}: OCR no aplicado porque existe texto PDF real bajo el bbox`);
        continue;
      }
      try {
        diag('titleblock.code.overlay.start', { target: rule.find, replacement, page: pageNo, bbox: raw, ocrText: `bbox=${raw.map(v => Number(v).toFixed(2)).join(',')}` });
        const check = preflightOverlay(doc, pageNo, raw, replacement);
        const visualMeta = `bbox=${raw.map(v => Number(v).toFixed(2)).join(',')} | allowed=${(check.allowed || []).map(v => Number(v).toFixed(2)).join(',')} | changed=${Number(check.changed || 0)} | outside=${Number(check.outside || 0)}`;
        diag('titleblock.code.visual.validate', { target: rule.find, page: pageNo, bbox: raw, changed: check.changed, outside: check.outside, allowed: check.allowed, ocrText: visualMeta });
        if (!check.safe) {
          diag('titleblock.code.visual.reject', { target: rule.find, page: pageNo, bbox: raw, reason: check.reason, changed: check.changed, outside: check.outside, allowed: check.allowed, ocrText: `${check.reason} | ${visualMeta}` });
          skipped.push(`${rule.find}: overlay rechazado por verificación visual (${check.reason})`);
          continue;
        }
        const m = applyOverlay(doc, pageNo, raw, replacement);
        diag('titleblock.code.visual.accept', { target: rule.find, page: pageNo, bbox: raw, changed: check.changed, outside: check.outside, ocrText: visualMeta });
        count++;
        replacements.push({ page: pageNo, bbox: raw, find: String(rule.find), text: replacement, mode: 'titleblock-code-overlay-verified', size: m.size, scaleX: m.scaleX, visualCheck: { changed: check.changed, outside: check.outside, allowed: check.allowed } });
      } catch (error) {
        diag('titleblock.code.visual.reject', { target: rule.find, page: pageNo, bbox: raw, reason: error?.message || String(error), ocrText: `${error?.message || String(error)} | bbox=${raw.map(v => Number(v).toFixed(2)).join(',')}` });
        skipped.push(`${rule.find}: overlay seguro no aplicado (${error?.message || error})`);
      }
    }
  }
  return { count, replacements, skipped };
}
