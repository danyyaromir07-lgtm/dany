const q=s=>document.querySelector(s);
const maps=new Map();
let activeIndex=-1;

function cloudCount(item){
  const direct=Array.isArray(item?.revisionClouds)?item.revisionClouds.reduce((n,p)=>n+Number(p?.clouds?.length||0),0):0;
  return Math.max(0,Number(item?.revisionCloudPreviewValidated||0),Number(item?.revisionCloudCount||0),Number(item?.revisionCloudPending?.count||0),direct);
}
function hasCloud(item){return cloudCount(item)>0}
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
function setButtonState(mode){
  const ids={original:'#previewOriginalBtn',result:'#previewResultBtn',diff:'#previewDiffBtn'};
  for(const [k,sel] of Object.entries(ids)){
    const b=q(sel);if(!b)continue;
    b.classList.toggle('primary',k===mode);
    b.classList.toggle('secondary',k!==mode);
  }
}
async function waitImage(img,timeout=15000){
  const end=Date.now()+timeout;
  while(Date.now()<end){
    if(img?.complete&&img.naturalWidth>0)return;
    await sleep(40);
  }
  throw new Error('La imagen de Preview no terminó de cargar.');
}
async function loadImage(src){
  const img=new Image();
  img.decoding='async';
  img.src=src;
  if(typeof img.decode==='function')await img.decode();else await new Promise((res,rej)=>{img.onload=res;img.onerror=()=>rej(new Error('No se pudo cargar una imagen del Preview.'))});
  return img;
}
async function makeMap(originalSrc,resultSrc){
  const [a,b]=await Promise.all([loadImage(originalSrc),loadImage(resultSrc)]);
  if(!a.naturalWidth||!b.naturalWidth)throw new Error('Preview sin dimensiones válidas.');
  const w=Math.min(a.naturalWidth,b.naturalWidth),h=Math.min(a.naturalHeight,b.naturalHeight);
  const maxPixels=6000000,scale=Math.min(1,Math.sqrt(maxPixels/Math.max(1,w*h)));
  const cw=Math.max(1,Math.round(w*scale)),ch=Math.max(1,Math.round(h*scale));
  const ca=document.createElement('canvas'),cb=document.createElement('canvas'),out=document.createElement('canvas');
  ca.width=cb.width=out.width=cw;ca.height=cb.height=out.height=ch;
  const ax=ca.getContext('2d',{willReadFrequently:true}),bx=cb.getContext('2d',{willReadFrequently:true}),ox=out.getContext('2d');
  if(!ax||!bx||!ox)throw new Error('Canvas no disponible para el mapa de diferencias.');
  ax.drawImage(a,0,0,cw,ch);bx.drawImage(b,0,0,cw,ch);
  const ad=ax.getImageData(0,0,cw,ch),bd=bx.getImageData(0,0,cw,ch),od=ox.createImageData(cw,ch);
  let changed=0;
  for(let i=0;i<ad.data.length;i+=4){
    const ar=ad.data[i],ag=ad.data[i+1],ab=ad.data[i+2],br=bd.data[i],bg=bd.data[i+1],bb=bd.data[i+2];
    const delta=Math.max(Math.abs(ar-br),Math.abs(ag-bg),Math.abs(ab-bb));
    if(delta>=24){od.data[i]=235;od.data[i+1]=32;od.data[i+2]=38;changed++;}
    else{const g=Math.round(.2126*br+.7152*bg+.0722*bb);od.data[i]=od.data[i+1]=od.data[i+2]=g;}
    od.data[i+3]=255;
  }
  ox.putImageData(od,0,0);
  const blob=await new Promise((resolve,reject)=>out.toBlob(x=>x?resolve(x):reject(new Error('No se pudo crear el mapa de diferencias.')),'image/png'));
  return{url:URL.createObjectURL(blob),changed,width:cw,height:ch};
}
async function waitPreview(idx,beforeSrc){
  const item=window.__batchAnalysis?.[idx],end=Date.now()+90000;
  while(Date.now()<end){
    const img=q('#batchPreviewImg'),title=q('#batchPreviewTitle')?.textContent||'';
    if(window.__previewFileName===item?.name&&title.includes(item?.name||'')&&title.includes('resultado')&&img?.src&&img.src!==beforeSrc){await waitImage(img);return;}
    await sleep(80);
  }
  throw new Error('El Preview no terminó dentro del tiempo esperado.');
}
async function captureStableSources(){
  const img=q('#batchPreviewImg'),ob=q('#previewOriginalBtn'),rb=q('#previewResultBtn');
  if(!img||!ob||!rb)throw new Error('No encontré los controles del Preview estable.');
  rb.click();await sleep(0);await waitImage(img);const result=img.src;
  ob.click();await sleep(0);await waitImage(img);const original=img.src;
  rb.click();await sleep(0);await waitImage(img);
  if(!original||!result||original===result)throw new Error('Original y resultado no están disponibles por separado.');
  return{original,result};
}
async function buildAndShow(idx,{ensurePreview=false}={}){
  const item=window.__batchAnalysis?.[idx];
  if(!item||item.error||!hasCloud(item))return;
  const status=q('#batchStatus');
  try{
    activeIndex=idx;
    if(ensurePreview){
      const img=q('#batchPreviewImg'),before=img?.src||'';
      const rowButton=document.querySelector(`.bpreviewResult[data-idx="${idx}"]`);
      if(!rowButton)throw new Error('No encontré el botón de previsualización estable.');
      if(status)status.textContent='Generando Preview para el mapa de diferencias…';
      rowButton.click();
      await waitPreview(idx,before);
    }
    if(status)status.textContent='Generando mapa de diferencias…';
    const sources=await captureStableSources();
    const prior=maps.get(idx);if(prior?.url)URL.revokeObjectURL(prior.url);
    const map=await makeMap(sources.original,sources.result);maps.set(idx,{...map,...sources});
    const img=q('#batchPreviewImg');if(!img)return;
    img.src=map.url;await waitImage(img);setButtonState('diff');
    const title=q('#batchPreviewTitle');if(title)title.textContent=`${item.name} · mapa de diferencias · rojo = cambio previsto`;
    q('#batchPreview')?.classList.remove('hidden');q('#batchPreview')?.scrollIntoView({behavior:'smooth',block:'center'});
    if(status)status.textContent=`Mapa de diferencias generado · ${map.changed.toLocaleString()} píxeles resaltados · solo visual.`;
  }catch(err){console.error('[cloud-difference-map]',err);if(status)status.textContent='No se pudo generar el mapa de diferencias: '+(err?.message||String(err));}
}
function bindViewerModeButtons(){
  for(const [id,mode] of [['#previewOriginalBtn','original'],['#previewResultBtn','result']]){const b=q(id);if(!b||b.dataset.diffModeBound)continue;b.dataset.diffModeBound='1';b.addEventListener('click',()=>setButtonState(mode));}
}
function addViewerButton(){
  const host=q('.preview-card-head .preview-controls');if(!host)return;
  let b=q('#previewDiffBtn');
  if(!b){b=document.createElement('button');b.id='previewDiffBtn';b.type='button';b.className='secondary small';b.textContent='🟥 Diferencias';b.style.display='none';b.onclick=()=>{if(activeIndex>=0)buildAndShow(activeIndex)};host.prepend(b);}
  bindViewerModeButtons();
}
function ensureRowButtons(){
  addViewerButton();
  document.querySelectorAll('.bpreview').forEach(base=>{
    const idx=Number(base.dataset.idx),item=window.__batchAnalysis?.[idx],parent=base.parentElement;
    if(!parent)return;
    let b=parent.querySelector(`.bpreviewDiff[data-idx="${idx}"]`);
    if(!hasCloud(item)){b?.remove();return;}
    if(!b){b=document.createElement('button');b.type='button';b.className='secondary small bpreviewDiff';b.dataset.idx=String(idx);b.textContent='🟥 Diferencias';b.style.marginLeft='6px';b.onclick=e=>{e.preventDefault();e.stopPropagation();buildAndShow(idx,{ensurePreview:true})};parent.appendChild(b)}
  });
}
function syncViewer(){
  addViewerButton();
  const batch=Array.isArray(window.__batchAnalysis)?window.__batchAnalysis:[];
  const shown=String(window.__previewFileName||'');
  const inferred=batch.findIndex(x=>x?.name===shown);if(inferred>=0)activeIndex=inferred;
  const item=batch[activeIndex],b=q('#previewDiffBtn');if(b)b.style.display=hasCloud(item)?'':'none';
}
function wire(){
  const table=q('#batchTable')||document.body;
  new MutationObserver(()=>queueMicrotask(ensureRowButtons)).observe(table,{childList:true,subtree:true});
  setInterval(()=>{ensureRowButtons();syncViewer()},400);
  ensureRowButtons();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
window.__cloudDifferencePreview={version:'1+visual-only',buildAndShow};
