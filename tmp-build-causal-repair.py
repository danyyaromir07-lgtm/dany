from pathlib import Path
import re
src=Path('selector-nubes-causal-expand-core.html').read_text()
start=src.index('async function buildCausalRoute(){')
end=src.index('async function attempt(selectedIdx,number,saveMode)', start)
old=src[start:end]
small=old.replace("async function buildCausalRoute(){", "async function buildCausalRouteSmall(){", 1)
# The small resolver keeps its original size guard and is used only <=600.
large=r'''async function buildLargeRepairRoute(){
 const baseRoute=routes[0]?.slice();if(!baseRoute||baseRoute.length!==selectedVisual)throw new Error('no existe una ruta base completa para reparación causal');
 let cw=null,cp=null;try{
  cw=mupdf.PDFDocument.openDocument(outBase,'application/pdf');cp=cw.loadPage(0);const base=collectVisual(cp),baseSigs=base.map(sig),cm=deepModel(cp);
  if(base.length!==beforeVisual||!cm||cm.incomplete||cm.strokes.length!==beforeStruct)throw new Error('la copia de reparación no reproduce el modelo base');
  const baseBag=new Map();for(const k of baseSigs)baseBag.set(k,(baseBag.get(k)||0)+1);
  const need=new Map(),blueVisualBySig=new Map();for(const oi of selectedOrdinals){const k=baseSigs[oi];need.set(k,(need.get(k)||0)+1);(blueVisualBySig.get(k)||blueVisualBySig.set(k,[]).get(k)).push(base[oi])}
  const routeSet=new Set(baseRoute);
  function diffBags(av){const ab=new Map();for(const v of av){const k=sig(v);ab.set(k,(ab.get(k)||0)+1)}const removed=new Map(),added=new Map();for(const[k,n]of baseBag){const d=Math.max(0,n-(ab.get(k)||0));if(d)removed.set(k,d)}for(const[k,n]of ab){const d=Math.max(0,n-(baseBag.get(k)||0));if(d)added.set(k,d)}return{removed,added}}
  async function withSingleRemoval(idx){const t=cm.strokes[idx];if(!t||t.editable===false)return null;const original=latin(t.sourceRef.readStream());if(t.start<0||t.end>original.length||t.start>=t.end)return null;try{t.sourceRef.writeStream(raw(original.slice(0,t.start)+original.slice(t.end)));try{cp?.destroy?.()}catch(_){}cp=cw.loadPage(0);const d=diffBags(collectVisual(cp));if(d.added.size)return null;let total=0,key=null;for(const[k,n]of d.removed){total+=n;if(n===1)key=k}return total===1?key:null}finally{t.sourceRef.writeStream(raw(original));try{cp?.destroy?.()}catch(_){}cp=cw.loadPage(0)}}
  async function routeDiff(indices){const groups=new Map();for(const idx of indices){const t=cm.strokes[idx];if(!t||t.editable===false)throw new Error('la ruta base contiene un operador no editable');const key=deepKey(t.sourceRef);let g=groups.get(key);if(!g){g={ref:t.sourceRef,original:latin(t.sourceRef.readStream()),ranges:[]};groups.set(key,g)}g.ranges.push([t.start,t.end])}
   try{for(const g of groups.values()){let text=g.original;for(const[a,b]of g.ranges.sort((A,B)=>B[0]-A[0])){if(a<0||b>text.length||a>=b)throw new Error('rango inválido durante diagnóstico de ruta');text=text.slice(0,a)+text.slice(b)}g.ref.writeStream(raw(text))}try{cp?.destroy?.()}catch(_){}cp=cw.loadPage(0);return diffBags(collectVisual(cp))}finally{for(const g of groups.values())g.ref.writeStream(raw(g.original));try{cp?.destroy?.()}catch(_){}cp=cw.loadPage(0)}}
  status.textContent='Reparación causal · midiendo desviación exacta de la ruta base de '+selectedVisual+' operadores…';const d=await routeDiff(baseRoute);
  const missing=new Map(),extra=new Map();for(const[k,n]of need){const got=d.removed.get(k)||0;if(got<n)missing.set(k,n-got)}for(const[k,n]of d.removed){const bn=need.get(k)||0;if(n>bn)extra.set(k,n-bn)}
  let missCount=[...missing.values()].reduce((a,b)=>a+b,0),extraCount=[...extra.values()].reduce((a,b)=>a+b,0),addedCount=[...d.added.values()].reduce((a,b)=>a+b,0);
  causalDiagnostic='reparación grande · ruta='+selectedVisual+' · faltantes='+missCount+' · no azules='+extraCount+' · nuevas='+addedCount;
  if(missCount!==1||extraCount!==1||addedCount!==0)throw new Error('la desviación de la ruta grande no es una sustitución 1↔1 reparable automáticamente · '+causalDiagnostic);
  const missingSig=[...missing.keys()][0],extraSig=[...extra.keys()][0],missingV=(blueVisualBySig.get(missingSig)||[])[0],extraV=base.find(v=>sig(v)===extraSig);
  if(!missingV||!extraV)throw new Error('no pude recuperar las geometrías visuales de la pareja 1↔1');
  const offenderRank=baseRoute.map(idx=>({idx,c:alignCost(extraV,cm.strokes[idx])})).filter(x=>Number.isFinite(x.c)).sort((a,b)=>a.c-b.c);
  let offender=-1,offTests=0;for(const r of offenderRank){const k=await withSingleRemoval(r.idx);offTests++;if(k===extraSig){offender=r.idx;break}if(offTests%20===0)status.textContent='Reparación causal · buscando operador incorrecto '+offTests+'/'+offenderRank.length+'…'}
  if(offender<0)throw new Error('no se identificó causalmente cuál operador de la ruta borra el trazo no azul · '+causalDiagnostic+' · pruebas='+offTests);
  const replacementRank=[];for(let idx=0;idx<cm.strokes.length;idx++){if(routeSet.has(idx))continue;const st=cm.strokes[idx];if(!st||st.editable===false)continue;const c=alignCost(missingV,st);if(Number.isFinite(c))replacementRank.push({idx,c})}replacementRank.sort((a,b)=>a.c-b.c);
  let replacement=-1,repTests=0,maxRep=Math.min(1200,replacementRank.length);for(let z=0;z<maxRep;z++){const r=replacementRank[z],k=await withSingleRemoval(r.idx);repTests++;if(k===missingSig){replacement=r.idx;break}if(repTests%20===0)status.textContent='Reparación causal · buscando reemplazo correcto '+repTests+'/'+maxRep+'…'}
  if(replacement<0)throw new Error('no se encontró dentro de '+repTests+' candidatos un operador que elimine causalmente el azul faltante · '+causalDiagnostic);
  const repaired=baseRoute.map(i=>i===offender?replacement:i);if(new Set(repaired).size!==repaired.length)throw new Error('la ruta reparada contiene operadores duplicados');
  causalDiagnostic+=' · operador incorrecto localizado en '+offTests+' prueba(s) · reemplazo localizado en '+repTests+' prueba(s) · RUTA REPARADA 1↔1';
  return repaired;
 }finally{try{cp?.destroy?.()}catch(_){}try{cw?.destroy?.()}catch(_){}}
}
async function buildCausalRoute(){return selectedVisual>600?buildLargeRepairRoute():buildCausalRouteSmall()}
'''
s=src[:start]+small+large+src[end:]
Path('selector-nubes-causal-repair-core.html').write_text(s)
w=Path('selector-nubes-causal-expand.html').read_text()
w=w.replace('./selector-nubes-causal-expand-core.html?v=20260903-causalexpand1','./selector-nubes-causal-repair-core.html?v=20260903-causalrepair1',1)
w=w.replace('Selector de nubes · resolución causal ampliada','Selector de nubes · reparación causal 1↔1',1)
Path('selector-nubes-causal-repair.html').write_text(w)
for f in ['selector-nubes-causal-repair-core.html','selector-nubes-causal-repair.html']:
    for i,x in enumerate(re.findall(r'<script(?:\s+[^>]*)?>(.*?)</script>',Path(f).read_text(),re.S)):
        Path(f'/tmp/{Path(f).stem}-{i}.mjs').write_text(x)
