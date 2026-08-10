import fitz
from pathlib import Path

PDF = Path('test-pdfs/UP3_LIM_E03_PLA_I59_02_ER_70_A34_7034.pdf')
NEEDLE = 'LIM_E03_PLA'

doc = fitz.open(PDF)
print(f'pages={doc.page_count}')
print(f'metadata={doc.metadata}')

found = False
for pno, page in enumerate(doc):
    text = page.get_text('text')
    print(f'page={pno+1} extracted_chars={len(text)} needle={NEEDLE in text}')
    if NEEDLE in text:
        found = True
        print('EXTRACTED_MATCH=', text[text.index(NEEDLE)-30:text.index(NEEDLE)+len(NEEDLE)+30].replace('\n', '\\n'))

    xref = page.xref
    contents = page.get_contents()
    print(f'page={pno+1} page_xref={xref} content_xrefs={contents}')

    fonts = page.get_fonts(full=True)
    for f in fonts:
        # (xref, ext, type, basefont, name, encoding, referencer, ...)
        fx = f[0]
        print(f'  FONT xref={fx} type={f[2]} basefont={f[3]!r} name={f[4]!r}')
        try:
            print('  FONT_OBJECT=', doc.xref_object(fx, compressed=False)[:1200].replace('\n', '\\n'))
        except Exception as e:
            print('  FONT_OBJECT_ERROR=', repr(e))
        try:
            print('  TOUNICODE_KEY=', doc.xref_get_key(fx, 'ToUnicode'))
            tu = doc.xref_get_key(fx, 'ToUnicode')[1]
            if isinstance(tu, str) and tu.startswith('xref'):
                tx = int(tu.split()[1])
                cmap = doc.xref_stream(tx)
                print(f'  TOUNICODE_XREF={tx} bytes={len(cmap) if cmap else 0}')
                if cmap:
                    cs = cmap.decode('latin1', errors='replace')
                    print('  TOUNICODE_STREAM=', repr(cs[:5000]))
        except Exception as e:
            print('  TOUNICODE_ERROR=', repr(e))

    for cx in contents:
        stream = doc.xref_stream(cx)
        if stream is None:
            print(f'  content={cx} stream=None')
            continue
        s = stream.decode('latin1', errors='replace')
        print(f'  content={cx} stream_bytes={len(stream)} BT={s.count("BT")} ET={s.count("ET")} Tf={s.count(" Tf")} Tj={s.count(" Tj")} TJ={s.count(" TJ")}')
        for marker in ('/R12 7.50192 Tf', 'LIM_E03_PLA', 'TJ'):
            pos = s.find(marker)
            if pos >= 0:
                print(f'  {marker}_WINDOW=', repr(s[max(0,pos-350):pos+700]))
                break

if not found:
    raise SystemExit('Fixture does not expose the expected needle through text extraction')
print('FIXTURE_TEXT_OK')
