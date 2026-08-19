import * as mupdf from 'https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js';

import { editFreeTextDetailed } from './adaptive-engine-v1.js?v=20260812-309';
import { editDoc } from './text-editor-v65.js?v=20260819-heavyflate-base1';
import { editTextByPageSearch } from './text-pdf-search-fallback-v1.js?v=20260813-text-fallback1';
import { editHeavyTextFlate } from './text-editor-heavy-flate-v2.js?v=20260819-heavyflate1';

const $ = (s) => document.querySelector(s);
const status = $('#batchStatus');
const progress = $('#batchProgress');
const progressBar = $('#batchProgressBar');
const progressText = $('#batchProgressText');
const summary = $('#batchSummary');
const HEAVY_FILE_BYTES = 16 * 1024 * 1024;

function say(text) { if (status) status.textContent = text; }
function progressSet(done, total, label = '') {
  const pct = total ? Math.round((done / total) * 100) : 0;
  progress?.classList.remove('hidden');
  if (progressBar) progressBar.style.width = `${pct}%`;
  if (progressText) progressText.textContent = `${pct}% · ${done} / ${total}${label ? ` · ${label}` : ''}`;
}
function perf(action, stage, extra = {}) { try { window.__performanceDiagnostic?.({ scope: 'apply', action, stage, ...extra }); } catch (_) {} }
function crumb(stage, extra = {}) { try { localStorage.setItem('pdf_tools_heavy_apply_breadcrumb_v2', JSON.stringify({ at: new Date().toISOString(), stage, ...extra })); } catch (_) {} }

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
function expectedPdfTextEdits(item) { return (item?.counts || []).reduce((sum, rule) => sum + Math.max(0, Number(rule?.count || 0)), 0); }
function isHeavySource(source) { return Number(source?.byteLength || source?.length || 0) >= HEAVY_FILE_BYTES; }

async function applyTextRule(doc, rule, expected, fileName, diagnostics, prefix = '', heavy = false) {
  let applied = 0;
  if (expected <= 0) return 0;

  if (heavy) {
    crumb('texto PDF pesado · antes de Flate streaming', { file: fileName, find: rule.find, expected });
    const result = await editHeavyTextFlate(doc, rule.find, rule.replace, expected, fileName);
    applied = Number(result?.count || 0);
    if (!result?.verified) diagnostics.push(`${fileName}: ${prefix}texto PDF pesado «${rule.find}» no aplicado de forma insegura${result?.reason ? ` (${result.reason})` : ''}`);
    else diagnostics.push(`${fileName}: ${prefix}ruta Flate streaming aplicada para «${rule.find}» (${applied})`);
    return applied;
  }

  try {
    const direct = Number(editDoc(doc, rule.find, rule.replace) || 0);
    applied += direct;
  } catch (error) {
    diagnostics.push(`${fileName}: ${prefix}edición directa de «${rule.find}» falló; probando búsqueda PDF segura (${error?.message || String(error)})`);
  }

  if (applied < expected) {
    const remaining = expected - applied;
    try {
      const fallback = Number(editTextByPageSearch(doc, rule.find, rule.replace, remaining) || 0);
      applied += fallback;
      if (fallback > 0) diagnostics.push(`${fileName}: ${prefix}fallback de texto PDF aplicado para «${rule.find}» (${fallback})`);
    } catch (error) {
      diagnostics.push(`${fileName}: ${prefix}fallback de texto PDF falló para «${rule.find}»: ${error?.message || String(error)}`);
    }
  }

  if (applied < expected) diagnostics.push(`${fileName}: ${prefix}«${rule.find}» encontrado=${expected}, aplicado=${applied}`);
  return applied;
}

async function processItemOnce(item, source, applyVectorOCR, diagnostics, prefix = '') {
  let doc = null, pdfTextEdits = 0, freeTextEdits = 0, vectorEdits = 0, bytes = new Uint8Array(source);
  const heavy = isHeavySource(source);
  try {
    crumb('abrir PDF en Apply', { file: item.name, heavy, sizeBytes: Number(source?.byteLength || source?.length || 0) });
    doc = mupdf.PDFDocument.openDocument(new Uint8Array(source), 'application/pdf');
    const rules = (item.counts || []).filter((r) => String(r.find || '').trim() && String(r.replace ?? '') !== '');
    if (heavy && rules.some((r) => Math.max(0, Number(r.count || 0)) > 0)) perf('start', 'texto PDF · archivo pesado Flate protegido', { file: item.name, sizeBytes: Number(source?.byteLength || source?.length || 0) });

    for (const rule of rules) {
      const expected = Math.max(0, Number(rule.count || 0));
      if (expected > 0) pdfTextEdits += await applyTextRule(doc, rule, expected, item.name, diagnostics, prefix, heavy);
      try {
        const freeTextResult = editFreeTextDetailed(doc, rule.find, rule.replace) || {};
        freeTextEdits += Number(freeTextResult.count || 0);
      } catch (error) {
        diagnostics.push(`${item.name}: ${prefix}FreeText «${rule.find}» no pudo aplicarse: ${error?.message || String(error)}`);
      }
    }

    const vectorResult = applyVectorOCR(doc, item) || {};
    vectorEdits = Number(vectorResult.count || 0);
    if (Array.isArray(vectorResult.skipped) && vectorResult.skipped.length) diagnostics.push(`${item.name}: ${prefix}${vectorResult.skipped.join(' · ')}`);

    if (pdfTextEdits || freeTextEdits || vectorEdits) {
      crumb('guardar PDF tras Apply', { file: item.name, pdfTextEdits, freeTextEdits, vectorEdits });
      bytes = savePdf(doc);
    }
    if (heavy && rules.some((r) => Math.max(0, Number(r.count || 0)) > 0)) perf('end', 'texto PDF · archivo pesado Flate protegido', { file: item.name, pdfTextEdits, freeTextEdits, vectorEdits });
    return { bytes, pdfTextEdits, freeTextEdits, vectorEdits, heavy };
  } finally {
    try { doc?.destroy(); } catch (_) {}
  }
}

async function processItemWithRetry(item, source, applyVectorOCR, diagnostics) {
  const expected = expectedPdfTextEdits(item);
  let result = await processItemOnce(item, source, applyVectorOCR, diagnostics);

  if (expected > result.pdfTextEdits) {
    if (result.heavy) {
      diagnostics.push(`${item.name}: ⚠️ texto PDF pesado esperado=${expected}, aplicado=${result.pdfTextEdits}; no se usa reintento histórico para proteger la memoria`);
    } else {
      diagnostics.push(`${item.name}: ⚠️ texto PDF esperado=${expected}, aplicado=${result.pdfTextEdits}; reintentando el archivo de forma aislada`);
      await new Promise((resolve) => setTimeout(resolve, 25));
      try {
        const retryDiagnostics = [];
        const retry = await processItemOnce(item, source, applyVectorOCR, retryDiagnostics, 'reintento: ');
        diagnostics.push(...retryDiagnostics);
        if (retry.pdfTextEdits > result.pdfTextEdits) {
          diagnostics.push(`${item.name}: ✓ reintento aislado recuperó ${retry.pdfTextEdits - result.pdfTextEdits} edición${retry.pdfTextEdits - result.pdfTextEdits === 1 ? '' : 'es'} de texto PDF`);
          result = retry;
        } else diagnostics.push(`${item.name}: reintento aislado no mejoró el resultado (${retry.pdfTextEdits}/${expected})`);
      } catch (error) {
        diagnostics.push(`${item.name}: reintento aislado falló: ${error?.message || String(error)}`);
      }
    }
  }
  return { ...result, expectedPdfText: expected, unresolvedPdfText: Math.max(0, expected - result.pdfTextEdits) };
}

export async function runFallback() {
  try {
    const list = window.__batchAnalysis || [];
    if (!list.length) { say('Primero analiza al menos un PDF.'); return; }
    progressSet(0, list.length, 'Cargando motores');
    crumb('Cargando motores Apply', { pdfs: list.length });

    const vectorModule = await import('./vector-apply-v2.js?v=20260812-307');
    const applyVectorOCR = vectorModule.applyVectorOCR;
    if (typeof applyVectorOCR !== 'function') throw new Error('No se pudo cargar el motor vector/OCR.');

    const outputs = [], diagnostics = [], unresolvedNames = [];
    let totalEdits = 0, totalVector = 0, failures = 0, unresolvedFiles = 0;

    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      progressSet(i, list.length, `Procesando ${item?.name || 'PDF'}`);
      if (item?.error) { failures++; diagnostics.push(`${item.name}: ${item.error}`); continue; }

      say(`Aplicando ${i + 1} de ${list.length}: ${item.name}`);
      crumb('Aplicando PDF', { file: item.name, index: i + 1, total: list.length });
      const source = asBytes(item.data);
      try {
        const result = await processItemWithRetry(item, source, applyVectorOCR, diagnostics);
        outputs.push({ name: item.name, bytes: result.bytes });
        totalEdits += result.pdfTextEdits + result.freeTextEdits;
        totalVector += result.vectorEdits;
        item.batchApplyExpectedText = result.expectedPdfText;
        item.batchApplyAppliedText = result.pdfTextEdits;
        item.batchApplyUnresolvedText = result.unresolvedPdfText;
        if (result.unresolvedPdfText > 0) {
          unresolvedFiles++; unresolvedNames.push(item.name);
          diagnostics.push(`${item.name}: ⚠️ NO VERIFICADO · texto PDF esperado=${result.expectedPdfText}, aplicado=${result.pdfTextEdits}`);
        }
      } catch (error) {
        failures++; diagnostics.push(`${item.name}: ${error?.message || String(error)}`); outputs.push({ name: item.name, bytes: source });
      }
      progressSet(i + 1, list.length, item.name);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    if (!outputs.length) throw new Error('No hay PDFs de salida.');
    say('Generando ZIP…'); crumb('Generando ZIP', { outputs: outputs.length });
    const { default: JSZip } = await import('https://esm.sh/jszip@3.10.1');
    const zip = new JSZip();
    for (const output of outputs) zip.file(String(output.name || 'resultado.pdf').replace(/[\\/]/g, '_'), output.bytes);
    const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = 'PDF_tools_procesados.zip'; document.body.appendChild(link); link.click();
    setTimeout(() => { link.remove(); URL.revokeObjectURL(url); }, 3000);

    if ($('#statFiles')) $('#statFiles').textContent = outputs.length;
    if ($('#statEdits')) $('#statEdits').textContent = totalEdits + totalVector;
    if ($('#statZip')) $('#statZip').textContent = unresolvedFiles ? '⚠ Revisar' : '✓ Descargado';
    if (summary) {
      const plural = outputs.length === 1 ? '' : 's', editPlural = totalEdits === 1 ? 'ación' : 'aciones';
      summary.textContent = `${outputs.length} PDF${plural} procesado${plural} · ${totalEdits} edit${editPlural} de texto/FreeText · ${totalVector} edición${totalVector === 1 ? '' : 'es'} vector/OCR${unresolvedFiles ? ` · ⚠️ ${unresolvedFiles} archivo${unresolvedFiles === 1 ? '' : 's'} con sustituciones pendientes` : ' · ✓ todas las sustituciones PDF esperadas aplicadas'}${failures ? ` · ${failures} error${failures === 1 ? '' : 'es'}` : ''}${diagnostics.length ? ' · revisa el diagnóstico' : ''} · ZIP descargado`;
      summary.classList.remove('hidden');
    }
    progressSet(list.length, list.length, 'ZIP listo');
    if (unresolvedFiles) say(`⚠️ ZIP generado, pero ${unresolvedFiles} archivo${unresolvedFiles === 1 ? '' : 's'} requiere${unresolvedFiles === 1 ? '' : 'n'} revisión: ${unresolvedNames.join(' | ').slice(0, 2500)}`);
    else say(diagnostics.length ? `Aplicación terminada con avisos: ${diagnostics.join(' | ').slice(0, 3500)}` : 'Aplicación terminada correctamente. Todas las sustituciones PDF esperadas fueron aplicadas.');
  } catch (error) {
    console.error(error); say(`ERROR AL APLICAR: ${error?.message || String(error)}`);
    if (summary) { summary.textContent = `Error al aplicar. ${error?.message || String(error)}`; summary.classList.remove('hidden'); }
  }
}
window.__runBatchFallback = runFallback;
