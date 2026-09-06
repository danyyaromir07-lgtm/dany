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

d=fitz.open(); p=d.new_page(width=400,height=400)
s1=add_stream(d,b'1 0 0 RG 1 w 50 50 m 60 60 l\n')
s2=add_stream(d,b'70 50 l S\n0 1 0 RG 1 w 100 100 m 110 110 l 120 100 l S\n')
s3=add_stream(d,b'0 0 1 RG 1 w 150 150 m 160 165 l 175 150 l S\n')
set_contents_array(d,p,[s1,s2,s3]); d.save('lab-tests/fixtures/multistream-cross.pdf'); d.close()

src=fitz.open(); sp=src.new_page(width=100,height=100)
sh=sp.new_shape(); sh.draw_line((10,50),(30,70)); sh.draw_line((30,70),(50,50)); sh.finish(color=(1,0,0),width=1); sh.commit()
out=fitz.open(); tp=out.new_page(width=400,height=200)
tp.show_pdf_page(fitz.Rect(20,20,120,120),src,0)
tp.show_pdf_page(fitz.Rect(180,20,280,120),src,0)
out.save('lab-tests/fixtures/reused-form.pdf'); out.close(); src.close()
print('fixtures generated')
