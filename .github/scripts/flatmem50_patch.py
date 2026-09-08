from pathlib import Path
p=Path('lab-selector-v4/selector-nubes-multistream-core.html')
w=Path('lab-selector-v4/index.html')
s=p.read_text(); h=w.read_text()
old="let best=null,bd=Infinity,blackHit=null,blackBd=Infinity;const pad=15/Math.max(.1,baseRs*zoom);for(const s of classicVisual){if(x<s.bbox[0]-pad||x>s.bbox[2]+pad||y<s.bbox[1]-pad||y>s.bbox[3]+pad)continue;const d=distance(s,x,y);if(d<bd){bd=d;best=s}if(isNearBlackStroke(s)&&d<blackBd){blackBd=d;blackHit=s}}const tol=14/Math.max(.1,baseRs*zoom);if(!best||bd>tol){status.textContent='No encontré un trazo visual suficientemente cerca.';return}"
new="let best=null,bd=Infinity,blackHit=null,blackBd=Infinity;const pad=15/Math.max(.1,baseRs*zoom),redPad=28/Math.max(.1,baseRs*zoom),red50=[];for(const s of classicVisual){const inPad=!(x<s.bbox[0]-pad||x>s.bbox[2]+pad||y<s.bbox[1]-pad||y>s.bbox[3]+pad);const inRed=!(x<s.bbox[0]-redPad||x>s.bbox[2]+redPad||y<s.bbox[1]-redPad||y>s.bbox[3]+redPad);if(!inPad&&!inRed)continue;const d=distance(s,x,y);if(inPad){if(d<bd){bd=d;best=s}if(isNearBlackStroke(s)&&d<blackBd){blackBd=d;blackHit=s}}if(inRed){const rc=(s.rgb||[]).slice(0,3).map(Number);if((s.segs||0)>0&&rc.length===3&&rc.every(Number.isFinite)&&rc[0]>=.70&&rc[0]-rc[1]>=.35&&rc[0]-rc[2]>=.35&&rc[1]<=.42&&rc[2]<=.42){const L=s.first&&s.last?Math.hypot(s.last[0]-s.first[0],s.last[1]-s.first[1]):0,A=s.first&&s.last?Math.atan2(s.last[1]-s.first[1],s.last[0]-s.first[0]):0;red50.push({s,d,L,A})}}}red50.sort((a,b)=>a.d-b.d);const dbg50=()=>{const z=red50.slice(0,6).map(q=>{const v=q.s;return (v._ordinal??-1)+':d'+q.d.toFixed(2)+':l'+Number(v.lines||0)+':c'+Number(v.curves||0)+':s'+Number(v.segs||0)+':len'+q.L.toFixed(2)+':a'+q.A.toFixed(2)+':bb'+(v.bbox||[]).map(n=>Number(n).toFixed(1)).join('/')}).join(',');return ' · DBG50 red='+red50.length+' ['+z+']'};const tol=14/Math.max(.1,baseRs*zoom);if(!best||bd>tol){status.textContent='No encontré un trazo visual suficientemente cerca.'+dbg50();return}"
assert old in s, 'chooseClassic anchor not found'
s=s.replace(old,new,1)
# Append diagnostic to successful selection status too.
anchor="+' · DBG blackSeed=0 rgb='+dbgRgb)}"
if anchor in s:s=s.replace(anchor,"+' · DBG blackSeed=0 rgb='+dbgRgb)+dbg50()}",1)
# Preserve flatmem45 verifier fix and brand; only cache-bust wrapper.
if 'flatmem45' in h:h=h.replace('flatmem45','flatmem50',1)
elif 'flatmem20' in h:h=h.replace('flatmem20','flatmem50',1)
else:h=h.replace('selector-nubes-multistream-core.html?v=', 'selector-nubes-multistream-core.html?v=20260908-flatmem50-',1)
p.write_text(s); w.write_text(h)
