const TABLE = '#batchTable';
const ANALYZE = '#batchAnalyze';
const APPLY = '#batchApply';
const STYLE_ID = 'revision-cloud-results-inline-style';
let timer = null;

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    /* The old aggregate location box is superseded by per-file result lines. */
    #revisionCloudLocationBox { display: none !important; }
    #batchTable .batch-cloud-inline,
    #batchTable .batch-titleblock-inline {
      display: block;
      line-height: 1.35;
      overflow-wrap: anywhere;
    }
    #batchTable .batch-cloud-inline { color: #4f5c70; }
    #batchTable .batch-cloud-inline[data-cloud-state="candidate"] { color: #8a6727; }
    #batchTable .batch-cloud-inline[data-cloud-state="confirmed"],
    #batchTable .batch-cloud-inline[data-cloud-state="applied"] { color: #23724a; }
    #batchTable .batch-cloud-inline[data-cloud-state="discarded"] { color: #667084; }
    #batchTable .batch-titleblock-inline { color: #6557a6; }
  `;
  document.head.appendChild(style);
}

function cloudInfo(item) {
  const pages = Array.isArray(item?.revisionClouds)
    ? item.revisionClouds
        .filter((p) => Array.isArray(p?.clouds) && p.clouds.length)
        .map((p) => ({ page: Number(p.page), count: p.clouds.length, clouds: p.clouds }))
        .filter((p) => Number.isFinite(p.page) && p.page > 0)
    : [];
  const total = pages.reduce((sum, p) => sum + p.count, 0);
  const clouds = pages.flatMap((p) => p.clouds);
  const exact = total > 0 && clouds.length === total && clouds.every((cloud) => {
    const source = String(cloud?.source || '');
    return source === 'vector-family' || source === 'vector-family-multi' || !!cloud?.vectorFamilyKey || Array.isArray(cloud?.exactRGB);
  });
  return { total, pages, exact };
}

function titleBlockCount(item) {
  let total = 0;
  for (const rule of item?.counts || []) {
    for (const match of rule?.ocrMatches || []) if (match?.titleBlockFallback) total++;
  }
  return total;
}

function pageLabel(pages) {
  if (!pages.length) return '';
  if (pages.length === 1) return `pág. ${pages[0].page}`;
  return `págs. ${pages.map((p) => `${p.page} (${p.count})`).join(', ')}`;
}

function cloudState(item, cloud) {
  const applied = Math.max(0, Number(item?.revisionCloudApplied || 0));
  const validated = Array.isArray(item?.revisionCloudStreamDetails) && item.revisionCloudStreamDetails.length > 0;
  if (applied > 0) return { state: 'applied', applied };
  if (validated && cloud.total > 0) return { state: 'discarded', applied: 0 };
  if (cloud.exact) return { state: 'confirmed', applied: 0 };
  return { state: 'candidate', applied: 0 };
}

function cloudText(item, cloud) {
  const where = pageLabel(cloud.pages);
  const location = where ? ` · ${where}` : '';
  const info = cloudState(item, cloud);
  if (info.state === 'applied') {
    return {
      state: info.state,
      text: `✅ ${info.applied} nube${info.applied === 1 ? '' : 's'} eliminada${info.applied === 1 ? '' : 's'} de forma segura${location}`
    };
  }
  if (info.state === 'discarded') {
    return {
      state: info.state,
      text: `✓ ${cloud.total} candidata${cloud.total === 1 ? '' : 's'} descartada${cloud.total === 1 ? '' : 's'} · no se eliminaron${location}`
    };
  }
  if (info.state === 'confirmed') {
    return {
      state: info.state,
      text: `✅ ${cloud.total} nube${cloud.total === 1 ? '' : 's'} confirmada${cloud.total === 1 ? '' : 's'} · familia vectorial exacta${location}`
    };
  }
  return {
    state: info.state,
    text: `⚠️ ${cloud.total} candidata${cloud.total === 1 ? '' : 's'} a nube${cloud.total === 1 ? '' : 's'} · validación segura pendiente${location} · si no se valida, no se elimina`
  };
}

function itemIndex(row) {
  const button = row.querySelector('.bpreview[data-idx]');
  const idx = Number(button?.dataset?.idx);
  return Number.isInteger(idx) && idx >= 0 ? idx : -1;
}

function updateRow(row, item) {
  const hitWrap = row.querySelector('.batch-hit-lines');
  if (!hitWrap || !item || item.error) return;

  let cloudLine = hitWrap.querySelector('.batch-cloud-inline');
  const cloud = cloudInfo(item);
  if (cloud.total > 0) {
    if (!cloudLine) {
      cloudLine = document.createElement('span');
      cloudLine.className = 'batch-cloud-inline';
      hitWrap.appendChild(cloudLine);
    }
    const display = cloudText(item, cloud);
    cloudLine.dataset.cloudState = display.state;
    cloudLine.textContent = display.text;
  } else cloudLine?.remove();

  let titleLine = hitWrap.querySelector('.batch-titleblock-inline');
  const cartela = titleBlockCount(item);
  if (cartela > 0) {
    if (!titleLine) {
      titleLine = document.createElement('span');
      titleLine.className = 'batch-titleblock-inline';
      hitWrap.appendChild(titleLine);
    }
    titleLine.textContent = `🧾 Cartela · ${cartela} coincidencia${cartela === 1 ? '' : 's'}`;
  } else titleLine?.remove();
}

function refresh() {
  ensureStyle();
  const batch = Array.isArray(window.__batchAnalysis) ? window.__batchAnalysis : [];
  const table = document.querySelector(TABLE);
  if (!table || !batch.length) return;
  table.querySelectorAll('.batch-result').forEach((row) => {
    const idx = itemIndex(row);
    if (idx >= 0) updateRow(row, batch[idx]);
  });
}

function startWatch() {
  if (timer) clearInterval(timer);
  let ticks = 0;
  refresh();
  timer = setInterval(() => {
    refresh();
    if (++ticks >= 300) {
      clearInterval(timer);
      timer = null;
    }
  }, 1000);
}

function wire() {
  ensureStyle();
  document.querySelector(ANALYZE)?.addEventListener('click', startWatch);
  document.querySelector(APPLY)?.addEventListener('click', startWatch);
  startWatch();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
else wire();
