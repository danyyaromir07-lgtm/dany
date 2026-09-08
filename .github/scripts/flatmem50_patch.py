from pathlib import Path
p=Path('lab-selector-v4/selector-nubes-multistream-core.html')
w=Path('lab-selector-v4/index.html')
s=p.read_text(); h=w.read_text()
old="if(!best||bd>Math.max(tol,red49Used?redPad:tol)){status.textContent='No encontré un trazo visual suficientemente cerca. · DBG49 red='+red49.length+(red49.length?' d='+red49[0].d.toFixed(2):'');return}"
new="const dbg50=()=>{const z=red49.slice(0,6).map(q=>{const v=q.s,L=v.first&&v.last?Math.hypot(v.last[0]-v.first[0],v.last[1]-v.first[1]):0,A=v.first&&v.last?Math.atan2(v.last[1]-v.first[1],v.last[0]-v.first[0]):0;return (v._ordinal??-1)+':d'+q.d.toFixed(2)+':l'+Number(v.lines||0)+':c'+Number(v.curves||0)+':s'+Number(v.segs||0)+':len'+L.toFixed(2)+':a'+A.toFixed(2)+':bb'+(v.bbox||[]).map(n=>Number(n).toFixed(1)).join('/')}).join(',');return ' · DBG50 red='+red49.length+' ['+z+']'};if(!best||bd>Math.max(tol,red49Used?redPad:tol)){status.textContent='No encontré un trazo visual suficientemente cerca.'+dbg50();return}"
assert old in s, 'flatmem49 fail anchor not found'
s=s.replace(old,new,1)
old2="+(red49Used?' · DBG49 uniqueRed=1 d='+bd.toFixed(2)+' l='+Number(best.lines||0)+' c='+Number(best.curves||0)+' s='+Number(best.segs||0):'')}"
if old2 in s:s=s.replace(old2,"+(red49Used?' · DBG49 uniqueRed=1 d='+bd.toFixed(2)+' l='+Number(best.lines||0)+' c='+Number(best.curves||0)+' s='+Number(best.segs||0):'')+dbg50()}",1)
if 'flatmem49' in h:h=h.replace('flatmem49','flatmem50',1)
p.write_text(s); w.write_text(h)
