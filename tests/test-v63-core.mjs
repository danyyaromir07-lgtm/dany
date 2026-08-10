import fs from 'node:fs';
import vm from 'node:vm';
import * as mupdf from 'mupdf';

const source = fs.readFileSync('text-editor-v63.js', 'utf8').replace(/^import .*?;\n/, '');
const el = () => ({ value: '', files: [], disabled: false, innerHTML: '', textContent: '', classList: { add(){}, remove(){}, toggle(){} }, addEventListener(){}, click(){} });
const documentStub = { querySelector(){ return el(); }, createElement(){ return el(); } };
const ctx = { console, document: documentStub, mupdf, TextEncoder, Uint8Array, String, Set, Map, Math, Error };
vm.runInNewContext(source + '\nTEST_API={toks,decodeToken,encodeText,editStream,editDoc};', ctx);

const pdfPath = 'test-pdfs/UP3_LIM_E03_PLA_I59_02_ER_70_A34_7034.pdf';
const needle = 'LIM_E03_PLA';
const replacement = 'LIM_O03_PLA';
const input = new Uint8Array(fs.readFileSync(pdfPath));
const doc = mupdf.PDFDocument.openDocument(input, 'application/pdf');
const count = ctx.TEST_API.editDoc(doc, needle, replacement);
if (count !== 1) throw new Error(`expected exactly 1 edit in official fixture, got ${count}`);
const output = doc.saveToBuffer('garbage=2,compress=yes').asUint8Array();
fs.writeFileSync('test-pdfs/_v63_result.pdf', Buffer.from(output));
doc.destroy();

console.log('V63_OFFICIAL_FIXTURE_EDIT_OK');
console.log('input=', pdfPath);
console.log('needle=', needle);
console.log('replacement=', replacement);
console.log('edits=', count);
console.log('output=test-pdfs/_v63_result.pdf');
