import fitz
import re
from pathlib import Path

PDF = Path('test-pdfs/UP3_LIM_E03_PLA_I59_02_ER_70_A34_7034.pdf')
NEEDLE = 'LIM_E03_PLA'

def cmap_from_stream(data):
    s=data.decode('latin1','replace'); m={}
    for block in re.findall(r'(?:\d+\s+)?beginbfrange(.*?)endbfrange',s,re.S):
        for a,z,u in re.findall(r'<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>',block):
            a,z,u=int(a,16),int(z,16),int(u,16)
            for c in range(a,z+1): m[c]=chr(u+c-a)
    for block in re.findall(r'(?:\d+\s+)?beginbfchar(.*?)endbfchar',s,re.S):
        for a,b in re.findall(r'<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>',block):
            raw=bytes.fromhex(b); m[int(a,16)]=raw.decode('utf-16-be','replace')
    return m

def pdf_string_decode(raw,cmap):
    b=[];i=1
    while i<len(raw)-1:
        x=raw[i]
        if x!=92: b.append(x);i+=1;continue
        i+=1;x=raw[i]
        if x==110:b.append(10)
        elif x==114:b.append(13)
        elif x==116:b.append(9)
        elif x==98:b.append(8)
        elif x==102:b.append(12)
        elif x in (40,41,92):b.append(x)
        elif 48<=x<=55:
            v=x-48
            for _ in range(2):
                if i+1<len(raw)-1 and 48<=raw[i+1]<=55:i+=1;v=v*8+raw[i]-48
                else:break
            b.append(v)
        else:b.append(x)
    return ''.join(cmap.get(x,f'\\x{x:02x}') for x in b)

doc=fitz.open(PDF)
print(f'pages={doc.page_count}')
found=False
for pno,page in enumerate(doc):
    text=page.get_text('text'); print(f'page={pno+1} extracted_chars={len(text)} needle={NEEDLE in text}')
    if NEEDLE in text:
        found=True; at=text.index(NEEDLE); print('EXTRACTED_MATCH=',text[max(0,at-30):at+len(NEEDLE)+30].replace('\n','\\n'))
    r12=next(f[0] for f in page.get_fonts(full=True) if f[4]=='R12')
    tu=int(re.search(r'(\d+)\s+0\s+R',doc.xref_get_key(r12,'ToUnicode')[1]).group(1)); cmap=cmap_from_stream(doc.xref_stream(tu))
    stream=doc.xref_stream(page.get_contents()[0])
    # Tokenize just enough to track Tf and text strings inside BT/ET.
    for bi,block in enumerate(re.findall(rb'BT(.*?)ET',stream,re.S)):
        toks=re.findall(rb'/[A-Za-z0-9_.+-]+|\([^)]*\)|\[[^\]]*\]|[-+]?\d+(?:\.\d+)?|\S+',block)
        font=None; strings=[]
        for j,t in enumerate(toks):
            if t.startswith(b'/') and j+2<len(toks) and toks[j+2]==b'Tf': font=t[1:].decode('latin1')
            elif t.startswith(b'(') and t.endswith(b')') and font=='R12': strings.append(pdf_string_decode(t,cmap))
        if strings:
            decoded=''.join(strings)
            if NEEDLE in decoded or any(x in decoded for x in ('LIM','PLA','UP3')):
                print(f'R12_BT[{bi}]=',repr(decoded))
                print('R12_BT_HAS_NEEDLE=',NEEDLE in decoded)
    # Also locate the target in extracted text with its block index using page text blocks.
    for b in page.get_text('blocks'):
        if NEEDLE in b[4]: print('TEXT_BLOCK_WITH_NEEDLE=',repr(b[4]))

if not found: raise SystemExit('Fixture does not expose expected needle')
print('FIXTURE_TEXT_OK')
