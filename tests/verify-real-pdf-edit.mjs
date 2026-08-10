import fs from 'node:fs';
import vm from 'node:vm';
import * as mupdf from 'mupdf';
const source=fs.readFileSync('text-editor-v63.js','utf8').replace(/^import .*?;\n/,'');
const el=()=>({value:'',files:[],disabled:false,innerHTML:'',textContent:'',classList:{add(){},remove(){},toggle(){}},addEventListener(){},click(){}});
const documentStub={querySelector(){return el();},createElement(){return el();}};
const ctx={console,document:documentStub,mupdf,TextEncoder,TextDecoder,Uint8Array,String,Set,Map,Math,Error,URL};
vm.runInNewContext(source+'\nTEST_API={editDoc};',ctx);
const {editDoc}=ctx.TEST_API;
const fixture='test-pdfs/UP3_LIM_E03_PLA_I59_02_ER_70_A34_7034.pdf';
const input=fs.readFileSync(fixture);
function runCase(needle,replacement,expected){
  const doc=mupdf.PDFDocument.openDocument(input,'application/pdf');
  const edits=editDoc(doc,needle,replacement);
  if(edits!==1)throw new Error(`expected 1 edit for ${JSON.stringify(needle)}, got ${edits}`);
  let text='';for(let i=0;i<doc.countPages();i++)text+=doc.loadPage(i).toStructuredText().asText();
  if(!text.includes(expected))throw new Error(`replacement not extractable for ${JSON.stringify(needle)}`);
  if(text.includes(needle))throw new Error(`original still extractable for ${JSON.stringify(needle)}`);
  const out=doc.saveToBuffer('garbage=2,compress=yes').asUint8Array();
  const check=mupdf.PDFDocument.openDocument(out,'application/pdf');
  let saved='';for(let i=0;i<check.countPages();i++)saved+=check.loadPage(i).toStructuredText().asText();
  if(!saved.includes(expected))throw new Error(`saved replacement not extractable for ${JSON.stringify(needle)}`);
  if(saved.includes(needle))throw new Error(`saved original still extractable for ${JSON.stringify(needle)}`);
  console.log(`CASE_OK=${needle}->${replacement}`);
}
runCase('LIM_E03_PLA','LIM_O03_PLA','UP3_LIM_O03_PLA_I59_02_ER_70_A34_7034');
runCase('LIM_E03_PLA','Proyecto Ejecutivo - E03','UP3_Proyecto Ejecutivo - E03_I59_02_ER_70_A34_7034');
runCase('P.Ejecutivo - E03','Proyecto Ejecutivo - E03','Proyecto Ejecutivo - E03');
console.log('ALL_OFFICIAL_FIXTURE_CASES_OK');
