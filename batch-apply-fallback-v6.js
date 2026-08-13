import * as mupdf from 'https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js';

import { editFreeTextDetailed } from './adaptive-engine-v1.js?v=20260812-309';
import { editDoc } from './text-editor-v64.js';
import { editTextByPageSearch } from './text-pdf-search-fallback-v1.js?v=20260813-text-fallback1';

const $ = (s) => document.querySelector(s);
const status = $('#batchStatus');
const progress = $('#batchProgress');
const progressBar = $('#batchProgressBar');
const progressText = $('#batchProgressText');
const summary = $('#batchSummary');

function say(text) {
  if (status) status.textContent = text;
}

function progressSet(done, total, label = '') {
  const pct = total ? Math.round((done / total) * 100) : 0;
  progress?.classList.remove('hidden');
  if (progressBar) progressBar.style.width = `${pct}%`;
  if (progressText) progressText.textContent = `${pct}% · ${done} / ${total}${label ? ` · ${label}` : ''}`;
}

function asBytes(data) {
  if (data instanceof Uint8Array) return new Uint8Array(data);
  if (data instanceof ArrayBuffer) return new Uint8Array(data.slice(0));
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
  throw new Error('Los datos del PDF no tienen un formato binario válido.');
}

function savePdf(doc) {
  const buffer = doc.saveToBuffer('garbage=4,compress=yes,appearance=yes');
  return buffer?.asUint8Array ? new Uint8Array(buffer.asUint8Array()) : new Uint8Array(buffer);
}

async function applyTextRule(doc, rule, expected, fileName, diagnostics) {
  let applied = 0;

  // Método principal: edición directa de los streams originales.
  if (expected > 0) {
    try {
      const direct = Number(editDoc(doc, rule.find, rule.replace) || 0);
      applied += direct;
    } catch (error) {
      diagnostics.push(`${fileName}: edición directa de «${rule.find}» falló; probando búsqueda PDF segura (${error?.message || String(error)})`);
    }
  }

  // Fallback solo para lo que el método directo no consiguió aplicar.
  if (applied < expected) {
    const remaining = expected - applied;
    try {
      const fallback = Number(editTextByPageSearch(doc, rule.find, rule.replace, remaining) || 0);
      applied += fallback;
      if (fallback > 0) diagnostics.push(`${fileName}: fallback de texto PDF aplicado para «${rule.find}» (${fallback})`);
    } catch (error) {
      diagnostics.push(`${fileName}: fallback de texto PDF falló para «${rule.find}»: ${error?.message || String(error)}`);
    }
  }

  if (applied < expected) {
    diagnostics.push(`${fileName}: «${rule.find}» encontrado=${expected}, aplicado=${applied}`);
  }

  return applied;
}

export async function runFallback() {
  try {
    const list = window.__batchAnalysis || [];
    if (!list.length) {
      say('Primero analiza al menos un PDF.');
      return;
    }

    progressSet(0, list.length, 'Cargando motores');

    const vectorModule = await import('./vector-apply-v2.js?v=20260812-307');
    const applyVectorOCR = vectorModule.applyVectorOCR;
    if (typeof applyVectorOCR !== 'function') throw new Error('No se pudo cargar el motor vector/OCR.');

    const outputs = [];
    const diagnostics = [];
    let totalEdits = 0;
    let totalVector = 0;
    let failures = 0;

    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      progressSet(i, list.length, `Procesando ${item?.name || 'PDF'}`);

      if (item?.error) {
        failures++;
        diagnostics.push(`${item.name}: ${item.error}`);
        continue;
      }

      say(`Aplicando ${i + 1} de ${list.length}: ${item.name}`);

      const source = asBytes(item.data);
      let work = new Uint8Array(source);
      let doc = null;
      let textEdits = 0;
      let vectorEdits = 0;

      try {
        doc = mupdf.PDFDocument.openDocument(new Uint8Array(work), 'application/pdf');

        const rules = (item.counts || []).filter((r) => String(r.find || '').trim() && String(r.replace ?? '') !== '');

        for (const rule of rules) {
          const expected = Math.max(0, Number(rule.count || 0));
          if (expected > 0) {
            textEdits += await applyTextRule(doc, rule, expected, item.name, diagnostics);
          }

          try {
            const freeTextResult = editFreeTextDetailed(doc, rule.find, rule.replace) || {};
            textEdits += Number(freeTextResult.count || 0);
          } catch (error) {
            diagnostics.push(`${item.name}: FreeText «${rule.find}» no pudo aplicarse: ${error?.message || String(error)}`);
          }
        }

        const vectorResult = applyVectorOCR(doc, item) || {};
        vectorEdits = Number(vectorResult.count || 0);
        if (Array.isArray(vectorResult.skipped) && vectorResult.skipped.length) {
          diagnostics.push(`${item.name}: ${vectorResult.skipped.join(' · ')}`);
        }

        if (textEdits || vectorEdits) {
          work = savePdf(doc);
        }

        outputs.push({ name: item.name, bytes: work });
        totalEdits += textEdits;
        totalVector += vectorEdits;
      } catch (error) {
        failures++;
        diagnostics.push(`${item.name}: ${error?.message || String(error)}`);
        outputs.push({ name: item.name, bytes: source });
      } finally {
        try {
          doc?.destroy();
        } catch (_) {
          // ignore cleanup failures
        }
      }

      progressSet(i + 1, list.length, item.name);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    if (!outputs.length) throw new Error('No hay PDFs de salida.');

    say('Generando ZIP…');
    const { default: JSZip } = await import('https://esm.sh/jszip@3.10.1');
    const zip = new JSZip();

    for (const output of outputs) {
      const safeName = String(output.name || 'resultado.pdf').replace(/[\\/]/g, '_');
      zip.file(safeName, output.bytes);
    }

    const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'PDF_tools_procesados.zip';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      link.remove();
      URL.revokeObjectURL(url);
    }, 3000);

    if ($('#statFiles')) $('#statFiles').textContent = outputs.length;
    if ($('#statEdits')) $('#statEdits').textContent = totalEdits + totalVector;
    if ($('#statZip')) $('#statZip').textContent = '✓ Descargado';

    if (summary) {
      const plural = outputs.length === 1 ? '' : 's';
      const editPlural = totalEdits === 1 ? 'ación' : 'aciones';
      summary.textContent = `${outputs.length} PDF${plural} procesado${plural} · ${totalEdits} edit${editPlural} de texto/FreeText · ${totalVector} edición${totalVector === 1 ? '' : 'es'} vector/OCR${failures ? ` · ${failures} error${failures === 1 ? '' : 'es'}` : ''}${diagnostics.length ? ' · revisa el diagnóstico' : ''} · ZIP descargado`;
      summary.classList.remove('hidden');
    }

    progressSet(list.length, list.length, 'ZIP listo');
    say(diagnostics.length ? `Aplicación terminada con avisos: ${diagnostics.join(' | ').slice(0, 3500)}` : 'Aplicación terminada correctamente.');
  } catch (error) {
    console.error(error);
    say(`ERROR AL APLICAR: ${error?.message || String(error)}`);
    if (summary) {
      summary.textContent = `Error al aplicar. ${error?.message || String(error)}`;
      summary.classList.remove('hidden');
    }
  }
}

window.__runBatchFallback = runFallback;
