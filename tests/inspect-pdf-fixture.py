import fitz
import re
from pathlib import Path

PDF = Path('test-pdfs/UP3_LIM_E03_PLA_I59_02_ER_70_A34_7034.pdf')
NEEDLE = 'LIM_E03_PLA'

doc = fitz.open(PDF)
print(f'pages={doc.page_count}')

found = False
for pno, page in enumerate(doc):
    text = page.get_text('text')
    print(f'page={pno+1} extracted_chars={len(text)} needle={NEEDLE in text}')
    if NEEDLE in text:
        found = True
        print('EXTRACTED_MATCH=', text[text.index(NEEDLE)-30:text.index(NEEDLE)+len(NEEDLE)+30].replace('\n', '\\n'))

    print(f'page={pno+1} page_xref={page.xref} content_xrefs={page.get_contents()}')

    for f in page.get_fonts(full=True):
        fx, ext, ftype, basefont, name = f[:5]
        if name != 'R12':
            continue
        print(f'R12_FONT xref={fx} type={ftype} basefont={basefont!r} name={name!r}')
        print('R12_OBJECT=', doc.xref_object(fx, compressed=False)[:1500].replace('\n', '\\n'))
        kind, value = doc.xref_get_key(fx, 'ToUnicode')
        print(f'R12_ToUnicode_key_kind={kind} value={value!r}')
        m = re.search(r'(\d+)\s+0\s+R', value or '')
        if not m:
            raise SystemExit('R12 has no indirect ToUnicode reference')
        tx = int(m.group(1))
        cmap = doc.xref_stream(tx)
        print(f'R12_ToUnicode_xref={tx} bytes={len(cmap) if cmap else 0}')
        if not cmap:
            raise SystemExit('R12 ToUnicode stream is empty')
        cs = cmap.decode('latin1', errors='replace')
        print('R12_ToUnicode_stream=', repr(cs[:12000]))
        print('R12_HAS_L=', '<01> <004c>' in cs or '<01><004c>' in cs)
        print('R12_HAS_I=', '<02> <0049>' in cs or '<02><0049>' in cs)
        print('R12_HAS_M=', '<03> <004d>' in cs or '<03><004d>' in cs)
        print('R12_HAS_UNDERSCORE=', '<04> <005f>' in cs or '<04><005f>' in cs)

    for cx in page.get_contents():
        stream = doc.xref_stream(cx)
        s = stream.decode('latin1', errors='replace')
        if '/R12 7.50192 Tf' in s:
            pos = s.find('/R12 7.50192 Tf')
            print('R12_CONTENT_WINDOW=', repr(s[max(0,pos-350):pos+900]))

if not found:
    raise SystemExit('Fixture does not expose the expected needle through text extraction')
print('FIXTURE_TEXT_OK')
