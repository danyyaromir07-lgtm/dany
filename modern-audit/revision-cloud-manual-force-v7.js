// Additive mask-backed exact-block fallback for multiple raster detections.
// Stable v6 always runs first unchanged. This route is reached only when v6 removed nothing,
// manual force is enabled, Preview/Apply is requested, and 2..8 raster candidates are on one page.
// Unlike v6, broad raster bounding boxes are not matched 1:1. A vector component must touch
// actual pixels from the detector's stored raster mask, then one unique safe BMC must match the
// exact RGB, line width and total stroke count of the selected cloud components.
import {
  removeDetectedRevisionCloudsByExactFamily as baseRemove,
  isManualCloudForceEnabled as baseManualEnabled,
  clearManualCloudForcePreviewApprovals as baseClearApprovals,
} from './revision-cloud-manual-force-v6.js?v=20260819-multirasterexact1';

const EPS=1e-5;
const approvals=new Set();
const MAIN='#batchRemoveRevisionClouds',FORCE='#batchForceRevisionClouds';
const same=(a,b)=>Math.abs(Number(a)-Number(b))<=EPS;
const sameRGB=(a,b)=>a&&b&&a.length>=3&&b.length>=3&&same(a[0],b[0])&&same(a[1],b[1])&&same(a[2],b[2]);
const area=r=>Math.max(0,Number(r?.[2]||0)-Number(r?.[0]||0))*Math.max(0,Number(r?.[3]||0)-Number(r?.[1]||0));
function diag(stage,extra={}){try{window.__cloudDiagnostic?.({stage,detail:'manual-cloud-force-v7',...extra});}catch(_){}}
function isRaster(c){return c?.source!=='vector-family'&&c?.source!=='vector-family-multi';}
function rasterCandidates(pages){
  const out=[];
  for(const p of pages||[]){
    const page=Number(p?.page||0);if(page<1)continue;
    for(const c of p?.clouds||[]){
      if(!isRaster(c)||!Array.isArray(c?.bbox)||c.bbox.length<4)continue;
      const bbox=c.bbox.slice(0,4).map(Number),scale=Number(c?.scale||0.18),minX=Number(c?.minX),minY=Number(c?.minY),cropW=Number(c?.cropW||c?.bw),cropH=Number(c?.cropH||c?.bh),crop=c?.crop;
      if(!bbox.every(Number.isFinite)||area(bbox)<=0||!Number.isFinite(scale)||scale<=0||!Number.isFinite(minX)||!Number.isFinite(minY)||!Number.isInteger(cropW)||!Number.isInteger(cropH)||cropW<=0||cropH<=0||!crop||typeof crop.length!=='number'||crop.length<cropW*cropH)continue;
      out.push({page,bbox,scale,minX,minY,cropW,cropH,crop,source:String(c?.source||'raster')});
    }
  }
  return out;
}
function reset(){approvals.clear();window.__manualCloudMaskExactApprovedFiles=[];}
function sync(){window.__manualCloudMaskExactApprovedFiles=Array.from(approvals);}
function wire(){document.querySelector('#batchAnalyze')?.addEventListener('click',reset,true);document.querySelector('#batchClear')?.addEventListener('click',reset,true);document.addEventListener('change',e=>{if(e.target?.matches?.(MAIN)||e.target?.matches?.(FORCE))reset();});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
function fail(base,reason,extra={}){return{...base,details:[...(base?.details||[]),{removed:false,manualForce:true,mode:'manual-mask-exact-block',reason,...extra}]};}
function colorKey(cs,color){const name=String(cs||'');if(!/DeviceRGB|RGB/i.test(name)||!color||typeof color.length!=='number'||color.length<3)return null;return Array.from(color).slice(0,3).map(v=>Number(v).toPrecision(12)).join('|');}
function widthKey(w){return Number(w||0).toPrecision(12);}
function isRed(rgb){if(!rgb||rgb.length<3)return false;const [r,g,b]=Array.from(rgb).slice(0,3).map(Number);return r>=0.5&&r>=g+0.12&&r>=b+0.12;}
function rectGap(a,b){const dx=Math.max(0,Math.max(a[0],b[0])-Math.min(a[2],b[2]));const dy=Math.max(0,Math.max(a[1],b[1])-Math.min(a[3],b[3]));return Math.hypot(dx,dy);}
function unionRect(a,b){if(!a)return b.slice();return[Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[2],b[2]),Math.max(a[3],b[3])];}
function familyUnion(strokes){let out=null;for(const s of strokes)out=unionRect(out,s.bbox);return out;}
function rectUnionArea(rects){
  if(!Array.isArray(rects)||!rects.length)return 0;
  const xs=[];for(const r of rects){if(r?.length>=4&&Number.isFinite(r[0])&&Number.isFinite(r[2]))xs.push(r[0],r[2]);}
  xs.sort((a,b)=>a-b);const ux=[];for(const x of xs)if(!ux.length||Math.abs(x-ux[ux.length-1])>EPS)ux.push(x);
  let total=0;
  for(let i=0;i+1<ux.length;i++){
    const x0=ux[i],x1=ux[i+1];if(x1<=x0)continue;const spans=[];
    for(const r of rects){if(!r||r.length<4||r[0]>=x1||r[2]<=x0)continue;const y0=Number(r[1]),y1=Number(r[3]);if(Number.isFinite(y0)&&Number.isFinite(y1)&&y1>y0)spans.push([y0,y1]);}
    if(!spans.length)continue;spans.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);let y0=spans[0][0],y1=spans[0][1],covered=0;
    for(let j=1;j<spans.length;j++){const s=spans[j];if(s[0]<=y1+EPS){if(s[1]>y1)y1=s[1];}else{covered+=Math.max(0,y1-y0);y0=s[0];y1=s[1];}}
    covered+=Math.max(0,y1-y0);total+=(x1-x0)*covered;
  }
  return total;
}
function collectFamilies(mupdf,page){
  const groups=new Map();
  const device=new mupdf.Device({strokePath(path,stroke,ctm,colorSpace,color,alpha){
    const ck=colorKey(colorSpace,color);if(!ck||!isRed(color))return;let bbox;
    try{bbox=Array.from(path.getBounds(stroke,ctm));}catch(_){return;}
    if(!bbox||bbox.length<4||!bbox.every(Number.isFinite))return;
    const w=Number(stroke?.getLineWidth?.()??stroke?.lineWidth??0);if(!Number.isFinite(w)||w<=0)return;
    const key=`${ck}::${widthKey(w)}`,rec={bbox,rgb:Array.from(color).slice(0,3).map(Number),lineWidth:w,alpha:Number(alpha??1)};
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push(rec);
  }});
  page.runPageContents(device,mupdf.Matrix.identity);device.close?.();return groups;
}
function connectedComponents(strokes,gapLimit){
  const n=strokes.length,seen=new Uint8Array(n),out=[];
  for(let i=0;i<n;i++){
    if(seen[i])continue;const stack=[i],comp=[];seen[i]=1;
    while(stack.length){const j=stack.pop();comp.push(strokes[j]);for(let k=0;k<n;k++){if(seen[k])continue;if(rectGap(strokes[j].bbox,strokes[k].bbox)<=gapLimit){seen[k]=1;stack.push(k);}}}
    out.push(comp);
  }
  return out.sort((a,b)=>b.length-a.length);
}
function validateComponent(comp){
  if(comp.length<20)return null;
  const box=familyUnion(comp),w=Math.max(1,box[2]-box[0]),h=Math.max(1,box[3]-box[1]),aspect=Math.min(w,h)/Math.max(w,h);
  if(w<40||h<40||aspect<0.10)return null;
  const density=rectUnionArea(comp.map(s=>s.bbox))/Math.max(1,area(box)),limit=comp.length<=40?0.45:0.22;
  if(density>limit)return null;
  return{comp,box,strokes:comp.length,density};
}
function pathRectToPixmap(rect,page,scale){const b=Array.from(page.getBounds?.()||[0,0,0,0]);return[(rect[0]-b[0])*scale,(rect[1]-b[1])*scale,(rect[2]-b[0])*scale,(rect[3]-b[1])*scale];}
function strokeTouchesRaster(rect,page,raster){
  const [x0,y0,x1,y1]=pathRectToPixmap(rect,page,raster.scale),cx0=raster.minX,cy0=raster.minY,cx1=cx0+raster.cropW,cy1=cy0+raster.cropH;
  const ix0=Math.max(cx0,Math.floor(Math.min(x0,x1))-2),iy0=Math.max(cy0,Math.floor(Math.min(y0,y1))-2),ix1=Math.min(cx1,Math.ceil(Math.max(x0,x1))+2),iy1=Math.min(cy1,Math.ceil(Math.max(y0,y1))+2);
  if(ix1<=ix0||iy1<=iy0)return false;
  for(let y=iy0;y<iy1;y++)for(let x=ix0;x<ix1;x++)if(raster.crop[(y-cy0)*raster.cropW+(x-cx0)])return true;
  return false;
}
function rasterEvidence(comp,page,rasters){
  let touched=0;const rasterHits=new Set();
  for(const stroke of comp){let strokeHit=false;for(let ri=0;ri<rasters.length;ri++){if(strokeTouchesRaster(stroke.bbox,page,rasters[ri])){strokeHit=true;rasterHits.add(ri);}}if(strokeHit)touched++;}
  return{touched,ratio:touched/Math.max(1,comp.length),rasterHits:Array.from(rasterHits)};
}
function candidateForFamily(page,strokes,rasters,pageBounds){
  if(strokes.length<40||strokes.length>1200)return null;
  const lw=Math.abs(Number(strokes[0]?.lineWidth||0)),gapLimit=Math.max(8,Math.min(22,lw*30+8)),valid=connectedComponents(strokes,gapLimit).map(validateComponent).filter(Boolean),selected=[];
  for(const v of valid){const ev=rasterEvidence(v.comp,page,rasters),minimum=Math.max(12,Math.ceil(v.strokes*0.50));if(ev.touched>=minimum)selected.push({...v,rasterTouched:ev.touched,rasterTouchRatio:ev.ratio,rasterHits:ev.rasterHits});}
  if(selected.length<2||selected.length>8||selected.length>rasters.length||!selected.some(v=>v.rasterTouchRatio>=0.90))return null;
  const selectedArea=selected.reduce((n,v)=>n+area(v.box),0),pageArea=Math.max(1,area(pageBounds));if(selectedArea/pageArea>0.08)return null;
  const matched=new Set();for(const v of selected)for(const i of v.rasterHits)matched.add(i);
  if(!matched.size)return null;
  return{rgb:strokes[0].rgb,lineWidth:strokes[0].lineWidth,strokes:selected.reduce((n,v)=>n+v.strokes,0),clouds:selected.length,componentSizes:selected.map(v=>v.strokes),componentDensity:selected.map(v=>v.density),rasterTouched:selected.map(v=>v.rasterTouched),rasterTouchRatio:selected.map(v=>v.rasterTouchRatio),matchedRaster:matched.size,unmatchedRaster:Math.max(0,rasters.length-matched.size),componentBoxes:selected.map(v=>v.box)};
}
function toText(buf){const bytes=buf?.asUint8Array?buf.asUint8Array():buf;let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode(...bytes.subarray(i,Math.min(bytes.length,i+0x8000)));return s;}
function toBytes(s){const a=new Uint8Array(s.length);for(let i=0;i<s.length;i++)a[i]=s.charCodeAt(i)&255;return a;}
function markedStart(text,i){const from=Math.max(0,i-180),pre=text.slice(from,i),m=/(\/OC\s+\/[A-Za-z0-9_.-]+\s*$|\/?[A-Za-z0-9_.-]+\s*$)/.exec(pre);return m?from+m.index:i;}
function blocks(text){const re=/\b(?:BDC|BMC|EMC)\b/g,stack=[],out=[];let m;while((m=re.exec(text))){if(m[0]==='BDC'||m[0]==='BMC')stack.push({start:markedStart(text,m.index),op:m[0]});else if(stack.length){const o=stack.pop();out.push({start:o.start,end:re.lastIndex,op:o.op});}}return out;}
function refs(page){const c=page.getObject().get('Contents');if(!c)return[];if(c.isStream?.())return[c];const a=[];for(let i=0;i<Number(c.length||0);i++){const r=c.get(i);if(r?.isStream?.())a.push(r);}return a;}
const countS=t=>(t.match(/(?:^|[\r\n])\s*S\s*(?=[\r\n]|$)/g)||[]).length;
function exactRG(t,rgb){const re=/(^|[\s\r\n])([-+]?(?:\d+(?:\.\d*)?|\.\d+))\s+([-+]?(?:\d+(?:\.\d*)?|\.\d+))\s+([-+]?(?:\d+(?:\.\d*)?|\.\d+))\s+RG(?=\s|$)/gm;let m,seen=false;while((m=re.exec(t))){seen=true;if(!sameRGB([+m[2],+m[3],+m[4]],rgb))return false;}return seen;}
function exactW(t,width){const re=/(^|[\s\r\n])([-+]?(?:\d+(?:\.\d*)?|\.\d+))\s+w(?=\s|$)/gm;let m,seen=false;while((m=re.exec(t))){seen=true;if(!same(+m[2],width))return false;}return seen;}
function unsafe(t){return /\bBT\b|\bTj\b|\bTJ\b|\bBI\b|\bID\b|\bEI\b|\/[A-Za-z0-9_.-]+\s+Do\b|\bsh\b/.test(t)||/(?:^|[\r\n])\s*(?:f\*?|F|B\*?|b\*?)\s*(?=[\r\n]|$)/m.test(t);}
function exactHits(page,c){const out=[];for(const ref of refs(page)){let text;try{text=toText(ref.readStream());}catch(_){continue;}for(const b of blocks(text)){if(b.op!=='BMC')continue;const body=text.slice(b.start,b.end);if(countS(body)!==c.strokes||!exactRG(body,c.rgb)||!exactW(body,c.lineWidth)||unsafe(body))continue;out.push({ref,text,b});}}return out;}
async function removeMaskExact(data,detectedPages,options={}){
  const file=String(options.file||''),rasters=rasterCandidates(detectedPages);if(rasters.length<2||rasters.length>8)return null;
  const pages=new Set(rasters.map(r=>r.page));if(pages.size!==1)return null;const pageNo=rasters[0].page;
  diag('cloud.maskexact.start',{file,page:pageNo,rasterCandidates:rasters.length});
  const mupdf=await import('https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js'),doc=mupdf.PDFDocument.openDocument(new Uint8Array(data),'application/pdf');
  try{
    if(pageNo>doc.countPages())return null;
    const page=doc.loadPage(pageNo-1),pageBounds=Array.from(page.getBounds?.()||[0,0,0,0]),families=collectFamilies(mupdf,page),candidates=[];
    for(const strokes of families.values()){const c=candidateForFamily(page,strokes,rasters,pageBounds);if(c)candidates.push(c);}
    if(candidates.length!==1){diag('cloud.maskexact.reject',{file,page:pageNo,reason:`familias mask-matched=${candidates.length}`});return null;}
    const c=candidates[0],hs=exactHits(page,c);
    if(hs.length!==1){diag('cloud.maskexact.reject',{file,page:pageNo,reason:`bloques BMC exactos=${hs.length}`,strokes:c.strokes,componentSizes:c.componentSizes});return null;}
    const h=hs[0];h.ref.writeStream(toBytes(h.text.slice(0,h.b.start)+h.text.slice(h.b.end)));
    const buf=doc.saveToBuffer('garbage=4,compress=yes,appearance=yes'),out=buf?.asUint8Array?new Uint8Array(buf.asUint8Array()):new Uint8Array(buf);
    diag('cloud.maskexact.accept',{file,page:pageNo,removedClouds:c.clouds,strokes:c.strokes,rgb:c.rgb,lineWidth:c.lineWidth,componentSizes:c.componentSizes,rasterTouched:c.rasterTouched,rasterTouchRatio:c.rasterTouchRatio,matchedRaster:c.matchedRaster,unmatchedRaster:c.unmatchedRaster});
    return{data:out,removed:c.clouds,manualForce:true,details:[{removed:true,page:pageNo,mode:'manual-mask-exact-block',removedClouds:c.clouds,strokes:c.strokes,rgb:c.rgb,lineWidth:c.lineWidth,componentSizes:c.componentSizes,componentDensity:c.componentDensity,rasterTouched:c.rasterTouched,rasterTouchRatio:c.rasterTouchRatio,matchedRaster:c.matchedRaster,unmatchedRaster:c.unmatchedRaster}]};
  }finally{doc.destroy();}
}
export async function removeDetectedRevisionCloudsByExactFamily(data,detectedPages,options={}){
  const base=await baseRemove(data,detectedPages,options);if(Number(base?.removed||0)>0||!baseManualEnabled())return base;
  const context=String(options?.context||''),file=String(options?.file||''),rasters=rasterCandidates(detectedPages);if(rasters.length<2)return base;
  if(context!=='preview'&&context!=='apply')return base;
  if(context==='apply'&&(!file||!approvals.has(file)))return fail(base,'modo manual mask-exact: primero abre «Previsualizar cambios» y verifica visualmente las nubes antes de Aplicar');
  try{
    const extra=await removeMaskExact(data,detectedPages,{context,file});
    if(!extra||Number(extra.removed||0)<=0)return fail(base,'modo manual mask-exact: no existe un único bloque BMC seguro respaldado por los píxeles raster');
    if(context==='preview'&&file){approvals.add(file);sync();}
    return{...extra,details:[...(base?.details||[]),...(extra?.details||[])]};
  }catch(err){diag('cloud.maskexact.error',{file,error:err?.message||String(err)});return fail(base,`modo manual mask-exact: ${err?.message||String(err)}`);}
}
export function isManualCloudForceEnabled(){return baseManualEnabled();}
export function clearManualCloudForcePreviewApprovals(){reset();baseClearApprovals();}
window.__revisionCloudManualForceV7={version:'7+maskexact1',get approvedFiles(){return Array.from(approvals);}};
