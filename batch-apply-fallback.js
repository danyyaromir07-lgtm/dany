import * as mupdf from 'https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js';

const $ = (s) => document.querySelector(s);
const status = $('#batchStatus');
const progress = $('#batchProgress');
const progressBar = $('#batchProgressBar');
const progressText = $('#batchProgressText');
const summary = $('#batchSummary');
const commentsBox = $('#batchRemoveComments');

function say(text) { if (status) status.textContent = text; }
function progressSet(done, total, label) {
  const pct = total ? Math.round(done / total * 100) : 0;
  if (progress) progress.classList.remove('hidden');
  if (progressBar) progressBar.style.width = pct + '%';
  if (progressText) progressText.textContent = pct + '% · ' + done + ' / ' + total + (label ? ' · ' + label : '');
}
function annotationType(a) { try { return a.getType() || ''; } catch (_) { return ''; } }
function removeComments(doc, preserved) {
  const removable = new Set(['Text','FreeText','Line','Square','Circle','Polygon','PolyLine','Highlight','Underline','Squiggly','StrikeOut','Stamp','Caret','Ink','Popup']);
  let removed = 0;
  for (const page of doc.getPages()) {
    let annotations = [];
    try { annotations = page.getAnnotations ? page.getAnnotations() : []; } catch (_) { annotations = []; }
    for (const a of annotations || []) {
      if (!removable.has(annotationType(a)) || preserved.has(a)) continue;
      try { page.deleteAnnotation(a); removed++; } catch (_) {}
    }
    try { page.update(); } catch (_) {}
  }
  return removed;
}

function asBytes(data) {
  if (data instanceof Uint8Array) return new Uint8Array(data);
  if (data instanceof ArrayBuffer) return new Uint8Array(data.slice(0));
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
  throw new Error('Los datos del PDF no tienen un formato binario válido.');
}

async function openPdf(data) {
  const bytes = asBytes(data);
  // Pass a fresh copy: this prevents a previous MuPDF document/OCR pass from
  // retaining or detaching the same backing buffer.
  return mupdf.PDFDocument.openDocument(new Uint8Array(bytes), 'application/pdf');
}

async function savePdf(doc) {
  const buf = doc.saveToBuffer('garbage=2,compress=yes,appearance=yes');
  return buf?.asUint8Array ? new Uint8Array(buf.asUint8Array()) : new Uint8Array(buf);
}

export async function runFallback() {
  try {
    say('Iniciando aplicación…');
    const list = window.__batchAnalysis || [];
    if (!list.length) { say('Primero analiza al menos un PDF.'); return; }
    progressSet(0, list.length, 'Cargando motor vector/OCR');

    const vectorModule = await import('./vector-apply-v1.js?v=113');
    const applyVectorOCR = vectorModule.applyVectorOCR;
    if (typeof applyVectorOCR !== 'function') throw new Error('No se pudo cargar el motor vector/OCR.');

    const outputs = [];
    let totalVector = 0;
    let totalComments = 0;
    let failures = 0;
    const diagnostics = [];

    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      progressSet(i, list.length, 'Procesando ' + item.name);
      if (item.error) { failures++; diagnostics.push(item.name + ': ' + item.error); continue; }
      say('Aplicando ' + (i + 1) + ' de ' + list.length + ': ' + item.name);

      let doc = null;
      let bytes = null;
      let vectorEdits = 0;
      let comments = 0;
      let modified = false;

      try {
        bytes = asBytes(item.data);
        doc = await openPdf(bytes);

        try {
          const result = applyVectorOCR(doc, item) || {};
          vectorEdits = Number(result.count || 0);
          modified = vectorEdits > 0;
          const preserved = new Set(result.preserved || []);
          if (result.skipped?.length) diagnostics.push(item.name + ': ' + result.skipped.join(' · '));

          if (commentsBox?.checked) {
            comments = removeComments(doc, preserved);
            modified = modified || comments > 0;
          }

          if (modified) bytes = await savePdf(doc);
        } catch (err) {
          // Do not discard the PDF or hide the actual failure. The original
          // bytes remain available for the ZIP and the diagnostic is explicit.
          failures++;
          diagnostics.push('Error aplicando cambios en ' + item.name + ': ' + (err?.message || String(err)));
          try { if (commentsBox?.checked) comments = removeComments(doc, new Set()); } catch (_) {}
          try { if (comments > 0) bytes = await savePdf(doc); } catch (saveErr) {
            diagnostics.push('Error guardando ' + item.name + ': ' + (saveErr?.message || String(saveErr)));
            bytes = asBytes(item.data);
          }
        }

        if (!bytes?.byteLength) throw new Error('El PDF no contiene datos de salida.');
        outputs.push({ name: item.name, bytes });
        totalVector += vectorEdits;
        totalComments += comments;
      } catch (err) {
        failures++;
        diagnostics.push('Error procesando ' + item.name + ': ' + (err?.message || String(err)));
      } finally {
        try { doc?.destroy(); } catch (_) {}
      }

      progressSet(i + 1, list.length, item.name);
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    if (!outputs.length) {
      throw new Error(diagnostics.length ? diagnostics.join(' | ').slice(0, 5000) : 'No se pudo abrir ningún PDF para procesar.');
    }

    say('Generando ZIP…');
    const JSZipModule = await import('https://esm.sh/jszip@3.10.1');
    const JSZip = JSZipModule.default;
    const zip = new JSZip();
    for (const item of outputs) zip.file(item.name.replace(/\.pdf$/i, '') + '_procesado.pdf', item.bytes);
    const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'PDF_tools_procesados.zip';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => { link.remove(); URL.revokeObjectURL(url); }, 3000);

    if ($('#statFiles')) $('#statFiles').textContent = outputs.length;
    if ($('#statEdits')) $('#statEdits').textContent = totalVector;
    if ($('#statComments')) $('#statComments').textContent = totalComments;
    if ($('#statZip')) $('#statZip').textContent = '✓ Descargado';
    if (summary) {
      summary.textContent = `${outputs.length} PDF${outputs.length===1?'':'s'} procesado${outputs.length===1?'':'s'} · ${totalVector} edición${totalVector===1?'':'es'} vector/OCR · ${totalComments} comentarios eliminados${failures?' · '+failures+' error'+(failures===1?'':'es'):''}${diagnostics.length?' · revisa el diagnóstico':''} · ZIP descargado`;
      summary.classList.remove('hidden');
    }
    progressSet(list.length, list.length, 'ZIP listo');
    say(diagnostics.length ? 'Aplicación terminada con avisos: ' + diagnostics.join(' | ').slice(0,3500) : 'Aplicación terminada correctamente.');
  } catch (err) {
    console.error(err);
    say('ERROR AL APLICAR: ' + (err?.message || String(err)));
    if (summary) { summary.textContent = 'Error al aplicar. ' + (err?.message || String(err)); summary.classList.remove('hidden'); }
  }
}
window.__runBatchFallback = runFallback;
