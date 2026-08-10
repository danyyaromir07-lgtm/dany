import fs from 'node:fs';
import vm from 'node:vm';
import * as mupdf from 'mupdf';
const source=fs.readFileSync('text-editor-v63.js','utf8').replace(/^import .*?;\n/,'');
const el=()=>({value:'',files:[],disabled:false,innerHTML:'',textContent:'',classList:{add(){},remove(){},toggle(){}},addEventListener(){},click(){}});
const documentStub={querySelector(){return el();},createElement(){return el();}};
const ctx={console,document:documentStub,mupdf,TextEncoder,TextDecoder,Uint8Array,String,Set,Map,Math,Error,URL};
vm.runInNewContext(source+'\nTEST_API={editDoc,toks,A,getFontMap,decodeToken};',ctx);
const {editDoc,toks,A,getFontMap,decodeToken}=ctx.TEST_API;
const fixture='test-pdfs/UP3_LIM_E03_PLA_I59_02_ER_70_A34_7034.pdf',needle='LIM_E03_PLA',replacement='LIM_O03_PLA',expected='UP3_LIM_O03_PLA_I59_02_ER_70_A34_7034';
const doc=mupdf.PDFDocument.openDocument(fs.readFileSync(fixture),'application/pdf'),page=doc.loadPage(0),co=page.getObject().get('Contents'),u=co.readStream().asUint8Array();
const tokens=toks(u),segments=[]; let font=null;
for(let i=0;i<tokens.length;i++){
  const t=tokens[i],w=t.type==='word'?A(t.raw):'';
  if(w==='Tf'){const n=tokens[i-2];if(n?.type==='name')font=A(n.raw).slice(1);continue;}
  if(w!=='Tj'&&w!=='TJ'||!font)continue;
  const c=getFontMap(page,font); if(!c)continue;
  if(w==='Tj'){const s=tokens[i-1];if(s?.type==='string')segments.push({text:decodeToken(s,c),tok:s,font});}
  else {const ar=tokens[i-1];if(ar?.type==='array')for(const s of ar.items)if(s.type==='string')segments.push({text:decodeToken(s,c),tok:s,font});}
}
const reconstructed=segments.map(x=>x.text).join(''), at=reconstructed.indexOf(needle);
console.log(`segments=${segments.length} reconstructed_len=${reconstructed.length} needle_in_reconstructed=${at>=0} at=${at}`);
if(at>=0){let cur=0;for(let i=0;i<segments.length;i++){const s=segments[i];if(cur+s.text.length>at-8&&cur<at+needle.length+8)console.log(`seg_${i}=${JSON.stringify(s.text)} font=${s.font}`);cur+=s.text.length;}}
console.log(`text_before=${page.toStructuredText().asText().includes('UP3_LIM_E03_PLA_I59_02_ER_70_A34_7034')}`);
const edits=editDoc(doc,needle,replacement);console.log(`edits=${edits}`);if(edits!==1)throw new Error(`expected exactly 1 edit, got ${edits}`);if(!page.toStructuredText().asText().includes(expected))throw new Error('replacement not extractable');console.log('REAL_PDF_EDIT_OK');
