const ANALYZE = '#batchAnalyze';
const OCR = '#batchEnableOCR';
const STATUS = '#batchStatus';
const DIAG = '#ocrDiagLog';
const BANNER_ID = 'batchCheckCompletion';

let runToken = 0;
let timer = null;

function longCodeKey(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '').replace(/o/g, '0').replace(/i/g, '1');
}
function isLongDrawingCode(s) {
  const raw = String(s || '').trim();
  const parts = raw.split('_').filter(Boolean);
  const key = longCodeKey(raw);
  return raw.includes('_') && key.length >= 20 && key.length <= 90 && parts.length >= 5 && parts.every(part => /^[A-Za-z0-9.-]+$/.test(part));
}
function hasLongDrawingCode(batch) {
  return (batch || []).some(item => (item?.counts || []).some(rule => isLongDrawingCode(rule?.find)));
}
function ensureBanner() {
  let banner = document.getElementById(BANNER_ID);
  if (banner) return banner;
  banner = document.createElement('div');
  banner.id = BANNER_ID;
  banner.setAttribute('role', 'status');
  banner.setAttribute('aria-live', 'polite');
  Object.assign(banner.style, {
    display: 'none',
    marginTop: '10px',
    padding: '12px 14px',
    borderRadius: '10px',
    border: '1px solid rgba(80,80,80,.22)',
    fontWeight: '700',
    lineHeight: '1.35',
  });
  const status = document.querySelector(STATUS);
  if (status?.parentNode) status.insertAdjacentElement('afterend', banner);
  return banner;
}
function setBanner(mode, title, detail) {
  const banner = ensureBanner();
  if (!banner) return;
  banner.style.display = 'block';
  if (mode === 'done') {
    banner.style.background = 'rgba(34,197,94,.11)';
    banner.style.borderColor = 'rgba(34,197,94,.38)';
  } else {
    banner.style.background = 'rgba(245,158,11,.11)';
    banner.style.borderColor = 'rgba(245,158,11,.42)';
  }
  banner.innerHTML = `<div>${title}</div><div style="font-weight:500;font-size:.9rem;margin-top:3px;opacity:.82">${detail}</div>`;
}
function startCompletionWatch(token, previous) {
  if (timer) clearInterval(timer);
  let baseDoneAt = 0;
  let lastDiag = String(document.querySelector(DIAG)?.textContent || '');
  let lastDiagChange = Date.now();
  let doneShown = false;

  timer = setInterval(() => {
    if (token !== runToken) {
      clearInterval(timer);
      return;
    }
    const button = document.querySelector(ANALYZE);
    const batch = Array.isArray(window.__batchAnalysis) ? window.__batchAnalysis : [];
    const diagText = String(document.querySelector(DIAG)?.textContent || '');
    if (diagText !== lastDiag) {
      lastDiag = diagText;
      lastDiagChange = Date.now();
    }

    const baseDone = !!button && !button.disabled && batch.length > 0;
    if (!baseDone) {
      baseDoneAt = 0;
      setBanner('busy', '⏳ COMPROBACIÓN EN CURSO', 'Analizando el PDF. Espera a la confirmación verde antes de dar los resultados por definitivos.');
      return;
    }
    if (!baseDoneAt) baseDoneAt = Date.now();

    const ocrEnabled = document.querySelector(OCR)?.checked === true;
    if (ocrEnabled && hasLongDrawingCode(batch)) {
      const horizontalDone = !!window.__longTitleBlockOCR && window.__longTitleBlockOCR !== previous.long && Number(window.__longTitleBlockOCR?.version) === 5;
      const verticalDone = !!window.__longTitleBlockVerticalOCR && window.__longTitleBlockVerticalOCR !== previous.vertical && Number(window.__longTitleBlockVerticalOCR?.version) === 1;
      const legacyDone = !!window.__longTitleBlockVerticalLegacyOCR && window.__longTitleBlockVerticalLegacyOCR !== previous.legacy && Number(window.__longTitleBlockVerticalLegacyOCR?.version) === 1;
      if (!horizontalDone) {
        setBanner('busy', '⏳ COMPROBACIÓN ADAPTATIVA EN CURSO', 'Análisis base terminado · comprobando OCR de código completo horizontal…');
        return;
      }
      if (!verticalDone) {
        setBanner('busy', '⏳ COMPROBACIÓN ADAPTATIVA EN CURSO', 'OCR horizontal terminado · comprobando ahora las orientaciones verticales…');
        return;
      }
      if (!legacyDone) {
        setBanner('busy', '⏳ COMPROBACIÓN ADAPTATIVA EN CURSO', 'OCR vertical principal terminado · realizando la comprobación vertical final…');
        return;
      }
    } else if (ocrEnabled) {
      const statusText = String(document.querySelector(STATUS)?.textContent || '');
      const looksActive = /(cargando|procesando|reconociendo|ocr\b|analizando)/i.test(statusText) && !/(terminad|finaliz|complet)/i.test(statusText);
      const quietEnough = Date.now() - lastDiagChange >= 1800;
      const baseSettled = Date.now() - baseDoneAt >= 1200;
      if (looksActive || !quietEnough || !baseSettled) {
        setBanner('busy', '⏳ COMPROBACIÓN ADAPTATIVA EN CURSO', 'El análisis base terminó, pero todavía quedan comprobaciones OCR/adaptativas.');
        return;
      }
    } else if (Date.now() - baseDoneAt < 500) {
      return;
    }

    if (!doneShown) {
      doneShown = true;
      setBanner('done', '✅ COMPROBACIÓN COMPLETA', 'Todas las comprobaciones de esta ejecución han terminado. Ya puedes confiar en los resultados y abrir Preview o Aplicar.');
    }
    clearInterval(timer);
  }, 250);
}

document.querySelector(ANALYZE)?.addEventListener('click', () => {
  runToken++;
  const token = runToken;
  const previous = {
    long: window.__longTitleBlockOCR,
    vertical: window.__longTitleBlockVerticalOCR,
    legacy: window.__longTitleBlockVerticalLegacyOCR,
  };
  setBanner('busy', '⏳ COMPROBACIÓN EN CURSO', 'No des por definitivos los resultados hasta que aparezca “✅ COMPROBACIÓN COMPLETA”.');
  startCompletionWatch(token, previous);
}, true);

ensureBanner();
