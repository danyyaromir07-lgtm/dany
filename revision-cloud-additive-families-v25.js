// Compact additive revision-cloud route v25.
// Preserves stable v15 families, then scans PDF streams ONCE for both proven q/cm CAD forms:
// 1) split matrix:    q a 0 0 a 0 0 cm q 1 0 0 1 tx ty cm 0 0 m ... S Q Q
// 2) combined matrix: q a 0 0 a tx ty cm 0 0 m ... S Q
// This replaces the v16-v24 q/cm chain in the active route; older modules remain available for rollback.
import { detectAdditiveRevisionCloudFamilies as detectV15, removeAdditiveRevisionCloudFamilies as removeV15 } from './revision-cloud-additive-families-v15.js?v=20260825-geometric1';

const SRC='vector-red-exploded-qcm-compact-v25';
const WS=c=>c===0||c===9||c===10||c===12||c===13||c===32;
const ascii=(b,s,e)=>{let out='';for(let i=s;i<e;i++)out+=String.fromCharCode(b[i]);return out};
const skip=(b,i)=>{while(i<b.length){if(WS(b[i])){i++;continue}if(b[i]===37){while(i<b.length&&b[i]!==10&&b[i]!==13)i++;continue}break}return i};
function tok(b,i){i=skip(b,i);if(i>=b.length)return null;const s=i;while(i<b.length&&!WS(b[i])&&b[i]!==37)i++;return{s,e:i,t:ascii(b,s,i)}}
function num(t){if(!t||!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(t.t))return null;const n=Number(t.t);return Number.isFinite(n)?n:null}
function expect(b,i,v){const t=tok(b,i);return t&&t.t===v?t:null}
function matrix(b,i){const vals=[];for(let k=0;k<6;k++){const t=tok(b,i),n=num(t);if(n===null)return null;vals.push(n);i=t.e}const cm=expect(b,i,'cm');return cm?{vals,end:cm.e}:null}
const same=(a,b,t=1e-9)=>Math.abs(Number(a)-Number(b))<=t;
const add=(r,x,y)=>r?[Math.min(r[0],x),Math.min(r[1],y),Math.max(r[2],x),Math.max(r[3],y)]:[x,y,x,y];
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function median(a){if(!a.length)return 0;const s=[...a].sort((x,y)=>x-y),m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2}

function parseFragment(bytes,i){
  let t=expect(bytes,i,'q');if(!t)return null;i=t.e;
  const m1=matrix(bytes,i);if(!m1)return null;i=m1.end;
  const[a,b,c,d,e,f]=m1.vals;
  if(!same(a,d)||!same(b,0)||!same(c,0)||!(a>0&&a<10)||!Number.isFinite(e)||!Number.isFinite(f))return null;

  let mode='combined',tx=e,ty=f,closeCount=1;
  const next=tok(bytes,i);
  if(same(e,0)&&same(f,0)&&next?.t==='q'){
    i=next.e;
    const m2=matrix(bytes,i);if(!m2)return null;i=m2.end;
    const[a2,b2,c2,d2,e2,f2]=m2.vals;
    if(!same(a2,1)||!same(b2,0)||!same(c2,0)||!same(d2,1)||!Number.isFinite(e2)||!Number.isFinite(f2))return null;
    mode='split';tx=e2;ty=f2;closeCount=2;
  }

  const x0=tok(bytes,i),y0=x0&&tok(bytes,x0.e),mop=y0&&expect(bytes,y0.e,'m');
  if(num(x0)!==0||num(y0)!==0||!mop)return null;i=mop.e;

  const origin=mode==='split'?[tx*a,ty*a]:[tx,ty];
  const mapPoint=(x,y)=>mode==='split'?[(tx+x)*a,(ty+y)*a]:[tx+x*a,ty+y*a];
  let bbox=add(null,origin[0],origin[1]),cur=origin.slice(),curves=0,lines=0,nums=[];
  const point=(x,y)=>{const p=mapPoint(x,y);bbox=add(bbox,p[0],p[1]);cur=p};

  while(true){
    const q=tok(bytes,i);if(!q)return null;i=q.e;
    if(q.t==='S')break;
    const n=num(q);if(n!==null){nums.push(n);continue}
    if(q.t==='c'){
      if(nums.length<6)return null;const v=nums.slice(-6);for(let k=0;k<6;k+=2)point(v[k],v[k+1]);cur=mapPoint(v[4],v[5]);curves++;nums=[];continue;
    }
    if(q.t==='v'||q.t==='y'){
      if(nums.length<4)return null;const v=nums.slice(-4);for(let k=0;k<4;k+=2)point(v[k],v[k+1]);cur=mapPoint(v[2],v[3]);curves++;nums=[];continue;
    }
    if(q.t==='l'){
      if(nums.length<2)return null;const v=nums.slice(-2);point(v[0],v[1]);lines++;nums=[];continue;
    }
    if(q.t==='h'&&nums.length===0)continue;
    return null;
  }
  for(let k=0;k<closeCount;k++){const Q=expect(bytes,i,'Q');if(!Q)return null;i=Q.e}
  return{end:i,mode,scale:a,startPoint:origin,endPoint:cur,bbox,curves,lines};
}

function prevTok(b,i){i--;while(i>=0&&WS(b[i]))i--;if(i<0)return null;const e=i+1;while(i>=0&&!WS(b[i]))i--;return{s:i+1,e,t:ascii(b,i+1,e)}}
function redOffsets(b){const out=[];for(let i=0;i+1<b.length;i++){if(b[i]!==82||b[i+1]!==71)continue;if(i>0&&!WS(b[i-1]))continue;if(i+2<b.length&&!WS(b[i+2]))continue;const z=prevTok(b,i),y=z&&prevTok(b,z.s),x=y&&prevTok(b,y.s);if(num(x)===1&&num(y)===0&&num(z)===0)out.push({start:x.s,end:i+2})}return out}

function readRun(b,start,end){
  let pos=end,bbox=null,paths=0,curves=0,lines=0,connected=0,prev=null,diags=[],mode=null;
  while(pos<b.length){
    const f=parseFragment(b,pos);if(!f)break;
    if(f.curves<1||f.curves>12||f.lines>1)break;
    if(mode&&f.mode!==mode)break;
    mode=f.mode;
    if(prev&&dist(prev,f.startPoint)<=Math.max(3,f.scale*8))connected++;
    prev=f.endPoint;
    bbox=bbox?[Math.min(bbox[0],f.bbox[0]),Math.min(bbox[1],f.bbox[1]),Math.max(bbox[2],f.bbox[2]),Math.max(bbox[3],f.bbox[3])]:f.bbox.slice();
    paths++;curves+=f.curves;lines+=f.lines;diags.push(Math.hypot(f.bbox[2]-f.bbox[0],f.bbox[3]-f.bbox[1]));pos=f.end;
  }
  if(paths<50||curves<100||lines>Math.max(5,Math.floor(paths*.05))||!bbox)return null;
  const w=bbox[2]-bbox[0],h=bbox[3]-bbox[1],diag=Math.hypot(w,h);
  if(Math.min(w,h)<100||Math.max(w,h)>25000||Math.max(w,h)/Math.max(1,Math.min(w,h))>30)return null;
  const conn=paths>1?connected/(paths-1):0;
  if(conn<.85||median(diags)/Math.max(1,diag)>.12)return null;
  return{start,end:pos,mode,pathCount:paths,curveCount:curves,lineCount:lines,bbox,connectedFraction:conn};
}

function scanObjects(doc){
  const out=[],stats={objects:0,streams:0,readable:0,errors:0,redOps:0,split:0,combined:0};
  try{stats.objects=Number(doc.countObjects?.()||0)}catch(_){return{out,stats}}
  for(let xref=1;xref<stats.objects;xref++){
    try{
      const ref=doc.newIndirect(xref,0);if(!ref?.isStream?.())continue;
      stats.streams++;
      const bytes=new Uint8Array(ref.readStream().asUint8Array());stats.readable++;
      const reds=redOffsets(bytes);stats.redOps+=reds.length;
      for(const r of reds){const c=readRun(bytes,r.start,r.end);if(c){stats[c.mode]++;out.push({...c,xref,stream:ref,bytes})}}
    }catch(_){stats.errors++}
  }
  return{out,stats};
}

const close=(a,b,t=3)=>Array.isArray(a)&&Array.isArray(b)&&a.length>=4&&b.length>=4&&a.slice(0,4).every((v,i)=>Math.abs(Number(v)-Number(b[i]))<=t);
function pageFor(doc,c){
  if(doc.countPages()===1)return 1;
  for(let pi=0;pi<doc.countPages();pi++){
    try{
      const pageObj=doc.loadPage(pi).getObject?.();const resolved=pageObj?.resolve?.()||pageObj;const raw=resolved?.get?.('Contents');
      if(raw?.isIndirect?.()&&Number(raw.asIndirect?.())===c.xref)return pi+1;
      const rr=raw?.resolve?.()||raw;
      if(rr?.isArray?.())for(let i=0;i<Number(rr.length||0);i++){const r=rr.get(i);if(r?.isIndirect?.()&&Number(r.asIndirect?.())===c.xref)return pi+1}
    }catch(_){}
  }
  return 0;
}
const pub=(c,page)=>({bbox:c.bbox,source:SRC,exactRGB:[1,0,0],vectorAdditiveFamilyProof:true,vectorAdditiveFamilyMode:`red-exploded-qcm-${c.mode}-v25`,vectorAdditiveFamilyPathCount:c.pathCount,vectorAdditiveFamilyCurveCount:c.curveCount,vectorAdditiveFamilyLineCount:c.lineCount,vectorAdditiveFamilyConnectedFraction:c.connectedFraction,vectorAdditiveFamilyMatrixMode:c.mode,vectorObjectXref:c.xref,page});
function merge(a,b){const map=new Map();for(const p of [...(a||[]),...(b||[])]){const page=Number(p?.page||0);if(!page)continue;if(!map.has(page))map.set(page,[]);const arr=map.get(page);for(const c of p.clouds||[])if(!arr.some(x=>close(x?.bbox,c?.bbox)))arr.push(c)}return[...map].map(([page,clouds])=>({page,clouds})).sort((x,y)=>x.page-y.page)}
function diag(stage,extra={}){try{window.__cloudDiagnostic?.({stage,detail:'additive-qcm-v25-compact-single-scan',...extra})}catch(_){}}
function spliceBytes(src,start,end){const out=new Uint8Array(src.length-(end-start)+1);out.set(src.subarray(0,start),0);out[start]=10;out.set(src.subarray(end),start+1);return out}

async function detectNew(data,context={}){
  const mupdf=await import('https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js'),doc=mupdf.PDFDocument.openDocument(new Uint8Array(data),'application/pdf');
  try{
    const {out,stats}=scanObjects(doc);
    diag('cloud.qcm25.inspect',{file:context.file,candidates:out.length,groups:out.length,reason:`objetos=${stats.objects} streams=${stats.streams} legibles=${stats.readable} errores=${stats.errors} RGrojos=${stats.redOps} split=${stats.split} combined=${stats.combined}`});
    // Keep the same conservative publication rule used by the recent q/cm fallback: one unambiguous family.
    if(out.length!==1)return[];
    const page=pageFor(doc,out[0]);return page?[{page,clouds:[pub(out[0],page)]}]:[];
  }finally{doc.destroy()}
}

async function removeNew(data,pages){
  const wanted=[];for(const p of pages||[])for(const c of p?.clouds||[])if(c?.source===SRC&&c?.vectorAdditiveFamilyProof===true)wanted.push(c);
  if(wanted.length!==1)return{data:new Uint8Array(data),removed:0,details:[]};
  const mupdf=await import('https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js'),doc=mupdf.PDFDocument.openDocument(new Uint8Array(data),'application/pdf');
  try{
    const {out}=scanObjects(doc),w=wanted[0],ms=out.filter(c=>c.xref===Number(w.vectorObjectXref)&&c.mode===String(w.vectorAdditiveFamilyMatrixMode||'')&&c.pathCount===Number(w.vectorAdditiveFamilyPathCount)&&c.curveCount===Number(w.vectorAdditiveFamilyCurveCount)&&c.lineCount===Number(w.vectorAdditiveFamilyLineCount)&&close(c.bbox,w.bbox));
    if(ms.length!==1)return{data:new Uint8Array(data),removed:0,details:[{removed:false,reason:`${SRC}: revalidación=${ms.length}`}]};
    const c=ms[0];c.stream.writeStream(spliceBytes(c.bytes,c.start,c.end));
    const b=doc.saveToBuffer('garbage=4,compress=yes,appearance=yes'),outBytes=new Uint8Array(b.asUint8Array()),check=mupdf.PDFDocument.openDocument(outBytes,'application/pdf');
    try{
      const remain=scanObjects(check).out.some(x=>x.mode===c.mode&&x.pathCount===c.pathCount&&x.curveCount===c.curveCount&&x.lineCount===c.lineCount&&close(x.bbox,c.bbox));
      if(remain)return{data:new Uint8Array(data),removed:0,details:[{removed:false,reason:`${SRC}: verificación posterior falló`}]};
    }finally{check.destroy()}
    return{data:outBytes,removed:1,details:[{removed:true,source:SRC,xref:c.xref,mode:c.mode,paths:c.pathCount,curves:c.curveCount,lines:c.lineCount}]};
  }catch(err){return{data:new Uint8Array(data),removed:0,details:[{removed:false,reason:err?.message||String(err)}]}}
  finally{doc.destroy()}
}

export async function detectAdditiveRevisionCloudFamilies(data,context={}){
  const [base,newOnes]=await Promise.all([detectV15(data,context),detectNew(data,context)]);
  return merge(base,newOnes);
}
export async function removeAdditiveRevisionCloudFamilies(data,pages,options={}){
  const first=await removeNew(data,pages);
  const second=await removeV15(first.data,pages,options);
  return{data:second.data,removed:Number(first.removed||0)+Number(second.removed||0),details:[...(first.details||[]),...(second.details||[])]};
}
if(typeof window!=='undefined')window.__revisionCloudAdditiveV25={version:'25-compact-single-scan1'};
