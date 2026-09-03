from pathlib import Path
import re
src=Path('selector-nubes-causal-ap-core.html').read_text()
helper=r'''
function appearanceDoNames(text){
 const out=[];let i=0,args=[];while(i<text.length){const t=nextToken(text,i);if(!t)break;i=t.next;if(t.type==='name'||t.type==='num'){args.push(t);continue}if(t.type!=='op')continue;if(t.value==='Do'){const n=[...args].reverse().find(x=>x.type==='name');if(n)out.push(String(n.value||'').replace(/^\//,''))}args=[]}return out
}
function appearanceFormChild(ref,name,parentRes=null){
 try{const dict=deepObj(ref),res=deepResources(dict,parentRes),xd=deepObj(res?.get?.('XObject'));if(!xd?.isDictionary?.())return null;const child=xd.get(String(name||'').replace(/^\//,''));if(!child?.isStream?.())return null;const cd=deepObj(child);if(deepName(cd?.get?.('Subtype'))!=='Form')return null;return{ref:child,res:deepResources(cd,res)}}catch(_){return null}
}
function appearanceTargets(rootRef){
 const targets=[];let streams=0,forms=0;function walk(ref,res,chain,depth,trail){if(depth>12)return;const key=deepKey(ref);if(trail.includes(key))return;streams++;const text=latin(ref.readStream()),ranges=appearancePaintRanges(text);for(let i=0;i<ranges.length;i++)targets.push({chain:[...chain],rangeIndex:i,streamKey:key});for(const name of appearanceDoNames(text)){const child=appearanceFormChild(ref,name,res);if(!child)continue;forms++;walk(child.ref,child.res,[...chain,name],depth+1,[...trail,key])}}const res=deepResources(deepObj(rootRef),null);walk(rootRef,res,[],0,[]);return{targets,streams,forms}
}
function resolveAppearanceTarget(rootRef,chain,rangeIndex){
 let ref=rootRef,res=deepResources(deepObj(rootRef),null);for(const name of (chain||[])){const child=appearanceFormChild(ref,name,res);if(!child)throw new Error('Form/XObject de /AP no estable: '+name);ref=child.ref;res=child.res}const ranges=appearancePaintRanges(latin(ref.readStream())),rr=ranges[rangeIndex];if(!rr)throw new Error('operador anidado de /AP no estable');return{ref,rr}
}
'''
marker='async function buildCausalRouteSmall(){'
if marker not in src: raise SystemExit('build marker missing')
src=src.replace(marker,helper+'\n'+marker,1)
pat=re.compile(r"  const widgetAppearanceOps=\[\];let apStreams=.*?\n  causalDiagnostic=",re.S)
new=r'''  const widgetAppearanceOps=[];let apStreams=0,apForms=0,apOperators=0,apTests=0,apErrors=0,lastApError='';
  if(missingCount&&widgetCount){
   for(let wi=0;wi<widgetCount&&missingCount;wi++){
    let probe=null,pp=null;try{probe=mupdf.PDFDocument.openDocument(outBase,'application/pdf');pp=probe.loadPage(0);const w=(pp.getWidgets?.()||[])[wi];if(!w)continue;const aps=widgetAppearanceStreams(w);for(let si=0;si<aps.length&&missingCount;si++){const scan=appearanceTargets(aps[si].ref);apStreams+=scan.streams;apForms+=scan.forms;apOperators+=scan.targets.length;for(let ti=0;ti<scan.targets.length&&missingCount;ti++){const desc=scan.targets[ti];let td=null,tp=null;try{td=mupdf.PDFDocument.openDocument(outBase,'application/pdf');tp=td.loadPage(0);const tw=(tp.getWidgets?.()||[])[wi];if(!tw)throw new Error('widget no disponible en copia AP');const tas=widgetAppearanceStreams(tw),ta=tas[si];if(!ta)throw new Error('apariencia AP no estable en copia');const target=resolveAppearanceTarget(ta.ref,desc.chain,desc.rangeIndex);let text=latin(target.ref.readStream());text=text.slice(0,target.rr.start)+text.slice(target.rr.end);target.ref.writeStream(raw(text));try{tp?.destroy?.()}catch(_){}tp=td.loadPage(0);const av=collectVisual(tp),ab=new Map();for(const v of av){const k=sig(v);ab.set(k,(ab.get(k)||0)+1)}let removed=[],added=0;for(const[k,n]of baseBag){const d=Math.max(0,n-(ab.get(k)||0));for(let q=0;q<d;q++)removed.push(k)}for(const[k,n]of ab)added+=Math.max(0,n-(baseBag.get(k)||0));apTests++;if(removed.length===1&&added===0){const k=removed[0],left=missing.get(k)||0;if(left>0){widgetAppearanceOps.push({widgetIndex:wi,appearanceIndex:si,chain:[...desc.chain],rangeIndex:desc.rangeIndex,streamKey:deepKey(target.ref),sig:k});if(left===1)missing.delete(k);else missing.set(k,left-1);missingCount--;}}}catch(e){apErrors++;lastApError=String(e?.message||e)}finally{try{tp?.destroy?.()}catch(_){}try{td?.destroy?.()}catch(_){}}if((apTests%8)===0){status.textContent='Buscando dentro de /AP y Forms anidados · prueba '+apTests+'/'+apOperators+'…';await uiYield()}}}}catch(e){apErrors++;lastApError=String(e?.message||e)}finally{try{pp?.destroy?.()}catch(_){}try{probe?.destroy?.()}catch(_){}}
   }
  }
  causalDiagnostic='pool inicial='+pool.length+' · pruebas únicas totales='+tested+' · ampliadas únicas='+expanded+' · operadores 1:1='+oneToOne+' · anotaciones='+annotationCount+' · widgets='+widgetCount+' · anotaciones probadas='+annotationTests+' · widgets intentados='+widgetAttempts+' · widgets probados='+widgetTests+' · errores widget='+widgetErrors+(lastWidgetError?' · último error widget='+lastWidgetError:'')+' · AP streams='+apStreams+' · AP forms='+apForms+' · AP operadores='+apOperators+' · AP pruebas='+apTests+' · AP errores='+apErrors+(lastApError?' · último error AP='+lastApError:'')+' · cubiertos='+(selectedVisual-missingCount)+'/'+selectedVisual;
  '''
src,n=pat.subn(new,src,1)
if n!=1: raise SystemExit('AP causal block not replaced')
start=src.find("for(const xp of (plan.widgetAppearanceOps||[])){")
endmark="try{wp?.destroy?.()}catch(_){}wp=work.loadPage(0);const preview=collectVisual(wp);"
end=src.find(endmark,start)
if start<0 or end<0: raise SystemExit('hybrid AP apply block not found')
apply="for(const xp of (plan.widgetAppearanceOps||[])){const widgets=wp.getWidgets?.()||[],w=widgets[xp.widgetIndex];if(!w)throw new Error('el widget de apariencia causal no pudo localizarse');const aps=widgetAppearanceStreams(w),ap=aps[xp.appearanceIndex];if(!ap)throw new Error('la apariencia /AP causal no pudo localizarse');const target=resolveAppearanceTarget(ap.ref,xp.chain||[],xp.rangeIndex);let text=latin(target.ref.readStream());text=text.slice(0,target.rr.start)+text.slice(target.rr.end);target.ref.writeStream(raw(text));}"
src=src[:start]+apply+src[end:]
src=src.replace('Selector de nubes · causal exacto dentro de /AP','Selector de nubes · causal exacto /AP profundo',1)
Path('selector-nubes-causal-ap-profundo-core.html').write_text(src)
wrap=Path('selector-nubes-causal-ap.html').read_text().replace('Selector de nubes · causal exacto dentro de /AP','Selector de nubes · causal exacto /AP profundo').replace('./selector-nubes-causal-ap-core.html?v=20260903-apcausal1','./selector-nubes-causal-ap-profundo-core.html?v=20260903-apdeep1')
Path('selector-nubes-causal-ap-profundo.html').write_text(wrap)
m=re.search(r'<script type="module">(.*?)</script>',src,re.S)
if not m: raise SystemExit('module missing')
Path('/tmp/selector-nubes-causal-ap-profundo.mjs').write_text(m.group(1))
