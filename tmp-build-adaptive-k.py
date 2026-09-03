from pathlib import Path
import re
src=Path('selector-nubes-exacto-core.html').read_text()
old1="const used=new Set(blocked),m=model.strokes.length,K=160,lists=[];"
new1="const used=new Set(blocked),m=model.strokes.length,K=Math.min(m,Math.max(160,Math.ceil(vs.length*1.2)+32)),lists=[];"
old2="const used=new Set(blocked),n=classicVisual.length,m=model.strokes.length,K=160;"
new2="const used=new Set(blocked),n=classicVisual.length,m=model.strokes.length,K=Math.min(m,Math.max(160,Math.ceil(vs.length*1.2)+32));"
if old1 not in src: raise SystemExit('spatial K pattern not found')
if old2 not in src: raise SystemExit('map K pattern not found')
src=src.replace(old1,new1,1).replace(old2,new2,1)
src=src.replace('multirruta global amplia '+"'",'multirruta global adaptativa '+"'",1)
src=src.replace('selector-nubes-exacto-core.html?v=20260903-rootall1','selector-nubes-adaptativo-core.html?v=20260903-adaptive1')
Path('selector-nubes-adaptativo-core.html').write_text(src)
wrap=Path('selector-nubes-exacto.html').read_text().replace('Selector de nubes · borrado exacto azul','Selector de nubes · borrado exacto azul adaptativo').replace('./selector-nubes-exacto-core.html?v=20260903-rootall1','./selector-nubes-adaptativo-core.html?v=20260903-adaptive1')
Path('selector-nubes-adaptativo.html').write_text(wrap)
m=re.search(r'<script type="module">(.*?)</script>',src,re.S)
if not m: raise SystemExit('module script not found')
Path('/tmp/selector-nubes-adaptativo.mjs').write_text(m.group(1))
