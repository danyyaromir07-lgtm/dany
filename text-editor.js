import * as mupdf from 'https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js';

const findInput = document.querySelector('#findText');
const replaceInput = document.querySelector('#replaceText');
const fileInput = document.querySelector('#textFileInput');
const dropzone = document.querySelector('#textDropzone');
const openBtn = document.querySelector('#textOpenBtn');
const processBtn = document.querySelector('#textProcessBtn');
const clearBtn = document.querySelector('#textClearBtn');
const status = document.querySelector('#textStatus');
const summary = document.querySelector('#textSummary');
const results = document.querySelector('#textResults');

let entries = [];
const canWriteOriginals = 'showOpenFilePicker' in window;

function setStatus(message, type = '') {
  status.textContent = message;
  status.className = `status ${type}`.trim();
}

function updateControls() {
  processBtn.disabled = !findInput.value.trim() || entries.length === 0;
  clearBtn.disabled = entries.length === 0 && !findInput.value && !replaceInput.value;
}

function addFiles(list) {
  const next = [...list]
    .filter(file => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))
    .map(file => ({ name: file.name, file, direct: false }));
  const map = new Map(entries.map(item => [item.name, item]));
  next.forEach(item => map.set(item.name, item));
  entries = [...map.values()];
  summary.classList.add('hidden');
  results.innerHTML = '';
  setStatus(`${entries.length} PDF${entries.length === 1 ? '' : 's'} seleccionado${entries.length === 1 ? '' : 's'}.`);
  updateControls();
}

async function openHandles() {
  if (!canWriteOriginals) {
    fileInput.click();
    return;
  }
  try {
    const handles = await window.showOpenFilePicker({
      multiple: true,
      excludeAcceptAllOption: true,
      types: [{ description: 'PDF', accept: { 'application/pdf': ['.pdf'] } }]
    });
    entries = [];
    for (const handle of handles) {
      const file = await handle.getFile();
      entries.push({ name: file.name, file, handle, direct: true });
    }
    summary.classList.add('hidden');
    results.innerHTML = '';
    setStatus(`${entries.length} PDFs seleccionados · se guardarán sobre los originales.`);
    updateControls();
  } catch (error) {
    if (error?.name !== 'AbortError') {
      setStatus(`No se pudieron abrir los PDFs: ${error?.message || error}`, 'warning');
    }
  }
}

function toBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (value && value.buffer instanceof ArrayBuffer) return new Uint8Array(value.buffer, value.byteOffset || 0, value.byteLength);
  return new Uint8Array(value);
}

function readStream(obj) {
  if (!obj) return null;
  const candidates = [obj];
  try {
    if (typeof obj.resolve === 'function') candidates.push(obj.resolve());
  } catch (_) {}
  for (const candidate of candidates) {
    try {
      if (candidate && typeof candidate.isStream === 'function' && !candidate.isStream()) continue;
      if (candidate && typeof candidate.readStream === 'function') return toBytes(candidate.readStream());
    } catch (_) {}
  }
  return null;
}

function asciiFromBytes(bytes) {
  let text = '';
  const data = toBytes(bytes);
  for (let i = 0; i < data.length; i++) text += String.fromCharCode(data[i]);
  return text;
}

function parseCMap(stream) {
  const text = asciiFromBytes(stream);
  const map = new Map();

  const bfchar = /<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>/g;
  for (const match of text.matchAll(bfchar)) {
    const src = parseInt(match[1], 16);
    const dst = parseInt(match[2], 16);
    if (Number.isFinite(src) && Number.isFinite(dst)) map.set(src, String.fromCodePoint(dst));
  }

  const bfrange = /<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>\s+(?:\[\s*([^\]]+)\]|<([0-9A-Fa-f]+)>)/g;
  for (const match of text.matchAll(bfrange)) {
    const start = parseInt(match[1], 16);
    const end = parseInt(match[2], 16);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start || end - start > 8192) continue;
    if (match[4]) {
      const first = parseInt(match[4], 16);
      for (let cid = start; cid <= end; cid++) map.set(cid, String.fromCodePoint(first + cid - start));
    } else if (match[3]) {
      const values = [...match[3].matchAll(/<([0-9A-Fa-f]+)>/g)];
      for (let i = 0; i < values.length && start + i <= end; i++) {
        const dst = parseInt(values[i][1], 16);
        if (Number.isFinite(dst)) map.set(start + i, String.fromCodePoint(dst));
      }
    }
  }

  const inverse = new Map();
  for (const [cid, char] of map) if (!inverse.has(char)) inverse.set(char, cid);
  return { map, inverse };
}

function getFontMaps(pageObj) {
  const resources = pageObj.getInheritable('Resources');
  if (!resources) throw new Error('La página no tiene Resources PDF.');
  const fontDict = resources.get('Font');
  if (!fontDict || typeof fontDict.forEach !== 'function') throw new Error('No se encontró el diccionario Font de la página.');

  const fonts = [];
  fontDict.forEach((fontRef, fontName) => {
    try {
      const candidates = [fontRef];
      try { candidates.push(fontRef.resolve()); } catch (_) {}
      let font = null;
      for (const candidate of candidates) {
        if (candidate && typeof candidate.get === 'function' && candidate.get('ToUnicode')) {
          font = candidate;
          break;
        }
      }
      if (!font) return;
      const toUnicode = font.get('ToUnicode');
      const bytes = readStream(toUnicode);
      if (!bytes || !bytes.length) return;
      const parsed = parseCMap(bytes);
      if (parsed.map.size) fonts.push({ name: String(fontName), ...parsed });
    } catch (_) {}
  });

  if (!fonts.length) throw new Error('No se encontraron fuentes PDF con mapa ToUnicode utilizable.');
  return fonts;
}

function getContentStreams(pageObj) {
  const contents = pageObj.get('Contents');
  if (!contents) throw new Error('La página no tiene Contents.');
  const streams = [];
  const add = value => {
    if (value && readStream(value)) streams.push(value);
  };
  try {
    if (contents.isArray?.()) contents.forEach(value => add(value));
    else add(contents);
  } catch (_) {}
  if (!streams.length) throw new Error('No se encontraron flujos de contenido PDF editables.');
  return streams;
}

function regexForFind(find) {
  let pattern = '';
  for (const char of find) {
    if (/\s/.test(char)) pattern += '\\s+';
    else pattern += char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(pattern, 'g');
}

function decodeBytes(bytes, font) {
  const data = toBytes(bytes);

  if (data.length % 2 === 0) {
    let ok = true;
    const chars = [];
    for (let i = 0; i < data.length; i += 2) {
      const char = font.map.get(data[i] * 256 + data[i + 1]);
      if (char == null) { ok = false; break; }
      chars.push(char);
    }
    if (ok) return { mode: 'two', text: chars.join('') };
  }

  const chars = [];
  for (const byte of data) {
    const char = font.map.get(byte);
    if (char == null) return null;
    chars.push(char);
  }
  return { mode: 'one', text: chars.join('') };
}

function encodeBytes(text, font, mode) {
  const chars = Array.from(text);
  if (mode === 'one') {
    const out = new Uint8Array(chars.length);
    for (let i = 0; i < chars.length; i++) {
      const cid = font.inverse.get(chars[i]);
      if (cid == null || cid > 255) return null;
      out[i] = cid;
    }
    return out;
  }
  const out = new Uint8Array(chars.length * 2);
  for (let i = 0; i < chars.length; i++) {
    const cid = font.inverse.get(chars[i]);
    if (cid == null || cid > 65535) return null;
    out[i * 2] = cid >> 8;
    out[i * 2 + 1] = cid & 255;
  }
  return out;
}

function decodeLiteral(token) {
  const inner = token.slice(1, -1);
  const bytes = [];
  for (let i = 0; i < inner.length; i++) {
    let code = inner.charCodeAt(i);
    if (code !== 92) {
      bytes.push(code & 255);
      continue;
    }
    if (++i >= inner.length) break;
    code = inner.charAt(i);
    if (code === 'n') bytes.push(10);
    else if (code === 'r') bytes.push(13);
    else if (code === 't') bytes.push(9);
    else if (code === 'b') bytes.push(8);
    else if (code === 'f') bytes.push(12);
    else if (code === '\n') {}
    else if (code === '\r') { if (inner.charAt(i + 1) === '\n') i++; }
    else if (/[0-7]/.test(code)) {
      let oct = code;
      for (let j = 0; j < 2 && /[0-7]/.test(inner.charAt(i + 1)); j++) oct += inner.charAt(++i);
      bytes.push(parseInt(oct, 8));
    } else bytes.push(code.charCodeAt(0) & 255);
  }
  return new Uint8Array(bytes);
}

function encodeLiteral(bytes) {
  let text = '';
  for (const byte of bytes) {
    if (byte === 40) text += '\\(';
    else if (byte === 41) text += '\\)';
    else if (byte === 92) text += '\\\\';
    else if (byte === 10) text += '\\n';
    else if (byte === 13) text += '\\r';
    else if (byte === 9) text += '\\t';
    else if (byte < 32 || byte > 126) text += '\\' + byte.toString(8).padStart(3, '0');
    else text += String.fromCharCode(byte);
  }
  return '(' + text + ')';
}

function tokenBytes(token) {
  const clean = token.slice(1, -1).replace(/\s+/g, '');
  if (clean.length % 2) return null;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    const value = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    if (!Number.isFinite(value)) return null;
    out[i] = value;
  }
  return out;
}

function findFont(fonts, name) {
  return fonts.find(font => font.name === name) || null;
}

function editStreams(pageObj, find, replacement) {
  const fonts = getFontMaps(pageObj);
  const streams = getContentStreams(pageObj);
  const searchRegex = regexForFind(find);
  let total = 0;

  for (const stream of streams) {
    const raw = readStream(stream);
    if (!raw) continue;
    const source = asciiFromBytes(raw);
    const tokenRegex = /(\/F[A-Za-z0-9_.-]+)\s+[-+0-9.eE]+\s+Tf|((?:\((?:\\.|[^\\()])*\))|(?:<[0-9A-Fa-f\s]+>))\s*Tj/g;
    let currentFont = null;
    const replacements = [];

    for (const match of source.matchAll(tokenRegex)) {
      if (match[1]) {
        currentFont = findFont(fonts, match[1]);
        continue;
      }
      if (!currentFont) continue;

      const token = match[2];
      const bytes = token.startsWith('(') ? decodeLiteral(token) : tokenBytes(token);
      if (!bytes) continue;
      const decoded = decodeBytes(bytes, currentFont);
      if (!decoded) continue;

      searchRegex.lastIndex = 0;
      if (!searchRegex.test(decoded.text)) continue;
      searchRegex.lastIndex = 0;
      const changed = decoded.text.replace(searchRegex, replacement);
      const encoded = encodeBytes(changed, currentFont, decoded.mode);
      if (!encoded) throw new Error(`La fuente ${currentFont.name} no puede codificar todos los caracteres del reemplazo.`);

      const value = token.startsWith('(')
        ? encodeLiteral(encoded)
        : `<${Array.from(encoded, byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase()}>`;
      const tokenStart = match.index + match[0].indexOf(token);
      replacements.push({ start: tokenStart, end: tokenStart + token.length, value });
      total++;
    }

    if (replacements.length) {
      let next = source;
      for (let i = replacements.length - 1; i >= 0; i--) {
        const item = replacements[i];
        next = next.slice(0, item.start) + item.value + next.slice(item.end);
      }
      stream.writeStream(new TextEncoder().encode(next));
    }
  }

  if (!total) throw new Error('No se encontró la frase dentro de los objetos de texto editables. No se modificó el PDF.');
  return total;
}

async function processPdf(entry, find, replacement) {
  let source = entry.file;
  if (entry.handle) {
    const permission = await entry.handle.requestPermission({ mode: 'read' });
    if (permission !== 'granted') throw new Error('El navegador no concedió permiso de lectura.');
    source = await entry.handle.getFile();
  }

  const original = new Uint8Array(await source.arrayBuffer());
  const doc = mupdf.PDFDocument.openDocument(original, 'application/pdf');

  try {
    let count = 0;
    for (let i = 0; i < doc.countPages(); i++) {
      const page = doc.loadPage(i);
      const pageObj = page.getObject();
      try {
        if (page.search(find).length) count += editStreams(pageObj, find, replacement);
      } finally {
        page.destroy();
      }
    }

    if (!count) return { ...entry, bytes: original, count: 0, changed: false };

    const bytes = doc.saveToBuffer('garbage=2,compress=yes').asUint8Array();
    const check = mupdf.PDFDocument.openDocument(bytes, 'application/pdf');
    try {
      let oldLeft = 0;
      let newFound = 0;
      for (let i = 0; i < check.countPages(); i++) {
        const page = check.loadPage(i);
        try {
          oldLeft += page.search(find).length;
          newFound += page.search(replacement).length;
        } finally {
          page.destroy();
        }
      }
      if (oldLeft) throw new Error(`La verificación encontró ${oldLeft} coincidencia${oldLeft === 1 ? '' : 's'} del texto antiguo.`);
      if (!newFound) throw new Error('El texto nuevo no quedó incorporado al PDF. No se sobrescribió el original.');
    } finally {
      check.destroy();
    }

    return { ...entry, bytes, count, changed: true };
  } finally {
    doc.destroy();
  }
}

async function saveDirect(item) {
  if (!item.changed) return;
  const permission = await item.handle.requestPermission({ mode: 'readwrite' });
  if (permission !== 'granted') throw new Error('El navegador no concedió permiso de escritura.');
  const writable = await item.handle.createWritable();
  try {
    await writable.write(item.bytes);
    await writable.close();
  } catch (error) {
    try { await writable.abort(); } catch (_) {}
    throw error;
  }
}

function downloadPdf(item) {
  const url = URL.createObjectURL(new Blob([item.bytes], { type: 'application/pdf' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = item.name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function render(item) {
  const row = document.createElement('div');
  row.className = `result-row ${item.error ? 'error' : ''}`;
  row.innerHTML = '<span class="filename"></span><span class="count"></span>';
  row.querySelector('.filename').textContent = item.name;
  row.querySelector('.count').textContent = item.error
    ? `Error: ${item.errorMessage}`
    : item.count === 0
      ? 'Sin coincidencias'
      : `${item.count} reemplazada${item.count === 1 ? '' : 's'}${item.direct ? ' · guardado' : ' · descargado'}`;
  results.appendChild(row);
}

async function processAll() {
  const find = findInput.value;
  const replacement = replaceInput.value;
  if (!find.trim() || !entries.length) return;

  processBtn.disabled = true;
  clearBtn.disabled = true;
  results.innerHTML = '';
  summary.classList.add('hidden');

  let total = 0;
  let changed = 0;
  let ok = 0;
  let failed = 0;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    setStatus(`Editando texto original ${i + 1} de ${entries.length}: ${entry.name}`);
    try {
      const item = await processPdf(entry, find, replacement);
      if (item.direct) await saveDirect(item);
      else if (item.changed) downloadPdf(item);
      total += item.count;
      if (item.changed) changed++;
      ok++;
      render(item);
    } catch (error) {
      failed++;
      render({ name: entry.name, error: true, errorMessage: error instanceof Error ? error.message : String(error) });
    }
  }

  summary.textContent = `${ok} PDF${ok === 1 ? '' : 's'} procesado${ok === 1 ? '' : 's'} · ${total} coincidencia${total === 1 ? '' : 's'} reemplazada${total === 1 ? '' : 's'} · ${changed} archivo${changed === 1 ? '' : 's'} modificado${changed === 1 ? '' : 's'}${failed ? ` · ${failed} con error` : ''}`;
  summary.classList.remove('hidden');
  setStatus(failed ? 'Proceso terminado con errores. Los archivos que fallaron no se sobrescribieron.' : 'Proceso terminado correctamente.', failed ? 'warning' : 'success');
  processBtn.disabled = false;
  clearBtn.disabled = false;
}

function clearAll() {
  entries = [];
  fileInput.value = '';
  findInput.value = '';
  replaceInput.value = '';
  results.innerHTML = '';
  summary.classList.add('hidden');
  setStatus('Selecciona PDFs y escribe el texto que quieres cambiar.');
  updateControls();
}

findInput.addEventListener('input', updateControls);
replaceInput.addEventListener('input', updateControls);
fileInput.addEventListener('change', event => addFiles(event.target.files));
dropzone.addEventListener('dragover', event => { event.preventDefault(); dropzone.classList.add('dragging'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragging'));
dropzone.addEventListener('drop', event => { event.preventDefault(); dropzone.classList.remove('dragging'); addFiles(event.dataTransfer.files); });
openBtn.addEventListener('click', openHandles);
processBtn.addEventListener('click', processAll);
clearBtn.addEventListener('click', clearAll);

setStatus('Selecciona PDFs y escribe el texto que quieres cambiar.');
updateControls();
