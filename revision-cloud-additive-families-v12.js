// Additive revision-cloud families v12.
// Stable v11 families remain unchanged.
// v12 adds one strict multi-loop Bezier variant that permits PDF cubic shorthand operator v.
// Safety: exact red stroke; isolated contiguous path block; every path is m + exactly 2 or 3 cubic commands (c or v) + S;
// at least one v is mandatory, preventing overlap with the stable c-only v11 family.
// The RG color operator is deliberately preserved; only the proven Bezier path body is removed.
import {
  detectAdditiveRevisionCloudFamilies as detectV11,
  removeAdditiveRevisionCloudFamilies as removeV11
} from './revision-cloud-additive-families-v11.js?v=20260825-multiloop1';

const SRC='vector-red-multiloop-bezier-cv-block';
const NUM='[-+]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)';
const RED=new RegExp(`(?:^|\\n)(1(?:\\.0+)?\\s+0(?:\\.0+)?\\s+0(?:\\.0+)?\\s+RG\\s*)`,'g');
const MOVE=new RegExp(`^(${NUM})\\s+(${NUM})\\s+m$`);
const CURVE_C=new RegExp(`^(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+c$`);
const CURVE_V=new RegExp(`^(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+v$`);
const union=(a,p)=>a?[Math.min(a[0],p[0]),Math.min(a[1],p[1]),Math.max(a[2],p[0]),Math.max(a[3],p[1])]:[p[0],p[1],p[0],p[1]];
function toText(buf){const b=buf?.asUint8Array?buf.asUint8Array():buf;let s='';for(let i=0;i<b.length;i+=0x8000)s+=String.fromCharCode(...b.subarray(i,Math.min(b.length,i+0x8000)));return s}
function toBytes(s){const b=new Uint8Array(s.length);for(let i=0;i<s.length;i++)b[i]=s.charCodeAt(i)&255;return b}
function resolve(o){try{return o?.resolve?.()||o}catch(_){return o}}
function streamRef(o){try{if(o?.isStream?.())return o;const r=resolve(o);return r?.isStream?.()?r:o}catch(_){return o}}
function refs(page){try{const c=page.getObject()?.get?.('Contents');if(!c)return[];if(c?.isArray?.())return Array.from({length:Number(c.length||0)},(_,i)=>streamRef(c.get(i))).filter(x=>x?.isStream?.());const s=streamRef(c);return s?.isStream?.()?[s]:[]}catch(_){return[]}}
function readBlock(text,bodyStart){
  const tail=text.slice(bodyStart),lines=tail.split(/(?<=\\n)/);let used=0,pathCount=0,curveCount=0,vCount=0,bbox=null;
  for(let i=0;i<lines.length;){
    const raw=lines[i],s=raw.trim(),m=MOVE.exec(s);if(!m)break;
    let curves=0,current=[+m[1],+m[2]];bbox=union(bbox,current);used+=raw.length;i++;
    while(i<lines.length){
      const line=lines[i].trim();let q=CURVE_C.exec(line);
      if(q){const p1=[+q[1],+q[2]],p2=[+q[3],+q[4]],p3=[+q[5],+q[6]];bbox=union(union(union(bbox,p1),p2),p3);current=p3;curves++;curveCount++;used+=lines[i].length;i++;continue}
      q=CURVE_V.exec(line);
      if(q){const p2=[+q[1],+q[2]],p3=[+q[3],+q[4]];bbox=union(union(bbox,current),p2);bbox=union(bbox,p3);current=p3;curves++;curveCount++;vCount++;used+=lines[i].length;i++;continue}
      break;
    }
    if(curves<2||curves>3||i>=lines.length||lines[i].trim()!=='S')return null;
    used+=lines[i].length;i++;pathCount++;
  }
  if(vCount<1||pathCount<80||pathCount>1000||curveCount<pathCount*2||curveCount>pathCount*3||!bbox)return null;
  const w=bbox[2]-bbox[0],h=bbox[3]-bbox[1];if(Math.min(w,h)<300||Math.max(w,h)>25000)return null;
  const aspect=Math.max(w,h)/Math.max(1,Math.min(w,h));if(aspect>20)return null;
  const next=tail.slice(used).trimStart();if(!next||/^(?:m|c|v|l|S)\\b/.test(next))return null;
  return{end:bodyStart+used,pathCount,curveCount,vCount,bbox};
}
function scanStream(text,refIndex){const out=[];RED.lastIndex=0;let m;while((m=RED.exec(text))){const bodyStart=RED.lastIndex,p=readBlock(text,bodyStart);if(p)out.push({source:SRC,refIndex,start:bodyStart,...p})}return out}
function scanPage(page){const streams=[],candidates=[];for(const ref of refs(page)){let text;try{text=toText(ref.readStream())}catch(_){continue}const refIndex=streams.length;streams.push({ref,text});candidates.push(...scanStream(text,refIndex))}return{streams,candidates}}
function pub(c){return{bbox:c.bbox,source:SRC,exactRGB:[1,0,0],vectorAdditiveFamilyProof:true,vectorAdditiveFamilyMode:'red-multiloop-bezier-cv-block-v1',vectorAdditiveFamilyPathCount:c.pathCount,vectorAdditiveFamilyCurveCount:c.curveCount,vectorAdditiveFamilyVCount:c.vCount}}
function merge(a,b){const map=new Map();for(const p of [...(a||[]),...(b||[])]){const n=Number(p?.page||0);if(!n)continue;if(!map.has(n))map.set(n,[]);map.get(n).push(...(p.clouds||[]))}return[...map].map(([page,clouds])=>({page,clouds})).sort((x,y)=>x.page-y.page)}
async function detectNew(data){const mupdf=await import('https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js'),doc=mupdf.PDFDocument.openDocument(new Uint8Array(data),'application/pdf'),out=[];try{for(let pi=0;pi<doc.countPages();pi++){const s=scanPage(doc.loadPage(pi));if(s.candidates.length===1)out.push({page:pi+1,clouds:[pub(s.candidates[0])]})}}finally{doc.destroy()}return out}
function closeBox(a,b,t=3){return Array.isArray(a)&&Array.isArray(b)&&a.length>=4&&b.length>=4&&a.slice(0,4).every((x,i)=>Math.abs(Number(x)-Number(b[i]))<=t)}
function wanted(pages){const a=[];for(const p of pages||[])for(const c of p?.clouds||[])if(c?.source===SRC&&c?.vectorAdditiveFamilyProof===true)a.push({page:Number(p.page||0),cloud:c});return a}
async function removeNew(data,pages){const exp=wanted(pages);if(!exp.length)return{data:new Uint8Array(data),removed:0,details:[]};const mupdf=await import('https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js'),doc=mupdf.PDFDocument.openDocument(new Uint8Array(data),'application/pdf'),details=[];let removed=0;try{for(const e of exp){if(e.page<1||e.page>doc.countPages())continue;const page=doc.loadPage(e.page-1),s=scanPage(page),ms=s.candidates.filter(c=>c.pathCount===Number(e.cloud.vectorAdditiveFamilyPathCount||0)&&c.curveCount===Number(e.cloud.vectorAdditiveFamilyCurveCount||0)&&c.vCount===Number(e.cloud.vectorAdditiveFamilyVCount||0)&&closeBox(c.bbox,e.cloud.bbox,3));if(ms.length!==1){details.push({removed:false,page:e.page,reason:`${SRC}: revalidación=${ms.length}`});continue}const c=ms[0],st=s.streams[c.refIndex];st.ref.writeStream(toBytes(st.text.slice(0,c.start)+'\\n'+st.text.slice(c.end)));if(scanPage(page).candidates.some(v=>v.pathCount===c.pathCount&&v.curveCount===c.curveCount&&v.vCount===c.vCount&&closeBox(v.bbox,c.bbox,3)))throw new Error('multi-loop Bezier c/v cloud block persiste');removed++;details.push({removed:true,page:e.page,source:SRC,paths:c.pathCount,curves:c.curveCount,v:c.vCount})}if(!removed)return{data:new Uint8Array(data),removed:0,details};const buf=doc.saveToBuffer('garbage=4,compress=yes,appearance=yes');return{data:new Uint8Array(buf.asUint8Array()),removed,details}}catch(err){return{data:new Uint8Array(data),removed:0,details:[...details,{removed:false,reason:err?.message||String(err)}]}}finally{doc.destroy()}}
export async function detectAdditiveRevisionCloudFamilies(data,context={}){return merge(await detectV11(data,context),await detectNew(data))}
export async function removeAdditiveRevisionCloudFamilies(data,pages,options={}){const first=await removeNew(data,pages);const second=await removeV11(first.data,pages,options);return{data:second.data,removed:Number(first.removed||0)+Number(second.removed||0),details:[...(first.details||[]),...(second.details||[])]}}
