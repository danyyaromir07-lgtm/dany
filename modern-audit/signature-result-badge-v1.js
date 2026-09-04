const TABLE = '#batchTable';
const ANALYZE = '#batchAnalyze';
const STYLE_ID = 'signature-result-badge-style';
let timer = null;

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #batchTable .signature-result-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      border: 1px solid rgba(180,120,20,.45);
      border-radius: 7px;
      background: rgba(255,193,7,.08);
      white-space: nowrap;
      font-size: .88rem;
      line-height: 1.2;
    }
  `;
  document.head.appendChild(style);
}

function syncBadges() {
  ensureStyle();
  const batch = Array.isArray(window.__batchAnalysis) ? window.__batchAnalysis : [];
  const rows = document.querySelectorAll(`${TABLE} .batch-result`);
  rows.forEach((row, idx) => {
    const footer = row.querySelector('.batch-result-actions');
    if (!footer) return;
    const existing = footer.querySelector('.signature-result-badge');
    const count = Number(batch[idx]?.signatureCount || 0);
    if (count <= 0) {
      existing?.remove();
      return;
    }
    const text = `✍️ ${count} firma${count === 1 ? '' : 's'}`;
    if (existing) {
      if (existing.textContent !== text) existing.textContent = text;
      return;
    }
    const badge = document.createElement('span');
    badge.className = 'signature-result-badge';
    badge.textContent = text;
    badge.title = `${count} firma${count === 1 ? '' : 's'} digital${count === 1 ? '' : 'es'} detectada${count === 1 ? '' : 's'}`;
    footer.appendChild(badge);
  });
}

function watchAfterAnalyze() {
  if (timer) clearInterval(timer);
  let ticks = 0;
  timer = setInterval(() => {
    syncBadges();
    const analyze = document.querySelector(ANALYZE);
    const batch = Array.isArray(window.__batchAnalysis) ? window.__batchAnalysis : [];
    const finished = batch.length > 0 && analyze?.disabled === false;
    const resolved = finished && batch.every(a => a?.error || a?.signatureCount != null || a?.signatureError);
    if (resolved || ++ticks > 1200) {
      clearInterval(timer);
      timer = null;
      syncBadges();
    }
  }, 100);
}

function wire() {
  ensureStyle();
  const table = document.querySelector(TABLE);
  if (table) {
    const observer = new MutationObserver(() => queueMicrotask(syncBadges));
    observer.observe(table, { childList: true, subtree: true });
  }
  document.querySelector(ANALYZE)?.addEventListener('click', watchAfterAnalyze);
  syncBadges();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
else wire();
