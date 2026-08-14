// Isolated revision-cloud stream removal. Not loaded by production unless explicitly imported.
// Strategy: use the stable raster cloud detection result as the spatial guard, inspect real
// strokePath geometry, require one exact RGB family, then remove only the matching marked-content
// block from the page content stream. If any guard is ambiguous, do nothing.

const EPS = 1e-6;

function rectIntersects(a, b) {
  return a && b && a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}
function rectContains(outer, inner, pad = 0) {
  return inner[0] >= outer[0] - pad && inner[1] >= outer[1] - pad && inner[2] <= outer[2] + pad && inner[3] <= outer[3] + pad;
}
function unionRect(a, b) {
  if (!a) return b.slice();
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
}
function sameNumber(a, b) { return Math.abs(Number(a) - Number(b)) <= EPS; }
function exactRGBKey(cs, color) {
  const name = String(cs || '');
  if (!/DeviceRGB|RGB/i.test(name) || !Array.isArray(color) || color.length < 3) return null;
  return [Number(color[0]), Number(color[1]), Number(color[2])].map(v => Number.isFinite(v) ? v.toPrecision(12) : '').join('|');
}
function isExactSameRGB(a, b) {
  if (!a || !b || a.length < 3 || b.length < 3) return false;
  return sameNumber(a[0], b[0]) && sameNumber(a[1], b[1]) && sameNumber(a[2], b[2]);
}
function isRedRGB(rgb) {
  if (!rgb || rgb.length < 3) return false;
  const [r,g,b] = rgb.map(Number);
  return r >= 0.50 && r >= g + 0.12 && r >= b + 0.12;
}

function collectStrokeFamilies(mupdf, page, cloudBBox) {
  const families = new Map();
  const all = [];
  const device = new mupdf.Device({
    strokePath(path, stroke, ctm, colorSpace, color, alpha) {
      const key = exactRGBKey(colorSpace, color);
      if (!key || !isRedRGB(color)) return;
      let bbox;
      try { bbox = path.getBounds(stroke, ctm); } catch (_) { return; }
      if (!bbox || bbox.length < 4) return;
      const rec = {
        key,
        rgb: [Number(color[0]), Number(color[1]), Number(color[2])],
        bbox: Array.from(bbox),
        lineWidth: Number(stroke?.lineWidth ?? 0),
        alpha: Number(alpha ?? 1),
        inCloud: rectIntersects(bbox, cloudBBox)
      };
      all.push(rec);
      if (!families.has(key)) families.set(key, []);
      families.get(key).push(rec);
    }
  });
  page.runPageContents(device, mupdf.Matrix.identity);
  device.close?.();
  return { families, all };
}

export function chooseExactCloudFamily(mupdf, page, cloudBBox) {
  const { families } = collectStrokeFamilies(mupdf, page, cloudBBox);
  const candidates = [];
  for (const [key, strokes] of families) {
    const inside = strokes.filter(s => s.inCloud);
    const outside = strokes.filter(s => !s.inCloud);
    if (inside.length < 20 || outside.length !== 0) continue;
    let union = null;
    for (const s of inside) union = unionRect(union, s.bbox);
    const cw = Math.max(1, cloudBBox[2]-cloudBBox[0]);
    const ch = Math.max(1, cloudBBox[3]-cloudBBox[1]);
    const pad = Math.max(cw, ch) * 0.08 + 3;
    if (!rectContains(cloudBBox, union, pad)) continue;
    const coverageX = Math.max(0, Math.min(union[2],cloudBBox[2])-Math.max(union[0],cloudBBox[0])) / cw;
    const coverageY = Math.max(0, Math.min(union[3],cloudBBox[3])-Math.max(union[1],cloudBBox[1])) / ch;
    if (coverageX < 0.55 || coverageY < 0.55) continue;
    const widths = inside.map(s=>s.lineWidth).filter(Number.isFinite);
    const minW = widths.length ? Math.min(...widths) : 0;
    const maxW = widths.length ? Math.max(...widths) : 0;
    if (maxW - minW > Math.max(0.5, maxW * 0.35)) continue;
    candidates.push({ key, rgb: inside[0].rgb, strokes: inside, union, lineWidthRange:[minW,maxW] });
  }
  candidates.sort((a,b)=>b.strokes.length-a.strokes.length);
  if (candidates.length !== 1) return { ok:false, reason:`familias exactas candidatas=${candidates.length}`, candidates };
  return { ok:true, family:candidates[0] };
}

function bufferToLatin1(buf) {
  const bytes = buf?.asUint8Array ? buf.asUint8Array() : buf;
  let out='';
  const step=0x8000;
  for(let i=0;i<bytes.length;i+=step) out += String.fromCharCode(...bytes.subarray(i, Math.min(bytes.length,i+step)));
  return out;
}
function latin1ToBytes(s) {
  const out = new Uint8Array(s.length);
  for (let i=0;i<s.length;i++) out[i]=s.charCodeAt(i)&255;
  return out;
}
function escapeRE(s) { return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }

// Find a marked-content OCG block whose immediately preceding graphics-state setup contains
// the exact RGB stroke color. We deliberately require a single unambiguous block.
function findExactColorOCBlocks(streamText, rgb) {
  const num = v => String(Number(v));
  const vals = rgb.map(num);
  const rgbRE = new RegExp(`(?:^|[\\r\\n\\s])${vals.map(escapeRE).join('\\s+')}\\s+RG(?:\\s|$)`, 'g');
  const matches=[];
  let m;
  while ((m=rgbRE.exec(streamText))) {
    const colorAt=m.index;
    const scanEnd=Math.min(streamText.length, rgbRE.lastIndex+500);
    const tail=streamText.slice(rgbRE.lastIndex,scanEnd);
    const bdc=/\/OC\s+\/([A-Za-z0-9_.-]+)\s+BDC/.exec(tail);
    if(!bdc) continue;
    const bdcStart=rgbRE.lastIndex+bdc.index;
    const bodyStart=bdcStart+bdc[0].length;
    let pos=bodyStart, depth=1, end=-1;
    const tok=/(?:\/[^\s<>()[\]{}%/]+|BDC\b|BMC\b|EMC\b)/g;
    tok.lastIndex=bodyStart;
    let t;
    while((t=tok.exec(streamText))){
      if(t[0]==='BDC'||t[0]==='BMC') depth++;
      else if(t[0]==='EMC') { depth--; if(depth===0){end=tok.lastIndex;break;} }
      pos=tok.lastIndex;
    }
    if(end<0) continue;
    matches.push({colorAt,bdcStart,bodyStart,end,oc:bdc[1]});
    rgbRE.lastIndex=end;
  }
  return matches;
}

function getContentRefs(page) {
  const pageObj=page.getObject();
  const contents=pageObj.get('Contents');
  if(!contents) return [];
  if(contents.isStream?.()) return [contents];
  const refs=[];
  const n=Number(contents.length||0);
  for(let i=0;i<n;i++) { const r=contents.get(i); if(r?.isStream?.()) refs.push(r); }
  return refs;
}

export function removeExactCloudFamilyFromPage(mupdf, page, cloudBBox) {
  const selected=chooseExactCloudFamily(mupdf,page,cloudBBox);
  if(!selected.ok) return {removed:false,reason:selected.reason};
  const rgb=selected.family.rgb;
  const refs=getContentRefs(page);
  const hits=[];
  for(const ref of refs){
    let text;
    try{text=bufferToLatin1(ref.readStream());}catch(_){continue;}
    for(const block of findExactColorOCBlocks(text,rgb)) hits.push({ref,text,block});
  }
  if(hits.length!==1) return {removed:false,reason:`bloques OCG exactos=${hits.length}`,family:selected.family};
  const hit=hits[0];
  // Remove the OCG block only. Keep color setup outside the block untouched so surrounding
  // graphics state remains byte-for-byte equivalent apart from the cloud content itself.
  const next=hit.text.slice(0,hit.block.bdcStart)+hit.text.slice(hit.block.end);
  hit.ref.writeStream(latin1ToBytes(next));
  return {removed:true,oc:hit.block.oc,family:selected.family};
}

export async function removeDetectedRevisionCloudsByExactFamily(data, detectedPages) {
  const mupdf = await import('https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js');
  const doc=mupdf.PDFDocument.openDocument(new Uint8Array(data),'application/pdf');
  let removed=0; const details=[];
  try{
    for(const p of detectedPages||[]){
      const page=doc.loadPage(Number(p.page)-1);
      for(const cloud of p.clouds||[]){
        const r=removeExactCloudFamilyFromPage(mupdf,page,cloud.bbox);
        details.push({page:p.page,...r});
        if(r.removed) removed++;
      }
    }
    if(!removed) return {data:new Uint8Array(data),removed:0,details};
    const buffer=doc.saveToBuffer('garbage=4,compress=yes,appearance=yes');
    const out=buffer?.asUint8Array?new Uint8Array(buffer.asUint8Array()):new Uint8Array(buffer);
    return {data:out,removed,details};
  }finally{doc.destroy();}
}
