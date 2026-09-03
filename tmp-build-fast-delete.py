from pathlib import Path

src=Path('selector-nubes-multistream-core.html').read_text()
src=src.replace('<title>Selector de nubes · paths multi-stream exactos</title>','<title>Selector de nubes · borrado exacto rápido</title>',1)

needle=""" let instancePlan=null,hybridPlan=null;try{status.textContent='Preparando borrado exacto de lo azul…';const causal=await buildCausalRoute();if(Array.isArray(causal)){const ck=causal.join(',');if(!keys.has(ck)){keys.add(ck);routes.unshift(causal)}causalDiagnostic=(causalDiagnostic?causalDiagnostic+' · ':'')+'RUTA CAUSAL COMPLETA'}else if(causal?.kind==='instance'){instancePlan=causal;causalDiagnostic=(causalDiagnostic?causalDiagnostic+' · ':'')+'INSTANCIA AISLADA LISTA'}else if(causal?.kind==='hybrid'){hybridPlan=causal;causalDiagnostic=(causalDiagnostic?causalDiagnostic+' · ':'')+'RUTA HÍBRIDA OPERADORES+FUENTE EXTERNA LISTA'}}catch(e){causalDiagnostic=(causalDiagnostic?causalDiagnostic+' · ':'')+'causal no completa: '+e.message}const saveModes=['incremental',''];if(hybridPlan)"""
replacement=""" const saveModes=['incremental',''];
 const fastErrors=[];const fastRoutes=[];const fastSeen=new Set();
 const addFast=r=>{if(!r||r.length!==selectedVisual)return;const idx=r.map(x=>typeof x==='number'?x:model.strokes.indexOf(x));if(idx.some(i=>i<0)||new Set(idx).size!==idx.length)return;const k=idx.join(',');if(fastSeen.has(k))return;fastSeen.add(k);fastRoutes.push(idx)};
 // Ruta ultrarrápida: cuando el render visual y el modelo estructural tienen la misma cardinalidad,
 // sus órdenes son el orden de ejecución PDF. No se confía ciegamente en ella: attempt() mantiene
 // la comparación exacta original-azul y el digest raster posterior.
 if(beforeVisual===beforeStruct&&selectedOrdinals.every(i=>i>=0&&i<beforeStruct))addFast(selectedOrdinals.slice());
 for(const r of routes)addFast(r);
 if(fastRoutes.length){status.textContent='Verificación rápida exacta · '+selectedVisual+' trazos azules…';await uiYield();for(let i=0;i<fastRoutes.length;i++){for(let sm=0;sm<saveModes.length;sm++){const saveMode=saveModes[sm],label=saveMode||'reescritura mínima';try{const ok=await attempt(fastRoutes[i],i+1,saveMode);if(ok){activeBytes=ok.out;doc.destroy();doc=mupdf.PDFDocument.openDocument(activeBytes,'application/pdf');pending=true;await renderPage();status.textContent='Selección eliminada y verificada: '+selectedVisual+' trazos azules · vía rápida exacta · guardado '+ok.saveMode+' · '+ok.touched+' stream(s). Puedes continuar o guardar.';return}}catch(e){fastErrors.push('rápida '+(i+1)+' · '+label+' · '+e.message)}await uiYield()}}}
 let instancePlan=null,hybridPlan=null;try{status.textContent='La vía rápida no coincidió exactamente. Iniciando resolución causal exhaustiva…';await uiYield();const causal=await buildCausalRoute();if(Array.isArray(causal)){const ck=causal.join(',');if(!keys.has(ck)){keys.add(ck);routes.unshift(causal)}causalDiagnostic=(causalDiagnostic?causalDiagnostic+' · ':'')+'RUTA CAUSAL COMPLETA'}else if(causal?.kind==='instance'){instancePlan=causal;causalDiagnostic=(causalDiagnostic?causalDiagnostic+' · ':'')+'INSTANCIA AISLADA LISTA'}else if(causal?.kind==='hybrid'){hybridPlan=causal;causalDiagnostic=(causalDiagnostic?causalDiagnostic+' · ':'')+'RUTA HÍBRIDA OPERADORES+FUENTE EXTERNA LISTA'}}catch(e){causalDiagnostic=(causalDiagnostic?causalDiagnostic+' · ':'')+'causal no completa: '+e.message}if(hybridPlan)"""
if needle not in src: raise SystemExit('fast-path insertion needle not found')
src=src.replace(needle,replacement,1)

needle2=""" status.textContent='Borrado cancelado sin modificar el PDF activo: se probaron '+routes.length+' correspondencia(s) con '+saveModes.length+' estrategias de guardado y ninguna pasó la verificación exacta · '+errors.join(' | ')+(causalDiagnostic?' · CAUSAL: '+causalDiagnostic:'')+(firstMismatchDiagnostic?' · DIAGNÓSTICO: '+firstMismatchDiagnostic:'')"""
replacement2=""" status.textContent='Borrado cancelado sin modificar el PDF activo: la vía rápida exacta no pasó y después se probaron '+routes.length+' correspondencia(s) causales con '+saveModes.length+' estrategias de guardado · '+[...fastErrors,...errors].join(' | ')+(causalDiagnostic?' · CAUSAL: '+causalDiagnostic:'')+(firstMismatchDiagnostic?' · DIAGNÓSTICO: '+firstMismatchDiagnostic:'')"""
if needle2 not in src: raise SystemExit('final diagnostic needle not found')
src=src.replace(needle2,replacement2,1)

Path('selector-nubes-rapido-exacto-core.html').write_text(src)
wrap=Path('selector-nubes-multistream.html').read_text()
wrap=wrap.replace('Selector de nubes · paths multi-stream exactos','Selector de nubes · borrado exacto rápido',1)
wrap=wrap.replace('./selector-nubes-multistream-core.html?v=20260903-multistream1','./selector-nubes-rapido-exacto-core.html?v=20260903-fastverify1',1)
Path('selector-nubes-rapido-exacto.html').write_text(wrap)
