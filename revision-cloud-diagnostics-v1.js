const CHECKBOX = '#batchRemoveRevisionClouds';
const ANALYZE = '#batchAnalyze';
const DIAG_LOG = '#ocrDiagLog';
const DIAG_SUMMARY = '#ocrDiagSummary';

const q = (s) => document.querySelector(s);
let timer = null;
let lastSignature = '';

function cloudRows() {
  const batch = Array.isArray(window.__batchAnalysis) ? window.__batchAnalysis : [];
  const rows = [];
  for (const item of batch) {
    if (!item || item.error) continue;
    const count = Number(item.revisionCloudCount || 0);
    if (!count) continue;
    const pages = Array.isArray(item.revisionClouds)
      ? item.revisionClouds
          .filter(p => Array.isArray(p?.clouds) && p.clouds.length)
          .map(p => `pág. ${p.page}: ${p.clouds.length}`)
          .join(', ')
      : '';
    rows.push({ name: item.name || '(sin nombre)', count, pages });
  }
  return rows;
}

function stripCloudSection(text) {
  const marker = '\n\n☁️ NUBES DE REVISIÓN\n';
  const i = text.indexOf(marker);
  return i >= 0 ? text.slice(0, i) : text;
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

  const log = q(DIAG_LOG);
  if (log) {
    const base = stripCloudSection(log.textContent || '');
    const lines = rows.length
      ? rows.map(r => `• ${r.name} — ${r.count} nube${r.count === 1 ? '' : 's'}${r.pages ? ` (${r.pages})` : ''}`)
      : ['• Ningún archivo con nubes de revisión detectadas.'];
    log.textContent = `${base}\n\n☁️ NUBES DE REVISIÓN\n${lines.join('\n')}`.trim();
  }

  const summary = q(DIAG_SUMMARY);
  if (summary) {
    const total = rows.reduce((n, r) => n + r.count, 0);
    const fileCount = rows.length;
    const cloudText = total
      ? `☁️ ${total} nube${total === 1 ? '' : 's'} en ${fileCount} archivo${fileCount === 1 ? '' : 's'}.`
      : '☁️ Sin nubes de revisión detectadas.';
    const clean = (summary.textContent || '').replace(/\s*·?\s*☁️[^.]*\./g, '').trim();
    summary.textContent = clean && clean !== 'Sin actividad OCR.' ? `${clean} · ${cloudText}` : cloudText;
  }
}

function startWatch() {
  lastSignature = '';
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
  q(ANALYZE)?.addEventListener('click', () => {
    if (q(CHECKBOX)?.checked) startWatch();
  });
  document.addEventListener('change', e => {
    if (e.target?.matches?.(CHECKBOX) && e.target.checked) startWatch();
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
else wire();
