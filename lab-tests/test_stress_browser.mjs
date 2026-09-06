import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const N=Number(process.env.STRESS_N||100000), total=N+1;
const base=process.env.LAB_URL||'http://127.0.0.1:8765';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1000}});
const errors=[];
page.on('pageerror',e=>{errors.push(String(e));console.log('PAGEERROR',String(e))});
page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.log('CONSOLE_ERROR',m.text())}});
await page.addInitScript(({total})=>{
  window.__statusHistory=[];
  window.__stressTotal=total;
  window.showOpenFilePicker=async()=>[{
    getFile:async()=>{const r=await fetch(`/lab-tests/fixtures/stress-${total}.pdf`);const b=await r.arrayBuffer();return new File([b],`stress-${total}.pdf`,{type:'application/pdf'})},
    createWritable:async()=>({write:async()=>{},close:async()=>{}})
  }];
},{total});
await page.goto(base+'/selector-nubes-multistream-core.html',{waitUntil:'domcontentloaded',timeout:60000});
await page.evaluate(()=>{const el=document.querySelector('#status');window.__statusHistory.push(el?.textContent||'');new MutationObserver(()=>window.__statusHistory.push(el?.textContent||'')).observe(el,{subtree:true,childList:true,characterData:true})});
await page.waitForTimeout(800);
const openT=performance.now();
await page.click('#open');
await page.waitForFunction(()=>!document.querySelector('#select')?.disabled,null,{timeout:60000});
const visualReady=(performance.now()-openT)/1000;
await page.waitForFunction(()=>{
  const n=window.__stressTotal;
  return (window.__statusHistory||[]).some(s=>s.includes(`visual=${n}`)&&s.includes(`índice estructural=${n}`)&&s.includes('identidad ordinal exacta lista'));
},null,{timeout:60000});
const indexReady=(performance.now()-openT)/1000;
console.log('STRESS_VISUAL_READY_SECONDS',visualReady.toFixed(3));
console.log('STRESS_INDEX_READY_SECONDS',indexReady.toFixed(3));

const vp=await page.locator('#viewport').boundingBox(); assert(vp);
const tr=await page.locator('#stage').evaluate(el=>getComputedStyle(el).transform);
const a=(tr.match(/matrix\(([^)]+)\)/)?.[1]||'').split(',').map(Number); assert.equal(a.length,6);
const [scale,,,,panX,panY]=a;
const stageW=parseFloat(await page.locator('#stage').evaluate(el=>getComputedStyle(el).width));
const baseRs=stageW/1000;
// Red source line y=20 maps to visual y=980 through MuPDF's page transform.
const clickX=vp.x+panX+30*baseRs*scale;
const clickY=vp.y+panY+980*baseRs*scale;
await page.mouse.click(clickX,clickY);
await page.waitForFunction(()=>(window.__statusHistory||[]).some(s=>/resaltados=1/.test(s)),null,{timeout:10000});
assert.equal(await page.locator('#delete').isDisabled(),false);

const delT=performance.now();
await page.click('#delete');
await page.waitForFunction(()=>(window.__statusHistory||[]).some(s=>s.includes('Selección eliminada y verificada')||s.includes('Borrado cancelado')||s.includes('Borrado bloqueado')),null,{timeout:60000});
const deleteSeconds=(performance.now()-delT)/1000;
const history=await page.evaluate(()=>window.__statusHistory);
const result=history.findLast(s=>s.includes('Selección eliminada y verificada')||s.includes('Borrado cancelado')||s.includes('Borrado bloqueado'))||'';
console.log('STRESS_DELETE_RESULT',result);
console.log('STRESS_DELETE_SECONDS',deleteSeconds.toFixed(3));
assert.match(result,/Selección eliminada y verificada: 1 trazos/);
assert.match(result,/ruta única/);
assert(deleteSeconds<30,`100k direct delete exceeded 30s: ${deleteSeconds.toFixed(3)}s`);
assert(!/correspondencia \d|CAUSAL|causal|rutas alternativas/.test(result));
assert(!errors.some(x=>/out of memory|realloc|calloc|RuntimeError|TypeError|ReferenceError|SyntaxError/i.test(x)),errors.join('\n'));
await browser.close();
console.log('STRESS_BROWSER_E2E_OK');
