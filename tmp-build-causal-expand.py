from pathlib import Path
import re
src=Path('selector-nubes-causal-core.html').read_text()
start=src.index('async function buildCausalRoute(){')
end=src.index('async function attempt(selectedIdx,number,saveMode)', start)
new=r'''async function buildCausalRoute(){
 const pool=[],poolSet=new Set();for(const rr of routes)for(const ii of rr)if(!poolSet.has(ii)){poolSet.add(ii);pool.push(ii)}
 if(selectedVisual>600)throw new Error('selección demasiado grande para resolución causal acotada ('+selectedVisual+')');
 if(pool.length>700)throw new Error('la unión causal supera el límite seguro de 700 operadores ('+pool.length+')');
 let cw=null,cp=null;try{
  cw=mupdf.PDFDocument.openDocument(outBase,'application/pdf');cp=cw.loadPage(0);const base=collectVisual(cp),baseSigs=base.map(sig),cm=deepModel(cp);
  if(base.length!==beforeVisual||!cm||cm.incomplete||cm.strokes.length!==beforeStruct)throw new Error('la copia causal no reproduce el modelo base');
  const baseBag=new Map();for(const k of baseSigs)baseBag.set(k,(baseBag.get(k)||0)+1);
  const need=new Map(),visualBySig=new Map();for(const oi of selectedOrdinals){const k=baseSigs[oi];need.set(k,(need.get(k)||0)+1);(visualBySig.get(k)||visualBySig.set(k,[]).get(k)).push(base[oi])}
  const bySig=new Map(),testedSet=new Set();let tested=0,oneToOne=0,expanded=0;
  async function testIdx(idx,label){
   if(testedSet.has(idx))return null;testedSet.add(idx);const t=cm.strokes[idx];if(!t||t.editable===false)return null;const original=latin(t.sourceRef.readStream());if(t.start<0||t.end>original.length||t.start>=t.end)return null;
   let result=null;try{
    t.sourceRef.writeStream(raw(original.slice(0,t.start)+original.slice(t.end)));
    try{cp?.destroy?.()}catch(_){}cp=cw.loadPage(0);const av=collectVisual(cp),ab=new Map();for(const v of av){const k=sig(v);ab.set(k,(ab.get(k)||0)+1)}
    let removed=[],added=0;for(const[k,n]of baseBag){const d=Math.max(0,n-(ab.get(k)||0));for(let q=0;q<d;q++)removed.push(k)}for(const[k,n]of ab)added+=Math.max(0,n-(baseBag.get(k)||0));
    if(removed.length===1&&added===0){oneToOne++;result=removed[0];if(need.has(result))(bySig.get(result)||bySig.set(result,[]).get(result)).push(idx)}
   }finally{t.sourceRef.writeStream(raw(original));try{cp?.destroy?.()}catch(_){}cp=cw.loadPage(0)}
   tested++;if(label&&tested%12===0)status.textContent=label+' · '+tested+' pruebas causales · coincidencias 1:1='+oneToOne+'…';return result
  }
  for(const idx of pool)await testIdx(idx,'Resolución causal inicial '+pool.length+' operadores');
  const deficits=()=>{const d=new Map();for(const[k,n]of need){const have=(bySig.get(k)||[]).length;if(have<n)d.set(k,n-have)}return d};
  let missing=deficits(),initialMissing=[...missing.values()].reduce((a,b)=>a+b,0),expandBudget=700;
  if(initialMissing){
   const ranked=[];for(const[k,n]of missing){const targets=visualBySig.get(k)||[];for(let idx=0;idx<cm.strokes.length;idx++){if(poolSet.has(idx)||testedSet.has(idx))continue;const st=cm.strokes[idx];if(!st||st.editable===false)continue;let c=Infinity;for(const v of targets)c=Math.min(c,alignCost(v,st));if(Number.isFinite(c))ranked.push({k,idx,c})}}
   ranked.sort((a,b)=>a.c-b.c);const seenPair=new Set();
   for(const r of ranked){if(expanded>=expandBudget)break;missing=deficits();if(!missing.size)break;if(!missing.has(r.k))continue;const pk=r.k+'|'+r.idx;if(seenPair.has(pk))continue;seenPair.add(pk);await testIdx(r.idx,'Búsqueda causal ampliada');expanded++}
  }
  missing=deficits();const missingCount=[...missing.values()].reduce((a,b)=>a+b,0),chosen=[],used=new Set();for(const[k,n]of need){const a=(bySig.get(k)||[]).filter(i=>!used.has(i));if(a.length<n)continue;for(let q=0;q<n;q++){chosen.push(a[q]);used.add(a[q])}}
  causalDiagnostic='pool inicial='+pool.length+' · pruebas totales='+tested+' · ampliadas='+expanded+' · operadores 1:1='+oneToOne+' · cubiertos='+(selectedVisual-missingCount)+'/'+selectedVisual;
  if(missingCount)throw new Error('faltan operadores causales para '+missingCount+' trazo(s) azul(es) después de ampliar la búsqueda · '+causalDiagnostic);
  if(chosen.length!==selectedVisual||new Set(chosen).size!==chosen.length)throw new Error('la ruta causal ampliada no quedó 1:1');
  return chosen;
 }finally{try{cp?.destroy?.()}catch(_){}try{cw?.destroy?.()}catch(_){}}
}
'''
s=src[:start]+new+src[end:]
Path('selector-nubes-causal-expand-core.html').write_text(s)
w=Path('selector-nubes-causal.html').read_text()
w=w.replace('./selector-nubes-causal-core.html?v=20260903-causal1','./selector-nubes-causal-expand-core.html?v=20260903-causalexpand1',1)
w=w.replace('Selector de nubes · resolución causal','Selector de nubes · resolución causal ampliada',1)
Path('selector-nubes-causal-expand.html').write_text(w)
# syntax extraction
for f in ['selector-nubes-causal-expand-core.html','selector-nubes-causal-expand.html']:
    for i,x in enumerate(re.findall(r'<script(?:\s+[^>]*)?>(.*?)</script>',Path(f).read_text(),re.S)):
        Path(f'/tmp/{Path(f).stem}-{i}.mjs').write_text(x)
