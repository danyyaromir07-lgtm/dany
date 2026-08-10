import fs from 'node:fs';
import vm from 'node:vm';
import * as mupdf from 'mupdf';

const source = fs.readFileSync('text-editor-v63.js', 'utf8').replace(/^import .*?;\n/, '');
const el = () => ({ value: '', files: [], disabled: false, innerHTML: '', textContent: '', classList: { add(){}, remove(){}, toggle(){} }, addEventListener(){}, click(){} });
const documentStub = { querySelector(){ return el(); }, createElement(){ return el(); } };
const ctx = { console, document: documentStub, mupdf, TextEncoder, TextDecoder, Uint8Array, String, Set, Map, Math, Error, URL };
vm.runInNewContext(source + '\nTEST_API={editDoc,resolve,toks,A,getFontMap,decodeToken};', ctx);
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
const resolved = resolve(co);
console.log(`page_object_string=${String(po)}`);
console.log(`contents=${String(co)}`);
console.log(`contents_isArray=${!!co?.isArray?.()}`);
console.log(`contents_isStream=${!!co?.isStream?.()}`);
console.log(`resolved=${String(resolved)}`);
console.log(`resolved_isArray=${!!resolved?.isArray?.()}`);
console.log(`resolved_isStream=${!!resolved?.isStream?.()}`);
if (resolved?.isArray?.()) {
  console.log(`resolved_length=${resolved.length}`);
  for (let i=0;i<resolved.length;i++) {
    const ref=resolved.get(i), st=resolve(ref);
    console.log(`item_${i}=${String(ref)} item_stream=${!!st?.isStream?.()} item_bytes=${st?.isStream?.()?st.readStream().length:0}`);
    if (st?.isStream?.()) { const raw=A(st.readStream()); console.log(`item_${i}_has_BT=${raw.includes('BT')} has_R12=${raw.includes('/R12')} has_TJ=${raw.includes('TJ')}`); const p=raw.indexOf('BT'); if(p>=0) console.log(`item_${i}_excerpt=${JSON.stringify(raw.slice(p,p+800))}`); }
  }
} else if (resolved?.isStream?.()) {
  const raw=A(resolved.readStream()); console.log(`resolved_bytes=${raw.length} has_BT=${raw.includes('BT')} has_R12=${raw.includes('/R12')} has_TJ=${raw.includes('TJ')}`); const p=raw.indexOf('BT'); if(p>=0) console.log(`resolved_excerpt=${JSON.stringify(raw.slice(p,p+800))}`);
}
console.log(`text_before=${page.toStructuredText().asText().includes('UP3_LIM_E03_PLA_I59_02_ER_70_A34_7034')}`);
const edits = editDoc(doc, needle, replacement);
console.log(`edits=${edits}`);
if (edits !== 1) throw new Error(`expected exactly 1 edit, got ${edits}`);
const textAfter = page.toStructuredText().asText();
if (!textAfter.includes(expected)) throw new Error('replacement not extractable');
console.log('REAL_PDF_EDIT_OK');
