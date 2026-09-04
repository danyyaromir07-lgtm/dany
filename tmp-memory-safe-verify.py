from pathlib import Path
p=Path('selector-nubes-multistream-core.html')
s=p.read_text()
old="wp.destroy?.();wp=work.loadPage(0);const previewVisual=collectVisual(wp),previewModel=deepModel(wp);if(!previewModel||previewModel.incomplete||previewModel.strokes.length!==beforeStruct-selectedIdx.length)throw new Error('antes de guardar, el modelo estructural no equivale a original menos operadores seleccionados');if(!localBagOK(previewVisual)){"
new="wp.destroy?.();wp=work.loadPage(0);const previewVisual=collectVisual(wp);if(!localBagOK(previewVisual)){"
assert old in s, 'preview verification block not found'
s=s.replace(old,new,1)
needle="throw new Error('antes de guardar, la geometría editada no coincide exactamente con la copia base menos azul')}const previewRaster=await rasterDigest(wp);"
repl="throw new Error('antes de guardar, la geometría editada no coincide exactamente con la copia base menos azul')}const previewModel=deepModel(wp);if(!previewModel||previewModel.incomplete||previewModel.strokes.length!==beforeStruct-selectedIdx.length)throw new Error('antes de guardar, el modelo estructural no equivale a original menos operadores seleccionados');const previewRaster=await rasterDigest(wp);"
assert needle in s, 'preview model insertion point not found'
s=s.replace(needle,repl,1)
# Exact acceptance checks remain mandatory; only order of two rejecting checks changed.
for token in ["const bagOK=", "strokeEditRanges", "Búsqueda causal dirigida", "localBagOK(previewVisual)", "const previewModel=deepModel(wp)", "const previewRaster=await rasterDigest(wp)", "afterRaster!==previewRaster"]:
    assert token in s, token
assert 'routeImpossibleKeys' not in s
p.write_text(s)
print('patched memory-safe exact verification order')
