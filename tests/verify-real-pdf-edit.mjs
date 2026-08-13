import fs from 'node:fs';
import vm from 'node:vm';
import * as mupdf from 'mupdf';
const source=fs.readFileSync('text-editor-v65.js','utf8').replace(/^import .*?;\n/,'').replace(/export function /g,'function ');
const el=()=>({value:'',files:[],disabled:false,innerHTML:'',textContent:'',classList:{add(){},remove(){},toggle(){}},addEventListener(){},click(){}});
const documentStub={querySelector(){return null;},createElement(){return el();}};
const ctx={console,document:documentStub,mupdf,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,String,Set,Map,Math,Error,URL};
vm.runInNewContext(source+'\nTEST_API={editDoc,flexibleTextKey,findMatches};',ctx);
const {editDoc,flexibleTextKey,findMatches}=ctx.TEST_API;

const variants='OBRA- O03 | OBRA – O03 | OBRA\u00a0O03 | OBRA-O03';
if(findMatches(variants,'OBRA O03').length!==4)throw new Error('expected 4 flexible OBRA matches');
if(flexibleTextKey('OBRA- O03')!=='OBRAO03')throw new Error('hyphen-space normalization failed');
if(flexibleTextKey('OBRA\u00a0O03')!=='OBRAO03')throw new Error('NBSP normalization failed');
if(flexibleTextKey('OBRA – O03')!=='OBRAO03')throw new Error('Unicode dash normalization failed');
if(findMatches('OBRAS O03','OBRA O03').length!==0)throw new Error('matching became fuzzy across real letters');

const fixture='test-pdfs/UP3_LIM_E03_PLA_I59_02_ER_70_A34_7034.pdf';
const input=fs.readFileSync(fixture);
function runCase(needle,replacement,expected){
  const doc=mupdf.PDFDocument.openDocument(input,'application/pdf');
  const edits=editDoc(doc,needle,replacement);
  if(edits!==1)throw new Error(`expected 1 edit for ${JSON.stringify(needle)}, got ${edits}`);
  const out=doc.saveToBuffer('garbage=2,compress=yes').asUint8Array();
  const check=mupdf.PDFDocument.openDocument(out,'application/pdf');
  let saved='';for(let i=0;i<check.countPages();i++)saved+=check.loadPage(i).toStructuredText().asText();
  if(!saved.includes(expected))throw new Error(`saved replacement missing for ${JSON.stringify(needle)}`);
}
runCase('LIM_E03_PLA','LIM_O03_PLA','UP3_LIM_O03_PLA_I59_02_ER_70_A34_7034');
runCase('LIM_E03_PLA','Proyecto Ejecutivo - E03','UP3_Proyecto Ejecutivo - E03_I59_02_ER_70_A34_7034');
console.log('FLEXIBLE_TEXT_V65_OK');
console.log('OBRA_variants=4');
console.log('letters_remain_exact=true');
console.log('stable_real_pdf=true');
