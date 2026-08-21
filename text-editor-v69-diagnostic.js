import { editDoc as baseEditDoc } from './text-editor-v68.js?v=20260821-clean1';

export function editDoc(doc,find,replace){
  return Number(baseEditDoc(doc,find,replace)||0);
}
if(typeof window!=='undefined')window.__textEditorV69={version:'69+clean-pass-through1'};
