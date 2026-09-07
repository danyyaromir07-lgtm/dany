from pathlib import Path
import re

core = Path('lab-selector-v4/selector-nubes-multistream-core.html')
index = Path('lab-selector-v4/index.html')
s = core.read_text(encoding='utf-8')

# 1) Replace the exact geometry mapper with a bounded-memory variant.
pat = re.compile(r"async function strictCompactGeomMap\(vs\)\{.*?\n return\{ok:true,targets,structOrd\}\n\}", re.S)
new_mapper = r'''async function strictCompactGeomMap(vs,allowIncomplete=false){
 if(!model?.strokes?.length||(!allowIncomplete&&model.incomplete))return{ok:false,why:model?.incomplete?'recorrido estructural incompleto':'sin índice estructural'};
 if(!vs?.length)return{ok:false,why:'sin selección azul'};
 // Memory invariant: candidate storage is capped at one index + a 0/1/2 counter per selected stroke.
 // We never retain an unbounded list of matches, even on PDFs with repeated/shared geometry.
 const cell=.5,byCell=new Map(),candCount=new Uint8Array(vs.length),candIdx=new Int32Array(vs.length);candIdx.fill(-1);
 for(let i=0;i<vs.length;i++){const[cx,cy]=compactCell(vs[i],cell);for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){const k=compactCellKey(vs[i],cx+dx,cy+dy);let a=byCell.get(k);if(!a)byCell.set(k,a=[]);a.push(i)}}
 for(let si=0;si<model.strokes.length;si++){
  const st=model.strokes[si],[cx,cy]=compactCell(st,cell),a=byCell.get(compactCellKey(st,cx,cy));
  if(a)for(const vi of a){if(candCount[vi]>=2)continue;if(compactGeomMatch(vs[vi],st)){if(candCount[vi]===0)candIdx[vi]=si;candCount[vi]++}}
  if((si&16383)===16383)await uiYield();
 }
 for(let i=0;i<vs.length;i++)if(candCount[i]!==1)return{ok:false,why:'el azul '+(i+1)+' tiene '+Number(candCount[i])+(candCount[i]>=2?' o más':'')+' candidatos estructurales exactos'};
 const structOrd=Array.from(candIdx);if(new Set(structOrd).size!==structOrd.length)return{ok:false,why:'dos trazos azules convergen en el mismo origen estructural'};
 const targets=structOrd.map(i=>model.strokes[i]),revCell=new Map(),hitCount=new Uint8Array(targets.length),hitFirst=new Int32Array(targets.length);hitFirst.fill(-1);
 for(let i=0;i<targets.length;i++){const[cx,cy]=compactCell(targets[i],cell);for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){const k=compactCellKey(targets[i],cx+dx,cy+dy);let a=revCell.get(k);if(!a)revCell.set(k,a=[]);a.push(i)}}
 for(let vi=0;vi<classicVisual.length;vi++){
  const v=classicVisual[vi],[cx,cy]=compactCell(v,cell),a=revCell.get(compactCellKey(v,cx,cy));
  if(a)for(const ti of a){if(hitCount[ti]>=2)continue;if(compactGeomMatch(v,targets[ti])){if(hitCount[ti]===0)hitFirst[ti]=vi;hitCount[ti]++}}
  if((vi&16383)===16383)await uiYield();
 }
 for(let i=0;i<targets.length;i++){const expected=Number(vs[i]._ordinal);if(hitCount[i]!==1||hitFirst[i]!==expected)return{ok:false,why:'el origen del azul '+(i+1)+' también corresponde a geometría no azul o ambigua'}}
 return{ok:true,targets,structOrd}
}'''
s, n = pat.subn(new_mapper, s, count=1)
if n != 1:
    raise SystemExit('strictCompactGeomMap patch target not found exactly once')

# 2) In partial-index mode, allow clicking delete, but mapping itself remains fail-closed.
old = "function setButtons(){const has=!!doc;$('#select').disabled=!has||!analysisReady;$('#delete').disabled=!has||!analysisReady||!visualSelected.length||!!model?.incomplete;$('#save').disabled=!handle||!pending}"
new = "function setButtons(){const has=!!doc;$('#select').disabled=!has||!analysisReady;$('#delete').disabled=!has||!analysisReady||!visualSelected.length;$('#save').disabled=!handle||!pending}"
if old not in s: raise SystemExit('setButtons target not found')
s = s.replace(old, new, 1)

# 3) Preserve structural verification, but require the same partial-coverage state before/after.
old = "if(r.incomplete){ok=false;why=why||'recorrido estructural incompleto'}"
new = "if(!!r.incomplete!==!!model.incomplete){ok=false;why=why||'cambió el estado de cobertura estructural'}"
if old not in s: raise SystemExit('verifyCompactStructure target not found')
s = s.replace(old, new, 1)

# 4) Partial-index deletion uses only bounded exact geometry; complete-index behavior remains V2.1/band14.
needle = "let targets=[],structOrd=[],mapMode='ordinal';\n if(model.strokes.length===classicVisual.length){"
replacement = "let targets=[],structOrd=[],mapMode='ordinal';\n if(model.incomplete){\n  status.textContent='Borrado exacto · índice parcial: comprobación exacta acotada para '+visualSelected.length+' trazos azules…';await uiYield();\n  const gm=await strictCompactGeomMap(visualSelected,true);if(!gm.ok){status.textContent='Borrado bloqueado sin modificar el PDF: índice parcial y '+gm.why+'. Sin alineación ordinal, causal ni aproximada.';setButtons();return}\n  targets=gm.targets;structOrd=gm.structOrd;mapMode='geometría exacta 1:1 acotada sobre índice parcial + verificación total';\n }else if(model.strokes.length===classicVisual.length){"
if needle not in s: raise SystemExit('removeGroup target not found')
s = s.replace(needle, replacement, 1)

# 5) Free the high-resolution viewport raster before the transactional copy/mapping step.
needle = "async function removeGroup(){\n if(!doc||!activeBytes||!visualSelected.length)return;const t0=performance.now();"
replacement = "async function removeGroup(){\n if(!doc||!activeBytes||!visualSelected.length)return;const t0=performance.now();clearTimeout(sharpTimer);sharpTimer=null;sharpQueued=false;clearDetail();await uiYield();"
if needle not in s: raise SystemExit('removeGroup prologue target not found')
s = s.replace(needle, replacement, 1)

core.write_text(s, encoding='utf-8')

i = index.read_text(encoding='utf-8')
i = re.sub(r"selector-nubes-multistream-core\.html\?v=[^\"']+", "selector-nubes-multistream-core.html?v=20260907-oom1", i, count=1)
index.write_text(i, encoding='utf-8')

print('v2.2 OOM guard patch applied')
