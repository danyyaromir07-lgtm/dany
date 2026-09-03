from pathlib import Path
import re
src=Path('selector-nubes-causal-widget-core.html').read_text()
helper="""function removeWidgetRefFromAnnots(page,widget,widgetOrdinal=-1){
 const pageObj=deepObj(page?.getObject?.()),annots=deepObj(pageObj?.get?.('Annots'));if(!annots?.isArray?.())throw new Error('la página no expone un array /Annots editable para el widget');
 let objKey='';try{objKey=deepKey(widget?.getObject?.())}catch(_){}
 let hits=[];for(let i=0;i<Number(annots.length||0);i++){const ref=annots.get(i);let same=false;if(objKey){try{same=deepKey(ref)===objKey||deepKey(deepObj(ref))===objKey}catch(_){}}if(same)hits.push(i)}
 if(hits.length!==1&&Number.isInteger(widgetOrdinal)&&widgetOrdinal>=0){let ord=-1;for(let i=0;i<Number(annots.length||0);i++){const r=deepObj(annots.get(i));if(deepName(r?.get?.('Subtype'))!=='Widget')continue;ord++;if(ord===widgetOrdinal){hits=[i];break}}}
 if(hits.length!==1)throw new Error('el widget no pudo localizarse de forma única dentro de /Annots · coincidencias='+hits.length);
 annots.delete(hits[0]);return true
}
"""
needle='async function buildCausalRouteSmall(){'
if needle not in src: raise SystemExit('buildCausalRouteSmall marker missing')
src=src.replace(needle,helper+needle,1)
src=src.replace("const widgetPlans=[];let widgetTests=0;","const widgetPlans=[];let widgetTests=0,widgetAttempts=0,widgetErrors=0,lastWidgetError='';",1)
old="""let td=null,tp=null;try{td=mupdf.PDFDocument.openDocument(outBase,'application/pdf');tp=td.loadPage(0);const widgets=tp.getWidgets?.()||[],w=widgets[wi];if(!w)continue;let objKey='';try{objKey=deepKey(w.getObject?.())}catch(_){}let field='';try{field=String(w.getFieldName?.()||'')}catch(_){}let rect=null;try{rect=w.getRect?.()||w.getBounds?.()||null}catch(_){}
     if(typeof tp.delete==='function')tp.delete(w);else continue;
"""
new="""let td=null,tp=null;try{td=mupdf.PDFDocument.openDocument(outBase,'application/pdf');tp=td.loadPage(0);const widgets=tp.getWidgets?.()||[],w=widgets[wi];if(!w)continue;widgetAttempts++;let objKey='';try{objKey=deepKey(w.getObject?.())}catch(_){}let field='';try{field=String(w.getFieldName?.()||'')}catch(_){}let rect=null;try{rect=w.getRect?.()||w.getBounds?.()||null}catch(_){}
     removeWidgetRefFromAnnots(tp,w,wi);
"""
if old not in src: raise SystemExit('widget causal delete block missing')
src=src.replace(old,new,1)
src=src.replace("    }catch(_){}finally{try{tp?.destroy?.()}catch(_){}try{td?.destroy?.()}catch(_){}}\n    status.textContent='Buscando geometría azul fuera de Contents · widget '","    }catch(e){widgetErrors++;lastWidgetError=String(e?.message||e)}finally{try{tp?.destroy?.()}catch(_){}try{td?.destroy?.()}catch(_){}}\n    status.textContent='Buscando geometría azul fuera de Contents · widget '",1)
src=src.replace("' · widgets probados='+widgetTests+' · cubiertos='","' · widgets intentados='+widgetAttempts+' · widgets probados='+widgetTests+' · errores widget='+widgetErrors+(lastWidgetError?' · último error widget='+lastWidgetError:'')+' · cubiertos='",1)
old2="""if(hits.length!==1)throw new Error('el widget causal azul no pudo localizarse de forma única');if(typeof wp.delete==='function')wp.delete(hits[0]);else throw new Error('MuPDF no expone eliminación de widgets en esta página');"""
new2="""if(hits.length!==1)throw new Error('el widget causal azul no pudo localizarse de forma única');removeWidgetRefFromAnnots(wp,hits[0],xp.index);"""
if old2 not in src: raise SystemExit('widget hybrid apply block missing')
src=src.replace(old2,new2,1)
src=src.replace('Selector de nubes · causal exacto con widgets','Selector de nubes · causal exacto por /Annots',1)
Path('selector-nubes-causal-widget2-core.html').write_text(src)
wrap=Path('selector-nubes-causal-widget.html').read_text().replace('Selector de nubes · causal exacto con widgets','Selector de nubes · causal exacto por /Annots').replace('./selector-nubes-causal-widget-core.html?v=20260903-widgetcausal1','./selector-nubes-causal-widget2-core.html?v=20260903-widgetannots2')
Path('selector-nubes-causal-widget2.html').write_text(wrap)
m=re.search(r'<script type="module">(.*?)</script>',src,re.S)
if not m: raise SystemExit('module script missing')
Path('/tmp/selector-nubes-causal-widget2.mjs').write_text(m.group(1))
