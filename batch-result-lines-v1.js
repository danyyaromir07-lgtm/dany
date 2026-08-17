import './batch-search-variants-v1.js?v=20260814-searchvariants1';
import './signature-analysis-sync-v1.js?v=20260814-signaturesync1';
import './signature-result-badge-v1.js?v=20260814-signaturebadge1';

const TABLE = '#batchTable';
const STYLE_ID = 'batch-result-lines-style';
let lastCloudEventCount = -1;

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #batchTable .batch-result > span[data-result-lines="1"] {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 5px;
    }
    #batchTable .batch-hit-lines {
      display: flex;
      flex-direction: column;
      gap: 3px;
      width: 100%;
    }
    #batchTable .batch-hit-line {
      display: block;
      line-height: 1.35;
      overflow-wrap: anywhere;
    }
    #batchTable .batch-result-actions {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      margin-top: 2px;
    }
  `;
  document.head.appendChild(style);
}

function latestCloudAccept(item) {
  const events = Array.isArray(window.__cloudDiagnosticsEvents) ? window.__cloudDiagnosticsEvents : [];
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const e = events[i];
    if (e?.file !== item?.name) continue;
    if (e.stage === 'cloud.manual.vector.accept' || e.stage === 'cloud.manual.multi.accept' || e.stage === 'cloud.manual.zero.accept' || e.stage === 'cloud.manual.zeroexact.accept') return e;
  }
  return null;
}

function buildHits(item) {
  const hits = [];
  for (const c of item?.counts || []) {
    if (c?.count) hits.push(`${c.count}× ${c.find}`);
    if (c?.annotationCount) hits.push(`${c.annotationCount}× ${c.find} (FreeText)`);
    if (c?.ocrCount) hits.push(`${c.ocrCount}× ${c.find} (vector/OCR)`);
  }

  const accepted = latestCloudAccept(item);
  const previewValidated = Math.max(0, Number(item?.revisionCloudPreviewValidated || 0));
  const detected = Math.max(0, Number(item?.revisionCloudCount || 0));
  const acceptedCount = Math.max(0, Number(accepted?.components || 0));
  const cloudCount = previewValidated || acceptedCount || detected || (accepted ? 1 : 0);
  if (cloudCount > 0) {
    const validated = previewValidated > 0 || !!accepted;
    const suffix = validated ? ' · validada en Preview' : '';
    hits.push(`☁️ ${cloudCount}× nube${cloudCount === 1 ? '' : 's'} de revisión${suffix}`);
  }
  return hits;
}

function formatRow(row) {
  const result = row.querySelector(':scope > span');
  if (!result || result.dataset.resultLines === '1' || result.classList.contains('error')) return;

  const previewButton = result.querySelector('.bpreview');
  const idx = Number(previewButton?.dataset?.idx);
  const item = Number.isInteger(idx) ? window.__batchAnalysis?.[idx] : null;
  if (!item || item.error) return;

  const buttons = Array.from(result.querySelectorAll('button'));
  const hits = buildHits(item);

  const hitWrap = document.createElement('div');
  hitWrap.className = 'batch-hit-lines';
  if (hits.length) {
    for (const text of hits) {
      const line = document.createElement('span');
      line.className = 'batch-hit-line';
      line.textContent = text;
      hitWrap.appendChild(line);
    }
  } else {
    const line = document.createElement('span');
    line.className = 'batch-hit-line';
    line.textContent = 'Sin coincidencias';
    hitWrap.appendChild(line);
  }

  const footer = document.createElement('div');
  footer.className = 'batch-result-actions';
  const comments = document.createElement('span');
  comments.textContent = `💬 ${Number(item.comments || 0)}`;
  footer.appendChild(comments);
  for (const button of buttons) footer.appendChild(button);

  result.replaceChildren(hitWrap, footer);
  result.dataset.resultLines = '1';
}

function formatAll() {
  ensureStyle();
  const table = document.querySelector(TABLE);
  if (!table) return;
  table.querySelectorAll('.batch-result').forEach(formatRow);
}

function refreshAll() {
  const table = document.querySelector(TABLE);
  if (!table) return;
  table.querySelectorAll('.batch-result > span[data-result-lines="1"]').forEach((result) => { delete result.dataset.resultLines; });
  formatAll();
}

function wire() {
  ensureStyle();
  const table = document.querySelector(TABLE);
  if (!table) return;
  const observer = new MutationObserver(() => queueMicrotask(formatAll));
  observer.observe(table, { childList: true, subtree: true });
  window.__refreshBatchResultLines = refreshAll;
  formatAll();
  lastCloudEventCount = Array.isArray(window.__cloudDiagnosticsEvents) ? window.__cloudDiagnosticsEvents.length : 0;
  setInterval(() => {
    const count = Array.isArray(window.__cloudDiagnosticsEvents) ? window.__cloudDiagnosticsEvents.length : 0;
    if (count === lastCloudEventCount) return;
    lastCloudEventCount = count;
    refreshAll();
  }, 200);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
else wire();
