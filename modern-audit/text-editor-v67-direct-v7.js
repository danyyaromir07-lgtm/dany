// Versioned bridge: preserve v67 WinAnsi-first behavior, then use structural v6 + TJ spacing v7.
import { editDoc as structuralEditDoc } from './text-editor-v65-safe-font-fallback-v7-tjspacing.js?v=20260826-tjspacing1';
import { editSimpleWinAnsiDirect } from './text-winansi-direct-v2.js?v=20260821-pdfnull1';

export function editDoc(doc,find,replace){
  let count=0;
  try{count+=Number(editSimpleWinAnsiDirect(doc,find,replace)||0)}catch(_){/* v7 still gets a chance */}
  try{count+=Number(structuralEditDoc(doc,find,replace)||0)}catch(err){if(!count)throw err}
  return count;
}
if(typeof window!=='undefined')window.__textEditorV67={version:'67+direct-structural-v7-tjspacing1'};
