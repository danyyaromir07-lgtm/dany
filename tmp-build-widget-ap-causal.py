from pathlib import Path
import re
src=Path('selector-nubes-causal-widget2-core.html').read_text()
marker="annots.delete(hits[0]);return true\n}\n"
helper=r'''annots.delete(hits[0]);return true
}
function widgetAppearanceStreams(widget){
 const out=[];try{const wo=deepObj(widget?.getObject?.()),ap=deepObj(wo?.get?.('AP')),n=ap?.get?.('N');if(!n)return out;if(n?.isStream?.()){out.push({ref:n,state:'',key:deepKey(n)});return out}const nd=deepObj(n);if(!nd?.isDictionary?.())return out;let active='';try{active=deepName(wo?.get?.('AS'))}catch(_){}const names=[];try{const ks=nd.getKeys?.()||[];for(const k of ks)names.push(String(k))}catch(_){}if(active){const a=nd.get(active);if(a?.isStream?.())out.push({ref:a,state:active,key:deepKey(a)})}for(const k of names){if(k===active)continue;const r=nd.get(k);if(r?.isStream?.())out.push({ref:r,state:k,key:deepKey(r)})}}catch(_){}return out
}
function appearancePaintRanges(text){
 const out=[];let i=0,args=[],pathStart=null;const nums=()=>args.filter(x=>x.type==='num'),clear=()=>{args=[]};while(i<text.length){const t=nextToken(text,i);if(!t)break;i=t.next;if(t.type==='num'||t.type==='name'){args.push(t);continue}if(t.type!=='op')continue;const op=t.value,na=nums();if(op==='m'&&na.length>=2){if(pathStart==null)pathStart=na[na.length-2].start;clear();continue}if(op==='re'&&na.length>=4){if(pathStart==null)pathStart=na[na.length-4].start;clear();continue}if(op==='l'||op==='c'||op==='v'||op==='y'||op==='h'){clear();continue}if(op==='S'||op==='s'||op==='B'||op==='B*'||op==='b'||op==='b*'){if(pathStart!=null)out.push({start:pathStart,end:t.end,op});pathStart=null;clear();continue}if(op==='n'||op==='f'||op==='F'||op==='f*'){pathStart=null;clear();continue}clear()}return out
}
'''
if marker not in src: raise SystemExit('removeWidget marker missing')
src=src.replace(marker,helper,1)
start=src.find("  const widgetPlans=[];let widgetTests=0,widgetAttempts=0,widgetErrors=0,lastWidgetError='';")
end=src.find("  causalDiagnostic='pool inicial='",start)
if start<0 or end<0: raise SystemExit('widget causal block markers missing')
old=src[start:end]
new=r'''  const widgetPlans=[];let widgetTests=0,widgetAttempts=0,widgetErrors=0,lastWidgetError='';
  if(missingCount&&widgetCount){
   for(let wi=0;wi<widgetCount&&missingCount;wi++){
    let td=null,tp=null;try{td=mupdf.PDFDocument.openDocument(outBase,'application/pdf');tp=td.loadPage(0);const widgets=tp.getWidgets?.()||[],w=widgets[wi];if(!w)continue;widgetAttempts++;let objKey='';try{objKey=deepKey(w.getObject?.())}catch(_){}let field='';try{field=String(w.getFieldName?.()||'')}catch(_){}let rect=null;try{rect=w.getRect?.()||w.getBounds?.()||null}catch(_){}
     removeWidgetRefFromAnnots(tp,w,wi);
     try{tp?.destroy?.()}catch(_){}tp=td.loadPage(0);const av=collectVisual(tp),ab=new Map();for(const v of av){const k=sig(v);ab.set(k,(ab.get(k)||0)+1)}let removed=[],added=0;for(const[k,n]of baseBag){const d=Math.max(0,n-(ab.get(k)||0));for(let q=0;q<d;q++)removed.push(k)}for(const[k,n]of ab)added+=Math.max(0,n-(baseBag.get(k)||0));widgetTests++;
     if(removed.length===1&&added===0){const k=removed[0],left=missing.get(k)||0;if(left>0){widgetPlans.push({index:wi,objKey,field,rect,sig:k});if(left===1)missing.delete(k);else missing.set(k,left-1);missingCount--;}}
    }catch(e){widgetErrors++;lastWidgetError=String(e?.message||e)}finally{try{tp?.destroy?.()}catch(_){}try{td?.destroy?.()}catch(_){}}
    status.textContent='Buscando geometría azul fuera de Contents · widget '+(wi+1)+'/'+widgetCount+'…';await uiYield()
   }
  }
  const widgetAppearanceOps=[];let apStreams=0,apOperators=0,apTests=0,apErrors=0,lastApError='';
  if(missingCount&&widgetCount){
   for(let wi=0;wi<widgetCount&&missingCount;wi++){
    let probe=null,pp=null;try{probe=mupdf.PDFDocument.openDocument(outBase,'application/pdf');pp=probe.loadPage(0);const w=(pp.getWidgets?.()||[])[wi];if(!w)continue;const aps=widgetAppearanceStreams(w);apStreams+=aps.length;for(let si=0;si<aps.length&&missingCount;si++){const ranges=appearancePaintRanges(latin(aps[si].ref.readStream()));apOperators+=ranges.length;for(let ri=0;ri<ranges.length&&missingCount;ri++){let td=null,tp=null;try{td=mupdf.PDFDocument.openDocument(outBase,'application/pdf');tp=td.loadPage(0);const tw=(tp.getWidgets?.()||[])[wi];if(!tw)throw new Error('widget no disponible en copia AP');const tas=widgetAppearanceStreams(tw),ta=tas[si];if(!ta)throw new Error('apariencia AP no estable en copia');const rr=appearancePaintRanges(latin(ta.ref.readStream()))[ri];if(!rr)throw new Error('operador AP no estable en copia');let text=latin(ta.ref.readStream());text=text.slice(0,rr.start)+text.slice(rr.end);ta.ref.writeStream(raw(text));try{tp?.destroy?.()}catch(_){}tp=td.loadPage(0);const av=collectVisual(tp),ab=new Map();for(const v of av){const k=sig(v);ab.set(k,(ab.get(k)||0)+1)}let removed=[],added=0;for(const[k,n]of baseBag){const d=Math.max(0,n-(ab.get(k)||0));for(let q=0;q<d;q++)removed.push(k)}for(const[k,n]of ab)added+=Math.max(0,n-(baseBag.get(k)||0));apTests++;if(removed.length===1&&added===0){const k=removed[0],left=missing.get(k)||0;if(left>0){widgetAppearanceOps.push({widgetIndex:wi,appearanceIndex:si,rangeIndex:ri,state:ta.state||'',streamKey:deepKey(ta.ref),sig:k});if(left===1)missing.delete(k);else missing.set(k,left-1);missingCount--;}}}catch(e){apErrors++;lastApError=String(e?.message||e)}finally{try{tp?.destroy?.()}catch(_){}try{td?.destroy?.()}catch(_){}}if((apTests%8)===0){status.textContent='Buscando dentro de /AP del widget · prueba '+apTests+'…';await uiYield()}}}}catch(e){apErrors++;lastApError=String(e?.message||e)}finally{try{pp?.destroy?.()}catch(_){}try{probe?.destroy?.()}catch(_){}}
   }
  }
'''
src=src[:start]+new+src[end:]
src=src.replace("+' · cubiertos='+(selectedVisual-missingCount)+'/'+selectedVisual;", "+' · AP streams='+apStreams+' · AP operadores='+apOperators+' · AP pruebas='+apTests+' · AP errores='+apErrors+(lastApError?' · último error AP='+lastApError:'')+' · cubiertos='+(selectedVisual-missingCount)+'/'+selectedVisual;",1)
src=src.replace("if(!missingCount&&(annotationPlans.length||widgetPlans.length)){const structKeys=chosen.map(i=>structStableKey(cm.strokes[i]));if(chosen.length+annotationPlans.length+widgetPlans.length!==selectedVisual||new Set(structKeys).size!==structKeys.length)throw new Error('la ruta híbrida no quedó 1:1');return{kind:'hybrid',structRoute:chosen,structKeys,annotations:annotationPlans,widgets:widgetPlans}}", "if(!missingCount&&(annotationPlans.length||widgetPlans.length||widgetAppearanceOps.length)){const structKeys=chosen.map(i=>structStableKey(cm.strokes[i]));if(chosen.length+annotationPlans.length+widgetPlans.length+widgetAppearanceOps.length!==selectedVisual||new Set(structKeys).size!==structKeys.length)throw new Error('la ruta híbrida no quedó 1:1');return{kind:'hybrid',structRoute:chosen,structKeys,annotations:annotationPlans,widgets:widgetPlans,widgetAppearanceOps}}",1)
src=src.replace("después de probar operadores, anotaciones y widgets disponibles", "después de probar operadores, anotaciones, widgets y operadores internos de /AP",1)
needle="for(const xp of (plan.widgets||[])){const widgets=wp.getWidgets?.()||[];let hits=[];if(xp.objKey)hits=widgets.filter(w=>{try{return deepKey(w.getObject?.())===xp.objKey}catch(_){return false}});if(hits.length!==1&&xp.field)hits=widgets.filter(w=>{try{return String(w.getFieldName?.()||'')===xp.field}catch(_){return false}});if(hits.length!==1&&Number.isInteger(xp.index)&&widgets[xp.index])hits=[widgets[xp.index]];if(hits.length!==1)throw new Error('el widget causal azul no pudo localizarse de forma única');removeWidgetRefFromAnnots(wp,hits[0],xp.index);}"
if needle not in src: raise SystemExit('attemptHybrid widget apply block missing')
insert=needle+"for(const xp of (plan.widgetAppearanceOps||[])){const widgets=wp.getWidgets?.()||[],w=widgets[xp.widgetIndex];if(!w)throw new Error('el widget de apariencia causal no pudo localizarse');const aps=widgetAppearanceStreams(w),ap=aps[xp.appearanceIndex];if(!ap)throw new Error('la apariencia /AP causal no pudo localizarse');const ranges=appearancePaintRanges(latin(ap.ref.readStream())),rr=ranges[xp.rangeIndex];if(!rr)throw new Error('el operador /AP causal no pudo localizarse');let text=latin(ap.ref.readStream());text=text.slice(0,rr.start)+text.slice(rr.end);ap.ref.writeStream(raw(text));}"
src=src.replace(needle,insert,1)
src=src.replace("return{out,touched:byRef.size+(plan.annotations||[]).length+(plan.widgets||[]).length,number,saveMode:saveMode||'reescritura mínima'}", "return{out,touched:byRef.size+(plan.annotations||[]).length+(plan.widgets||[]).length+(plan.widgetAppearanceOps||[]).length,number,saveMode:saveMode||'reescritura mínima'}",1)
src=src.replace('Selector de nubes · causal exacto por /Annots','Selector de nubes · causal exacto dentro de /AP',1)
Path('selector-nubes-causal-ap-core.html').write_text(src)
wrap=Path('selector-nubes-causal-widget2.html').read_text().replace('Selector de nubes · causal exacto por /Annots','Selector de nubes · causal exacto dentro de /AP').replace('./selector-nubes-causal-widget2-core.html?v=20260903-widgetannots2','./selector-nubes-causal-ap-core.html?v=20260903-apcausal1')
Path('selector-nubes-causal-ap.html').write_text(wrap)
m=re.search(r'<script type="module">(.*?)</script>',src,re.S)
if not m: raise SystemExit('module script missing')
Path('/tmp/selector-nubes-causal-ap.mjs').write_text(m.group(1))
