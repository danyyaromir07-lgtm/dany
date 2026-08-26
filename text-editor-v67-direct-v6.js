// Versioned bridge: preserve v67 WinAnsi-first behavior, then use structural transactional v6.
import { editDoc as structuralEditDoc } from './text-editor-v65-safe-font-fallback-v6-structural.js?v=20260826-structural1';
import { editSimpleWinAnsiDirect } from './text-winansi-direct-v2.js?v=20260821-pdfnull1';

export function editDoc(doc,find,replace){
  let count=0;
  try{count+=Number(editSimpleWinAnsiDirect(doc,find,replace)||0)}catch(_){/* structural v6 still gets a chance */}
  try{count+=Number(structuralEditDoc(doc,find,replace)||0)}catch(err){if(!count)throw err}
  return count;
}
if(typeof window!=='undefined')window.__textEditorV67={version:'67+direct-structural-v6-1'};
