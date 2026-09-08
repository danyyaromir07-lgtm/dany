from pathlib import Path
p=Path('lab-selector-v4/selector-nubes-multistream-core.html')
w=Path('lab-selector-v4/index.html')
s=p.read_text(); h=w.read_text()
old="let best=null,bd=Infinity,blackHit=null,blackBd=Infinity;const pad=15/Math.max(.1,baseRs*zoom);for(const s of classicVisual){if(x<s.bbox[0]-pad||x>s.bbox[2]+pad||y<s.bbox[1]-pad||y>s.bbox[3]+pad)continue;const d=distance(s,x,y);if(d<bd){bd=d;best=s}if(isNearBlackStroke(s)&&d<blackBd){blackBd=d;blackHit=s}}const tol=14/Math.max(.1,baseRs*zoom);if(!best||bd>tol){status.textContent='No encontré un trazo visual suficientemente cerca.';return}"
new="let best=null,bd=Infinity,blackHit=null,blackBd=Infinity,red46Hits=[];const pad=15/Math.max(.1,baseRs*zoom);for(const s of classicVisual){if(x<s.bbox[0]-pad||x>s.bbox[2]+pad||y<s.bbox[1]-pad||y>s.bbox[3]+pad)continue;const d=distance(s,x,y);if(d<bd){bd=d;best=s}if(isNearBlackStroke(s)&&d<blackBd){blackBd=d;blackHit=s}const rc=(s.rgb||[]).slice(0,3).map(Number);if((s.segs||0)>0&&rc.length===3&&rc.every(Number.isFinite)&&rc[0]>=.70&&rc[0]-rc[1]>=.35&&rc[0]-rc[2]>=.35&&rc[1]<=.42&&rc[2]<=.42)red46Hits.push({s,d})}red46Hits.sort((a,b)=>a.d-b.d);const dbg46=()=>{const a=red46Hits.slice(0,8).map(q=>{const v=q.s,L=v.first&&v.last?Math.hypot(v.last[0]-v.first[0],v.last[1]-v.first[1]):0,A=v.first&&v.last?Math.atan2(v.last[1]-v.first[1],v.last[0]-v.first[0]):0;return (v._ordinal??-1)+':d'+q.d.toFixed(2)+':l'+Number(v.lines||0)+':c'+Number(v.curves||0)+':s'+Number(v.segs||0)+':len'+L.toFixed(2)+':a'+A.toFixed(2)}).join(',');return ' · DBG46 redHits='+red46Hits.length+' ['+a+']'};const tol=14/Math.max(.1,baseRs*zoom);if(!best||bd>tol){status.textContent='No encontré un trazo visual suficientemente cerca.'+dbg46();return}"
assert old in s, 'chooseClassic scan anchor not found'
s=s.replace(old,new,1)
old2="+' · DBG blackSeed=0 rgb='+dbgRgb)}"
new2="+' · DBG blackSeed=0 rgb='+dbgRgb)+dbg46()}"
assert old2 in s, 'status anchor not found'
s=s.replace(old2,new2,1)
if 'flatmem45' in h:h=h.replace('flatmem45','flatmem46',1)
elif 'flatmem20' in h:h=h.replace('flatmem20','flatmem46',1)
else:h=h.replace('selector-nubes-multistream-core.html?v=', 'selector-nubes-multistream-core.html?v=20260908-flatmem46-',1)
p.write_text(s); w.write_text(h)
