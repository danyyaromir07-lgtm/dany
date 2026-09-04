// Memory-bounded direct text editor for exceptionally large PDF content streams.
// Normal documents keep using the historical text-editor-v65 implementation unchanged.
import { editDoc as editDocHistorical } from './text-editor-v65.js?v=20260819-heavystream-base1';

const HEAVY_RAW_STREAM_BYTES = 16 * 1024 * 1024;
const WS = new Set([0, 9, 10, 12, 13, 32]);
const DEL = new Set([40, 41, 60, 62, 91, 93, 123, 125, 47, 37]);
const FLEX_SEP = /[\s\u00a0\u2000-\u200b\u2028\u2029\u202f\u205f\u3000‐‑‒–—−-]/u;
const heavyCache = new WeakMap();

const ws = x => WS.has(x);
const del = x => ws(x) || DEL.has(x);
const U = b => b?.asUint8Array?.() || b;
const resolve = o => { try { return o?.resolve?.() || o; } catch (_) { return o; } };
function streamRef(o) { try { if (o?.isStream?.()) return o; const r = resolve(o); return r?.isStream?.() ? r : o; } catch (_) { return o; } }
function asText(bytes) { const u = U(bytes); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, Math.min(u.length, i + 0x8000))); return s; }
function asciiSlice(d, start, end) { let s = ''; for (let i = start; i < end; i += 0x8000) s += String.fromCharCode(...d.subarray(i, Math.min(end, i + 0x8000))); return s; }
function primitiveNumber(o) { try { if (o?.asNumber) return Number(o.asNumber()); const n = Number(o?.valueOf?.() ?? o); return Number.isFinite(n) ? n : 0; } catch (_) { return 0; } }
function contentRefs(page) { try { const co = page.getObject()?.get?.('Contents'); if (!co) return []; return co?.isArray?.() ? Array.from({ length: Number(co.length || 0) }, (_, i) => co.get(i)) : [co]; } catch (_) { return []; } }

function isHeavyDocument(doc) {
  if (heavyCache.has(doc)) return heavyCache.get(doc);
  let heavy = false;
  try {
    for (let pi = 0; pi < doc.countPages() && !heavy; pi++) {
      const page = doc.loadPage(pi);
      for (const ref of contentRefs(page)) {
        const st = streamRef(ref);
        if (!st?.isStream?.()) continue;
        let rawLength = 0;
        try { rawLength = primitiveNumber(st.get?.('Length')); } catch (_) {}
        if (!rawLength) {
          try { const raw = st.readRawStream?.(); rawLength = Number(raw?.getLength?.() ?? raw?.asUint8Array?.().length ?? raw?.length ?? 0); } catch (_) {}
        }
        if (rawLength >= HEAVY_RAW_STREAM_BYTES) { heavy = true; break; }
      }
    }
  } catch (_) { heavy = false; }
  heavyCache.set(doc, heavy);
  return heavy;
}

function hexBytes(x) {
  const s = (typeof x === 'string' ? x : asText(x)).replace(/\s+/g, ''), h = s.length % 2 ? s + '0' : s, o = new Uint8Array(h.length / 2);
  for (let i = 0; i < o.length; i++) o[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return o;
}
function unicodeHex(x) { const b = hexBytes(x); let s = ''; for (let i = 0; i + 1 < b.length; i += 2) s += String.fromCharCode((b[i] << 8) | b[i + 1]); return s; }
function cmap(ref) {
  const o = streamRef(ref); if (!o?.isStream?.()) return null;
  const t = asText(o.readStream()), map = new Map(), rev = new Map(); let bytes = 0;
  for (const z of t.matchAll(/(?:\d+\s+)?begincodespacerange([\s\S]*?)endcodespacerange/g)) for (const x of z[1].matchAll(/<([0-9a-f]+)>\s*<([0-9a-f]+)>/gi)) bytes = Math.max(bytes, x[1].length / 2);
  for (const z of t.matchAll(/(?:\d+\s+)?beginbfchar([\s\S]*?)endbfchar/g)) for (const x of z[1].matchAll(/<([0-9a-f]+)>\s*<([0-9a-f]+)>/gi)) map.set(parseInt(x[1], 16), unicodeHex(x[2]));
  for (const z of t.matchAll(/(?:\d+\s+)?beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const x of z[1].matchAll(/<([0-9a-f]+)>\s*<([0-9a-f]+)>\s*<([0-9a-f]+)>/gi)) { const a = parseInt(x[1], 16), b = parseInt(x[2], 16), u = parseInt(x[3], 16); for (let k = a; k <= b; k++) map.set(k, String.fromCodePoint(u + k - a)); }
    for (const x of z[1].matchAll(/<([0-9a-f]+)>\s*<([0-9a-f]+)>\s*\[([\s\S]*?)\]/gi)) { const a = parseInt(x[1], 16), b = parseInt(x[2], 16), v = [...x[3].matchAll(/<([0-9a-f]+)>/gi)]; for (let k = a; k <= b && k - a < v.length; k++) map.set(k, unicodeHex(v[k - a][1])); }
  }
  if (!map.size) return null; if (!bytes) bytes = 2; for (const [k, v] of map) if (!rev.has(v)) rev.set(v, k); return { map, rev, bytes };
}
function getFontMap(page, fontName, cache) {
  if (cache.has(fontName)) return cache.get(fontName);
  let result = null;
  try {
    const po = page.getObject(), res = resolve(po.getInheritable('Resources') || po.get('Resources')), fonts = resolve(res?.get?.('Font'));
    if (fonts?.isDictionary?.()) {
      const ref = fonts.get(fontName) || fonts.get('/' + fontName);
      if (ref) {
        const f = resolve(ref); result = cmap(f?.get?.('ToUnicode'));
        if (!result) { const ds = resolve(f?.get?.('DescendantFonts')); if (ds?.isArray?.() && ds.length) result = cmap(resolve(ds.get(0))?.get?.('ToUnicode')); }
      }
    }
  } catch (_) { result = null; }
  cache.set(fontName, result); return result;
}
function decodeToken(d, t, c) {
  const raw = d.subarray(t.start, t.end), b = [];
  if (t.kind === 'hex') b.push(...hexBytes(raw.subarray(1, raw.length - 1)));
  else {
    for (let i = 1; i < raw.length - 1; i++) {
      let x = raw[i]; if (x !== 92) { b.push(x); continue; }
      x = raw[++i];
      if (x === 110) b.push(10); else if (x === 114) b.push(13); else if (x === 116) b.push(9); else if (x === 98) b.push(8); else if (x === 102) b.push(12); else if (x === 40 || x === 41 || x === 92) b.push(x);
      else if (x >= 48 && x <= 55) { let v = x - 48; for (let q = 0; q < 2 && i + 1 < raw.length - 1 && raw[i + 1] >= 48 && raw[i + 1] <= 55; q++) { i++; v = v * 8 + raw[i] - 48; } b.push(v); }
      else if (x === 10) {} else if (x === 13) { if (raw[i + 1] === 10) i++; }
      else b.push(x);
    }
  }
  let s = ''; for (let i = 0; i < b.length; i += c.bytes) { let v = 0; for (let j = 0; j < c.bytes && i + j < b.length; j++) v = (v << 8) | b[i + j]; s += c.map.get(v) || '�'; } return s;
}
function encodeText(s, c) { const out = []; for (const ch of s) { const v = c.rev.get(ch); if (v == null) throw Error(`El carácter «${ch}» no existe en ToUnicode de la fuente original.`); for (let q = c.bytes - 1; q >= 0; q--) out.push((v >> (8 * q)) & 255); } return new TextEncoder().encode('<' + out.map(x => x.toString(16).padStart(2, '0')).join('') + '>'); }
function flexibleTextKey(s) { let out = ''; for (const ch of String(s || '')) if (!FLEX_SEP.test(ch)) out += ch; return out; }
function keyWithMap(s) { let key = '', starts = [], ends = []; for (let i = 0; i < s.length;) { const cp = s.codePointAt(i), ch = String.fromCodePoint(cp), j = i + ch.length; if (!FLEX_SEP.test(ch)) { key += ch; starts.push(i); ends.push(j); } i = j; } return { key, starts, ends }; }
function findMatches(full, needle) { const f = keyWithMap(full), target = flexibleTextKey(needle), out = []; if (!target || !f.key) return out; let p = 0; while ((p = f.key.indexOf(target, p)) >= 0) { const a = f.starts[p], b = f.ends[p + target.length - 1]; out.push({ start: a, end: b }); p += Math.max(1, target.length); } return out; }

function scanLiteral(d, i, e) { i++; let dep = 1; while (i < e && dep) { if (d[i] === 92) { i += 2; continue; } if (d[i] === 40) dep++; else if (d[i] === 41) dep--; i++; } return i; }
function scanHex(d, i, e) { i++; while (i < e && d[i] !== 62) i++; return i < e ? i + 1 : i; }
function scanArray(d, i, e) {
  const start = i, items = []; let depth = 1; i++;
  while (i < e && depth) {
    while (i < e && ws(d[i])) i++; if (i >= e) break;
    if (d[i] === 37) { while (i < e && d[i] !== 10 && d[i] !== 13) i++; continue; }
    const st = i, b = d[i];
    if (b === 40) { i = scanLiteral(d, i, e); if (depth === 1) items.push({ type: 'string', kind: 'literal', start: st, end: i }); continue; }
    if (b === 60 && d[i + 1] !== 60) { i = scanHex(d, i, e); if (depth === 1) items.push({ type: 'string', kind: 'hex', start: st, end: i }); continue; }
    if (b === 91) { depth++; i++; continue; }
    if (b === 93) { depth--; i++; continue; }
    if (b === 47) { i++; while (i < e && !del(d[i])) i++; continue; }
    if (DEL.has(b)) { i += ((b === 60 && d[i + 1] === 60) || (b === 62 && d[i + 1] === 62)) ? 2 : 1; continue; }
    i++; while (i < e && !del(d[i])) i++;
  }
  return { type: 'array', start, end: i, items };
}
function wordEq(d, s, e, text) { if (e - s !== text.length) return false; for (let i = 0; i < text.length; i++) if (d[s + i] !== text.charCodeAt(i)) return false; return true; }
function collectSegmentsHeavy(bytes, page) {
  const src = U(bytes), d = src instanceof Uint8Array ? src : new Uint8Array(src), segs = [], fontCache = new Map();
  let i = 0, inText = false, font = null, recent = [];
  const pushRecent = t => { recent.push(t); if (recent.length > 4) recent.shift(); };
  while (i < d.length) {
    while (i < d.length && ws(d[i])) i++; if (i >= d.length) break;
    if (d[i] === 37) { while (i < d.length && d[i] !== 10 && d[i] !== 13) i++; continue; }
    const st = i, b = d[i];
    if (b === 40) { i = scanLiteral(d, i, d.length); if (inText) pushRecent({ type: 'string', kind: 'literal', start: st, end: i }); continue; }
    if (b === 60 && d[i + 1] !== 60) { i = scanHex(d, i, d.length); if (inText) pushRecent({ type: 'string', kind: 'hex', start: st, end: i }); continue; }
    if (b === 91) { const ar = scanArray(d, i, d.length); i = ar.end; if (inText) pushRecent(ar); continue; }
    if (b === 47) { i++; while (i < d.length && !del(d[i])) i++; if (inText) pushRecent({ type: 'name', start: st, end: i }); continue; }
    if (DEL.has(b)) { i += ((b === 60 && d[i + 1] === 60) || (b === 62 && d[i + 1] === 62)) ? 2 : 1; continue; }
    i++; while (i < d.length && !del(d[i])) i++;
    if (!inText && wordEq(d, st, i, 'BI')) throw new Error('Stream grande con imagen inline: se omite el editor directo para evitar una interpretación insegura.');
    if (wordEq(d, st, i, 'BT')) { inText = true; recent = []; pushRecent({ type: 'word', start: st, end: i }); continue; }
    if (wordEq(d, st, i, 'ET')) { inText = false; recent = []; continue; }
    if (!inText) continue;
    if (wordEq(d, st, i, 'Tf')) { const n = recent[recent.length - 2]; if (n?.type === 'name') font = asciiSlice(d, n.start + 1, n.end); }
    else if (wordEq(d, st, i, 'Tj')) {
      const s = recent[recent.length - 1]; if (s?.type === 'string' && font) { const c = getFontMap(page, font, fontCache); if (c) segs.push({ tok: s, c, text: decodeToken(d, s, c) }); }
    } else if (wordEq(d, st, i, 'TJ')) {
      const ar = recent[recent.length - 1]; if (ar?.type === 'array' && font) { const c = getFontMap(page, font, fontCache); if (c) for (const s of ar.items) segs.push({ tok: s, c, text: decodeToken(d, s, c) }); }
    }
    pushRecent({ type: 'word', start: st, end: i });
  }
  return { d, segs };
}
function editStreamHeavy(bytes, needle, repl, page) {
  const { d, segs } = collectSegmentsHeavy(bytes, page), full = segs.map(x => x.text).join(''), matches = findMatches(full, needle);
  if (!matches.length || !segs.length) return { bytes: d, count: 0 };
  const bases = []; let cur = 0; for (const z of segs) { bases.push(cur); cur += z.text.length; }
  const tokenEdits = new Map();
  for (const m of matches) {
    const matchLen = Math.max(1, m.end - m.start);
    for (let k = 0; k < segs.length; k++) {
      const z = segs[k], base = bases[k], a = Math.max(0, m.start - base), b = Math.min(z.text.length, m.end - base); if (b <= a) continue;
      const rs = Math.round(((base + a - m.start) / matchLen) * repl.length), re = Math.round(((base + b - m.start) / matchLen) * repl.length);
      if (!tokenEdits.has(z.tok)) tokenEdits.set(z.tok, { seg: z, edits: [] }); tokenEdits.get(z.tok).edits.push({ a, b, text: repl.slice(rs, re) });
    }
  }
  const changes = [];
  for (const { seg, edits } of tokenEdits.values()) { let text = seg.text; edits.sort((x, y) => y.a - x.a); for (const e of edits) text = text.slice(0, e.a) + e.text + text.slice(e.b); changes.push({ start: seg.tok.start, end: seg.tok.end, replacement: encodeText(text, seg.c) }); }
  changes.sort((a, b) => a.start - b.start);
  let outLen = d.length; for (const c of changes) outLen += c.replacement.length - (c.end - c.start);
  const out = new Uint8Array(outLen); let srcPos = 0, dstPos = 0;
  for (const c of changes) { const part = d.subarray(srcPos, c.start); out.set(part, dstPos); dstPos += part.length; out.set(c.replacement, dstPos); dstPos += c.replacement.length; srcPos = c.end; }
  const tail = d.subarray(srcPos); out.set(tail, dstPos);
  return { bytes: out, count: matches.length };
}
function editDocHeavy(doc, needle, repl) {
  let count = 0;
  for (let i = 0; i < doc.countPages(); i++) {
    const page = doc.loadPage(i);
    for (const ref of contentRefs(page)) {
      const st = streamRef(ref); if (!st?.isStream?.()) continue;
      const z = editStreamHeavy(st.readStream(), needle, repl, page); if (z.count) { st.writeStream(z.bytes); count += z.count; }
    }
  }
  return count;
}
function perf(action, extra = {}) { try { window.__performanceDiagnostic?.({ scope: 'apply', action, stage: 'texto PDF · ruta segura stream grande', key: 'text-heavy-stream', ...extra }); } catch (_) {} }

export function editDoc(doc, needle, replacement) {
  if (!isHeavyDocument(doc)) return editDocHistorical(doc, needle, replacement);
  perf('start');
  try { const count = editDocHeavy(doc, needle, replacement); perf('end', { removed: count }); return count; }
  catch (error) { perf('end', { warning: error?.message || String(error) }); throw error; }
}

window.__textEditorHeavySafeV1 = { version: 1, rawStreamThreshold: HEAVY_RAW_STREAM_BYTES };
