from pathlib import Path
p=Path('selector-nubes-multistream-core.html')
s=p.read_text()
old=""" let instancePlan=null,hybridPlan=null;try{status.textContent='Preparando borrado exacto de lo azul…';const causal=await buildCausalRoute();if(Array.isArray(causal)){const ck=causal.join(',');if(!keys.has(ck)){keys.add(ck);routes.unshift(causal)}causalDiagnostic=(causalDiagnostic?causalDiagnostic+' · ':'')+'RUTA CAUSAL COMPLETA'}else if(causal?.kind==='instance'){instancePlan=causal;causalDiagnostic=(causalDiagnostic?causalDiagnostic+' · ':'')+'INSTANCIA AISLADA LISTA'}else if(causal?.kind==='hybrid'){hybridPlan=causal;causalDiagnostic=(causalDiagnostic?causalDiagnostic+' · ':'')+'RUTA HÍBRIDA OPERADORES+FUENTE EXTERNA LISTA'}}catch(e){causalDiagnostic=(causalDiagnostic?causalDiagnostic+' · ':'')+'causal no completa: '+e.message}const saveModes=['incremental',''];if(hybridPlan)"""
new=""" const saveModes=['incremental',''];
 // Vía rápida segura: probar primero las correspondencias ya calculadas. attempt() conserva el verificador exacto completo.
 for(let i=0;i<routes.length;i++){
  const saveMode='incremental';
  status.textContent='Verificación rápida exacta · correspondencia '+(i+1)+'/'+routes.length+' · '+selectedVisual+' trazos azules…';
  try{const ok=await attempt(routes[i],i+1,saveMode);if(ok){activeBytes=ok.out;doc.destroy();doc=mupdf.PDFDocument.openDocument(activeBytes,'application/pdf');pending=true;await renderPage();status.textContent='Selección eliminada y verificada: '+selectedVisual+' trazos azules · vía rápida exacta · correspondencia '+ok.number+'/'+routes.length+' · guardado '+ok.saveMode+' · '+ok.touched+' stream(s). Puedes continuar o guardar.';return}}catch(e){errors.push('vía rápida correspondencia '+(i+1)+' · guardado incremental · '+e.message)}
 }
 let instancePlan=null,hybridPlan=null;try{status.textContent='La vía rápida no coincidió exactamente · iniciando resolución causal de respaldo…';await uiYield();const causal=await buildCausalRoute();if(Array.isArray(causal)){const ck=causal.join(',');if(!keys.has(ck)){keys.add(ck);routes.unshift(causal)}causalDiagnostic=(causalDiagnostic?causalDiagnostic+' · ':'')+'RUTA CAUSAL COMPLETA'}else if(causal?.kind==='instance'){instancePlan=causal;causalDiagnostic=(causalDiagnostic?causalDiagnostic+' · ':'')+'INSTANCIA AISLADA LISTA'}else if(causal?.kind==='hybrid'){hybridPlan=causal;causalDiagnostic=(causalDiagnostic?causalDiagnostic+' · ':'')+'RUTA HÍBRIDA OPERADORES+FUENTE EXTERNA LISTA'}}catch(e){causalDiagnostic=(causalDiagnostic?causalDiagnostic+' · ':'')+'causal no completa: '+e.message}if(hybridPlan)"""
if old not in s: raise SystemExit('target block not found')
s=s.replace(old,new,1)
# Evita repetir incremental de las rutas que ya fallaron antes de entrar al causal.
old2="""for(let i=0;i<routes.length;i++)for(let sm=0;sm<saveModes.length;sm++){const saveMode=saveModes[sm],label=saveMode||'reescritura mínima';status.textContent='Verificando eliminación exacta · correspondencia '+(i+1)+'/'+routes.length+' · guardado '+label+' · '+selectedVisual+' trazos azules…';"""
new2="""for(let i=0;i<routes.length;i++)for(let sm=0;sm<saveModes.length;sm++){const saveMode=saveModes[sm],label=saveMode||'reescritura mínima';if(sm===0&&errors.some(x=>x.startsWith('vía rápida correspondencia '+(i+1)+' · guardado incremental')))continue;status.textContent='Verificando eliminación exacta · correspondencia '+(i+1)+'/'+routes.length+' · guardado '+label+' · '+selectedVisual+' trazos azules…';"""
if old2 not in s: raise SystemExit('fallback loop not found')
s=s.replace(old2,new2,1)
p.write_text(s)
print('delete order optimized')
