const CHECKBOX = '#batchRemoveRevisionClouds';
const PANEL_ID = 'cloudDiagnosticsPanel';
const MAX_EVENTS = 600;
const events = [];
let mupdfPromise = null;

const q = (s) => document.querySelector(s);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function fmtNum(value, digits = 4) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(digits) : String(value ?? '');
}

function fmtBBox(value) {
  if (!Array.isArray(value) || value.length < 4) return '';
  return `[${value.slice(0, 4).map((x) => fmtNum(x, 1)).join(', ')}]`;
}

function fmtRGB(value) {
  if (!value || typeof value.length !== 'number' || value.length < 3) return '';
  return `(${Array.from(value).slice(0, 3).map((x) => fmtNum(x, 5)).join(', ')})`;
}

function ensurePanel() {
  let panel = q(`#${PANEL_ID}`);
  if (panel) return panel;
  const host = q('#analysisTool');
  if (!host) return null;
  panel = document.createElement('section');
  panel.id = PANEL_ID;
  panel.className = 'text-warning';
  panel.style.marginTop = '12px';
  panel.innerHTML = `<details><summary><strong>☁️ 🧪 Diagnóstico de nubes</strong> — detección raster, familia vectorial y borrado seguro</summary><div style="margin-top:10px"><div id="cloudDiagSummary" style="font-size:.9rem;margin-bottom:8px">Sin actividad de nubes.</div><pre id="cloudDiagLog" style="max-height:340px;overflow:auto;white-space:pre-wrap;margin:0;padding:10px;background:rgba(0,0,0,.04);border-radius:8px;font-size:12px"></pre><div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap"><button id="cloudDiagCopy" class="secondary small" type="button">Copiar diagnóstico</button><button id="cloudDiagClear" class="secondary small" type="button">Limpiar</button></div></div></details>`;
  const anchor = q('#revisionCloudLocationBox') || q('#ocrDiagnosticsBox') || q('#batchStatus');
  if (anchor?.parentElement) anchor.parentElement.insertBefore(panel, anchor.nextSibling);
  else host.appendChild(panel);
  q('#cloudDiagCopy')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(q('#cloudDiagLog')?.textContent || '');
    } catch (_) {}
  });
  q('#cloudDiagClear')?.addEventListener('click', () => reset());
  return panel;
}

function render() {
  ensurePanel();
  const summary = q('#cloudDiagSummary');
  const log = q('#cloudDiagLog');
  const last = events.at(-1);
  if (summary) summary.textContent = last ? `${last.stage} · ${last.detail}` : 'Sin actividad de nubes.';
  if (!log) return;
  log.textContent = events.map((event, index) => {
    const meta = [
      event.file && `archivo=${event.file}`,
      event.page != null && `página=${event.page}`,
      event.groups != null && `familias=${event.groups}`,
      event.candidates != null && `candidatas=${event.candidates}`,
      event.strokes != null && `trazos=${event.strokes}`,
      event.rgb && `RGB=${fmtRGB(event.rgb)}`,
      event.lineWidth != null && `grosor=${fmtNum(event.lineWidth, 5)}`,
      event.bbox && `bbox=${fmtBBox(event.bbox)}`,
      event.reason && `motivo=${event.reason}`,
      event.error && `error=${event.error}`
    ].filter(Boolean).join(' · ');
    return `${String(index + 1).padStart(3, '0')} | ${event.stage} | ${event.detail}${meta ? ` | ${meta}` : ''}`;
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
window.__cloudDiagnosticsVersion = 3;

async function loadMuPDF() {
  if (!mupdfPromise) {
    mupdfPromise = import('https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js');
  }
  return mupdfPromise;
}

function toColorArray(color) {
  if (!color || typeof color.length !== 'number' || color.length < 3) return null;
  return Array.from(color).slice(0, 3).map(Number);
}

function colorKey(colorSpace, color) {
  const rgb = toColorArray(color);
  if (!rgb) return null;
  const name = String(colorSpace || '');
  if (!/DeviceRGB|RGB/i.test(name)) return null;
  return rgb.map((value) => value.toPrecision(12)).join('|');
}

function isRed(rgb) {
  if (!rgb) return false;
  const [r, g, b] = rgb;
  return r >= 0.50 && r >= g + 0.12 && r >= b + 0.12;
}

function area(rect) {
  return Math.max(0, rect[2] - rect[0]) * Math.max(0, rect[3] - rect[1]);
}

function unionRect(a, b) {
  if (!a) return b.slice();
  return [
    Math.min(a[0], b[0]),
    Math.min(a[1], b[1]),
    Math.max(a[2], b[2]),
    Math.max(a[3], b[3])
  ];
}

function rectGap(a, b) {
  const dx = Math.max(0, Math.max(a[0], b[0]) - Math.min(a[2], b[2]));
  const dy = Math.max(0, Math.max(a[1], b[1]) - Math.min(a[3], b[3]));
  return Math.hypot(dx, dy);
}

function connectedComponents(strokes, gapLimit) {
  const seen = new Uint8Array(strokes.length);
  const components = [];
  for (let i = 0; i < strokes.length; i += 1) {
    if (seen[i]) continue;
    const stack = [i];
    const component = [];
    seen[i] = 1;
    while (stack.length) {
      const j = stack.pop();
      component.push(strokes[j]);
      for (let k = 0; k < strokes.length; k += 1) {
        if (seen[k]) continue;
        if (rectGap(strokes[j].bbox, strokes[k].bbox) <= gapLimit) {
          seen[k] = 1;
          stack.push(k);
        }
      }
    }
    components.push(component);
  }
  return components.sort((a, b) => b.length - a.length);
}

function evaluateFamily(strokes, pageBounds) {
  if (strokes.length < 20) return { accepted: false, reason: 'menos de 20 trazos' };
  if (strokes.length > 1200) return { accepted: false, reason: 'más de 1200 trazos' };
  const lineWidth = Math.abs(Number(strokes[0].lineWidth || 0));
  const gapLimit = Math.max(8, Math.min(22, lineWidth * 30 + 8));
  const components = connectedComponents(strokes, gapLimit);
  const main = components[0] || [];
  if (main.length < 20) return { accepted: false, reason: 'componente principal menor de 20 trazos' };
  if (main.length / strokes.length < 0.90) return { accepted: false, reason: `familia dispersa ${main.length}/${strokes.length}` };
  let bbox = null;
  let sumBoxArea = 0;
  for (const stroke of main) {
    bbox = unionRect(bbox, stroke.bbox);
    sumBoxArea += area(stroke.bbox);
  }
  const width = Math.max(1, bbox[2] - bbox[0]);
  const height = Math.max(1, bbox[3] - bbox[1]);
  if (width < 40 || height < 40) return { accepted: false, reason: 'bbox menor de 40×40', bbox };
  const fraction = area(bbox) / Math.max(1, area(pageBounds));
  if (fraction < 0.00015) return { accepted: false, reason: 'familia demasiado pequeña', bbox };
  if (fraction > 0.08) return { accepted: false, reason: 'familia ocupa demasiado de la página', bbox };
  const density = sumBoxArea / Math.max(1, area(bbox));
  if (density > 0.25) return { accepted: false, reason: 'densidad demasiado alta', bbox };
  const aspect = Math.min(width, height) / Math.max(width, height);
  if (aspect < 0.10) return { accepted: false, reason: 'geometría demasiado lineal', bbox };
  return { accepted: true, bbox, main: main.length, density, fraction };
}

async function inspectVectorFamilies(item) {
  const mupdf = await loadMuPDF();
  const doc = mupdf.PDFDocument.openDocument(new Uint8Array(item.data), 'application/pdf');
  try {
    for (let pageIndex = 0; pageIndex < doc.countPages(); pageIndex += 1) {
      const page = doc.loadPage(pageIndex);
      const groups = new Map();
      const device = new mupdf.Device({
        strokePath(path, stroke, ctm, colorSpace, color) {
          const rgb = toColorArray(color);
          const keyColor = colorKey(colorSpace, color);
          if (!keyColor || !isRed(rgb)) return;
          let bbox;
          try {
            bbox = Array.from(path.getBounds(stroke, ctm));
          } catch (_) {
            return;
          }
          const lineWidth = Number(stroke?.lineWidth ?? 0);
          const key = `${keyColor}::${lineWidth.toPrecision(12)}`;
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key).push({ bbox, rgb, lineWidth });
        }
      });
      page.runPageContents(device, mupdf.Matrix.identity);
      device.close?.();
      const pageBounds = Array.from(page.getBounds());
      emit({ stage: 'cloud.vector.inspect', detail: 'familias rojas exactas inspeccionadas', file: item.name, page: pageIndex + 1, groups: groups.size });
      let candidates = 0;
      const ranked = [...groups.values()].sort((a, b) => b.length - a.length).slice(0, 12);
      for (const strokes of ranked) {
        const result = evaluateFamily(strokes, pageBounds);
        const base = {
          file: item.name,
          page: pageIndex + 1,
          strokes: strokes.length,
          rgb: strokes[0]?.rgb,
          lineWidth: strokes[0]?.lineWidth,
          bbox: result.bbox
        };
        if (result.accepted) {
          candidates += 1;
          emit({ stage: 'cloud.vector.candidate', detail: 'familia compatible con nube', ...base });
        } else {
          emit({ stage: 'cloud.vector.reject', detail: 'familia descartada', ...base, reason: result.reason });
        }
      }
      emit({ stage: 'cloud.vector.result', detail: candidates === 1 ? '1 familia candidata' : 'sin candidato único seguro', file: item.name, page: pageIndex + 1, candidates });
    }
  } finally {
    doc.destroy();
  }
}

async function monitorAnalysis(previousFallback) {
  let batch = [];
  for (let i = 0; i < 900; i += 1) {
    batch = Array.isArray(window.__batchAnalysis) ? window.__batchAnalysis : [];
    if (batch.length && batch.every((item) => item?.error || typeof item?.revisionCloudCount === 'number')) break;
    await sleep(100);
  }
  if (!batch.length) {
    emit({ stage: 'cloud.error', detail: 'sin datos de análisis', reason: 'window.__batchAnalysis vacío' });
    return;
  }
  for (const item of batch) {
    if (item?.error) continue;
    if (Number(item.revisionCloudCount || 0) > 0) {
      emit({ stage: 'cloud.raster.detected', detail: 'nube detectada antes del fallback', file: item.name });
    } else {
      emit({ stage: 'cloud.raster.none', detail: 'raster sin nube segura', file: item.name });
    }
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
    } else if (Number(item.revisionCloudCount || 0) === 0) {
      if (item.revisionCloudVectorError) {
        emit({ stage: 'cloud.vector.error', detail: 'fallback vectorial produjo error', file: item.name, error: item.revisionCloudVectorError });
      }
      try {
        await inspectVectorFamilies(item);
      } catch (error) {
        emit({ stage: 'cloud.vector.diagnostic.error', detail: 'falló la inspección diagnóstica', file: item.name, error: error?.message || String(error) });
      }
    }
  }
  const total = batch.reduce((sum, item) => sum + Number(item?.revisionCloudCount || 0), 0);
  emit({ stage: 'cloud.analysis.end', detail: `FIN · ${total} nube${total === 1 ? '' : 's'} detectada${total === 1 ? '' : 's'}` });
}

async function monitorApply(previousApply) {
  emit({ stage: 'cloud.apply.start', detail: 'INICIO borrado seguro' });
  for (let i = 0; i < 1800; i += 1) {
    const current = window.__revisionCloudStreamApplyDebug;
    if (current && current !== previousApply) break;
    await sleep(100);
  }
  const batch = Array.isArray(window.__batchAnalysis) ? window.__batchAnalysis : [];
  for (const item of batch) {
    for (const detail of item?.revisionCloudStreamDetails || []) {
      emit({
        stage: detail.removed ? 'cloud.remove.ok' : 'cloud.remove.abort',
        detail: detail.removed ? 'nube eliminada del stream' : 'borrado cancelado por seguridad',
        file: item.name,
        page: detail.page,
        reason: detail.reason
      });
    }
  }
  const debug = window.__revisionCloudStreamApplyDebug;
  emit({ stage: 'cloud.apply.end', detail: `FIN · ${Number(debug?.removed || 0)} nube${Number(debug?.removed || 0) === 1 ? '' : 's'} eliminada${Number(debug?.removed || 0) === 1 ? '' : 's'}` });
}

function wire() {
  ensurePanel();
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
