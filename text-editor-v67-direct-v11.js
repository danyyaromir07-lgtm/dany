// Versioned bridge: preserve stable v10 behavior and add FillSign empty replacement v11.
import { editDoc as safeEditDoc } from './text-editor-v65-safe-font-fallback-v11-fillsign-empty.js?v=20260828-fillsignempty1';
import { editSimpleWinAnsiDirect } from './text-winansi-direct-v2.js?v=20260821-pdfnull1';
export function editDoc(doc,find,replace){let count=0;if(String(replace??'')!==''){try{count+=Number(editSimpleWinAnsiDirect(doc,find,replace)||0)}catch(_){}}try{count+=Number(safeEditDoc(doc,find,replace)||0)}catch(err){if(!count)throw err}return count}
if(typeof window!=='undefined')window.__textEditorV67={version:'67+direct-fillsign-empty-v11-1'};
