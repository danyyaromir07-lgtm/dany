from pathlib import Path
import re
src=Path('selector-nubes-fluido-v2-core.html').read_text()
start=src.index("const uiYield=()=>new Promise(r=>setTimeout(r,0));")
end=src.index("function setButtons()",start)
new=r'''const uiYield=()=>new Promise(r=>setTimeout(r,0));
async function mapBlueResponsive(vs,blocked=[]){
 if(!model?.strokes?.length||model.incomplete)return{items:[],alternatives:[],mode:model?.incomplete?'modelo interno incompleto':'sin modelo estructural'};
 if(!vs.length)return{items:[],alternatives:[],mode:'sin selección'};
 const used=new Set(blocked),m=model.strokes.length;
 if(m<vs.length+used.size)return{items:[],alternatives:[],mode:'menos operadores estructurales que trazos azules'};
 if(vs.length<180){await uiYield();return mapBlue(vs,blocked)}
 const maxK=Math.min(m,Math.max(320,Math.ceil(vs.length*1.22)+48));
 const passes=[128,256,512,maxK].filter((k,i,a)=>k<=m&&a.indexOf(k)===i);
 for(let pi=0;pi<passes.length;pi++){
  const K=passes[pi],lists=[];
  status.textContent='Preparando borrado exacto · mapeo global '+K+' candidatos · 0/'+vs.length+'…';await uiYield();
  for(let vi=0;vi<vs.length;vi++){
   const v=vs[vi],best=[];
   for(let si=0;si<m;si++){
    const st=model.strokes[si];if(used.has(st)||st?.editable===false)continue;
    const c=alignCost(v,st);if(Number.isFinite(c))best.push({idx:si,s:st,score:c});
   }
   best.sort((a,b)=>a.score-b.score);const keep=best.slice(0,K);if(!keep.length){lists.length=0;break}lists.push(keep);
   if(vi%4===3||vi===vs.length-1){status.textContent='Preparando borrado exacto · mapeo global '+K+' candidatos · '+(vi+1)+'/'+vs.length+'…';await uiYield()}
  }
  if(lists.length!==vs.length)continue;
  const order=lists.map((a,i)=>({i,n:a.length,margin:(a[1]?.score??99)-a[0].score,best:a[0].score})).sort((x,y)=>x.n-y.n||y.margin-x.margin||x.best-y.best),owner=new Map(),chosen=new Array(vs.length);
  function place(vi,seen){for(const c of lists[vi]){if(seen.has(c.idx))continue;seen.add(c.idx);const old=owner.get(c.idx);if(old==null||place(old,seen)){owner.set(c.idx,vi);chosen[vi]=c;return true}}return false}
  let ok=true;
  for(let oi=0;oi<order.length;oi++){
   if(!place(order[oi].i,new Set())){ok=false;break}
   if(oi%4===3||oi===order.length-1){status.textContent='Preparando borrado exacto · asignación global '+K+' candidatos · '+(oi+1)+'/'+order.length+'…';await uiYield()}
  }
  if(ok&&chosen.every(Boolean)&&new Set(chosen.map(x=>x.idx)).size===vs.length){const route=chosen.map(x=>x.s);return{items:route,alternatives:[route],mode:'asignación global fluida '+K+' · '+vs.length+'/'+vs.length}}
  await uiYield();
 }
 return{items:[],alternatives:[],mode:'sin asignación global 1:1 completa'}
}
'''
src=src[:start]+new+src[end:]
src=src.replace("tested++;if(label&&tested%12===0)status.textContent=label+' · '+tested+' pruebas causales · coincidencias 1:1='+oneToOne+'…';return result", "tested++;if(label&&tested%8===0){status.textContent=label+' · '+tested+' pruebas causales · coincidencias 1:1='+oneToOne+'…';await uiYield()}return result")
src=src.replace("if(offTests%20===0)status.textContent='Aislando azul · localizando la única pareja incorrecta…'", "if(offTests%12===0){status.textContent='Aislando azul · localizando la única pareja incorrecta…';await uiYield()}")
src=src.replace("if(rootTests%25===0)status.textContent='Borrado exacto · buscando el último azul en streams de página '+rootTests+'/'+rootRanked.length+'…'", "if(rootTests%12===0){status.textContent='Borrado exacto · buscando el último azul en streams de página '+rootTests+'/'+rootRanked.length+'…';await uiYield()}")
Path('selector-nubes-global-fluido-core.html').write_text(src)
wrap=Path('selector-nubes-fluido-v2.html').read_text().replace('Selector de nubes · selección rápida y borrado fluido exacto v2','Selector de nubes · selección rápida y mapeo global fluido').replace('./selector-nubes-fluido-v2-core.html?v=20260903-fluiddelete2','./selector-nubes-global-fluido-core.html?v=20260903-globalasync1')
Path('selector-nubes-global-fluido.html').write_text(wrap)
m=re.search(r'<script type="module">(.*?)</script>',src,re.S)
if not m: raise SystemExit('module script not found')
Path('/tmp/selector-nubes-global-fluido.mjs').write_text(m.group(1))
