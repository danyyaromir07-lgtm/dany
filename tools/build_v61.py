from pathlib import Path
s=Path('cloud-similar-selector-v60-core.html').read_text()
s=s.replace('Selector de nubes v60 · mapeo disperso','Selector de nubes v61 · parser multipath + mapeo tolerante')
s=s.replace('v60 · selector clásico estable · alineación monotónica dispersa · borrado transaccional exacto.','v61 · selector clásico estable · parser multipath · mapeo tolerante · borrado transaccional exacto.')
old="if(op==='m'){const a=nums(2);if(a.length===2){const p=tf(st.ctm,a[0],a[1]);st.path={start:firstNumStart(2),sourceRef:ref,sourceBase:deepKey(ref),pts:[p],first:p,last:p,subFirst:p,lines:0,curves:0,rgb:[...st.rgb],width:st.width,cross:false}}clear();continue}"
new="if(op==='m'){const a=nums(2);if(a.length===2){const p=tf(st.ctm,a[0],a[1]);if(st.path){if(deepKey(st.path.sourceRef)!==deepKey(ref))st.path.cross=true;st.path.pts.push(p);st.path.last=p;st.path.subFirst=p}else st.path={start:firstNumStart(2),sourceRef:ref,sourceBase:deepKey(ref),pts:[p],first:p,last:p,subFirst:p,lines:0,curves:0,rgb:[...st.rgb],width:st.width,cross:false}}clear();continue}"
assert old in s; s=s.replace(old,new)
old="if(op==='re'){const a=nums(4);if(a.length===4){const[x,y,w,h]=a,p0=tf(st.ctm,x,y),p1=tf(st.ctm,x+w,y),p2=tf(st.ctm,x+w,y+h),p3=tf(st.ctm,x,y+h);st.path={start:firstNumStart(4),sourceRef:ref,sourceBase:deepKey(ref),pts:[p0,p1,p2,p3],first:p0,last:p0,subFirst:p0,lines:4,curves:0,rgb:[...st.rgb],width:st.width,cross:false}}clear();continue}"
new="if(op==='re'){const a=nums(4);if(a.length===4){const[x,y,w,h]=a,p0=tf(st.ctm,x,y),p1=tf(st.ctm,x+w,y),p2=tf(st.ctm,x+w,y+h),p3=tf(st.ctm,x,y+h);if(st.path){if(deepKey(st.path.sourceRef)!==deepKey(ref))st.path.cross=true;st.path.pts.push(p0,p1,p2,p3);st.path.last=p0;st.path.subFirst=p0;st.path.lines+=4}else st.path={start:firstNumStart(4),sourceRef:ref,sourceBase:deepKey(ref),pts:[p0,p1,p2,p3],first:p0,last:p0,subFirst:p0,lines:4,curves:0,rgb:[...st.rgb],width:st.width,cross:false}}clear();continue}"
assert old in s; s=s.replace(old,new)
old="for(let ri=0;ri<roots.length;ri++)try{scanText(latin(roots[ri].readStream()),roots[ri],rootRes,{ctm:[...pageBase],rgb:[0,0,0],width:1,path:null,stack:[]},'P'+ri,0,[])}catch(_){ctx.incomplete=true}return{refs:roots,strokes:out,incomplete:ctx.incomplete,forms:ctx.forms}}"
new="const rootState={ctm:[...pageBase],rgb:[0,0,0],width:1,path:null,stack:[]};for(let ri=0;ri<roots.length;ri++)try{if(rootState.path&&deepKey(rootState.path.sourceRef)!==deepKey(roots[ri]))rootState.path.cross=true;scanText(latin(roots[ri].readStream()),roots[ri],rootRes,rootState,'P'+ri,0,[])}catch(_){ctx.incomplete=true}if(rootState.path)ctx.incomplete=true;return{refs:roots,strokes:out,incomplete:ctx.incomplete,forms:ctx.forms}}"
assert old in s; s=s.replace(old,new)
a=s.index('function alignCost(v,s){'); b=s.index('function setButtons()',a)
new_align=r'''function alignCost(v,s){if(!s||s.editable===false)return Infinity;const pd=Math.max(1,Math.hypot(pageW,pageH)),vw=Math.abs(Number(v.width||0)),sw=Math.abs(Number(s.width||0)),wt=Math.max(.12,Math.max(vw,sw)*.55),cd=Math.min(2,colorDist(v.rgb,s.rgb)),vcx=(v.bbox[0]+v.bbox[2])/2,vcy=(v.bbox[1]+v.bbox[3])/2,scx=(s.bbox[0]+s.bbox[2])/2,scy=(s.bbox[1]+s.bbox[3])/2,center=Math.hypot(vcx-scx,vcy-scy)/pd,vsx=Math.abs(v.bbox[2]-v.bbox[0]),vsy=Math.abs(v.bbox[3]-v.bbox[1]),ssx=Math.abs(s.bbox[2]-s.bbox[0]),ssy=Math.abs(s.bbox[3]-s.bbox[1]),size=(Math.abs(vsx-ssx)+Math.abs(vsy-ssy))/pd,seg=Math.abs(v.segs-s.segs)/Math.max(1,v.segs,s.segs),topo=((v.curves>0)!==(s.curves>0)?1:0)+((v.lines>0)!==(s.lines>0)?1:0),ep=Math.min(Math.hypot(s.fx-v.first[0],s.fy-v.first[1])+Math.hypot(s.lx-v.last[0],s.ly-v.last[1]),Math.hypot(s.fx-v.last[0],s.fy-v.last[1])+Math.hypot(s.lx-v.first[0],s.ly-v.first[1]))/(2*pd);return center*3.2+size*1.5+ep*2.2+seg*.9+topo*.8+Math.min(2,Math.abs(vw-sw)/wt)*.25+Math.min(2,cd/.12)*.15}
function mapBlue(vs,blocked=[]){
 if(!model?.strokes?.length||model.incomplete)return{items:[],mode:model?.incomplete?'modelo interno incompleto':'sin modelo estructural'};
 if(!vs.length)return{items:[],mode:'sin selección'};
 const used=new Set(blocked),n=classicVisual.length,m=model.strokes.length,K=160;
 if(m<vs.length+used.size)return{items:[],mode:'menos operadores estructurales que trazos azules'};
 const layers=[];
 for(const v of vs){
   const target=(Number(v._ordinal||0)+.5)/Math.max(1,n),anchor=Math.max(0,Math.min(m-1,Math.round(target*m-.5))),window=Math.max(120,Math.ceil(m*.06)),best=[],seen=new Set();
   const add=si=>{if(si<0||si>=m||seen.has(si))return;seen.add(si);const st=model.strokes[si];if(used.has(st)||st?.editable===false)return;const c=alignCost(v,st);if(!Number.isFinite(c))return;const order=Math.abs(target-(si+.5)/Math.max(1,m));best.push({s:st,idx:si,score:c+order*.55})};
   for(let si=Math.max(0,anchor-window);si<=Math.min(m-1,anchor+window);si++)add(si);
   if(best.length<K)for(let si=0;si<m;si+=Math.max(1,Math.floor(m/240)))add(si);
   best.sort((x,y)=>x.score-y.score);const keep=best.slice(0,K).sort((x,y)=>x.idx-y.idx);
   if(!keep.length)return{items:[],mode:'sin operadores editables para parte de lo azul'};layers.push(keep)
 }
 const states=[layers[0].map(c=>({cost:c.score,prev:-1}))];
 for(let li=1;li<layers.length;li++){const A=layers[li-1],B=layers[li],pv=states[li-1],cur=new Array(B.length);let bc=Infinity,bi=-1,p=0;for(let j=0;j<B.length;j++){while(p<A.length&&A[p].idx<B[j].idx){if(pv[p].cost<bc){bc=pv[p].cost;bi=p}p++}cur[j]={cost:Number.isFinite(bc)?bc+B[j].score:Infinity,prev:bi}}states.push(cur)}
 let end=-1,best=Infinity,last=states.at(-1);for(let i=0;i<last.length;i++)if(last[i].cost<best){best=last[i].cost;end=i}
 if(end<0||!Number.isFinite(best)){const out=[];let prev=-1;for(const v of vs){const target=(Number(v._ordinal||0)+.5)/Math.max(1,n);let idx=Math.max(prev+1,Math.round(target*m-.5));while(idx<m&&(used.has(model.strokes[idx])||model.strokes[idx]?.editable===false))idx++;if(idx>=m)return{items:[],mode:'sin ruta monotónica incluso por orden proporcional'};out.push(model.strokes[idx]);prev=idx}return{items:out,mode:'orden proporcional transaccional '+out.length+'/'+vs.length}}
 const out=new Array(layers.length);for(let li=layers.length-1;li>=0;li--){out[li]=layers[li][end].s;end=states[li][end].prev}
 return{items:out,mode:'alineación tolerante multipath '+out.length+'/'+vs.length+' · K='+K}
}
'''
s=s[:a]+new_align+s[b:]
Path('cloud-similar-selector-v61-core.html').write_text(s)
w=Path('cloud-similar-selector-v60.html').read_text()
w=w.replace('Selector de nubes v60 · mapeo disperso','Selector de nubes v61 · multipath tolerante').replace('cloud-similar-selector-v60-core.html?v=20260902-sparse1','cloud-similar-selector-v61-core.html?v=20260902-multipath1').replace("console.error('v60 batch hooks'","console.error('v61 batch hooks'")
Path('cloud-similar-selector-v61.html').write_text(w)
