import { AnnotationFactory } from 'https://esm.sh/annotpdf@1.0.15';
import JSZip from 'https://esm.sh/jszip@3.10.1';

const fileInput = document.querySelector('#fileInput');
const dropzone = document.querySelector('#dropzone');
const openBtn = document.querySelector('#openBtn');
const processBtn = document.querySelector('#processBtn');
const clearBtn = document.querySelector('#clearBtn');
const status = document.querySelector('#status');
const summary = document.querySelector('#summary');
const results = document.querySelector('#results');

let entries = [];
let outputs = [];

const canWriteOriginals = 'showOpenFilePicker' in window;

function setStatus(message, type = '') {
  status.textContent = message;
  status.className = `status ${type}`.trim();
}

function updateControls() {
  processBtn.disabled = entries.length === 0;
  clearBtn.disabled = entries.length === 0 && outputs.length === 0;
  openBtn.textContent = canWriteOriginals ? 'Abrir PDFs para guardar' : 'Seleccionar PDFs';
}

function setEntries(nextEntries, mode = 'download') {
  const byName = new Map(entries.map((entry) => [entry.name, entry]));
  nextEntries.forEach((entry) => byName.set(entry.name, entry));
  entries = [...byName.values()];
  outputs = [];
  summary.classList.add('hidden');
  results.innerHTML = '';
  const suffix = mode === 'direct' ? ' · se podrán guardar sobre los originales' : '';
  setStatus(`${entries.length} PDF${entries.length === 1 ? '' : 's'} seleccionado${entries.length === 1 ? '' : 's'}${suffix}.`);
  updateControls();
}

async function openPdfHandles() {
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
    const next = [];
    for (const handle of handles) {
      const file = await handle.getFile();
      next.push({ name: file.name, file, handle, direct: true });
    }
    setEntries(next, 'direct');
  } catch (error) {
    if (error?.name !== 'AbortError') {
      console.error(error);
      setStatus(`No se pudieron abrir los PDFs: ${error?.message || error}`, 'warning');
    }
  }
}

function addInputFiles(selected) {
  const next = [...selected]
    .filter((file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))
    .map((file) => ({ name: file.name, file, direct: false }));
  setEntries(next, 'download');
}

function getErrorMessage(error) {
  if (!error) return 'Error desconocido.';
  if (typeof error === 'string') return error;
  return error.message || error.name || String(error);
}

async function countAnnotations(data) {
  const factory = new AnnotationFactory(data);
  return factory.getAnnotations().flat();
}

async function processPdf(entry) {
  const original = new Uint8Array(await entry.file.arrayBuffer());
  const factory = new AnnotationFactory(original);
  const annotations = factory.getAnnotations().flat().slice();
  const count = annotations.length;

  if (count === 0) {
    return { ...entry, bytes: original, count, changed: false, verified: true };
  }

  for (const annotation of annotations) {
    factory.deleteAnnotation(annotation);
  }

  const cleaned = factory.write();
  const remaining = await countAnnotations(cleaned);
  if (remaining.length !== 0) {
    throw new Error(`La verificación encontró ${remaining.length} anotaciones después de la limpieza.`);
  }

  return { ...entry, bytes: cleaned, count, changed: true, verified: true, original };
}

async function saveDirectly(item) {
  const permission = await item.handle.requestPermission({ mode: 'readwrite' });
  if (permission !== 'granted') {
    throw new Error('El navegador no concedió permiso de escritura.');
  }

  if (!item.changed) return;

  const writable = await item.handle.createWritable();
  try {
    await writable.write(item.bytes);
    await writable.close();
  } catch (error) {
    try { await writable.abort(); } catch (_) {}
    throw error;
  }

  const savedFile = await item.handle.getFile();
  const savedBytes = new Uint8Array(await savedFile.arrayBuffer());
  const remaining = await countAnnotations(savedBytes);
  if (remaining.length !== 0) {
    const restore = await item.handle.createWritable();
    await restore.write(item.original);
    await restore.close();
    throw new Error(`La verificación del archivo guardado encontró ${remaining.length} anotaciones; se restauró el original.`);
  }
}

function renderResult(item) {
  const row = document.createElement('div');
  row.className = `result-row ${item.error ? 'error' : ''}`;
  const countText = item.error
    ? `Error: ${getErrorMessage(item.error)}`
    : item.count === 0
      ? 'Sin anotaciones'
      : `${item.count} eliminada${item.count === 1 ? '' : 's'}${item.direct ? ' · guardado' : ''}`;
  row.innerHTML = '<span class="filename"></span><span class="count"></span>';
  row.querySelector('.filename').textContent = item.name;
  row.querySelector('.count').textContent = countText;
  results.appendChild(row);
}

async function processAll() {
  processBtn.disabled = true;
  clearBtn.disabled = true;
  outputs = [];
  results.innerHTML = '';
  summary.classList.add('hidden');

  let totalAnnotations = 0;
  let changed = 0;
  let ok = 0;
  let failed = 0;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    setStatus(`Procesando ${i + 1} de ${entries.length}: ${entry.name}`);
    try {
      const item = await processPdf(entry);
      if (item.direct) await saveDirectly(item);
      outputs.push(item);
      totalAnnotations += item.count;
      if (item.changed) changed++;
      ok++;
      renderResult(item);
    } catch (error) {
      failed++;
      renderResult({ name: entry.name, error });
      console.error(`No se pudo procesar ${entry.name}`, error);
    }
  }

  summary.textContent = `${ok} PDF${ok === 1 ? '' : 's'} procesado${ok === 1 ? '' : 's'} · ${totalAnnotations} anotación${totalAnnotations === 1 ? '' : 'es'} eliminada${totalAnnotations === 1 ? '' : 's'} · ${changed} archivo${changed === 1 ? '' : 's'} modificado${changed === 1 ? '' : 's'}${failed ? ` · ${failed} con error` : ''}`;
  summary.classList.remove('hidden');
  setStatus(failed ? 'Proceso terminado con algunos errores. El original no se sobrescribió en los archivos que fallaron.' : 'Proceso terminado correctamente.', failed ? 'warning' : 'success');
  clearBtn.disabled = false;
  processBtn.disabled = false;

  const downloadOutputs = outputs.filter((item) => !item.direct);
  if (downloadOutputs.length === 1 && failed === 0) downloadPdf(downloadOutputs[0]);
  else if (downloadOutputs.length > 1) await downloadZip(downloadOutputs);
}

function downloadPdf(item) {
  const blob = new Blob([item.bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = item.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function downloadZip(items) {
  const zip = new JSZip();
  items.forEach((item) => zip.file(item.name, item.bytes));
  const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'pdfs-sin-comentarios.zip';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function clearAll() {
  entries = [];
  outputs = [];
  fileInput.value = '';
  results.innerHTML = '';
  summary.classList.add('hidden');
  setStatus('Selecciona uno o varios PDFs para empezar.');
  updateControls();
}

openBtn.addEventListener('click', openPdfHandles);
fileInput.addEventListener('change', (event) => addInputFiles(event.target.files));
processBtn.addEventListener('click', processAll);
clearBtn.addEventListener('click', clearAll);

dropzone.addEventListener('dragover', (event) => {
  event.preventDefault();
  dropzone.classList.add('dragging');
});
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragging'));
dropzone.addEventListener('drop', (event) => {
  event.preventDefault();
  dropzone.classList.remove('dragging');
  addInputFiles(event.dataTransfer.files);
});

setStatus('Selecciona uno o varios PDFs para empezar.');
updateControls();
