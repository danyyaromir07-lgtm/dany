import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const base = process.env.LAB_URL || 'http://127.0.0.1:8765';
const browser = await chromium.launch({headless:true});
const page = await browser.newPage({viewport:{width:1400,height:900}});
const events=[];
page.on('pageerror',e=>{const x='PAGEERROR '+String(e);events.push(x);console.log(x)});
page.on('console',m=>{const txt=m.text();if(txt.startsWith('PRE:')||txt.startsWith('IDX:')) console.log('BROWSER',txt);if(m.type()==='error'){const x='CONSOLE_ERROR '+txt;events.push(x);console.log(x)}});
page.on('requestfailed',r=>{const x='REQFAIL '+r.url()+' '+(r.failure()?.errorText||'');events.push(x);console.log(x)});
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
await page.waitForTimeout(1000);
await page.click('#open');
await page.waitForFunction(() => !document.querySelector('#select')?.disabled, null, {timeout:15000});
await page.waitForFunction(() => (window.__statusHistory||[]).some(s => /visual=3.*índice estructural=3.*identidad ordinal exacta lista/.test(s)), null, {timeout:15000});
let history=await page.evaluate(()=>window.__statusHistory);
console.log('INDEX_HISTORY_MATCH',history.find(s=>/visual=3.*índice estructural=3.*identidad ordinal exacta lista/.test(s)));

const vp=await page.locator('#viewport').boundingBox();
assert(vp && vp.width>0 && vp.height>0);
const tr=await page.locator('#stage').evaluate(el=>getComputedStyle(el).transform);
const nums=(tr.match(/matrix\(([^)]+)\)/)?.[1]||'').split(',').map(Number);
assert.equal(nums.length,6,'stage must have a 2D transform');
const [scale,,, ,panX,panY]=nums;
const baseW=parseFloat(await page.locator('#stage').evaluate(el=>getComputedStyle(el).width));
const baseRs=baseW/400;
// Content stream y≈58 maps through MuPDF page transform to visual page y≈342.
const pdfX=60,pdfY=342;
const clickX=vp.x+panX+pdfX*baseRs*scale;
const clickY=vp.y+panY+pdfY*baseRs*scale;
console.log('CLICK',JSON.stringify({tr,scale,panX,panY,baseRs,clickX,clickY}));
await page.mouse.click(clickX,clickY);
await page.waitForFunction(() => (window.__statusHistory||[]).some(s => /resaltados=1/.test(s)), null, {timeout:10000});
assert.equal(await page.locator('#delete').isDisabled(),false,'delete must enable after selecting one stroke');
history=await page.evaluate(()=>window.__statusHistory);
console.log('SELECT_HISTORY_MATCH',history.findLast(s=>/resaltados=1/.test(s)));

const t0=performance.now();
await page.click('#delete');
await page.waitForFunction(() => (window.__statusHistory||[]).some(s => s.includes('Selección eliminada y verificada') || s.includes('Borrado cancelado') || s.includes('Borrado bloqueado')), null, {timeout:30000});
const elapsed=(performance.now()-t0)/1000;
history=await page.evaluate(()=>window.__statusHistory);
const result=history.findLast(s=>s.includes('Selección eliminada y verificada') || s.includes('Borrado cancelado') || s.includes('Borrado bloqueado'))||'';
console.log('DELETE_RESULT',result);
console.log('DELETE_WALL_SECONDS',elapsed.toFixed(3));
assert.match(result,/Selección eliminada y verificada: 1 trazos/);
assert.match(result,/ruta única/);
assert.doesNotMatch(result,/correspondencia \d|CAUSAL|causal|rutas alternativas/);
assert(elapsed < 20,`delete took ${elapsed.toFixed(3)}s`);
assert(!events.some(x=>/PAGEERROR|TypeError|ReferenceError|SyntaxError|wasm.*error|mupdf.*error/i.test(x)),events.join('\n'));
await browser.close();
console.log('DIRECT_MULTISTREAM_BROWSER_E2E_OK');
