from pathlib import Path
p=Path('foxit-index-engine.mjs')
s=p.read_text()
needle="export function mapSelected(vs,idx,ords){if(vs.length===idx.count){let ok=true;const step=Math.max(1,Math.floor(vs.length/97));for(let i=0;i<vs.length;i+=step)if(cost(vs[i],idx,i)>.015){ok=false;break}if(ok)return{ids:ords.slice(),mode:'ordinal-verificado'}}"
replacement="function ordinalGeometryOK(v,idx,k){const o=k*12,F=idx.F,I=idx.I,t=1e-3;return I[k*4]===v.lines&&I[k*4+1]===v.curves&&Math.abs(F[o]-v.bbox[0])<=t&&Math.abs(F[o+1]-v.bbox[1])<=t&&Math.abs(F[o+2]-v.bbox[2])<=t&&Math.abs(F[o+3]-v.bbox[3])<=t&&Math.abs(F[o+4]-v.first[0])<=t&&Math.abs(F[o+5]-v.first[1])<=t&&Math.abs(F[o+6]-v.last[0])<=t&&Math.abs(F[o+7]-v.last[1])<=t}\nexport function mapSelected(vs,idx,ords){if(vs.length===idx.count){let ok=true;const step=Math.max(1,Math.floor(vs.length/97));for(let i=0;i<vs.length;i+=step)if(!ordinalGeometryOK(vs[i],idx,i)){ok=false;break}if(ok)return{ids:ords.slice(),mode:'ordinal-geometria-verificada'}}"
if needle not in s:
    raise SystemExit('ordinal target not found')
s=s.replace(needle,replacement,1)
p.write_text(s)
print('patched ordinal identity to exact geometry/topology')
