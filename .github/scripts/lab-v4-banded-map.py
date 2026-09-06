from pathlib import Path
p=Path("selector-nubes-multistream-core.html")
s=p.read_text()
marker="async function strictCompactAnchoredMap(vs){"
if marker not in s:
    raise SystemExit("anchored mapper marker missing")

fn=r"""function compactSeqToken(x){
 const r=n=>Math.round(Number(n||0)*1000)/1000;
 const rgb=Array.isArray(x?.rgb)?x.rgb.slice(0,3).map(r):[];
 return [Number(x?.lines||0),Number(x?.curves||0),Number(x?.segs??((x?.lines||0)+(x?.curves||0))),r(x?.width),...rgb].join('|');
}
async function strictCompactBandedMap(vs){
 if(!model?.strokes?.length||model.incomplete)return{ok:false,why:model?.incomplete?'recorrido estructural incompleto':'sin índice estructural'};
 if(!vs?.length)return{ok:false,why:'sin selección azul'};
 const A=classicVisual,B=model.strokes,n=A.length,m=B.length,delta=Math.abs(n-m),band=Math.min(24,Math.max(10,delta+8)),W=band*2+1,INF=255,maxCost=Math.min(250,delta+16);
 const at=(i,j)=>{const k=j-i+band;return k<0||k>=W?-1:i*W+k};
 const F=new Uint8Array((n+1)*W);F.fill(INF);
 let q=at(0,0);if(q<0)return{ok:false,why:'banda ordinal inválida'};F[q]=0;
 for(let i=0;i<=n;i++){
  const j0=Math.max(0,i-band),j1=Math.min(m,i+band);
  for(let j=j0;j<=j1;j++){
   const idx=at(i,j),cur=F[idx];if(cur===INF)continue;
   if(i<n&&j<m&&compactSeqToken(A[i])===compactSeqToken(B[j])){const z=at(i+1,j+1);if(z>=0&&cur<F[z])F[z]=cur}
   if(i<n&&cur<maxCost){const z=at(i+1,j);if(z>=0&&cur+1<F[z])F[z]=cur+1}
   if(j<m&&cur<maxCost){const z=at(i,j+1);if(z>=0&&cur+1<F[z])F[z]=cur+1}
  }
  if((i&4095)===4095)await uiYield();
 }
 const end=at(n,m),best=end>=0?F[end]:INF;
 if(best===INF||best>maxCost)return{ok:false,why:'la secuencia exacta no cabe en una alineación acotada · coste='+String(best)};
 const R=new Uint8Array((n+1)*W);R.fill(INF);q=at(n,m);R[q]=0;
 for(let i=n;i>=0;i--){
  const j0=Math.max(0,i-band),j1=Math.min(m,i+band);
  for(let j=j1;j>=j0;j--){
   const idx=at(i,j),cur=R[idx];if(cur===INF)continue;
   if(i>0&&j>0&&compactSeqToken(A[i-1])===compactSeqToken(B[j-1])){const z=at(i-1,j-1);if(z>=0&&cur<R[z])R[z]=cur}
   if(i>0&&cur<maxCost){const z=at(i-1,j);if(z>=0&&cur+1<R[z])R[z]=cur+1}
   if(j>0&&cur<maxCost){const z=at(i,j-1);if(z>=0&&cur+1<R[z])R[z]=cur+1}
  }
  if((i&4095)===0)await uiYield();
 }
 const structOrd=[];
 for(let qi=0;qi<vs.length;qi++){
  const vi=Number(vs[qi]._ordinal);if(!Number.isInteger(vi)||vi<0||vi>=n)return{ok:false,why:'ordinal visual inválido en azul '+(qi+1)};
  const candidates=[],j0=Math.max(0,vi-band),j1=Math.min(m-1,vi+band),tok=compactSeqToken(A[vi]);
  for(let j=j0;j<=j1;j++){
   if(tok!==compactSeqToken(B[j]))continue;
   const a=at(vi,j),b=at(vi+1,j+1);if(a<0||b<0)continue;
   const fa=F[a],rb=R[b];if(fa!==INF&&rb!==INF&&fa+rb===best)candidates.push(j);
  }
  if(candidates.length!==1)return{ok:false,why:'el azul '+(qi+1)+' tiene '+candidates.length+' correspondencias estructurales óptimas en la alineación global · coste='+best};
  structOrd.push(candidates[0]);
 }
 if(new Set(structOrd).size!==structOrd.length)return{ok:false,why:'dos azules convergen en el mismo origen estructural'};
 const pairs=vs.map((v,i)=>[Number(v._ordinal),structOrd[i]]).sort((a,b)=>a[0]-b[0]);for(let i=1;i<pairs.length;i++)if(pairs[i][1]<=pairs[i-1][1])return{ok:false,why:'la alineación global rompe el orden estructural'};
 return{ok:true,targets:structOrd.map(i=>B[i]),structOrd,cost:best};
}
"""
if "async function strictCompactBandedMap(vs){" not in s:
    s=s.replace(marker,fn+marker,1)

old="""}else{
  status.textContent='Borrado exacto · demostrando identidad ordinal local por anclas para '+visualSelected.length+' trazos azules…';await uiYield();
  const am=await strictCompactAnchoredMap(visualSelected);if(!am.ok){status.textContent='Borrado bloqueado sin modificar el PDF: '+am.why+' ('+classicVisual.length+'/'+model.strokes.length+'). Sin rutas alternativas ni causal.';setButtons();return}
  targets=am.targets;structOrd=am.structOrd;mapMode='ordinal local anclada + verificación exacta';
 }
 """
new="""}else{
  status.textContent='Borrado exacto · alineando secuencia visual↔estructural completa para '+visualSelected.length+' trazos azules…';await uiYield();
  const bm=await strictCompactBandedMap(visualSelected);if(!bm.ok){status.textContent='Borrado bloqueado sin modificar el PDF: '+bm.why+' ('+classicVisual.length+'/'+model.strokes.length+'). Sin rutas alternativas ni causal.';setButtons();return}
  targets=bm.targets;structOrd=bm.structOrd;mapMode='alineación global exacta por secuencia · coste '+bm.cost+' + verificación exacta';
 }
 """
if old not in s:
    raise SystemExit("anchored unequal route not found")
s=s.replace(old,new,1)
for q in ["strictCompactBandedMap","alineación global exacta por secuencia","expansión por componente","Sin rutas alternativas ni causal."]:
    if q not in s:
        raise SystemExit("missing invariant: "+q)
p.write_text(s)
