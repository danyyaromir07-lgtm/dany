const CHECKBOX = '#batchRemoveRevisionClouds';
const ANALYZE = '#batchAnalyze';
const STATUS = '#batchStatus';
const PANEL_ID = 'cloudDiagnosticsPanel';

const q = (s) => document.querySelector(s);
let timer = null;
let lastSignature = '';

function ensureDiagnosticPanel() {
  let panel = document.getElementById(PANEL_ID);
  if (panel) return panel;
  const host = q('#analysisTool');
  if (!host) return null;
  panel = document.createElement('section');
  panel.id = PANEL_ID;
  panel.className = 'text-warning';
  panel.style.marginTop = '12px';
  panel.innerHTML = '<details><summary><strong>☁️ 🧪 Diagnóstico de nubes</strong> — detección raster, familia vectorial y borrado seguro</summary><div style="margin-top:10px"><div id="cloudDiagSummary" style="font-size:.9rem;margin-bottom:8px">Diagnóstico de nubes cargado. Sin actividad todavía.</div><pre id="cloudDiagLog" style="max-height:340px;overflow:auto;white-space:pre-wrap;margin:0;padding:10px;background:rgba(0,0,0,.04);border-radius:8px;font-size:12px">Activa “Eliminar nubes de revisión gráficas” y pulsa Analizar PDFs para registrar el proceso.</pre><div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap"><button id="cloudDiagCopy" class="secondary small" type="button">Copiar diagnóstico</button><button id="cloudDiagClear" class="secondary small" type="button">Limpiar</button></div></div></details>';
  const anchor = q('#revisionCloudLocationBox') || q('#ocrDiagnosticsBox') || q('#batchStatus');
  if (anchor && anchor.parentElement) anchor.parentElement.insertBefore(panel, anchor.nextSibling);
  else host.appendChild(panel);
  q('#cloudDiagCopy')?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(q('#cloudDiagLog')?.textContent || ''); } catch (_) {}
  });
  q('#cloudDiagClear')?.addEventListener('click', () => {
    if (typeof window.__cloudDiagnosticsReset === 'function') window.__cloudDiagnosticsReset();
    else {
      const log = q('#cloudDiagLog');
      const summary = q('#cloudDiagSummary');
      if (log) log.textContent = 'Diagnóstico limpiado.';
      if (summary) summary.textContent = 'Sin actividad de nubes.';
    }
  });
  return panel;
}

function loadDetailedDiagnostics() {
  import('./revision-cloud-diagnostics-v2.js?v=20260815-clouddiag-resilient1').catch(err => {
    const summary = q('#cloudDiagSummary');
    const log = q('#cloudDiagLog');
    const msg = err && err.message ? err.message : String(err);
    if (summary) summary.textContent = 'No se pudo cargar el diagnóstico detallado.';
    if (log) log.textContent = 'cloud.diagnostic.loader.error | ' + msg;
    console.error('Cloud diagnostics loader error', err);
  });
}

function cloudRows() {
  const batch = Array.isArray(window.__batchAnalysis) ? window.__batchAnalysis : [];
  const rows = [];
  for (const item of batch) {
    if (!item || item.error) continue;
    const pages = Array.isArray(item.revisionClouds)
      ? item.revisionClouds
          .filter(p => Array.isArray(p?.clouds) && p.clouds.length)
          .map(p => ({ page: Number(p.page), count: p.clouds.length }))
      : [];
    const count = pages.reduce((n, p) => n + p.count, 0);
    if (!count) continue;
    rows.push({ name: item.name || '(sin nombre)', count, pages });
  }
  return rows;
}

function ensureBox() {
  let box = q('#revisionCloudLocationBox');
  if (box) return box;
  const status = q(STATUS);
  if (!status?.parentElement) return null;
  box = document.createElement('div');
  box.id = 'revisionCloudLocationBox';
  box.className = 'text-warning hidden';
  box.style.marginTop = '10px';
  status.insertAdjacentElement('afterend', box);
  return box;
}

function renderRows(rows) {
  const box = ensureBox();
  if (!box) return;
  if (!rows.length) {
    box.classList.add('hidden');
    box.textContent = '';
    return;
  }
  box.replaceChildren();
  const title = document.createElement('strong');
  const total = rows.reduce((n, r) => n + r.count, 0);
  title.textContent = `☁️ Ubicación de ${total} nube${total === 1 ? '' : 's'} de revisión`;
  box.appendChild(title);
  for (const row of rows) {
    const file = document.createElement('div');
    file.style.marginTop = '7px';
    file.textContent = `📄 ${row.name}`;
    box.appendChild(file);
    for (const p of row.pages) {
      const page = document.createElement('div');
      page.style.marginLeft = '18px';
      page.textContent = `↳ Página ${p.page}: ${p.count} nube${p.count === 1 ? '' : 's'}`;
      box.appendChild(page);
    }
  }
  box.classList.remove('hidden');
}

function render() {
  if (!q(CHECKBOX)?.checked) return;
  const batch = Array.isArray(window.__batchAnalysis) ? window.__batchAnalysis : [];
  if (!batch.length) return;
  const ready = batch.some(item => item && (Number.isFinite(Number(item.revisionCloudCount)) || item.revisionCloudError));
  if (!ready) return;
  const rows = cloudRows();
  const signature = JSON.stringify(rows);
  if (signature === lastSignature) return;
  lastSignature = signature;
  renderRows(rows);
}

function startWatch() {
  lastSignature = '';
  const box = ensureBox();
  if (box) { box.classList.add('hidden'); box.textContent = ''; }
  if (timer) clearInterval(timer);
  let ticks = 0;
  timer = setInterval(() => {
    render();
    ticks++;
    if (ticks >= 600) {
      clearInterval(timer);
      timer = null;
    }
  }, 100);
}

function wire() {
  ensureDiagnosticPanel();
  ensureBox();
  loadDetailedDiagnostics();
  q(ANALYZE)?.addEventListener('click', () => {
    if (q(CHECKBOX)?.checked) startWatch();
  });
  document.addEventListener('change', e => {
    if (!e.target?.matches?.(CHECKBOX)) return;
    if (e.target.checked) startWatch();
    else {
      const box = ensureBox();
      if (box) { box.classList.add('hidden'); box.textContent = ''; }
    }
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
else wire();
