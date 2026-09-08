from pathlib import Path

core = Path('lab-selector-v4/selector-nubes-multistream-core.html')
wrap = Path('lab-selector-v4/index.html')
s = core.read_text()
h = wrap.read_text()

needle = "firstMismatchDiagnostic='esperados azul='+selectedVisual+' · desaparecieron='+removed+' · azules realmente desaparecidos='+blueRemoved+' · no azules desaparecidos='+unselectedRemoved+' · azules que siguen presentes='+blueStill+' · firmas nuevas='+added+' · tipos desaparecidos='+removedKinds+' · tipos nuevos='+addedKinds+' · visual antes/después='+beforeVisual+'/'+previewVisual.length"
replacement = "const selSet43=new Set(selectedOrdinals),expected43=[],expectedOrd43=[];for(let oi43=0;oi43<classicVisual.length;oi43++)if(!selSet43.has(oi43)){expected43.push(classicVisual[oi43]);expectedOrd43.push(oi43)}let mm43=-1,lim43=Math.min(expected43.length,previewVisual.length);for(let mi43=0;mi43<lim43;mi43++)if(sig(expected43[mi43])!==sig(previewVisual[mi43])){mm43=mi43;break}if(mm43<0&&expected43.length!==previewVisual.length)mm43=lim43;const expOrd43=mm43>=0&&mm43<expectedOrd43.length?expectedOrd43[mm43]:-1,expSig43=mm43>=0&&mm43<expected43.length?sig(expected43[mm43]):'fin',gotSig43=mm43>=0&&mm43<previewVisual.length?sig(previewVisual[mm43]):'fin',smin43=selectedIdx.length?Math.min(...selectedIdx):-1,smax43=selectedIdx.length?Math.max(...selectedIdx):-1,src43=new Set(targets.map(t=>t?.sourceKey).filter(Boolean)).size;firstMismatchDiagnostic='esperados azul='+selectedVisual+' · desaparecieron='+removed+' · azules realmente desaparecidos='+blueRemoved+' · no azules desaparecidos='+unselectedRemoved+' · azules que siguen presentes='+blueStill+' · firmas nuevas='+added+' · tipos desaparecidos='+removedKinds+' · tipos nuevos='+addedKinds+' · visual antes/después='+beforeVisual+'/'+previewVisual.length+' · ORD mismatch='+mm43+' original='+expOrd43+' · exp='+expSig43+' · got='+gotSig43+' · structRoute='+selectedIdx.length+' ['+smin43+'..'+smax43+'] · fuentes='+src43"

if needle not in s:
    raise SystemExit('needle not found')
s = s.replace(needle, replacement, 1)

if 'flatmem20' in h:
    h = h.replace('flatmem20', 'flatmem43', 1)
else:
    h = h.replace('selector-nubes-multistream-core.html?v=', 'selector-nubes-multistream-core.html?v=20260908-flatmem43-', 1)

core.write_text(s)
wrap.write_text(h)
