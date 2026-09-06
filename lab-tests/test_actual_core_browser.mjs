import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const base = process.env.LAB_URL || 'http://127.0.0.1:8765';
const browser = await chromium.launch({headless:true});
const page = await browser.newPage({viewport:{width:1400,height:900}});
const events=[];
page.on('pageerror',e=>{const x='PAGEERROR '+String(e);events.push(x);console.log(x)});
page.on('console',m=>{const x='CONSOLE '+m.type()+' '+m.text();events.push(x);console.log(x)});
page.on('requestfailed',r=>{const x='REQFAIL '+r.url()+' '+(r.failure()?.errorText||'');events.push(x);console.log(x)});
page.on('response',r=>{if(/jsdelivr|mupdf/i.test(r.url())) console.log('RESPONSE',r.status(),r.url())});
await page.addInitScript(() => {
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
await page.waitForTimeout(5000);
const before=await page.locator('#status').textContent();
console.log('STATUS_BEFORE_CLICK',before);
await page.click('#open');
await page.waitForTimeout(3000);
const after=await page.locator('#status').textContent();
console.log('STATUS_AFTER_CLICK',after);
console.log('EVENT_COUNT',events.length);
assert(events.some(x=>x.includes('PRE:openPdf:enter')) || after!==before, 'core module did not execute or click handler was not attached');
await browser.close();
console.log('STARTUP_DIAGNOSTIC_OK');
