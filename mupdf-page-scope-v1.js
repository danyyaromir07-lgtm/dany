// Apply-only MuPDF page lifetime guard. Search/edit behavior stays unchanged.
import { editDoc as baseEditDoc } from './text-editor-v65.js?v=20260818-graystable-pagesafe1';
import { editTextByPageSearch as basePageSearch } from './text-pdf-search-fallback-v1.js?v=20260818-graystable-pagesafe1';

function withScopedPages(doc, fn) {
  let lastPage = null;
  const scoped = new Proxy(doc, {
    get(target, prop) {
      if (prop === 'loadPage') {
        return (index) => {
          try { lastPage?.destroy?.(); } catch (_) {}
          lastPage = target.loadPage(index);
          return lastPage;
        };
      }
      const value = target[prop];
      return typeof value === 'function' ? value.bind(target) : value;
    }
  });
  try {
    return fn(scoped);
  } finally {
    try { lastPage?.destroy?.(); } catch (_) {}
    lastPage = null;
  }
}

export function editDocScoped(doc, find, replace) {
  return withScopedPages(doc, (scoped) => baseEditDoc(scoped, find, replace));
}

export function editTextByPageSearchScoped(doc, find, replace, maxHits) {
  return withScopedPages(doc, (scoped) => basePageSearch(scoped, find, replace, maxHits));
}
