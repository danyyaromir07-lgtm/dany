import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const pdf = 'test-pdfs/UP3_LIM_E03_PLA_I59_02_ER_70_A34_7034.pdf';
const server = spawn('python3', ['-m', 'http.server', '4173', '--bind', '127.0.0.1'], { stdio: 'ignore' });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ acceptDownloads: true });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://127.0.0.1:4173/index.html', { waitUntil: 'networkidle' });
  await page.click('.tab[data-tool="text"]');
  await page.fill('#findText', 'LIM_E03_PLA');
  await page.fill('#replaceText', 'LIM_O03_PLA');
  await page.locator('#textFileInput').setInputFiles(pdf);
  const downloadPromise = page.waitForEvent('download');
  await page.click('#textProcessBtn');
  const download = await downloadPromise;
  await download.saveAs('test-pdfs/_v63_result.pdf');
  const summary = await page.locator('#textSummary').innerText();
  const row = await page.locator('#textResults .result-row').innerText();
  console.log('BROWSER_V63_TEST_OK');
  console.log('summary=', summary);
  console.log('result=', row);
  if (!/1 edición aplicada/.test(row) || /Sin coincidencias/.test(row)) throw new Error(`unexpected UI result: ${row}`);
  if (errors.length) throw new Error(`browser errors: ${errors.join(' | ')}`);
} finally {
  await browser.close();
  server.kill('SIGTERM');
}
