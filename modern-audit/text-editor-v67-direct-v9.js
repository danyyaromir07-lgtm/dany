// Versioned bridge: preserve WinAnsi-first behavior, then v9 Device-glyph fallback stack.
import { editDoc as structuralEditDoc } from './text-editor-v65-safe-font-fallback-v9-device-glyph.js?v=20260827-deviceglyph-editor1';
import { editSimpleWinAnsiDirect } from './text-winansi-direct-v2.js?v=20260821-pdfnull1';
export function editDoc(doc,find,replace){let count=0;try{count+=Number(editSimpleWinAnsiDirect(doc,find,replace)||0)}catch(_){}try{count+=Number(structuralEditDoc(doc,find,replace)||0)}catch(err){if(!count)throw err}return count}
if(typeof window!=='undefined')window.__textEditorV67={version:'67+direct-device-glyph-v9-1'};
