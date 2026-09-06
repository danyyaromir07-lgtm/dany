import fs from 'node:fs'
import * as mupdf from 'mupdf'
import {buildCompactIndex,collectVisual,deleteExact} from '../foxit-index-engine.mjs'
function bytes(p){return new Uint8Array(fs.readFileSync(p))}
function inspect(p){const d=mupdf.PDFDocument.openDocument(bytes(p),'application/pdf'),pg=d.loadPage(0),t0=performance.now(),v=collectVisual(pg),t1=performance.now(),idx=buildCompactIndex(pg),t2=performance.now();pg.destroy();d.destroy();return{v,idx,visualMs:t1-t0,indexMs:t2-t1}}
function structural(idx,k){const o=k*12;return{bbox:Array.from(idx.F.slice(o,o+4)),first:Array.from(idx.F.slice(o+4,o+6)),last:Array.from(idx.F.slice(o+6,o+8)),width:idx.F[o+8],rgb:Array.from(idx.F.slice(o+9,o+12)),lines:idx.I[k*4],curves:idx.I[k*4+1]}}
let a=inspect('lab-tests/fixtures/multistream-cross.pdf')
console.log('multistream',a.v.length,a.idx.count,a.visualMs.toFixed(1),a.indexMs.toFixed(1))
for(let i=0;i<Math.min(3,a.v.length,a.idx.count);i++)console.log('PAIR',i,JSON.stringify(a.v[i]),JSON.stringify(structural(a.idx,i)))
if(a.idx.incomplete||a.v.length!==a.idx.count||a.v.length<3)throw new Error('fixture multistream no quedó indexado 1:1')
let del=await deleteExact(bytes('lab-tests/fixtures/multistream-cross.pdf'),[0])
if(del.after!==del.before-1)throw new Error('borrado cross-stream no eliminó exactamente 1')
console.log('cross-stream delete ok',del.mapMode,del.streams,del.before,'->',del.after)

let b=inspect('lab-tests/fixtures/reused-form.pdf')
console.log('reused-form',b.v.length,b.idx.count,b.visualMs.toFixed(1),b.indexMs.toFixed(1),'forms',b.idx.forms)
for(let i=0;i<Math.min(4,b.v.length,b.idx.count);i++)console.log('FORMPAIR',i,JSON.stringify(b.v[i]),JSON.stringify(structural(b.idx,i)))
if(b.idx.incomplete||b.idx.forms<1||b.v.length!==b.idx.count||b.v.length<2)throw new Error('fixture Form no quedó indexado')
let blocked=false
try{await deleteExact(bytes('lab-tests/fixtures/reused-form.pdf'),[0])}catch(e){blocked=/XObject compartido|mapeo no único/.test(String(e.message));console.log('partial shared form blocked:',e.message)}
if(!blocked)throw new Error('una instancia parcial de Form compartido debía bloquearse')
const all=Array.from({length:b.v.length},(_,i)=>i)
del=await deleteExact(bytes('lab-tests/fixtures/reused-form.pdf'),all)
if(del.after!==0)throw new Error('selección completa del Form reutilizado no se eliminó exactamente')
console.log('shared form full delete ok',del.mapMode,del.streams,del.before,'->',del.after)
console.log('ALL LAB TESTS PASSED')
// rerun marker: width-unknown fix
