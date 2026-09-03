from pathlib import Path
import re
src=Path('selector-nubes-fluido-core.html').read_text()
repls=[
("tested++;if(label&&tested%12===0)status.textContent=label+' · '+tested+' pruebas causales · coincidencias 1:1='+oneToOne+'…';return result", "tested++;if(label&&tested%12===0){status.textContent=label+' · '+tested+' pruebas causales · coincidencias 1:1='+oneToOne+'…';await uiYield()}return result"),
("if(rootTests%25===0)status.textContent='Borrado exacto · buscando el último azul en streams de página '+rootTests+'/'+rootRanked.length+'…'", "if(rootTests%25===0){status.textContent='Borrado exacto · buscando el último azul en streams de página '+rootTests+'/'+rootRanked.length+'…';await uiYield()}"),
("if(offTests%20===0)status.textContent='Aislando azul · localizando la única pareja incorrecta…'", "if(offTests%20===0){status.textContent='Aislando azul · localizando la única pareja incorrecta…';await uiYield()}"),
("if(tests%10===0)status.textContent='Aislando azul · probando instancia correcta '+tests+'/'+max+'…'", "if(tests%10===0){status.textContent='Aislando azul · probando instancia correcta '+tests+'/'+max+'…';await uiYield()}"),
]
for old,new in repls:
    if old not in src: raise SystemExit('pattern not found: '+old[:80])
    src=src.replace(old,new,1)
Path('selector-nubes-fluido-v2-core.html').write_text(src)
wrap=Path('selector-nubes-fluido.html').read_text().replace('selector-nubes-fluido-core.html?v=20260903-fluiddelete1','selector-nubes-fluido-v2-core.html?v=20260903-fluiddelete2').replace('selección rápida y borrado fluido exacto','selección rápida y borrado fluido exacto v2')
Path('selector-nubes-fluido-v2.html').write_text(wrap)
m=re.search(r'<script type="module">(.*?)</script>',src,re.S)
if not m: raise SystemExit('module script not found')
Path('/tmp/selector-nubes-fluido-v2.mjs').write_text(m.group(1))
