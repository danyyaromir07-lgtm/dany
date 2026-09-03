from pathlib import Path
import re
src=Path('selector-nubes-causal-core.html').read_text()
old="""  let missing=deficits(),initialMissing=[...missing.values()].reduce((a,b)=>a+b,0),expandBudget=Math.max(700,Math.min(1600,selectedVisual));
  if(initialMissing){
   const ranked=[];for(const[k,n]of missing){const targets=visualBySig.get(k)||[];for(let idx=0;idx<cm.strokes.length;idx++){if(poolSet.has(idx)||testedSet.has(idx))continue;const st=cm.strokes[idx];if(!st||st.editable===false)continue;let c=Infinity;for(const v of targets)c=Math.min(c,alignCost(v,st));if(Number.isFinite(c))ranked.push({k,idx,c})}}
   ranked.sort((a,b)=>a.c-b.c);const seenPair=new Set();
   for(const r of ranked){if(expanded>=expandBudget)break;missing=deficits();if(!missing.size)break;if(!missing.has(r.k))continue;const pk=r.k+'|'+r.idx;if(seenPair.has(pk))continue;seenPair.add(pk);await testIdx(r.idx,'Búsqueda causal ampliada');expanded++}
  }
"""
new="""  let missing=deficits(),initialMissing=[...missing.values()].reduce((a,b)=>a+b,0);
  if(initialMissing){
   const missingTargets=[];for(const k of missing.keys()){const a=visualBySig.get(k)||[];if(a.length)missingTargets.push(a[0])}
   const ranked=[];for(let idx=0;idx<cm.strokes.length;idx++){if(testedSet.has(idx))continue;const st=cm.strokes[idx];if(!st||st.editable===false)continue;let c=Infinity;for(const v of missingTargets)c=Math.min(c,alignCost(v,st));ranked.push({idx,c:Number.isFinite(c)?c:1e99});if(idx%48===0){status.textContent='Preparando búsqueda causal exhaustiva · '+idx+'/'+cm.strokes.length+' operadores revisados…';await uiYield()}}
   ranked.sort((a,b)=>a.c-b.c);const totalUnique=ranked.length;
   for(let q=0;q<ranked.length;q++){missing=deficits();if(!missing.size)break;const beforeTested=tested;await testIdx(ranked[q].idx,'Búsqueda causal exhaustiva '+(q+1)+'/'+totalUnique+' operadores únicos');if(tested>beforeTested)expanded++;if(q%6===0)await uiYield()}
  }
"""
if old not in src:
    raise SystemExit('expansion chunk not found')
src=src.replace(old,new,1)
src=src.replace("if(label&&tested%12===0){status.textContent=label+' · '+tested+' pruebas causales · coincidencias 1:1='+oneToOne+'…';await uiYield()}","if(label&&tested%6===0){status.textContent=label+' · '+tested+' pruebas causales únicas · coincidencias 1:1='+oneToOne+'…';await uiYield()}",1)
src=src.replace("faltan operadores causales para '+missingCount+' trazo(s) azul(es) después de ampliar la búsqueda", "faltan operadores causales para '+missingCount+' trazo(s) azul(es) después de probar todos los operadores editables disponibles")
src=src.replace("pool inicial='+pool.length+' · pruebas totales='+tested+' · ampliadas='+expanded+' · operadores 1:1=", "pool inicial='+pool.length+' · pruebas únicas totales='+tested+' · ampliadas únicas='+expanded+' · operadores 1:1=")
Path('selector-nubes-causal-total-core.html').write_text(src)
wrap=Path('selector-nubes-causal.html').read_text().replace('Selector de nubes · correspondencia causal exacta','Selector de nubes · causal exhaustivo por operadores únicos').replace('./selector-nubes-causal-core.html?v=20260903-causalall1','./selector-nubes-causal-total-core.html?v=20260903-causalunique1')
Path('selector-nubes-causal-total.html').write_text(wrap)
m=re.search(r'<script type="module">(.*?)</script>',src,re.S)
if not m: raise SystemExit('module not found')
Path('/tmp/selector-nubes-causal-total.mjs').write_text(m.group(1))
