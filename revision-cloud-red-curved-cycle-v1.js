// Structural detector/remover for isolated red revision clouds built from short Bezier stroke paths.
// Safety model: exact red + one unique large endpoint-connected cycle + multi-curve scallops + stroke-only raw spans.
// It does not depend on a fixed lobe/path count and refuses ambiguous/multi-candidate documents.

const SRC='vector-red-curved-cycle';
const EPS=1e-6;
const MIN_PATHS=40;
const MAX_PATHS=1200;
const WS=new Set([0,9,10,12,13,32]);
const DEL=new Set([40,41,60,62,91,93,123,125,47,37]);

const same=(a,b,t=EPS)=>Math.abs(Number(a)-Number(b))<=t;
const sameRGB=(a,b,t=EPS)=>a&&b&&a.length>=3&&b.length>=3&&same(a[0],b[0],t)&&same(a[1],b[1],t)&&same(a[2],b[2],t);
const union=(a,b)=>a?[Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[2],b[2]),Math.max(a[3],b[3])]:b.slice();
const area=r=>Math.max(0,r[2]-r[0])*Math.max(0,r[3]-r[1]);
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const median=a=>{if(!a.length)return NaN;const s=[...a].sort((x,y)=>x-y),m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2;};

function diag(stage,extra={}){try{window.__cloudDiagnostic?.({stage,detail:'red-curved-cycle-v1',...extra});}catch(_){}}
function toText(buf){const bytes=buf?.asUint8Array?buf.asUint8Array():buf;let out='';for(let i=0;i<bytes.length;i+=0x8000)out+=String.fromCharCode(...bytes.subarray(i,Math.min(bytes.length,i+0x8000)));return out;}
function toBytes(s){const out=new Uint8Array(s.length);for(let i=0;i<s.length;i++)out[i]=s.charCodeAt(i)&255;return out;}
function resolve(o){try{return o?.resolve?.()||o;}catch(_){return o;}}
function streamRef(o){try{if(o?.isStream?.())return o;const r=resolve(o);return r?.isStream?.()?r:o;}catch(_){return o;}}
function refs(page){try{const c=page.getObject()?.get?.('Contents');if(!c)return[];if(c?.isArray?.())return Array.from({length:Number(c.length||0)},(_,i)=>streamRef(c.get(i))).filter(x=>x?.isStream?.());const s=streamRef(c);return s?.isStream?.()?[s]:[];}catch(_){return[];}}
function mulMatrix(a,b){return[a[0]*b[0]+a[1]*b[2],a[0]*b[1]+a[1]*b[3],a[2]*b[0]+a[3]*b[2],a[2]*b[1]+a[3]*b[3],a[4]*b[0]+a[5]*b[2]+b[4],a[4]*b[1]+a[5]*b[3]+b[5]];}
function tx(p,m){return[p[0]*m[0]+p[1]*m[2]+m[4],p[0]*m[1]+p[1]*m[3]+m[5]];}
function txRect(r,m){const p=[tx([r[0],r[1]],m),tx([r[2],r[1]],m),tx([r[0],r[3]],m),tx([r[2],r[3]],m)];return[Math.min(...p.map(x=>x[0])),Math.min(...p.map(x=>x[1])),Math.max(...p.map(x=>x[0])),Math.max(...p.map(x=>x[1]))];}
function addPoint(path,p){path.end=p;path.bbox=[Math.min(path.bbox[0],p[0]),Math.min(path.bbox[1],p[1]),Math.max(path.bbox[2],p[0]),Math.max(path.bbox[3],p[1])];}
function isWsCode(c){return WS.has(c);}
function isDelCode(c){return isWsCode(c)||DEL.has(c);}

function scanLiteral(text,i){i++;let depth=1;while(i<text.length&&depth){const c=text.charCodeAt(i);if(c===92){i+=2;continue;}if(c===40)depth++;else if(c===41)depth--;i++;}return i;}
function scanHex(text,i){i++;while(i<text.length&&text.charCodeAt(i)!==62)i++;return i<text.length?i+1:i;}
function scanArray(text,i){let depth=1;i++;while(i<text.length&&depth){const c=text.charCodeAt(i);if(c===37){while(i<text.length&&!/[\r\n]/.test(text[i]))i++;continue;}if(c===40){i=scanLiteral(text,i);continue;}if(c===60&&text.charCodeAt(i+1)!==60){i=scanHex(text,i);continue;}if(c===91){depth++;i++;continue;}if(c===93){depth--;i++;continue;}i++;}return i;}
function nextToken(text,i){
  while(i<text.length){
    const c=text.charCodeAt(i);
    if(isWsCode(c)){i++;continue;}
    if(c===37){while(i<text.length&&!/[\r\n]/.test(text[i]))i++;continue;}
    break;
  }
  if(i>=text.length)return null;
  const start=i,c=text.charCodeAt(i);
  if(c===40)return{type:'skip',start,end:scanLiteral(text,i)};
  if(c===60&&text.charCodeAt(i+1)!==60)return{type:'skip',start,end:scanHex(text,i)};
  if(c===91)return{type:'skip',start,end:scanArray(text,i)};
  if(c===47){i++;while(i<text.length&&!isDelCode(text.charCodeAt(i)))i++;return{type:'name',start,end:i,value:text.slice(start+1,i)};}
  if(c===60&&text.charCodeAt(i+1)===60)return{type:'delim',start,end:i+2,value:'<<'};
  if(c===62&&text.charCodeAt(i+1)===62)return{type:'delim',start,end:i+2,value:'>>'};
  if(DEL.has(c))return{type:'delim',start,end:i+1,value:text[i]};
  i++;while(i<text.length&&!isDelCode(text.charCodeAt(i)))i++;
  return{type:'word',start,end:i,value:text.slice(start,i)};
}
const NUMBER=/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/;

function parseRedCurves(text,refIndex){
  const records=[],stack=[];let i=0,rgb=[0,0,0],width=1,ctm=[1,0,0,1,0,0],nums=[],active=null,inText=false,unsafeInline=false;
  const clear=()=>{nums=[];};
  while(i<text.length){
    const t=nextToken(text,i);if(!t)break;i=t.end;
    if(t.type==='skip'||t.type==='name'||t.type==='delim')continue;
    const w=t.value;
    if(NUMBER.test(w)){nums.push({v:Number(w),start:t.start,end:t.end});continue;}
    if(inText){if(w==='ET')inText=false;clear();continue;}
    if(w==='BT'){inText=true;active=null;clear();continue;}
    if(w==='BI'){unsafeInline=true;break;}
    if(w==='q'){stack.push({rgb:rgb.slice(),width,ctm:ctm.slice()});if(active)active.bad=true;clear();continue;}
    if(w==='Q'){if(active)active.bad=true;if(stack.length){const s=stack.pop();rgb=s.rgb;width=s.width;ctm=s.ctm;}active=null;clear();continue;}
    if(w==='RG'&&nums.length>=3){rgb=nums.slice(-3).map(x=>x.v);clear();continue;}
    if(w==='w'&&nums.length){width=nums.at(-1).v;clear();continue;}
    if(w==='cm'&&nums.length>=6){ctm=mulMatrix(nums.slice(-6).map(x=>x.v),ctm);clear();continue;}
    if(w==='m'&&nums.length>=2){
      const p=tx([nums.at(-2).v,nums.at(-1).v],ctm);
      active={start:nums.at(-2).start,end:t.end,first:p,endPoint:p,curves:0,lines:0,closed:false,bad:false,bbox:[p[0],p[1],p[0],p[1]],rgb:rgb.slice(),width:Number(width),refIndex};
      clear();continue;
    }
    if(w==='l'&&active&&nums.length>=2){addPoint(active,tx([nums.at(-2).v,nums.at(-1).v],ctm));active.endPoint=active.end;active.lines++;clear();continue;}
    if(w==='c'&&active&&nums.length>=6){for(const k of[-6,-4,-2])addPoint(active,tx([nums.at(k).v,nums.at(k+1).v],ctm));active.endPoint=active.end;active.curves++;clear();continue;}
    if((w==='v'||w==='y')&&active&&nums.length>=4){for(const k of[-4,-2])addPoint(active,tx([nums.at(k).v,nums.at(k+1).v],ctm));active.endPoint=active.end;active.curves++;clear();continue;}
    if(w==='h'&&active){active.closed=true;clear();continue;}
    if(w==='S'&&active){
      active.end=t.end;
      if(!active.bad&&!active.closed&&active.curves>0&&active.lines===0&&sameRGB(active.rgb,[1,0,0],5e-5)&&Number.isFinite(active.width)&&active.width>0&&active.width<=1.5){
        records.push({start:active.start,end:active.end,startPoint:active.first,endPoint:active.endPoint,curves:active.curves,lines:active.lines,bbox:active.bbox.slice(),width:active.width,refIndex});
      }
      active=null;clear();continue;
    }
    if(w==='s'||w==='f'||w==='F'||w==='f*'||w==='B'||w==='B*'||w==='b'||w==='b*'||w==='n'||w==='re'){active=null;clear();continue;}
    if(active)active.bad=true;
    clear();
  }
  return{records,unsafeInline};
}

function endpointGap(a,b){return Math.min(dist(a.startPoint,b.startPoint),dist(a.startPoint,b.endPoint),dist(a.endPoint,b.startPoint),dist(a.endPoint,b.endPoint));}
function components(records,tol){
  const n=records.length,adj=Array.from({length:n},()=>new Set());
  for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)if(endpointGap(records[i],records[j])<=tol){adj[i].add(j);adj[j].add(i);}
  const seen=new Uint8Array(n),out=[];
  for(let i=0;i<n;i++){if(seen[i])continue;const stack=[i],idx=[];seen[i]=1;while(stack.length){const j=stack.pop();idx.push(j);for(const k of adj[j])if(!seen[k]){seen[k]=1;stack.push(k);}}out.push({records:idx.map(k=>records[k]),degrees:idx.map(k=>adj[k].size)});}
  return out.sort((a,b)=>b.records.length-a.records.length);
}
function evaluate(comp,pageBounds,pdfToPage){
  const rs=comp.records,n=rs.length;if(n<MIN_PATHS||n>MAX_PATHS||comp.degrees.some(d=>d!==2))return null;
  const multiCurveRatio=rs.filter(r=>r.curves>=2).length/n;if(multiCurveRatio<.90)return null;
  const medCurves=median(rs.map(r=>r.curves));if(medCurves<2)return null;
  let rawBox=null;for(const r of rs)rawBox=union(rawBox,r.bbox);
  const box=pdfToPage?txRect(rawBox,pdfToPage):rawBox.slice(),W=box[2]-box[0],H=box[3]-box[1],minDim=Math.min(W,H),maxDim=Math.max(W,H);
  const pw=Math.max(1,pageBounds[2]-pageBounds[0]),ph=Math.max(1,pageBounds[3]-pageBounds[1]),frac=area(box)/(pw*ph),aspect=minDim/Math.max(1,maxDim);
  if(minDim<60||maxDim>Math.max(pw,ph)*.75||frac<.001||frac>.35||aspect<.15)return null;
  const maxPathDim=Math.max(...rs.map(r=>Math.max(r.bbox[2]-r.bbox[0],r.bbox[3]-r.bbox[1])));
  const rawW=rawBox[2]-rawBox[0],rawH=rawBox[3]-rawBox[1],rawMin=Math.min(rawW,rawH);
  if(maxPathDim>rawMin*.12+2)return null;
  let edge=0;
  for(const r of rs){const x=(r.bbox[0]+r.bbox[2])/2,y=(r.bbox[1]+r.bbox[3])/2,d=Math.min((x-rawBox[0])/Math.max(rawW,EPS),(rawBox[2]-x)/Math.max(rawW,EPS),(y-rawBox[1])/Math.max(rawH,EPS),(rawBox[3]-y)/Math.max(rawH,EPS));if(d<=.18)edge++;}
  const edgeRatio=edge/n;if(edgeRatio<.90)return null;
  return{records:rs,rawBBox:rawBox,bbox:box,pathCount:n,lineWidth:rs[0].width,medianCurves:medCurves,multiCurveRatio,edgeRatio,pageAreaFraction:frac};
}

function scanPage(mupdf,page){
  const pageBounds=Array.from(page.getBounds()).map(Number),streams=[],groups=new Map();let pdfToPage=null;
  try{pdfToPage=mupdf.Matrix.invert(page.getTransform());}catch(_){}
  const pageRefs=refs(page);if(!pageRefs.length)return{candidates:[],streams,unsafe:false};
  for(let ri=0;ri<pageRefs.length;ri++){
    let text;try{text=toText(pageRefs[ri].readStream());}catch(_){return{candidates:[],streams,unsafe:true};}
    streams.push({ref:pageRefs[ri],text});
    const parsed=parseRedCurves(text,ri);if(parsed.unsafeInline)return{candidates:[],streams,unsafe:true};
    for(const r of parsed.records){const key=`${ri}:${Number(r.width).toPrecision(12)}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);}
  }
  const candidates=[];
  for(const rs of groups.values()){
    if(rs.length<MIN_PATHS)continue;
    const medChord=median(rs.map(r=>dist(r.startPoint,r.endPoint)).filter(v=>v>EPS));
    const tol=Math.max(.10,Math.min(.75,Number.isFinite(medChord)?medChord*.015:.10));
    for(const comp of components(rs,tol)){const c=evaluate(comp,pageBounds,pdfToPage);if(c)candidates.push(c);}
  }
  return{candidates,streams,unsafe:false};
}
function bboxClose(a,b,t=2){return Array.isArray(a)&&Array.isArray(b)&&a.length>=4&&b.length>=4&&a.slice(0,4).every((v,i)=>Math.abs(Number(v)-Number(b[i]))<=t);}
function allDetected(detectedPages){const out=[];for(const p of detectedPages||[])for(const c of p?.clouds||[])out.push({page:Number(p?.page||0),cloud:c});return out;}

export async function detectRedCurvedCycleClouds(data,context={}){
  const mupdf=await import('https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js'),doc=mupdf.PDFDocument.openDocument(new Uint8Array(data),'application/pdf'),hits=[];
  try{
    for(let pi=0;pi<doc.countPages();pi++){
      const page=doc.loadPage(pi),scan=scanPage(mupdf,page);if(scan.unsafe)continue;
      for(const c of scan.candidates)hits.push({page:pi+1,c});
    }
  }finally{doc.destroy();}
  if(hits.length!==1){diag('cloud.redcurve.detect.reject',{file:String(context.file||''),reason:`ciclos seguros=${hits.length}`});return[];}
  const h=hits[0],c=h.c;
  diag('cloud.redcurve.detect.accept',{file:String(context.file||''),page:h.page,paths:c.pathCount,lineWidth:c.lineWidth,reason:`ciclo único · grado=2 · borde=${c.edgeRatio.toFixed(3)}`});
  return[{page:h.page,clouds:[{bbox:c.bbox,source:SRC,exactRGB:[1,0,0],exactLineWidth:c.lineWidth,vectorComponentCount:1,vectorCurvedCycleProof:true,vectorCurvedCyclePathCount:c.pathCount,vectorCurvedCycleMedianCurves:c.medianCurves,vectorCurvedCycleMultiCurveRatio:c.multiCurveRatio,vectorCurvedCycleEdgeRatio:c.edgeRatio,vectorCurvedCyclePageAreaFraction:c.pageAreaFraction}]}];
}

export async function removeRedCurvedCycleClouds(data,detectedPages,options={}){
  const entries=allDetected(detectedPages).filter(x=>x.cloud?.source===SRC&&x.cloud?.vectorCurvedCycleProof===true);
  if(entries.length!==1||entries[0].page<1)return{data:new Uint8Array(data),removed:0,details:[]};
  const d=entries[0],mupdf=await import('https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js'),doc=mupdf.PDFDocument.openDocument(new Uint8Array(data),'application/pdf'),file=String(options.file||'');
  try{
    if(d.page>doc.countPages())return{data:new Uint8Array(data),removed:0,details:[{removed:false,page:d.page,reason:'red-curved-cycle: página inválida'}]};
    const page=doc.loadPage(d.page-1),scan=scanPage(mupdf,page);
    if(scan.unsafe||scan.candidates.length!==1)return{data:new Uint8Array(data),removed:0,details:[{removed:false,page:d.page,reason:`red-curved-cycle: candidatos exactos=${scan.candidates.length}${scan.unsafe?' · stream inseguro':''}`}]};
    const c=scan.candidates[0],expected=Number(d.cloud.vectorCurvedCyclePathCount||0),expectedWidth=Number(d.cloud.exactLineWidth);
    if(c.pathCount!==expected||!same(c.lineWidth,expectedWidth,5e-5)||!bboxClose(c.bbox,d.cloud.bbox,2))return{data:new Uint8Array(data),removed:0,details:[{removed:false,page:d.page,reason:`red-curved-cycle: prueba cambió paths=${c.pathCount}/${expected}`}]};
    const refsUsed=[...new Set(c.records.map(r=>r.refIndex))];if(refsUsed.length!==1)return{data:new Uint8Array(data),removed:0,details:[{removed:false,page:d.page,reason:`red-curved-cycle: Contents objetivo=${refsUsed.length}, se exige uno`}]};
    const ri=refsUsed[0],target=scan.streams[ri];if(!target)return{data:new Uint8Array(data),removed:0,details:[{removed:false,page:d.page,reason:'red-curved-cycle: stream objetivo no disponible'}]};
    const spans=c.records.map(r=>({start:r.start,end:r.end})).sort((a,b)=>b.start-a.start);
    let next=target.text;for(const s of spans)next=next.slice(0,s.start)+'\n'+next.slice(s.end);
    target.ref.writeStream(toBytes(next));
    const verify=scanPage(mupdf,page);
    if(verify.unsafe||verify.candidates.some(x=>x.pathCount===expected&&bboxClose(x.bbox,c.bbox,2)))return{data:new Uint8Array(data),removed:0,details:[{removed:false,page:d.page,reason:'red-curved-cycle: verificación posterior no eliminó el ciclo'}]};
    const buf=doc.saveToBuffer('garbage=4,compress=yes,appearance=yes'),out=buf?.asUint8Array?new Uint8Array(buf.asUint8Array()):new Uint8Array(buf);
    diag('cloud.redcurve.remove.accept',{file,page:d.page,paths:c.pathCount,lineWidth:c.lineWidth,reason:'ciclo curvo rojo aislado eliminado por spans exactos'});
    return{data:out,removed:1,details:[{removed:true,page:d.page,mode:'isolated-red-curved-cycle-exact-spans',removedClouds:1,paths:c.pathCount,rgb:[1,0,0],lineWidth:c.lineWidth,proof:'unique-degree2-multicurve-cycle'}]};
  }finally{doc.destroy();}
}

if(typeof window!=='undefined')window.__revisionCloudRedCurvedCycleV1={version:1,source:SRC};
