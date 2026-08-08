import { AnnotationFactory } from 'https://esm.sh/annotpdf@1.0.15';
import JSZip from 'https://esm.sh/jszip@3.10.1';

const fileInput = document.querySelector('#fileInput');
const dropzone = document.querySelector('#dropzone');
const processBtn = document.querySelector('#processBtn');
const clearBtn = document.querySelector('#clearBtn');
const status = document.querySelector('#status');
const summary = document.querySelector('#summary');
const results = document.querySelector('#results');

let files = [];
let outputs = [];

function setStatus(message, type = '') {
  status.textContent = message;
  status.className = `status ${type}`.trim();
}

function updateControls() {
  processBtn.disabled = files.length === 0;
  clearBtn.disabled = files.length === 0 && outputs.length === 0;
}

function addFiles(selected) {
  const incoming = [...selected].filter((file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
  const byName = new Map(files.map((file) => [file.name, file]));
  incoming.forEach((file) => byName.set(file.name, file));
  files = [...byName.values()];
  outputs = [];
  summary.classList.add('hidden');
  results.innerHTML = '';
  setStatus(`${files.length} PDF${files.length === 1 ? '' : 's'} seleccionado${files.length === 1 ? '' : 's'}.`);
  updateControls();
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function processPdf(file) {
  const data = new Uint8Array(await file.arrayBuffer());
  const factory = new AnnotationFactory(data);
  const annotationPages = factory.getAnnotations();
  const annotations = annotationPages.flat();
  const count = annotations.length;

  for (const annotation of annotations) {
    factory.deleteAnnotation(annotation);
  }

  const cleaned = factory.write();
  return { file, bytes: cleaned, count };
}

function renderResult(item) {
  const row = document.createElement('div');
  row.className = `result-row ${item.error ? 'error' : ''}`;
  const countText = item.error ? 'Error' : `${item.count} eliminada${item.count === 1 ? '' : 's'}`;
  row.innerHTML = `<span class="filename"></span><span class="count">${countText}</span>`;
  row.querySelector('.filename').textContent = item.file.name;
  results.appendChild(row);
}

async function processAll() {
  processBtn.disabled = true;
  clearBtn.disabled = true;
  outputs = [];
  results.innerHTML = '';
  summary.classList.add('hidden');

  let totalAnnotations = 0;
  let ok = 0;
  let failed = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    setStatus(`Procesando ${i + 1} de ${files.length}: ${file.name}`);
    try {
      const item = await processPdf(file);
      outputs.push(item);
      totalAnnotations += item.count;
      ok++;
      renderResult(item);
    } catch (error) {
      failed++;
      renderResult({ file, error: true });
      console.error(`No se pudo procesar ${file.name}`, error);
    }
  }

  summary.textContent = `${ok} PDF${ok === 1 ? '' : 's'} procesado${ok === 1 ? '' : 's'} · ${totalAnnotations} anotación${totalAnnotations === 1 ? '' : 'es'} eliminada${totalAnnotations === 1 ? '' : 's'}${failed ? ` · ${failed} con error` : ''}`;
  summary.classList.remove('hidden');
  setStatus(failed ? 'Proceso terminado con algunos errores.' : 'Proceso terminado correctamente.', failed ? 'warning' : 'success');
  clearBtn.disabled = false;
  processBtn.disabled = false;

  if (outputs.length === 1 && failed === 0) {
    downloadPdf(outputs[0]);
  } else if (outputs.length > 1) {
    await downloadZip();
  }
}

function downloadPdf(item) {
  const blob = new Blob([item.bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = item.file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function downloadZip() {
  const zip = new JSZip();
  outputs.forEach((item) => zip.file(item.file.name, item.bytes));
  const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'pdfs-sin-comentarios.zip';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function clearAll() {
  files = [];
  outputs = [];
  fileInput.value = '';
  results.innerHTML = '';
  summary.classList.add('hidden');
  setStatus('Selecciona uno o varios PDFs para empezar.');
  updateControls();
}

fileInput.addEventListener('change', (event) => addFiles(event.target.files));
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
  addFiles(event.dataTransfer.files);
});

setStatus('Selecciona uno o varios PDFs para empezar.');
updateControls();
