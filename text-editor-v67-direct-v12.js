// Versioned bridge: preserve stable direct behavior and add FillSign object-scan empty replacement v12.
import { editDoc as safeEditDoc } from './text-editor-v65-safe-font-fallback-v12-fillsign-empty.js?v=20260828-fillsignobject1';
import { editSimpleWinAnsiDirect } from './text-winansi-direct-v2.js?v=20260821-pdfnull1';
export function editDoc(doc,find,replace){let count=0;if(String(replace??'')!==''){try{count+=Number(editSimpleWinAnsiDirect(doc,find,replace)||0)}catch(_){}}try{count+=Number(safeEditDoc(doc,find,replace)||0)}catch(err){if(!count)throw err}return count}
if(typeof window!=='undefined')window.__textEditorV67={version:'67+direct-fillsign-objectscan-v12-1'};
