from pathlib import Path
p=Path('lab-selector-v4/selector-nubes-multistream-core.html')
s=p.read_text()
old="const buf=ref.readStream(),u=U(buf);if(u.length!==g.length)throw new Error('longitud del stream cambió en la copia');for(const r of g.ranges){if(!flatBytesEqualAt(u,r.start,r.original))throw new Error('rango seleccionado cambió en la copia');u.fill(32,r.start,r.end)}ref.writeStream(u);touched++;continue"
new="const buf=ref.readStream(),u=U(buf);if(u.length!==g.length)throw new Error('longitud del stream cambió en la copia');for(const r of g.ranges){if(!flatBytesEqualAt(u,r.start,r.original))throw new Error('rango seleccionado cambió en la copia');u.fill(32,r.start,r.end)}ref.writeStream(buf);touched++;continue"
assert old in s, 'flat write pattern not found'
s=s.replace(old,new,1)
p.write_text(s)
