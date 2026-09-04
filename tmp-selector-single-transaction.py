from pathlib import Path
p=Path('selector-nubes-multistream-core.html')
s=p.read_text(encoding='utf-8')

old="const earlyHugeVisualCount=classicVisual.length;if(earlyHugeVisualCount>=250000){status.textContent='Borrado bloqueado sin modificar el PDF: página excepcionalmente grande ('+earlyHugeVisualCount+' trazos visuales). Para evitar otro Out of memory, esta versión no inicia deepModel, mapeo, copias ni verificaciones de borrado en páginas de este tamaño. La selección azul se conserva.';setButtons();return}if(!model){"
new="const earlyHugeVisualCount=classicVisual.length,giantSingleTransaction=earlyHugeVisualCount>=250000;if(!model){"
assert old in s, 'early OOM guard anchor not found'
s=s.replace(old,new,1)

old="if(vs.length<180){await uiYield();return mapBlue(vs,blocked)}"
new="if(vs.length<180&&classicVisual.length<250000){await uiYield();return mapBlue(vs,blocked)}"
assert old in s, 'mapBlueResponsive threshold anchor not found'
s=s.replace(old,new,1)

anchor="function restoreStrokeGroups(groups){for(const g of groups.values())if(g.original!=null)g.ref.writeStream(raw(g.original))}"
insert=r'''function restoreStrokeGroups(groups){for(const g of groups.values())if(g.original!=null)g.ref.writeStream(raw(g.original))}
function directRefIdentity(ref){const k=deepKey(ref),m=k.match(/(?:^|\s)(\d+)\s+(\d+)\s+R(?:\s|$)/);if(!m)throw new Error('referencia indirecta no estable para transacción directa: '+k);const objNum=Number(m[1]),gen=Number(m[2]);if(!Number.isInteger(objNum)||objNum<=0||gen!==0)throw new Error('referencia indirecta no compatible con transacción directa: '+k);return{objNum,key:k}}
function makeDirectEditPlan(targets,allStrokes){const selectedBySource=new Map(),allBySourceCount=new Map();for(const t of targets||[])selectedBySource.set(t.sourceKey,(selectedBySource.get(t.sourceKey)||0)+1);for(const q of allStrokes||[])allBySourceCount.set(q.sourceKey,(allBySourceCount.get(q.sourceKey)||0)+1);for(const[k,n]of selectedBySource)if(n!==(allBySourceCount.get(k)||0))throw new Error('XObject compartido: la transacción directa afectaría geometría no azul');const groups=strokeEditGroups(targets),plan=[];for(const g of groups.values()){const id=directRefIdentity(g.ref),text=latin(g.ref.readStream()),ranges=[];for(const[a,b]of g.ranges){if(a<0||b>text.length||a>=b)throw new Error('rango directo inválido en '+g.key);ranges.push({start:a,end:b,original:text.slice(a,b)})}plan.push({objNum:id.objNum,key:id.key,length:text.length,ranges})}if(!plan.length)throw new Error('la transacción directa no encontró streams editables');return plan}
function applyDirectEditPlan(work,plan){let touched=0;for(const g of plan){const ref=deepObj(work.newIndirect(g.objNum));if(!ref?.isStream?.())throw new Error('el objeto '+g.objNum+' ya no es un stream en la copia directa');let text=latin(ref.readStream());if(text.length!==g.length)throw new Error('el stream '+g.objNum+' cambió de longitud antes de la transacción directa');for(const r of g.ranges){if(r.start<0||r.end>text.length||r.start>=r.end||text.slice(r.start,r.end)!==r.original)throw new Error('el contenido del stream '+g.objNum+' no coincide con la identidad estructural esperada');text=text.slice(0,r.start)+text.slice(r.end)}ref.writeStream(raw(text));touched++}return touched}'''
assert anchor in s, 'direct helper insertion anchor not found'
s=s.replace(anchor,insert,1)

anchor="const outBase=new Uint8Array(activeBytes),errors=[];let firstMismatchDiagnostic='',causalDiagnostic='';"
block=r'''const outBase=new Uint8Array(activeBytes),errors=[];let firstMismatchDiagnostic='',causalDiagnostic='';
async function attemptSingleTransaction(plan,saveMode='incremental'){let work=null,wp=null,check=null,cp=null;try{work=mupdf.PDFDocument.openDocument(outBase,'application/pdf');const touched=applyDirectEditPlan(work,plan);wp=work.loadPage(0);let previewVisual=collectVisual(wp);if(!bagOK(previewVisual))throw new Error('la geometría directa no coincide exactamente con la copia base menos azul');previewVisual=null;await uiYield();let previewModel=deepModel(wp);if(!previewModel||previewModel.incomplete||previewModel.strokes.length!==beforeStruct-selectedVisual)throw new Error('el modelo estructural directo no equivale a original menos operadores azules');previewModel=null;await uiYield();const previewRaster=await rasterDigest(wp);if(saveMode==='incremental'&&work.canBeSavedIncrementally?.()===false)throw new Error('MuPDF indica que este PDF no admite guardado incremental');const outBuf=work.saveToBuffer(saveMode),out=new Uint8Array(U(outBuf));wp.destroy?.();wp=null;work.destroy();work=null;check=mupdf.PDFDocument.openDocument(out,'application/pdf');cp=check.loadPage(0);if(await rasterDigest(cp)!==previewRaster)throw new Error('después de guardar, el renderizado cambió respecto de la transacción directa exacta');return{out,touched,saveMode:saveMode||'reescritura mínima'}}finally{try{cp?.destroy?.()}catch(_){}try{check?.destroy?.()}catch(_){}try{wp?.destroy?.()}catch(_){}try{work?.destroy?.()}catch(_){}}}
try{status.textContent='Transacción directa exacta · resolviendo '+selectedVisual+' trazos azules en una sola edición…';await uiYield();const directPlan=makeDirectEditPlan(structSelected,model.strokes),ok=await attemptSingleTransaction(directPlan,'incremental');activeBytes=ok.out;doc.destroy();doc=mupdf.PDFDocument.openDocument(activeBytes,'application/pdf');pending=true;await renderPage();status.textContent='Selección eliminada y verificada: '+selectedVisual+' trazos azules · transacción directa 1:1 · '+ok.touched+' stream(s) · una sola verificación final. Puedes continuar o guardar.';return}catch(e){errors.push('transacción directa · '+e.message);if(giantSingleTransaction){status.textContent='Borrado cancelado sin modificar el PDF activo: la transacción directa única no pudo demostrar original − azul en esta página gigante ('+beforeVisual+' trazos). Para proteger la memoria no se ejecutaron rutas alternativas ni causal · '+e.message;setButtons();return}}
'''
assert anchor in s, 'single transaction insertion anchor not found'
s=s.replace(anchor,block,1)

p.write_text(s,encoding='utf-8')
print('patched',len(s))
