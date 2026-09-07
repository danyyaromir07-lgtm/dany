from pathlib import Path

CORE = Path('lab-selector-v4/selector-nubes-multistream-core.html')
WRAP = Path('lab-selector-v4/index.html')
core = CORE.read_text(encoding='utf-8')
wrap = WRAP.read_text(encoding='utf-8')

old_info = "function flatHugeInfo(page,force=false){const roots=refs(page);if(roots.length!==1||flatHasFormXObject(page))return null;let compressed=0;try{compressed=deepNum(deepObj(roots[0])?.get?.('Length'))}catch(_){}if(!force&&(!Number.isFinite(compressed)||compressed<8_000_000))return null;return{ref:roots[0],compressed}}"
new_info = "function flatHugeInfo(page,force=false){const roots=refs(page);if(!roots.length||flatHasFormXObject(page))return null;let compressed=0;for(const ref of roots){let n=NaN;try{n=deepNum(deepObj(ref)?.get?.('Length'))}catch(_){}if(!Number.isFinite(n)||n<0)return null;compressed+=n}if(!force&&compressed<8_000_000)return null;return roots.length===1?{ref:roots[0],refs:roots,compressed,multi:false}:{refs:roots,compressed,multi:true}}"
if core.count(old_info) != 1:
    raise SystemExit('flatHugeInfo flatmem9 marker not found exactly once')
core = core.replace(old_info, new_info, 1)

marker = "function flatGiantExactModel(page,force=false){const info=flatHugeInfo(page,force);if(!info)return null;const ref=info.ref,buf=ref.readStream()"
if core.count(marker) != 1:
    raise SystemExit('flatGiantExactModel marker not found exactly once')

helper = r'''function flatGiantMultiExactModel(page,info){
 const roots=info.refs||[];if(roots.length<2)return null;
 const locators=new Map(),flatStreamLengths=new Map();for(let ri=0;ri<roots.length;ri++)locators.set(deepKey(roots[ri]),{root:ri,names:[]});
 let pageBase=[1,0,0,1,0,0];try{pageBase=mupdf.Matrix.invert(page.getTransform())}catch(_){}
 let A=pageBase[0],B=pageBase[1],C=pageBase[2],D=pageBase[3],E=pageBase[4],F=pageBase[5],R=0,G=0,BL=0,W=1,stack=[];
 let nv=new Float64Array(8),ns=new Uint32Array(8),nr=new Int32Array(8),nn=0,pOn=false,pA=1,pB=0,pC=0,pD=1,pE=0,pF=0,x0=0,y0=0,x1=0,y1=0,fx=0,fy=0,lx=0,ly=0,lines=0,curves=0,pR=0,pG=0,pBL=0,pW=1,pCmds=[],pRanges=[],out=[];
 const put=(v,s,r)=>{if(nn<8){nv[nn]=v;ns[nn]=s;nr[nn]=r;nn++}else{for(let k=1;k<8;k++){nv[k-1]=nv[k];ns[k-1]=ns[k];nr[k-1]=nr[k]}nv[7]=v;ns[7]=s;nr[7]=r}},tail=k=>nv[nn-k],tailS=k=>ns[nn-k],tailR=k=>nr[nn-k],P=(x,y)=>[A*x+C*y+E,B*x+D*y+F];
 const add=(x,y)=>{if(!pOn){x0=x1=fx=lx=x;y0=y1=fy=ly=y;pOn=true}else{if(x<x0)x0=x;if(y<y0)y0=y;if(x>x1)x1=x;if(y>y1)y1=y;lx=x;ly=y}};
 const begin=()=>{if(!pOn){pA=A;pB=B;pC=C;pD=D;pE=E;pF=F;pR=R;pG=G;pBL=BL;pW=W;lines=curves=0;pCmds=[];pRanges=[]}};
 const addRange=(u,ref,ri,start,end)=>{if(start<0||end<=start||end>u.length)throw new Error('rango gráfico multi-stream inválido');pRanges.push({ref,start,end,originalBytes:u.slice(start,end)})};
 const argStart=(k,ri)=>{if(nn<k)return-1;if(tailR(k)!==ri)throw new Error('operador gráfico dividido entre streams; identidad exacta no segura');return tailS(k)};
 const finish=(u,ref,ri,st,end,close)=>{if(!pOn)return;if(close){pCmds.push(['Z'])}addRange(u,ref,ri,st,end);if(curves>0){const bbox=[x0,y0,x1,y1],first=[fx,fy],last=[lx,ly],met=flatMetrics(pCmds,bbox,first,last),firstRange=pRanges[0],lastRange=pRanges[pRanges.length-1],sourceBase=deepKey(firstRange.ref),sourceKey='M|'+pRanges.map(r=>deepKey(r.ref)+'|'+r.start+'|'+r.end).join('>'),rec={cmds:pCmds.slice(),bbox,first,last,lines,curves,segs:lines+curves,width:pW,rgb:[pR,pG,pBL],closed:met.closed,chordNorm:met.chordNorm,lengthNorm:met.lengthNorm,start:firstRange.start,end:lastRange.end,sourceRef:firstRange.ref,sourceBase,fx,fy,lx,ly,editable:true,cross:pRanges.some(r=>deepKey(r.ref)!==sourceBase),editRanges:pRanges.map(r=>({ref:r.ref,start:r.start,end:r.end,originalBytes:r.originalBytes})),locator:locators.get(sourceBase),sourceKey,instanceKey:'P0|'+sourceKey,originalBytes:firstRange.originalBytes};out.push(rec)}pOn=false;pCmds=[];pRanges=[]};
 for(let ri=0;ri<roots.length;ri++){
  const ref=roots[ri],buf=ref.readStream(),u=U(buf),n=u.length;flatStreamLengths.set(deepKey(ref),n);let i=0;
  try{
   while(i<n){let c=u[i];if(flatWs(c)){i++;continue}if(c===37){while(i<n&&u[i]!==10&&u[i]!==13)i++;continue}const st=i;
    if(c===40){i++;let d=1;while(i<n&&d){c=u[i];if(c===92){i+=2;continue}if(c===40)d++;else if(c===41)d--;i++}nn=0;continue}
    if(c===60){if(i+1<n&&u[i+1]===60)i+=2;else{i++;while(i<n&&u[i]!==62)i++;if(i<n)i++;nn=0;continue}}
    else if(c===91){i++;let d=1;while(i<n&&d){c=u[i];if(c===40){i++;let q=1;while(i<n&&q){c=u[i];if(c===92){i+=2;continue}if(c===40)q++;else if(c===41)q--;i++}continue}if(c===91)d++;else if(c===93)d--;i++}nn=0;continue}
    else if(c===47){i++;while(i<n&&!flatDelim(u[i]))i++;continue}else while(i<n&&!flatDelim(u[i]))i++;
    const tok=flatAscii(u,st,i),fc=tok.charCodeAt(0);if(tok&&((fc>=48&&fc<=57)||fc===43||fc===45||fc===46)){const z=Number(tok);if(Number.isFinite(z)){put(z,st,ri);continue}}
    const op=tok;
    if(op==='q'){stack.push(A,B,C,D,E,F,R,G,BL,W)}
    else if(op==='Q'){if(stack.length>=10){W=stack.pop();BL=stack.pop();G=stack.pop();R=stack.pop();F=stack.pop();E=stack.pop();D=stack.pop();C=stack.pop();B=stack.pop();A=stack.pop()}}
    else if(op==='cm'&&nn>=6){if(tailR(6)!==ri)throw new Error('cm dividido entre streams; identidad exacta no segura');const a=tail(6),b=tail(5),c2=tail(4),d=tail(3),e=tail(2),f=tail(1),na=A*a+C*b,nb=B*a+D*b,nc=A*c2+C*d,nd=B*c2+D*d,ne=A*e+C*f+E,nf=B*e+D*f+F;A=na;B=nb;C=nc;D=nd;E=ne;F=nf}
    else if(op==='RG'&&nn>=3){if(tailR(3)!==ri)throw new Error('RG dividido entre streams; identidad exacta no segura');R=tail(3);G=tail(2);BL=tail(1)}
    else if(op==='G'&&nn>=1){if(tailR(1)!==ri)throw new Error('G dividido entre streams; identidad exacta no segura');R=G=BL=tail(1)}
    else if(op==='w'&&nn>=1){if(tailR(1)!==ri)throw new Error('w dividido entre streams; identidad exacta no segura');W=tail(1)}
    else if(op==='m'&&nn>=2){begin();const a=argStart(2,ri),p=P(tail(2),tail(1));add(p[0],p[1]);pCmds.push(['M',p[0],p[1]]);addRange(u,ref,ri,a,i)}
    else if(op==='l'&&pOn&&nn>=2){const a=argStart(2,ri),p=P(tail(2),tail(1));add(p[0],p[1]);pCmds.push(['L',p[0],p[1]]);lines++;addRange(u,ref,ri,a,i)}
    else if(op==='c'&&pOn&&nn>=6){const a=argStart(6,ri),p1=P(tail(6),tail(5)),p2=P(tail(4),tail(3)),p3=P(tail(2),tail(1));add(p1[0],p1[1]);add(p2[0],p2[1]);add(p3[0],p3[1]);pCmds.push(['C',p1[0],p1[1],p2[0],p2[1],p3[0],p3[1]]);curves++;addRange(u,ref,ri,a,i)}
    else if(op==='v'&&pOn&&nn>=4){const a=argStart(4,ri),p1=[lx,ly],p2=P(tail(4),tail(3)),p3=P(tail(2),tail(1));add(p1[0],p1[1]);add(p2[0],p2[1]);add(p3[0],p3[1]);pCmds.push(['C',p1[0],p1[1],p2[0],p2[1],p3[0],p3[1]]);curves++;addRange(u,ref,ri,a,i)}
    else if(op==='y'&&pOn&&nn>=4){const a=argStart(4,ri),p1=P(tail(4),tail(3)),p3=P(tail(2),tail(1));add(p1[0],p1[1]);add(p3[0],p3[1]);add(p3[0],p3[1]);pCmds.push(['C',p1[0],p1[1],p3[0],p3[1],p3[0],p3[1]]);curves++;addRange(u,ref,ri,a,i)}
    else if(op==='re'&&nn>=4){begin();const a=argStart(4,ri),x=tail(4),y=tail(3),w=tail(2),h=tail(1),p0=P(x,y),p1=P(x+w,y),p2=P(x+w,y+h),p3=P(x,y+h);for(const p of[p0,p1,p2,p3])add(p[0],p[1]);pCmds.push(['M',p0[0],p0[1]],['L',p1[0],p1[1]],['L',p2[0],p2[1]],['L',p3[0],p3[1]],['Z']);lines+=3;addRange(u,ref,ri,a,i)}
    else if(op==='h'&&pOn){pCmds.push(['Z']);addRange(u,ref,ri,st,i)}
    else if(op==='S'||op==='B'||op==='B*')finish(u,ref,ri,st,i,false)
    else if(op==='s'||op==='b'||op==='b*')finish(u,ref,ri,st,i,true)
    else if(op==='n'||op==='f'||op==='F'||op==='f*'){pOn=false;pCmds=[];pRanges=[]}
    nn=0;
   }
  }finally{try{buf?.destroy?.()}catch(_){}}
 }
 if(pOn)throw new Error('ruta gráfica abierta al final de Contents; identidad exacta no segura');
 return{refs:roots,strokes:out,incomplete:false,forms:0,locators,ordinalSafe:true,flatCurveExact:true,flatMultiExact:true,flatStreamLengths,flatCompressedLength:info.compressed};
}
'''
core = core.replace(marker, helper + "\n" + marker.replace("const ref=info.ref,buf=ref.readStream()", "if(info.multi)return flatGiantMultiExactModel(page,info);const ref=info.ref,buf=ref.readStream()"), 1)

old_orig = "originals.set(deepKey(r.ref)+'|'+r.start+'|'+r.end,t.originalBytes)"
new_orig = "originals.set(deepKey(r.ref)+'|'+r.start+'|'+r.end,r.originalBytes||t.originalBytes)"
if core.count(old_orig) != 1:
    raise SystemExit('flat exact original-byte mapping marker not found exactly once')
core = core.replace(old_orig, new_orig, 1)

old_plan = "plan.push({flat:true,loc,length:model.flatStreamLength,ranges})"
new_plan = "plan.push({flat:true,multi:!!model.flatMultiExact,loc,length:model.flatStreamLengths?.get(g.key)??model.flatStreamLength,ranges})"
if core.count(old_plan) != 1:
    raise SystemExit('flat plan length marker not found exactly once')
core = core.replace(old_plan, new_plan, 1)

old_write = "ref.writeStream(buf);touched++;continue"
new_write = "ref.writeStream(buf);if(g.multi)try{buf?.destroy?.()}catch(_){}touched++;continue"
if core.count(old_write) != 1:
    raise SystemExit('flat native buffer write marker not found exactly once')
core = core.replace(old_write, new_write, 1)

if '20260907-flatmem9' not in wrap:
    raise SystemExit('Expected flatmem9 wrapper cache marker')
wrap = wrap.replace('20260907-flatmem9', '20260907-flatmem10')

CORE.write_text(core, encoding='utf-8')
WRAP.write_text(wrap, encoding='utf-8')
print('flatmem10: exact sequential multi-stream flat scanner installed; single-stream path preserved')
