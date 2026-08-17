// Manual-only multi-cloud fallback. It never changes the proven automatic detector/remover.
// It is reached only after normal removal and the single-family manual fallback both fail.
const EPS=1e-6;

function sameNumber(a,b){ return Math.abs(Number(a)-Number(b))<=EPS; }
function sameRGB(a,b){ return a&&b&&a.length>=3&&b.length>=3&&sameNumber(a[0],b[0])&&sameNumber(a[1],b[1])&&sameNumber(a[2],b[2]); }
function isRed(rgb){ if(!rgb||rgb.length<3)return false; const [r,g,b]=Array.from(rgb).slice(0,3).map(Number); return r>=0.5&&r>=g+0.12&&r>=b+0.12; }
function colorKey(cs,color){ const name=String(cs||''); if(!/DeviceRGB|RGB/i.test(name)||!color||typeof color.length!=='number'||color.length<3)return null; return Array.from(color).slice(0,3).map(v=>Number(v).toPrecision(12)).join('|'); }
function widthKey(w){ return Number(w||0).toPrecision(12); }
function area(r){ return Math.max(0,r[2]-r[0])*Math.max(0,r[3]-r[1]); }
function unionRect(a,b){ if(!a)return b.slice(); return [Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[2],b[2]),Math.max(a[3],b[3])]; }
function rectGap(a,b){ const dx=Math.max(0,Math.max(a[0],b[0])-Math.min(a[2],b[2])); const dy=Math.max(0,Math.max(a[1],b[1])-Math.min(a[3],b[3])); return Math.hypot(dx,dy); }
function rectIntersects(a,b){ return a&&b&&a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1]; }
function diag(stage,extra={}){ try{ window.__cloudDiagnostic?.({stage,detail:'manual-cloud-multicloud-v1',...extra}); }catch(_){} }
function countRaster(pages){ return (pages||[]).reduce((n,p)=>n+(p?.clouds||[]).filter(c=>c?.source!=='vector-family'&&c?.source!=='vector-family-multi').length,0); }
function rasterPagesOnly(pages){ return (pages||[]).map(p=>({page:Number(p?.page||0),clouds:(p?.clouds||[]).filter(c=>c?.source!=='vector-family'&&c?.source!=='vector-family-multi')})).filter(p=>p.page>0&&p.clouds.length); }

function rectUnionArea(rects){
  if(!Array.isArray(rects)||!rects.length)return 0;
  const xs=[];
  for(const r of rects){ if(r?.length>=4&&Number.isFinite(r[0])&&Number.isFinite(r[2]))xs.push(r[0],r[2]); }
  xs.sort((a,b)=>a-b);
  const ux=[]; for(const x of xs){ if(!ux.length||Math.abs(x-ux[ux.length-1])>EPS)ux.push(x); }
  let total=0;
  for(let i=0;i+1<ux.length;i++){
    const x0=ux[i],x1=ux[i+1]; if(x1<=x0)continue;
    const spans=[];
    for(const r of rects){ if(!r||r.length<4||r[0]>=x1||r[2]<=x0)continue; const y0=Number(r[1]),y1=Number(r[3]); if(Number.isFinite(y0)&&Number.isFinite(y1)&&y1>y0)spans.push([y0,y1]); }
    if(!spans.length)continue;
    spans.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
    let y0=spans[0][0],y1=spans[0][1],covered=0;
    for(let j=1;j<spans.length;j++){ const s=spans[j]; if(s[0]<=y1+EPS){ if(s[1]>y1)y1=s[1]; } else { covered+=Math.max(0,y1-y0); y0=s[0]; y1=s[1]; } }
    covered+=Math.max(0,y1-y0); total+=(x1-x0)*covered;
  }
  return total;
}

function collectFamilies(mupdf,page){
  const groups=new Map();
  const device=new mupdf.Device({strokePath(path,stroke,ctm,colorSpace,color,alpha){
    const ck=colorKey(colorSpace,color); if(!ck||!isRed(color))return;
    let bbox; try{ bbox=Array.from(path.getBounds(stroke,ctm)); }catch(_){ return; }
    if(!bbox||bbox.length<4)return;
    const w=Number(stroke?.getLineWidth?.()??stroke?.lineWidth??0),key=`${ck}::${widthKey(w)}`;
    const rec={bbox,rgb:Array.from(color).slice(0,3).map(Number),lineWidth:w,alpha:Number(alpha??1)};
    if(!groups.has(key))groups.set(key,[]); groups.get(key).push(rec);
  }});
  page.runPageContents(device,mupdf.Matrix.identity); device.close?.(); return groups;
}

function connectedComponents(strokes,gapLimit){
  const n=strokes.length,seen=new Uint8Array(n),comps=[];
  for(let i=0;i<n;i++){
    if(seen[i])continue; const stack=[i],comp=[]; seen[i]=1;
    while(stack.length){
      const j=stack.pop(); comp.push(strokes[j]);
      for(let k=0;k<n;k++){ if(seen[k])continue; if(rectGap(strokes[j].bbox,strokes[k].bbox)<=gapLimit){ seen[k]=1; stack.push(k); } }
    }
    comps.push(comp);
  }
  return comps.sort((a,b)=>b.length-a.length);
}

function familyUnion(strokes){ let out=null; for(const s of strokes)out=unionRect(out,s.bbox); return out; }
function rasterUnion(pages,pageNo){ let out=null; for(const p of pages||[]){ if(Number(p?.page)!==pageNo)continue; for(const c of p.clouds||[])if(Array.isArray(c?.bbox))out=unionRect(out,c.bbox); } return out; }

function evaluateMultiFamily(key,strokes,pageBounds,rasterBBox){
  if(strokes.length<40||strokes.length>1200)return null;
  const lw=Math.abs(Number(strokes[0]?.lineWidth||0)),gapLimit=Math.max(8,Math.min(22,lw*30+8));
  const comps=connectedComponents(strokes,gapLimit),good=comps.filter(c=>c.length>=20);
  if(good.length<2||good.length>8)return null;
  const goodCount=good.reduce((n,c)=>n+c.length,0); if(goodCount!==strokes.length)return null;
  const pageArea=Math.max(1,area(pageBounds)),componentBoxes=[],componentSizes=[],componentDensity=[];
  let componentArea=0,anyRasterHit=false;
  for(const comp of good){
    const box=familyUnion(comp),w=Math.max(1,box[2]-box[0]),h=Math.max(1,box[3]-box[1]),aspect=Math.min(w,h)/Math.max(w,h);
    if(w<40||h<40||aspect<0.10)return null;
    const density=rectUnionArea(comp.map(s=>s.bbox))/Math.max(1,area(box));
    if(density>0.22)return null;
    componentArea+=area(box); componentBoxes.push(box); componentSizes.push(comp.length); componentDensity.push(density);
    if(rectIntersects(box,rasterBBox))anyRasterHit=true;
  }
  if(!anyRasterHit||componentArea/pageArea>0.08)return null;
  let bbox=null; for(const box of componentBoxes)bbox=unionRect(bbox,box);
  return {key,rgb:strokes[0].rgb,lineWidth:strokes[0].lineWidth,strokeCount:strokes.length,componentCount:good.length,componentBoxes,componentSizes,componentDensity,bbox,gapLimit,componentAreaFraction:componentArea/pageArea};
}

function bufferToLatin1(buf){ const bytes=buf?.asUint8Array?buf.asUint8Array():buf; let out=''; for(let i=0;i<bytes.length;i+=0x8000)out+=String.fromCharCode(...bytes.subarray(i,Math.min(bytes.length,i+0x8000))); return out; }
function latin1ToBytes(s){ const out=new Uint8Array(s.length); for(let i=0;i<s.length;i++)out[i]=s.charCodeAt(i)&255; return out; }
function markedStart(text,opIndex){ const from=Math.max(0,opIndex-180),prefix=text.slice(from,opIndex); const m=/(\/OC\s+\/[A-Za-z0-9_.-]+\s*$|\/?[A-Za-z0-9_.-]+\s*$)/.exec(prefix); return m?from+m.index:opIndex; }
function parseMarkedBlocks(text){ const tok=/\b(?:BDC|BMC|EMC)\b/g,stack=[],blocks=[]; let m; while((m=tok.exec(text))){ if(m[0]==='BDC'||m[0]==='BMC')stack.push({start:markedStart(text,m.index),op:m[0]}); else if(stack.length){ const open=stack.pop(); blocks.push({start:open.start,end:tok.lastIndex,op:open.op}); } } return blocks; }
function getContentRefs(page){ const pageObj=page.getObject(),contents=pageObj.get('Contents'); if(!contents)return[]; if(contents.isStream?.())return[contents]; const refs=[],n=Number(contents.length||0); for(let i=0;i<n;i++){ const r=contents.get(i); if(r?.isStream?.())refs.push(r); } return refs; }
function countStrokes(text){ return (text.match(/(?:^|[\r\n])\s*S\s*(?=[\r\n]|$)/g)||[]).length; }
function hasExactRG(text,rgb){ const re=/(^|[\s\r\n])([-+]?(?:\d+(?:\.\d*)?|\.\d+))\s+([-+]?(?:\d+(?:\.\d*)?|\.\d+))\s+([-+]?(?:\d+(?:\.\d*)?|\.\d+))\s+RG(?=\s|$)/gm; let m,seen=false; while((m=re.exec(text))){ seen=true; if(!sameRGB([Number(m[2]),Number(m[3]),Number(m[4])],rgb))return false; } return seen; }
function hasExactWidth(text,w){ const re=/(^|[\s\r\n])([-+]?(?:\d+(?:\.\d*)?|\.\d+))\s+w(?=\s|$)/gm; let m,seen=false; while((m=re.exec(text))){ seen=true; if(!sameNumber(Number(m[2]),w))return false; } return seen; }
function hasUnsafePaint(text){
  if(/\bBT\b|\bTj\b|\bTJ\b|\bBI\b|\bID\b|\bEI\b|\/[A-Za-z0-9_.-]+\s+Do\b|\bsh\b/.test(text))return true;
  return /(?:^|[\r\n])\s*(?:f\*?|F|B\*?|b\*?)\s*(?=[\r\n]|$)/m.test(text);
}
function exactBlockHits(page,candidate){
  const hits=[];
  for(const ref of getContentRefs(page)){
    let text; try{ text=bufferToLatin1(ref.readStream()); }catch(_){ continue; }
    for(const block of parseMarkedBlocks(text)){
      if(block.op!=='BMC')continue;
      const body=text.slice(block.start,block.end);
      if(countStrokes(body)!==candidate.strokeCount)continue;
      if(!hasExactRG(body,candidate.rgb)||!hasExactWidth(body,candidate.lineWidth)||hasUnsafePaint(body))continue;
      hits.push({ref,text,block});
    }
  }
  return hits;
}

function fail(data,reason,extra={}){ return {data:new Uint8Array(data),removed:0,manualForce:false,details:[{removed:false,manualForce:true,mode:'manual-unique-multicloud-block',reason,...extra}]}; }

export async function removeManualMultiCloudBlock(data,detectedPages,options={}){
  const rasterPages=rasterPagesOnly(detectedPages),rasterCount=countRaster(rasterPages),file=String(options.file||'');
  if(rasterCount!==1)return fail(data,`multicloud manual exige exactamente 1 candidata raster no validada; detectadas=${rasterCount}`);
  const pageNo=rasterPages[0].page,rasterBBox=rasterUnion(rasterPages,pageNo);
  diag('cloud.manual.multi.start',{file,page:pageNo,rasterCandidates:rasterCount});
  const mupdf=await import('https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js');
  const doc=mupdf.PDFDocument.openDocument(new Uint8Array(data),'application/pdf');
  try{
    const page=doc.loadPage(pageNo-1),groups=collectFamilies(mupdf,page),pageBounds=Array.from(page.getBounds()),candidates=[];
    for(const [key,strokes] of groups){ const c=evaluateMultiFamily(key,strokes,pageBounds,rasterBBox); if(c)candidates.push(c); }
    if(candidates.length!==1){
      diag('cloud.manual.multi.reject',{file,page:pageNo,reason:`familias multicloud candidatas=${candidates.length}`});
      return fail(data,`multicloud manual: familias vectoriales candidatas=${candidates.length}`,{page:pageNo});
    }
    const candidate=candidates[0],hits=exactBlockHits(page,candidate);
    if(hits.length!==1){
      diag('cloud.manual.multi.reject',{file,page:pageNo,reason:`bloques BMC exactos=${hits.length}`,components:candidate.componentCount,strokes:candidate.strokeCount});
      return fail(data,`multicloud manual: bloques vectoriales exactos=${hits.length}`,{page:pageNo,components:candidate.componentCount,strokes:candidate.strokeCount});
    }
    const hit=hits[0],next=hit.text.slice(0,hit.block.start)+hit.text.slice(hit.block.end); hit.ref.writeStream(latin1ToBytes(next));
    const buffer=doc.saveToBuffer('garbage=4,compress=yes,appearance=yes'),out=buffer?.asUint8Array?new Uint8Array(buffer.asUint8Array()):new Uint8Array(buffer);
    diag('cloud.manual.multi.accept',{file,page:pageNo,components:candidate.componentCount,componentSizes:candidate.componentSizes,strokes:candidate.strokeCount,rgb:candidate.rgb,lineWidth:candidate.lineWidth,bbox:candidate.bbox});
    return {data:out,removed:candidate.componentCount,manualForce:true,manualCandidate:{page:pageNo,bbox:candidate.bbox,exactRGB:candidate.rgb,exactLineWidth:candidate.lineWidth,vectorStrokeCount:candidate.strokeCount,vectorComponentCount:candidate.componentCount,vectorComponentSizes:candidate.componentSizes},details:[{removed:true,manualForce:true,page:pageNo,mode:'manual-unique-multicloud-block',removedClouds:candidate.componentCount,rgb:candidate.rgb,lineWidth:candidate.lineWidth,strokes:candidate.strokeCount,components:candidate.componentCount,componentSizes:candidate.componentSizes}]};
  }finally{ doc.destroy(); }
}
