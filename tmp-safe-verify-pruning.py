from pathlib import Path
p=Path('selector-nubes-multistream-core.html')
s=p.read_text()
old="work=mupdf.PDFDocument.openDocument(outBase,'application/pdf');wp=work.loadPage(0);const baselineVisual=collectVisual(wp),wm=deepModel(wp);if(baselineVisual.length!==beforeVisual)throw new Error('la copia directa no reproduce el mismo número de trazos visuales ('+beforeVisual+' → '+baselineVisual.length+')');const baselineSigs=baselineVisual.map(sig),activeSigs=classicVisual.map(sig);for(let bi=0;bi<beforeVisual;bi++)if(baselineSigs[bi]!==activeSigs[bi])throw new Error('la copia directa cambió el orden/firma visual en el trazo '+bi);const selectedSet="
new="work=mupdf.PDFDocument.openDocument(outBase,'application/pdf');wp=work.loadPage(0);const baselineVisual=collectVisual(wp);if(baselineVisual.length!==beforeVisual)throw new Error('la copia directa no reproduce el mismo número de trazos visuales ('+beforeVisual+' → '+baselineVisual.length+')');const baselineSigs=baselineVisual.map(sig),activeSigs=classicVisual.map(sig);for(let bi=0;bi<beforeVisual;bi++)if(baselineSigs[bi]!==activeSigs[bi])throw new Error('la copia directa cambió el orden/firma visual en el trazo '+bi);const wm=deepModel(wp);const selectedSet="
assert old in s, 'baseline attempt block not found'
s=s.replace(old,new,1)
old2="wp.destroy?.();wp=work.loadPage(0);const previewVisual=collectVisual(wp),previewModel=deepModel(wp);if(!previewModel||previewModel.incomplete||previewModel.strokes.length!==beforeStruct-selectedIdx.length)throw new Error('antes de guardar, el modelo estructural no equivale a original menos operadores seleccionados');if(!localBagOK(previewVisual)){"
new2="wp.destroy?.();wp=work.loadPage(0);const previewVisual=collectVisual(wp);if(!localBagOK(previewVisual)){"
assert old2 in s, 'preview order block not found'
s=s.replace(old2,new2,1)
needle="throw new Error('antes de guardar, la geometría editada no coincide exactamente con la copia base menos azul')}const previewRaster=await rasterDigest(wp);"
repl="throw new Error('antes de guardar, la geometría editada no coincide exactamente con la copia base menos azul')}const previewModel=deepModel(wp);if(!previewModel||previewModel.incomplete||previewModel.strokes.length!==beforeStruct-selectedIdx.length)throw new Error('antes de guardar, el modelo estructural no equivale a original menos operadores seleccionados');const previewRaster=await rasterDigest(wp);"
assert needle in s, 'preview model insertion point not found'
s=s.replace(needle,repl,1)
needle3="const outBase=new Uint8Array(activeBytes),errors=[];let firstMismatchDiagnostic='',causalDiagnostic='';"
insert3="""const routeImpossibleKeys=new Set();
function activeRouteImpossible(idx){
 const targets=idx.map(i=>model.strokes[i]);
 if(targets.some(x=>!x||x.editable===false))return true;
 const selectedBySource=new Map(),allBySource=new Map();
 for(const t of targets)(selectedBySource.get(t.sourceKey)||selectedBySource.set(t.sourceKey,[]).get(t.sourceKey)).push(t);
 for(const q of model.strokes)(allBySource.get(q.sourceKey)||allBySource.set(q.sourceKey,[]).get(q.sourceKey)).push(q);
 for(const[k,a]of selectedBySource){const all=allBySource.get(k)||[];if(a.length!==all.length)return true}
 return false
}
for(const r of routes)if(activeRouteImpossible(r))routeImpossibleKeys.add(r.join(','));
const outBase=new Uint8Array(activeBytes),errors=[];let firstMismatchDiagnostic='',causalDiagnostic='';"""
assert needle3 in s, 'outBase insertion point not found'
s=s.replace(needle3,insert3,1)
old4="for(let i=0;i<routes.length;i++){\n  const saveMode='incremental';"
new4="for(let i=0;i<routes.length;i++){\n  if(routeImpossibleKeys.has(routes[i].join(','))){errors.push('vía rápida correspondencia '+(i+1)+' · descartada estructuralmente: XObject compartido/no editable');continue}\n  const saveMode='incremental';"
assert old4 in s, 'fast route loop not found'
s=s.replace(old4,new4,1)
old5="for(let i=0;i<routes.length;i++)for(let sm=0;sm<saveModes.length;sm++){const saveMode=saveModes[sm],label=saveMode||'reescritura mínima';if(sm===0&&errors.some(x=>x.startsWith('vía rápida correspondencia '+(i+1)+' · guardado incremental')))continue;"
new5="for(let i=0;i<routes.length;i++)for(let sm=0;sm<saveModes.length;sm++){const saveMode=saveModes[sm],label=saveMode||'reescritura mínima';if(routeImpossibleKeys.has(routes[i].join(',')))continue;if(sm===0&&errors.some(x=>x.startsWith('vía rápida correspondencia '+(i+1)+' · guardado incremental')))continue;"
assert old5 in s, 'final route loop not found'
s=s.replace(old5,new5,1)
# Safety assertions: exact verifier and multi-stream machinery untouched/present.
for token in ["const bagOK=", "strokeEditRanges", "Búsqueda causal dirigida", "const previewRaster=await rasterDigest(wp)", "afterRaster!==previewRaster", "localBagOK(previewVisual)"]:
    assert token in s, token
p.write_text(s)
print('patched safe verification pruning')
