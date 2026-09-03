from pathlib import Path
import re
src=Path('selector-nubes-rapido-core.html').read_text()
marker="function setButtons(){const has=!!doc;$('#select').disabled=!has;$('#delete').disabled=!has||!visualSelected.length||!!model?.incomplete;$('#save').disabled=!handle||!pending}"
helper=r'''const uiYield=()=>new Promise(r=>setTimeout(r,0));
async function mapBlueResponsive(vs,blocked=[]){
 if(vs.length<180){await uiYield();return mapBlue(vs,blocked)}
 const used=new Set(blocked),n=classicVisual.length,m=model.strokes.length;
 if(m<vs.length+used.size)return{items:[],alternatives:[],mode:'menos operadores estructurales que trazos azules'};
 const passes=[
  {k:72,w:Math.max(90,Math.ceil(m*.025)),name:'rápida'},
  {k:160,w:Math.max(140,Math.ceil(m*.05)),name:'ampliada'},
  {k:Math.min(m,Math.max(280,Math.ceil(vs.length*.42))),w:Math.max(220,Math.ceil(m*.08)),name:'profunda'},
  {k:Math.min(m,Math.max(520,Math.ceil(vs.length*.78))),w:Math.max(320,Math.ceil(m*.12)),name:'máxima'}
 ];
 for(let pi=0;pi<passes.length;pi++){
  const pass=passes[pi],K=pass.k,window=pass.w,layers=[];
  status.textContent='Preparando borrado exacto · correspondencia '+pass.name+' · 0/'+vs.length+'…';await uiYield();
  let broken=false;
  for(let vi=0;vi<vs.length;vi++){
   const v=vs[vi],target=(Number(v._ordinal||0)+.5)/Math.max(1,n),anchor=Math.max(0,Math.min(m-1,Math.round(target*m-.5))),best=[],seen=new Set();
   const add=si=>{if(si<0||si>=m||seen.has(si))return;seen.add(si);const st=model.strokes[si];if(used.has(st)||st?.editable===false)return;const c=alignCost(v,st);if(!Number.isFinite(c))return;const order=Math.abs(target-(si+.5)/Math.max(1,m));best.push({s:st,idx:si,score:c+order*.55})};
   for(let si=Math.max(0,anchor-window);si<=Math.min(m-1,anchor+window);si++)add(si);
   if(best.length<K){const step=Math.max(1,Math.floor(m/Math.max(360,K*2)));for(let si=0;si<m&&best.length<K*2;si+=step)add(si)}
   best.sort((a,b)=>a.score-b.score);const keep=best.slice(0,K).sort((a,b)=>a.idx-b.idx);if(!keep.length){broken=true;break}layers.push(keep);
   if(vi%8===7||vi===vs.length-1){status.textContent='Preparando borrado exacto · correspondencia '+pass.name+' · '+(vi+1)+'/'+vs.length+'…';await uiYield()}
  }
  if(broken||layers.length!==vs.length)continue;
  const states=[layers[0].map(c=>({cost:c.score,prev:-1}))];
  for(let li=1;li<layers.length;li++){
   const A=layers[li-1],B=layers[li],pv=states[li-1],cur=new Array(B.length);let bc=Infinity,bi=-1,p=0;
   for(let j=0;j<B.length;j++){while(p<A.length&&A[p].idx<B[j].idx){if(pv[p].cost<bc){bc=pv[p].cost;bi=p}p++}cur[j]={cost:Number.isFinite(bc)?bc+B[j].score:Infinity,prev:bi}}
   states.push(cur);if(li%24===0){status.textContent='Preparando borrado exacto · enlazando '+pass.name+' · '+li+'/'+layers.length+'…';await uiYield()}
  }
  let end=-1,best=Infinity,last=states.at(-1);for(let i=0;i<last.length;i++)if(last[i].cost<best){best=last[i].cost;end=i}
  if(end>=0&&Number.isFinite(best)){
   const mono=new Array(layers.length);for(let li=layers.length-1;li>=0;li--){mono[li]=layers[li][end].s;end=states[li][end].prev}
   if(mono.every(Boolean)&&new Set(mono).size===mono.length)return{items:mono,alternatives:[mono],mode:'monotónica fluida '+pass.name+' · '+vs.length+'/'+vs.length}
  }
  await uiYield();
 }
 return{items:[],alternatives:[],mode:'sin correspondencia monotónica fluida completa'}
}
'''
if marker not in src: raise SystemExit('setButtons marker not found')
src=src.replace(marker,helper+marker,1)
old="const lazyMap=mapBlue(visualSelected,[]);"
new="const lazyMap=await mapBlueResponsive(visualSelected,[]);"
if old not in src: raise SystemExit('lazy map call not found')
src=src.replace(old,new,1)
src=src.replace('selector-nubes-rapido-core.html?v=20260903-lazymap1','selector-nubes-fluido-core.html?v=20260903-fluiddelete1')
Path('selector-nubes-fluido-core.html').write_text(src)
wrap=Path('selector-nubes-rapido.html').read_text().replace('Selector de nubes · selección rápida y borrado exacto','Selector de nubes · selección rápida y borrado fluido exacto').replace('./selector-nubes-rapido-core.html?v=20260903-lazymap1','./selector-nubes-fluido-core.html?v=20260903-fluiddelete1')
Path('selector-nubes-fluido.html').write_text(wrap)
m=re.search(r'<script type="module">(.*?)</script>',src,re.S)
if not m: raise SystemExit('module script not found')
Path('/tmp/selector-nubes-fluido.mjs').write_text(m.group(1))
