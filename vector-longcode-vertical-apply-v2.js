import * as mupdf from 'https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js';

const FONT_BASE = 'FLongVertSafe';
const RENDER_SCALE = 1.0;

const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[‐‑‒–—−]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase();
const canonical = s => norm(s).replace(/\s*[-]\s*/g, '-').replace(/\s*([:/_.])\s*/g, '$1');
const codeKey = s => canonical(s).replace(/[^a-z0-9]/g, '').replace(/o/g, '0').replace(/i/g, '1');

function isLongDrawingCode(v) {
  const raw = String(v || '').trim();
  const key = codeKey(raw);
  const parts = raw.split('_').filter(Boolean);
  return raw.includes('_') && key.length >= 20 && key.length <= 90 && parts.length >= 5 && parts.every(p => /^[A-Za-z0-9.-]+$/.test(p));
}
function orientationOf(hit) {
  const n = ((Number(hit?.localOrientation || 0) % 360) + 360) % 360;
  return n === 90 || n === 270 ? n : 0;
}
function diag(stage, extra = {}) {
  try { window.__ocrDiagnostic?.({ time: new Date().toISOString(), stage, detail: 'long-code-vertical-apply-v2-legacy-placement', ...extra }); } catch (_) {}
}
function asBytes(buffer) { return buffer?.asUint8Array ? new Uint8Array(buffer.asUint8Array()) : new Uint8Array(buffer); }
function saveBytes(doc) { return asBytes(doc.saveToBuffer('garbage=0,compress=no,appearance=yes')); }
function ascii(s) { return new TextEncoder().encode(s); }
function concat(...parts) {
  const size = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
}
function pdfEscapeBytes(text) {
  const out = [];
  for (const ch of String(text || '')) {
    const code = ch.codePointAt(0);
    let byte = code >= 0 && code <= 127 ? code : code >= 0xA0 && code <= 0xFF ? code : 63;
    if (code === 0x20AC) byte = 0x80;
    if (byte === 40 || byte === 41 || byte === 92) out.push(92);
    out.push(byte);
  }
  return new Uint8Array(out);
}
function fontAdvance(font, text) {
  let total = 0;
  for (const ch of String(text || '')) total += font.advanceGlyph(font.encodeCharacter(ch), 0);
  return total;
}
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function resolved(obj) { try { return obj?.resolve?.() || obj; } catch (_) { return obj; } }
function pageHandle(page) {
  const ref = page.getObject();
  const dict = resolved(ref);
  if (!dict?.isDictionary?.()) throw new Error('No se pudo resolver el diccionario de página.');
  return { ref, dict, indirect: !ref?.isDictionary?.() };
}
function commitIndirect(ref, obj, indirect) {
  if (indirect && typeof ref?.writeObject === 'function') ref.writeObject(obj);
}
function getRotation(page) {
  try {
    const dict = resolved(page.getObject());
    const rotateObject = dict?.getInheritable?.('Rotate') || dict?.get?.('Rotate');
    const rotateValue = resolved(rotateObject);
    return ((Number(rotateValue?.asNumber?.() ?? rotateValue?.valueOf?.() ?? 0) % 360) + 360) % 360;
  } catch (_) { return 0; }
}
function pageDimensions(page) {
  const b = Array.from(page.getBounds?.() || [], Number);
  if (b.length !== 4 || !b.every(Number.isFinite)) throw new Error('No se pudieron obtener los límites de página.');
  const vw = Math.abs(b[2] - b[0]);
  const vh = Math.abs(b[3] - b[1]);
  const r = getRotation(page);
  return { vw, vh, uw: (r === 90 || r === 270) ? vh : vw, uh: (r === 90 || r === 270) ? vw : vh, rotation: r };
}

// Reutiliza la geometría de colocación que ya funcionaba en vector-apply-v5.
function basePlacement(page, vx, vy) {
  const { uw, uh, rotation: r } = pageDimensions(page);
  if (r === 90) return { a: 0, b: 1, c: -1, d: 0, e: vy, f: vx };
  if (r === 180) return { a: -1, b: 0, c: 0, d: -1, e: uw - vx, f: vy };
  if (r === 270) return { a: 0, b: -1, c: 1, d: 0, e: uw - vy, f: uh - vx };
  return { a: 1, b: 0, c: 0, d: 1, e: vx, f: uh - vy };
}
function placement(page, raw, orientation) {
  let vx, vy;
  if (orientation === 90) { vx = raw[0]; vy = raw[1]; }
  else { vx = raw[2]; vy = raw[3]; }
  const p = basePlacement(page, vx, vy);
  const rad = orientation * Math.PI / 180;
  const co = Math.cos(rad), si = Math.sin(rad);
  return {
    a: p.a * co - p.c * si,
    b: p.b * co - p.d * si,
    c: p.a * si + p.c * co,
    d: p.b * si + p.d * co,
    e: p.e, f: p.f,
  };
}
function viewPointToPdf(page, x, y) {
  const { uw, uh, rotation: r } = pageDimensions(page);
  if (r === 90) return [y, x];
  if (r === 180) return [uw - x, y];
  if (r === 270) return [uw - y, uh - x];
  return [x, uh - y];
}
function pdfRectForViewBox(page, raw, padX, padY) {
  const x0 = raw[0] - padX, y0 = raw[1] - padY, x1 = raw[2] + padX, y1 = raw[3] + padY;
  const pts = [viewPointToPdf(page, x0, y0), viewPointToPdf(page, x1, y0), viewPointToPdf(page, x0, y1), viewPointToPdf(page, x1, y1)];
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
function metrics(raw, source, replacement, orientation) {
  const rw = Math.max(1, raw[2] - raw[0]);
  const rh = Math.max(1, raw[3] - raw[1]);
  const run = rh;
  const cross = rw;
  const font = new mupdf.Font('Helvetica');
  let size = Math.max(3.0, Math.min(72, cross / .72));
  size *= .80;
  const sourceAdvance = Math.max(.01, fontAdvance(font, String(source || 'M')) * size);
  let scaleX = clamp(run / sourceAdvance, .62, 2.05);
  const replacementRun = fontAdvance(font, replacement) * size * scaleX;
  return { width: rw, height: rh, run, cross, size, scaleX, orientation, replacementRun };
}
function chooseFontResource(doc, page) {
  const pageObj = pageHandle(page);
  const resourceRef = pageObj.dict.get('Resources');
  let resources = resolved(resourceRef);
  const resourceIndirect = !!resourceRef && !resourceRef?.isDictionary?.();
  if (!resources || !resources.isDictionary?.()) { resources = doc.newDictionary(); pageObj.dict.put('Resources', resources); }
  let fontRef = resources.get('Font');
  let fonts = resolved(fontRef);
  const fontIndirect = !!fontRef && !fontRef?.isDictionary?.();
  if (!fonts || !fonts.isDictionary?.()) { fonts = doc.newDictionary(); resources.put('Font', fonts); fontRef = null; }
  let suffix = 1, name = `${FONT_BASE}${suffix}`;
  while (fonts.get(name) && !fonts.get(name).isNull?.()) { suffix++; name = `${FONT_BASE}${suffix}`; }
  fonts.put(name, doc.addSimpleFont(new mupdf.Font('Helvetica'), 'Latin'));
  if (fontIndirect && fontRef?.writeObject) fontRef.writeObject(fonts);
  if (resourceIndirect && resourceRef?.writeObject) resourceRef.writeObject(resources);
  commitIndirect(pageObj.ref, pageObj.dict, pageObj.indirect);
  return name;
}
function appendContent(doc, page, content) {
  const pageObj = pageHandle(page);
  const stream = doc.addStream(content);
  const contentsRef = pageObj.dict.get('Contents');
  if (!contentsRef || contentsRef.isNull?.()) { pageObj.dict.put('Contents', stream); commitIndirect(pageObj.ref, pageObj.dict, pageObj.indirect); return; }
  const contents = resolved(contentsRef);
  const array = doc.newArray();
  if (contents?.isArray?.()) { for (let i = 0; i < contents.length; i++) array.push(contents.get(i)); }
  else array.push(contentsRef);
  array.push(stream);
  pageObj.dict.put('Contents', array);
  commitIndirect(pageObj.ref, pageObj.dict, pageObj.indirect);
}
function makeOverlayContent(page, raw, source, replacement, m, fontName) {
  const padX = Math.min(1.0, Math.max(.35, m.cross * .11));
  const padY = Math.min(1.2, Math.max(.55, m.cross * .15));
  const rect = pdfRectForViewBox(page, raw, padX, padY);
  const p = placement(page, raw, m.orientation);
  const rectCmd = `q 1 1 1 rg ${rect[0].toFixed(3)} ${rect[1].toFixed(3)} ${(rect[2]-rect[0]).toFixed(3)} ${(rect[3]-rect[1]).toFixed(3)} re f Q `;
  const textPrefix = `q BT /${fontName} ${m.size.toFixed(3)} Tf ${(m.scaleX * 100).toFixed(3)} Tz 0 Tc 0 g ${p.a.toFixed(6)} ${p.b.toFixed(6)} ${p.c.toFixed(6)} ${p.d.toFixed(6)} ${p.e.toFixed(3)} ${p.f.toFixed(3)} Tm (`;
  return concat(ascii(rectCmd + textPrefix), pdfEscapeBytes(replacement), ascii(') Tj ET Q'));
}
function applyOverlay(doc, pageNo, raw, source, replacement, orientation) {
  const page = doc.loadPage(pageNo - 1);
  const m = metrics(raw, source, replacement, orientation);
  const fontName = chooseFontResource(doc, page);
  appendContent(doc, page, makeOverlayContent(page, raw, source, replacement, m, fontName));
  try { page.update?.(); } catch (_) {}
  return m;
}
function structuredLines(page) {
  try {
    const data = JSON.parse(page.toStructuredText('preserve-spans').asJSON());
    const lines = [];
    for (const block of data?.blocks || []) {
      if (block?.type !== 'text') continue;
      for (const line of block?.lines || []) {
        const b = line?.bbox;
        if (Number(line?.wmode || 0) !== 0 || !String(line?.text || '').trim() || !b || ![b.x,b.y,b.w,b.h].every(Number.isFinite)) continue;
        lines.push({ text: String(line.text), bbox: [b.x,b.y,b.x+b.w,b.y+b.h] });
      }
    }
    return lines;
  } catch (_) { return []; }
}
function area(b) { return Math.max(0,b[2]-b[0]) * Math.max(0,b[3]-b[1]); }
function overlapRatio(a,b) {
  const x = Math.max(0,Math.min(a[2],b[2])-Math.max(a[0],b[0]));
  const y = Math.max(0,Math.min(a[3],b[3])-Math.max(a[1],b[1]));
  return x*y/Math.max(1,area(a));
}
function pdfTextUnder(page, raw) { return structuredLines(page).filter(line => overlapRatio(raw,line.bbox) >= .18); }
function renderPage(doc, pageNo) {
  const page = doc.loadPage(pageNo - 1);
  const pix = page.toPixmap(mupdf.Matrix.scale(RENDER_SCALE,RENDER_SCALE),mupdf.ColorSpace.DeviceRGB,false,false);
  try { return { pixels:new Uint8Array(pix.getPixels()), width:pix.getWidth(), height:pix.getHeight(), components:pix.getNumberOfComponents(), stride:pix.getStride(), x:Number(pix.getX?.()||0), y:Number(pix.getY?.()||0) }; }
  finally { try { pix.destroy?.(); } catch (_) {} }
}
function diffCheck(before, after, raw) {
  if (!before || !after || before.width!==after.width || before.height!==after.height || before.components!==after.components || before.stride!==after.stride) return { safe:false, reason:'render incompatible' };
  const margin = 7;
  const allowed = [raw[0]-margin,raw[1]-margin,raw[2]+margin,raw[3]+margin];
  const px0=allowed[0]*RENDER_SCALE-before.x, py0=allowed[1]*RENDER_SCALE-before.y, px1=allowed[2]*RENDER_SCALE-before.x, py1=allowed[3]*RENDER_SCALE-before.y;
  let changed=0,outside=0;
  for(let y=0;y<before.height;y++){
    const row=y*before.stride;
    for(let x=0;x<before.width;x++){
      const off=row+x*before.components; let delta=0;
      for(let c=0;c<Math.min(3,before.components);c++) delta=Math.max(delta,Math.abs(before.pixels[off+c]-after.pixels[off+c]));
      if(delta<=10)continue; changed++; if(x<px0||x>px1||y<py0||y>py1)outside++;
    }
  }
  if(changed<8)return{safe:false,reason:'sin cambio visual verificable',changed,outside,allowed};
  const outsideLimit=Math.max(16,Math.ceil(changed*.015));
  if(outside>outsideLimit)return{safe:false,reason:`cambios fuera del bbox vertical esperado (${outside}/${changed})`,changed,outside,allowed};
  return{safe:true,changed,outside,allowed};
}
function preflight(doc,pageNo,raw,source,replacement,orientation){
  let baseline=null,trial=null,rendered=null;
  try{
    const bytes=saveBytes(doc);
    baseline=mupdf.PDFDocument.openDocument(new Uint8Array(bytes),'application/pdf');
    const before=renderPage(baseline,pageNo);
    trial=mupdf.PDFDocument.openDocument(new Uint8Array(bytes),'application/pdf');
    const m=applyOverlay(trial,pageNo,raw,source,replacement,orientation);
    const trialBytes=saveBytes(trial);
    rendered=mupdf.PDFDocument.openDocument(new Uint8Array(trialBytes),'application/pdf');
    const after=renderPage(rendered,pageNo);
    return{...diffCheck(before,after,raw),metrics:m};
  }finally{try{baseline?.destroy()}catch(_){}try{trial?.destroy()}catch(_){}try{rendered?.destroy()}catch(_){}}
}

export function applyVerticalLongDrawingCodes(doc, analysis) {
  let count=0; const replacements=[], skipped=[];
  for(const rule of analysis?.counts||[]){
    if(!isLongDrawingCode(rule?.find))continue;
    const replacement=String(rule?.replace??''); if(!replacement.trim())continue;
    const matches=(rule?.ocrMatches||[]).filter(hit=>hit?.verticalLongDrawingCode===true&&hit?.bbox&&orientationOf(hit));
    for(const hit of matches){
      const pageNo=Math.max(1,Number(hit.page||1)),orientation=orientationOf(hit),raw=hit.bbox.map(Number),confidence=Number(hit.confidence||0),similarity=Number(hit.similarity||0);
      if(raw.length!==4||!raw.every(Number.isFinite)||raw[2]<=raw[0]||raw[3]<=raw[1]||raw[3]-raw[1]<=(raw[2]-raw[0])*1.6){skipped.push(`${rule.find}: bbox vertical de código completo inválido`);continue;}
      if(confidence<8||(similarity>0&&similarity<.84)){skipped.push(`${rule.find}: OCR vertical de código completo descartado por confianza/similitud`);continue;}
      const ocrText=String(hit.ocrText||hit.matchedText||'');
      if(codeKey(ocrText).length<codeKey(rule.find).length-8){skipped.push(`${rule.find}: OCR vertical incompleto`);continue;}
      const page=doc.loadPage(pageNo-1),realText=pdfTextUnder(page,raw);
      if(realText.length){diag('ocr.longcode.vertical.pdftext.reject',{target:rule.find,page:pageNo,orientation,bbox:raw,pdfText:realText.map(x=>x.text).join(' | ').slice(0,500)});skipped.push(`${rule.find}: vertical OCR no aplicado porque existe texto PDF real bajo el bbox`);continue;}
      try{
        diag('ocr.longcode.vertical.overlay.start',{target:rule.find,page:pageNo,orientation,bbox:raw,replacement});
        const check=preflight(doc,pageNo,raw,String(rule.find),replacement,orientation);
        diag('ocr.longcode.vertical.visual.validate',{target:rule.find,page:pageNo,orientation,bbox:raw,allowed:check.allowed,changed:check.changed,outside:check.outside,reason:check.reason||'ok'});
        if(!check.safe){diag('ocr.longcode.vertical.visual.reject',{target:rule.find,page:pageNo,orientation,bbox:raw,allowed:check.allowed,changed:check.changed,outside:check.outside,reason:check.reason});skipped.push(`${rule.find}: overlay vertical de código completo rechazado (${check.reason})`);continue;}
        const m=applyOverlay(doc,pageNo,raw,String(rule.find),replacement,orientation);
        diag('ocr.longcode.vertical.visual.accept',{target:rule.find,page:pageNo,orientation,bbox:raw,allowed:check.allowed,changed:check.changed,outside:check.outside});
        count++; replacements.push({page:pageNo,bbox:raw,find:String(rule.find),text:replacement,mode:'long-code-vertical-overlay-v2',orientation,size:m.size,scaleX:m.scaleX,visualChanged:check.changed});
      }catch(error){diag('ocr.longcode.vertical.visual.reject',{target:rule.find,page:pageNo,orientation,bbox:raw,reason:error?.message||String(error)});skipped.push(`${rule.find}: overlay vertical de código completo no aplicado (${error?.message||error})`);}
    }
  }
  return{count,replacements,skipped};
}
