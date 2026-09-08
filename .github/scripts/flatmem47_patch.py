from pathlib import Path
p=Path('lab-selector-v4/selector-nubes-multistream-core.html')
w=Path('lab-selector-v4/index.html')
s=p.read_text(); h=w.read_text()
anchor='indexReady=false;'
assert anchor in s
s=s.replace(anchor,'indexReady=false,redFill47=[];',1)
old='function collectVisual(page){const out=[],cb={'
new="function collectVisual(page){const out=[];redFill47=[];const cb={fillPath(path,evenOdd,ctm,cs,color){const rgb=Array.isArray(color)?color.slice(0,3).map(Number):[];if(rgb.length<3||!rgb.every(Number.isFinite)||rgb[0]<.70||rgb[0]-rgb[1]<.35||rgb[0]-rgb[2]<.35||rgb[1]>.42||rgb[2]>.42)return;const pts=[];let lines=0,curves=0;const P=(x,y)=>tf(ctm,x,y),add=q=>pts.push(q);path.walk({moveTo(x,y){add(P(x,y))},lineTo(x,y){add(P(x,y));lines++},curveTo(x1,y1,x2,y2,x3,y3){add(P(x1,y1));add(P(x2,y2));add(P(x3,y3));curves++},closePath(){}});if(!pts.length)return;const xs=pts.map(q=>q[0]),ys=pts.map(q=>q[1]);redFill47.push({bbox:[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)],lines,curves,segs:lines+curves,rgb,evenOdd:!!evenOdd})},"
assert old in s, 'collectVisual anchor missing'
s=s.replace(old,new,1)
helper="function dbg47FillAt(x,y,tol){const gap=b=>Math.hypot(Math.max(0,b[0]-x,x-b[2]),Math.max(0,b[1]-y,y-b[3]));const hits=redFill47.map(v=>({v,d:gap(v.bbox)})).filter(q=>q.d<=tol*1.5).sort((a,b)=>a.d-b.d).slice(0,8);return ' · DBG47 fillRed='+redFill47.length+' near='+hits.length+' ['+hits.map(q=>'d'+q.d.toFixed(2)+':l'+q.v.lines+':c'+q.v.curves+':s'+q.v.segs+':b'+q.v.bbox.map(n=>Number(n).toFixed(1)).join('/')).join(',')+']'}\n"
mark='function chooseClassic(e){'
assert mark in s
s=s.replace(mark,helper+mark,1)
old2="if(!best||bd>tol){status.textContent='No encontré un trazo visual suficientemente cerca.';return}"
new2="if(!best||bd>tol){status.textContent='No encontré un trazo visual suficientemente cerca.'+dbg47FillAt(x,y,tol);return}"
assert old2 in s, 'not-found anchor missing'
s=s.replace(old2,new2,1)
if 'flatmem45' in h:h=h.replace('flatmem45','flatmem47',1)
else:h=h.replace('selector-nubes-multistream-core.html?v=', 'selector-nubes-multistream-core.html?v=20260908-flatmem47-',1)
p.write_text(s);w.write_text(h)
