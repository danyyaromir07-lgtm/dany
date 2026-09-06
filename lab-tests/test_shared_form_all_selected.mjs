import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const base=process.env.LAB_URL||'http://127.0.0.1:8765';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1400,height:900}});
const errors=[];
page.on('pageerror',e=>errors.push(String(e)));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
await page.addInitScript(()=>{
  window.__statusHistory=[];
  window.showOpenFilePicker=async()=>[{
    getFile:async()=>{const r=await fetch('/lab-tests/fixtures/reused-form-scaled.pdf');const b=await r.arrayBuffer();return new File([b],'reused-form-scaled.pdf',{type:'application/pdf'})},
    createWritable:async()=>({write:async()=>{},close:async()=>{}})
  }];
});
await page.goto(base+'/selector-nubes-multistream-core.html',{waitUntil:'domcontentloaded',timeout:60000});
await page.evaluate(()=>{const el=document.querySelector('#status');window.__statusHistory.push(el?.textContent||'');new MutationObserver(()=>window.__statusHistory.push(el?.textContent||'')).observe(el,{subtree:true,childList:true,characterData:true})});
await page.waitForTimeout(800); await page.click('#open');
await page.waitForFunction(()=>(window.__statusHistory||[]).some(s=>/visual=2.*índice estructural=2.*identidad ordinal exacta lista/.test(s)),null,{timeout:15000});
const vp=await page.locator('#viewport').boundingBox(); assert(vp);
const tr=await page.locator('#stage').evaluate(el=>getComputedStyle(el).transform);
const a=(tr.match(/matrix\(([^)]+)\)/)?.[1]||'').split(',').map(Number); assert.equal(a.length,6);
const [scale,,,,panX,panY]=a;
const stageW=parseFloat(await page.locator('#stage').evaluate(el=>getComputedStyle(el).width)); const baseRs=stageW/520;
const clickPdf=async(x,y,ctrl=false)=>{if(ctrl)await page.keyboard.down('Control');await page.mouse.click(vp.x+panX+x*baseRs*scale,vp.y+panY+y*baseRs*scale);if(ctrl)await page.keyboard.up('Control');await page.waitForTimeout(80)};

// Find one hit in the small instance.
let one=false;
for(const y of [60,70,80,90,50]){for(const x of [40,50,60,70,30]){await clickPdf(x,y);const s=await page.locator('#status').textContent()||'';if(/resaltados=1/.test(s)){one=true;break}}if(one)break}
assert(one,'small Form instance not selected');
// Find a hit in the large second instance while accumulating with Ctrl.
let two=false;
for(const y of [120,160,200,240,100]){for(const x of [280,320,360,400,440]){await clickPdf(x,y,true);const s=await page.locator('#status').textContent()||'';if(/resaltados=2/.test(s)){two=true;break}}if(two)break}
const selected=await page.locator('#status').textContent()||'';
console.log('ALL_SHARED_SELECT',selected);
assert(two,'both shared Form instances must be selected');

const t0=performance.now(); await page.click('#delete');
await page.waitForFunction(()=>(window.__statusHistory||[]).some(s=>s.includes('Selección eliminada y verificada')||s.includes('Borrado cancelado')||s.includes('Borrado bloqueado')),null,{timeout:20000});
const seconds=(performance.now()-t0)/1000;
const history=await page.evaluate(()=>window.__statusHistory);
const result=history.findLast(s=>s.includes('Selección eliminada y verificada')||s.includes('Borrado cancelado')||s.includes('Borrado bloqueado'))||'';
console.log('ALL_SHARED_DELETE',result);
console.log('ALL_SHARED_DELETE_SECONDS',seconds.toFixed(3));
assert.match(result,/Selección eliminada y verificada: 2 trazos/);
assert.match(result,/ruta única/);
assert.doesNotMatch(result,/XObject compartido|Borrado cancelado|Borrado bloqueado/);
assert(seconds<20);
assert(!errors.some(x=>/TypeError|ReferenceError|SyntaxError|out of memory|realloc|calloc/i.test(x)),errors.join('\n'));
await browser.close(); console.log('SHARED_FORM_ALL_SELECTED_E2E_OK');

