from pathlib import Path
import re
p=Path('selector-nubes-multistream-core.html')
s=p.read_text(encoding='utf-8')
pat=r"const uiYield=\(\)=>new Promise\(r=>setTimeout\(r,0\)\);\nasync function mapBlueResponsive\(vs,blocked=\[\]\)\{.*?\n\}\nfunction setButtons\(\)"
new=r'''const uiYield=()=>new Promise(r=>setTimeout(r,0));
let structIndexCache=null;
function structTopoKey(s){return (s?.curves>0?'C':'')+(s?.lines>0?'L':'')}
function structSegBand(n){n=Math.max(0,Number(n||0));return n<=12?String(Math.round(n)):'L'+Math.round(Math.log2(n+1)*3)}
function structCoarseKey(s){const rgb=s?.rgb||[],cq=i=>Math.round(Number(rgb[i]||0)*16),wq=Math.round(Math.abs(Number(s?.width||0))*16);return structTopoKey(s)+'|'+structSegBand(s?.segs)+'|'+cq(0)+','+cq(1)+','+cq(2)+'|'+wq}
function buildStructIndex(){if(structIndexCache?.model===model)return structIndexCache;const exact=new Map(),shape=new Map(),m=model?.strokes?.length||0;for(let i=0;i<m;i++){const s=model.strokes[i];if(!s||s.editable===false)continue;const ek=structCoarseKey(s),sk=structTopoKey(s)+'|'+structSegBand(s.segs);if(!exact.has(ek))exact.set(ek,[]);exact.get(ek).push(i);if(!shape.has(sk))shape.set(sk,[]);shape.get(sk).push(i)}return structIndexCache={model,exact,shape}}
function nearestOrdinalCandidates(arr,targetIdx,take){if(!arr?.length)return[];let lo=0,hi=arr.length;while(lo<hi){const mid=(lo+hi)>>1;if(arr[mid]<targetIdx)lo=mid+1;else hi=mid}let a=lo-1,b=lo,out=[];while(out.length<take&&(a>=0||b<arr.length)){if(a<0)out.push(arr[b++]);else if(b>=arr.length)out.push(arr[a--]);else if(Math.abs(arr[a]-targetIdx)<=Math.abs(arr[b]-targetIdx))out.push(arr[a--]);else out.push(arr[b++])}return out}
async function mapBlueResponsive(vs,blocked=[]){
 if(!model?.strokes?.length||model.incomplete)return{items:[],alternatives:[],mode:model?.incomplete?'modelo interno incompleto':'sin modelo estructural'};
 if(!vs.length)return{items:[],alternatives:[],mode:'sin selección'};
 const used=new Set(blocked),m=model.strokes.length,n=Math.max(1,classicVisual.length);
 if(m<vs.length+used.size)return{items:[],alternatives:[],mode:'menos operadores estructurales que trazos azules'};
 if(m<6000&&vs.length<220){await uiYield();return mapBlue(vs,blocked)}
 const ix=buildStructIndex(),passes=[48,112,240],lastProgress={t:0};
 async function pulse(text,force=false){const now=performance.now();if(force||now-lastProgress.t>=120){lastProgress.t=now;status.textContent=text;await new Promise(r=>requestAnimationFrame(()=>setTimeout(r,0)))}}
 for(let pi=0;pi<passes.length;pi++){
  const take=passes[pi],lists=[];await pulse('Preparando borrado exacto · índice estructural '+take+' candidatos locales…',true);
  for(let vi=0;vi<vs.length;vi++){
   const v=vs[vi],target=Math.max(0,Math.min(m-1,Math.round(((Number(v._ordinal||0)+.5)/n)*m-.5))),ek=structCoarseKey(v),sk=structTopoKey(v)+'|'+structSegBand(v.segs),primary=ix.exact.get(ek)||[],secondary=ix.shape.get(sk)||[];
   let ids=nearestOrdinalCandidates(primary,target,take);if(ids.length<Math.min(16,take)){const seen=new Set(ids);for(const q of nearestOrdinalCandidates(secondary,target,take*2)){if(!seen.has(q)){seen.add(q);ids.push(q)}if(ids.length>=take*2)break}}
   const best=[];for(const si of ids){const st=model.strokes[si];if(used.has(st)||st?.editable===false)continue;const c=alignCost(v,st);if(Number.isFinite(c))best.push({idx:si,s:st,score:c+Math.abs(si-target)/Math.max(1,m)*.35})}
   best.sort((a,b)=>a.score-b.score);const keep=best.slice(0,take);if(!keep.length){lists.length=0;break}lists.push(keep);
   await pulse('Preparando borrado exacto · índice estructural '+take+' · '+(vi+1)+'/'+vs.length+' trazos…')
  }
  if(lists.length!==vs.length)continue;
  const order=lists.map((a,i)=>({i,n:a.length,margin:(a[1]?.score??99)-a[0].score,best:a[0].score})).sort((x,y)=>x.n-y.n||y.margin-x.margin||x.best-y.best),owner=new Map(),chosen=new Array(vs.length);
  function place(vi,seen){for(const c of lists[vi]){if(seen.has(c.idx))continue;seen.add(c.idx);const old=owner.get(c.idx);if(old==null||place(old,seen)){owner.set(c.idx,vi);chosen[vi]=c;return true}}return false}
  let ok=true;for(let oi=0;oi<order.length;oi++){if(!place(order[oi].i,new Set())){ok=false;break}await pulse('Preparando borrado exacto · asignación indexada '+take+' · '+(oi+1)+'/'+order.length+'…')}
  if(ok&&chosen.every(Boolean)&&new Set(chosen.map(x=>x.idx)).size===vs.length){const route=chosen.map(x=>x.s);await pulse('Correspondencia indexada lista · verificando resultado exacto…',true);return{items:route,alternatives:[route],mode:'índice ordinal-estructural '+take+' · '+vs.length+'/'+vs.length}}
 }
 const prop=proportionalRoute(vs,blocked);if(prop?.length===vs.length){await pulse('Índice sin asignación completa · probando ruta ordinal de respaldo con verificación exacta…',true);return{items:prop,alternatives:[prop],mode:'ruta ordinal de respaldo verificada'}}
 return{items:[],alternatives:[],mode:'sin correspondencia estructural indexada completa'}
}
function setButtons()'''
ns,n=re.subn(pat,new,s,flags=re.S)
if n!=1:
    if 'function buildStructIndex()' in s:
        raise SystemExit(0)
    raise SystemExit(f'mapBlueResponsive patch count={n}')
ns=ns.replace('model=null;analysisReady=false;setButtons();','model=null;structIndexCache=null;analysisReady=false;setButtons();',1)
p.write_text(ns,encoding='utf-8')
