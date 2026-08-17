// Isolated fallback for chromatic revision clouds stored in Optional Content (BDC) streams.
// Existing red-cloud detectors/removers stay untouched and always run first.
const EPS=1e-5;
const SRC='vector-optional-color';
const q=s=>document.querySelector(s);
function diag(stage,extra={}){try{window.__cloudDiagnostic?.({stage,detail:'colored-optional-cloud-v1',...extra});}catch(_){}}
const same=(a,b)=>Math.abs(Number(a)-Number(b))<=EPS;
const sameRGB=(a,b)=>a&&b&&a.length>=3&&b.length>=3&&same(a[0],b[0])&&same(a[1],b[1])&&same(a[2],b[2]);
const chromatic=rgb=>rgb&&rgb.length>=3&&(Math.max(...rgb.map(Number))-Math.min(...rgb.map(Number))>=0.08);
const area=r=>Math.max(0,r[2]-r[0])*Math.max(0,r[3]-r[1]);
const union=(a,b)=>!a?b.slice():[Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[2],b[2]),Math.max(a[3],b[3])];
function gap(a,b){const dx=Math.max(0,Math.max(a[0],b[0])-Math.min(a[2],b[2])),dy=Math.max(0,Math.max(a[1],b[1])-Math.min(a[3],b[3]));return Math.hypot(dx,dy);}
function keyRGB(rgb){return rgb.map(v=>Number(v).toPrecision(10)).join('|');}
function keyW(w){return Number(w).toPrecision(10);}
function collectFamilies(mupdf,page){
  const groups=new Map();
  const dev=new mupdf.Device({strokePath(path,stroke,ctm,cs,color,alpha){
    if(!/DeviceRGB|RGB/i.test(String(cs||''))||!color||color.length<3||Number(alpha??1)<=0)return;
    const rgb=Array.from(color).slice(0,3).map(Number); if(!chromatic(rgb))return;
    const w=Number(stroke?.getLineWidth?.()??stroke?.lineWidth??0); if(!(w>0))return;
    let bbox; try{bbox=Array.from(path.getBounds(stroke,ctm));}catch(_){return;}
    if(!bbox?.length||bbox.length<4||!bbox.every(Number.isFinite))return;
    const key=`${keyRGB(rgb)}::${keyW(w)}`;
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push({bbox,rgb,lineWidth:w});
  }});
  page.runPageContents(dev,mupdf.Matrix.identity);dev.close?.();return groups;
}
function components(strokes,gapLimit){
  const n=strokes.length,seen=new Uint8Array(n),out=[];
  for(let i=0;i<n;i++){if(seen[i])continue;const stack=[i],c=[];seen[i]=1;while(stack.length){const j=stack.pop();c.push(strokes[j]);for(let k=0;k<n;k++)if(!seen[k]&&gap(strokes[j].bbox,strokes[k].bbox)<=gapLimit){seen[k]=1;stack.push(k);}}out.push(c);}return out.sort((a,b)=>b.length-a.length);
}
function evaluate(page,strokes){
  if(strokes.length<40||strokes.length>600)return null;
  const lw=Math.abs(Number(strokes[0]?.lineWidth||0)),gapLimit=Math.max(8,Math.min(22,lw*30+8));
  const comps=components(strokes,gapLimit);
  if(comps.length<2||comps.length>8||comps.some(c=>c.length<20))return null;
  if(comps.reduce((n,c)=>n+c.length,0)!==strokes.length)return null;
  const pb=Array.from(page.getBounds()),pa=Math.max(1,area(pb));let totalArea=0,all=null;const meta=[];
  for(const c of comps){let b=null;for(const s of c)b=union(b,s.bbox);const w=b[2]-b[0],h=b[3]-b[1],asp=Math.min(w,h)/Math.max(w,h);if(w<24||h<24||asp<0.10)return null;const frac=area(b)/pa;if(frac>0.02)return null;totalArea+=area(b);all=union(all,b);meta.push({bbox:b,strokes:c.length});}
  if(totalArea/pa>0.025)return null;
  return{rgb:strokes[0].rgb.slice(),lineWidth:strokes[0].lineWidth,strokeCount:strokes.length,componentCount:comps.length,components:meta,bbox:all,gapLimit};
}
function toText(buf){const bytes=buf?.asUint8Array?buf.asUint8Array():buf;let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode(...bytes.subarray(i,Math.min(bytes.length,i+0x8000)));return s;}
function toBytes(s){const a=new Uint8Array(s.length);for(let i=0;i<s.length;i++)a[i]=s.charCodeAt(i)&255;return a;}
function refs(page){const c=page.getObject().get('Contents');if(!c)return[];if(c.isStream?.())return[c];const a=[];for(let i=0;i<Number(c.length||0);i++){const r=c.get(i);if(r?.isStream?.())a.push(r);}return a;}
// Scan only painting/state operators. We never delete a marked-content block; matching S is changed to n.
function rewriteOptionalStrokes(text,targetRGB,targetW){
  const tok=/\b(?:q|Q|RG|w|BDC|BMC|EMC|S)\b/g;
  const gs=[{rgb:null,w:null}],mc=[];let m,removed=0,out='',last=0,lastOpEnd=0;
  const current=()=>gs[gs.length-1];
  while((m=tok.exec(text))){
    const op=m[0],pre=text.slice(lastOpEnd,m.index);
    if(op==='q')gs.push({rgb:current().rgb?.slice?.()||current().rgb,w:current().w});
    else if(op==='Q'){if(gs.length>1)gs.pop();}
    else if(op==='RG'){
      const nums=pre.match(/[-+]?(?:\d+(?:\.\d*)?|\.\d+)/g);if(nums?.length>=3)current().rgb=nums.slice(-3).map(Number);
    } else if(op==='w'){
      const nums=pre.match(/[-+]?(?:\d+(?:\.\d*)?|\.\d+)/g);if(nums?.length)current().w=Number(nums[nums.length-1]);
    } else if(op==='BDC')mc.push(/\/OC\b/.test(pre));
    else if(op==='BMC')mc.push(false);
    else if(op==='EMC'){if(mc.length)mc.pop();}
    else if(op==='S'){
      const lineStart=text.lastIndexOf('\n',m.index-1)+1,lineEndRaw=text.indexOf('\n',m.index),lineEnd=lineEndRaw<0?text.length:lineEndRaw;
      const standalone=text.slice(lineStart,lineEnd).replace(/\r/g,'').trim()==='S';
      const inOptional=mc.some(Boolean),st=current();
      if(standalone&&inOptional&&sameRGB(st.rgb,targetRGB)&&same(st.w,targetW)){
        out+=text.slice(last,m.index)+'n';last=m.index+1;removed++;
      }
    }
    lastOpEnd=tok.lastIndex;
  }
  if(!removed)return{text,removed:0};
  out+=text.slice(last);return{text:out,removed};
}
async function inspectDocument(data,context={}){
  const mupdf=await import('https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js');
  const doc=mupdf.PDFDocument.openDocument(new Uint8Array(data),'application/pdf');const found=[];
  try{
    for(let i=0;i<doc.countPages();i++){
      const page=doc.loadPage(i),groups=collectFamilies(mupdf,page),candidates=[];
      for(const strokes of groups.values()){const ev=evaluate(page,strokes);if(ev)candidates.push(ev);}
      if(candidates.length===1){const c=candidates[0];
        let painted=0;for(const ref of refs(page)){let text;try{text=toText(ref.readStream());}catch(_){continue;}painted+=rewriteOptionalStrokes(text,c.rgb,c.lineWidth).removed;}
        if(painted===c.strokeCount)found.push({page:i+1,...c});
        else diag('cloud.coloroptional.inspect.reject',{file:context.file||'',page:i+1,reason:`trazos opcionales exactos=${painted}/${c.strokeCount}`,rgb:c.rgb,lineWidth:c.lineWidth});
      } else if(candidates.length>1)diag('cloud.coloroptional.inspect.reject',{file:context.file||'',page:i+1,reason:`familias cromáticas ambiguas=${candidates.length}`});
    }
    return found;
  }finally{doc.destroy();}
}
export async function detectColoredOptionalClouds(data,context={}){
  const found=await inspectDocument(data,context);const pages=[];
  for(const c of found){pages.push({page:c.page,clouds:c.components.map((x,idx)=>({bbox:x.bbox,source:SRC,componentIndex:idx+1,componentStrokeCount:x.strokes,exactRGB:c.rgb,exactLineWidth:c.lineWidth,vectorStrokeCount:c.strokeCount,vectorComponentCount:c.componentCount,vectorFamilyKey:`${keyRGB(c.rgb)}::${keyW(c.lineWidth)}`}))});diag('cloud.coloroptional.accept',{file:context.file||'',page:c.page,components:c.componentCount,componentSizes:c.components.map(x=>x.strokes),strokes:c.strokeCount,rgb:c.rgb,lineWidth:c.lineWidth});}
  return pages;
}
export async function removeColoredOptionalClouds(data,detectedPages,options={}){
  const file=String(options.file||'');const entries=[];
  for(const p of detectedPages||[]){const cs=(p?.clouds||[]).filter(c=>c?.source===SRC);if(cs.length)entries.push({page:Number(p.page),clouds:cs});}
  if(!entries.length)return{data:new Uint8Array(data),removed:0,details:[]};
  if(entries.length!==1)return{data:new Uint8Array(data),removed:0,details:[{removed:false,reason:`color-optional: páginas candidatas=${entries.length}`}]};
  const e=entries[0],first=e.clouds[0],rgb=first?.exactRGB,w=Number(first?.exactLineWidth),expected=Number(first?.vectorStrokeCount||0),componentCount=e.clouds.length;
  if(!Array.isArray(rgb)||rgb.length<3||!(w>0)||expected<40||componentCount<2)return{data:new Uint8Array(data),removed:0,details:[{removed:false,reason:'color-optional: metadatos insuficientes'}]};
  diag('cloud.coloroptional.remove.start',{file,page:e.page,components:componentCount,strokes:expected,rgb,lineWidth:w});
  const mupdf=await import('https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js');const doc=mupdf.PDFDocument.openDocument(new Uint8Array(data),'application/pdf');
  try{
    const page=doc.loadPage(e.page-1),changes=[];let total=0;
    for(const ref of refs(page)){let text;try{text=toText(ref.readStream());}catch(_){continue;}const rw=rewriteOptionalStrokes(text,rgb,w);if(rw.removed){changes.push({ref,text:rw.text,count:rw.removed});total+=rw.removed;}}
    if(total!==expected){diag('cloud.coloroptional.remove.reject',{file,page:e.page,reason:`trazos seguros=${total}/${expected}`});return{data:new Uint8Array(data),removed:0,details:[{removed:false,page:e.page,reason:`color-optional: trazos seguros=${total}/${expected}`}]} ;}
    for(const c of changes)c.ref.writeStream(toBytes(c.text));
    const buf=doc.saveToBuffer('garbage=4,compress=yes,appearance=yes'),out=buf?.asUint8Array?new Uint8Array(buf.asUint8Array()):new Uint8Array(buf);
    diag('cloud.coloroptional.remove.accept',{file,page:e.page,components:componentCount,strokes:total,rgb,lineWidth:w});
    return{data:out,removed:componentCount,details:[{removed:true,page:e.page,mode:'optional-content-exact-strokes',removedClouds:componentCount,strokes:total,rgb,lineWidth:w}]};
  }finally{doc.destroy();}
}
async function runAfterEstablished(pendingVersionStart=Number(window.__revisionCloudZeroPendingVersion||0)){
  if(q('#batchRemoveRevisionClouds')?.checked!==true)return;
  let batch=[];for(let i=0;i<900;i++){batch=Array.isArray(window.__batchAnalysis)?window.__batchAnalysis:[];const ready=batch.length&&batch.every(x=>x?.error||typeof x?.revisionCloudCount==='number');const pendingDone=Number(window.__revisionCloudZeroPendingVersion||0)>pendingVersionStart;if(ready&&pendingDone)break;await new Promise(r=>setTimeout(r,100));}
  if(!batch.length)return;let added=0;
  for(const item of batch){if(item?.error||!item?.data||Number(item.revisionCloudCount||0)>0||Number(item?.revisionCloudPending?.count||0)>0)continue;
    try{const pages=await detectColoredOptionalClouds(item.data,{file:item.name});if(pages.length){item.revisionClouds=pages;item.revisionCloudCount=pages.reduce((n,p)=>n+(p.clouds?.length||0),0);item.revisionCloudColoredOptional=true;added+=item.revisionCloudCount;}}
    catch(err){diag('cloud.coloroptional.error',{file:item?.name||'',error:err?.message||String(err)});}await new Promise(r=>setTimeout(r,0));
  }
  if(added){window.__refreshBatchResultLines?.();window.__revisionCloudApplyEnableV1?.sync?.();}
  window.__revisionCloudColoredOptionalState={version:1,added};
}
function wire(){q('#batchAnalyze')?.addEventListener('click',()=>{const v=Number(window.__revisionCloudZeroPendingVersion||0);setTimeout(()=>runAfterEstablished(v).catch(()=>{}),0);});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
