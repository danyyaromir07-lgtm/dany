from pathlib import Path
src=Path('selector-nubes-instancia-core.html').read_text()
needle="  const ranked=[];for(let idx=0;idx<cm.strokes.length;idx++){if(baseRoute.includes(idx))continue;const st=cm.strokes[idx];if(!st||st.editable===false||!st.invocations?.length)continue;const c=alignCost(missingV,st);if(Number.isFinite(c))ranked.push({idx,c})}ranked.sort((a,b)=>a.c-b.c);let replacement=-1,fingerprint=null,tests=0,max=Math.min(220,ranked.length);"
insert="""  const rootRanked=[];for(let idx=0;idx<cm.strokes.length;idx++){if(baseRoute.includes(idx))continue;const st=cm.strokes[idx];if(!st||st.editable===false||st.invocations?.length)continue;const c=alignCost(missingV,st);if(Number.isFinite(c))rootRanked.push({idx,c})}rootRanked.sort((a,b)=>a.c-b.c);let rootReplacement=-1,rootTests=0;for(const r of rootRanked){const k=await single(r.idx);rootTests++;if(k===missingSig){rootReplacement=r.idx;break}if(rootTests%25===0)status.textContent='Borrado exacto · buscando el último azul en streams de página '+rootTests+'/'+rootRanked.length+'…'}if(rootReplacement>=0){const repaired=baseRoute.map(i=>i===offender?rootReplacement:i);if(new Set(repaired).size!==repaired.length)throw new Error('la ruta raíz reparada contiene operadores duplicados');causalDiagnostic+=' · operador incorrecto='+offender+' · raíz exacta encontrada tras '+rootTests+'/'+rootRanked.length+' pruebas · ROOT-CAUSAL-EXHAUSTIVO';return repaired}causalDiagnostic+=' · búsqueda raíz exhaustiva='+rootTests+'/'+rootRanked.length+' sin coincidencia';
  const ranked=[];for(let idx=0;idx<cm.strokes.length;idx++){if(baseRoute.includes(idx))continue;const st=cm.strokes[idx];if(!st||st.editable===false||!st.invocations?.length)continue;const c=alignCost(missingV,st);if(Number.isFinite(c))ranked.push({idx,c})}ranked.sort((a,b)=>a.c-b.c);let replacement=-1,fingerprint=null,tests=0,max=Math.min(220,ranked.length);"""
if needle not in src: raise SystemExit('target block not found')
src=src.replace(needle,insert,1)
src=src.replace('selector-nubes-instancia-core.html?v=20260903-instance1','selector-nubes-exacto-core.html?v=20260903-rootall1')
Path('selector-nubes-exacto-core.html').write_text(src)
wrap=Path('selector-nubes-instancia.html').read_text().replace('Selector de nubes · borrado exacto por instancia','Selector de nubes · borrado exacto azul').replace('./selector-nubes-instancia-core.html?v=20260903-instance1','./selector-nubes-exacto-core.html?v=20260903-rootall1')
Path('selector-nubes-exacto.html').write_text(wrap)
# Extract module script for syntax validation.
import re
m=re.search(r'<script type="module">(.*?)</script>',src,re.S)
if not m: raise SystemExit('module script not found')
Path('/tmp/selector-nubes-exacto.mjs').write_text(m.group(1))
