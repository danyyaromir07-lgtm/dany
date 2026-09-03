from pathlib import Path

src=Path('selector-nubes-causal-ap-profundo-core.html').read_text()
src=src.replace('<title>Selector de nubes · causal exacto /AP profundo</title>','<title>Selector de nubes · causal exacto por streams globales</title>',1)

helpers="""
function externalCommandRanges(text){
 const out=[...appearancePaintRanges(text)];let i=0,cmdStart=null;while(i<text.length){const t=nextToken(text,i);if(!t)break;i=t.next;if(cmdStart==null)cmdStart=t.start;if(t.type!=='op')continue;const op=t.value;if(op==='Tj'||op==='TJ'||op==="'"||op==='\"'||op==='Do')out.push({start:cmdStart,end:t.end,op});cmdStart=null}const seen=new Set(),uniq=[];for(const r of out.sort((a,b)=>a.start-b.start||a.end-b.end)){const k=r.start+'|'+r.end;if(seen.has(k))continue;seen.add(k);uniq.push(r)}return uniq
}
function allPdfStreams(pdf){
 const out=[];let n=0;try{n=Number(pdf.countObjects?.()||0)}catch(_){}for(let i=1;i<n;i++){try{const q=deepObj(pdf.newIndirect(i));if(q?.isStream?.())out.push({num:i,ref:q})}catch(_){}}return out
}
"""
anchor='async function buildCausalRouteSmall(){'
pos=src.index(anchor)
src=src[:pos]+helpers+src[pos:]

start=src.index("  causalDiagnostic='pool inicial='")
end=src.index("  if(chosen.length!==selectedVisual",start)
global_block="""  const globalStreamOps=[];let globalStreams=0,globalStreamTests=0,globalCommandCandidates=0,globalCommandTests=0,globalStreamErrors=0,lastGlobalStreamError='';
  if(missingCount){
   let enumDoc=null;try{enumDoc=mupdf.PDFDocument.openDocument(outBase,'application/pdf');const streams=allPdfStreams(enumDoc),known=new Set(cm.strokes.map(s=>{try{return deepKey(s.sourceRef)}catch(_){return''}}));const candidates=streams.filter(s=>!known.has(deepKey(s.ref)));globalStreams=candidates.length;for(let ci=0;ci<candidates.length&&missingCount;ci++){
    const objNum=candidates[ci].num;let td=null,tp=null;try{td=mupdf.PDFDocument.openDocument(outBase,'application/pdf');tp=td.loadPage(0);const ref=deepObj(td.newIndirect(objNum));if(!ref?.isStream?.())continue;const original=latin(ref.readStream());ref.writeStream(raw(''));try{tp?.destroy?.()}catch(_){}tp=td.loadPage(0);const av=collectVisual(tp),ab=new Map();for(const v of av){const k=sig(v);ab.set(k,(ab.get(k)||0)+1)}let removed=[],added=0;for(const[k,n]of baseBag){const d=Math.max(0,n-(ab.get(k)||0));for(let q=0;q<d;q++)removed.push(k)}for(const[k,n]of ab)added+=Math.max(0,n-(baseBag.get(k)||0));globalStreamTests++;const missingHit=removed.some(k=>(missing.get(k)||0)>0);if(missingHit&&added===0){if(removed.length===1){const k=removed[0],left=missing.get(k)||0;if(left>0){globalStreamOps.push({objNum,mode:'whole',start:0,end:original.length,op:'STREAM',sig:k});if(left===1)missing.delete(k);else missing.set(k,left-1);missingCount--;}}else{const ranges=externalCommandRanges(original);globalCommandCandidates+=ranges.length;for(let ri=0;ri<ranges.length&&missingCount;ri++){let xd=null,xp=null;try{xd=mupdf.PDFDocument.openDocument(outBase,'application/pdf');xp=xd.loadPage(0);const xr=deepObj(xd.newIndirect(objNum));if(!xr?.isStream?.())continue;const text=latin(xr.readStream()),rr=ranges[ri];if(rr.end>text.length||rr.start<0||rr.start>=rr.end)continue;xr.writeStream(raw(text.slice(0,rr.start)+text.slice(rr.end)));try{xp?.destroy?.()}catch(_){}xp=xd.loadPage(0);const xv=collectVisual(xp),xb=new Map();for(const v of xv){const k=sig(v);xb.set(k,(xb.get(k)||0)+1)}let rmd=[],add=0;for(const[k,n]of baseBag){const d=Math.max(0,n-(xb.get(k)||0));for(let q=0;q<d;q++)rmd.push(k)}for(const[k,n]of xb)add+=Math.max(0,n-(baseBag.get(k)||0));globalCommandTests++;if(rmd.length===1&&add===0){const k=rmd[0],left=missing.get(k)||0;if(left>0){globalStreamOps.push({objNum,mode:'range',start:rr.start,end:rr.end,op:rr.op,sig:k});if(left===1)missing.delete(k);else missing.set(k,left-1);missingCount--;break}}}catch(e){globalStreamErrors++;lastGlobalStreamError=String(e?.message||e)}finally{try{xp?.destroy?.()}catch(_){}try{xd?.destroy?.()}catch(_){}}if((globalCommandTests%8)===0){status.textContent='Buscando fuente visual fuera del modelo · comando '+globalCommandTests+'…';await uiYield()}}}}}catch(e){globalStreamErrors++;lastGlobalStreamError=String(e?.message||e)}finally{try{tp?.destroy?.()}catch(_){}try{td?.destroy?.()}catch(_){}}if((globalStreamTests%8)===0){status.textContent='Buscando fuente visual fuera del modelo · stream '+globalStreamTests+'/'+globalStreams+'…';await uiYield()}}}finally{try{enumDoc?.destroy?.()}catch(_){}}
  }
  causalDiagnostic='pool inicial='+pool.length+' · pruebas únicas totales='+tested+' · ampliadas únicas='+expanded+' · operadores 1:1='+oneToOne+' · anotaciones='+annotationCount+' · widgets='+widgetCount+' · anotaciones probadas='+annotationTests+' · widgets intentados='+widgetAttempts+' · widgets probados='+widgetTests+' · errores widget='+widgetErrors+(lastWidgetError?' · último error widget='+lastWidgetError:'')+' · AP streams='+apStreams+' · AP forms='+apForms+' · AP operadores='+apOperators+' · AP pruebas='+apTests+' · AP errores='+apErrors+(lastApError?' · último error AP='+lastApError:'')+' · streams globales='+globalStreams+' · streams probados='+globalStreamTests+' · comandos candidatos='+globalCommandCandidates+' · comandos probados='+globalCommandTests+' · errores streams='+globalStreamErrors+(lastGlobalStreamError?' · último error stream='+lastGlobalStreamError:'')+' · cubiertos='+(selectedVisual-missingCount)+'/'+selectedVisual;
  if(!missingCount&&(annotationPlans.length||widgetPlans.length||widgetAppearanceOps.length||globalStreamOps.length)){const structKeys=chosen.map(i=>structStableKey(cm.strokes[i]));if(chosen.length+annotationPlans.length+widgetPlans.length+widgetAppearanceOps.length+globalStreamOps.length!==selectedVisual||new Set(structKeys).size!==structKeys.length)throw new Error('la ruta híbrida no quedó 1:1');return{kind:'hybrid',structRoute:chosen,structKeys,annotations:annotationPlans,widgets:widgetPlans,widgetAppearanceOps,globalStreamOps}}
  if(missingCount)throw new Error('falta '+missingCount+' trazo(s) azul(es) después de probar operadores y todos los streams PDF causales disponibles · '+causalDiagnostic);
"""
src=src[:start]+global_block+src[end:]

loop_start=src.index('for(const xp of (plan.widgetAppearanceOps||[])){')
close='}try{wp?.destroy?.()}catch(_){}wp=work.loadPage(0);'
close_pos=src.index(close,loop_start)
extra="""}for(const gp of (plan.globalStreamOps||[])){const ref=deepObj(work.newIndirect(gp.objNum));if(!ref?.isStream?.())throw new Error('el stream causal global '+gp.objNum+' ya no es un stream');let text=latin(ref.readStream());if(gp.mode==='whole')ref.writeStream(raw(''));else{if(gp.start<0||gp.end>text.length||gp.start>=gp.end)throw new Error('el rango causal global quedó fuera de límites');ref.writeStream(raw(text.slice(0,gp.start)+text.slice(gp.end)))}}try{wp?.destroy?.()}catch(_){}wp=work.loadPage(0);"""
src=src[:close_pos]+extra+src[close_pos+len(close):]

old="return{out,touched:byRef.size+(plan.annotations||[]).length+(plan.widgets||[]).length+(plan.widgetAppearanceOps||[]).length,number,saveMode:saveMode||'reescritura mínima'}"
new="return{out,touched:byRef.size+(plan.annotations||[]).length+(plan.widgets||[]).length+(plan.widgetAppearanceOps||[]).length+(plan.globalStreamOps||[]).length,number,saveMode:saveMode||'reescritura mínima'}"
if old not in src: raise SystemExit('touched marker not found')
src=src.replace(old,new,1)

Path('selector-nubes-causal-streams-core.html').write_text(src)
wrap=Path('selector-nubes-causal-ap-profundo.html').read_text()
wrap=wrap.replace('Selector de nubes · causal exacto /AP profundo','Selector de nubes · causal exacto por streams globales',1)
wrap=wrap.replace('./selector-nubes-causal-ap-profundo-core.html?v=20260903-apdeep1','./selector-nubes-causal-streams-core.html?v=20260903-streamcausal1',1)
Path('selector-nubes-causal-streams.html').write_text(wrap)
