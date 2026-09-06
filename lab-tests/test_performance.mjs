import fs from 'node:fs'
import * as mupdf from 'mupdf'
import {buildCompactIndex,collectVisual,mapSelected,deleteExactIndexed} from '../foxit-index-engine.mjs'
const bytes=new Uint8Array(fs.readFileSync('lab-tests/fixtures/large-120k.pdf'))
const doc=mupdf.PDFDocument.openDocument(bytes,'application/pdf'),page=doc.loadPage(0)
const t0=performance.now();
const visual=collectVisual(page); const t1=performance.now();
const idx=buildCompactIndex(page); const t2=performance.now();
if(idx.incomplete)throw new Error('large index incomplete')
if(visual.length!==120000||idx.count!==120000)throw new Error(`large counts mismatch visual=${visual.length} index=${idx.count}`)
const ords=Array.from({length:96},(_,i)=>Math.min(visual.length-1,Math.floor((i+.5)*visual.length/96)))
const t3=performance.now(),map=mapSelected(visual,idx,ords),t4=performance.now();
if(map.ids.length!==ords.length)throw new Error('large mapping incomplete: '+JSON.stringify(map))
const rssBefore=Math.round(process.memoryUsage().rss/1024/1024)
const del=await deleteExactIndexed(bytes,visual,idx,ords); const t5=performance.now();
const rssAfter=Math.round(process.memoryUsage().rss/1024/1024)
if(del.after!==120000-96)throw new Error(`large exact delete mismatch ${del.before}->${del.after}`)
const metrics={visualMs:Math.round(t1-t0),indexMs:Math.round(t2-t1),mapMs:Math.round((t4-t3)*1000)/1000,deleteCachedMs:Math.round(t5-t4),rssBeforeMB:rssBefore,rssAfterMB:rssAfter,mapMode:map.mode,streamsTouched:del.streams}
console.log('PERF',JSON.stringify(metrics))
if(metrics.indexMs>20000)throw new Error('compact index exceeded 20s budget')
if(metrics.mapMs>500)throw new Error('selected mapping exceeded 0.5s budget')
if(metrics.deleteCachedMs>30000)throw new Error('cached exact delete exceeded 30s budget')
page.destroy(); doc.destroy();
console.log('PERFORMANCE LAB TEST PASSED')
