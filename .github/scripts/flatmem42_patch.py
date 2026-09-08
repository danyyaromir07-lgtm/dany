from pathlib import Path
p=Path('lab-selector-v4/selector-nubes-multistream-core.html')
w=Path('lab-selector-v4/index.html')
s=p.read_text(); h=w.read_text()
pos=s.index('function chooseClassic(e){')
block=r'''
function red42Rgb(v){const c=(v?.rgb||[]).slice(0,3).map(Number);return c.length===3&&c.every(Number.isFinite)?c:[]}
function red42Color(v){const c=red42Rgb(v);return c.length===3&&c[0]>=.72&&c[0]-c[1]>=.42&&c[0]-c[2]>=.42&&c[1]<=.36&&c[2]<=.36}
function red42Ang(v){if(!v?.first||!v?.last)return NaN;return Math.atan2(v.last[1]-v.first[1],v.last[0]-v.first[0])}
function red42Len(v){return v?.first&&v?.last?Math.hypot(v.last[0]-v.first[0],v.last[1]-v.first[1]):0}
function red42Adiff(a,b){let d=Math.abs(a-b)%Math.PI;return Math.min(d,Math.PI-d)}
function red42Build(seed,hatchAng){
 const sw=Math.abs(Number(seed.width)||0),seedLen=Math.max(.001,red42Len(seed)),all=[];
 for(const v of classicVisual){
   if(!red42Color(v)||!v.first||!v.last||Number(v.segs||0)!==1)continue;
   const a=red42Ang(v),l=red42Len(v);if(!Number.isFinite(a)||!l)continue;
   const vw=Math.abs(Number(v.width)||0);if(Math.max(sw,vw)>.04){const wr=Math.max(.001,vw)/Math.max(.001,sw);if(wr<.45||wr>2.2)continue}
   if(red42Adiff(a,hatchAng)<.10 && l>Math.max(28,seedLen*2.8))continue;
   all.push(v)
 }
 if(!all.includes(seed))all.push(seed);
 const lens=all.map(red42Len).filter(Boolean),ml=med(lens)||seedLen,tol=Math.max(.65,Math.min(4.5,ml*.42));
 const adj=Array.from({length:all.length},()=>[]),endDist=(a,b)=>Math.min(
   Math.hypot(a.first[0]-b.first[0],a.first[1]-b.first[1]),Math.hypot(a.first[0]-b.last[0],a.first[1]-b.last[1]),
   Math.hypot(a.last[0]-b.first[0],a.last[1]-b.first[1]),Math.hypot(a.last[0]-b.last[0],a.last[1]-b.last[1]));
 for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++){
   const d=endDist(all[i],all[j]);if(d>tol)continue;
   const da=red42Adiff(red42Ang(all[i]),red42Ang(all[j]));if(da>.72)continue;
   adj[i].push(j);adj[j].push(i)
 }
 const start=all.indexOf(seed),seen=new Set([start]),q=[start];while(q.length){const i=q.shift();for(const j of adj[i])if(!seen.has(j)){seen.add(j);q.push(j)}}
 const group=[...seen].map(i=>all[i]),angs=group.map(red42Ang).filter(Number.isFinite),extent=group.length?diag(componentBox(group))/Math.max(.001,med(group.map(v=>diag(v.bbox)).filter(Boolean))):0;
 let spread=0;for(let i=0;i<angs.length;i++)for(let j=i+1;j<angs.length;j++)spread=Math.max(spread,red42Adiff(angs[i],angs[j]));
 const hatchFrac=group.length?group.filter(v=>red42Adiff(red42Ang(v),hatchAng)<.10).length/group.length:1;
 const safe=group.length>=8&&extent>=3.0&&spread>=.32&&hatchFrac<=.72;
 return{group,cand:all.length,extent,spread,hatchFrac,safe,tol}
}
'''
s=s[:pos]+block+s[pos:]
old="let best=null,bd=Infinity,blackHit=null,blackBd=Infinity;const pad=15/Math.max(.1,baseRs*zoom);for(const s of classicVisual){if(x<s.bbox[0]-pad||x>s.bbox[2]+pad||y<s.bbox[1]-pad||y>s.bbox[3]+pad)continue;const d=distance(s,x,y);if(d<bd){bd=d;best=s}if(isNearBlackStroke(s)&&d<blackBd){blackBd=d;blackHit=s}}const tol=14/Math.max(.1,baseRs*zoom);if(!best||bd>tol){status.textContent='No encontré un trazo visual suficientemente cerca.';return}let prefBroad=null,prefGroups=null,prefSeed=null;if(!isNearBlackStroke(best)&&blackHit&&blackBd<=tol){"
new="let best=null,bd=Infinity,blackHit=null,blackBd=Infinity,red42Hits=[];const pad=15/Math.max(.1,baseRs*zoom);for(const s of classicVisual){if(x<s.bbox[0]-pad||x>s.bbox[2]+pad||y<s.bbox[1]-pad||y>s.bbox[3]+pad)continue;const d=distance(s,x,y);if(d<bd){bd=d;best=s}if(isNearBlackStroke(s)&&d<blackBd){blackBd=d;blackHit=s}if(red42Color(s)&&Number(s.segs||0)===1&&d<=pad*1.35)red42Hits.push({s,d})}const tol=14/Math.max(.1,baseRs*zoom);if(!best||bd>tol){status.textContent='No encontré un trazo visual suficientemente cerca.';return}let prefRed42=null,red42Info=null,red42Seed=null,prefBroad=null,prefGroups=null,prefSeed=null;if(red42Color(best)&&Number(best.segs||0)===1&&red42Hits.length){const hatchAng=red42Ang(best),alts=red42Hits.filter(q=>q.s!==best&&q.d<=Math.max(tol*1.35,bd+tol*.8)&&red42Adiff(red42Ang(q.s),hatchAng)>=.14).sort((a,b)=>a.d-b.d||red42Len(a.s)-red42Len(b.s));for(const q of alts.slice(0,12)){const info=red42Build(q.s,hatchAng);if(!red42Info){red42Info=info;red42Seed=q.s}if(info.safe){prefRed42=info.group;red42Info=info;red42Seed=q.s;best=q.s;bd=q.d;break}}}if(!prefRed42&&!isNearBlackStroke(best)&&blackHit&&blackBd<=tol){"
assert old in s
s=s.replace(old,new,1)
old2="let famVisual=[];if(blackSeed){"
assert old2 in s
s=s.replace(old2,"let famVisual=[];if(prefRed42){famVisual=prefRed42}else if(blackSeed){",1)
old3="const vg=components(visualSelected),dbgRgb=(best.rgb||[]).slice(0,3).map(v=>Number(v).toFixed(3)).join('/'),dbgSafe=blackSeed?blackCloudSafe(seed):false,dbgRatio=seed.length?diag(componentBox(seed))/Math.max(.001,med(seed.map(v=>diag(v.bbox)).filter(Boolean))):0;status.textContent='Selección acumulada · familias='+selectionFamilies+' · resaltados='+visualSelected.length+' · grupos≈'+vg+' · expansión por componente · azul listo · correspondencia estructural se calculará al pulsar Eliminar · Ctrl/Shift+clic añade otro tipo'+(blackSeed?' · DBG rgb='+dbgRgb+' w='+Number(best.width||0).toFixed(3)+' c='+Number(best.curves||0)+' l='+Number(best.lines||0)+' s='+Number(best.segs||0)+' broad='+broad.length+' groups='+groups.length+' seed='+seed.length+' ratio='+dbgRatio.toFixed(2)+' safe='+(dbgSafe?'1':'0'):' · DBG blackSeed=0 rgb='+dbgRgb)}"
new3="const vg=components(visualSelected),dbgRgb=(best.rgb||[]).slice(0,3).map(v=>Number(v).toFixed(3)).join('/'),dbgSafe=blackSeed?blackCloudSafe(seed):false,dbgRatio=seed.length?diag(componentBox(seed))/Math.max(.001,med(seed.map(v=>diag(v.bbox)).filter(Boolean))):0,dbg42=red42Info?' · DBG42 red='+(prefRed42?'1':'0')+' seed='+(red42Info.group?.length||0)+' cand='+(red42Info.cand||0)+' extent='+(red42Info.extent||0).toFixed(2)+' spread='+(red42Info.spread||0).toFixed(2)+' hatchFrac='+(red42Info.hatchFrac||0).toFixed(2)+' seedOrd='+(red42Seed?._ordinal??-1):' · DBG42 red=0 alt=0';status.textContent='Selección acumulada · familias='+selectionFamilies+' · resaltados='+visualSelected.length+' · grupos≈'+vg+' · expansión por componente · azul listo · correspondencia estructural se calculará al pulsar Eliminar · Ctrl/Shift+clic añade otro tipo'+(blackSeed?' · DBG rgb='+dbgRgb+' w='+Number(best.width||0).toFixed(3)+' c='+Number(best.curves||0)+' l='+Number(best.lines||0)+' s='+Number(best.segs||0)+' broad='+broad.length+' groups='+groups.length+' seed='+seed.length+' ratio='+dbgRatio.toFixed(2)+' safe='+(dbgSafe?'1':'0'):' · DBG blackSeed=0 rgb='+dbgRgb)+dbg42"
assert old3 in s
s=s.replace(old3,new3,1)
if 'flatmem20' in h:h=h.replace('flatmem20','flatmem42',1)
else:h=h.replace('selector-nubes-multistream-core.html?v=', 'selector-nubes-multistream-core.html?v=20260908-flatmem42-',1)
p.write_text(s); w.write_text(h)
