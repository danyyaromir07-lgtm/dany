// Additive structural families for revision clouds not covered by existing routes.
// Family A: isolated red polygonal cloud cycle inside a dedicated BMC block.
// Family B: isolated red large Bezier cloud cycle inside a dedicated OCG BDC block.
// Existing detectors are not changed or relaxed. Each candidate is re-proved before mutation.

const SRC_POLY='vector-red-polygon-bmc-cycle';
const SRC_OCG='vector-red-ocg-bezier-cycle';
const WS=new Set([0,9,10,12,13,32]),DEL=new Set([40,41,60,62,91,93,123,125,47,37]),EPS=1e-6;
const same=(a,b,t=EPS)=>Math.abs(Number(a)-Number(b))<=t;
const red=a=>Array.isArray(a)&&a.length>=3&&same(a[0],1,5e-5)&&same(a[1],0,5e-5)&&same(a[2],0,5e-5);
const median=a=>{if(!a.length)return NaN;const s=[...a].sort((x,y)=>x-y),m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2;};
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const union=(a,b)=>a?[Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[2],b[2]),Math.max(a[3],b[3])]:b.slice();
function diag(stage,extra={}){try{window.__cloudDiagnostic?.({stage,detail:'additive-cloud-families-v1',...extra});}catch(_){}}
function toText(buf){const b=buf?.asUint8Array?buf.asUint8Array():buf;let s='';for(let i=0;i<b.length;i+=0x8000)s+=String.fromCharCode(...b.subarray(i,Math.min(b.length,i+0x8000)));return s;}
function toBytes(s){const b=new Uint8Array(s.length);for(let i=0;i<s.length;i++)b[i]=s.charCodeAt(i)&255;return b;}
function resolve(o){try{return o?.resolve?.()||o;}catch(_){return o;}}
function streamRef(o){try{if(o?.isStream?.())return o;const r=resolve(o);return r?.isStream?.()?r:o;}catch(_){return o;}}
function refs(page){try{const c=page.getObject()?.get?.('Contents');if(!c)return[];if(c?.isArray?.())return Array.from({length:Number(c.length||0)},(_,i)=>streamRef(c.get(i))).filter(x=>x?.isStream?.());const s=streamRef(c);return s?.isStream?.()?[s]:[];}catch(_){return[];}}
function ws(c){return WS.has(c)} function del(c){return ws(c)||DEL.has(c)}
function scanLiteral(t,i){i++;let d=1;while(i<t.length&&d){const c=t.charCodeAt(i);if(c===92){i+=2;continue}if(c===40)d++;else if(c===41)d--;i++}return i}
function scanHex(t,i){i++;while(i<t.length&&t.charCodeAt(i)!==62)i++;return i<t.length?i+1:i}
function scanArray(t,i){let d=1;i++;while(i<t.length&&d){const c=t.charCodeAt(i);if(c===37){while(i<t.length&&!/[\r\n]/.test(t[i]))i++;continue}if(c===40){i=scanLiteral(t,i);continue}if(c===60&&t.charCodeAt(i+1)!==60){i=scanHex(t,i);continue}if(c===91){d++;i++;continue}if(c===93){d--;i++;continue}i++}return i}
function next(t,i){while(i<t.length){const c=t.charCodeAt(i);if(ws(c)){i++;continue}if(c===37){while(i<t.length&&!/[\r\n]/.test(t[i]))i++;continue}break}if(i>=t.length)return null;const s=i,c=t.charCodeAt(i);if(c===40)return{type:'skip',start:s,end:scanLiteral(t,i)};if(c===60&&t.charCodeAt(i+1)!==60)return{type:'skip',start:s,end:scanHex(t,i)};if(c===91)return{type:'skip',start:s,end:scanArray(t,i)};if(c===47){i++;while(i<t.length&&!del(t.charCodeAt(i)))i++;return{type:'name',start:s,end:i,value:t.slice(s+1,i)}}if(c===60&&t.charCodeAt(i+1)===60)return{type:'delim',start:s,end:i+2,value:'<<'};if(c===62&&t.charCodeAt(i+1)===62)return{type:'delim',start:s,end:i+2,value:'>>'};if(DEL.has(c))return{type:'delim',start:s,end:i+1,value:t[i]};i++;while(i<t.length&&!del(t.charCodeAt(i)))i++;return{type:'word',start:s,end:i,value:t.slice(s,i)}}
const NUM=/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/;
function mul(a,b){return[a[0]*b[0]+a[1]*b[2],a[0]*b[1]+a[1]*b[3],a[2]*b[0]+a[3]*b[2],a[2]*b[1]+a[3]*b[3],a[4]*b[0]+a[5]*b[2]+b[4],a[4]*b[1]+a[5]*b[3]+b[5]]}
function tx(p,m){return[p[0]*m[0]+p[1]*m[2]+m[4],p[0]*m[1]+p[1]*m[3]+m[5]]}
function markedBlocks(text){
  let i=0,nums=[],operands=[],rgb=[0,0,0],width=1,gstack=[],mstack=[],unsafe=false;const out=[];
  const clear=()=>{nums=[];operands=[]};
  while(i<text.length){const t=next(text,i);if(!t)break;i=t.end;
    if(t.type==='skip'||t.type==='delim'){operands.push(t);continue}
    if(t.type==='name'){operands.push(t);continue}
    const w=t.value;if(NUM.test(w)){const n=Number(w);nums.push(n);operands.push({type:'num',value:n,start:t.start,end:t.end});continue}
    if(w==='BI'){unsafe=true;break}
    if(w==='q'){gstack.push({rgb:rgb.slice(),width});clear();continue}
    if(w==='Q'){if(gstack.length){const s=gstack.pop();rgb=s.rgb;width=s.width}clear();continue}
    if(w==='RG'&&nums.length>=3){rgb=nums.slice(-3);clear();continue}
    if(w==='w'&&nums.length){width=nums.at(-1);clear();continue}
    if(w==='BMC'||w==='BDC'){
      if(mstack.length)mstack[mstack.length-1].nested=true;
      const names=operands.filter(x=>x.type==='name').map(x=>x.value);
      mstack.push({kind:w,start:t.start,bodyStart:t.end,entryRGB:rgb.slice(),entryWidth:Number(width),names,nested:false});
      clear();continue
    }
    if(w==='EMC'){
      const b=mstack.pop();if(b){b.bodyEnd=t.start;b.end=t.end;out.push(b)}clear();continue
    }
    clear();
  }
  return{blocks:out,unsafe};
}
function scanBody(body,mode,entryRGB){
  let i=0,nums=[],rgb=entryRGB.slice(),ctm=[1,0,0,1,0,0],gst=[],path=null,paths=[],bad=false,inline=false,redSeen=red(rgb),ops=new Map();
  const bump=x=>ops.set(x,(ops.get(x)||0)+1),clear=()=>{nums=[]},add=p=>{path.end=p;path.bbox=[Math.min(path.bbox[0],p[0]),Math.min(path.bbox[1],p[1]),Math.max(path.bbox[2],p[0]),Math.max(path.bbox[3],p[1])]};
  while(i<body.length){const t=next(body,i);if(!t)break;i=t.end;
    if(t.type==='skip'||t.type==='name'||t.type==='delim'){bad=true;continue}
    const w=t.value;if(NUM.test(w)){nums.push(Number(w));continue}bump(w);
    if(w==='BI'){inline=true;bad=true;break}
    if(w==='RG'&&nums.length>=3){rgb=nums.slice(-3);redSeen=redSeen||red(rgb);if(!red(rgb))bad=true;clear();continue}
    if(w==='q'&&mode==='curved'){gst.push(ctm.slice());clear();continue}
    if(w==='Q'&&mode==='curved'){if(!gst.length){bad=true}else ctm=gst.pop();clear();continue}
    if(w==='cm'&&mode==='curved'&&nums.length>=6){ctm=mul(nums.slice(-6),ctm);clear();continue}
    if(w==='m'&&nums.length>=2){const p=mode==='curved'?tx(nums.slice(-2),ctm):nums.slice(-2);path={start:p,end:p,lines:0,curves:0,bbox:[p[0],p[1],p[0],p[1]]};clear();continue}
    if(w==='l'&&mode==='polygon'&&path&&nums.length>=2){const p=nums.slice(-2);add(p);path.lines++;clear();continue}
    if(w==='c'&&mode==='curved'&&path&&nums.length>=6){for(const k of[-6,-4,-2])add(tx([nums.at(k),nums.at(k+1)],ctm));path.curves++;clear();continue}
    if((w==='v'||w==='y')&&mode==='curved'&&path&&nums.length>=4){for(const k of[-4,-2])add(tx([nums.at(k),nums.at(k+1)],ctm));path.curves++;clear();continue}
    if(w==='S'&&path){paths.push(path);path=null;clear();continue}
    bad=true;clear();
  }
  if(path||gst.length)bad=true;
  return{paths,bad,inline,redSeen,ops};
}
function cycleProof(paths,mode){
  if(paths.length<20||paths.length>5000)return null;
  const details=mode==='polygon'?paths.map(p=>p.lines):paths.map(p=>p.curves);
  if(mode==='polygon'){if(paths.filter(p=>p.lines>=4).length/paths.length<.85||median(details)<4)return null}
  else{if(paths.filter(p=>p.curves>=2).length/paths.length<.90||median(details)<2)return null}
  let box=null;for(const p of paths)box=union(box,p.bbox);const W=box[2]-box[0],H=box[3]-box[1],minDim=Math.min(W,H);if(!(minDim>20))return null;
  const chords=paths.map(p=>dist(p.start,p.end)).filter(x=>x>EPS),med=median(chords);if(!Number.isFinite(med))return null;
  const tol=Math.max(.05,Math.min(.75,med*.015)),grid=new Map(),nodes=[];
  const cell=p=>[Math.floor(p[0]/tol),Math.floor(p[1]/tol)];
  function nodeFor(p){
    const [cx,cy]=cell(p);let best=-1,bd=Infinity;
    for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){const a=grid.get(`${cx+dx}:${cy+dy}`)||[];for(const ni of a){const d=dist(nodes[ni].p,p);if(d<=tol&&d<bd){bd=d;best=ni}}}
    if(best>=0){const n=nodes[best];n.p=[(n.p[0]*n.count+p[0])/(n.count+1),(n.p[1]*n.count+p[1])/(n.count+1)];n.count++;return best}
    const ni=nodes.length;nodes.push({p:p.slice(),count:1,edges:[]});const k=`${cx}:${cy}`;if(!grid.has(k))grid.set(k,[]);grid.get(k).push(ni);return ni;
  }
  const edges=[];for(let i=0;i<paths.length;i++){const a=nodeFor(paths[i].start),b=nodeFor(paths[i].end);if(a===b)return null;nodes[a].edges.push(i);nodes[b].edges.push(i);edges.push([a,b])}
  if(nodes.length!==paths.length||nodes.some(n=>n.edges.length!==2))return null;
  const seen=new Set([0]),stack=[0];while(stack.length){const e=stack.pop(),[a,b]=edges[e];for(const n of[a,b])for(const ne of nodes[n].edges)if(!seen.has(ne)){seen.add(ne);stack.push(ne)}}if(seen.size!==paths.length)return null;
  const centers=paths.map(p=>[(p.bbox[0]+p.bbox[2])/2,(p.bbox[1]+p.bbox[3])/2]),band=.10;
  const edgeRatio=centers.filter(([x,y])=>Math.min((x-box[0])/W,(box[2]-x)/W,(y-box[1])/H,(box[3]-y)/H)<=band).length/paths.length;
  const maxSpan=Math.max(...paths.map(p=>Math.max(p.bbox[2]-p.bbox[0],p.bbox[3]-p.bbox[1])));
  if(edgeRatio<.90)return null;
  if(mode==='polygon'&&maxSpan>minDim*.12+2)return null;
  if(mode==='curved'&&maxSpan>minDim*.03+2)return null;
  return{bbox:box,pathCount:paths.length,medianSegments:median(details),edgeRatio,tolerance:tol,maxPathSpanRatio:maxSpan/minDim};
}
function evaluateBlock(text,b){
  if(b.nested)return null;const body=text.slice(b.bodyStart,b.bodyEnd);
  if(b.kind==='BMC'){
    const s=scanBody(body,'polygon',b.entryRGB);if(s.bad||s.inline||!s.redSeen)return null;const p=cycleProof(s.paths,'polygon');if(!p)return null;
    if((s.ops.get('RG')||0)<1)return null;
    return{source:SRC_POLY,mode:'polygon-bmc',...p,bodyStart:b.bodyStart,bodyEnd:b.bodyEnd};
  }
  if(b.kind==='BDC'&&b.names.length>=2&&b.names.at(-2)==='OC'){
    if(!red(b.entryRGB))return null;
    const s=scanBody(body,'curved',b.entryRGB);if(s.bad||s.inline||!s.redSeen)return null;const p=cycleProof(s.paths,'curved');if(!p)return null;
    return{source:SRC_OCG,mode:'ocg-bezier',...p,bodyStart:b.bodyStart,bodyEnd:b.bodyEnd,ocgName:b.names.at(-1)||''};
  }
  return null;
}
function scanPage(page){
  const streams=[];const candidates=[];let unsafe=false;for(const ref of refs(page)){let text;try{text=toText(ref.readStream())}catch(_){unsafe=true;continue}const ri=streams.length;streams.push({ref,text});const mb=markedBlocks(text);if(mb.unsafe){unsafe=true;continue}for(const b of mb.blocks){const c=evaluateBlock(text,b);if(c)candidates.push({...c,refIndex:ri})}}
  return{streams,candidates,unsafe};
}
function publicCloud(c){return{bbox:c.bbox,source:c.source,exactRGB:[1,0,0],vectorComponentCount:1,vectorAdditiveFamilyProof:true,vectorAdditiveFamilyMode:c.mode,vectorAdditiveFamilyPathCount:c.pathCount,vectorAdditiveFamilyMedianSegments:c.medianSegments,vectorAdditiveFamilyEdgeRatio:c.edgeRatio,vectorAdditiveFamilyMaxPathSpanRatio:c.maxPathSpanRatio,vectorAdditiveFamilyOcgName:c.ocgName||undefined}}
export async function detectAdditiveRevisionCloudFamilies(data,context={}){
  const mupdf=await import('https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js'),doc=mupdf.PDFDocument.openDocument(new Uint8Array(data),'application/pdf'),hits=[];
  try{for(let pi=0;pi<doc.countPages();pi++){const page=doc.loadPage(pi),s=scanPage(page);for(const c of s.candidates)hits.push({page:pi+1,c})}}finally{doc.destroy()}
  const file=String(context.file||'');for(const h of hits)diag('cloud.additive.detect.accept',{file,page:h.page,source:h.c.source,paths:h.c.pathCount,reason:`ciclo grado=2 · borde=${h.c.edgeRatio.toFixed(3)}`});
  if(!hits.length)diag('cloud.additive.detect.reject',{file,reason:'familias estructurales adicionales=0'});
  const by=new Map();for(const h of hits){if(!by.has(h.page))by.set(h.page,[]);by.get(h.page).push(publicCloud(h.c))}
  return[...by].sort((a,b)=>a[0]-b[0]).map(([page,clouds])=>({page,clouds}));
}
function flatten(pages){const a=[];for(const p of pages||[])for(const c of p?.clouds||[])if(c?.vectorAdditiveFamilyProof===true&&(c?.source===SRC_POLY||c?.source===SRC_OCG))a.push({page:Number(p.page||0),cloud:c});return a}
function closeBox(a,b,t=2){return Array.isArray(a)&&Array.isArray(b)&&a.length>=4&&b.length>=4&&a.slice(0,4).every((x,i)=>Math.abs(Number(x)-Number(b[i]))<=t)}
export async function removeAdditiveRevisionCloudFamilies(data,detectedPages,options={}){
  const expected=flatten(detectedPages);if(!expected.length)return{data:new Uint8Array(data),removed:0,details:[]};
  const mupdf=await import('https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js'),doc=mupdf.PDFDocument.openDocument(new Uint8Array(data),'application/pdf'),file=String(options.file||''),details=[];let removed=0;
  try{
    const grouped=new Map();for(const e of expected){if(e.page<1||e.page>doc.countPages())continue;if(!grouped.has(e.page))grouped.set(e.page,[]);grouped.get(e.page).push(e)}
    for(const [pageNo,wanted] of grouped){
      const page=doc.loadPage(pageNo-1),scan=scanPage(page),targets=[];
      for(const e of wanted){const matches=scan.candidates.filter(c=>c.source===e.cloud.source&&c.pathCount===Number(e.cloud.vectorAdditiveFamilyPathCount||0)&&closeBox(c.bbox,e.cloud.bbox,2));if(matches.length!==1){details.push({removed:false,page:pageNo,reason:`${e.cloud.source}: revalidación candidatos=${matches.length}`});continue}targets.push(matches[0])}
      const byRef=new Map();for(const c of targets){if(!byRef.has(c.refIndex))byRef.set(c.refIndex,[]);byRef.get(c.refIndex).push(c)}
      for(const [ri,cs] of byRef){const st=scan.streams[ri];if(!st)continue;const spans=cs.map(c=>[c.bodyStart,c.bodyEnd]).sort((a,b)=>b[0]-a[0]);for(let i=1;i<spans.length;i++)if(spans[i][1]>spans[i-1][0])throw new Error('spans estructurales solapados');let text=st.text;for(const [a,b] of spans)text=text.slice(0,a)+'\n'+text.slice(b);st.ref.writeStream(toBytes(text));removed+=cs.length;for(const c of cs)details.push({removed:true,page:pageNo,mode:c.mode,source:c.source,paths:c.pathCount,proof:'isolated-marked-content-degree2-cycle'})}
      const verify=scanPage(page);for(const c of targets)if(verify.candidates.some(v=>v.source===c.source&&v.pathCount===c.pathCount&&closeBox(v.bbox,c.bbox,2)))throw new Error(`${c.source}: verificación posterior conserva candidato`);
    }
    if(!removed)return{data:new Uint8Array(data),removed:0,details};
    const buf=doc.saveToBuffer('garbage=4,compress=yes,appearance=yes'),out=buf?.asUint8Array?new Uint8Array(buf.asUint8Array()):new Uint8Array(buf);
    diag('cloud.additive.remove.accept',{file,removed,reason:'bloques estructurales revalidados y vaciados'});
    return{data:out,removed,details};
  }catch(err){diag('cloud.additive.remove.error',{file,error:err?.message||String(err)});return{data:new Uint8Array(data),removed:0,details:[...details,{removed:false,reason:err?.message||String(err)}]}}finally{doc.destroy()}
}
if(typeof window!=='undefined')window.__revisionCloudAdditiveFamiliesV1={version:1,sources:[SRC_POLY,SRC_OCG]};
