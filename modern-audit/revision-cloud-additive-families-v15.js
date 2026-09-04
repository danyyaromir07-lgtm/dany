// Additive revision-cloud families v15.
// Stable v14 families remain unchanged and always have priority.
// v15 adds a geometry-first fallback for isolated exact-red curved cloud blocks.
// It does not key on exact path/curve counts: counts may vary widely between PDF exporters.
import {
  detectAdditiveRevisionCloudFamilies as detectV14,
  removeAdditiveRevisionCloudFamilies as removeV14
} from './revision-cloud-additive-families-v14.js?v=20260825-compact1';

const SRC='vector-red-geometric-cloud-fallback-v15';
const NUM='[-+]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)';
const RED=new RegExp(`(?:^|\\n)(1(?:\\.0+)?\\s+0(?:\\.0+)?\\s+0(?:\\.0+)?\\s+RG\\s*)`,'g');
const MOVE=new RegExp(`^(${NUM})\\s+(${NUM})\\s+m$`);
const CURVE_C=new RegExp(`^(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+c$`);
const CURVE_V=new RegExp(`^(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+v$`);
const CURVE_Y=new RegExp(`^(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+y$`);
const LINE=new RegExp(`^(${NUM})\\s+(${NUM})\\s+l$`);
const dist=(a,b)=>Math.hypot(Number(a[0])-Number(b[0]),Number(a[1])-Number(b[1]));
const addPoint=(box,p)=>box?[Math.min(box[0],p[0]),Math.min(box[1],p[1]),Math.max(box[2],p[0]),Math.max(box[3],p[1])]:[p[0],p[1],p[0],p[1]];
function toText(buf){const b=buf?.asUint8Array?buf.asUint8Array():buf;let s='';for(let i=0;i<b.length;i+=0x8000)s+=String.fromCharCode(...b.subarray(i,Math.min(b.length,i+0x8000)));return s}
function toBytes(s){const b=new Uint8Array(s.length);for(let i=0;i<s.length;i++)b[i]=s.charCodeAt(i)&255;return b}
function resolve(o){try{return o?.resolve?.()||o}catch(_){return o}}
function streamRef(o){try{if(o?.isStream?.())return o;const r=resolve(o);return r?.isStream?.()?r:o}catch(_){return o}}
function refs(page){try{const c=page.getObject()?.get?.('Contents');if(!c)return[];if(c?.isArray?.())return Array.from({length:Number(c.length||0)},(_,i)=>streamRef(c.get(i))).filter(x=>x?.isStream?.());const s=streamRef(c);return s?.isStream?.()?[s]:[]}catch(_){return[]}}
function quantile(a,q){if(!a.length)return 0;const b=[...a].sort((x,y)=>x-y),p=(b.length-1)*q,i=Math.floor(p),f=p-i;return b[i]+(b[Math.min(i+1,b.length-1)]-b[i])*f}
function readBlock(text,bodyStart){
  const tail=text.slice(bodyStart),parts=tail.split(/(\r?\n)/);let used=0,i=0,pending=null,bbox=null,pathCount=0,curveCount=0,lineCount=0,connected=0;
  const pathDiags=[];let firstStart=null,prevEnd=null,lastEnd=null;
  const nextLine=()=>{if(i>=parts.length)return null;const raw=parts[i]+(parts[i+1]||'');i+=2;return raw};
  while(true){
    const raw=pending??nextLine();pending=null;if(raw==null)break;
    const m=MOVE.exec(raw.trim());if(!m)break;
    const start=[+m[1],+m[2]];if(!firstStart)firstStart=start;if(prevEnd&&dist(prevEnd,start)<=3)connected++;
    bbox=addPoint(bbox,start);let pb=addPoint(null,start),curves=0,lines=0,current=start;used+=raw.length;
    while(true){
      const r=nextLine();if(r==null)return null;const line=r.trim();let q=CURVE_C.exec(line);
      if(q){const p1=[+q[1],+q[2]],p2=[+q[3],+q[4]],p3=[+q[5],+q[6]];for(const p of [p1,p2,p3]){bbox=addPoint(bbox,p);pb=addPoint(pb,p)}current=p3;curves++;curveCount++;used+=r.length;continue}
      q=CURVE_V.exec(line);
      if(q){const p2=[+q[1],+q[2]],p3=[+q[3],+q[4]];for(const p of [p2,p3]){bbox=addPoint(bbox,p);pb=addPoint(pb,p)}current=p3;curves++;curveCount++;used+=r.length;continue}
      q=CURVE_Y.exec(line);
      if(q){const p1=[+q[1],+q[2]],p3=[+q[3],+q[4]];for(const p of [p1,p3]){bbox=addPoint(bbox,p);pb=addPoint(pb,p)}current=p3;curves++;curveCount++;used+=r.length;continue}
      q=LINE.exec(line);
      if(q){if(lines>=1)return null;const p=[+q[1],+q[2]];if(curves<1&&dist(current,p)>3)return null;bbox=addPoint(bbox,p);pb=addPoint(pb,p);current=p;lines++;lineCount++;used+=r.length;continue}
      if(line!=='S'&&line!=='s')return null;used+=r.length;break;
    }
    if(curves<1||curves>10)return null;
    pathCount++;prevEnd=current;lastEnd=current;
    pathDiags.push(Math.hypot(pb[2]-pb[0],pb[3]-pb[1]));
    const peek=nextLine();if(peek==null)break;if(MOVE.test(peek.trim()))pending=peek;else{i-=2;break}
  }
  if(!bbox||pathCount<20||pathCount>1200)return null;
  if(curveCount<pathCount||curveCount>pathCount*10||lineCount>pathCount)return null;
  const curveShare=curveCount/Math.max(1,curveCount+lineCount);if(curveShare<0.75)return null;
  const w=bbox[2]-bbox[0],h=bbox[3]-bbox[1],diag=Math.hypot(w,h);if(Math.min(w,h)<120||Math.max(w,h)>25000)return null;
  if(Math.max(w,h)/Math.max(1,Math.min(w,h))>30)return null;
  const medianDiag=quantile(pathDiags,0.5),p90Diag=quantile(pathDiags,0.9),smallStrokeRatio=medianDiag/Math.max(1,diag);
  const connectedFraction=pathCount>1?connected/(pathCount-1):0,closedGap=firstStart&&lastEnd?dist(firstStart,lastEnd):Infinity;
  const connectedCycle=connectedFraction>=0.85&&closedGap<=3;
  const fragmentedCloud=pathCount>=24&&smallStrokeRatio<=0.12&&p90Diag<=Math.max(2000,diag*0.25);
  if(!connectedCycle&&!fragmentedCloud)return null;
  const next=tail.slice(used).trimStart();if(!next||/^(?:m|c|v|y|l|S|s)\b/.test(next))return null;
  return{end:bodyStart+used,pathCount,curveCount,lineCount,bbox,connectedFraction,closedGap,medianDiag,p90Diag,mode:connectedCycle?'connected-cycle':'fragmented-curved-block'};
}
function scanStream(text,refIndex){const out=[];RED.lastIndex=0;let m;while((m=RED.exec(text))){const bodyStart=RED.lastIndex,p=readBlock(text,bodyStart);if(p)out.push({source:SRC,refIndex,start:bodyStart,...p})}return out}
function scanPage(page){const streams=[],candidates=[];for(const ref of refs(page)){let text;try{text=toText(ref.readStream())}catch(_){continue}const refIndex=streams.length;streams.push({ref,text});candidates.push(...scanStream(text,refIndex))}return{streams,candidates}}
function pub(c){return{bbox:c.bbox,source:SRC,exactRGB:[1,0,0],vectorAdditiveFamilyProof:true,vectorAdditiveFamilyMode:`red-geometric-cloud-${c.mode}-v15`,vectorAdditiveFamilyPathCount:c.pathCount,vectorAdditiveFamilyCurveCount:c.curveCount,vectorAdditiveFamilyLineCount:c.lineCount,vectorAdditiveFamilyConnectedFraction:c.connectedFraction,vectorAdditiveFamilyClosedGap:c.closedGap}}
function merge(a,b){const map=new Map();for(const p of [...(a||[]),...(b||[])]){const n=Number(p?.page||0);if(!n)continue;if(!map.has(n))map.set(n,[]);map.get(n).push(...(p.clouds||[]))}return[...map].map(([page,clouds])=>({page,clouds})).sort((x,y)=>x.page-y.page)}
async function detectNew(data,blockedPages=new Set()){const mupdf=await import('https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js'),doc=mupdf.PDFDocument.openDocument(new Uint8Array(data),'application/pdf'),out=[];try{for(let pi=0;pi<doc.countPages();pi++){if(blockedPages.has(pi+1))continue;const s=scanPage(doc.loadPage(pi));if(s.candidates.length===1)out.push({page:pi+1,clouds:[pub(s.candidates[0])]})}}finally{doc.destroy()}return out}
function closeBox(a,b,t=3){return Array.isArray(a)&&Array.isArray(b)&&a.length>=4&&b.length>=4&&a.slice(0,4).every((x,i)=>Math.abs(Number(x)-Number(b[i]))<=t)}
function wanted(pages){const a=[];for(const p of pages||[])for(const c of p?.clouds||[])if(c?.source===SRC&&c?.vectorAdditiveFamilyProof===true)a.push({page:Number(p.page||0),cloud:c});return a}
async function removeNew(data,pages){const exp=wanted(pages);if(!exp.length)return{data:new Uint8Array(data),removed:0,details:[]};const mupdf=await import('https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js'),doc=mupdf.PDFDocument.openDocument(new Uint8Array(data),'application/pdf'),details=[];let removed=0;try{for(const e of exp){if(e.page<1||e.page>doc.countPages())continue;const page=doc.loadPage(e.page-1),s=scanPage(page),ms=s.candidates.filter(c=>c.pathCount===Number(e.cloud.vectorAdditiveFamilyPathCount||0)&&c.curveCount===Number(e.cloud.vectorAdditiveFamilyCurveCount||0)&&c.lineCount===Number(e.cloud.vectorAdditiveFamilyLineCount||0)&&closeBox(c.bbox,e.cloud.bbox,3));if(ms.length!==1){details.push({removed:false,page:e.page,reason:`${SRC}: revalidación=${ms.length}`});continue}const c=ms[0],st=s.streams[c.refIndex];st.ref.writeStream(toBytes(st.text.slice(0,c.start)+'\n'+st.text.slice(c.end)));if(scanPage(page).candidates.some(v=>v.pathCount===c.pathCount&&v.curveCount===c.curveCount&&v.lineCount===c.lineCount&&closeBox(v.bbox,c.bbox,3)))throw new Error('geometric cloud block persiste');removed++;details.push({removed:true,page:e.page,source:SRC,mode:c.mode,paths:c.pathCount,curves:c.curveCount,lines:c.lineCount})}if(!removed)return{data:new Uint8Array(data),removed:0,details};const buf=doc.saveToBuffer('garbage=4,compress=yes,appearance=yes');return{data:new Uint8Array(buf.asUint8Array()),removed,details}}catch(err){return{data:new Uint8Array(data),removed:0,details:[...details,{removed:false,reason:err?.message||String(err)}]}}finally{doc.destroy()}}
export async function detectAdditiveRevisionCloudFamilies(data,context={}){const base=await detectV14(data,context),blocked=new Set((base||[]).filter(p=>(p?.clouds||[]).length).map(p=>Number(p.page||0)));return merge(base,await detectNew(data,blocked))}
export async function removeAdditiveRevisionCloudFamilies(data,pages,options={}){const first=await removeNew(data,pages);const second=await removeV14(first.data,pages,options);return{data:second.data,removed:Number(first.removed||0)+Number(second.removed||0),details:[...(first.details||[]),...(second.details||[])]}}
