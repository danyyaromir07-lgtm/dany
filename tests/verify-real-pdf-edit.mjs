import fs from 'node:fs';
import vm from 'node:vm';
import * as mupdf from 'mupdf';
const source=fs.readFileSync('text-editor-v63.js','utf8').replace(/^import .*?;\n/,'');
const el=()=>({value:'',files:[],disabled:false,innerHTML:'',textContent:'',classList:{add(){},remove(){},toggle(){}},addEventListener(){},click(){}});
const documentStub={querySelector(){return el();},createElement(){return el();}};
const ctx={console,document:documentStub,mupdf,TextEncoder,TextDecoder,Uint8Array,String,Set,Map,Math,Error,URL};
vm.runInNewContext(source+'\nTEST_API={editDoc};',ctx);
const {editDoc}=ctx.TEST_API;
const input=fs.readFileSync('test-pdfs/UP3_LIM_E03_PLA_I59_02_ER_70_A34_7034.pdf');
const doc=mupdf.PDFDocument.openDocument(input,'application/pdf');
const p=doc.loadPage(0),t=p.toStructuredText().asText();
console.log(`TEXT_LENGTH=${t.length}`);
for(const q of ['Ejecutivo','P.Ejecutivo','E03','Proyecto']){const at=t.indexOf(q);console.log(`TEXT_SEARCH_${q}=${at}`);if(at>=0)console.log(`TEXT_CONTEXT_${q}=${JSON.stringify(t.slice(Math.max(0,at-250),Math.min(t.length,at+250)))}`)}
const edits=editDoc(doc,'P.Ejecutivo - E03','Proyecto Ejecutivo - E03');
console.log(`P_EJECUTIVO_EDIT_COUNT=${edits}`);
