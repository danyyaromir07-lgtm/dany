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

export async function runFallback() {
  try {
    say('Iniciando aplicación…');
    const list = window.__batchAnalysis || [];
    if (!list.length) { say('Primero analiza al menos un PDF.'); return; }
    progressSet(0, list.length, 'Cargando motor vector/OCR');
    const vectorModule = await import('./vector-apply-v1.js?v=111');
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
      try {
        doc = mupdf.PDFDocument.openDocument(item.data, 'application/pdf');
        let vectorEdits = 0;
        const preserved = new Set();
        const result = applyVectorOCR(doc, item) || {};
        vectorEdits = Number(result.count || 0);
        for (const a of (result.preserved || [])) preserved.add(a);
        if (result.skipped && result.skipped.length) diagnostics.push(item.name + ': ' + result.skipped.join(' · '));
        const comments = commentsBox && commentsBox.checked ? removeComments(doc, preserved) : 0;
        totalComments += comments;
        // Always produce an output PDF for a successfully opened input. This prevents
        // a failed vector attempt from being reported as "no PDF generated" and lets
        // the user inspect the result. If vectorEdits/comments are zero, the original
        // bytes are preserved exactly.
        let bytes = item.data;
        if (vectorEdits || comments) {
          bytes = doc.saveToBuffer('garbage=2,compress=yes,appearance=yes').asUint8Array();
        }
        outputs.push({ name: item.name, bytes });
        totalVector += vectorEdits;
      } catch (err) {
        failures++;
        diagnostics.push('Error en ' + item.name + ': ' + (err && err.message ? err.message : String(err)));
      } finally {
        try { doc?.destroy(); } catch (_) {}
      }
      progressSet(i + 1, list.length, item.name);
      await new Promise(function(resolve) { setTimeout(resolve, 0); });
    }
    if (!outputs.length) throw new Error('No se pudo abrir ningún PDF para procesar.');
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
    setTimeout(function() { link.remove(); URL.revokeObjectURL(url); }, 3000);
    const statFiles = $('#statFiles');
    const statEdits = $('#statEdits');
    const statComments = $('#statComments');
    const statZip = $('#statZip');
    if (statFiles) statFiles.textContent = outputs.length;
    if (statEdits) statEdits.textContent = totalVector;
    if (statComments) statComments.textContent = totalComments;
    if (statZip) statZip.textContent = '✓ Descargado';
    if (summary) {
      let text = outputs.length + ' PDF' + (outputs.length === 1 ? '' : 's') + ' procesado' + (outputs.length === 1 ? '' : 's') + ' · ' + totalVector + ' edición' + (totalVector === 1 ? '' : 'es') + ' vector/OCR · ' + totalComments + ' comentarios eliminados';
      if (failures) text += ' · ' + failures + ' error' + (failures === 1 ? '' : 'es');
      if (diagnostics.length) text += ' · revisa el diagnóstico del estado';
      summary.textContent = text + ' · ZIP descargado';
      summary.classList.remove('hidden');
    }
    progressSet(list.length, list.length, 'ZIP listo');
    if (diagnostics.length) say('Aplicación terminada con avisos: ' + diagnostics.join(' | ').slice(0, 3500));
    else say('Aplicación terminada correctamente.');
  } catch (err) {
    console.error(err);
    say('ERROR AL APLICAR: ' + (err && err.message ? err.message : String(err)));
    if (summary) { summary.textContent = 'Error al aplicar. No se ha modificado ningún PDF.'; summary.classList.remove('hidden'); }
  }
}

window.__runBatchFallback = runFallback;
