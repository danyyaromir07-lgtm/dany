import fs from 'node:fs';
import vm from 'node:vm';
import * as mupdf from 'mupdf';

const source = fs.readFileSync('text-editor-v63.js', 'utf8').replace(/^import .*?;\n/, '');
const el = () => ({ value: '', files: [], disabled: false, innerHTML: '', textContent: '', classList: { add(){}, remove(){}, toggle(){} }, addEventListener(){}, click(){} });
const documentStub = { querySelector(){ return el(); }, createElement(){ return el(); } };
const ctx = { console, document: documentStub, mupdf, TextEncoder, TextDecoder, Uint8Array, String, Set, Map, Math, Error, URL };
vm.runInNewContext(source + '\nTEST_API={editDoc,resolve,toks,A,getFontMap,decodeToken};', ctx);
const { editDoc, resolve, toks, A, getFontMap, decodeToken } = ctx.TEST_API;

const fixture = 'test-pdfs/UP3_LIM_E03_PLA_I59_02_ER_70_A34_7034.pdf';
const needle = 'LIM_E03_PLA';
const replacement = 'LIM_O03_PLA';
const expected = 'UP3_LIM_O03_PLA_I59_02_ER_70_A34_7034';

const input = fs.readFileSync(fixture);
const doc = mupdf.PDFDocument.openDocument(input, 'application/pdf');
if (doc.countPages() !== 1) throw new Error(`expected 1 page, got ${doc.countPages()}`);

function pageText(page) { return page.toStructuredText().asText(); }
function pageContents(page) {
  const po = page.getObject();
  const co = po.get('Contents');
  const refs = co?.isArray?.() ? Array.from({length: co.length}, (_, i) => co.get(i)) : (co ? [co] : []);
  return refs.map(ref => { const st = resolve(ref); return st?.isStream?.() ? new Uint8Array(st.readStream()) : null; }).filter(Boolean);
}
function annotationCount(page) {
  const po = page.getObject(); const ann = resolve(po.get('Annots')); return ann?.isArray?.() ? ann.length : 0;
}

const pageBefore = doc.loadPage(0);
const textBefore = pageText(pageBefore);
if (!textBefore.includes('UP3_LIM_E03_PLA_I59_02_ER_70_A34_7034')) throw new Error('fixture does not contain expected original text');
const beforeStreams = pageContents(pageBefore);
const beforeAnnots = annotationCount(pageBefore);

console.log(`fixture_text_found=${textBefore.includes('UP3_LIM_E03_PLA_I59_02_ER_70_A34_7034')}`);
console.log(`content_stream_count=${beforeStreams.length}`);
for (let i=0;i<beforeStreams.length;i++) {
  const raw = A(beforeStreams[i]);
  console.log(`stream_${i}_bytes=${beforeStreams[i].length}`);
  console.log(`stream_${i}_has_BT=${raw.includes('BT')}`);
  console.log(`stream_${i}_has_R12=${raw.includes('/R12')}`);
  console.log(`stream_${i}_has_TJ=${raw.includes('TJ')}`);
  const pos = raw.indexOf('BT');
  if (pos >= 0) console.log(`stream_${i}_BT_excerpt=${JSON.stringify(raw.slice(pos, Math.min(raw.length,pos+1200)))}`);
}
const po = pageBefore.getObject();
const resources = resolve(po.get('Resources'));
const fonts = resolve(resources?.get?.('Font'));
console.log(`resources_resolved=${!!resources}`);
console.log(`fonts_resolved=${!!fonts}`);
if (fonts?.getKeys) console.log(`font_keys=${fonts.getKeys().join(',')}`);
if (fonts?.get) for (const name of ['R12','/R12']) { try { const fr=fonts.get(name); console.log(`font_lookup_${name}=${!!fr}`); const f=resolve(fr); console.log(`font_object_${name}=${!!f}`); if (f) { const tu=f.get?.('ToUnicode'); console.log(`tounicode_${name}=${!!tu}`); const cmap=tu?resolve(tu):null; console.log(`tounicode_stream_${name}=${!!cmap?.isStream?.()}`); } } catch(e) { console.log(`font_lookup_${name}_error=${e.message}`); } }

const edits = editDoc(doc, needle, replacement);
if (edits !== 1) throw new Error(`expected exactly 1 edit, got ${edits}`);

const pageAfter = doc.loadPage(0);
const textAfter = pageText(pageAfter);
if (!textAfter.includes(expected)) throw new Error(`new text not extractable: ${JSON.stringify(textAfter.match(/UP3_[^\n]*/)?.[0])}`);
if (textAfter.includes('UP3_LIM_E03_PLA_I59_02_ER_70_A34_7034')) throw new Error('original full text is still extractable');
const afterStreams = pageContents(pageAfter);
const afterAnnots = annotationCount(pageAfter);
if (afterAnnots !== beforeAnnots) throw new Error(`annotation count changed: ${beforeAnnots} -> ${afterAnnots}`);
if (afterStreams.length !== beforeStreams.length) throw new Error('content stream count changed before save');
if (!afterStreams.some((b, i) => b.length !== beforeStreams[i].length || !b.every((v, k) => v === beforeStreams[i][k]))) throw new Error('no content stream changed');

const out = doc.saveToBuffer('garbage=2,compress=yes').asUint8Array();
fs.writeFileSync('test-pdfs/UP3_LIM_E03_PLA_I59_02_ER_70_A34_7034-edited.pdf', out);
const check = mupdf.PDFDocument.openDocument(out, 'application/pdf');
const checkText = check.loadPage(0).toStructuredText().asText();
if (!checkText.includes(expected)) throw new Error('saved PDF does not extract the replacement text');
if (checkText.includes('UP3_LIM_E03_PLA_I59_02_ER_70_A34_7034')) throw new Error('saved PDF still extracts the original full text');

console.log('REAL_PDF_EDIT_OK');
console.log(`pages=${doc.countPages()}`);
console.log(`edits=${edits}`);
console.log(`expected=${expected}`);
console.log(`replacement_extractable=${checkText.includes(expected)}`);
console.log(`original_extractable=${checkText.includes('UP3_LIM_E03_PLA_I59_02_ER_70_A34_7034')}`);
console.log(`annotations_before=${beforeAnnots}`);
console.log(`annotations_after=${afterAnnots}`);
console.log(`content_streams=${afterStreams.length}`);
console.log(`edited_pdf_bytes=${out.length}`);
