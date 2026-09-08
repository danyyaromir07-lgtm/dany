from pathlib import Path

p = Path('lab-selector-v4/selector-nubes-multistream-core.html')
w = Path('lab-selector-v4/index.html')
s = p.read_text()
h = w.read_text()

anchor = 'function blackPolylineComponentGroups(items){'
pos = s.index(anchor)
choose = s.index('\nfunction chooseClassic(e)', pos)
extra = '''
function redRgb3(v){const c=(v?.rgb||[]).slice(0,3).map(Number);return c.length>=3&&c.slice(0,3).every(Number.isFinite)?c.slice(0,3):[]}
function isRedStroke(v){const c=redRgb3(v);return c.length===3&&c[0]>=.55&&c[0]-c[1]>=.30&&c[0]-c[2]>=.30&&c[1]<=.45&&c[2]<=.45}
function redCloudPrimitive(v){if(!isRedStroke(v))return false;const c=Math.max(0,Number(v.curves||0)),l=Math.max(0,Number(v.lines||0)),n=Math.max(1,Number(v.segs||0));if(c<1||n>24)return false;return c/n>=.45&&l<=Math.max(3,c*2)}
function redCloudCompat(x,s){if(!redCloudPrimitive(x)||!redCloudPrimitive(s)||colorDist(redRgb3(x),redRgb3(s))>.055)return false;const dx=Math.max(.001,diag(x.bbox)),ds=Math.max(.001,diag(s.bbox)),dr=dx/ds;if(dr<.25||dr>4)return false;const nx=Math.max(1,Number(x.segs||0)),ns=Math.max(1,Number(s.segs||0)),nr=nx/ns;if(nr<.2||nr>5)return false;const wx=Math.abs(Number(x.width)||0),ws=Math.abs(Number(s.width)||0);if(Math.max(wx,ws)>.04){const wr=Math.max(.001,wx)/Math.max(.001,ws);if(wr<.45||wr>2.2)return false}return true}
function redCloudComponentGroups(items){if(!items.length)return[];const md=med(items.map(v=>diag(v.bbox)).filter(v=>Number.isFinite(v)&&v>0)),endTol=Math.max(.7,md*.55),boxTol=Math.max(.55,md*.38),p=items.map((_,i)=>i),f=i=>p[i]===i?i:(p[i]=f(p[i])),u=(i,j)=>{i=f(i);j=f(j);if(i!==j)p[j]=i},gap=(a,b)=>{const dx=Math.max(0,a[0]-b[2],b[0]-a[2]),dy=Math.max(0,a[1]-b[3],b[1]-a[3]);return Math.hypot(dx,dy)};for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){if(!redCloudCompat(items[i],items[j]))continue;const A=[items[i].first,items[i].last].filter(Boolean),B=[items[j].first,items[j].last].filter(Boolean),touch=A.some(a=>B.some(b=>Math.hypot(a[0]-b[0],a[1]-b[1])<=endTol));if(touch||gap(items[i].bbox,items[j].bbox)<=boxTol)u(i,j)}const m=new Map();for(let i=0;i<items.length;i++){const k=f(i);if(!m.has(k))m.set(k,[]);m.get(k).push(items[i])}return[...m.values()]}
function redCloudComponentSafe(g,seed){if(!g||g.length<5||!g.includes(seed)||g.some(v=>!redCloudPrimitive(v)))return false;const ds=g.map(v=>diag(v.bbox)).filter(v=>Number.isFinite(v)&&v>0),md=med(ds);if(!md||diag(componentBox(g))/md<3)return false;const widths=g.map(v=>Math.abs(Number(v.width)||0)),mw=med(widths);if(Math.max(...widths)-Math.min(...widths)>Math.max(.08,mw*.45))return false;const base=redRgb3(seed);if(g.filter(v=>colorDist(redRgb3(v),base)<=.055).length/g.length<.94)return false;return true}
'''
if 'function redCloudComponentSafe(' not in s:
    s = s[:choose] + extra + s[choose:]

old = "const blackSeed=isNearBlackStroke(best),blackPolyline=blackPolylineCloudSafe(best),broad=blackPolyline?classicVisual.filter(v=>blackPolylineCompat(v,best)):(prefBroad||(blackSeed?classicVisual.filter(v=>blackSeedCompat(v,best)):classicVisual.filter(v=>seedCompat(v,best)))),groups=blackPolyline?blackPolylineComponentGroups(broad):(prefGroups||(blackSeed?blackSeedComponentGroups(broad):seedComponentGroups(broad))),seed=blackPolyline?(groups.find(g=>g.includes(best))||[best]):(prefSeed||(groups.find(g=>g.includes(best))||[best]));let famVisual=[];if(blackPolyline){famVisual=seed}"
new = "const redSeedFlag=redCloudPrimitive(best),redBroad=redSeedFlag?classicVisual.filter(v=>redCloudCompat(v,best)):[],redGroups=redSeedFlag?redCloudComponentGroups(redBroad):[],redSeed=redSeedFlag?(redGroups.find(g=>g.includes(best))||[best]):[],redSafe=redSeedFlag&&redCloudComponentSafe(redSeed,best),blackSeed=isNearBlackStroke(best),blackPolyline=blackPolylineCloudSafe(best),broad=blackPolyline?classicVisual.filter(v=>blackPolylineCompat(v,best)):(prefBroad||(blackSeed?classicVisual.filter(v=>blackSeedCompat(v,best)):classicVisual.filter(v=>seedCompat(v,best)))),groups=blackPolyline?blackPolylineComponentGroups(broad):(prefGroups||(blackSeed?blackSeedComponentGroups(broad):seedComponentGroups(broad))),seed=blackPolyline?(groups.find(g=>g.includes(best))||[best]):(prefSeed||(groups.find(g=>g.includes(best))||[best]));let famVisual=[];if(redSafe){famVisual=redSeed}else if(blackPolyline){famVisual=seed}"
assert old in s, 'chooseClassic selection anchor not found'
s = s.replace(old, new, 1)

oldstat = ":' · DBG blackSeed=0 rgb='+dbgRgb)}"
newstat = ":(redSeedFlag?' · DBG red=1 redBroad='+redBroad.length+' redGroups='+redGroups.length+' redSeed='+redSeed.length+' redSafe='+(redSafe?'1':'0')+' rgb='+dbgRgb:' · DBG blackSeed=0 rgb='+dbgRgb))}"
assert oldstat in s, 'status tail anchor not found'
s = s.replace(oldstat, newstat, 1)

assert '20260907-flatmem24' in h, 'flatmem24 wrapper cache key missing'
h = h.replace('20260907-flatmem24', '20260908-flatmem25', 1)

p.write_text(s)
w.write_text(h)
