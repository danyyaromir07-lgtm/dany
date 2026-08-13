const CHECKBOX = '#batchRemoveRevisionClouds';
const ANALYZE = '#batchAnalyze';
const STATUS = '#batchStatus';

const q = (s) => document.querySelector(s);
let timer = null;
let lastSignature = '';

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
  ensureBox();
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
