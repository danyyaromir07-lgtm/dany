from pathlib import Path

src=Path('selector-nubes-causal-streams-core.html').read_text()
src=src.replace('<title>Selector de nubes · causal exacto por streams globales</title>','<title>Selector de nubes · paths multi-stream exactos</title>',1)

old="let i=0,args=[];const nums=k=>args.filter(x=>x.type==='num').slice(-k).map(x=>x.value),firstNumStart=k=>{const a=args.filter(x=>x.type==='num');return a[a.length-k]?.start??0},clear=()=>{args=[]};while(i<text.length){const t=nextToken(text,i);if(!t)break;i=t.next;if(t.type==='num'||t.type==='name'){args.push(t);continue}if(t.type!=='op')continue;const op=t.value;"
new="let i=0,args=[];const nums=k=>args.filter(x=>x.type==='num').slice(-k).map(x=>x.value),firstNumStart=k=>{const a=args.filter(x=>x.type==='num');return a[a.length-k]?.start??0},pathArgCount={m:2,l:2,c:6,v:4,y:4,re:4},addPathEdit=(p,r,a,b)=>{if(!p||a<0||b<=a)return;if(!Array.isArray(p.editRanges))p.editRanges=[];p.editRanges.push({ref:r,start:a,end:b});if(deepKey(p.sourceRef)!==deepKey(r))p.cross=true},clear=()=>{args=[]};while(i<text.length){const t=nextToken(text,i);if(!t)break;i=t.next;if(t.type==='num'||t.type==='name'){args.push(t);continue}if(t.type!=='op')continue;const op=t.value;if(st.path&&pathArgCount[op])addPathEdit(st.path,ref,firstNumStart(pathArgCount[op]),t.end);else if(st.path&&op==='h')addPathEdit(st.path,ref,t.start,t.end);"
if old not in src: raise SystemExit('scanText header needle not found')
src=src.replace(old,new,1)

old="st.path={start:firstNumStart(2),sourceRef:ref,sourceBase:deepKey(ref),pts:[p],first:p,last:p,subFirst:p,lines:0,curves:0,rgb:[...st.rgb],width:st.width,cross:false,invocations:[...invocations]}"
new="st.path={start:firstNumStart(2),sourceRef:ref,sourceBase:deepKey(ref),pts:[p],first:p,last:p,subFirst:p,lines:0,curves:0,rgb:[...st.rgb],width:st.width,cross:false,editRanges:[{ref,start:firstNumStart(2),end:t.end}],invocations:[...invocations]}"
if old not in src: raise SystemExit('m path init needle not found')
src=src.replace(old,new,1)

old="st.path={start:firstNumStart(4),sourceRef:ref,sourceBase:deepKey(ref),pts:[p0,p1,p2,p3],first:p0,last:p3,subFirst:p0,lines:3,curves:0,rgb:[...st.rgb],width:st.width,cross:false,invocations:[...invocations]}"
new="st.path={start:firstNumStart(4),sourceRef:ref,sourceBase:deepKey(ref),pts:[p0,p1,p2,p3],first:p0,last:p3,subFirst:p0,lines:3,curves:0,rgb:[...st.rgb],width:st.width,cross:false,editRanges:[{ref,start:firstNumStart(4),end:t.end}],invocations:[...invocations]}"
if old not in src: raise SystemExit('re path init needle not found')
src=src.replace(old,new,1)

old="if(['S','s','B','B*','b','b*'].includes(op)){const p=st.path;st.path=null;if(p&&(p.lines+p.curves)){"
new="if(['S','s','B','B*','b','b*'].includes(op)){const p=st.path;if(p)addPathEdit(p,ref,t.start,t.end);st.path=null;if(p&&(p.lines+p.curves)){"
if old not in src: raise SystemExit('paint needle not found')
src=src.replace(old,new,1)

old="p.editable=!p.cross;p.sourceKey=p.sourceBase+'|'+p.start+'|'+p.end;p.instanceKey=chain+'|'+p.sourceKey;out.push(p)"
new="p.editable=Array.isArray(p.editRanges)&&p.editRanges.length>0;p.sourceKey=p.cross?'MULTI|'+p.editRanges.map(r=>deepKey(r.ref)+':'+r.start+'-'+r.end).join('|'):p.sourceBase+'|'+p.start+'|'+p.end;p.instanceKey=chain+'|'+p.sourceKey;out.push(p)"
if old not in src: raise SystemExit('editable/sourceKey needle not found')
src=src.replace(old,new,1)

old="function structStableKey(s){return String(s?.instanceKey||((s?.sourceKey||'')+'|'+(s?.start??'')+'|'+(s?.end??'')))}\nfunction remapStructTargets"
new="function structStableKey(s){return String(s?.instanceKey||((s?.sourceKey||'')+'|'+(s?.start??'')+'|'+(s?.end??'')))}\nfunction strokeEditRanges(t){const a=Array.isArray(t?.editRanges)&&t.editRanges.length?t.editRanges:[{ref:t?.sourceRef,start:t?.start,end:t?.end}];return a.filter(r=>r?.ref&&Number.isInteger(r.start)&&Number.isInteger(r.end)&&r.start>=0&&r.end>r.start)}\nfunction strokeEditGroups(targets){const groups=new Map();for(const t of targets||[]){for(const r of strokeEditRanges(t)){const key=deepKey(r.ref);let g=groups.get(key);if(!g){g={ref:r.ref,key,ranges:[],original:null};groups.set(key,g)}g.ranges.push([r.start,r.end])}}for(const g of groups.values()){g.ranges.sort((a,b)=>b[0]-a[0]||b[1]-a[1]);for(let i=1;i<g.ranges.length;i++)if(g.ranges[i-1][0]<g.ranges[i][1])throw new Error('rangos estructurales solapados en '+g.key)}return groups}\nfunction applyStrokeGroups(groups){for(const g of groups.values()){let text=latin(g.ref.readStream());g.original=text;for(const[a,b]of g.ranges){if(a<0||b>text.length||a>=b)throw new Error('rango estructural inválido en '+g.key);text=text.slice(0,a)+text.slice(b)}g.ref.writeStream(raw(text))}}\nfunction restoreStrokeGroups(groups){for(const g of groups.values())if(g.original!=null)g.ref.writeStream(raw(g.original))}\nfunction remapStructTargets"
if old not in src: raise SystemExit('helper insertion needle not found')
src=src.replace(old,new,1)

old="if(testedSet.has(idx))return null;testedSet.add(idx);const t=cm.strokes[idx];if(!t||t.editable===false)return null;const original=latin(t.sourceRef.readStream());if(t.start<0||t.end>original.length||t.start>=t.end)return null;\n   let result=null;try{\n    t.sourceRef.writeStream(raw(original.slice(0,t.start)+original.slice(t.end)));"
new="if(testedSet.has(idx))return null;testedSet.add(idx);const t=cm.strokes[idx];if(!t||t.editable===false)return null;const editGroups=strokeEditGroups([t]);if(!editGroups.size)return null;\n   let result=null;try{\n    applyStrokeGroups(editGroups);"
if old not in src: raise SystemExit('causal test open needle not found')
src=src.replace(old,new,1)

old="}finally{t.sourceRef.writeStream(raw(original));try{cp?.destroy?.()}catch(_){}cp=cw.loadPage(0)}"
new="}finally{restoreStrokeGroups(editGroups);try{cp?.destroy?.()}catch(_){}cp=cw.loadPage(0)}"
if old not in src: raise SystemExit('causal test restore needle not found')
src=src.replace(old,new,1)

old="const edits=new Map();for(const t of targets){const k=deepKey(t.sourceRef)+'|'+t.start+'|'+t.end;if(!edits.has(k))edits.set(k,{ref:t.sourceRef,refKey:deepKey(t.sourceRef),start:t.start,end:t.end})}const byRef=new Map();for(const e of edits.values())(byRef.get(e.refKey)||byRef.set(e.refKey,{ref:e.ref,ranges:[]}).get(e.refKey)).ranges.push([e.start,e.end]);let touched=0;for(const g of byRef.values()){let text=latin(g.ref.readStream());for(const[a,b]of g.ranges.sort((A,B)=>B[0]-A[0])){if(a<0||b>text.length||a>=b)throw new Error('rango local inválido en stream interno');text=text.slice(0,a)+text.slice(b)}g.ref.writeStream(raw(text));touched++}"
new="const byRef=strokeEditGroups(targets);applyStrokeGroups(byRef);const touched=byRef.size;"
if old not in src: raise SystemExit('attempt edit block needle not found')
src=src.replace(old,new,1)

# Hybrid path editing uses the same structural targets. Keep external-source logic unchanged.
old="const edits=new Map();for(const t of targets){if(!t||t.editable===false)throw new Error('la ruta híbrida contiene un operador no editable');const k=deepKey(t.sourceRef)+'|'+t.start+'|'+t.end;if(!edits.has(k))edits.set(k,{ref:t.sourceRef,refKey:deepKey(t.sourceRef),start:t.start,end:t.end})}const byRef=new Map();for(const e of edits.values())(byRef.get(e.refKey)||byRef.set(e.refKey,{ref:e.ref,ranges:[]}).get(e.refKey)).ranges.push([e.start,e.end]);for(const g of byRef.values()){let text=latin(g.ref.readStream());for(const[a,b]of g.ranges.sort((A,B)=>B[0]-A[0]))text=text.slice(0,a)+text.slice(b);g.ref.writeStream(raw(text))}"
new="for(const t of targets)if(!t||t.editable===false)throw new Error('la ruta híbrida contiene un operador no editable');const byRef=strokeEditGroups(targets);applyStrokeGroups(byRef);"
if old not in src: raise SystemExit('hybrid edit block needle not found')
src=src.replace(old,new,1)

Path('selector-nubes-multistream-core.html').write_text(src)
wrap=Path('selector-nubes-causal-streams.html').read_text()
wrap=wrap.replace('Selector de nubes · causal exacto por streams globales','Selector de nubes · paths multi-stream exactos',1)
wrap=wrap.replace('./selector-nubes-causal-streams-core.html?v=20260903-streamcausal1','./selector-nubes-multistream-core.html?v=20260903-multistream1',1)
Path('selector-nubes-multistream.html').write_text(wrap)
