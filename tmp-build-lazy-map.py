from pathlib import Path
import re
src=Path('selector-nubes-adaptativo-core.html').read_text()
old="function setButtons(){const has=!!doc;$('#select').disabled=!has;$('#delete').disabled=!has||!selectionMapSafe||!visualSelected.length||structSelected.length!==visualSelected.length;$('#save').disabled=!handle||!pending}"
new="function setButtons(){const has=!!doc;$('#select').disabled=!has;$('#delete').disabled=!has||!visualSelected.length||!!model?.incomplete;$('#save').disabled=!handle||!pending}"
if old not in src: raise SystemExit('setButtons pattern not found')
src=src.replace(old,new,1)
old_choose="const map=mapBlue(visualSelected,[]);structSelected=map.items;selectionAlternatives=map.alternatives||[];selectionMapSafe=!model?.incomplete&&structSelected.length===visualSelected.length&&visualSelected.length>0&&selectionAlternatives.length>0;drawSelection();setButtons();const vg=components(visualSelected);status.textContent='Selección acumulada · familias='+selectionFamilies+' · resaltados='+visualSelected.length+' · grupos≈'+vg+' · mapeo='+map.mode+' · operadores='+structSelected.length+' · forms='+(model?.forms||0)+(selectionMapSafe?' · LISTO PARA ELIMINAR':' · borrado bloqueado: no existe una ruta monotónica segura para toda la unión azul')+' · Ctrl/Shift+clic añade otro tipo'"
new_choose="structSelected=[];selectionAlternatives=[];selectionMapSafe=false;drawSelection();setButtons();const vg=components(visualSelected);status.textContent='Selección acumulada · familias='+selectionFamilies+' · resaltados='+visualSelected.length+' · grupos≈'+vg+' · azul listo · correspondencia estructural se calculará al pulsar Eliminar · Ctrl/Shift+clic añade otro tipo'"
if old_choose not in src: raise SystemExit('chooseClassic mapping block not found')
src=src.replace(old_choose,new_choose,1)
old_remove="async function removeGroup(){if(!doc||!model||!activeBytes||!selectionMapSafe||!visualSelected.length)return;if(model.incomplete){status.textContent='Borrado bloqueado: el recorrido de streams internos quedó incompleto.';return}const beforeVisual="
new_remove="async function removeGroup(){if(!doc||!model||!activeBytes||!visualSelected.length)return;if(model.incomplete){status.textContent='Borrado bloqueado: el recorrido de streams internos quedó incompleto.';return}if(!selectionMapSafe||structSelected.length!==visualSelected.length||!selectionAlternatives.length){status.textContent='Preparando borrado exacto · calculando correspondencia estructural para '+visualSelected.length+' trazos azules…';await new Promise(r=>requestAnimationFrame(()=>setTimeout(r,0)));const lazyMap=mapBlue(visualSelected,[]);structSelected=lazyMap.items;selectionAlternatives=lazyMap.alternatives||[];selectionMapSafe=!model?.incomplete&&structSelected.length===visualSelected.length&&visualSelected.length>0&&selectionAlternatives.length>0;if(!selectionMapSafe){setButtons();status.textContent='Borrado bloqueado: no existe una correspondencia estructural completa para toda la selección azul · mapeo='+lazyMap.mode+' · resaltados='+visualSelected.length+'. La selección azul se conserva.';return}}const beforeVisual="
if old_remove not in src: raise SystemExit('removeGroup header not found')
src=src.replace(old_remove,new_remove,1)
src=src.replace('selector-nubes-adaptativo-core.html?v=20260903-adaptive1','selector-nubes-rapido-core.html?v=20260903-lazymap1')
Path('selector-nubes-rapido-core.html').write_text(src)
wrap=Path('selector-nubes-adaptativo.html').read_text().replace('Selector de nubes · borrado exacto azul adaptativo','Selector de nubes · selección rápida y borrado exacto').replace('./selector-nubes-adaptativo-core.html?v=20260903-adaptive1','./selector-nubes-rapido-core.html?v=20260903-lazymap1')
Path('selector-nubes-rapido.html').write_text(wrap)
m=re.search(r'<script type="module">(.*?)</script>',src,re.S)
if not m: raise SystemExit('module script not found')
Path('/tmp/selector-nubes-rapido.mjs').write_text(m.group(1))
