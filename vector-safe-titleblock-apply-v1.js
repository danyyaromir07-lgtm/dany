import * as mupdf from 'https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js';
import { editDoc } from './text-editor-v65.js?v=20260817-safecode1';

const FONT_NAME = 'FSafeCode1';
const RENDER_SCALE = .85;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function asBytes(buffer) { return buffer?.asUint8Array ? new Uint8Array(buffer.asUint8Array()) : new Uint8Array(buffer); }
function saveBytes(doc) { return asBytes(doc.saveToBuffer('garbage=0,compress=no,appearance=yes')); }
function fontAdvance(font, text) { let n = 0; for (const ch of String(text || '')) n += font.advanceGlyph(font.encodeCharacter(ch), 0); return n; }
function pdfEscapeBytes(text) {
  const out = [];
  for (const ch of String(text || '')) {
    const c = ch.codePointAt(0); let b = c >= 0 && c <= 127 ? c : c >= 0xA0 && c <= 0xFF ? c : 63;
    if (c === 0x20AC) b = 0x80;
    if (b === 40 || b === 41 || b === 92) out.push(92);
    out.push(b);
  }
  return new Uint8Array(out);
}
function ascii(s) { return new TextEncoder().encode(s); }
function concat(...parts) {
  const size = parts.reduce((n, p) => n + p.length, 0), out = new Uint8Array(size); let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}
function addFontResource(doc, page) {
  const obj = page.getObject();
  let res = obj.get('Resources');
  if (!res || !res.isDictionary?.()) { res = doc.newDictionary(); obj.put('Resources', res); }
  let fonts = res.get('Font');
  if (!fonts || !fonts.isDictionary?.()) { fonts = doc.newDictionary(); res.put('Font', fonts); }
  const current = fonts.get(FONT_NAME);
  if (!current || current.isNull?.()) fonts.put(FONT_NAME, doc.addSimpleFont(new mupdf.Font('Helvetica'), 'Latin'));
}
function appendContent(doc, page, content) {
  const obj = page.getObject(), stream = doc.addStream(content, {}), contents = obj.get('Contents');
  if (!contents || contents.isNull?.()) { obj.put('Contents', stream); return; }
  if (contents.isArray?.()) { contents.push(stream); return; }
  const arr = doc.newArray(); arr.push(contents); arr.push(stream); obj.put('Contents', arr);
}
function metrics(raw, text) {
  const w = Math.max(1, raw[2] - raw[0]), h = Math.max(1, raw[3] - raw[1]);
  const font = new mupdf.Font('Helvetica');
  const size = clamp(h * .84, 3.2, 72);
  const advance = Math.max(.01, fontAdvance(font, text) * size);
  const scaleX = clamp((w * .98) / advance, .48, 1.18);
  const replacementWidth = fontAdvance(font, text) * size * scaleX;
  return { size, scaleX, replacementWidth, w, h };
}
function pageTransform(page) {
  const m = Array.from(page.getTransform?.() || [], Number);
  if (m.length !== 6 || !m.every(Number.isFinite)) throw new Error('No se pudo obtener la transformación real de la página.');
  return m;
}
function makeOverlayContent(page, raw, text, m) {
  const [a, b, c, d, e, f] = pageTransform(page);
  const padX = Math.min(.25, Math.max(.06, m.h * .015));
  const padY = Math.min(.65, Math.max(.22, m.h * .055));
  const x = raw[0] - padX, y = raw[1] - padY, w = (raw[2] - raw[0]) + padX * 2, h = (raw[3] - raw[1]) + padY * 2;
  const baseline = raw[3] - Math.max(.15, m.h * .12);
  const prefix = `q ${a.toFixed(8)} ${b.toFixed(8)} ${c.toFixed(8)} ${d.toFixed(8)} ${e.toFixed(4)} ${f.toFixed(4)} cm 1 1 1 rg ${x.toFixed(3)} ${y.toFixed(3)} ${w.toFixed(3)} ${h.toFixed(3)} re f 0 0 0 rg BT /${FONT_NAME} ${m.size.toFixed(3)} Tf ${(m.scaleX * 100).toFixed(3)} Tz 1 0 0 -1 ${raw[0].toFixed(3)} ${baseline.toFixed(3)} Tm (`;
  return concat(ascii(prefix), pdfEscapeBytes(text), ascii(') Tj ET Q'));
}
function applyOverlay(doc, pageNo, raw, text) {
  const page = doc.loadPage(pageNo - 1), m = metrics(raw, text);
  addFontResource(doc, page);
  appendContent(doc, page, makeOverlayContent(page, raw, text, m));
  try { page.update?.(); } catch (_) {}
  return m;
}
function renderPage(doc, pageNo) {
  const page = doc.loadPage(pageNo - 1);
  const pix = page.toPixmap(mupdf.Matrix.scale(RENDER_SCALE, RENDER_SCALE), mupdf.ColorSpace.DeviceRGB, false, false);
  try {
    return {
      pixels: new Uint8Array(pix.getPixels()), width: pix.getWidth(), height: pix.getHeight(),
      components: pix.getNumberOfComponents(), stride: pix.getStride(), x: pix.getX(), y: pix.getY(),
    };
  } finally { try { pix.destroy?.(); } catch (_) {} }
}
function diffCheck(before, after, allowedPageBox) {
  if (!before || !after || before.width !== after.width || before.height !== after.height || before.components !== after.components || before.stride !== after.stride) return { safe: false, reason: 'render incompatible' };
  const [ax0, ay0, ax1, ay1] = allowedPageBox;
  const px0 = ax0 * RENDER_SCALE - before.x, py0 = ay0 * RENDER_SCALE - before.y;
  const px1 = ax1 * RENDER_SCALE - before.x, py1 = ay1 * RENDER_SCALE - before.y;
  let changed = 0, outside = 0, minX = Infinity, minY = Infinity, maxX = -1, maxY = -1;
  for (let y = 0; y < before.height; y++) {
    const row = y * before.stride;
    for (let x = 0; x < before.width; x++) {
      const at = row + x * before.components; let delta = 0;
      for (let k = 0; k < Math.min(3, before.components); k++) delta = Math.max(delta, Math.abs(before.pixels[at + k] - after.pixels[at + k]));
      if (delta <= 10) continue;
      changed++; minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      if (x < px0 || x > px1 || y < py0 || y > py1) outside++;
    }
  }
  if (changed < 8) return { safe: false, reason: 'el overlay no produjo un cambio visual verificable', changed, outside };
  const outsideLimit = Math.max(24, Math.ceil(changed * .005));
  if (outside > outsideLimit) return { safe: false, reason: `cambios fuera de la zona autorizada (${outside}/${changed} píxeles)`, changed, outside, diffBox: [minX, minY, maxX, maxY] };
  return { safe: true, changed, outside, diffBox: [minX, minY, maxX, maxY] };
}
function preflightOverlay(doc, pageNo, raw, text) {
  let baselineDoc = null, trialDoc = null, renderedDoc = null;
  try {
    const baselineBytes = saveBytes(doc);
    baselineDoc = mupdf.PDFDocument.openDocument(new Uint8Array(baselineBytes), 'application/pdf');
    const before = renderPage(baselineDoc, pageNo);
    trialDoc = mupdf.PDFDocument.openDocument(new Uint8Array(baselineBytes), 'application/pdf');
    const m = applyOverlay(trialDoc, pageNo, raw, text);
    const trialBytes = saveBytes(trialDoc);
    renderedDoc = mupdf.PDFDocument.openDocument(new Uint8Array(trialBytes), 'application/pdf');
    const after = renderPage(renderedDoc, pageNo);
    const margin = 3.5;
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
  const skipped = [], replacements = [];
  for (const rule of analysis?.counts || []) {
    const matches = (rule?.ocrMatches || []).filter(m => m?.safeTitleblockCode === true && m?.bbox && String(rule.replace ?? '').trim());
    if (!matches.length) continue;
    const pdfSources = [...new Set(matches.filter(m => m.pdfTextExact === true && String(m.pdfTextSource || '').trim()).map(m => String(m.pdfTextSource)))];
    for (const source of pdfSources) {
      try {
        const n = Number(editDoc(doc, source, String(rule.replace)) || 0);
        if (n > 0) { count += n; replacements.push({ find: rule.find, source, text: String(rule.replace), mode: 'pdf-text-exact', count: n }); }
        else skipped.push(`${rule.find}: texto PDF exacto localizado en cartela, pero el editor de streams no pudo modificarlo; se conservó intacto`);
      } catch (e) { skipped.push(`${rule.find}: edición segura de texto PDF falló (${e?.message || e}); se conservó intacto`); }
    }
    for (const hit of matches.filter(m => m.pdfTextExact !== true)) {
      const pageNo = Math.max(1, Number(hit.page || 1));
      const raw = hit.bbox.map(Number);
      if (raw.length !== 4 || !raw.every(Number.isFinite) || raw[2] <= raw[0] || raw[3] <= raw[1]) { skipped.push(`${rule.find}: bbox seguro inválido`); continue; }
      try {
        const check = preflightOverlay(doc, pageNo, raw, String(rule.replace));
        if (!check.safe) { skipped.push(`${rule.find}: overlay rechazado por verificación visual (${check.reason})`); continue; }
        const m = applyOverlay(doc, pageNo, raw, String(rule.replace));
        count++;
        replacements.push({ page: pageNo, bbox: raw, find: rule.find, text: String(rule.replace), mode: 'vector-overlay-verified', size: m.size, scaleX: m.scaleX, visualCheck: { changed: check.changed, outside: check.outside, allowed: check.allowed } });
      } catch (e) { skipped.push(`${rule.find}: overlay seguro no aplicado (${e?.message || e})`); }
    }
  }
  return { count, replacements, skipped };
}
