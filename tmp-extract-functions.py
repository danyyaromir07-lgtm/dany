from pathlib import Path
s=Path('selector-nubes-causal-total-core.html').read_text()
names=['buildCausalRouteSmall','buildCausalRoute','attempt','removeGroup','attemptInstance']
out=[]
for name in names:
    for prefix in ['async function '+name,'function '+name]:
        i=s.find(prefix)
        if i>=0:
            b=s.find('{',i); depth=0; q=None; esc=False; j=b
            while j<len(s):
                c=s[j]
                if q:
                    if esc: esc=False
                    elif c=='\\': esc=True
                    elif c==q: q=None
                else:
                    if c in "'\"`": q=c
                    elif c=='{': depth+=1
                    elif c=='}':
                        depth-=1
                        if depth==0:
                            j+=1; break
                j+=1
            text=s[i:j]
            text=text.replace(';',';\n').replace('{','{\n').replace('}','}\n')
            out.append('===== '+name+' =====\n'+text)
            break
Path('tmp-functions.txt').write_text('\n\n'.join(out))
