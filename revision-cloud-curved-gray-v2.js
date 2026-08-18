// Isolated fallback for CAD revision clouds drawn as closed chains of short Bezier strokes.
// It runs only after all established red / exact / colored-optional detectors found nothing.
// Detection is geometry-based; removal targets only the exact black curved-stroke ordinals validated by detection.
// v2 fixes raw PDF Bezier operand parsing: c=6 operands, v/y=4 operands.
const SRC='vector-curved-cloud';
const EPS=1e-6;
function diag(stage,extra={}){try{window.__cloudDiagnostic?.({stage,detail:'curved-cloud-v2',...extra});}catch(_){}}
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const union=(a,b)=>!a?b.slice():[Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[2],b[2]),Math.max(a[3],b[3])];
const size=r=>[Math.max(0,r[2]-r[0]),Math.max(0,r[3]-r[1])];
function normalizeBlack(cs,color){
  const vals=Array.from(color||[]).map(Number);if(!vals.length)return null;
  const name=String(cs||'');
  if(/Gray/i.test(name)||vals.length===1){const g=vals[0];return Math.abs(g)<=EPS?[0,0,0]:null;}
  if(/RGB/i.test(name)||vals.length>=3){return Math.abs(vals[0])<=EPS&&Math.abs(vals[1])<=EPS&&Math.abs(vals[2])<=EPS?[0,0,0]:null;}
  return null;
}
function matrix6(ctm){try{const a=Array.from(ctm||[]).map(Number);if(a.length>=6&&a.slice(0,6).every(Number.isFinite))return a.slice(0,6);}catch(_){}return null;}
function txPoint(x,y,m){return m?[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]]:[x,y];}
function tracePath(path,ctm){
  const m=matrix6(ctm);let start=null,last=null,curves=0,lines=0,closed=false;
  try{path.walk({
    moveTo(x,y){const p=txPoint(Number(x),Number(y),m);if(!start)start=p;last=p;},
    lineTo(x,y){lines++;last=txPoint(Number(x),Number(y),m);},
    curveTo(x1,y1,x2,y2,x3,y3){curves++;last=txPoint(Number(x3),Number(y3),m);},
    closePath(){closed=true;if(start)last=start.slice();}
  });}catch(_){return null;}
  if(!start||!last||curves<1)return null;return{start,last,curves,lines,closed};
}
function collectPagePaths(mupdf,page){
  const paths=[];let ordinal=0;
  const dev=new mupdf.Device({strokePath(path,stroke,ctm,cs,color,alpha){
    if(Number(alpha??1)<0.999||!normalizeBlack(cs,color))return;
    const tr=tracePath(path,ctm);if(!tr)return;
    let bbox;try{bbox=Array.from(path.getBounds(stroke,ctm)).map(Number);}catch(_){return;}
    if(bbox.length<4||!bbox.slice(0,4).every(Number.isFinite))return;
    const lineWidth=Number(stroke?.getLineWidth?.()??stroke?.lineWidth??0);
    paths.push({ordinal:ordinal++,bbox:bbox.slice(0,4),lineWidth,...tr});
  }});
  page.runPageContents(dev,mupdf.Matrix.identity);dev.close?.();return paths;
}
function connectedComponents(paths,tol){
  const n=paths.length,cell=Math.max(0.2,tol),grid=new Map(),adj=Array.from({length:n},()=>new Set());
  const key=p=>`${Math.round(p[0]/cell)}:${Math.round(p[1]/cell)}`;
  for(let i=0;i<n;i++)for(const p of [paths[i].start,paths[i].last]){const k=key(p);if(!grid.has(k))grid.set(k,[]);grid.get(k).push(i);}
  for(let i=0;i<n;i++)for(const p of [paths[i].start,paths[i].last]){
    const kx=Math.round(p[0]/cell),ky=Math.round(p[1]/cell);
    for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(const j of grid.get(`${kx+dx}:${ky+dy}`)||[]){if(j===i)continue;const o=paths[j];if(Math.min(dist(p,o.start),dist(p,o.last))<=tol){adj[i].add(j);adj[j].add(i);}}
  }
  const seen=new Uint8Array(n),out=[];
  for(let i=0;i<n;i++){if(seen[i])continue;const stack=[i],c=[];seen[i]=1;while(stack.length){const j=stack.pop();c.push(j);for(const k of adj[j])if(!seen[k]){seen[k]=1;stack.push(k);}}out.push({indices:c,adj});}
  return out;
}
function evaluateComponent(paths,comp,pageBounds){
  const idx=comp.indices,n=idx.length;if(n<12||n>80)return null;
  if(idx.some(i=>comp.adj[i].size!==2))return null;
  let bbox=null,totalCurves=0,totalLines=0,maxPathDim=0;const widths=[];
  for(const i of idx){const p=paths[i];bbox=union(bbox,p.bbox);totalCurves+=p.curves;totalLines+=p.lines;const [w,h]=size(p.bbox);maxPathDim=Math.max(maxPathDim,w,h);if(Number.isFinite(p.lineWidth)&&p.lineWidth>0)widths.push(p.lineWidth);}
  const [w,h]=size(bbox),[pw,ph]=size(pageBounds),pageMin=Math.max(1,Math.min(pw,ph)),pageMax=Math.max(pw,ph);
  const minDim=Math.min(w,h),maxDim=Math.max(w,h);
  if(minDim<Math.max(55,pageMin*0.020)||maxDim>Math.min(900,pageMax*0.28))return null;
  if(maxPathDim>Math.max(55,pageMin*0.025))return null;
  if(totalCurves<n*1.5||totalLines>n*0.35)return null;
  if(widths.length){const lo=Math.min(...widths),hi=Math.max(...widths);if(Math.abs(hi-lo)>1e-4)return null;}
  return{bbox,paths:n,totalCurves,totalLines,lineWidth:widths[0]||0,ordinals:idx.map(i=>paths[i].ordinal).sort((a,b)=>a-b)};
}
async function inspect(data,context={}){
  const mupdf=await import('https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js');
  const doc=mupdf.PDFDocument.openDocument(new Uint8Array(data),'application/pdf');const pages=[];
  try{
    for(let pi=0;pi<doc.countPages();pi++){
      const page=doc.loadPage(pi),paths=collectPagePaths(mupdf,page);if(paths.length<12)continue;
      const bounds=Array.from(page.getBounds()).map(Number),tol=Math.max(0.8,Math.min(2.0,Math.min(...size(bounds))*0.0005));
      const comps=connectedComponents(paths,tol),accepted=[];
      for(const c of comps){const ev=evaluateComponent(paths,c,bounds);if(ev)accepted.push(ev);}
      if(!accepted.length)continue;
      const selected=new Set(accepted.flatMap(x=>x.ordinals));
      if(selected.size!==accepted.reduce((s,x)=>s+x.paths,0)){diag('cloud.curved.inspect.reject',{file:context.file||'',page:pi+1,reason:'ordinales solapados'});continue;}
      pages.push({page:pi+1,totalBlackCurvePaths:paths.length,components:accepted});
      diag('cloud.curved.accept',{file:context.file||'',page:pi+1,clouds:accepted.length,curvePaths:selected.size,totalBlackCurvePaths:paths.length,componentSizes:accepted.map(x=>x.paths)});
    }
    return pages;
  }finally{doc.destroy();}
}
export async function detectCurvedGrayClouds(data,context={}){
  const found=await inspect(data,context);return found.map(p=>({page:p.page,clouds:p.components.map((c,i)=>({bbox:c.bbox,source:SRC,componentIndex:i+1,componentStrokeCount:c.paths,curvePathOrdinals:c.ordinals,totalBlackCurvePaths:p.totalBlackCurvePaths,lineWidth:c.lineWidth}))}));
}
function toText(buf){const bytes=buf?.asUint8Array?buf.asUint8Array():buf;let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode(...bytes.subarray(i,Math.min(bytes.length,i+0x8000)));return s;}
function toBytes(s){const a=new Uint8Array(s.length);for(let i=0;i<s.length;i++)a[i]=s.charCodeAt(i)&255;return a;}
function refs(page){const c=page.getObject().get('Contents');if(!c)return[];if(c.isStream?.())return[c];const a=[];for(let i=0;i<Number(c.length||0);i++){const r=c.get(i);if(r?.isStream?.())a.push(r);}return a;}
const NUM='[-+]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)';
const C_RE=new RegExp(`^(?:${NUM}\\s+){6}c$`);
const VY_RE=new RegExp(`^(?:${NUM}\\s+){4}(?:v|y)$`);
function rewriteSelected(text,selectedOrdinals,expectedTotal){
  const lines=text.match(/.*(?:\r\n|\n|\r|$)/g)||[],gs=[{black:false}],selected=new Set(selectedOrdinals);let pathCurve=false,ordinal=-1,total=0,removed=0,out='';
  for(const line of lines){if(!line)continue;const raw=line.replace(/[\r\n]+$/,'');const trim=raw.trim(),ending=line.slice(raw.length);
    if(trim==='q'){gs.push({black:gs[gs.length-1].black});out+=line;continue;}
    if(trim==='Q'){if(gs.length>1)gs.pop();out+=line;continue;}
    let m=new RegExp(`^(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+RG$`).exec(trim);if(m){gs[gs.length-1].black=Math.abs(+m[1])<=EPS&&Math.abs(+m[2])<=EPS&&Math.abs(+m[3])<=EPS;out+=line;continue;}
    m=new RegExp(`^(${NUM})\\s+G$`).exec(trim);if(m){gs[gs.length-1].black=Math.abs(+m[1])<=EPS;out+=line;continue;}
    if(new RegExp(`^(?:${NUM}\\s+){4}K$`).test(trim)){gs[gs.length-1].black=false;out+=line;continue;}
    if(C_RE.test(trim)||VY_RE.test(trim))pathCurve=true;
    if(/^(?:S|s|B|B\*|b|b\*|f|f\*|F|n)$/.test(trim)){
      if(/^(?:S|s|B|B\*|b|b\*)$/.test(trim)&&pathCurve&&gs[gs.length-1].black){ordinal++;total++;if(selected.has(ordinal)&&trim==='S'){const indent=raw.slice(0,raw.length-raw.trimStart().length);out+=indent+'n'+ending;removed++;pathCurve=false;continue;}}
      pathCurve=false;
    }
    out+=line;
  }
  return{text:out,removed,total,expectedTotal};
}
export async function removeCurvedGrayClouds(data,detectedPages,options={}){
  const file=String(options.file||''),entries=[];
  for(const p of detectedPages||[]){const cs=(p?.clouds||[]).filter(c=>c?.source===SRC);if(cs.length)entries.push({page:Number(p.page),clouds:cs});}
  if(!entries.length)return{data:new Uint8Array(data),removed:0,details:[]};
  const mupdf=await import('https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js');const doc=mupdf.PDFDocument.openDocument(new Uint8Array(data),'application/pdf');let removedClouds=0;const details=[];
  try{
    for(const e of entries){const page=doc.loadPage(e.page-1),first=e.clouds[0],expectedTotal=Number(first?.totalBlackCurvePaths||0),ordinals=[...new Set(e.clouds.flatMap(c=>Array.isArray(c?.curvePathOrdinals)?c.curvePathOrdinals:[]).map(Number).filter(Number.isInteger))].sort((a,b)=>a-b),expectedSelected=e.clouds.reduce((s,c)=>s+Number(c?.componentStrokeCount||0),0);
      if(expectedTotal<12||ordinals.length!==expectedSelected){details.push({removed:false,page:e.page,reason:`curved-cloud: metadatos ordinales ${ordinals.length}/${expectedSelected}`});continue;}
      const pageRefs=refs(page);if(pageRefs.length!==1){details.push({removed:false,page:e.page,reason:`curved-cloud: Contents=${pageRefs.length}, se exige stream único`});continue;}
      let text;try{text=toText(pageRefs[0].readStream());}catch(err){details.push({removed:false,page:e.page,reason:'curved-cloud: stream no legible'});continue;}
      const rw=rewriteSelected(text,ordinals,expectedTotal);
      if(rw.total!==expectedTotal||rw.removed!==expectedSelected){diag('cloud.curved.remove.reject',{file,page:e.page,reason:`trazos exactos=${rw.removed}/${expectedSelected}; total=${rw.total}/${expectedTotal}`});details.push({removed:false,page:e.page,reason:`curved-cloud: validación exacta ${rw.removed}/${expectedSelected}, total ${rw.total}/${expectedTotal}`});continue;}
      pageRefs[0].writeStream(toBytes(rw.text));removedClouds+=e.clouds.length;details.push({removed:true,page:e.page,mode:'curved-black-exact-ordinals-v2',removedClouds:e.clouds.length,paths:rw.removed});diag('cloud.curved.remove.accept',{file,page:e.page,clouds:e.clouds.length,paths:rw.removed,totalBlackCurvePaths:rw.total});
    }
    if(!removedClouds)return{data:new Uint8Array(data),removed:0,details};
    const buf=doc.saveToBuffer('garbage=4,compress=yes,appearance=yes'),out=buf?.asUint8Array?new Uint8Array(buf.asUint8Array()):new Uint8Array(buf);return{data:out,removed:removedClouds,details};
  }finally{doc.destroy();}
}
window.__revisionCloudCurvedGrayV2={version:2,source:SRC};
