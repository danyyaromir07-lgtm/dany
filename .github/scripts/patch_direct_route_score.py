from pathlib import Path

p = Path('selector-nubes-multistream-core.html')
s = p.read_text(encoding='utf-8')
old = "try{status.textContent='Transacción directa exacta · resolviendo '+selectedVisual+' trazos azules en una sola edición…';await uiYield();const directPlan=await makeDirectEditPlan(structSelected,model.strokes),ok=await attemptSingleTransaction(directPlan,'incremental');activeBytes=ok.out;doc.destroy();doc=mupdf.PDFDocument.openDocument(activeBytes,'application/pdf');pending=true;await renderPage();status.textContent='Selección eliminada y verificada: '+selectedVisual+' trazos azules · transacción directa 1:1 · '+ok.touched+' stream(s) · una sola verificación final. Puedes continuar o guardar.';return}catch(e){errors.push('transacción directa · '+e.message);if(giantSingleTransaction){status.textContent='Borrado cancelado sin modificar el PDF activo: la transacción directa única no pudo demostrar original − azul en esta página gigante ('+beforeVisual+' trazos). Para proteger la memoria no se ejecutaron rutas alternativas ni causal · '+e.message;setButtons();return}}"
new = "try{status.textContent='Transacción directa exacta · eligiendo en memoria la correspondencia geométrica más fiel para '+selectedVisual+' trazos azules…';await uiYield();const directCandidates=[],directSeen=new Set();for(const r of [structSelected,...selectionAlternatives]){if(!r||r.length!==selectedVisual)continue;const k=routeKey(r);if(!k||directSeen.has(k))continue;directSeen.add(k);let sum=0,max=0,bad=false;for(let i=0;i<r.length;i++){const c=alignCost(visualSelected[i],r[i]);if(!Number.isFinite(c)){bad=true;break}sum+=c;if(c>max)max=c}if(!bad)directCandidates.push({route:r,score:sum/Math.max(1,r.length)+max*.35,mean:sum/Math.max(1,r.length),max})}directCandidates.sort((a,b)=>a.score-b.score||a.max-b.max||a.mean-b.mean);if(!directCandidates.length)throw new Error('no existe una correspondencia directa geométricamente puntuable');const directChoice=directCandidates[0],directPlan=await makeDirectEditPlan(directChoice.route,model.strokes),ok=await attemptSingleTransaction(directPlan,'incremental');activeBytes=ok.out;doc.destroy();doc=mupdf.PDFDocument.openDocument(activeBytes,'application/pdf');pending=true;await renderPage();status.textContent='Selección eliminada y verificada: '+selectedVisual+' trazos azules · transacción directa 1:1 · ruta geométrica '+(directCandidates.indexOf(directChoice)+1)+'/'+directCandidates.length+' · coste medio='+directChoice.mean.toFixed(4)+' · '+ok.touched+' stream(s) · una sola verificación final. Puedes continuar o guardar.';return}catch(e){errors.push('transacción directa · '+e.message);if(giantSingleTransaction){status.textContent='Borrado cancelado sin modificar el PDF activo: la transacción directa única no pudo demostrar original − azul en esta página gigante ('+beforeVisual+' trazos). Para proteger la memoria no se ejecutaron renders alternativos ni causal · '+e.message;setButtons();return}}"
count = s.count(old)
if count != 1:
    raise SystemExit(f'Expected exactly one direct-transaction block, found {count}')
s = s.replace(old, new)
p.write_text(s, encoding='utf-8')

# Focused invariants: the exact verifier and single-render policy remain present.
checks = [
    "if(!bagOK(previewVisual))throw new Error('la geometría directa no coincide exactamente con la copia base menos azul')",
    "const previewRaster=await rasterDigest(wp)",
    "if(await rasterDigest(cp)!==previewRaster)",
    "directCandidates.sort((a,b)=>a.score-b.score",
    "makeDirectEditPlan(directChoice.route,model.strokes)",
]
for c in checks:
    if c not in s:
        raise SystemExit('Missing invariant after patch: '+c)
print('patched direct route scoring; candidates stay in-memory, one transaction remains')
