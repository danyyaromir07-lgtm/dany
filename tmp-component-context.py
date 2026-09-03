from pathlib import Path
import re
p=Path('selector-nubes-multistream-core.html')
s=p.read_text()
insert=r'''function annotateVisualComponents(a){
 const n=a.length,p=Array.from({length:n},(_,i)=>i),f=i=>p[i]===i?i:(p[i]=f(p[i])),u=(i,j)=>{i=f(i);j=f(j);if(i!==j)p[j]=i};
 const gap=(A,B)=>{const dx=Math.max(0,A[0]-B[2],B[0]-A[2]),dy=Math.max(0,A[1]-B[3],B[1]-A[3]);return Math.hypot(dx,dy)};
 for(let i=0;i<n;i++){const x=a[i],dx=Math.max(.001,diag(x.bbox));for(let j=i+1;j<n;j++){const y=a[j];if(colorDist(x.rgb,y.rgb)>.03)continue;const wt=Math.max(.05,Math.max(Math.abs(x.width||0),Math.abs(y.width||0))*.18);if(Math.abs((x.width||0)-(y.width||0))>wt)continue;if((x.curves>0)!==(y.curves>0)||(x.lines>0)!==(y.lines>0))continue;const dy=Math.max(.001,diag(y.bbox)),tol=Math.max(.28,Math.min(dx,dy)*.09);if(gap(x.bbox,y.bbox)>tol)continue;const X=[x.first,x.last].filter(Boolean),Y=[y.first,y.last].filter(Boolean);if(X.some(q=>Y.some(r=>Math.hypot(q[0]-r[0],q[1]-r[1])<=tol)))u(i,j)}}
 const g=new Map();for(let i=0;i<n;i++){const r=f(i);if(!g.has(r))g.set(r,[]);g.get(r).push(i)}
 for(const ids of g.values()){let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(const i of ids){const b=a[i].bbox;x0=Math.min(x0,b[0]);y0=Math.min(y0,b[1]);x1=Math.max(x1,b[2]);y1=Math.max(y1,b[3])}const cd=Math.hypot(x1-x0,y1-y0);for(const i of ids){a[i]._ctxSize=ids.length;a[i]._ctxDiag=cd}}
}
function componentCompatible(x,s){const ss=Math.max(1,s._ctxSize||1),xs=Math.max(1,x._ctxSize||1);if(ss>=6){if(xs<Math.max(4,Math.floor(ss*.45))||xs>Math.ceil(ss*2.2))return false;const sd=Math.max(.001,s._ctxDiag||diag(s.bbox)),xd=Math.max(.001,x._ctxDiag||diag(x.bbox)),r=xd/sd;if(r<.48||r>2.1)return false}else if(ss>=3&&xs===1)return false;return true}
'''
pat=r'function distSeg\(px,py,a,b\)\{'
if not re.search(pat,s): raise SystemExit('distSeg anchor missing')
s=re.sub(pat,insert+'function distSeg(px,py,a,b){',s,count=1)
old='classicVisual=collectVisual(p);for(let i=0;i<classicVisual.length;i++)classicVisual[i]._ordinal=i;'
new='classicVisual=collectVisual(p);annotateVisualComponents(classicVisual);for(let i=0;i<classicVisual.length;i++)classicVisual[i]._ordinal=i;'
if old not in s: raise SystemExit('renderPage anchor missing')
s=s.replace(old,new,1)
old='const famVisual=classicVisual.filter(v=>similar(v,best))'
new='const famVisual=classicVisual.filter(v=>similar(v,best)&&componentCompatible(v,best))'
if old not in s: raise SystemExit('chooseClassic anchor missing')
s=s.replace(old,new,1)
p.write_text(s)
print('component-context selection added')
