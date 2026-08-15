// Safe revision-cloud stream removal v2.
// Supports the proven raster bbox path and a strict vector-family fallback.
const EPS=1e-6;
function sameNumber(a,b){return Math.abs(Number(a)-Number(b))<=EPS;}
function rectIntersects(a,b){return a&&b&&a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];}
function rectContains(outer,inner,pad=0){return inner[0]>=outer[0]-pad&&inner[1]>=outer[1]-pad&&inner[2]<=outer[2]+pad&&inner[3]<=outer[3]+pad;}
function unionRect(a,b){if(!a)return b.slice();return[Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[2],b[2]),Math.max(a[3],b[3])];}
function exactRGBKey(cs,color){const name=String(cs||'');if(!/DeviceRGB|RGB/i.test(name)||!Array.isArray(color)||color.length<3)return null;return color.slice(0,3).map(v=>Number(v).toPrecision(12)).join('|');}
function isRedRGB(rgb){if(!rgb||rgb.length<3)return false;const[r,g,b]=rgb.map(Number);return r>=0.5&&r>=g+0.12&&r>=b+0.12;}
function sameRGB(a,b){return a&&b&&a.length>=3&&b.length>=3&&sameNumber(a[0],b[0])&&sameNumber(a[1],b[1])&&sameNumber(a[2],b[2]);}
function pageRotation(page){try{const v=page.getObject()?.getInheritable?.('Rotate');const n=((Number(v?.valueOf?.()??v??0)%360)+360)%360;return[0,90,180,270].includes(n)?n:0;}catch(_){return 0;}}
function rotatedRect(page,r){const rot=pageRotation(page);if(!rot)return r.slice();const b=Array.from(page.getBounds());const dw=b[2]-b[0],dh=b[3]-b[1],uw=(rot===90||rot===270)?dh:dw,uh=(rot===90||rot===270)?dw:dh;const x0=r[0]-b[0],y0=r[1]-b[1],x1=r[2]-b[0],y1=r[3]-b[1];let out;if(rot===90)out=[uh-y1,x0,uh-y0,x1];else if(rot===180)out=[uw-x1,uh-y1,uw-x0,uh-y0];else out=[y0,uw-x1,y1,uw-x0];return[out[0]+b[0],out[1]+b[1],out[2]+b[0],out[3]+b[1]];}

function collectStrokes(mupdf,page){
  const out=[];
  const device=new mupdf.Device({strokePath(path,stroke,ctm,colorSpace,color,alpha){
    const key=exactRGBKey(colorSpace,color);if(!key||!isRedRGB(color))return;let bbox;try{bbox=Array.from(path.getBounds(stroke,ctm));}catch(_){return;}if(!bbox||bbox.length<4)return;
    out.push({key,rgb:[Number(color[0]),Number(color[1]),Number(color[2])],bbox,rotatedBBox:rotatedRect(page,bbox),lineWidth:Number(stroke?.getLineWidth?.()??stroke?.lineWidth??0),alpha:Number(alpha??1)});
  }});
  page.runPageContents(device,mupdf.Matrix.identity);device.close?.();return out;
}
function evaluateRasterFamily(strokes,cloudBBox,mode){const boxOf=s=>mode==='rotated'?s.rotatedBBox:s.bbox;const inside=strokes.filter(s=>rectIntersects(boxOf(s),cloudBBox)),outside=strokes.filter(s=>!rectIntersects(boxOf(s),cloudBBox));if(inside.length<20||outside.length!==0)return null;let union=null;for(const s of inside)union=unionRect(union,boxOf(s));const cw=Math.max(1,cloudBBox[2]-cloudBBox[0]),ch=Math.max(1,cloudBBox[3]-cloudBBox[1]),pad=Math.max(cw,ch)*0.08+3;if(!rectContains(cloudBBox,union,pad))return null;const coverageX=Math.max(0,Math.min(union[2],cloudBBox[2])-Math.max(union[0],cloudBBox[0]))/cw,coverageY=Math.max(0,Math.min(union[3],cloudBBox[3])-Math.max(union[1],cloudBBox[1]))/ch;if(coverageX<0.55||coverageY<0.55)return null;const widths=inside.map(s=>s.lineWidth).filter(Number.isFinite),minW=widths.length?Math.min(...widths):0,maxW=widths.length?Math.max(...widths):0;if(maxW-minW>Math.max(0.5,maxW*0.35))return null;return{strokes:inside,union,lineWidthRange:[minW,maxW],mode,coverageX,coverageY};}

export function chooseExactCloudFamily(mupdf,page,cloud){
  const all=collectStrokes(mupdf,page),cloudBBox=cloud.bbox;
  if(cloud?.source==='vector-family'&&Array.isArray(cloud.exactRGB)){
    const matches=all.filter(s=>sameRGB(s.rgb,cloud.exactRGB)&&sameNumber(s.lineWidth,cloud.exactLineWidth));
    if(matches.length<20)return{ok:false,reason:`familia vectorial exacta insuficiente=${matches.length}`};
    const inside=matches.filter(s=>rectIntersects(s.bbox,cloudBBox));
    const outside=matches.filter(s=>!rectIntersects(s.bbox,cloudBBox));
    if(inside.length<20||outside.length>Math.max(2,Math.floor(matches.length*0.05)))return{ok:false,reason:`familia vectorial fuera=${outside.length}`};
    let union=null;for(const s of inside)union=unionRect(union,s.bbox);
    const pad=Math.max(cloudBBox[2]-cloudBBox[0],cloudBBox[3]-cloudBBox[1])*0.08+3;
    if(!rectContains(cloudBBox,union,pad)&&!rectContains(union,cloudBBox,pad))return{ok:false,reason:'bbox vectorial no coincide'};
    return{ok:true,family:{key:inside[0].key,rgb:inside[0].rgb,strokes:inside,union,lineWidthRange:[cloud.exactLineWidth,cloud.exactLineWidth],mode:'raw',exactLineWidth:cloud.exactLineWidth}};
  }
  const families=new Map();for(const s of all){if(!families.has(s.key))families.set(s.key,[]);families.get(s.key).push(s);}
  const candidates=[];for(const[key,strokes]of families){for(const fit of[evaluateRasterFamily(strokes,cloudBBox,'raw'),evaluateRasterFamily(strokes,cloudBBox,'rotated')])if(fit)candidates.push({key,rgb:strokes[0].rgb,...fit});}
  candidates.sort((a,b)=>b.strokes.length-a.strokes.length);
  if(candidates.length>1&&candidates[0].key===candidates[1].key){const same=candidates.filter(c=>c.key===candidates[0].key).sort((a,b)=>(b.coverageX*b.coverageY)-(a.coverageX*a.coverageY)),other=candidates.filter(c=>c.key!==candidates[0].key);candidates.splice(0,candidates.length,same[0],...other);}
  if(candidates.length!==1)return{ok:false,reason:`familias exactas candidatas=${candidates.length}`,candidates};
  return{ok:true,family:candidates[0]};
}

function bufferToLatin1(buf){const bytes=buf?.asUint8Array?buf.asUint8Array():buf;let out='';for(let i=0;i<bytes.length;i+=0x8000)out+=String.fromCharCode(...bytes.subarray(i,Math.min(bytes.length,i+0x8000)));return out;}
function latin1ToBytes(s){const out=new Uint8Array(s.length);for(let i=0;i<s.length;i++)out[i]=s.charCodeAt(i)&255;return out;}
function markedStart(text,opIndex){const from=Math.max(0,opIndex-180),prefix=text.slice(from,opIndex);const m=/(\/OC\s+\/[A-Za-z0-9_.-]+\s*$|\/[A-Za-z0-9_.-]+\s*$)/.exec(prefix);return m?from+m.index:opIndex;}
function parseMarkedBlocks(text){const tok=/\b(?:BDC|BMC|EMC)\b/g,stack=[],blocks=[];let m;while((m=tok.exec(text))){if(m[0]==='BDC'||m[0]==='BMC'){stack.push({start:markedStart(text,m.index),op:m[0]});}else if(stack.length){const open=stack.pop();blocks.push({start:open.start,end:tok.lastIndex,op:open.op});}}return blocks;}
function hasExactRG(text,rgb){const rg=/(^|[\s\r\n])([-+]?(?:\d+(?:\.\d*)?|\.\d+))\s+([-+]?(?:\d+(?:\.\d*)?|\.\d+))\s+([-+]?(?:\d+(?:\.\d*)?|\.\d+))\s+RG(?=\s|$)/gm;let m;while((m=rg.exec(text))){if(sameRGB([Number(m[2]),Number(m[3]),Number(m[4])],rgb))return true;}return false;}
function hasExactWidth(text,width){const re=/(^|[\s\r\n])([-+]?(?:\d+(?:\.\d*)?|\.\d+))\s+w(?=\s|$)/gm;let m;while((m=re.exec(text))){if(sameNumber(Number(m[2]),width))return true;}return false;}
function findMarkedBlocksForFamily(text,rgb,lineWidthRange,exactLineWidth){const blocks=parseMarkedBlocks(text),hits=[];for(const b of blocks){const prefix=text.slice(Math.max(0,b.start-220),b.start),body=text.slice(b.start,b.end),probe=prefix+body;if(!hasExactRG(probe,rgb))continue;const width=Number.isFinite(exactLineWidth)?exactLineWidth:Number(lineWidthRange?.[0]??0);if(!hasExactWidth(probe,width))continue;hits.push(b);}return hits;}
function getContentRefs(page){const pageObj=page.getObject(),contents=pageObj.get('Contents');if(!contents)return[];if(contents.isStream?.())return[contents];const refs=[],n=Number(contents.length||0);for(let i=0;i<n;i++){const r=contents.get(i);if(r?.isStream?.())refs.push(r);}return refs;}

export function removeExactCloudFamilyFromPage(mupdf,page,cloud){
  const selected=chooseExactCloudFamily(mupdf,page,cloud);if(!selected.ok)return{removed:false,reason:selected.reason};const family=selected.family,refs=getContentRefs(page),hits=[];
  for(const ref of refs){let text;try{text=bufferToLatin1(ref.readStream());}catch(_){continue;}for(const block of findMarkedBlocksForFamily(text,family.rgb,family.lineWidthRange,family.exactLineWidth))hits.push({ref,text,block});}
  if(hits.length!==1)return{removed:false,reason:`bloques marcados exactos=${hits.length}`,family};
  const hit=hits[0],next=hit.text.slice(0,hit.block.start)+hit.text.slice(hit.block.end);hit.ref.writeStream(latin1ToBytes(next));return{removed:true,family,blockType:hit.block.op};
}
export async function removeDetectedRevisionCloudsByExactFamily(data,detectedPages){const mupdf=await import('https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js'),doc=mupdf.PDFDocument.openDocument(new Uint8Array(data),'application/pdf');let removed=0;const details=[];try{for(const p of detectedPages||[]){const page=doc.loadPage(Number(p.page)-1);for(const cloud of p.clouds||[]){const r=removeExactCloudFamilyFromPage(mupdf,page,cloud);details.push({page:p.page,...r});if(r.removed)removed++;}}if(!removed)return{data:new Uint8Array(data),removed:0,details};const buffer=doc.saveToBuffer('garbage=4,compress=yes,appearance=yes'),out=buffer?.asUint8Array?new Uint8Array(buffer.asUint8Array()):new Uint8Array(buffer);return{data:out,removed,details};}finally{doc.destroy();}}
