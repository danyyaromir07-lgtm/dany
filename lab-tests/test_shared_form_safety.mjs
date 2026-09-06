import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const base=process.env.LAB_URL||'http://127.0.0.1:8765';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1400,height:900}});
const errors=[];
page.on('pageerror',e=>errors.push('PAGEERROR '+String(e)));
page.on('console',m=>{if(m.type()==='error')errors.push('CONSOLE '+m.text())});
await page.addInitScript(()=>{
  window.__statusHistory=[];
  window.showOpenFilePicker=async()=>[{
    getFile:async()=>{const r=await fetch('/lab-tests/fixtures/reused-form-scaled.pdf');const b=await r.arrayBuffer();return new File([b],'reused-form-scaled.pdf',{type:'application/pdf'})},
    createWritable:async()=>({write:async()=>{},close:async()=>{}})
  }];
});
await page.goto(base+'/selector-nubes-multistream-core.html',{waitUntil:'domcontentloaded',timeout:60000});
await page.evaluate(()=>{const el=document.querySelector('#status');window.__statusHistory.push(el?.textContent||'');new MutationObserver(()=>window.__statusHistory.push(el?.textContent||'')).observe(el,{subtree:true,childList:true,characterData:true})});
await page.waitForTimeout(1000);
await page.click('#open');
await page.waitForFunction(()=>!document.querySelector('#select')?.disabled,null,{timeout:15000});
await page.waitForFunction(()=>(window.__statusHistory||[]).some(s=>/visual=2.*índice estructural=2.*identidad ordinal exacta lista/.test(s)),null,{timeout:15000});

const vp=await page.locator('#viewport').boundingBox();
assert(vp);
const tr=await page.locator('#stage').evaluate(el=>getComputedStyle(el).transform);
const a=(tr.match(/matrix\(([^)]+)\)/)?.[1]||'').split(',').map(Number);
assert.equal(a.length,6);
const [scale,,,,panX,panY]=a;
const stageW=parseFloat(await page.locator('#stage').evaluate(el=>getComputedStyle(el).width));
const baseRs=stageW/520;
const clickPdf=async(x,y)=>page.mouse.click(vp.x+panX+x*baseRs*scale,vp.y+panY+y*baseRs*scale);

let selected='';
for(const y of [60,70,80,90,50]){
  for(const x of [40,50,60,70,30]){
    await clickPdf(x,y);
    await page.waitForTimeout(60);
    const s=await page.locator('#status').textContent()||'';
    if(/resaltados=1/.test(s)){selected=s;break}
  }
  if(selected)break;
}
console.log('SELECT_RESULT',selected);
assert.match(selected,/resaltados=1/,'small Form instance must be individually selectable');
assert.equal(await page.locator('#delete').isDisabled(),false);

await page.click('#delete');
await page.waitForFunction(()=>(window.__statusHistory||[]).some(s=>s.includes('Borrado cancelado')||s.includes('Borrado bloqueado')),null,{timeout:15000});
const history=await page.evaluate(()=>window.__statusHistory);
const result=history.findLast(s=>s.includes('Borrado cancelado')||s.includes('Borrado bloqueado'))||'';
console.log('DELETE_RESULT',result);
assert.match(result,/XObject compartido|instancia no azul usa el mismo operador/);
assert.equal(await page.locator('#save').isDisabled(),true,'blocked delete must not create pending changes');
assert.equal(await page.locator('#delete').isDisabled(),false,'blue selection must remain after safety block');
assert(!history.some(s=>s.includes('Selección eliminada y verificada')),'shared source operator must never be committed when an unselected instance remains');
assert(!errors.some(x=>/TypeError|ReferenceError|SyntaxError|wasm.*error|mupdf.*error/i.test(x)),errors.join('\n'));
await browser.close();
console.log('SHARED_FORM_SAFETY_E2E_OK');
