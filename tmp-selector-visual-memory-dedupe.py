from pathlib import Path
p=Path('selector-nubes-multistream-core.html')
s=p.read_text()

# 1) Validate the direct byte-for-byte base copy once per deletion operation, not once per route.
needle="const outBase=new Uint8Array(activeBytes),errors=[];let firstMismatchDiagnostic='',causalDiagnostic='';"
repl="""const outBase=new Uint8Array(activeBytes),errors=[];let firstMismatchDiagnostic='',causalDiagnostic='';
// The opened baseline is identical for every route. Validate its visual order once, then release it.
let baselineCheckDoc=null,baselineCheckPage=null;
try{
 baselineCheckDoc=mupdf.PDFDocument.openDocument(outBase,'application/pdf');baselineCheckPage=baselineCheckDoc.loadPage(0);const baseOnce=collectVisual(baselineCheckPage);
 if(baseOnce.length!==beforeVisual)throw new Error('la copia directa no reproduce el mismo número de trazos visuales ('+beforeVisual+' → '+baseOnce.length+')');
 for(let bi=0;bi<beforeVisual;bi++)if(sig(baseOnce[bi])!==sig(classicVisual[bi]))throw new Error('la copia directa cambió el orden/firma visual en el trazo '+bi);
}finally{try{baselineCheckPage?.destroy?.()}catch(_){}try{baselineCheckDoc?.destroy?.()}catch(_){}}
await uiYield();"""
assert needle in s, 'outBase marker not found'
s=s.replace(needle,repl,1)

# 2) Remove per-route baseline collectVisual/signature arrays; keep the per-route deep structural remap.
old="async function attempt(selectedIdx,number,saveMode){let work=null,wp=null,check=null,cp=null;try{work=mupdf.PDFDocument.openDocument(outBase,'application/pdf');wp=work.loadPage(0);const baselineVisual=collectVisual(wp),wm=deepModel(wp);if(baselineVisual.length!==beforeVisual)throw new Error('la copia directa no reproduce el mismo número de trazos visuales ('+beforeVisual+' → '+baselineVisual.length+')');const baselineSigs=baselineVisual.map(sig),activeSigs=classicVisual.map(sig);for(let bi=0;bi<beforeVisual;bi++)if(baselineSigs[bi]!==activeSigs[bi])throw new Error('la copia directa cambió el orden/firma visual en el trazo '+bi);const selectedSet=new Set(selectedOrdinals),localExpected=new Map();for(let bi=0;bi<baselineVisual.length;bi++){if(selectedSet.has(bi))continue;const k=baselineSigs[bi];localExpected.set(k,(localExpected.get(k)||0)+1)}const localBagOK=a=>{if(a.length!==beforeVisual-selectedVisual)return false;const b=new Map();for(const v of a){const k=sig(v);b.set(k,(b.get(k)||0)+1)}if(b.size!==localExpected.size)return false;for(const[k,n]of localExpected)if(b.get(k)!==n)return false;return true};if(!wm||wm.incomplete||wm.strokes.length!==beforeStruct)throw new Error('el modelo profundo de la copia no coincide con el modelo activo');"
new="async function attempt(selectedIdx,number,saveMode){let work=null,wp=null,check=null,cp=null;try{work=mupdf.PDFDocument.openDocument(outBase,'application/pdf');wp=work.loadPage(0);let wm=deepModel(wp);if(!wm||wm.incomplete||wm.strokes.length!==beforeStruct)throw new Error('el modelo profundo de la copia no coincide con el modelo activo');"
assert old in s, 'attempt baseline block not found'
s=s.replace(old,new,1)

# 3) Preserve the exact shared-XObject rule using counts instead of retaining every stroke object in arrays.
old2="const selectedBySource=new Map(),allBySource=new Map();for(const t of targets)(selectedBySource.get(t.sourceKey)||selectedBySource.set(t.sourceKey,[]).get(t.sourceKey)).push(t);for(const q of wm.strokes)(allBySource.get(q.sourceKey)||allBySource.set(q.sourceKey,[]).get(q.sourceKey)).push(q);for(const[k,a]of selectedBySource){const all=allBySource.get(k)||[];if(a.length!==all.length)throw new Error('XObject compartido: un operador candidato también produce geometría no seleccionada')}const byRef=strokeEditGroups(targets);applyStrokeGroups(byRef);const touched=byRef.size;if(!touched)throw new Error('no se encontró ningún stream editable');wp.destroy?.();wp=work.loadPage(0);const previewVisual=collectVisual(wp);if(!localBagOK(previewVisual)){"
new2="const selectedBySource=new Map(),allBySourceCount=new Map();for(const t of targets)selectedBySource.set(t.sourceKey,(selectedBySource.get(t.sourceKey)||0)+1);for(const q of wm.strokes)allBySourceCount.set(q.sourceKey,(allBySourceCount.get(q.sourceKey)||0)+1);for(const[k,n]of selectedBySource)if(n!==(allBySourceCount.get(k)||0))throw new Error('XObject compartido: un operador candidato también produce geometría no seleccionada');const byRef=strokeEditGroups(targets);applyStrokeGroups(byRef);const touched=byRef.size;if(!touched)throw new Error('no se encontró ningún stream editable');wm=null;wp.destroy?.();wp=null;await uiYield();wp=work.loadPage(0);let previewVisual=collectVisual(wp);if(!bagOK(previewVisual)){"
assert old2 in s, 'shared source / preview block not found'
s=s.replace(old2,new2,1)

# 4) Diagnostics use the already-active visual model; no duplicate baseline arrays are needed.
old3="if(!firstMismatchDiagnostic){const baseBag=new Map(),afterBag=new Map(),blueBag=new Map();for(const k of baselineSigs)baseBag.set(k,(baseBag.get(k)||0)+1);for(const v of previewVisual){const k=sig(v);afterBag.set(k,(afterBag.get(k)||0)+1)}for(const oi of selectedOrdinals){const k=baselineSigs[oi];blueBag.set(k,(blueBag.get(k)||0)+1)}"
new3="if(!firstMismatchDiagnostic){const baseBag=new Map(),afterBag=new Map(),blueBag=new Map();for(const v of classicVisual){const k=sig(v);baseBag.set(k,(baseBag.get(k)||0)+1)}for(const v of previewVisual){const k=sig(v);afterBag.set(k,(afterBag.get(k)||0)+1)}for(const oi of selectedOrdinals){const k=sig(classicVisual[oi]);blueBag.set(k,(blueBag.get(k)||0)+1)}"
assert old3 in s, 'diagnostic baseline block not found'
s=s.replace(old3,new3,1)
s=s.replace("' · visual antes/después='+baselineVisual.length+'/'+previewVisual.length", "' · visual antes/después='+beforeVisual+'/'+previewVisual.length", 1)

# 5) On a successful visual comparison, release the huge visual array before deep structural verification.
old4="throw new Error('antes de guardar, la geometría editada no coincide exactamente con la copia base menos azul')}const previewModel=deepModel(wp);if(!previewModel||previewModel.incomplete||previewModel.strokes.length!==beforeStruct-selectedIdx.length)throw new Error('antes de guardar, el modelo estructural no equivale a original menos operadores seleccionados');const previewRaster=await rasterDigest(wp);"
new4="throw new Error('antes de guardar, la geometría editada no coincide exactamente con la copia base menos azul')}previewVisual=null;await uiYield();let previewModel=deepModel(wp);if(!previewModel||previewModel.incomplete||previewModel.strokes.length!==beforeStruct-selectedIdx.length)throw new Error('antes de guardar, el modelo estructural no equivale a original menos operadores seleccionados');previewModel=null;await uiYield();const previewRaster=await rasterDigest(wp);"
assert old4 in s, 'preview deep model block not found'
s=s.replace(old4,new4,1)

# 6) Give the browser a collection point after each failed heavy attempt before constructing the next 430k-item model.
old5="}catch(e){errors.push('vía rápida correspondencia '+(i+1)+' · guardado incremental · '+e.message)}\n }"
new5="}catch(e){errors.push('vía rápida correspondencia '+(i+1)+' · guardado incremental · '+e.message);await uiYield()}\n }"
assert old5 in s, 'fast catch block not found'
s=s.replace(old5,new5,1)
old6="}catch(e){errors.push('correspondencia '+(i+1)+' · guardado '+label+' · '+e.message)}}"
new6="}catch(e){errors.push('correspondencia '+(i+1)+' · guardado '+label+' · '+e.message);await uiYield()}}"
assert old6 in s, 'final catch block not found'
s=s.replace(old6,new6,1)

# Safety/invariant checks: no mapping, multi-stream, causal, or final raster gate is removed.
for token in [
 "const bagOK=",
 "strokeEditRanges",
 "Búsqueda causal dirigida",
 "afterRaster!==previewRaster",
 "remapStructTargets(activeTargets,wm)",
 "XObject compartido: un operador candidato también produce geometría no seleccionada",
 "const routes=[],keys=new Set()"
]: assert token in s, token
assert 'baselineVisual=collectVisual(wp)' not in s[s.index('async function attempt(selectedIdx'):s.index(" const saveModes=['incremental',''];")]
p.write_text(s)
print('patched visual memory dedupe safely')
