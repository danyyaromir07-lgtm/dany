from pathlib import Path
p=Path('lab-selector-v4/selector-nubes-multistream-core.html')
w=Path('lab-selector-v4/index.html')
s=p.read_text(); h=w.read_text()
old="out.push({cmds,bbox,first,last,lines,curves,segs:lines+curves,width:Number(stroke?.lineWidth||0),rgb,closed,chordNorm:chord/d,lengthNorm:plen/d})"
assert old in s
s=s.replace(old,"out.push({cmds,bbox,first,last,lines,curves,segs:lines+curves,width:Number(stroke?.lineWidth||0),rgb,closed,chordNorm:chord/d,lengthNorm:plen/d,_ordinal:out.length})",1)
pos=s.index('function chooseClassic(e){')
block=r'''
function red39Rgb(v){
 const c=(v?.rgb||[]).slice(0,3).map(Number);
 return c.length===3&&c.every(Number.isFinite)?c:[]
}
function red39Color(v){
 const c=red39Rgb(v);
 return c.length===3&&c[0]>=.72&&c[0]-c[1]>=.42&&c[0]-c[2]>=.42&&c[1]<=.36&&c[2]<=.36
}
function red39SeedPiece(v){
 if(!red39Color(v))return false;
 const c=Math.max(0,Number(v.curves||0)),n=Math.max(0,Number(v.segs||0)),d=diag(v.bbox||[0,0,0,0]);
 return c>=1&&n>=1&&n<=8&&Number.isFinite(d)&&d>=.25&&v.first&&v.last
}
function red39Member(v,seed){
 if(!red39Color(v)||!v.first||!v.last)return false;
 const n=Math.max(0,Number(v.segs||0)),d=Math.max(.001,diag(v.bbox||[0,0,0,0])),sd=Math.max(.001,diag(seed.bbox||[0,0,0,0]));
 if(n<1||n>12||d/sd<.10||d/sd>10||colorDist(red39Rgb(v),red39Rgb(seed))>.05)return false;
 const w=Math.abs(Number(v.width)||0),sw=Math.abs(Number(seed.width)||0);
 if(Math.max(w,sw)>.04){const wr=Math.max(.001,w)/Math.max(.001,sw);if(wr<.35||wr>2.8)return false}
 return true
}
function red39Component(seed){
 const so=Number(seed._ordinal),all=[];
 for(const v of classicVisual){
   if(!red39Member(v,seed))continue;
   const od=Math.abs(Number(v._ordinal)-so);
   if(Number.isFinite(od)&&od<=220)all.push(v)
 }
 if(!all.includes(seed))all.push(seed);
 if(all.length<4)return{group:[seed],cand:all.length,extent:1,curved:1,ordSpan:0,maxDeg:0,safe:false};
 const md=med(all.map(v=>diag(v.bbox)).filter(Boolean)),tol=Math.max(.55,Math.min(diag(seed.bbox),md)*.34);
 const adj=Array.from({length:all.length},()=>new Set());
 for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++){
   const oi=Number(all[i]._ordinal),oj=Number(all[j]._ordinal);
   if(!Number.isFinite(oi)||!Number.isFinite(oj)||Math.abs(oi-oj)>12)continue;
   const d=Math.min(
     Math.hypot(all[i].first[0]-all[j].first[0],all[i].first[1]-all[j].first[1]),
     Math.hypot(all[i].first[0]-all[j].last[0],all[i].first[1]-all[j].last[1]),
     Math.hypot(all[i].last[0]-all[j].first[0],all[i].last[1]-all[j].first[1]),
     Math.hypot(all[i].last[0]-all[j].last[0],all[i].last[1]-all[j].last[1])
   );
   if(d<=tol){adj[i].add(j);adj[j].add(i)}
 }
 const start=all.indexOf(seed),seen=new Set([start]),q=[start];
 while(q.length){const i=q.shift();for(const j of adj[i])if(!seen.has(j)){seen.add(j);q.push(j)}}
 const group=[...seen].map(i=>all[i]),ds=group.map(v=>diag(v.bbox)).filter(Boolean),gm=med(ds),extent=gm?diag(componentBox(group))/gm:0;
 const curved=group.filter(v=>Number(v.curves||0)>=1).length,degs=[...seen].map(i=>adj[i].size),maxDeg=degs.length?Math.max(...degs):0,ords=group.map(v=>Number(v._ordinal)).filter(Number.isFinite),ordSpan=ords.length?Math.max(...ords)-Math.min(...ords):0;
 const safe=group.length>=5&&curved>=3&&extent>=2.8&&maxDeg<=6&&ordSpan<=220;
 return{group,cand:all.length,extent,curved,ordSpan,maxDeg,safe,tol}
}
'''
s=s[:pos]+block+s[pos:]
old="let best=null,bd=Infinity,blackHit=null,blackBd=Infinity;const pad=15/Math.max(.1,baseRs*zoom);for(const s of classicVisual){if(x<s.bbox[0]-pad||x>s.bbox[2]+pad||y<s.bbox[1]-pad||y>s.bbox[3]+pad)continue;const d=distance(s,x,y);if(d<bd){bd=d;best=s}if(isNearBlackStroke(s)&&d<blackBd){blackBd=d;blackHit=s}}const tol=14/Math.max(.1,baseRs*zoom);if(!best||bd>tol){status.textContent='No encontré un trazo visual suficientemente cerca.';return}let prefBroad=null,prefGroups=null,prefSeed=null;if(!isNearBlackStroke(best)&&blackHit&&blackBd<=tol){"
new="let best=null,bd=Infinity,blackHit=null,blackBd=Infinity,redCurveHits=[];const pad=15/Math.max(.1,baseRs*zoom);for(const s of classicVisual){if(x<s.bbox[0]-pad||x>s.bbox[2]+pad||y<s.bbox[1]-pad||y>s.bbox[3]+pad)continue;const d=distance(s,x,y);if(d<bd){bd=d;best=s}if(isNearBlackStroke(s)&&d<blackBd){blackBd=d;blackHit=s}if(red39SeedPiece(s)&&d<=pad)redCurveHits.push({s,d})}const tol=14/Math.max(.1,baseRs*zoom);if(!best||bd>tol){status.textContent='No encontré un trazo visual suficientemente cerca.';return}let prefRed39=null,red39Info=null,red39Seed=null,prefBroad=null,prefGroups=null,prefSeed=null;const sw=Math.max(2/Math.max(.1,baseRs*zoom),tol*.8),eligibleRed39=redCurveHits.filter(q=>q.d<=Math.max(bd+sw,sw*1.6));if(eligibleRed39.length){eligibleRed39.sort((a,b)=>Number(b.s._ordinal)-Number(a.s._ordinal)||a.d-b.d);for(const q of eligibleRed39.slice(0,16)){const info=red39Component(q.s);if(info.safe){red39Seed=q.s;red39Info=info;prefRed39=info.group;best=q.s;bd=q.d;break}if(!red39Info){red39Seed=q.s;red39Info=info}}}if(!prefRed39&&!isNearBlackStroke(best)&&blackHit&&blackBd<=tol){"
assert old in s
s=s.replace(old,new,1)
old2="let famVisual=[];if(blackSeed){"
assert old2 in s
s=s.replace(old2,"let famVisual=[];if(prefRed39){famVisual=prefRed39}else if(blackSeed){",1)
old3="status.textContent='Selección acumulada · familias='+selectionFamilies+' · resaltados='+visualSelected.length+' · grupos≈'+vg+' · expansión por componente · azul listo · correspondencia estructural se calculará al pulsar Eliminar · Ctrl/Shift+clic añade otro tipo'+(blackSeed?"
assert old3 in s
s=s.replace(old3,"status.textContent='Selección acumulada · familias='+selectionFamilies+' · resaltados='+visualSelected.length+' · grupos≈'+vg+' · expansión por componente · azul listo · correspondencia estructural se calculará al pulsar Eliminar · Ctrl/Shift+clic añade otro tipo'+(prefRed39?' · DBG red39=1 seed='+prefRed39.length+' cand='+(red39Info?.cand||0)+' extent='+(red39Info?.extent||0).toFixed(2)+' curved='+(red39Info?.curved||0)+' maxDeg='+(red39Info?.maxDeg||0)+' ordSpan='+(red39Info?.ordSpan||0)+' ord='+(red39Seed?._ordinal??-1)+' rgb='+dbgRgb:(red39Seed?' · DBG red39=0 seed='+(red39Info?.group?.length||1)+' cand='+(red39Info?.cand||0)+' extent='+(red39Info?.extent||0).toFixed(2)+' curved='+(red39Info?.curved||0)+' maxDeg='+(red39Info?.maxDeg||0)+' ordSpan='+(red39Info?.ordSpan||0)+' ord='+(red39Seed?._ordinal??-1)+' rgb='+dbgRgb:(blackSeed?",1)
tail="' · DBG blackSeed=0 rgb='+dbgRgb)}"
assert tail in s
s=s.replace(tail,"' · DBG blackSeed=0 rgb='+dbgRgb)))}",1)
h=h.replace('flatmem20','flatmem39',1) if 'flatmem20' in h else h.replace('selector-nubes-multistream-core.html?v=', 'selector-nubes-multistream-core.html?v=20260908-flatmem39-',1)
p.write_text(s); w.write_text(h)
