from pathlib import Path
p=Path("selector-nubes-multistream-core.html")
s=p.read_text()
old="""function compactSeqToken(x){
 const r=n=>Math.round(Number(n||0)*1000)/1000;
 const rgb=Array.isArray(x?.rgb)?x.rgb.slice(0,3).map(r):[];
 return [Number(x?.lines||0),Number(x?.curves||0),Number(x?.segs??((x?.lines||0)+(x?.curves||0))),r(x?.width),...rgb].join('|');
}"""
new="""function compactSeqToken(x){
 // Common parser-stable topology only. Width/color/coordinates are intentionally
 // excluded from the global alignment because MuPDF visual callbacks and the
 // compact PDF parser can normalize those values differently. Safety comes from
 // requiring a unique optimal ordinal mapping and from the exact transactional
 // visual/structural verification before the active PDF is replaced.
 return Number(x?.lines||0)+'|'+Number(x?.curves||0);
}"""
if old not in s:
    raise SystemExit("current compactSeqToken marker missing")
s=s.replace(old,new,1)
s=s.replace("la secuencia exacta no cabe en una alineación acotada · coste=","la secuencia topológica no cabe en una alineación acotada · coste=",1)
s=s.replace("alineación global exacta por secuencia · coste ","alineación global topológica única · coste ",1)
s=s.replace("alineando secuencia visual↔estructural completa para ","alineando topología visual↔estructural completa para ",1)
for q in ["strictCompactBandedMap","alineación global topológica única","expansión por componente","Sin rutas alternativas ni causal."]:
    if q not in s:
        raise SystemExit("missing invariant: "+q)
p.write_text(s)
