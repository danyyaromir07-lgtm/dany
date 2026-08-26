// Versioned bridge: preserve v67 WinAnsi-first behavior, then call segmented v4 directly.
import { editDoc as segmentedEditDoc } from './text-editor-v65-safe-font-fallback-v4-segmented.js?v=20260826-segmentedfont1';
import { editSimpleWinAnsiDirect } from './text-winansi-direct-v2.js?v=20260821-pdfnull1';

export function editDoc(doc,find,replace){
  let count=0;
  try{count+=Number(editSimpleWinAnsiDirect(doc,find,replace)||0)}catch(_){/* segmented v4 still gets a chance */}
  try{count+=Number(segmentedEditDoc(doc,find,replace)||0)}catch(err){if(!count)throw err}
  return count;
}
if(typeof window!=='undefined')window.__textEditorV67={version:'67+direct-segmented-v4-1'};
