from pathlib import Path
p=Path("selector-nubes-multistream-core.html")
s=p.read_text()
start=s.find("async function strictCompactBandedMap(vs){")
end=s.find("async function strictCompactAnchoredMap(vs){", start)
if start < 0 or end < 0:
    raise SystemExit("banded mapper markers missing")
fn=r'''async function strictCompactBandedMap(vs){
 if(!model?.strokes?.length||model.incomplete)return{ok:false,why:model?.incomplete?'recorrido estructural incompleto':'sin índice estructural'};
 if(!vs?.length)return{ok:false,why:'sin selección azul'};
 const A=classicVisual,B=model.strokes,n=A.length,m=B.length,delta=Math.abs(n-m),band=Math.min(32,Math.max(12,delta+10)),W=band*2+1,INF=65535;
 const at=(i,j)=>{const k=j-i+band;return k<0||k>=W?-1:i*W+k};
 const step=(a,b)=>compactSeqToken(a)===compactSeqToken(b)?0:1;
 const F=new Uint16Array((n+1)*W);F.fill(INF);
 let q=at(0,0);if(q<0)return{ok:false,why:'banda ordinal inválida'};F[q]=0;
 for(let i=0;i<=n;i++){
  const j0=Math.max(0,i-band),j1=Math.min(m,i+band);
  for(let j=j0;j<=j1;j++){
   const idx=at(i,j),cur=F[idx];if(cur===INF)continue;
   if(i<n&&j<m){const z=at(i+1,j+1),v=cur+step(A[i],B[j]);if(z>=0&&v<F[z])F[z]=v}
   if(i<n){const z=at(i+1,j),v=cur+1;if(z>=0&&v<F[z])F[z]=v}
   if(j<m){const z=at(i,j+1),v=cur+1;if(z>=0&&v<F[z])F[z]=v}
  }
  if((i&4095)===4095)await uiYield();
 }
 const end=at(n,m),best=end>=0?F[end]:INF;
 if(best===INF)return{ok:false,why:'la secuencia ordenada no cabe en la banda ordinal'};
 const R=new Uint16Array((n+1)*W);R.fill(INF);q=at(n,m);R[q]=0;
 for(let i=n;i>=0;i--){
  const j0=Math.max(0,i-band),j1=Math.min(m,i+band);
  for(let j=j1;j>=j0;j--){
   const idx=at(i,j),cur=R[idx];if(cur===INF)continue;
   if(i>0&&j>0){const z=at(i-1,j-1),v=cur+step(A[i-1],B[j-1]);if(z>=0&&v<R[z])R[z]=v}
   if(i>0){const z=at(i-1,j),v=cur+1;if(z>=0&&v<R[z])R[z]=v}
   if(j>0){const z=at(i,j-1),v=cur+1;if(z>=0&&v<R[z])R[z]=v}
  }
  if((i&4095)===0)await uiYield();
 }
 const structOrd=[];
 for(let qi=0;qi<vs.length;qi++){
  const vi=Number(vs[qi]._ordinal);if(!Number.isInteger(vi)||vi<0||vi>=n)return{ok:false,why:'ordinal visual inválido en azul '+(qi+1)};
  const candidates=[],j0=Math.max(0,vi-band),j1=Math.min(m-1,vi+band);
  for(let j=j0;j<=j1;j++){
   const a=at(vi,j),b=at(vi+1,j+1);if(a<0||b<0)continue;
   const fa=F[a],rb=R[b];if(fa===INF||rb===INF)continue;
   const total=fa+step(A[vi],B[j])+rb;if(total===best)candidates.push(j);
  }
  if(candidates.length!==1)return{ok:false,why:'el azul '+(qi+1)+' tiene '+candidates.length+' correspondencias estructurales óptimas en la alineación global con sustituciones · coste='+best};
  structOrd.push(candidates[0]);
 }
 if(new Set(structOrd).size!==structOrd.length)return{ok:false,why:'dos azules convergen en el mismo origen estructural'};
 const pairs=vs.map((v,i)=>[Number(v._ordinal),structOrd[i]]).sort((a,b)=>a[0]-b[0]);for(let i=1;i<pairs.length;i++)if(pairs[i][1]<=pairs[i-1][1])return{ok:false,why:'la alineación global rompe el orden estructural'};
 return{ok:true,targets:structOrd.map(i=>B[i]),structOrd,cost:best};
}
'''
s=s[:start]+fn+s[end:]
s=s.replace('alineación global topológica única · coste ','alineación global ordenada única · coste ',1)
s=s.replace('alineando topología visual↔estructural completa para ','alineando secuencia visual↔estructural ordenada para ',1)
for q in ["strictCompactBandedMap","alineación global ordenada única","correspondencias estructurales óptimas en la alineación global con sustituciones","expansión por componente","Sin rutas alternativas ni causal."]:
    if q not in s:
        raise SystemExit("missing invariant: "+q)
p.write_text(s)
