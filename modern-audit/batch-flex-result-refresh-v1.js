// Synchronize the visible batch result rows with the full-page flexible-text analysis.
// This module does not count or edit PDF content. It only asks the existing result-line
// renderer to rebuild rows after flex-text-analysis-v1 has augmented window.__batchAnalysis.
const ANALYZE = '#batchAnalyze';
let timer = null;

function refresh() {
  try { window.__refreshBatchResultLines?.(); } catch (_) {}
}

function startRefreshWindow() {
  if (timer) clearInterval(timer);
  let ticks = 0;
  refresh();
  timer = setInterval(() => {
    refresh();
    if (++ticks >= 50) {
      clearInterval(timer);
      timer = null;
    }
  }, 100);
}

document.querySelector(ANALYZE)?.addEventListener('click', startRefreshWindow);
