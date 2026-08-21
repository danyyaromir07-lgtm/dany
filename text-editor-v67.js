// Text-only WinAnsi priority with corrected page-resource and PDF-null lookup. No cloud or graphics routing is changed.
import { editDoc as baseEditDoc } from './text-editor-v65.js?v=20260821-textonly-base2';
import { editSimpleWinAnsiDirect } from './text-winansi-direct-v2.js?v=20260821-pdfnull1';
export function editDoc(doc,find,replace){
  let count=0;
  try{count+=Number(editSimpleWinAnsiDirect(doc,find,replace)||0)}catch(_){/* stable v65 still gets a chance */}
  try{count+=Number(baseEditDoc(doc,find,replace)||0)}catch(err){if(!count)throw err}
  return count;
}
if(typeof window!=='undefined')window.__textEditorV67={version:'67+winansi-pdfnull1'};
