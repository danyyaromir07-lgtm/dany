import fitz, re, os
os.makedirs('lab-tests/fixtures', exist_ok=True)

def add_stream(doc, data: bytes):
    x=doc.get_new_xref(); doc.update_object(x,'<<>>'); doc.update_stream(x,data); return x

def set_contents_array(doc,page,xrefs):
    s=doc.xref_object(page.xref, compressed=False)
    val='[ '+' '.join(f'{x} 0 R' for x in xrefs)+' ]'
    if '/Contents' in s:
        s=re.sub(r'/Contents\s+(?:\[[^\]]*\]|\d+\s+\d+\s+R)', '/Contents '+val, s, count=1, flags=re.S)
    else:
        s=s.rsplit('>>',1)[0]+' /Contents '+val+' >>'
    doc.update_object(page.xref,s)

cols, rows = 400, 300
count = cols * rows
chunks = 24
per = count // chunks
commands=[]
for i in range(count):
    x=8+(i % cols)*12
    y=8+(i // cols)*12
    commands.append(f'0 0 0 RG 0.5 w {x} {y} m {x+2} {y+2} l {x+4} {y} l S\n')
d=fitz.open(); p=d.new_page(width=5000,height=3700)
xrefs=[]
for c in range(chunks):
    lo=c*per; hi=count if c==chunks-1 else (c+1)*per
    xrefs.append(add_stream(d,''.join(commands[lo:hi]).encode('ascii')))
set_contents_array(d,p,xrefs)
d.save('lab-tests/fixtures/large-120k.pdf', garbage=0, deflate=True)
d.close()
print('large fixture generated',count,'strokes',chunks,'contents streams')
