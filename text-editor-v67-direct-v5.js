// Versioned bridge: preserve v67 WinAnsi-first behavior, then use transactional v5.
import { editDoc as transactionalEditDoc } from './text-editor-v65-safe-font-fallback-v5-transactional.js?v=20260826-transactional1';
import { editSimpleWinAnsiDirect } from './text-winansi-direct-v2.js?v=20260821-pdfnull1';

export function editDoc(doc,find,replace){
  let count=0;
  try{count+=Number(editSimpleWinAnsiDirect(doc,find,replace)||0)}catch(_){/* transactional v5 still gets a chance */}
  try{count+=Number(transactionalEditDoc(doc,find,replace)||0)}catch(err){if(!count)throw err}
  return count;
}
if(typeof window!=='undefined')window.__textEditorV67={version:'67+direct-transactional-v5-1'};
