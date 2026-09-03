from pathlib import Path
import re

core = Path('selector-nubes-multistream-core.html')
s = core.read_text(encoding='utf-8')

old = "let doc=null,handle=null,activeBytes=null,baseUrl=null,detailUrl=null,pageBounds=[0,0,1,1],pageW=1,pageH=1,baseRs=1,baseW=1,baseH=1,zoom=1,panX=0,panY=0,pending=false,rendering=false,detailPixelBudget=36_000_000,classicVisual=[],visualSelected=[],structSelected=[],model=null,selectionMapSafe=false,selectionFamilies=0,selectionAlternatives=[],sharpTimer=null,sharpEpoch=0,sharpQueued=false;"
new = "let doc=null,handle=null,activeBytes=null,baseUrl=null,detailUrl=null,pageBounds=[0,0,1,1],pageW=1,pageH=1,baseRs=1,baseW=1,baseH=1,zoom=1,panX=0,panY=0,pending=false,rendering=false,detailPixelBudget=36_000_000,classicVisual=[],visualSelected=[],structSelected=[],model=null,selectionMapSafe=false,selectionFamilies=0,selectionAlternatives=[],sharpTimer=null,sharpEpoch=0,sharpQueued=false,analysisReady=false;"
assert old in s
s = s.replace(old,new,1)

old = "function setButtons(){const has=!!doc;$('#select').disabled=!has;$('#delete').disabled=!has||!visualSelected.length||!!model?.incomplete;$('#save').disabled=!handle||!pending}"
new = "function setButtons(){const has=!!doc;$('#select').disabled=!has||!analysisReady;$('#delete').disabled=!has||!analysisReady||!visualSelected.length||!!model?.incomplete;$('#save').disabled=!handle||!pending}"
assert old in s
s = s.replace(old,new,1)

start = s.index('async function renderPage(){')
end = s.index('\nasync function openPdf()', start)
new_render = r'''async function renderPage(){
 clearDetail();visualSelected=[];structSelected=[];selectionMapSafe=false;selectionFamilies=0;selectionAlternatives=[];classicVisual=[];model=null;analysisReady=false;setButtons();
 const p=doc.loadPage(0);pageBounds=p.getBounds();pageW=pageBounds[2]-pageBounds[0];pageH=pageBounds[3]-pageBounds[1];
 status.textContent='Abriendo vista previa…';
 const dpr=Math.min(2,window.devicePixelRatio||1),maxDim=2600,maxPixels=5_000_000,base=Math.min(1.55*dpr,maxDim/Math.max(pageW,pageH),Math.sqrt(maxPixels/Math.max(1,pageW*pageH)));baseRs=Math.max(.45,base);
 const pm=p.toPixmap(mupdf.Matrix.scale(baseRs,baseRs),mupdf.ColorSpace.DeviceRGB,false,true),png=pm.asPNG();baseW=pm.getWidth?.()||Math.round(pageW*baseRs);baseH=pm.getHeight?.()||Math.round(pageH*baseRs);try{pm.destroy?.()}catch(_){}
 if(baseUrl)URL.revokeObjectURL(baseUrl);baseUrl=URL.createObjectURL(new Blob([png],{type:'image/png'}));img.src=baseUrl;await img.decode();img.style.width=baseW+'px';img.style.height=baseH+'px';stage.style.width=baseW+'px';stage.style.height=baseH+'px';sizeOverlay();$('#mode').textContent='Modo normal · clásico';requestAnimationFrame(()=>fit());
 status.textContent='Vista previa lista · preparando selección de arcos…';
 await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
 try{
  classicVisual=collectVisual(p);for(let i=0;i<classicVisual.length;i++)classicVisual[i]._ordinal=i;analysisReady=true;setButtons();
  status.textContent='Selector listo · visual='+classicVisual.length+' · modelo estructural se calculará solo al eliminar. Haz clic sobre un arco.';
 }finally{try{p.destroy?.()}catch(_){}}
 scheduleSharp(650)
}'''
s = s[:start] + new_render + s[end:]

old_prefix = "async function removeGroup(){if(!doc||!model||!activeBytes||!visualSelected.length)return;if(model.incomplete){status.textContent='Borrado bloqueado: el recorrido de streams internos quedó incompleto.';return}"
new_prefix = "async function removeGroup(){if(!doc||!activeBytes||!visualSelected.length)return;if(!model){status.textContent='Preparando borrado exacto · construyendo modelo estructural solo ahora…';await new Promise(r=>requestAnimationFrame(()=>setTimeout(r,0)));let mp=null;try{mp=doc.loadPage(0);model=deepModel(mp)}finally{try{mp?.destroy?.()}catch(_){}}if(!model||model.incomplete){setButtons();status.textContent='Borrado bloqueado: el recorrido de streams internos quedó incompleto.';return}}if(model.incomplete){status.textContent='Borrado bloqueado: el recorrido de streams internos quedó incompleto.';return}"
assert old_prefix in s
s = s.replace(old_prefix,new_prefix,1)
core.write_text(s,encoding='utf-8')

wrap=Path('selector-fast.html')
w=wrap.read_text(encoding='utf-8')
old_hyd="async function hydrateMetadata(){let mupdf=null;try{mupdf=await mupdfMetaPromise}catch(_){return}for(let i=0;i<entries.length;i++){const e=entries[i];try{const f=await e.handle.getFile();e.size=f.size;const bytes=new Uint8Array(await f.arrayBuffer()),d=mupdf.PDFDocument.openDocument(bytes,'application/pdf');e.pages=Number(d.countPages?.()||0);d.destroy?.()}catch(_){e.pages=e.pages??null}renderList()}}"
new_hyd="async function hydrateMetadata(){for(let i=0;i<entries.length;i++){const e=entries[i];try{const f=await e.handle.getFile();e.size=f.size}catch(_){}if((i%8)===7)await new Promise(r=>setTimeout(r,0));renderList()}}\nasync function hydrateActivePageCount(i){if(i<0||!entries[i]||entries[i].pages!=null)return;const run=async()=>{if(i!==activeIndex||!entries[i]||entries[i].pages!=null)return;let mupdf=null,d=null;try{mupdf=await mupdfMetaPromise;const f=await entries[i].handle.getFile(),bytes=new Uint8Array(await f.arrayBuffer());d=mupdf.PDFDocument.openDocument(bytes,'application/pdf');entries[i].pages=Number(d.countPages?.()||0)}catch(_){}finally{try{d?.destroy?.()}catch(_){}renderList()}};if('requestIdleCallback'in window)requestIdleCallback(run,{timeout:2500});else setTimeout(run,1200)}"
assert old_hyd in w
w=w.replace(old_hyd,new_hyd,1)
needle="if(entries[i].state==='Cargando…')entries[i].state=hasUnsaved()?'Modificado':'Activo';renderList()},900)}"
repl="if(entries[i].state==='Cargando…')entries[i].state=hasUnsaved()?'Modificado':'Activo';renderList();hydrateActivePageCount(i)},900)}"
assert needle in w
w=w.replace(needle,repl,1)
wrap.write_text(w,encoding='utf-8')
