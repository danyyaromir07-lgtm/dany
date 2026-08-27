// Versioned bridge: preserve WinAnsi-first behavior, then v10 empty-aware Type0 path.
import { editDoc as structuralEditDoc } from './text-editor-v65-safe-font-fallback-v10-empty.js?v=20260827-empty1';
import { editSimpleWinAnsiDirect } from './text-winansi-direct-v2.js?v=20260821-pdfnull1';
export function editDoc(doc,find,replace){let count=0;try{count+=Number(editSimpleWinAnsiDirect(doc,find,replace)||0)}catch(_){}try{count+=Number(structuralEditDoc(doc,find,replace)||0)}catch(err){if(!count)throw err}return count}
if(typeof window!=='undefined')window.__textEditorV67={version:'67+direct-empty-v10-1'};
