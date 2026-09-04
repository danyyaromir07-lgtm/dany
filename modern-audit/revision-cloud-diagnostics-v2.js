const CHECKBOX = '#batchRemoveRevisionClouds';
const MAX_EVENTS = 500;
const events = [];
let mupdfPromise = null;

const q = (s) => document.querySelector(s);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function fmt(v, d = 5) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(d) : String(v ?? '');
}

function fmtRGB(rgb) {
  return Array.isArray(rgb) ? `(${rgb.slice(0, 3).map((v) => fmt(v, 5)).join(', ')})` : '';
}

function render() {
  const summary = q('#cloudDiagSummary');
  const log = q('#cloudDiagLog');
  const last = events.at(-1);
  if (summary) summary.textContent = last ? `${last.stage} · ${last.detail}` : 'Sin actividad de nubes.';
  if (!log) return;
  log.textContent = events.map((e, i) => {
    const meta = [
      e.file && `archivo=${e.file}`,
      e.page != null && `página=${e.page}`,
      e.groups != null && `familias=${e.groups}`,
      e.candidates != null && `candidatas=${e.candidates}`,
      e.strokes != null && `trazos=${e.strokes}`,
      e.rgb && `RGB=${fmtRGB(e.rgb)}`,
      e.lineWidth != null && `grosor=${fmt(e.lineWidth, 5)}`,
      e.reason && `motivo=${e.reason}`,
      e.error && `error=${e.error}`
    ].filter(Boolean).join(' · ');
    return `${String(i + 1).padStart(3, '0')} | ${e.stage} | ${e.detail}${meta ? ` | ${meta}` : ''}`;
  }).join('\n');
}

function emit(event) {
  events.push({ ...event, time: Date.now() });
  if (events.length > MAX_EVENTS) events.shift();
  render();
}

function reset() {
  events.length = 0;
  render();
}

window.__cloudDiagnostic = emit;
window.__cloudDiagnosticsReset = reset;
window.__cloudDiagnosticsEvents = events;
window.__cloudDiagnosticsVersion = 4;

async function loadMuPDF() {
  if (!mupdfPromise) mupdfPromise = import('https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js');
  return mupdfPromise;
}

function colorArray(color) {
  if (!color || typeof color.length !== 'number' || color.length < 3) return null;
  return Array.from(color).slice(0, 3).map(Number);
}

function colorKey(cs, color) {
  const rgb = colorArray(color);
  if (!rgb || !/DeviceRGB|RGB/i.test(String(cs || ''))) return null;
  return rgb.map((v) => v.toPrecision(12)).join('|');
}

function isRed(rgb) {
  if (!rgb) return false;
  const [r, g, b] = rgb;
  return r >= 0.5 && r >= g + 0.12 && r >= b + 0.12;
}

async function inspectFamilies(item) {
  const mupdf = await loadMuPDF();
  const doc = mupdf.PDFDocument.openDocument(new Uint8Array(item.data), 'application/pdf');
  try {
    for (let pi = 0; pi < doc.countPages(); pi += 1) {
      const page = doc.loadPage(pi);
      const groups = new Map();
      const device = new mupdf.Device({
        strokePath(path, stroke, ctm, colorSpace, color) {
          const rgb = colorArray(color);
          const ck = colorKey(colorSpace, color);
          if (!ck || !isRed(rgb)) return;
          let bbox;
          try { bbox = Array.from(path.getBounds(stroke, ctm)); } catch (_) { return; }
          const lineWidth = Number(stroke?.getLineWidth?.() ?? stroke?.lineWidth ?? 0);
          const key = `${ck}::${lineWidth.toPrecision(12)}`;
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key).push({ bbox, rgb, lineWidth });
        }
      });
      page.runPageContents(device, mupdf.Matrix.identity);
      device.close?.();
      emit({ stage: 'cloud.vector.inspect', detail: 'familias rojas exactas inspeccionadas', file: item.name, page: pi + 1, groups: groups.size });
      const ranked = [...groups.values()].sort((a, b) => b.length - a.length).slice(0, 16);
      let candidates = 0;
      for (const strokes of ranked) {
        const first = strokes[0];
        let reason = '';
        if (strokes.length < 20) reason = 'menos de 20 trazos';
        else if (strokes.length > 1200) reason = 'más de 1200 trazos';
        else candidates += 1;
        emit({
          stage: reason ? 'cloud.vector.reject' : 'cloud.vector.family',
          detail: reason ? 'familia descartada en preclasificación' : 'familia pasa tamaño inicial',
          file: item.name,
          page: pi + 1,
          strokes: strokes.length,
          rgb: first?.rgb,
          lineWidth: first?.lineWidth,
          reason
        });
      }
      emit({ stage: 'cloud.vector.result', detail: candidates === 1 ? '1 familia con tamaño compatible' : `${candidates} familias con tamaño compatible`, file: item.name, page: pi + 1, candidates });
    }
  } finally {
    doc.destroy();
  }
}

async function monitorAnalysis(previousFallback) {
  let batch = [];
  for (let i = 0; i < 900; i += 1) {
    batch = Array.isArray(window.__batchAnalysis) ? window.__batchAnalysis : [];
    if (batch.length && batch.every((x) => x?.error || typeof x?.revisionCloudCount === 'number')) break;
    await sleep(100);
  }
  if (!batch.length) {
    emit({ stage: 'cloud.error', detail: 'sin datos de análisis' });
    return;
  }
  for (const item of batch) {
    if (item?.error) continue;
    emit({ stage: Number(item.revisionCloudCount || 0) ? 'cloud.raster.detected' : 'cloud.raster.none', detail: Number(item.revisionCloudCount || 0) ? 'nube detectada antes del fallback' : 'raster sin nube segura', file: item.name });
  }
  for (let i = 0; i < 900; i += 1) {
    const current = window.__revisionCloudVectorFallbackDebug;
    if (current && current !== previousFallback) break;
    await sleep(100);
  }
  const fallback = window.__revisionCloudVectorFallbackDebug;
  emit({ stage: 'cloud.fallback.state', detail: fallback ? `fallback finalizado · añadidas=${Number(fallback.added || 0)}` : 'fallback sin señal de finalización' });
  for (const item of batch) {
    if (item?.error) continue;
    if (item.revisionCloudVectorFallback) {
      emit({ stage: 'cloud.vector.accept', detail: 'fallback vectorial aceptado', file: item.name, candidates: Number(item.revisionCloudCount || 0) });
    } else if (Number(item.revisionCloudCount || 0) === 0 && item.data) {
      try { await inspectFamilies(item); }
      catch (error) { emit({ stage: 'cloud.vector.error', detail: 'falló inspección vectorial', file: item.name, error: error?.message || String(error) }); }
    }
  }
  const total = batch.reduce((n, x) => n + Number(x?.revisionCloudCount || 0), 0);
  emit({ stage: 'cloud.analysis.end', detail: `FIN · ${total} nube${total === 1 ? '' : 's'} detectada${total === 1 ? '' : 's'}` });
}

async function monitorApply(previousApply) {
  emit({ stage: 'cloud.apply.start', detail: 'INICIO borrado seguro' });
  for (let i = 0; i < 1800; i += 1) {
    const current = window.__revisionCloudStreamApplyDebug;
    if (current && current !== previousApply) break;
    await sleep(100);
  }
  const debug = window.__revisionCloudStreamApplyDebug;
  emit({ stage: 'cloud.apply.end', detail: `FIN · ${Number(debug?.removed || 0)} nube${Number(debug?.removed || 0) === 1 ? '' : 's'} eliminada${Number(debug?.removed || 0) === 1 ? '' : 's'}`, error: debug?.failures?.length ? debug.failures.join(' | ') : '' });
}

function wire() {
  q('#batchAnalyze')?.addEventListener('click', () => {
    if (!q(CHECKBOX)?.checked) return;
    reset();
    emit({ stage: 'cloud.start', detail: 'INICIO' });
    const previous = window.__revisionCloudVectorFallbackDebug;
    monitorAnalysis(previous).catch((error) => emit({ stage: 'cloud.error', detail: 'error de diagnóstico', error: error?.message || String(error) }));
  }, true);
  q('#batchApply')?.addEventListener('click', () => {
    if (!q(CHECKBOX)?.checked) return;
    const previous = window.__revisionCloudStreamApplyDebug;
    monitorApply(previous).catch((error) => emit({ stage: 'cloud.apply.error', detail: 'error de diagnóstico de aplicación', error: error?.message || String(error) }));
  }, true);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
else wire();
