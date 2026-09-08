from pathlib import Path
p=Path('lab-selector-v4/selector-nubes-multistream-core.html')
w=Path('lab-selector-v4/index.html')
s=p.read_text(); h=w.read_text()
old="out.push({cmds,bbox,first,last,lines,curves,segs:lines+curves,width:Number(stroke?.lineWidth||0),rgb,closed,chordNorm:chord/d,lengthNorm:plen/d})"
assert old in s
s=s.replace(old,"out.push({cmds,bbox,first,last,lines,curves,segs:lines+curves,width:Number(stroke?.lineWidth||0),rgb,closed,chordNorm:chord/d,lengthNorm:plen/d,_ordinal:out.length})",1)
pos=s.index('function chooseClassic(e){')
block='''
function red38Rgb(v){const c=(v?.rgb||[]).slice(0,3).map(Number);return c.length===3&&c.every(Number.isFinite)?c:[]}
function red38Color(v){const c=red38Rgb(v);return c.length===3&&c[0]>=.72&&c[0]-c[1]>=.42&&c[0]-c[2]>=.42&&c[1]<=.36&&c[2]<=.36}
function red38Piece(v){if(!red38Color(v))return false;const n=Number(v.segs||0),d=diag(v.bbox||[0,0,0,0]);return n>=1&&n<=10&&Number.isFinite(d)&&d>=.25&&v.first&&v.last}
function red38Compat(x,seed){if(!red38Piece(x)||!red38Piece(seed)||colorDist(red38Rgb(x),red38Rgb(seed))>.05)return false;const dx=Math.max(.001,diag(x.bbox)),ds=Math.max(.001,diag(seed.bbox)),r=dx/ds;if(r<.12||r>8)return false;const wx=Math.abs(Number(x.width)||0),ws=Math.abs(Number(seed.width)||0);if(Math.max(wx,ws)>.04){const wr=Math.max(.001,wx)/Math.max(.001,ws);if(wr<.35||wr>2.8)return false}return true}
function red38Component(seed){
 const sd=Math.max(.001,diag(seed.bbox)),so=Number(seed._ordinal),all=[];
 for(const v of classicVisual){if(!red38Compat(v,seed))continue;const od=Math.abs(Number(v._ordinal)-so);if(Number.isFinite(od)&&od<=220)all.push(v)}
 if(!all.includes(seed))all.push(seed);
 if(all.length<4)return{group:[seed],cand:all.length,extent:1,maxDeg:0,ordSpan:0,safe:false};
 const md=med(all.map(v=>diag(v.bbox)).filter(Boolean)),tol=Math.max(.45,Math.min(sd,md)*.22),ends=[];
 for(let i=0;i<all.length;i++){ends.push({i,e:0,p:all[i].first},{i,e:1,p:all[i].last})}
 const nearest=new Array(ends.length).fill(-1),nd=new Array(ends.length).fill(Infinity);
 for(let a=0;a<ends.length;a++)for(let b=a+1;b<ends.length;b++){if(ends[a].i===ends[b].i)continue;const d=Math.hypot(ends[a].p[0]-ends[b].p[0],ends[a].p[1]-ends[b].p[1]);if(d>tol)continue;if(d<nd[a]){nd[a]=d;nearest[a]=b}if(d<nd[b]){nd[b]=d;nearest[b]=a}}
 const adj=Array.from({length:all.length},()=>new Set());
 for(let a=0;a<ends.length;a++){const b=nearest[a];if(b<0)continue;if(nearest[b]!==a&&nd[a]>Math.max(.18,nd[b]*1.35))continue;const i=ends[a].i,j=ends[b].i;if(i!==j){adj[i].add(j);adj[j].add(i)}}
 const start=all.indexOf(seed),seen=new Set([start]),q=[start];
 while(q.length){const i=q.shift();for(const j of adj[i])if(!seen.has(j)){seen.add(j);q.push(j)}}
 const group=[...seen].map(i=>all[i]),ds=group.map(v=>diag(v.bbox)).filter(Boolean),gm=med(ds),extent=gm?diag(componentBox(group))/gm:0,degs=[...seen].map(i=>adj[i].size),maxDeg=degs.length?Math.max(...degs):0,ords=group.map(v=>Number(v._ordinal)).filter(Number.isFinite),ordSpan=ords.length?Math.max(...ords)-Math.min(...ords):0,safe=group.length>=6&&extent>=3.2&&maxDeg<=3&&ordSpan<=220;
 return{group,cand:all.length,extent,maxDeg,ordSpan,safe,tol}
}
'''
s=s[:pos]+block+s[pos:]
old="let best=null,bd=Infinity,blackHit=null,blackBd=Infinity;const pad=15/Math.max(.1,baseRs*zoom);for(const s of classicVisual){if(x<s.bbox[0]-pad||x>s.bbox[2]+pad||y<s.bbox[1]-pad||y>s.bbox[3]+pad)continue;const d=distance(s,x,y);if(d<bd){bd=d;best=s}if(isNearBlackStroke(s)&&d<blackBd){blackBd=d;blackHit=s}}const tol=14/Math.max(.1,baseRs*zoom);if(!best||bd>tol){status.textContent='No encontré un trazo visual suficientemente cerca.';return}let prefBroad=null,prefGroups=null,prefSeed=null;if(!isNearBlackStroke(best)&&blackHit&&blackBd<=tol){"
new="let best=null,bd=Infinity,blackHit=null,blackBd=Infinity,redHits=[];const pad=15/Math.max(.1,baseRs*zoom);for(const s of classicVisual){if(x<s.bbox[0]-pad||x>s.bbox[2]+pad||y<s.bbox[1]-pad||y>s.bbox[3]+pad)continue;const d=distance(s,x,y);if(d<bd){bd=d;best=s}if(isNearBlackStroke(s)&&d<blackBd){blackBd=d;blackHit=s}if(red38Piece(s)&&d<=pad)redHits.push({s,d})}const tol=14/Math.max(.1,baseRs*zoom);if(!best||bd>tol){status.textContent='No encontré un trazo visual suficientemente cerca.';return}let prefRed38=null,red38Info=null,red38Seed=null,prefBroad=null,prefGroups=null,prefSeed=null;const sw=Math.max(2/Math.max(.1,baseRs*zoom),tol*.75),eligible=redHits.filter(q=>q.d<=Math.max(bd+sw,sw*1.5));if(eligible.length){eligible.sort((a,b)=>Number(b.s._ordinal)-Number(a.s._ordinal)||a.d-b.d);for(const q of eligible.slice(0,16)){const info=red38Component(q.s);if(info.safe){red38Seed=q.s;red38Info=info;prefRed38=info.group;best=q.s;bd=q.d;break}if(!red38Info){red38Seed=q.s;red38Info=info}}}if(!prefRed38&&!isNearBlackStroke(best)&&blackHit&&blackBd<=tol){"
assert old in s
s=s.replace(old,new,1)
old2="let famVisual=[];if(blackSeed){"
assert old2 in s
s=s.replace(old2,"let famVisual=[];if(prefRed38){famVisual=prefRed38}else if(blackSeed){",1)
old3="status.textContent='Selección acumulada · familias='+selectionFamilies+' · resaltados='+visualSelected.length+' · grupos≈'+vg+' · expansión por componente · azul listo · correspondencia estructural se calculará al pulsar Eliminar · Ctrl/Shift+clic añade otro tipo'+(blackSeed?"
assert old3 in s
s=s.replace(old3,"status.textContent='Selección acumulada · familias='+selectionFamilies+' · resaltados='+visualSelected.length+' · grupos≈'+vg+' · expansión por componente · azul listo · correspondencia estructural se calculará al pulsar Eliminar · Ctrl/Shift+clic añade otro tipo'+(prefRed38?' · DBG red38=1 seed='+prefRed38.length+' cand='+(red38Info?.cand||0)+' extent='+(red38Info?.extent||0).toFixed(2)+' maxDeg='+(red38Info?.maxDeg||0)+' ordSpan='+(red38Info?.ordSpan||0)+' ord='+(red38Seed?._ordinal??-1)+' rgb='+dbgRgb:(red38Seed?' · DBG red38=0 seed='+(red38Info?.group?.length||1)+' cand='+(red38Info?.cand||0)+' extent='+(red38Info?.extent||0).toFixed(2)+' maxDeg='+(red38Info?.maxDeg||0)+' ordSpan='+(red38Info?.ordSpan||0)+' ord='+(red38Seed?._ordinal??-1)+' rgb='+dbgRgb:(blackSeed?",1)
tail="' · DBG blackSeed=0 rgb='+dbgRgb)}"
assert tail in s
s=s.replace(tail,"' · DBG blackSeed=0 rgb='+dbgRgb)))}",1)
h=h.replace('flatmem20','flatmem38',1) if 'flatmem20' in h else h.replace('selector-nubes-multistream-core.html?v=', 'selector-nubes-multistream-core.html?v=20260908-flatmem38-',1)
p.write_text(s);w.write_text(h)
