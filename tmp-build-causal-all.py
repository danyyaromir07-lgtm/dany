from pathlib import Path
import re
src=Path('selector-nubes-identidad-core.html').read_text()
old=""" if(selectedVisual>600)throw new Error('selección demasiado grande para resolución causal acotada ('+selectedVisual+')');
 if(pool.length>700)throw new Error('la unión causal supera el límite seguro de 700 operadores ('+pool.length+')');"""
new=""" const causalHardLimit=2200;
 if(selectedVisual>causalHardLimit)throw new Error('selección demasiado grande para resolución causal exacta ('+selectedVisual+' > '+causalHardLimit+')');
 if(pool.length>causalHardLimit)throw new Error('la unión causal supera el límite seguro de '+causalHardLimit+' operadores ('+pool.length+')');"""
if old not in src: raise SystemExit('gate chunk not found')
src=src.replace(old,new,1)
old2="let missing=deficits(),initialMissing=[...missing.values()].reduce((a,b)=>a+b,0),expandBudget=700;"
new2="let missing=deficits(),initialMissing=[...missing.values()].reduce((a,b)=>a+b,0),expandBudget=Math.max(700,Math.min(1600,selectedVisual));"
if old2 not in src: raise SystemExit('expand chunk not found')
src=src.replace(old2,new2,1)
old3="async function buildCausalRoute(){return selectedVisual>600?buildLargeInstancePlan():buildCausalRouteSmall()}"
new3="async function buildCausalRoute(){return buildCausalRouteSmall()}"
if old3 not in src: raise SystemExit('route switch not found')
src=src.replace(old3,new3,1)
Path('selector-nubes-causal-core.html').write_text(src)
wrap=Path('selector-nubes-identidad.html').read_text().replace('Selector de nubes · identidad estructural estable','Selector de nubes · correspondencia causal exacta').replace('./selector-nubes-identidad-core.html?v=20260903-structid1','./selector-nubes-causal-core.html?v=20260903-causalall1')
Path('selector-nubes-causal.html').write_text(wrap)
m=re.search(r'<script type="module">(.*?)</script>',src,re.S)
if not m: raise SystemExit('module not found')
Path('/tmp/selector-nubes-causal.mjs').write_text(m.group(1))
