from pathlib import Path
p=Path('selector-nubes-multistream-core.html')
s=p.read_text()
old=""" const saveModes=['incremental',''];
 // Vía rápida segura: probar primero las correspondencias ya calculadas. attempt() conserva el verificador exacto completo.
 for(let i=0;i<routes.length;i++){
  const saveMode='incremental';
  status.textContent='Verificación rápida exacta · correspondencia '+(i+1)+'/'+routes.length+' · '+selectedVisual+' trazos azules…';
  try{const ok=await attempt(routes[i],i+1,saveMode);if(ok){activeBytes=ok.out;doc.destroy();doc=mupdf.PDFDocument.openDocument(activeBytes,'application/pdf');pending=true;await renderPage();status.textContent='Selección eliminada y verificada: '+selectedVisual+' trazos azules · vía rápida exacta · correspondencia '+ok.number+'/'+routes.length+' · guardado '+ok.saveMode+' · '+ok.touched+' stream(s). Puedes continuar o guardar.';return}}catch(e){errors.push('vía rápida correspondencia '+(i+1)+' · guardado incremental · '+e.message);await uiYield()}
 }
 let instancePlan=null,hybridPlan=null;"""
new=""" const saveModes=['incremental',''];
 // Protección anti-crash: en páginas visualmente gigantes no agotamos el heap WASM con docenas de copias/pruebas.
 // En páginas normales routeTrialLimit===routes.length y el flujo queda idéntico.
 const hugePageCrashGuard=beforeVisual>=250000;
 const hugeRouteLimit=hugePageCrashGuard?(beforeVisual>=400000?6:10):routes.length;
 const routeTrialLimit=Math.min(routes.length,hugeRouteLimit);
 // Vía rápida segura: probar primero las correspondencias ya calculadas. attempt() conserva el verificador exacto completo.
 for(let i=0;i<routeTrialLimit;i++){
  const saveMode='incremental';
  status.textContent='Verificación rápida exacta · correspondencia '+(i+1)+'/'+routeTrialLimit+(hugePageCrashGuard?' · protección de memoria':'')+' · '+selectedVisual+' trazos azules…';
  try{const ok=await attempt(routes[i],i+1,saveMode);if(ok){activeBytes=ok.out;doc.destroy();doc=mupdf.PDFDocument.openDocument(activeBytes,'application/pdf');pending=true;await renderPage();status.textContent='Selección eliminada y verificada: '+selectedVisual+' trazos azules · vía rápida exacta · correspondencia '+ok.number+'/'+routeTrialLimit+' · guardado '+ok.saveMode+' · '+ok.touched+' stream(s). Puedes continuar o guardar.';return}}catch(e){errors.push('vía rápida correspondencia '+(i+1)+' · guardado incremental · '+e.message);await uiYield()}
 }
 if(hugePageCrashGuard){
  status.textContent='Borrado cancelado sin modificar el PDF activo: protección de memoria activada para página gigante ('+beforeVisual+' trazos visuales). Se probaron '+routeTrialLimit+' correspondencia(s) exactas y ninguna pasó. Para evitar un crash de MuPDF/WASM no se ejecutaron la búsqueda causal ni la segunda estrategia de guardado. '+errors.join(' | ')+(firstMismatchDiagnostic?' · DIAGNÓSTICO: '+firstMismatchDiagnostic:'');
  return
 }
 let instancePlan=null,hybridPlan=null;"""
if old not in s:
    raise SystemExit('anchor not found')
s=s.replace(old,new,1)
p.write_text(s)
print('patched', len(s))
