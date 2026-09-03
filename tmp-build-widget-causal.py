from pathlib import Path
import re
src=Path('selector-nubes-causal-anotaciones-core.html').read_text()
old="""  causalDiagnostic='pool inicial='+pool.length+' · pruebas únicas totales='+tested+' · ampliadas únicas='+expanded+' · operadores 1:1='+oneToOne+' · anotaciones='+annotationCount+' · widgets='+widgetCount+' · anotaciones probadas='+annotationTests+' · cubiertos='+(selectedVisual-missingCount)+'/'+selectedVisual;
  if(!missingCount&&annotationPlans.length){const structKeys=chosen.map(i=>structStableKey(cm.strokes[i]));if(chosen.length+annotationPlans.length!==selectedVisual||new Set(structKeys).size!==structKeys.length)throw new Error('la ruta híbrida no quedó 1:1');return{kind:'hybrid',structRoute:chosen,structKeys,annotations:annotationPlans}}
  if(missingCount)throw new Error('faltan fuentes causales para '+missingCount+' trazo(s) azul(es) después de probar operadores y anotaciones disponibles · '+causalDiagnostic);
"""
new="""  const widgetPlans=[];let widgetTests=0;
  if(missingCount&&widgetCount){
   for(let wi=0;wi<widgetCount&&missingCount;wi++){
    let td=null,tp=null;try{td=mupdf.PDFDocument.openDocument(outBase,'application/pdf');tp=td.loadPage(0);const widgets=tp.getWidgets?.()||[],w=widgets[wi];if(!w)continue;let objKey='';try{objKey=deepKey(w.getObject?.())}catch(_){}let field='';try{field=String(w.getFieldName?.()||'')}catch(_){}let rect=null;try{rect=w.getRect?.()||w.getBounds?.()||null}catch(_){}
     if(typeof tp.delete==='function')tp.delete(w);else continue;
     try{tp?.destroy?.()}catch(_){}tp=td.loadPage(0);const av=collectVisual(tp),ab=new Map();for(const v of av){const k=sig(v);ab.set(k,(ab.get(k)||0)+1)}let removed=[],added=0;for(const[k,n]of baseBag){const d=Math.max(0,n-(ab.get(k)||0));for(let q=0;q<d;q++)removed.push(k)}for(const[k,n]of ab)added+=Math.max(0,n-(baseBag.get(k)||0));widgetTests++;
     if(removed.length===1&&added===0){const k=removed[0],left=missing.get(k)||0;if(left>0){widgetPlans.push({index:wi,objKey,field,rect,sig:k});if(left===1)missing.delete(k);else missing.set(k,left-1);missingCount--;}}
    }catch(_){}finally{try{tp?.destroy?.()}catch(_){}try{td?.destroy?.()}catch(_){}}
    status.textContent='Buscando geometría azul fuera de Contents · widget '+(wi+1)+'/'+widgetCount+'…';await uiYield()
   }
  }
  causalDiagnostic='pool inicial='+pool.length+' · pruebas únicas totales='+tested+' · ampliadas únicas='+expanded+' · operadores 1:1='+oneToOne+' · anotaciones='+annotationCount+' · widgets='+widgetCount+' · anotaciones probadas='+annotationTests+' · widgets probados='+widgetTests+' · cubiertos='+(selectedVisual-missingCount)+'/'+selectedVisual;
  if(!missingCount&&(annotationPlans.length||widgetPlans.length)){const structKeys=chosen.map(i=>structStableKey(cm.strokes[i]));if(chosen.length+annotationPlans.length+widgetPlans.length!==selectedVisual||new Set(structKeys).size!==structKeys.length)throw new Error('la ruta híbrida no quedó 1:1');return{kind:'hybrid',structRoute:chosen,structKeys,annotations:annotationPlans,widgets:widgetPlans}}
  if(missingCount)throw new Error('faltan fuentes causales para '+missingCount+' trazo(s) azul(es) después de probar operadores, anotaciones y widgets disponibles · '+causalDiagnostic);
"""
if old not in src: raise SystemExit('diagnostic hybrid block not found')
src=src.replace(old,new,1)
old2="""for(const ap of plan.annotations){const anns=wp.getAnnotations?.()||[];let hits=[];if(ap.objKey)hits=anns.filter(a=>{try{return deepKey(a.getObject?.())===ap.objKey}catch(_){return false}});if(hits.length!==1&&Number.isInteger(ap.index)&&anns[ap.index])hits=[anns[ap.index]];if(hits.length!==1)throw new Error('la anotación causal azul no pudo localizarse de forma única');if(typeof wp.deleteAnnotation==='function')wp.deleteAnnotation(hits[0]);else if(typeof wp.delete==='function')wp.delete(hits[0]);else throw new Error('MuPDF no expone eliminación de anotaciones en esta página');}try{wp?.destroy?.()}catch(_){}wp=work.loadPage(0);const preview=collectVisual(wp);"""
new2="""for(const ap of (plan.annotations||[])){const anns=wp.getAnnotations?.()||[];let hits=[];if(ap.objKey)hits=anns.filter(a=>{try{return deepKey(a.getObject?.())===ap.objKey}catch(_){return false}});if(hits.length!==1&&Number.isInteger(ap.index)&&anns[ap.index])hits=[anns[ap.index]];if(hits.length!==1)throw new Error('la anotación causal azul no pudo localizarse de forma única');if(typeof wp.deleteAnnotation==='function')wp.deleteAnnotation(hits[0]);else if(typeof wp.delete==='function')wp.delete(hits[0]);else throw new Error('MuPDF no expone eliminación de anotaciones en esta página');}for(const xp of (plan.widgets||[])){const widgets=wp.getWidgets?.()||[];let hits=[];if(xp.objKey)hits=widgets.filter(w=>{try{return deepKey(w.getObject?.())===xp.objKey}catch(_){return false}});if(hits.length!==1&&xp.field)hits=widgets.filter(w=>{try{return String(w.getFieldName?.()||'')===xp.field}catch(_){return false}});if(hits.length!==1&&Number.isInteger(xp.index)&&widgets[xp.index])hits=[widgets[xp.index]];if(hits.length!==1)throw new Error('el widget causal azul no pudo localizarse de forma única');if(typeof wp.delete==='function')wp.delete(hits[0]);else throw new Error('MuPDF no expone eliminación de widgets en esta página');}try{wp?.destroy?.()}catch(_){}wp=work.loadPage(0);const preview=collectVisual(wp);"""
if old2 not in src: raise SystemExit('attemptHybrid apply block not found')
src=src.replace(old2,new2,1)
src=src.replace("return{out,touched:byRef.size+plan.annotations.length,number,saveMode:saveMode||'reescritura mínima'}","return{out,touched:byRef.size+(plan.annotations||[]).length+(plan.widgets||[]).length,number,saveMode:saveMode||'reescritura mínima'}",1)
src=src.replace("'RUTA HÍBRIDA OPERADORES+ANOTACIÓN LISTA'","'RUTA HÍBRIDA OPERADORES+FUENTE EXTERNA LISTA'",1)
src=src.replace("'Verificando azul exacto · operadores + anotación · guardado '","'Verificando azul exacto · operadores + fuente externa · guardado '",1)
src=src.replace('Selector de nubes v68 · guardado incremental verificado','Selector de nubes · causal exacto con widgets',1)
Path('selector-nubes-causal-widget-core.html').write_text(src)
wrap=Path('selector-nubes-causal-anotaciones.html').read_text().replace('Selector de nubes · causal exacto con anotaciones','Selector de nubes · causal exacto con widgets').replace('./selector-nubes-causal-anotaciones-core.html?v=20260903-annotcausal1','./selector-nubes-causal-widget-core.html?v=20260903-widgetcausal1')
Path('selector-nubes-causal-widget.html').write_text(wrap)
m=re.search(r'<script type="module">(.*?)</script>',src,re.S)
if not m: raise SystemExit('module script missing')
Path('/tmp/selector-nubes-causal-widget.mjs').write_text(m.group(1))
