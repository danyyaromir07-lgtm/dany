from pathlib import Path
p=Path('foxit-index-engine.mjs')
s=p.read_text()
old="width=Math.abs(F[o+8]-v.width)/Math.max(.1,Math.abs(v.width),Math.abs(F[o+8]))"
new="width=Math.abs(Number(v.width||0))<1e-9?0:Math.abs(F[o+8]-v.width)/Math.max(.1,Math.abs(v.width),Math.abs(F[o+8]))"
if old not in s:
    raise SystemExit('target expression not found')
s=s.replace(old,new,1)
p.write_text(s)
print('patched visual unknown width handling')
