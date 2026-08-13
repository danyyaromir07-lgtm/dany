import * as mupdf from 'https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js';

const q = s => document.querySelector(s);
const CHECK = '#batchRemoveClouds';
const STATUS = '#batchStatus';

function say(text){ const el=q(STATUS); if(el) el.textContent=text; }

function isRed(r,g,b){
  return r >= 0.68 && g <= 0.22 && b <= 0.22 && r >= g*2.8 && r >= b*2.8;
}

function detectRedComponents(page){
  // Intentionally runs only when the dedicated checkbox is enabled.
  const bounds = page.getBounds();
  const w = Math.min(1000, Math.max(600, Math.round(bounds[2]-bounds[0])));
  const scale = w / Math.max(1, bounds[2]-bounds[0]);
  const h = Math.max(1, Math.round((bounds[3]-bounds[1])*scale));
  const pix = page.toPixmap(mupdf.Matrix.scale(scale,scale), mupdf.ColorSpace.DeviceRGB, false, true);
  const png = pix.asPNG();
  // Browser-side image decode is intentionally isolated here; no OCR is involved.
  return {pix, png, scale, w:pix.width, h:pix.height, bounds:[bounds[0],bounds[1],bounds[2],bounds[3]]};
}

async function pngPixels(png){
  if(typeof createImageBitmap !== 'function') throw new Error('El navegador no permite analizar la miniatura de la nube.');
  const blob = new Blob([png],{type:'image/png'});
  const bmp = await createImageBitmap(blob);
  const canvas = document.createElement('canvas'); canvas.width=bmp.width; canvas.height=bmp.height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true}); ctx.drawImage(bmp,0,0);
  const img=ctx.getImageData(0,0,bmp.width,bmp.height); bmp.close();
  return {data:img.data,w:bmp.width,h:bmp.height};
}

function connectedComponents(mask,w,h){
  const seen=new Uint8Array(w*h), comps=[]; const qx=new Int32Array(w*h), qy=new Int32Array(w*h);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    const idx=y*w+x; if(!mask[idx]||seen[idx]) continue;
    let head=0,tail=0; qx[tail]=x; qy[tail]=y; tail++; seen[idx]=1;
    let minX=x,maxX=x,minY=y,maxY=y,count=0;
    while(head<tail){
      const cx=qx[head],cy=qy[head];head++;count++;minX=Math.min(minX,cx);maxX=Math.max(maxX,cx);minY=Math.min(minY,cy);maxY=Math.max(maxY,cy);
      for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){
        if(!dx&&!dy) continue; const nx=cx+dx,ny=cy+dy;if(nx<0||ny<0||nx>=w||ny>=h)continue;const ni=ny*w+nx;if(mask[ni]&&!seen[ni]){seen[ni]=1;qx[tail]=nx;qy[tail]=ny;tail++}}
    }
    const bw=maxX-minX+1,bh=maxY-minY+1,area=bw*bh,fill=count/area;
    if(count>=120 && bw>=80 && bh>=50){
      comps.push({x:minX,y:minY,w:bw,h:bh,count,fill,aspect:Math.max(bw,bh)/Math.max(1,Math.min(bw,bh))});
    }
  }
  return comps;
}

function chooseClouds(comps){
  return comps.filter(c=>{
    const large=Math.max(c.w,c.h)>=220;
    const elongated=c.aspect>=1.15;
    const thin=c.fill<=0.18;
    const good=large&&elongated&&thin;
    return good;
  }).sort((a,b)=>(b.count-b.count)||((b.w*b.h)-(a.w*a.h))).slice(0,8);
}

async function detectPageClouds(page){
  const p=detectRedComponents(page), px=await pngPixels(p.png), mask=new Uint8Array(px.w*px.h);
  for(let i=0,j=0;i<px.data.length;i+=4,j++){
    const r=px.data[i]/255,g=px.data[i+1]/255,b=px.data[i+2]/255;
    mask[j]=isRed(r,g,b)?1:0;
  }
  const comps=chooseClouds(connectedComponents(mask,px.w,px.h));
  return comps.map(c=>({
    pageBounds:p.bounds,
    scale:p.scale,
    px:c,
    pdf:[p.bounds[0]+c.x/p.scale,p.bounds[1]+c.y/p.scale,p.bounds[0]+(c.x+c.w)/p.scale,p.bounds[1]+(c.y+c.h)/p.scale]
  }));
}

function inject(){
  if(q(CHECK)) return;
  const host=q('#batchRemoveComments')?.closest('.option-box'); if(!host) return;
  const box=document.createElement('div'); box.className='option-box'; box.style.marginTop='10px';
  box.innerHTML='<label><input id="batchRemoveClouds" type="checkbox"><span>☁️ Eliminar nubes de revisión gráficas</span></label><small>Detecta automáticamente nubes rojas de revisión. Solo se ejecuta al activar esta opción.</small>';
  host.parentElement?.appendChild(box);
}

async function prepareCloudRemoval(){
  if(!q(CHECK)?.checked) return;
  const batch=window.__batchAnalysis||[]; if(!batch.length) return;
  say('Buscando nubes de revisión gráficas…');
  for(const item of batch){
    if(item?.error||!item.data) continue;
    try{
      const doc=mupdf.PDFDocument.openDocument(new Uint8Array(item.data),'application/pdf');
      const clouds=[];
      const count=doc.countPages();
      for(let i=0;i<count;i++){
        const page=doc.loadPage(i);
        const found=await detectPageClouds(page);
        for(const f of found) clouds.push({...f,page:i+1});
      }
      item.revisionClouds=clouds;
      item.revisionCloudCount=clouds.length;
      item.revisionCloudWarning=clouds.length?`Detectadas ${clouds.length} posibles nubes de revisión.`:'No se detectaron nubes de revisión.';
      doc.destroy();
    }catch(e){ item.revisionCloudError=e?.message||String(e); }
  }
  say('Detección de nubes completada.');
}

window.__prepareRevisionCloudOperations=prepareCloudRemoval;
window.__revisionCloudsDetectOnly=true;

inject();
