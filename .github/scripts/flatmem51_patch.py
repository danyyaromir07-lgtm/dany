from pathlib import Path
p=Path('lab-selector-v4/selector-nubes-multistream-core.html')
w=Path('lab-selector-v4/index.html')
s=p.read_text(); h=w.read_text()
old="return (v._ordinal??-1)+':d'+q.d.toFixed(2)+':l'+Number(v.lines||0)+':c'+Number(v.curves||0)+':s'+Number(v.segs||0)+':len'+q.L.toFixed(2)+':a'+q.A.toFixed(2)+':bb'+(v.bbox||[]).map(n=>Number(n).toFixed(1)).join('/')"
new="return (v._ordinal??-1)+':d'+q.d.toFixed(2)+':l'+Number(v.lines||0)+':c'+Number(v.curves||0)+':s'+Number(v.segs||0)+':closed='+(v.closed?'1':'0')+':diag'+diag(v.bbox).toFixed(2)+':plen'+((Number(v.lengthNorm)||0)*Math.max(.001,diag(v.bbox))).toFixed(2)+':chordN'+Number(v.chordNorm||0).toFixed(3)+':bb'+(v.bbox||[]).map(n=>Number(n).toFixed(1)).join('/')"
assert old in s, 'DBG50 record anchor not found'
s=s.replace(old,new,1).replace('DBG50 red=','DBG51 red=',2)
if 'flatmem50' in h:h=h.replace('flatmem50','flatmem51',1)
elif 'flatmem49' in h:h=h.replace('flatmem49','flatmem51',1)
p.write_text(s); w.write_text(h)
