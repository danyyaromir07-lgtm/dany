from pathlib import Path
import re
p=Path('selector-nubes-causal-total-core.html')
s=p.read_text()
needles=['function collect','function attempt','async function attempt','function removeGroup','async function removeGroup','buildCausal','getAnnotations','runPage','runPageContents','page.run','new mupdf.DrawDevice']
out=[]
for n in needles:
    pos=0
    while True:
        i=s.find(n,pos)
        if i<0: break
        a=max(0,i-1200); b=min(len(s),i+7000)
        out.append('\n===== '+n+' @ '+str(i)+' =====\n'+s[a:b])
        pos=i+len(n)
Path('tmp-unmodeled-snippets.txt').write_text('\n'.join(out))
