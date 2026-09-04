// Performance rollback bridge: preserve v67 behavior without forcing segmented v4.
import { editDoc as baseEditDoc } from './text-editor-v65-safe-font-fallback-v3.js?v=20260826-compatiblefont1-internal';
import { editSimpleWinAnsiDirect } from './text-winansi-direct-v2.js?v=20260821-pdfnull1';

export function editDoc(doc,find,replace){
  let count=0;
  try{count+=Number(editSimpleWinAnsiDirect(doc,find,replace)||0)}catch(_){/* v3 still gets a chance */}
  try{count+=Number(baseEditDoc(doc,find,replace)||0)}catch(err){if(!count)throw err}
  return count;
}
if(typeof window!=='undefined')window.__textEditorV67={version:'67+rollback-v3-1'};
