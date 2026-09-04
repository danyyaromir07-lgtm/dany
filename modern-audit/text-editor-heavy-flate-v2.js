// Memory-bounded editor for exceptionally large Flate-compressed PDF page content streams.
// It never materializes the decoded page stream in JavaScript and never applies page redactions.
// Normal PDFs continue using text-editor-v65.js in the batch runner.

const RAW_STREAM_MIN_BYTES = 8 * 1024 * 1024;
const MAX_RAW_OUTPUT_BYTES = 96 * 1024 * 1024;
const enc = new TextEncoder();

const U = (b) => b?.asUint8Array?.() || b;
const resolve = (o) => { try { return o?.resolve?.() || o; } catch (_) { return o; } };
const streamRef = (o) => { try { if (o?.isStream?.()) return o; const r = resolve(o); return r?.isStream?.() ? r : null; } catch (_) { return null; } };

function asText(bytes) {
  const u = U(bytes); let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, Math.min(u.length, i + 0x8000)));
  return s;
}
function primitive(o) { try { return o?.valueOf?.() ?? o; } catch (_) { return o; } }
function nameOf(o) {
  const r = resolve(o);
  try { if (r?.isName?.()) return String(r.asName?.() || r.valueOf?.() || '').replace(/^\//, ''); } catch (_) {}
  return String(primitive(r) || '').replace(/^\//, '');
}
function numberOf(o) {
  try { if (o?.asNumber) return Number(o.asNumber()); const n = Number(primitive(o)); return Number.isFinite(n) ? n : 0; } catch (_) { return 0; }
}
function contentRefs(page) {
  try {
    const co = page.getObject()?.get?.('Contents'); if (!co) return [];
    const r = resolve(co);
    if (r?.isArray?.()) return Array.from({ length: Number(r.length || 0) }, (_, i) => r.get(i));
    return [co];
  } catch (_) { return []; }
}
function isPlainFlate(st) {
  try {
    const f = resolve(st.get?.('Filter'));
    const dp = resolve(st.get?.('DecodeParms'));
    if (dp && !dp.isNull?.()) return false;
    if (f?.isArray?.()) return Number(f.length || 0) === 1 && nameOf(f.get(0)) === 'FlateDecode';
    return nameOf(f) === 'FlateDecode';
  } catch (_) { return false; }
}
function rawLength(st) {
  try { const n = numberOf(st.get?.('Length')); if (n > 0) return n; } catch (_) {}
  try { const b = U(st.readRawStream?.()); return Number(b?.byteLength || b?.length || 0); } catch (_) { return 0; }
}

function hexBytes(x) {
  const s = String(x || '').replace(/\s+/g, ''), h = s.length % 2 ? s + '0' : s, out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}
function unicodeFromHex(x) {
  const b = hexBytes(x); let s = '';
  for (let i = 0; i + 1 < b.length; i += 2) s += String.fromCharCode((b[i] << 8) | b[i + 1]);
  return s;
}
function parseCMap(ref) {
  const o = streamRef(ref); if (!o) return null;
  let t = '';
  try { t = asText(o.readStream()); } catch (_) { return null; }
  const map = new Map(), rev = new Map(); let bytes = 0;
  for (const z of t.matchAll(/(?:\d+\s+)?begincodespacerange([\s\S]*?)endcodespacerange/g)) {
    for (const x of z[1].matchAll(/<([0-9a-f]+)>\s*<([0-9a-f]+)>/gi)) bytes = Math.max(bytes, x[1].length / 2);
  }
  for (const z of t.matchAll(/(?:\d+\s+)?beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const x of z[1].matchAll(/<([0-9a-f]+)>\s*<([0-9a-f]+)>/gi)) map.set(parseInt(x[1], 16), unicodeFromHex(x[2]));
  }
  for (const z of t.matchAll(/(?:\d+\s+)?beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const x of z[1].matchAll(/<([0-9a-f]+)>\s*<([0-9a-f]+)>\s*<([0-9a-f]+)>/gi)) {
      const a = parseInt(x[1], 16), b = parseInt(x[2], 16), u = parseInt(x[3], 16);
      for (let k = a; k <= b; k++) map.set(k, String.fromCodePoint(u + k - a));
    }
    for (const x of z[1].matchAll(/<([0-9a-f]+)>\s*<([0-9a-f]+)>\s*\[([\s\S]*?)\]/gi)) {
      const a = parseInt(x[1], 16), b = parseInt(x[2], 16), vals = [...x[3].matchAll(/<([0-9a-f]+)>/gi)];
      for (let k = a; k <= b && k - a < vals.length; k++) map.set(k, unicodeFromHex(vals[k - a][1]));
    }
  }
  if (!map.size) return null;
  if (!bytes) bytes = 2;
  for (const [code, text] of map) if (text.length === 1 && !rev.has(text)) rev.set(text, code);
  return { rev, bytes };
}
function fontCMap(fontRef) {
  try {
    const f = resolve(fontRef); let c = parseCMap(f?.get?.('ToUnicode'));
    if (c) return c;
    const ds = resolve(f?.get?.('DescendantFonts'));
    if (ds?.isArray?.() && ds.length) c = parseCMap(resolve(ds.get(0))?.get?.('ToUnicode'));
    return c;
  } catch (_) { return null; }
}
function encodeHexText(text, cmap) {
  let out = '';
  for (const ch of String(text || '')) {
    const code = cmap.rev.get(ch); if (code == null) return null;
    out += Number(code).toString(16).padStart(cmap.bytes * 2, '0').toUpperCase();
  }
  return out;
}
function encodedPairsForPage(page, needle, replacement) {
  const pairs = new Map(); let ambiguous = false;
  try {
    const po = page.getObject(), res = resolve(po.getInheritable?.('Resources') || po.get?.('Resources')), fonts = resolve(res?.get?.('Font'));
    if (!fonts?.isDictionary?.()) return { pairs: [], ambiguous: false };
    fonts.forEach((fontRef) => {
      const c = fontCMap(fontRef); if (!c) return;
      const a = encodeHexText(needle, c), b = encodeHexText(replacement, c); if (!a || !b) return;
      const key = a.toUpperCase(); const val = b.toUpperCase();
      if (pairs.has(key) && pairs.get(key) !== val) ambiguous = true; else pairs.set(key, val);
    });
  } catch (_) {}
  return { pairs: [...pairs.entries()].map(([a,b]) => ({ find: enc.encode(a), replace: enc.encode(b) })), ambiguous };
}

function upperAscii(b) { return b >= 97 && b <= 102 ? b - 32 : b; }
function matchAt(buf, pat, i) {
  if (i + pat.length > buf.length) return false;
  for (let j = 0; j < pat.length; j++) if (upperAscii(buf[i + j]) !== upperAscii(pat[j])) return false;
  return true;
}
function findFrom(buf, pat, from, maxStart) {
  const first = upperAscii(pat[0]); const end = Math.min(maxStart, buf.length - pat.length + 1);
  for (let i = from; i < end; i++) if (upperAscii(buf[i]) === first && matchAt(buf, pat, i)) return i;
  return -1;
}
function concat2(a, b) {
  if (!a.length) return b instanceof Uint8Array ? b : new Uint8Array(b);
  const bb = b instanceof Uint8Array ? b : new Uint8Array(b), out = new Uint8Array(a.length + bb.length); out.set(a); out.set(bb, a.length); return out;
}
function makeReplaceTransform(pairs) {
  const maxLen = Math.max(...pairs.map((p) => p.find.length)); const keep = Math.max(0, maxLen - 1); let carry = new Uint8Array(0), count = 0;
  function earliest(data, from, limit) {
    let best = null;
    for (const pair of pairs) {
      const at = findFrom(data, pair.find, from, limit); if (at < 0) continue;
      if (!best || at < best.at || (at === best.at && pair.find.length > best.pair.find.length)) best = { at, pair };
    }
    return best;
  }
  const stream = new TransformStream({
    transform(chunk, controller) {
      const data = concat2(carry, chunk), emitLimit = Math.max(0, data.length - keep); let pos = 0;
      while (pos < emitLimit) {
        const hit = earliest(data, pos, emitLimit); if (!hit) break;
        if (hit.at > pos) controller.enqueue(data.subarray(pos, hit.at));
        controller.enqueue(hit.pair.replace); count++; pos = hit.at + hit.pair.find.length;
      }
      if (pos < emitLimit) { controller.enqueue(data.subarray(pos, emitLimit)); pos = emitLimit; }
      carry = data.slice(pos);
    },
    flush(controller) {
      let pos = 0;
      while (pos < carry.length) {
        const hit = earliest(carry, pos, carry.length + 1); if (!hit) break;
        if (hit.at > pos) controller.enqueue(carry.subarray(pos, hit.at));
        controller.enqueue(hit.pair.replace); count++; pos = hit.at + hit.pair.find.length;
      }
      if (pos < carry.length) controller.enqueue(carry.subarray(pos)); carry = new Uint8Array(0);
    }
  });
  return { stream, count: () => count };
}
async function transformRawFlate(raw, pairs) {
  if (typeof DecompressionStream !== 'function' || typeof CompressionStream !== 'function' || typeof TransformStream !== 'function') throw new Error('El navegador no dispone de compresión por streaming.');
  const source = U(raw); if (!source?.length) return { bytes: null, count: 0 };
  const input = new ReadableStream({
    start(controller) { const step = 1024 * 1024; for (let i = 0; i < source.length; i += step) controller.enqueue(source.subarray(i, Math.min(source.length, i + step))); controller.close(); }
  });
  const repl = makeReplaceTransform(pairs);
  const compressed = input.pipeThrough(new DecompressionStream('deflate')).pipeThrough(repl.stream).pipeThrough(new CompressionStream('deflate'));
  const ab = await new Response(compressed).arrayBuffer();
  if (ab.byteLength > MAX_RAW_OUTPUT_BYTES) throw new Error(`Salida comprimida demasiado grande (${(ab.byteLength / 1048576).toFixed(1)} MB).`);
  return { bytes: new Uint8Array(ab), count: repl.count() };
}

function perf(action, stage, extra = {}) { try { window.__performanceDiagnostic?.({ scope: 'apply', action, stage, ...extra }); } catch (_) {} }
function crumb(stage, extra = {}) {
  try { localStorage.setItem('pdf_tools_heavy_text_breadcrumb_v1', JSON.stringify({ at: new Date().toISOString(), stage, ...extra })); } catch (_) {}
}

export async function editHeavyTextFlate(doc, needle, replacement, expected = 0, fileName = '') {
  const stage = 'texto PDF · ruta Flate streaming'; const key = `heavy-flate::${fileName}::${needle}`;
  perf('start', stage, { key, file: fileName, find: needle, expected }); crumb(stage + ' · inicio', { file: fileName, find: needle, expected });
  try {
    const candidates = [];
    for (let pi = 0; pi < doc.countPages(); pi++) {
      const page = doc.loadPage(pi), encs = encodedPairsForPage(page, needle, replacement);
      if (encs.ambiguous) { const reason = 'codificación de fuente ambigua'; perf('end', stage, { key, file: fileName, expected, applied: 0, warning: reason }); crumb(stage + ' · no aplicado', { file: fileName, reason }); return { count: 0, verified: false, reason }; }
      if (!encs.pairs.length) continue;
      for (const ref of contentRefs(page)) {
        const st = streamRef(ref); if (!st || !isPlainFlate(st)) continue;
        const len = rawLength(st); if (len < RAW_STREAM_MIN_BYTES) continue;
        candidates.push({ st, pairs: encs.pairs, page: pi + 1, rawLength: len });
      }
    }
    if (!candidates.length) { const reason = 'sin stream Flate pesado compatible'; perf('end', stage, { key, file: fileName, expected, applied: 0, warning: reason }); crumb(stage + ' · no aplicado', { file: fileName, reason }); return { count: 0, verified: false, reason }; }

    const pending = []; let total = 0, rawOutput = 0;
    for (const c of candidates) {
      crumb(stage + ' · transformando', { file: fileName, page: c.page, rawLength: c.rawLength });
      const raw = U(c.st.readRawStream()); const result = await transformRawFlate(raw, c.pairs);
      total += result.count; rawOutput += Number(result.bytes?.byteLength || 0);
      if (rawOutput > MAX_RAW_OUTPUT_BYTES) throw new Error('Presupuesto de memoria de salida excedido.');
      pending.push({ st: c.st, bytes: result.bytes, count: result.count, page: c.page });
    }
    if (total !== Number(expected || 0)) {
      const reason = `coincidencias codificadas=${total}, esperadas=${Number(expected || 0)}; no se modifica el PDF`;
      perf('end', stage, { key, file: fileName, expected, applied: 0, found: total, warning: reason }); crumb(stage + ' · no aplicado', { file: fileName, reason });
      return { count: 0, verified: false, found: total, reason };
    }
    for (const p of pending) if (p.count > 0 && p.bytes) p.st.writeRawStream(p.bytes);
    perf('end', stage, { key, file: fileName, expected, applied: total, found: total }); crumb(stage + ' · aplicado', { file: fileName, applied: total });
    return { count: total, verified: true, found: total };
  } catch (error) {
    const reason = error?.message || String(error); perf('end', stage, { key, file: fileName, expected, applied: 0, warning: reason }); crumb(stage + ' · error', { file: fileName, reason });
    return { count: 0, verified: false, reason };
  }
}
