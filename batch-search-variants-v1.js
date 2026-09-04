import * as mupdf from 'https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js';

const DASHES = /[‐‑‒–—−]/g;
const FLEX_SEP = /[\s\u00a0\u2000-\u200b\u2028\u2029\u202f\u205f\u3000‐‑‒–—−-]/gu;
const FLAG = '__batchSearchVariantsInstalledV1';

function variantKey(value) {
  return String(value || '')
    .normalize('NFC')
    .replace(DASHES, '-')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function flexibleKey(value) {
  return String(value || '').normalize('NFC').replace(FLEX_SEP, '');
}

function countFlexible(text, target) {
  const source = flexibleKey(text);
  const wanted = flexibleKey(target);
  if (!wanted) return 0;
  let count = 0;
  let pos = 0;
  while ((pos = source.indexOf(wanted, pos)) >= 0) {
    count++;
    pos += Math.max(1, wanted.length);
  }
  return count;
}

function currentRules() {
  const out = [];
  const seen = new Set();
  document.querySelectorAll('#batchRows .bfind').forEach((input) => {
    const find = String(input.value || '').trim();
    if (!find) return;
    const id = input.dataset.id;
    const replaceInput = id ? document.querySelector(`#batchRows .brepl[data-id="${CSS.escape(id)}"]`) : null;
    const replace = String(replaceInput?.value ?? '');
    const key = variantKey(find);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push({ find, replace, key });
  });
  return out;
}

function pageText(page) {
  try {
    return page.toStructuredText('preserve-spans').asText();
  } catch (_) {
    return '';
  }
}

function augmentItem(item, rules) {
  if (!item || item.error || item.memorySafeAnalysis === true || !item.data || !Array.isArray(item.counts)) return 0;
  const existing = new Set(item.counts.map((rule) => variantKey(rule?.find)).filter(Boolean));
  const missing = rules.filter((rule) => !existing.has(rule.key));
  if (!missing.length) return 0;

  let doc = null;
  let addedRules = 0;
  try {
    doc = mupdf.PDFDocument.openDocument(new Uint8Array(item.data), 'application/pdf');
    const texts = [];
    for (let pageIndex = 0; pageIndex < doc.countPages(); pageIndex++) {
      texts.push(pageText(doc.loadPage(pageIndex)));
    }

    for (const rule of missing) {
      let count = 0;
      const pages = [];
      for (let pageIndex = 0; pageIndex < texts.length; pageIndex++) {
        const hits = countFlexible(texts[pageIndex], rule.find);
        if (hits) {
          count += hits;
          pages.push(pageIndex + 1);
        }
      }
      if (!count) continue;
      item.counts.push({
        find: rule.find,
        replace: rule.replace,
        count,
        annotationCount: 0,
        ocrCount: 0,
        ocrMatches: [],
        pages,
        annotationPages: [],
        reinforcedVariant: true
      });
      existing.add(rule.key);
      addedRules++;
    }
  } catch (error) {
    console.warn('[batch-search-variants]', item?.name, error);
  } finally {
    try { doc?.destroy(); } catch (_) {}
  }
  return addedRules;
}

function augmentBatch(value) {
  if (!Array.isArray(value) || !value.length) return;
  const rules = currentRules();
  if (!rules.length) return;
  let files = 0;
  let rulesAdded = 0;
  let skippedMemorySafe = 0;
  for (const item of value) {
    if (item?.memorySafeAnalysis === true) { skippedMemorySafe++; continue; }
    const added = augmentItem(item, rules);
    if (added) files++;
    rulesAdded += added;
  }
  window.__batchSearchVariants = { files, rulesAdded, skippedMemorySafe };
}

function install() {
  if (window[FLAG]) return;
  const previous = Object.getOwnPropertyDescriptor(window, '__batchAnalysis');
  let localValue = previous?.get ? undefined : window.__batchAnalysis;

  try {
    Object.defineProperty(window, '__batchAnalysis', {
      configurable: true,
      enumerable: previous?.enumerable ?? true,
      get() {
        return previous?.get ? previous.get.call(window) : localValue;
      },
      set(value) {
        if (previous?.set) previous.set.call(window, value);
        else localValue = value;
        try { augmentBatch(value); } catch (error) { console.warn('[batch-search-variants]', error); }
      }
    });
    window[FLAG] = true;
    const current = previous?.get ? previous.get.call(window) : localValue;
    if (Array.isArray(current) && current.length) augmentBatch(current);
  } catch (error) {
    console.warn('[batch-search-variants] no se pudo instalar', error);
  }
}

setTimeout(install, 0);
