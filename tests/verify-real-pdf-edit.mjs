import fs from 'node:fs';
import vm from 'node:vm';
import * as mupdf from 'mupdf';
const source=fs.readFileSync('text-editor-v63.js','utf8').replace(/^import .*?;\n/,'');
const el=()=>({value:'',files:[],disabled:false,innerHTML:'',textContent:'',classList:{add(){},remove(){},toggle(){}},addEventListener(){},click(){}});
const documentStub={querySelector(){return el();},createElement(){return el();}};
const ctx={console,document:documentStub,mupdf,TextEncoder,TextDecoder,Uint8Array,String,Set,Map,Math,Error,URL};
vm.runInNewContext(source+'\nTEST_API={editDoc,toks,A,getFontMap,decodeToken};',ctx);
const {editDoc}=ctx.TEST_API;
const fixture='test-pdfs/UP3_LIM_E03_PLA_I59_02_ER_70_A34_7034.pdf';
const input=fs.readFileSync(fixture);
const probeDoc=mupdf.PDFDocument.openDocument(input,'application/pdf');
const probeNeedle='P.Ejecutivo - E03';
console.log(`PROBE_PAGE_COUNT=${probeDoc.countPages()}`);
let foundPages=0;
for(let i=0;i<probeDoc.countPages();i++){
  const p=probeDoc.loadPage(i),t=p.toStructuredText().asText();
  if(t.includes(probeNeedle)){foundPages++;console.log(`PROBE_MATCH_PAGE=${i}`);console.log(`PROBE_TEXT_CONTEXT=${JSON.stringify(t.slice(Math.max(0,t.indexOf(probeNeedle)-120),t.indexOf(probeNeedle)+probeNeedle.length+120))}`)}
}
console.log(`PROBE_MATCH_PAGES=${foundPages}`);
if(!foundPages)throw new Error('fixture does not expose P.Ejecutivo - E03 through structured text');
const testDoc=mupdf.PDFDocument.openDocument(input,'application/pdf');
const edits=editDoc(testDoc,probeNeedle,'Proyecto Ejecutivo - E03');
console.log(`PROBE_EDIT_COUNT=${edits}`);
const after=[];for(let i=0;i<testDoc.countPages();i++)after.push(testDoc.loadPage(i).toStructuredText().asText());
const joined=after.join('\n');
if(!joined.includes('Proyecto Ejecutivo - E03'))throw new Error('P.Ejecutivo replacement not extractable');
if(joined.includes(probeNeedle))throw new Error('original P.Ejecutivo text remains extractable');
console.log('P_EJECUTIVO_EDIT_OK');
