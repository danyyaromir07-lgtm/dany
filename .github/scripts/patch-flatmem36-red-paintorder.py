from pathlib import Path
p=Path('lab-selector-v4/selector-nubes-multistream-core.html')
w=Path('lab-selector-v4/index.html')
s=p.read_text(); h=w.read_text()
pos=s.index('function chooseClassic(e){')
block=r'''
function redTopRgb(v){const c=(v?.rgb||[]).slice(0,3).map(Number);return c.length===3&&c.every(Number.isFinite)?c:[]}
function redTopColor(v){const c=redTopRgb(v);return c.length===3&&c[0]>=.72&&c[0]-c[1]>=.42&&c[0]-c[2]>=.42&&c[1]<=.36&&c[2]<=.36}
function redTopPiece(v){if(!redTopColor(v))return false;const n=Number(v.segs||0),d=diag(v.bbox||[0,0,0,0]);return n>=1&&n<=10&&Number.isFinite(d)&&d>=.25&&v.first&&v.last}
function redTopCompat(x,s){if(!redTopPiece(x)||!redTopPiece(s)||colorDist(redTopRgb(x),redTopRgb(s))>.05)return false;const dx=Math.max(.001,diag(x.bbox)),ds=Math.max(.001,diag(s.bbox)),dr=dx/ds;if(dr<.12||dr>8)return false;const wx=Math.abs(Number(x.width)||0),ws=Math.abs(Number(s.width)||0);if(Math.max(wx,ws)>.04){const wr=Math.max(.001,wx)/Math.max(.001,ws);if(wr<.35||wr>2.8)return false}return true}
function redTopComponent(seed){
 const sd=Math.max(.001,diag(seed.bbox)),cand=[];
 for(const v of classicVisual){if(redTopCompat(v,seed))cand.push(v)}
 if(!cand.includes(seed))cand.push(seed);if(cand.length<4)return{group:[seed],cand:cand.length,extent:1,safe:false};
 const ds0=cand.map(v=>diag(v.bbox)).filter(Boolean),md=med(ds0),tol=Math.max(.7,Math.min(sd,md)*.42),cell=Math.max(.7,tol),grid=new Map(),key=(x,y)=>Math.floor(x/cell)+','+Math.floor(y/cell),put=(pt,i)=>{const k=key(pt[0],pt[1]);let a=grid.get(k);if(!a)grid.set(k,a=[]);a.push(i)};
 for(let i=0;i<cand.length;i++){put(cand[i].first,i);put(cand[i].last,i)}
 const idx=new Map(cand.map((v,i)=>[v,i])),start=idx.get(seed),seen=new Set([start]),q=[start],deg=new Map();
 while(q.length){const i=q.shift(),v=cand[i],ends=[v.first,v.last];for(const ep of ends){const cx=Math.floor(ep[0]/cell),cy=Math.floor(ep[1]/cell);for(let gx=cx-1;gx<=cx+1;gx++)for(let gy=cy-1;gy<=cy+1;gy++)for(const j of grid.get(gx+','+gy)||[]){if(j===i)continue;const u=cand[j],mind=Math.min(Math.hypot(ep[0]-u.first[0],ep[1]-u.first[1]),Math.hypot(ep[0]-u.last[0],ep[1]-u.last[1]));if(mind>tol)continue;deg.set(i,(deg.get(i)||0)+1);deg.set(j,(deg.get(j)||0)+1);if(!seen.has(j)){seen.add(j);q.push(j)}}}}
 const group=[...seen].map(i=>cand[i]),ds=group.map(v=>diag(v.bbox)).filter(Boolean),gm=med(ds),extent=gm?diag(componentBox(group))/gm:0,degVals=group.map(v=>deg.get(idx.get(v))||0),branchy=degVals.filter(d=>d>5).length/Math.max(1,degVals.length),sameColor=group.filter(v=>colorDist(redTopRgb(v),redTopRgb(seed))<=.05).length/Math.max(1,group.length),safe=group.length>=8&&extent>=3.4&&branchy<=.12&&sameColor>=.94;
 return{group,cand:cand.length,extent,branchy,safe,tol}
}
'''
s=s[:pos]+block+s[pos:]
old="let best=null,bd=Infinity,blackHit=null,blackBd=Infinity;const pad=15/Math.max(.1,baseRs*zoom);for(const s of classicVisual){if(x<s.bbox[0]-pad||x>s.bbox[2]+pad||y<s.bbox[1]-pad||y>s.bbox[3]+pad)continue;const d=distance(s,x,y);if(d<bd){bd=d;best=s}if(isNearBlackStroke(s)&&d<blackBd){blackBd=d;blackHit=s}}const tol=14/Math.max(.1,baseRs*zoom);if(!best||bd>tol){status.textContent='No encontré un trazo visual suficientemente cerca.';return}let prefBroad=null,prefGroups=null,prefSeed=null;if(!isNearBlackStroke(best)&&blackHit&&blackBd<=tol){"
new="let best=null,bd=Infinity,blackHit=null,blackBd=Infinity,redHits=[];const pad=15/Math.max(.1,baseRs*zoom);for(const s of classicVisual){if(x<s.bbox[0]-pad||x>s.bbox[2]+pad||y<s.bbox[1]-pad||y>s.bbox[3]+pad)continue;const d=distance(s,x,y);if(d<bd){bd=d;best=s}if(isNearBlackStroke(s)&&d<blackBd){blackBd=d;blackHit=s}if(redTopPiece(s))redHits.push({s,d})}const tol=14/Math.max(.1,baseRs*zoom);if(!best||bd>tol){status.textContent='No encontré un trazo visual suficientemente cerca.';return}let prefRedTop=null,redTopInfo=null,redTopSeed=null,prefBroad=null,prefGroups=null,prefSeed=null;const switchTol=Math.max(2/Math.max(.1,baseRs*zoom),tol*.7),eligibleRed=redHits.filter(q=>q.d<=Math.max(bd+switchTol,switchTol*1.4));if(eligibleRed.length){eligibleRed.sort((a,b)=>Number(b.s._ordinal)-Number(a.s._ordinal)||a.d-b.d);redTopSeed=eligibleRed[0].s;redTopInfo=redTopComponent(redTopSeed);if(redTopInfo.safe){best=redTopSeed;bd=eligibleRed[0].d;prefRedTop=redTopInfo.group}}if(!prefRedTop&&!isNearBlackStroke(best)&&blackHit&&blackBd<=tol){"
assert old in s
s=s.replace(old,new,1)
old2="let famVisual=[];if(blackSeed){"
assert old2 in s
s=s.replace(old2,"let famVisual=[];if(prefRedTop){famVisual=prefRedTop}else if(blackSeed){",1)
old3="status.textContent='Selección acumulada · familias='+selectionFamilies+' · resaltados='+visualSelected.length+' · grupos≈'+vg+' · expansión por componente · azul listo · correspondencia estructural se calculará al pulsar Eliminar · Ctrl/Shift+clic añade otro tipo'+(blackSeed?"
assert old3 in s
s=s.replace(old3,"status.textContent='Selección acumulada · familias='+selectionFamilies+' · resaltados='+visualSelected.length+' · grupos≈'+vg+' · expansión por componente · azul listo · correspondencia estructural se calculará al pulsar Eliminar · Ctrl/Shift+clic añade otro tipo'+(prefRedTop?' · DBG redTop=1 seed='+prefRedTop.length+' cand='+(redTopInfo?.cand||0)+' extent='+(redTopInfo?.extent||0).toFixed(2)+' rgb='+dbgRgb:(redTopSeed?' · DBG redTop=0 cand='+(redTopInfo?.cand||0)+' seed='+(redTopInfo?.group?.length||1)+' extent='+(redTopInfo?.extent||0).toFixed(2)+' rgb='+dbgRgb:(blackSeed?",1)
tail="' · DBG blackSeed=0 rgb='+dbgRgb)}"
assert tail in s
s=s.replace(tail,"' · DBG blackSeed=0 rgb='+dbgRgb)))}",1)
if 'flatmem20' in h:h=h.replace('flatmem20','flatmem36',1)
else:h=h.replace('selector-nubes-multistream-core.html?v=', 'selector-nubes-multistream-core.html?v=20260908-flatmem36-',1)
p.write_text(s);w.write_text(h)
