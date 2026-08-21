// Text-only additive priority wrapper. No cloud or graphics routing is changed.
import { editDoc as baseEditDoc } from './text-editor-v65.js?v=20260821-textonly-base1';
import { editSimpleWinAnsiDirect } from './text-winansi-direct-v1.js?v=20260821-textonly1';
export function editDoc(doc,find,replace){
  let count=0;
  try{count+=Number(editSimpleWinAnsiDirect(doc,find,replace)||0)}catch(_){/* stable v65 still gets a chance */}
  try{count+=Number(baseEditDoc(doc,find,replace)||0)}catch(err){if(!count)throw err}
  return count;
}
if(typeof window!=='undefined')window.__textEditorV66={version:'66+textonly-winansi-first1'};
