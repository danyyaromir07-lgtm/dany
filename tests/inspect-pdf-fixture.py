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
    for cx in contents:
        stream = doc.xref_stream(cx)
        if stream is None:
            print(f'  content={cx} stream=None')
            continue
        s = stream.decode('latin1', errors='replace')
        print(f'  content={cx} stream_bytes={len(stream)} BT={s.count("BT")} ET={s.count("ET")} Tf={s.count(" Tf")} Tj={s.count(" Tj")} TJ={s.count(" TJ")}')
        if NEEDLE in s:
            print('  RAW_ASCII_NEEDLE_FOUND')
        # Print small windows around likely text operators.
        for marker in ('/R12', 'Tf', 'Tj', 'TJ'):
            pos = s.find(marker)
            if pos >= 0:
                print(f'  {marker}_WINDOW=', repr(s[max(0,pos-180):pos+320]))
                break

if not found:
    raise SystemExit('Fixture does not expose the expected needle through text extraction')
print('FIXTURE_TEXT_OK')
