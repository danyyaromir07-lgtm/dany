import { editTextByPageSearch as baseEditTextByPageSearch } from './text-pdf-search-fallback-v1.js?v=20260821-clean1';

export function editTextByPageSearch(doc,find,replace,maxHits=50){
  return Number(baseEditTextByPageSearch(doc,find,replace,maxHits)||0);
}
if(typeof window!=='undefined')window.__textFallbackDiagnostic={version:'2+clean-pass-through1'};
