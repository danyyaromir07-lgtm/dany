// Additive q/cm cloud fallback v22: byte-level PDF operator parser.
// v21 remains unchanged and runs first. This fallback avoids large-stream text serialization.
import { detectAdditiveRevisionCloudFamilies as detectV21, removeAdditiveRevisionCloudFamilies as removeV21 } from './revision-cloud-additive-families-v21.js?v=20260831-bufferstring1';

const SRC='vector-red-exploded-qcm-cloud-v22-byte-parser';
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
function parseFragment(b,i){
  let t=expect(b,i,'q');if(!t)return null;i=t.e;
  const m1=matrix(b,i);if(!m1)return null;i=m1.end;
  const[a,b0,c,d,e,f]=m1.vals;if(!same(a,d)||!same(b0,0)||!same(c,0)||!same(e,0)||!same(f,0)||!(a>0&&a<10))return null;
  t=expect(b,i,'q');if(!t)return null;i=t.e;
  const m2=matrix(b,i);if(!m2)return null;i=m2.end;
  const[a2,b2,c2,d2,tx,ty]=m2.vals;if(!same(a2,1)||!same(d2,1)||!same(b2,0)||!same(c2,0))return null;
  const x0=tok(b,i),y0=x0&&tok(b,x0.e),mop=y0&&expect(b,y0.e,'m');if(num(x0)!==0||num(y0)!==0||!mop)return null;i=mop.e;
  let bbox=add(null,tx*a,ty*a),cur=[tx*a,ty*a],curves=0,lines=0,nums=[];
  const point=(x,y)=>{const px=(tx+x)*a,py=(ty+y)*a;bbox=add(bbox,px,py);cur=[px,py]};
  while(true){const q=tok(b,i);if(!q)return null;i=q.e;if(q.t==='S')break;const n=num(q);if(n!==null){nums.push(n);continue}
    if(q.t==='c'){if(nums.length<6)return null;const v=nums.slice(-6);for(let k=0;k<6;k+=2)point(v[k],v[k+1]);cur=[(tx+v[4])*a,(ty+v[5])*a];curves++;nums=[];continue}
    if(q.t==='v'||q.t==='y'){if(nums.length<4)return null;const v=nums.slice(-4);for(let k=0;k<4;k+=2)point(v[k],v[k+1]);cur=[(tx+v[2])*a,(ty+v[3])*a];curves++;nums=[];continue}
    if(q.t==='l'){if(nums.length<2)return null;const v=nums.slice(-2);point(v[0],v[1]);lines++;nums=[];continue}
    if(q.t==='h'&&nums.length===0)continue;
    return null;
  }
  const q1=expect(b,i,'Q');if(!q1)return null;const q2=expect(b,q1.e,'Q');if(!q2)return null;
  return{end:q2.e,scale:a,startPoint:[tx*a,ty*a],endPoint:cur,bbox,curves,lines};
}
function prevTok(b,i){i--;while(i>=0&&WS(b[i]))i--;if(i<0)return null;const e=i+1;while(i>=0&&!WS(b[i]))i--;return{s:i+1,e,t:ascii(b,i+1,e)}}
function redOffsets(b){const out=[];for(let i=0;i+1<b.length;i++){if(b[i]!==82||b[i+1]!==71)continue;if(i>0&&!WS(b[i-1]))continue;if(i+2<b.length&&!WS(b[i+2]))continue;const z=prevTok(b,i),y=z&&prevTok(b,z.s),x=y&&prevTok(b,y.s);if(num(x)===1&&num(y)===0&&num(z)===0)out.push({start:x.s,end:i+2})}return out}
function readRun(b,start,end){let pos=end,bbox=null,paths=0,curves=0,lines=0,connected=0,prev=null,diags=[];while(pos<b.length){const f=parseFragment(b,pos);if(!f)break;if(f.curves<1||f.curves>12||f.lines>1)break;if(prev&&dist(prev,f.startPoint)<=Math.max(3,f.scale*8))connected++;prev=f.endPoint;bbox=bbox?[Math.min(bbox[0],f.bbox[0]),Math.min(bbox[1],f.bbox[1]),Math.max(bbox[2],f.bbox[2]),Math.max(bbox[3],f.bbox[3])]:f.bbox.slice();paths++;curves+=f.curves;lines+=f.lines;diags.push(Math.hypot(f.bbox[2]-f.bbox[0],f.bbox[3]-f.bbox[1]));pos=f.end}
  if(paths<50||curves<100||lines>Math.max(5,Math.floor(paths*.05))||!bbox)return null;const w=bbox[2]-bbox[0],h=bbox[3]-bbox[1],diag=Math.hypot(w,h);if(Math.min(w,h)<100||Math.max(w,h)>25000||Math.max(w,h)/Math.max(1,Math.min(w,h))>30)return null;const conn=paths>1?connected/(paths-1):0;if(conn<.85||median(diags)/Math.max(1,diag)>.12)return null;return{start,end:pos,pathCount:paths,curveCount:curves,lineCount:lines,bbox,connectedFraction:conn}}
function scanObjects(doc){const out=[],stats={objects:0,streams:0,readable:0,errors:0,redOps:0};try{stats.objects=Number(doc.countObjects?.()||0)}catch(_){return{out,stats}}for(let xref=1;xref<stats.objects;xref++){let ref,buf,bytes;try{ref=doc.newIndirect(xref,0);if(!ref?.isStream?.())continue;stats.streams++;buf=ref.readStream();bytes=new Uint8Array(buf.asUint8Array());stats.readable++;const reds=redOffsets(bytes);stats.redOps+=reds.length;for(const r of reds){const c=readRun(bytes,r.start,r.end);if(c)out.push({...c,xref,stream:ref,bytes})}}catch(_){stats.errors++}}return{out,stats}}
const close=(a,b,t=3)=>Array.isArray(a)&&Array.isArray(b)&&a.length>=4&&b.length>=4&&a.slice(0,4).every((v,i)=>Math.abs(Number(v)-Number(b[i]))<=t);
function pageFor(doc,c){if(doc.countPages()===1)return 1;for(let pi=0;pi<doc.countPages();pi++){try{const raw=doc.loadPage(pi).getObject()?.get?.('Contents');if(raw?.isIndirect?.()&&Number(raw.asIndirect?.())===c.xref)return pi+1;if(raw?.isArray?.())for(let i=0;i<Number(raw.length||0);i++){const r=raw.get(i);if(r?.isIndirect?.()&&Number(r.asIndirect?.())===c.xref)return pi+1}}catch(_){}}return 0}
const pub=(c,page)=>({bbox:c.bbox,source:SRC,exactRGB:[1,0,0],vectorAdditiveFamilyProof:true,vectorAdditiveFamilyMode:'red-exploded-qcm-byte-parser-v22',vectorAdditiveFamilyPathCount:c.pathCount,vectorAdditiveFamilyCurveCount:c.curveCount,vectorAdditiveFamilyLineCount:c.lineCount,vectorAdditiveFamilyConnectedFraction:c.connectedFraction,vectorObjectXref:c.xref,page});
function merge(a,b){const map=new Map();for(const p of [...(a||[]),...(b||[])]){const page=Number(p?.page||0);if(!page)continue;if(!map.has(page))map.set(page,[]);const arr=map.get(page);for(const c of p.clouds||[])if(!arr.some(x=>close(x?.bbox,c?.bbox)))arr.push(c)}return[...map].map(([page,clouds])=>({page,clouds})).sort((x,y)=>x.page-y.page)}
function diag(stage,extra={}){try{window.__cloudDiagnostic?.({stage,detail:'additive-qcm-v22-byte-parser',...extra})}catch(_){}}
function spliceBytes(src,start,end){const out=new Uint8Array(src.length-(end-start)+1);out.set(src.subarray(0,start),0);out[start]=10;out.set(src.subarray(end),start+1);return out}
async function detectNew(data,context={}){const mupdf=await import('https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js'),doc=mupdf.PDFDocument.openDocument(new Uint8Array(data),'application/pdf');try{const {out,stats}=scanObjects(doc);diag('cloud.qcm22.inspect',{file:context.file,candidates:out.length,groups:out.length,reason:`objetos=${stats.objects} streams=${stats.streams} legibles=${stats.readable} errores=${stats.errors} RGrojos=${stats.redOps}`});if(out.length!==1)return[];const page=pageFor(doc,out[0]);return page?[{page,clouds:[pub(out[0],page)]}]:[]}finally{doc.destroy()}}
async function removeNew(data,pages){const wanted=[];for(const p of pages||[])for(const c of p?.clouds||[])if(c?.source===SRC&&c?.vectorAdditiveFamilyProof===true)wanted.push(c);if(wanted.length!==1)return{data:new Uint8Array(data),removed:0,details:[]};const mupdf=await import('https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js'),doc=mupdf.PDFDocument.openDocument(new Uint8Array(data),'application/pdf');try{const {out}=scanObjects(doc),w=wanted[0],ms=out.filter(c=>c.xref===Number(w.vectorObjectXref)&&c.pathCount===Number(w.vectorAdditiveFamilyPathCount)&&c.curveCount===Number(w.vectorAdditiveFamilyCurveCount)&&c.lineCount===Number(w.vectorAdditiveFamilyLineCount)&&close(c.bbox,w.bbox));if(ms.length!==1)return{data:new Uint8Array(data),removed:0,details:[{removed:false,reason:`${SRC}: revalidación=${ms.length}`}]};const c=ms[0];c.stream.writeStream(spliceBytes(c.bytes,c.start,c.end));const b=doc.saveToBuffer('garbage=4,compress=yes,appearance=yes'),outBytes=new Uint8Array(b.asUint8Array()),check=mupdf.PDFDocument.openDocument(outBytes,'application/pdf');try{const remain=scanObjects(check).out.some(x=>x.pathCount===c.pathCount&&x.curveCount===c.curveCount&&x.lineCount===c.lineCount&&close(x.bbox,c.bbox));if(remain)return{data:new Uint8Array(data),removed:0,details:[{removed:false,reason:`${SRC}: verificación posterior falló`}]}}finally{check.destroy()}return{data:outBytes,removed:1,details:[{removed:true,source:SRC,xref:c.xref,paths:c.pathCount,curves:c.curveCount,lines:c.lineCount}]}}catch(err){return{data:new Uint8Array(data),removed:0,details:[{removed:false,reason:err?.message||String(err)}]}}finally{doc.destroy()}}
export async function detectAdditiveRevisionCloudFamilies(data,context={}){return merge(await detectV21(data,context),await detectNew(data,context))}
export async function removeAdditiveRevisionCloudFamilies(data,pages,options={}){const first=await removeNew(data,pages);const second=await removeV21(first.data,pages,options);return{data:second.data,removed:Number(first.removed||0)+Number(second.removed||0),details:[...(first.details||[]),...(second.details||[])]}}
if(typeof window!=='undefined')window.__revisionCloudAdditiveV22={version:'22-byte-parser1'};
