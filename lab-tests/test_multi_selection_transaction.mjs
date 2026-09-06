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
    getFile:async()=>{const r=await fetch('/lab-tests/fixtures/multistream-cross.pdf');const b=await r.arrayBuffer();return new File([b],'multistream-cross.pdf',{type:'application/pdf'})},
    createWritable:async()=>({write:async()=>{},close:async()=>{}})
  }];
});
await page.goto(base+'/selector-nubes-multistream-core.html',{waitUntil:'domcontentloaded',timeout:60000});
await page.evaluate(()=>{const el=document.querySelector('#status');window.__statusHistory.push(el?.textContent||'');new MutationObserver(()=>window.__statusHistory.push(el?.textContent||'')).observe(el,{subtree:true,childList:true,characterData:true})});
await page.waitForTimeout(800);
await page.click('#open');
await page.waitForFunction(()=>(window.__statusHistory||[]).some(s=>/visual=3.*índice estructural=3.*identidad ordinal exacta lista/.test(s)),null,{timeout:15000});
const vp=await page.locator('#viewport').boundingBox(); assert(vp);
const tr=await page.locator('#stage').evaluate(el=>getComputedStyle(el).transform);
const a=(tr.match(/matrix\(([^)]+)\)/)?.[1]||'').split(',').map(Number); assert.equal(a.length,6);
const [scale,,,,panX,panY]=a;
const stageW=parseFloat(await page.locator('#stage').evaluate(el=>getComputedStyle(el).width));
const baseRs=stageW/400;
const screen=(x,y)=>[vp.x+panX+x*baseRs*scale,vp.y+panY+y*baseRs*scale];

// Red path: content y≈58 -> visual y≈342; blue path: content y≈155 -> visual y≈245.
let [x1,y1]=screen(60,342); await page.mouse.click(x1,y1);
await page.waitForFunction(()=>(window.__statusHistory||[]).some(s=>/resaltados=1/.test(s)),null,{timeout:5000});
let [x2,y2]=screen(160,245); await page.keyboard.down('Control'); await page.mouse.click(x2,y2); await page.keyboard.up('Control');
await page.waitForFunction(()=>(window.__statusHistory||[]).some(s=>/resaltados=2/.test(s)),null,{timeout:5000});
const history1=await page.evaluate(()=>window.__statusHistory);
console.log('MULTI_SELECT',history1.findLast(s=>/resaltados=2/.test(s)));
assert.equal(await page.locator('#delete').isDisabled(),false);

const t0=performance.now(); await page.click('#delete');
await page.waitForFunction(()=>(window.__statusHistory||[]).some(s=>s.includes('Selección eliminada y verificada')||s.includes('Borrado cancelado')||s.includes('Borrado bloqueado')),null,{timeout:20000});
const seconds=(performance.now()-t0)/1000;
const history=await page.evaluate(()=>window.__statusHistory);
const result=history.findLast(s=>s.includes('Selección eliminada y verificada')||s.includes('Borrado cancelado')||s.includes('Borrado bloqueado'))||'';
console.log('MULTI_DELETE',result);
console.log('MULTI_DELETE_SECONDS',seconds.toFixed(3));
assert.match(result,/Selección eliminada y verificada: 2 trazos/);
assert.match(result,/3 stream\(s\)/);
assert.match(result,/ruta única/);
assert(!/correspondencia \d|CAUSAL|causal|rutas alternativas/.test(result));
assert(seconds<20);
assert(!errors.some(x=>/TypeError|ReferenceError|SyntaxError|out of memory|realloc|calloc/i.test(x)),errors.join('\n'));
await browser.close();
console.log('MULTI_SELECTION_TRANSACTION_E2E_OK');
