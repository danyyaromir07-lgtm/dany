import os, re
import pymupdf as fitz

N=int(os.environ.get('STRESS_N','100000'))
os.makedirs('lab-tests/fixtures',exist_ok=True)
doc=fitz.open(); page=doc.new_page(width=1000,height=1000)
parts=[b'1 0 0 RG 1 w 20 20 m 40 20 l S\n', b'0 0 0 RG 0.2 w\n']
# Dense but deterministic short lines. Each path is independent and visually unique by position.
for i in range(N):
    row=i//500
    col=i%500
    x=10+col*1.9
    y=50+(row%470)*2.0
    parts.append(f'{x:.1f} {y:.1f} m {x+0.7:.1f} {y:.1f} l S\n'.encode())
stream=b''.join(parts)
x=doc.get_new_xref(); doc.update_object(x,'<<>>'); doc.update_stream(x,stream)
s=doc.xref_object(page.xref,compressed=False)
if '/Contents' in s:
    s=re.sub(r'/Contents\s+(?:\[[^\]]*\]|\d+\s+\d+\s+R)',f'/Contents {x} 0 R',s,count=1,flags=re.S)
else:
    s=s.rsplit('>>',1)[0]+f' /Contents {x} 0 R >>'
doc.update_object(page.xref,s)
out=f'lab-tests/fixtures/stress-{N+1}.pdf'
doc.save(out,garbage=0,deflate=True); doc.close()
print(out,os.path.getsize(out),len(stream))
