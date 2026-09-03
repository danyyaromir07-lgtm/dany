from pathlib import Path
import re
src=Path('selector-nubes-global-fluido-core.html').read_text()
# helper: stable structural identity must survive reopening the same bytes
needle="function collectVisual(page){"
helper="function structStableKey(s){return String(s?.instanceKey||((s?.sourceKey||'')+'|'+(s?.start??'')+'|'+(s?.end??'')))}\nfunction remapStructTargets(activeStrokes,workModel){const buckets=new Map();for(const s of workModel.strokes){const k=structStableKey(s);if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(s)}const out=[];for(const a of activeStrokes){const k=structStableKey(a),hits=buckets.get(k)||[];if(hits.length!==1)throw new Error('la identidad estructural no es única/estable para '+k+' · coincidencias='+hits.length);out.push(hits[0])}return out}\n"
if helper not in src: src=src.replace(needle,helper+needle,1)
old="const targets=selectedIdx.map(i=>wm.strokes[i]);if(targets.some(x=>!x||x.editable===false))throw new Error('hay operadores candidatos no editables con seguridad');"
new="const activeTargets=selectedIdx.map(i=>model.strokes[i]);if(activeTargets.some(x=>!x||x.editable===false))throw new Error('hay operadores candidatos no editables con seguridad en el modelo activo');const targets=remapStructTargets(activeTargets,wm);if(targets.some(x=>!x||x.editable===false))throw new Error('hay operadores candidatos no editables con seguridad en la copia');"
if old not in src: raise SystemExit('attempt target chunk not found')
src=src.replace(old,new,1)
old2="const regular=plan.baseRoute.filter(i=>i!==plan.offender),targets=regular.map(i=>wm.strokes[i]);if(targets.some(x=>!x||x.editable===false))throw new Error('la ruta de 825 contiene un operador no editable');"
new2="const regular=plan.baseRoute.filter(i=>i!==plan.offender),activeRegular=regular.map(i=>model.strokes[i]),targets=remapStructTargets(activeRegular,wm);if(targets.some(x=>!x||x.editable===false))throw new Error('la ruta base contiene un operador no editable');"
if old2 in src: src=src.replace(old2,new2,1)
# Add a strict whole-model identity diagnostic before executing route indices.
mark="if(!wm||wm.incomplete||wm.strokes.length!==beforeStruct)throw new Error('el modelo profundo de la copia no coincide con el modelo activo');"
rep=mark+"let structuralOrderDrift=0;for(let si=0;si<beforeStruct;si++)if(structStableKey(wm.strokes[si])!==structStableKey(model.strokes[si])){structuralOrderDrift++;if(structuralOrderDrift===1)console.warn('orden estructural distinto en',si,structStableKey(model.strokes[si]),structStableKey(wm.strokes[si]))}"
src=src.replace(mark,rep,1)
Path('selector-nubes-identidad-core.html').write_text(src)
wrap=Path('selector-nubes-global-fluido.html').read_text().replace('Selector de nubes · selección rápida y mapeo global fluido','Selector de nubes · identidad estructural estable').replace('./selector-nubes-global-fluido-core.html?v=20260903-globalasync1','./selector-nubes-identidad-core.html?v=20260903-structid1')
Path('selector-nubes-identidad.html').write_text(wrap)
m=re.search(r'<script type="module">(.*?)</script>',src,re.S)
if not m: raise SystemExit('module not found')
Path('/tmp/selector-nubes-identidad.mjs').write_text(m.group(1))
