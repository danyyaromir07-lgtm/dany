// Additive heavy-text dispatcher v6.
// v5 remains unchanged. This wrapper only broadens the set of safe zero-change declines
// allowed to reach the already-validated decoded large-stream fallback.
import * as mupdf from 'https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js';
import { editHeavyTextFlate as editV5 } from './text-editor-heavy-flate-v5-decoded-fallback.js?v=20260826-decodedfallback1';
import { editDoc as editDecodedLarge } from './text-editor-v65-safe-delimiters-v2-large-stream.js?v=20260826-largestream1';

const SAFE_DECLINES = new Set([
  'sin stream Type0/Identity-H Flate pesado compatible',
  'sin stream Type0/Identity-H Flate pesado compatible para subcadena'
]);

function canUseDecodedFallback(result) {
  return result?.verified !== true &&
    Number(result?.count || 0) === 0 &&
    Number(result?.found || 0) === 0 &&
    SAFE_DECLINES.has(String(result?.reason || ''));
}
function bytesOf(buf) {
  const b = buf?.asUint8Array ? buf.asUint8Array() : buf;
  return b instanceof Uint8Array ? new Uint8Array(b) : new Uint8Array(b || 0);
}
async function preflightExact(doc, needle, replacement) {
  let clone = null;
  try {
    const snapshot = bytesOf(doc.saveToBuffer('garbage=0,compress=yes'));
    clone = mupdf.PDFDocument.openDocument(snapshot, 'application/pdf');
    return Number(editDecodedLarge(clone, needle, replacement) || 0);
  } finally {
    try { clone?.destroy(); } catch (_) {}
  }
}

export async function editHeavyTextFlate(doc, needle, replacement, expected = 0, fileName = '') {
  const stable = await editV5(doc, needle, replacement, expected, fileName);
  if (!canUseDecodedFallback(stable)) return stable;
  const want = Math.max(0, Number(expected || 0));
  try {
    const trial = await preflightExact(doc, needle, replacement);
    if (trial !== want) return { count: 0, found: trial, verified: false, reason: `fallback decoded v6 probado=${trial}, esperado=${want}; no se modifica el PDF` };
    const applied = Number(editDecodedLarge(doc, needle, replacement) || 0);
    if (applied !== want) return { count: applied, found: applied, verified: false, reason: `fallback decoded v6 aplicado=${applied}, esperado=${want}` };
    return { count: applied, found: applied, verified: true, source: 'decoded-large-stream-safe-v2' };
  } catch (error) {
    return { count: 0, verified: false, reason: `fallback decoded v6 no aplicado: ${error?.message || String(error)}` };
  }
}
