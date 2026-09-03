from pathlib import Path
import re
p=Path('selector-nubes-multistream-core.html')
s=p.read_text(encoding='utf-8')
# Add a model-keyed stroke index cache. It cannot alter candidate ordering or scores.
needle="const uiYield=()=>new Promise(r=>setTimeout(r,0));"
insert="""let strokeIndexCache=null;
function strokeIndexOf(s){
 if(!model?.strokes)return -1;
 if(!strokeIndexCache||strokeIndexCache.model!==model){const byObject=new WeakMap();for(let i=0;i<model.strokes.length;i++){const x=model.strokes[i];if(x&&typeof x==='object')byObject.set(x,i)}strokeIndexCache={model,byObject}}
 return s&&typeof s==='object'?(strokeIndexCache.byObject.get(s)??-1):-1
}
const uiYield=()=>new Promise(r=>setTimeout(r,0));"""
if s.count(needle)!=1: raise SystemExit('uiYield anchor mismatch')
s=s.replace(needle,insert,1)
# routeKey is called repeatedly while building alternatives.
old="function routeKey(a){return a?.map(x=>model.strokes.indexOf(x)).join(',')||''}"
new="function routeKey(a){return a?.map(strokeIndexOf).join(',')||''}"
if s.count(old)!=1: raise SystemExit('routeKey anchor mismatch')
s=s.replace(old,new,1)
# Exact verifier expected-bag construction: Set lookup instead of O(page*selection) includes.
old="let expected=new Map();for(const v of classicVisual){if(visualSelected.includes(v))continue;const k=sig(v);expected.set(k,(expected.get(k)||0)+1)}"
new="const selectedVisualSet=new Set(visualSelected);let expected=new Map();for(const v of classicVisual){if(selectedVisualSet.has(v))continue;const k=sig(v);expected.set(k,(expected.get(k)||0)+1)}"
if s.count(old)!=1: raise SystemExit('expected bag anchor mismatch')
s=s.replace(old,new,1)
# Route materialization also used repeated linear indexOf.
old="const idx=r.map(x=>model.strokes.indexOf(x));"
new="const idx=r.map(strokeIndexOf);"
if s.count(old)<1: raise SystemExit('route materialization anchor missing')
s=s.replace(old,new)
# Cache invalidation is automatic by model identity; explicitly clear on the common reset for memory release.
s=s.replace('model=null;analysisReady=false;setButtons();','model=null;strokeIndexCache=null;analysisReady=false;setButtons();')
p.write_text(s,encoding='utf-8')
