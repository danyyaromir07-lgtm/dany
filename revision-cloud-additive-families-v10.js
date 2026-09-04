// Additive revision-cloud families v10.
// Stable v9 families remain unchanged.
// v10 adds one strict terminal fragmented Bezier cloud family observed in CAD-exported sheets.
// Safety: candidate must be exact red, be the final graphics block before a terminal Q,
// contain only connected m/l/c/S paths, be a closed loop, and contain many cubic curves.
import {
  detectAdditiveRevisionCloudFamilies as detectV9,
  removeAdditiveRevisionCloudFamilies as removeV9
} from './revision-cloud-additive-families-v9.js?v=20260824-standalonedirect1';

const SRC='vector-terminal-red-fragmented-bezier-cloud';
const NUM='[-+]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)';
const RED=new RegExp(`(?:^|\\n)(1(?:\\.0+)?\\s+0(?:\\.0+)?\\s+0(?:\\.0+)?\\s+RG\\s*)`,'g');
const MOVE=new RegExp(`^(${NUM})\\s+(${NUM})\\s+m$`);
const LINE=new RegExp(`^(${NUM})\\s+(${NUM})\\s+l$`);
const CURVE=new RegExp(`^(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+c$`);
const dist=(a,b)=>Math.hypot(Number(a[0])-Number(b[0]),Number(a[1])-Number(b[1]));
const union=(a,p)=>a?[Math.min(a[0],p[0]),Math.min(a[1],p[1]),Math.max(a[2],p[0]),Math.max(a[3],p[1])]:[p[0],p[1],p[0],p[1]];
function toText(buf){const b=buf?.asUint8Array?buf.asUint8Array():buf;let s='';for(let i=0;i<b.length;i+=0x8000)s+=String.fromCharCode(...b.subarray(i,Math.min(b.length,i+0x8000)));return s}
function toBytes(s){const b=new Uint8Array(s.length);for(let i=0;i<s.length;i++)b[i]=s.charCodeAt(i)&255;return b}
function resolve(o){try{return o?.resolve?.()||o}catch(_){return o}}
function streamRef(o){try{if(o?.isStream?.())return o;const r=resolve(o);return r?.isStream?.()?r:o}catch(_){return o}}
function refs(page){try{const c=page.getObject()?.get?.('Contents');if(!c)return[];if(c?.isArray?.())return Array.from({length:Number(c.length||0)},(_,i)=>streamRef(c.get(i))).filter(x=>x?.isStream?.());const s=streamRef(c);return s?.isStream?.()?[s]:[]}catch(_){return[]}}
function proof(body){
  const lines=String(body||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  if(lines.length<60||lines.length>2000)return null;
  let i=0,pathCount=0,curveCount=0,lineCount=0,bbox=null,first=null,previousEnd=null,maxGap=0;
  while(i<lines.length){
    const m=MOVE.exec(lines[i]);if(!m)return null;
    const start=[+m[1],+m[2]];bbox=union(bbox,start);if(!first)first=start;
    if(previousEnd){const gap=dist(previousEnd,start);maxGap=Math.max(maxGap,gap);if(gap>2)return null}
    i++;let commands=0,end=start,hasCurve=false;
    while(i<lines.length&&lines[i]!=='S'){
      let q=LINE.exec(lines[i]);
      if(q){end=[+q[1],+q[2]];bbox=union(bbox,end);lineCount++;commands++;i++;continue}
      q=CURVE.exec(lines[i]);
      if(q){const p1=[+q[1],+q[2]],p2=[+q[3],+q[4]],p3=[+q[5],+q[6]];bbox=union(union(union(bbox,p1),p2),p3);end=p3;curveCount++;commands++;hasCurve=true;i++;continue}
      return null;
    }
    if(i>=lines.length||lines[i]!=='S'||commands<1||!hasCurve)return null;
    i++;pathCount++;previousEnd=end;
  }
  if(pathCount<24||pathCount>240||curveCount<pathCount||curveCount>pathCount*4||lineCount>pathCount*2)return null;
  if(!first||!previousEnd||dist(previousEnd,first)>2||!bbox)return null;
  const w=bbox[2]-bbox[0],h=bbox[3]-bbox[1];
  if(Math.min(w,h)<300||Math.max(w,h)>20000)return null;
  const aspect=Math.max(w,h)/Math.max(1,Math.min(w,h));if(aspect>12)return null;
  return{pathCount,curveCount,lineCount,bbox,maxGap,closedGap:dist(previousEnd,first)};
}
function terminalCandidates(text,refIndex){
  const out=[];RED.lastIndex=0;let m;
  while((m=RED.exec(text))){
    const start=m.index+(m[0].startsWith('\n')?1:0),bodyStart=RED.lastIndex;
    const tail=text.slice(bodyStart),q=/\s+Q\s*$/.exec(tail);if(!q)continue;
    const body=tail.slice(0,q.index),p=proof(body);if(!p)continue;
    out.push({source:SRC,refIndex,start,end:bodyStart+q.index,...p});
  }
  return out;
}
function scanPage(page){const streams=[],candidates=[];for(const ref of refs(page)){let text;try{text=toText(ref.readStream())}catch(_){continue}const refIndex=streams.length;streams.push({ref,text});candidates.push(...terminalCandidates(text,refIndex))}return{streams,candidates}}
function pub(c){return{bbox:c.bbox,source:SRC,exactRGB:[1,0,0],vectorAdditiveFamilyProof:true,vectorAdditiveFamilyMode:'terminal-red-fragmented-bezier-v1',vectorAdditiveFamilyPathCount:c.pathCount,vectorAdditiveFamilyCurveCount:c.curveCount,vectorAdditiveFamilyLineCount:c.lineCount,vectorAdditiveFamilyClosedGap:c.closedGap}}
function merge(a,b){const map=new Map();for(const p of [...(a||[]),...(b||[])]){const n=Number(p?.page||0);if(!n)continue;if(!map.has(n))map.set(n,[]);map.get(n).push(...(p.clouds||[]))}return[...map].map(([page,clouds])=>({page,clouds})).sort((x,y)=>x.page-y.page)}
async function detectNew(data){const mupdf=await import('https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js'),doc=mupdf.PDFDocument.openDocument(new Uint8Array(data),'application/pdf'),out=[];try{for(let pi=0;pi<doc.countPages();pi++){const s=scanPage(doc.loadPage(pi));if(s.candidates.length===1)out.push({page:pi+1,clouds:[pub(s.candidates[0])]})}}finally{doc.destroy()}return out}
function closeBox(a,b,t=3){return Array.isArray(a)&&Array.isArray(b)&&a.length>=4&&b.length>=4&&a.slice(0,4).every((x,i)=>Math.abs(Number(x)-Number(b[i]))<=t)}
function wanted(pages){const a=[];for(const p of pages||[])for(const c of p?.clouds||[])if(c?.source===SRC&&c?.vectorAdditiveFamilyProof===true)a.push({page:Number(p.page||0),cloud:c});return a}
async function removeNew(data,pages){
  const exp=wanted(pages);if(!exp.length)return{data:new Uint8Array(data),removed:0,details:[]};
  const mupdf=await import('https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js'),doc=mupdf.PDFDocument.openDocument(new Uint8Array(data),'application/pdf'),details=[];let removed=0;
  try{
    for(const e of exp){
      if(e.page<1||e.page>doc.countPages())continue;
      const page=doc.loadPage(e.page-1),s=scanPage(page),ms=s.candidates.filter(c=>c.pathCount===Number(e.cloud.vectorAdditiveFamilyPathCount||0)&&c.curveCount===Number(e.cloud.vectorAdditiveFamilyCurveCount||0)&&c.lineCount===Number(e.cloud.vectorAdditiveFamilyLineCount||0)&&closeBox(c.bbox,e.cloud.bbox,3));
      if(ms.length!==1){details.push({removed:false,page:e.page,reason:`${SRC}: revalidación=${ms.length}`});continue}
      const c=ms[0],st=s.streams[c.refIndex];
      st.ref.writeStream(toBytes(st.text.slice(0,c.start)+'\n'+st.text.slice(c.end)));
      const after=scanPage(page).candidates.filter(v=>v.pathCount===c.pathCount&&v.curveCount===c.curveCount&&closeBox(v.bbox,c.bbox,3));
      if(after.length)throw new Error('fragmented Bezier cloud persiste');
      removed++;details.push({removed:true,page:e.page,source:SRC,paths:c.pathCount,curves:c.curveCount});
    }
    if(!removed)return{data:new Uint8Array(data),removed:0,details};
    const buf=doc.saveToBuffer('garbage=4,compress=yes,appearance=yes');
    return{data:new Uint8Array(buf.asUint8Array()),removed,details};
  }catch(err){return{data:new Uint8Array(data),removed:0,details:[...details,{removed:false,reason:err?.message||String(err)}]}}
  finally{doc.destroy()}
}
export async function detectAdditiveRevisionCloudFamilies(data,context={}){return merge(await detectV9(data,context),await detectNew(data))}
export async function removeAdditiveRevisionCloudFamilies(data,pages,options={}){const first=await removeNew(data,pages);const second=await removeV9(first.data,pages,options);return{data:second.data,removed:Number(first.removed||0)+Number(second.removed||0),details:[...(first.details||[]),...(second.details||[])]}}
