// Versioned bridge: preserve v67 WinAnsi-first behavior, then use v8 embedded TrueType cmap fallback.
import { editDoc as structuralEditDoc } from './text-editor-v65-safe-font-fallback-v8-embedded-cmap.js?v=20260827-embeddedcmap1';
import { editSimpleWinAnsiDirect } from './text-winansi-direct-v2.js?v=20260821-pdfnull1';

export function editDoc(doc,find,replace){
  let count=0;
  try{count+=Number(editSimpleWinAnsiDirect(doc,find,replace)||0)}catch(_){/* v8 still gets a chance */}
  try{count+=Number(structuralEditDoc(doc,find,replace)||0)}catch(err){if(!count)throw err}
  return count;
}
if(typeof window!=='undefined')window.__textEditorV67={version:'67+direct-structural-v8-embeddedcmap1'};
