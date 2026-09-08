from pathlib import Path
p=Path('lab-selector-v4/selector-nubes-multistream-core.html')
w=Path('lab-selector-v4/index.html')
s=p.read_text(); h=w.read_text()
old="if(!visualSigEqual(r,classicVisual[expected])){ok=false;why='la geometría restante diverge en el ordinal '+expected;return}"
new="if(!visualSigEqual(r,classicVisual[expected])){const ex=classicVisual[expected],fmt=v=>{const b=v?.bbox||[];return 'sig='+sig(v)+'|l='+(v?.lines??-1)+'|c='+(v?.curves??-1)+'|s='+(v?.segs??-1)+'|w='+Number(v?.width||0).toFixed(3)+'|rgb='+(v?.rgb||[]).slice(0,3).map(x=>Number(x).toFixed(3)).join('/')+'|bbox='+b.map(x=>Number(x).toFixed(2)).join(',')};ok=false;why='la geometría restante diverge en el ordinal '+expected+' · esperado{'+fmt(ex)+'} · obtenido{'+fmt(r)+'}';return}"
assert old in s
s=s.replace(old,new,1)
if 'flatmem20' in h:h=h.replace('flatmem20','flatmem44',1)
else:h=h.replace('selector-nubes-multistream-core.html?v=', 'selector-nubes-multistream-core.html?v=20260908-flatmem44-',1)
p.write_text(s);w.write_text(h)
