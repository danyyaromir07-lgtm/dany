import { chromium } from 'playwright';
import assert from 'node:assert/strict';

// Instrumented run: stream all IDX:* console markers from the real core.
const base = process.env.LAB_URL || 'http://127.0.0.1:8765';
const browser = await chromium.launch({headless:true});
const page = await browser.newPage({viewport:{width:1400,height:900}});
const pageErrors=[];
const consoleErrors=[];
page.on('pageerror',e=>{pageErrors.push(String(e));console.log('PAGEERROR',String(e))});
page.on('console',m=>{
  const txt=m.text();
  if(txt.startsWith('IDX:')) console.log('BROWSER',txt);
  if(m.type()==='error') consoleErrors.push(txt);
});
await page.addInitScript(() => {
  window.__statusHistory=[];
  window.showOpenFilePicker = async () => [{
    getFile: async () => {
      const r=await fetch('/lab-tests/fixtures/multistream-cross.pdf');
      const b=await r.arrayBuffer();
      return new File([b],'multistream-cross.pdf',{type:'application/pdf'});
    },
    createWritable: async () => ({write:async()=>{},close:async()=>{}})
  }];
});
await page.goto(base+'/selector-nubes-multistream-core.html',{waitUntil:'domcontentloaded',timeout:60000});
await page.evaluate(() => {
  const el=document.querySelector('#status');
  window.__statusHistory.push(el?.textContent||'');
  new MutationObserver(()=>window.__statusHistory.push(el?.textContent||'')).observe(el,{subtree:true,childList:true,characterData:true});
});
await page.click('#open');
await page.waitForFunction(() => (window.__statusHistory||[]).some(s =>
  s.includes('identidad ordinal exacta lista') || s.includes('identidad ordinal no demostrada') || s.includes('índice estructural falló')
),null,{timeout:30000});
let history=await page.evaluate(()=>window.__statusHistory);
let status=history.findLast(s=>s.includes('identidad ordinal exacta lista')||s.includes('identidad ordinal no demostrada')||s.includes('índice estructural falló'))||'';
console.log('STATUS_HISTORY',history);
console.log('INDEX_STATUS',status);
console.log('PAGE_ERRORS',pageErrors);
console.log('CONSOLE_ERRORS',consoleErrors);
assert.match(status,/visual=3/);
assert.match(status,/índice estructural=3/);
assert.match(status,/identidad ordinal exacta lista/);

const rect=await page.locator('#page').boundingBox();
assert(rect && rect.width>0 && rect.height>0);
await page.mouse.click(rect.x+rect.width*(60/400),rect.y+rect.height*(58/400));
await page.waitForFunction(() => /resaltados=1/.test(document.querySelector('#status')?.textContent||''),null,{timeout:10000});
status=await page.locator('#status').textContent();
console.log('SELECT_STATUS',status);
assert.equal(await page.locator('#delete').isDisabled(),false);

const t0=Date.now();
await page.click('#delete');
await page.waitForFunction(() => {
  const s=document.querySelector('#status')?.textContent||'';
  return s.includes('Selección eliminada y verificada') || s.includes('Borrado cancelado') || s.includes('Borrado bloqueado');
},null,{timeout:60000});
const elapsed=(Date.now()-t0)/1000;
status=await page.locator('#status').textContent();
console.log('DELETE_STATUS',status);
console.log('DELETE_WALL_SECONDS',elapsed.toFixed(3));
assert.match(status,/Selección eliminada y verificada: 1 trazos/);
assert.match(status,/ruta única/);
assert.doesNotMatch(status,/correspondencia \d|CAUSAL|causal|rutas alternativas/);
assert(elapsed < 20,`delete took ${elapsed}s`);
assert.deepEqual(pageErrors,[],`page errors: ${pageErrors.join('\n')}`);
const serious=consoleErrors.filter(x=>/TypeError|ReferenceError|SyntaxError|wasm|mupdf|Uncaught/i.test(x));
assert.deepEqual(serious,[],`console errors: ${serious.join('\n')}`);
await browser.close();
console.log('ACTUAL_CORE_BROWSER_E2E_OK');
