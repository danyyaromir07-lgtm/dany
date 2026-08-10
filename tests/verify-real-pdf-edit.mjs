import fs from 'node:fs';
import vm from 'node:vm';
import * as mupdf from 'mupdf';

const source = fs.readFileSync('text-editor-v63.js', 'utf8').replace(/^import .*?;\n/, '');
const el = () => ({ value: '', files: [], disabled: false, innerHTML: '', textContent: '', classList: { add(){}, remove(){}, toggle(){} }, addEventListener(){}, click(){} });
const documentStub = { querySelector(){ return el(); }, createElement(){ return el(); } };
const ctx = { console, document: documentStub, mupdf, TextEncoder, TextDecoder, Uint8Array, String, Set, Map, Math, Error, URL };
vm.runInNewContext(source + '\nTEST_API={editDoc,resolve,toks,A};', ctx);
const { editDoc, resolve, toks, A } = ctx.TEST_API;

const fixture = 'test-pdfs/UP3_LIM_E03_PLA_I59_02_ER_70_A34_7034.pdf';
const needle = 'LIM_E03_PLA';
const replacement = 'LIM_O03_PLA';
const expected = 'UP3_LIM_O03_PLA_I59_02_ER_70_A34_7034';
const input = fs.readFileSync(fixture);
const doc = mupdf.PDFDocument.openDocument(input, 'application/pdf');
const page = doc.loadPage(0);
const po = page.getObject();
const co = po.get('Contents');
console.log(`contents=${String(co)} isStream=${!!co?.isStream?.()} isArray=${!!co?.isArray?.()}`);
const raw = new Uint8Array(co.readStream());
console.log(`stream_bytes=${raw.length}`);
console.log(`has_BT=${A(raw).includes('BT')} has_R12=${A(raw).includes('/R12')} has_TJ=${A(raw).includes('TJ')}`);
const bt=A(raw).indexOf('BT');
console.log(`excerpt=${JSON.stringify(A(raw).slice(bt,bt+1600))}`);
const tokens=toks(raw);
console.log(`token_count=${tokens.length}`);
for(let i=0;i<tokens.length;i++){if(tokens[i].type==='word'&&A(tokens[i].raw)==='Tf') console.log(`TF_${i}=${A(tokens[i-2]?.raw||new Uint8Array())} ${A(tokens[i-1]?.raw||new Uint8Array())} Tf`);if(tokens[i].type==='word'&&A(tokens[i].raw)==='TJ')console.log(`TJ_${i}=prev_${tokens[i-1]?.type} ${JSON.stringify(A(tokens[i-1]?.raw||new Uint8Array()).slice(0,200))}`)}
console.log(`text_before=${page.toStructuredText().asText().includes('UP3_LIM_E03_PLA_I59_02_ER_70_A34_7034')}`);
const edits = editDoc(doc, needle, replacement);
console.log(`edits=${edits}`);
if (edits !== 1) throw new Error(`expected exactly 1 edit, got ${edits}`);
const textAfter = page.toStructuredText().asText();
if (!textAfter.includes(expected)) throw new Error('replacement not extractable');
console.log('REAL_PDF_EDIT_OK');
