import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('text-editor-v63.js', 'utf8').replace(/^import .*?;\n/, '');
const el = () => ({ value: '', files: [], disabled: false, innerHTML: '', textContent: '', classList: { add(){}, remove(){}, toggle(){} }, addEventListener(){}, click(){} });
const documentStub = { querySelector(){ return el(); }, createElement(){ return el(); } };
const ctx = { console, document: documentStub, mupdf: {}, TextEncoder, Uint8Array, String, Set, Map, Math, Error };
vm.runInNewContext(source + '\nTEST_API={toks,decodeToken,encodeText,editStream};', ctx);
const { toks, decodeToken, editStream } = ctx.TEST_API;

const encoded = Uint8Array.from([0x17,0x0e,0x20,0x49,0x14,0x03,0x0a,0x49,0x19,0x17,0x11]);
const sourceText = Uint8Array.from([
  ...new TextEncoder().encode('BT\n/R12 7 Tf\n0 0 Tm\n('),
  ...encoded,
  ...new TextEncoder().encode(')TJ\nET\n')
]);
const tokens = toks(sourceText);
const stringToken = tokens.find(t => t.type === 'string');
const cmap = { map: new Map([[3,'0'],[10,'3'],[14,'I'],[17,'L'],[19,'P'],[20,'M'],[0x49,'_'],[0x14,'E'],[0x11,'A']]), bytes: 1 };
const decoded = decodeToken(stringToken, cmap);
if (decoded !== 'LIM_E03_PLA') throw new Error(`decodeToken mismatch: ${JSON.stringify(decoded)}`);

const stream = { isStream: () => true, readStream: () => new TextEncoder().encode('begincmap 11 beginbfrange <03><03><0030> endbfrange') };
const toUnicodeRef = { resolve: () => stream };
const font = { get: k => k === 'ToUnicode' ? toUnicodeRef : null };
const fontRef = { resolve: () => font };
const fonts = { isDictionary: () => true, get: k => (k === 'R12' || k === '/R12') ? fontRef : null };
const resources = { get: k => k === 'Font' ? fonts : null };
const page = { getObject: () => ({ getInheritable: () => resources, get: () => resources }) };
const edited = editStream(sourceText, 'LIM_E03_PLA', 'LIM_O03_PLA', page);
if (edited.count !== 1) throw new Error(`expected 1 edit, got ${edited.count}`);
const rendered = new TextDecoder().decode(edited.bytes);
if (!rendered.includes('<170e204f14030a49191711>')) throw new Error(`replacement bytes not found: ${rendered}`);
if (rendered.includes('<170e204914030a49191711>')) throw new Error('original encoded text still present');

console.log('V63_CORE_TEST_OK');
console.log('decoded=', decoded);
console.log('edited_count=', edited.count);
console.log('replacement_present=true');
