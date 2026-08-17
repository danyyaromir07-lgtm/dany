// Manual-only zero-raster revision-cloud fallback.
// This module is intentionally narrow: it runs only when the normal detector found ZERO clouds,
// and it only removes one exact Revit-style red cloud family contained in one exact BMC block.
const EPS=1e-5;
const TARGET_RGB=[1,0,0];
const TARGET_WIDTH=0.34015;

function sameNumber(a,b,eps=EPS){ return Math.abs(Number(a)-Number(b))<=eps; }
function sameRGB(a,b){ return a&&b&&a.length>=3&&b.length>=3&&sameNumber(a[0],b[0])&&sameNumber(a[1],b[1])&&sameNumber(a[2],b[2]); }
function area(r){ return Math.max(0,Number(r[2])-Number(r[0]))*Math.max(0,Number(r[3])-Number(r[1])); }
function unionRect(a,b){ if(!a)return b.slice(); return [Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[2],b[2]),Math.max(a[3],b[3])]; }
function rectGap(a,b){ const dx=Math.max(0,Math.max(a[0],b[0])-Math.min(a[2],b[2])); const dy=Math.max(0,Math.max(a[1],b[1])-Math.min(a[3],b[3])); return Math.hypot(dx,dy); }
function diag(stage,extra={}){ try{ window.__cloudDiagnostic?.({stage,detail:'manual-cloud-zero-raster-v1',...extra}); }catch(_){} }
function detectedCount(pages){ return (pages||[]).reduce((n,p)=>n+(Array.isArray(p?.clouds)?p.clouds.length:0),0); }

function collectTargetStrokes(mupdf,page){
  const out=[];
  const device=new mupdf.Device({
    strokePath(path,stroke,ctm,colorSpace,color,alpha){
      if(!/DeviceRGB|RGB/i.test(String(colorSpace||''))||!sameRGB(color,TARGET_RGB)||Number(alpha??1)<=0)return;
      const w=Number(stroke?.getLineWidth?.()??stroke?.lineWidth??0);
      if(!sameNumber(w,TARGET_WIDTH))return;
      let bbox; try{ bbox=Array.from(path.getBounds(stroke,ctm)); }catch(_){ return; }
      if(bbox?.length>=4&&bbox.every(Number.isFinite))out.push({bbox,rgb:Array.from(color).slice(0,3).map(Number),lineWidth:w});
    },
    fillPath(){},clipPath(){},clipStrokePath(){},fillText(){},clipText(){},strokeText(){},clipStrokeText(){},ignoreText(){},fillShade(){},fillImage(){},fillImageMask(){},clipImageMask(){},beginMask(){},endMask(){},popClip(){},beginGroup(){},endGroup(){},beginTile(){return 0;},endTile(){},beginLayer(){},endLayer(){},beginStructure(){},endStructure(){},beginMetatext(){},endMetatext(){},renderFlags(){},setDefaultColorSpaces(){},close(){}
  });
  try{ page.runPageContents(device,mupdf.Matrix.identity); }finally{ try{device.close?.();}catch(_){} }
  return out;
}

function connectedComponents(strokes,gapLimit){
  const n=strokes.length,seen=new Uint8Array(n),comps=[];
  for(let i=0;i<n;i++){
    if(seen[i])continue;
    const stack=[i],comp=[]; seen[i]=1;
    while(stack.length){
      const j=stack.pop(); comp.push(strokes[j]);
      for(let k=0;k<n;k++)if(!seen[k]&&rectGap(strokes[j].bbox,strokes[k].bbox)<=gapLimit){seen[k]=1;stack.push(k);}
    }
    comps.push(comp);
  }
  return comps.sort((a,b)=>b.length-a.length);
}
function familyUnion(strokes){ let out=null; for(const s of strokes)out=unionRect(out,s.bbox); return out; }

function evaluatePage(page,strokes){
  if(strokes.length<40||strokes.length>400)return null;
  const comps=connectedComponents(strokes,18.5);
  if(comps.length<2||comps.length>8)return null;
  if(comps.some(c=>c.length<20))return null;
  if(comps.reduce((n,c)=>n+c.length,0)!==strokes.length)return null;
  const pageBounds=Array.from(page.getBounds()),pageArea=Math.max(1,area(pageBounds));
  const boxes=[],sizes=[]; let totalArea=0;
  for(const comp of comps){
    const box=familyUnion(comp),w=box[2]-box[0],h=box[3]-box[1],aspect=Math.min(w,h)/Math.max(w,h);
    if(w<40||h<40||aspect<0.10)return null;
    boxes.push(box); sizes.push(comp.length); totalArea+=area(box);
  }
  if(totalArea/pageArea>0.015)return null;
  let bbox=null; for(const b of boxes)bbox=unionRect(bbox,b);
  return {rgb:TARGET_RGB.slice(),lineWidth:TARGET_WIDTH,strokeCount:strokes.length,componentCount:comps.length,componentSizes:sizes,componentBoxes:boxes,bbox,componentAreaFraction:totalArea/pageArea};
}

function bufferToLatin1(buf){ const bytes=buf?.asUint8Array?buf.asUint8Array():buf; let out=''; for(let i=0;i<bytes.length;i+=0x8000)out+=String.fromCharCode(...bytes.subarray(i,Math.min(bytes.length,i+0x8000))); return out; }
function latin1ToBytes(s){ const out=new Uint8Array(s.length); for(let i=0;i<s.length;i++)out[i]=s.charCodeAt(i)&255; return out; }
function markedStart(text,opIndex){ const from=Math.max(0,opIndex-180),prefix=text.slice(from,opIndex); const m=/(\/OC\s+\/[A-Za-z0-9_.-]+\s*$|\/?[A-Za-z0-9_.-]+\s*$)/.exec(prefix); return m?from+m.index:opIndex; }
function parseMarkedBlocks(text){ const tok=/\b(?:BDC|BMC|EMC)\b/g,stack=[],blocks=[]; let m; while((m=tok.exec(text))){ if(m[0]==='BDC'||m[0]==='BMC')stack.push({start:markedStart(text,m.index),op:m[0]}); else if(stack.length){ const open=stack.pop(); blocks.push({start:open.start,end:tok.lastIndex,op:open.op}); } } return blocks; }
function getContentRefs(page){ const pageObj=page.getObject(),contents=pageObj.get('Contents'); if(!contents)return[]; if(contents.isStream?.())return[contents]; const refs=[],n=Number(contents.length||0); for(let i=0;i<n;i++){const r=contents.get(i);if(r?.isStream?.())refs.push(r);} return refs; }
function countStrokes(text){ return (text.match(/(?:^|[\r\n])\s*S\s*(?=[\r\n]|$)/g)||[]).length; }
function hasExactRG(text,rgb){ const re=/(^|[\s\r\n])([-+]?(?:\d+(?:\.\d*)?|\.\d+))\s+([-+]?(?:\d+(?:\.\d*)?|\.\d+))\s+([-+]?(?:\d+(?:\.\d*)?|\.\d+))\s+RG(?=\s|$)/gm; let m,seen=false; while((m=re.exec(text))){seen=true;if(!sameRGB([Number(m[2]),Number(m[3]),Number(m[4])],rgb))return false;} return seen; }
function hasExactWidth(text,w){ const re=/(^|[\s\r\n])([-+]?(?:\d+(?:\.\d*)?|\.\d+))\s+w(?=\s|$)/gm; let m,seen=false; while((m=re.exec(text))){seen=true;if(!sameNumber(Number(m[2]),w))return false;} return seen; }
function hasUnsafePaint(text){ if(/\bBT\b|\bTj\b|\bTJ\b|\bBI\b|\bID\b|\bEI\b|\/[A-Za-z0-9_.-]+\s+Do\b|\bsh\b/.test(text))return true; return /(?:^|[\r\n])\s*(?:f\*?|F|B\*?|b\*?)\s*(?=[\r\n]|$)/m.test(text); }
function exactBlockHits(page,candidate){
  const hits=[];
  for(const ref of getContentRefs(page)){
    let text; try{text=bufferToLatin1(ref.readStream());}catch(_){continue;}
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
function fail(data,reason,extra={}){ return {data:new Uint8Array(data),removed:0,manualForce:false,details:[{removed:false,manualForce:true,mode:'manual-zero-raster-exact-block',reason,...extra}]}; }

export async function removeManualZeroRasterCloudBlock(data,detectedPages,options={}){
  const file=String(options.file||'');
  if(detectedCount(detectedPages)!==0)return fail(data,'zero-raster manual solo se permite cuando el detector normal encontró 0 nubes');
  diag('cloud.manual.zero.start',{file});
  const mupdf=await import('https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js');
  const doc=mupdf.PDFDocument.openDocument(new Uint8Array(data),'application/pdf');
  try{
    const candidates=[];
    for(let pi=0;pi<doc.countPages();pi++){
      const page=doc.loadPage(pi),strokes=collectTargetStrokes(mupdf,page),candidate=evaluatePage(page,strokes);
      if(candidate)candidates.push({pageNo:pi+1,page,candidate});
    }
    if(candidates.length!==1){ diag('cloud.manual.zero.reject',{file,reason:`familias exactas candidatas=${candidates.length}`}); return fail(data,`zero-raster manual: familias exactas candidatas=${candidates.length}`); }
    const entry=candidates[0],hits=exactBlockHits(entry.page,entry.candidate);
    if(hits.length!==1){ diag('cloud.manual.zero.reject',{file,page:entry.pageNo,reason:`bloques BMC exactos=${hits.length}`,strokes:entry.candidate.strokeCount}); return fail(data,`zero-raster manual: bloques BMC exactos=${hits.length}`,{page:entry.pageNo}); }
    const hit=hits[0],next=hit.text.slice(0,hit.block.start)+hit.text.slice(hit.block.end); hit.ref.writeStream(latin1ToBytes(next));
    const buffer=doc.saveToBuffer('garbage=4,compress=yes,appearance=yes'),out=buffer?.asUint8Array?new Uint8Array(buffer.asUint8Array()):new Uint8Array(buffer);
    diag('cloud.manual.zero.accept',{file,page:entry.pageNo,components:entry.candidate.componentCount,strokes:entry.candidate.strokeCount,rgb:entry.candidate.rgb,lineWidth:entry.candidate.lineWidth});
    return {data:out,removed:entry.candidate.componentCount,manualForce:true,manualCandidate:{page:entry.pageNo,bbox:entry.candidate.bbox,exactRGB:entry.candidate.rgb,exactLineWidth:entry.candidate.lineWidth,vectorStrokeCount:entry.candidate.strokeCount,vectorComponentCount:entry.candidate.componentCount,vectorComponentSizes:entry.candidate.componentSizes},details:[{removed:true,manualForce:true,page:entry.pageNo,mode:'manual-zero-raster-exact-block',removedClouds:entry.candidate.componentCount,rgb:entry.candidate.rgb,lineWidth:entry.candidate.lineWidth,strokes:entry.candidate.strokeCount,components:entry.candidate.componentCount,componentSizes:entry.candidate.componentSizes}]};
  }finally{doc.destroy();}
}
