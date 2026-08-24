// Additive revision-cloud families v6.
// Stable Families A/B/C/D/E run unchanged through v5.
// Family F is strict and independent: a dedicated red OCG made only of repeated
// Revit-style transformed polyline strokes. No text, images, fills or extra operators.
import {
  detectAdditiveRevisionCloudFamilies as detectV5,
  removeAdditiveRevisionCloudFamilies as removeV5
} from './revision-cloud-additive-families-v5.js?v=20260824-revitinherit1';

const SRC='vector-revit-red-ocg-transformed-polyline-cloud';
const NUM='[-+]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)';
const same=(a,b,t=1e-4)=>Math.abs(Number(a)-Number(b))<=t;
const union=(a,b)=>a?[Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[2],b[2]),Math.max(a[3],b[3])]:b.slice();
function diag(stage,extra={}){try{window.__cloudDiagnostic?.({stage,detail:'additive-cloud-family-f-red-ocg-polyline-v1',...extra})}catch(_){}}
function toText(buf){const b=buf?.asUint8Array?buf.asUint8Array():buf;let s='';for(let i=0;i<b.length;i+=0x8000)s+=String.fromCharCode(...b.subarray(i,Math.min(b.length,i+0x8000)));return s}
function toBytes(s){const b=new Uint8Array(s.length);for(let i=0;i<s.length;i++)b[i]=s.charCodeAt(i)&255;return b}
function resolve(o){try{return o?.resolve?.()||o}catch(_){return o}}
function streamRef(o){try{if(o?.isStream?.())return o;const r=resolve(o);return r?.isStream?.()?r:o}catch(_){return o}}
function refs(page){try{const c=page.getObject()?.get?.('Contents');if(!c)return[];if(c?.isArray?.())return Array.from({length:Number(c.length||0)},(_,i)=>streamRef(c.get(i))).filter(x=>x?.isStream?.());const s=streamRef(c);return s?.isStream?.()?[s]:[]}catch(_){return[]}}
function tx(x,y,a,b,c,d,e,f){return[x*a+y*c+e,x*b+y*d+f]}
function ocgBlocks(text){const re=/\/OC\s+\/([A-Za-z][A-Za-z0-9_.-]*)\s+BDC([\s\S]*?)EMC/g,out=[];let m;while((m=re.exec(text))){if(/\b(?:BDC|BMC|EMC)\b/.test(m[2]))continue;out.push({name:m[1],start:m.index,end:re.lastIndex,body:m[2]})}return out}
function proof(body,b){
  if(!/^oc\d+$/i.test(b.name))return null;
  const p=new RegExp(`^\\s*(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+rg\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+RG\\s+(${NUM})\\s+w`),m=p.exec(body);
  if(!m)return null;
  const fill=[+m[1],+m[2],+m[3]],stroke=[+m[4],+m[5],+m[6]],w=+m[7];
  if(!same(fill[0],1,5e-4)||!same(fill[1],0,5e-4)||!same(fill[2],0,5e-4)||!same(stroke[0],1,5e-4)||!same(stroke[1],0,5e-4)||!same(stroke[2],0,5e-4)||Math.abs(w)>0.01)return null;
  let rest=body.slice(m[0].length),count=0,bbox=null,outer=null,minLines=1e9,maxLines=0;
  const g=new RegExp(`^\\s*q\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+cm\\s+q\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+cm\\s+(${NUM})\\s+(${NUM})\\s+m((?:\\s+${NUM}\\s+${NUM}\\s+l){4,12})\\s+S\\s+Q\\s+Q`);
  for(;;){
    const x=g.exec(rest);if(!x)break;
    const a=x.slice(1,7).map(Number),z=x.slice(7,13).map(Number);
    if(!(a[0]>0.001&&a[0]<0.5&&same(a[0],a[3],1e-5)&&Math.abs(a[1])<1e-6&&Math.abs(a[2])<1e-6&&Math.abs(a[4])<1e-6&&Math.abs(a[5])<1e-6))return null;
    if(!(same(z[0],1,1e-5)&&Math.abs(z[1])<1e-6&&Math.abs(z[2])<1e-6&&same(z[3],1,1e-5)))return null;
    if(!outer)outer=a;else if(!a.every((v,i)=>same(v,outer[i],1e-6)))return null;
    const nums=(x[15].match(new RegExp(NUM,'g'))||[]).map(Number),pts=[[+x[13],+x[14]]];
    for(let i=0;i+1<nums.length;i+=2)pts.push([nums[i],nums[i+1]]);
    const lines=pts.length-1;minLines=Math.min(minLines,lines);maxLines=Math.max(maxLines,lines);
    for(const q of pts){const q1=tx(q[0],q[1],...z),q2=tx(q1[0],q1[1],...a);bbox=union(bbox,[q2[0],q2[1],q2[0],q2[1]])}
    count++;rest=rest.slice(x[0].length);
  }
  if(rest.trim()!==''||count<100||count>5000||minLines<4||maxLines>12||maxLines-minLines>6||!bbox)return null;
  if(Math.min(bbox[2]-bbox[0],bbox[3]-bbox[1])<20)return null;
  return{source:SRC,name:b.name,start:b.start,end:b.end,pathCount:count,bbox,fill,stroke,lineWidth:w,outer,minLines,maxLines};
}
function scanPage(page){const streams=[],candidates=[];for(const ref of refs(page)){let text;try{text=toText(ref.readStream())}catch(_){continue}const refIndex=streams.length;streams.push({ref,text});for(const b of ocgBlocks(text)){const c=proof(b.body,b);if(c)candidates.push({...c,refIndex})}}return{streams,candidates}}
function pub(c){return{bbox:c.bbox,source:SRC,exactRGB:c.stroke,exactLineWidth:c.lineWidth,vectorAdditiveFamilyProof:true,vectorAdditiveFamilyMode:'revit-red-ocg-transformed-polyline-cloud',vectorAdditiveFamilyOcgName:c.name,vectorAdditiveFamilyPathCount:c.pathCount,vectorAdditiveFamilyOuterMatrix:c.outer,vectorAdditiveFamilyMinLines:c.minLines,vectorAdditiveFamilyMaxLines:c.maxLines}}
async function detectF(data,context={}){
  const mupdf=await import('https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js'),doc=mupdf.PDFDocument.openDocument(new Uint8Array(data),'application/pdf'),out=[];
  try{for(let pi=0;pi<doc.countPages();pi++){const s=scanPage(doc.loadPage(pi));if(s.candidates.length===1)out.push({page:pi+1,clouds:[pub(s.candidates[0])]})}}finally{doc.destroy()}
  const n=out.reduce((a,p)=>a+(p.clouds?.length||0),0),file=String(context.file||'');
  diag(n?'cloud.additive.f.detect.accept':'cloud.additive.f.detect.reject',{file,entries:n,reason:n?'OCG rojo dedicado · ancho cero · solo polilíneas transformadas repetitivas':'familia F estructural=0'});
  return out;
}
function flatten(pages){const a=[];for(const p of pages||[])for(const c of p?.clouds||[])if(c?.source===SRC&&c?.vectorAdditiveFamilyProof===true)a.push({page:Number(p.page||0),cloud:c});return a}
function closeBox(a,b,t=2){return Array.isArray(a)&&Array.isArray(b)&&a.length>=4&&b.length>=4&&a.slice(0,4).every((x,i)=>Math.abs(Number(x)-Number(b[i]))<=t)}
function closeArr(a,b,t=1e-6){return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((x,i)=>Math.abs(Number(x)-Number(b[i]))<=t)}
async function removeF(data,pages,options={}){
  const expected=flatten(pages);if(!expected.length)return{data:new Uint8Array(data),removed:0,details:[]};
  const mupdf=await import('https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js'),doc=mupdf.PDFDocument.openDocument(new Uint8Array(data),'application/pdf'),details=[];let removed=0;
  try{
    for(const e of expected){
      if(e.page<1||e.page>doc.countPages())continue;
      const page=doc.loadPage(e.page-1),s=scanPage(page),matches=s.candidates.filter(c=>c.name===String(e.cloud.vectorAdditiveFamilyOcgName||'')&&c.pathCount===Number(e.cloud.vectorAdditiveFamilyPathCount||0)&&closeBox(c.bbox,e.cloud.bbox,2)&&closeArr(c.outer,e.cloud.vectorAdditiveFamilyOuterMatrix||[],1e-6)&&c.minLines===Number(e.cloud.vectorAdditiveFamilyMinLines||0)&&c.maxLines===Number(e.cloud.vectorAdditiveFamilyMaxLines||0));
      if(matches.length!==1){details.push({removed:false,page:e.page,reason:`${SRC}: revalidación candidatos=${matches.length}`});continue}
      const c=matches[0],st=s.streams[c.refIndex];if(!st)continue;
      st.ref.writeStream(toBytes(st.text.slice(0,c.start)+'\n'+st.text.slice(c.end)));
      const verify=scanPage(page);if(verify.candidates.some(v=>v.name===c.name&&v.pathCount===c.pathCount))throw new Error('familia F: OCG persiste tras borrado');
      removed++;details.push({removed:true,page:e.page,mode:'revit-red-ocg-transformed-polyline-cloud',source:SRC,ocg:c.name,paths:c.pathCount,proof:'dedicated-ocg-pure-red-zero-width-transformed-polyline-only'});
    }
    if(!removed)return{data:new Uint8Array(data),removed:0,details};
    const buf=doc.saveToBuffer('garbage=4,compress=yes,appearance=yes'),out=buf?.asUint8Array?new Uint8Array(buf.asUint8Array()):new Uint8Array(buf);
    diag('cloud.additive.f.remove.accept',{file:String(options.file||''),removed,reason:'OCG completo revalidado y retirado atómicamente'});
    return{data:out,removed,details};
  }catch(err){
    diag('cloud.additive.f.remove.error',{file:String(options.file||''),error:err?.message||String(err)});
    return{data:new Uint8Array(data),removed:0,details:[...details,{removed:false,reason:err?.message||String(err)}]};
  }finally{doc.destroy()}
}
function mergePages(a,b){const map=new Map();for(const p of [...(a||[]),...(b||[])]){const n=Number(p?.page||0);if(!n)continue;if(!map.has(n))map.set(n,[]);map.get(n).push(...(p.clouds||[]))}return[...map].map(([page,clouds])=>({page,clouds})).sort((x,y)=>x.page-y.page)}
export async function detectAdditiveRevisionCloudFamilies(data,context={}){const base=await detectV5(data,context);if((base||[]).some(p=>Array.isArray(p?.clouds)&&p.clouds.length))return base;const f=await detectF(data,context);return mergePages(base,f)}
export async function removeAdditiveRevisionCloudFamilies(data,pages,options={}){const first=await removeV5(data,pages,options);const second=await removeF(first.data,pages,options);return{data:second.data,removed:Number(first.removed||0)+Number(second.removed||0),details:[...(first.details||[]),...(second.details||[])]}}
