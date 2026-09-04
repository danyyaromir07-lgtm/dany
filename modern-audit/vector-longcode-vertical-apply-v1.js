import * as mupdf from 'https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js';

const FONT_BASE = 'FLongVert';
const RENDER_SCALE = 1.0;

const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[‐‑‒–—−]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase();
const canonical = s => norm(s).replace(/\s*[-]\s*/g, '-').replace(/\s*([:/_.])\s*/g, '$1');
const codeKey = s => canonical(s).replace(/[^a-z0-9]/g, '').replace(/o/g, '0').replace(/i/g, '1');
function isLongDrawingCode(v) { const raw = String(v || '').trim(), k = codeKey(raw), parts = raw.split('_').filter(Boolean); return raw.includes('_') && k.length >= 20 && k.length <= 90 && parts.length >= 5 && parts.every(p => /^[A-Za-z0-9.-]+$/.test(p)); }
function orientationOf(hit) { const n = ((Number(hit?.localOrientation || 0) % 360) + 360) % 360; return n === 90 || n === 270 ? n : 0; }
function diag(stage, extra = {}) { try { window.__ocrDiagnostic?.({ time: new Date().toISOString(), stage, detail: 'long-code-vertical-apply-v1', ...extra }); } catch (_) {} }
function asBytes(buffer) { return buffer?.asUint8Array ? new Uint8Array(buffer.asUint8Array()) : new Uint8Array(buffer); }
function saveBytes(doc) { return asBytes(doc.saveToBuffer('garbage=0,compress=no,appearance=yes')); }
function ascii(s) { return new TextEncoder().encode(s); }
function concat(...parts) { const size = parts.reduce((n, p) => n + p.length, 0), out = new Uint8Array(size); let offset = 0; for (const part of parts) { out.set(part, offset); offset += part.length; } return out; }
function pdfEscapeBytes(text) { const out = []; for (const ch of String(text || '')) { const code = ch.codePointAt(0); let byte = code >= 0 && code <= 127 ? code : code >= 0xA0 && code <= 0xFF ? code : 63; if (code === 0x20AC) byte = 0x80; if (byte === 40 || byte === 41 || byte === 92) out.push(92); out.push(byte); } return new Uint8Array(out); }
function fontAdvance(font, text) { let total = 0; for (const ch of String(text || '')) total += font.advanceGlyph(font.encodeCharacter(ch), 0); return total; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function metrics(raw, replacement, orientation) { const width = Math.max(1, raw[2] - raw[0]), height = Math.max(1, raw[3] - raw[1]), font = new mupdf.Font('Helvetica'), size = clamp(width * 0.82, 3.0, 72), advance = Math.max(0.01, fontAdvance(font, replacement) * size), scaleX = clamp((height * 0.98) / advance, 0.42, 1.60); return { width, height, size, scaleX, orientation, replacementRun: fontAdvance(font, replacement) * size * scaleX }; }
function resolved(obj) { try { return obj?.resolve?.() || obj; } catch (_) { return obj; } }
function pageHandle(page) { const ref = page.getObject(), dict = resolved(ref); if (!dict?.isDictionary?.()) throw new Error('No se pudo resolver el diccionario de página.'); return { ref, dict, indirect: !ref?.isDictionary?.() }; }
function commitIndirect(ref, obj, indirect) { if (indirect && typeof ref?.writeObject === 'function') ref.writeObject(obj); }
function pageTransform(page) {
  const base = Array.from(page.getTransform?.() || [], Number); if (base.length !== 6 || !base.every(Number.isFinite)) throw new Error('No se pudo obtener page.getTransform().');
  let rotation = 0; try { const dict = resolved(page.getObject()), rotateObject = dict?.getInheritable?.('Rotate') || dict?.get?.('Rotate'), rotateValue = resolved(rotateObject); rotation = Number(rotateValue?.asNumber?.() ?? rotateValue?.valueOf?.() ?? 0); } catch (_) {}
  rotation = ((rotation % 360) + 360) % 360; if (![90, 180, 270].includes(rotation)) return base;
  const bounds = Array.from(page.getBounds?.() || [], Number); if (bounds.length !== 4 || !bounds.every(Number.isFinite)) return base;
  const [x0, y0, x1, y1] = bounds, width = Math.abs(x1 - x0), height = Math.abs(y1 - y0); let derotate;
  if (rotation === 90) derotate = [0, -1, 1, 0, -y0, width + x0]; else if (rotation === 180) derotate = [-1, 0, 0, -1, width + x0, height + y0]; else derotate = [0, 1, -1, 0, height + y0, -x0];
  const [a1, b1, c1, d1, e1, f1] = derotate, [a2, b2, c2, d2, e2, f2] = base;
  return [a2 * a1 + c2 * b1, b2 * a1 + d2 * b1, a2 * c1 + c2 * d1, b2 * c1 + d2 * d1, a2 * e1 + c2 * f1 + e2, b2 * e1 + d2 * f1 + f2];
}
function chooseFontResource(doc, page) {
  const pageObj = pageHandle(page), resourceRef = pageObj.dict.get('Resources'); let resources = resolved(resourceRef); const resourceIndirect = !!resourceRef && !resourceRef?.isDictionary?.();
  if (!resources || !resources.isDictionary?.()) { resources = doc.newDictionary(); pageObj.dict.put('Resources', resources); }
  let fontRef = resources.get('Font'), fonts = resolved(fontRef); const fontIndirect = !!fontRef && !fontRef?.isDictionary?.();
  if (!fonts || !fonts.isDictionary?.()) { fonts = doc.newDictionary(); resources.put('Font', fonts); fontRef = null; }
  let suffix = 1, name = `${FONT_BASE}${suffix}`; while (fonts.get(name) && !fonts.get(name).isNull?.()) { suffix++; name = `${FONT_BASE}${suffix}`; }
  fonts.put(name, doc.addSimpleFont(new mupdf.Font('Helvetica'), 'Latin')); if (fontIndirect && fontRef?.writeObject) fontRef.writeObject(fonts); if (resourceIndirect && resourceRef?.writeObject) resourceRef.writeObject(resources); commitIndirect(pageObj.ref, pageObj.dict, pageObj.indirect); return name;
}
function appendContent(doc, page, content) {
  const pageObj = pageHandle(page), stream = doc.addStream(content), contentsRef = pageObj.dict.get('Contents');
  if (!contentsRef || contentsRef.isNull?.()) { pageObj.dict.put('Contents', stream); commitIndirect(pageObj.ref, pageObj.dict, pageObj.indirect); return; }
  const contents = resolved(contentsRef), array = doc.newArray(); if (contents?.isArray?.()) { for (let i = 0; i < contents.length; i++) array.push(contents.get(i)); } else array.push(contentsRef); array.push(stream); pageObj.dict.put('Contents', array); commitIndirect(pageObj.ref, pageObj.dict, pageObj.indirect);
}
function textMatrix(raw, orientation) { if (orientation === 90) return `0 1 1 0 ${raw[0].toFixed(3)} ${raw[1].toFixed(3)}`; return `0 -1 -1 0 ${raw[2].toFixed(3)} ${raw[3].toFixed(3)}`; }
function makeOverlayContent(page, raw, replacement, m, fontName) {
  const [a, b, c, d, e, f] = pageTransform(page), padX = Math.min(0.8, Math.max(0.25, m.width * 0.06)), padY = Math.min(0.8, Math.max(0.20, m.width * 0.05));
  const x = raw[0] - padX, y = raw[1] - padY, width = (raw[2] - raw[0]) + padX * 2, height = (raw[3] - raw[1]) + padY * 2, tm = textMatrix(raw, m.orientation);
  const prefix = `q ${a.toFixed(8)} ${b.toFixed(8)} ${c.toFixed(8)} ${d.toFixed(8)} ${e.toFixed(4)} ${f.toFixed(4)} cm 1 1 1 rg ${x.toFixed(3)} ${y.toFixed(3)} ${width.toFixed(3)} ${height.toFixed(3)} re f 0 0 0 rg BT /${fontName} ${m.size.toFixed(3)} Tf ${(m.scaleX * 100).toFixed(3)} Tz ${tm} Tm (`;
  return concat(ascii(prefix), pdfEscapeBytes(replacement), ascii(') Tj ET Q'));
}
function applyOverlay(doc, pageNo, raw, replacement, orientation) { const page = doc.loadPage(pageNo - 1), m = metrics(raw, replacement, orientation), fontName = chooseFontResource(doc, page); appendContent(doc, page, makeOverlayContent(page, raw, replacement, m, fontName)); try { page.update?.(); } catch (_) {} return m; }
function structuredLines(page) { try { const data = JSON.parse(page.toStructuredText('preserve-spans').asJSON()), lines = []; for (const block of data?.blocks || []) { if (block?.type !== 'text') continue; for (const line of block?.lines || []) { const b = line?.bbox; if (Number(line?.wmode || 0) !== 0 || !String(line?.text || '').trim() || !b || ![b.x, b.y, b.w, b.h].every(Number.isFinite)) continue; lines.push({ text: String(line.text), bbox: [b.x, b.y, b.x + b.w, b.y + b.h] }); } } return lines; } catch (_) { return []; } }
function area(b) { return Math.max(0, b[2] - b[0]) * Math.max(0, b[3] - b[1]); }
function overlapRatio(a, b) { const x = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])), y = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1])); return x * y / Math.max(1, area(a)); }
function pdfTextUnder(page, raw) { return structuredLines(page).filter(line => overlapRatio(raw, line.bbox) >= 0.18); }
function renderPage(doc, pageNo) { const page = doc.loadPage(pageNo - 1), pix = page.toPixmap(mupdf.Matrix.scale(RENDER_SCALE, RENDER_SCALE), mupdf.ColorSpace.DeviceRGB, false, false); try { return { pixels: new Uint8Array(pix.getPixels()), width: pix.getWidth(), height: pix.getHeight(), components: pix.getNumberOfComponents(), stride: pix.getStride() }; } finally { try { pix.destroy?.(); } catch (_) {} } }
function changedPixels(before, after) { if (!before || !after || before.width !== after.width || before.height !== after.height || before.components !== after.components || before.stride !== after.stride) return -1; let changed = 0; for (let y = 0; y < before.height; y++) { const row = y * before.stride; for (let x = 0; x < before.width; x++) { const off = row + x * before.components; let delta = 0; for (let c = 0; c < Math.min(3, before.components); c++) delta = Math.max(delta, Math.abs(before.pixels[off + c] - after.pixels[off + c])); if (delta > 10) changed++; } } return changed; }
function preflight(doc, pageNo, raw, replacement, orientation) {
  let baseline = null, trial = null, rendered = null;
  try { const bytes = saveBytes(doc); baseline = mupdf.PDFDocument.openDocument(new Uint8Array(bytes), 'application/pdf'); const before = renderPage(baseline, pageNo); trial = mupdf.PDFDocument.openDocument(new Uint8Array(bytes), 'application/pdf'); const m = applyOverlay(trial, pageNo, raw, replacement, orientation); const trialBytes = saveBytes(trial); rendered = mupdf.PDFDocument.openDocument(new Uint8Array(trialBytes), 'application/pdf'); const after = renderPage(rendered, pageNo); return { changed: changedPixels(before, after), metrics: m }; }
  finally { try { baseline?.destroy(); } catch (_) {} try { trial?.destroy(); } catch (_) {} try { rendered?.destroy(); } catch (_) {} }
}

export function applyVerticalLongDrawingCodes(doc, analysis) {
  let count = 0; const replacements = [], skipped = [];
  for (const rule of analysis?.counts || []) {
    if (!isLongDrawingCode(rule?.find)) continue;
    const replacement = String(rule?.replace ?? ''); if (!replacement.trim()) continue;
    const matches = (rule?.ocrMatches || []).filter(hit => hit?.verticalLongDrawingCode === true && hit?.bbox && orientationOf(hit));
    for (const hit of matches) {
      const pageNo = Math.max(1, Number(hit.page || 1)), orientation = orientationOf(hit), raw = hit.bbox.map(Number), confidence = Number(hit.confidence || 0), similarity = Number(hit.similarity || 0);
      if (raw.length !== 4 || !raw.every(Number.isFinite) || raw[2] <= raw[0] || raw[3] <= raw[1] || raw[3] - raw[1] <= (raw[2] - raw[0]) * 1.6) { skipped.push(`${rule.find}: bbox vertical de código completo inválido`); continue; }
      if (confidence < 8 || (similarity > 0 && similarity < 0.86)) { skipped.push(`${rule.find}: OCR vertical de código completo descartado por confianza/similitud`); continue; }
      const ocrText = String(hit.ocrText || hit.matchedText || ''); if (codeKey(ocrText).length < codeKey(rule.find).length - 8) { skipped.push(`${rule.find}: OCR vertical incompleto`); continue; }
      const page = doc.loadPage(pageNo - 1), realText = pdfTextUnder(page, raw); if (realText.length) { diag('ocr.longcode.vertical.pdftext.reject', { target: rule.find, page: pageNo, orientation, bbox: raw, pdfText: realText.map(x => x.text).join(' | ').slice(0, 500) }); skipped.push(`${rule.find}: vertical OCR no aplicado porque existe texto PDF real bajo el bbox`); continue; }
      try {
        diag('ocr.longcode.vertical.overlay.start', { target: rule.find, page: pageNo, orientation, bbox: raw, replacement });
        const check = preflight(doc, pageNo, raw, replacement, orientation); diag('ocr.longcode.vertical.visual.validate', { target: rule.find, page: pageNo, orientation, bbox: raw, changed: check.changed });
        if (check.changed < 8) { diag('ocr.longcode.vertical.visual.reject', { target: rule.find, page: pageNo, orientation, bbox: raw, changed: check.changed, reason: 'sin cambio visual verificable' }); skipped.push(`${rule.find}: overlay vertical de código completo sin cambio visual verificable`); continue; }
        const m = applyOverlay(doc, pageNo, raw, replacement, orientation); diag('ocr.longcode.vertical.visual.accept', { target: rule.find, page: pageNo, orientation, bbox: raw, changed: check.changed });
        count++; replacements.push({ page: pageNo, bbox: raw, find: String(rule.find), text: replacement, mode: 'long-code-vertical-overlay', orientation, size: m.size, scaleX: m.scaleX, visualChanged: check.changed });
      } catch (error) { diag('ocr.longcode.vertical.visual.reject', { target: rule.find, page: pageNo, orientation, bbox: raw, reason: error?.message || String(error) }); skipped.push(`${rule.find}: overlay vertical de código completo no aplicado (${error?.message || error})`); }
    }
  }
  return { count, replacements, skipped };
}
