import fitz
import re
from pathlib import Path

PDF = Path('test-pdfs/UP3_LIM_E03_PLA_I59_02_ER_70_A34_7034.pdf')
NEEDLE = 'LIM_E03_PLA'
TARGET_CODES = bytes([0x17, 0x0e, 0x20, 0x49, 0x14, 0x03, 0x0a, 0x19, 0x17, 0x11])

doc = fitz.open(PDF)
print(f'pages={doc.page_count}')
found = False
for pno, page in enumerate(doc):
    text = page.get_text('text')
    print(f'page={pno+1} extracted_chars={len(text)} needle={NEEDLE in text}')
    if NEEDLE in text:
        found = True
        at = text.index(NEEDLE)
        print('EXTRACTED_MATCH=', text[max(0,at-30):at+len(NEEDLE)+30].replace('\n', '\\n'))

    r12 = next((f[0] for f in page.get_fonts(full=True) if f[4] == 'R12'), None)
    kind, value = doc.xref_get_key(r12, 'ToUnicode')
    tu_xref = int(re.search(r'(\d+)\s+0\s+R', value).group(1))
    cmap = doc.xref_stream(tu_xref).decode('latin1', errors='replace')
    print(f'R12 font={r12} ToUnicode={tu_xref} target_code_hex={TARGET_CODES.hex()}')

    stream = doc.xref_stream(page.get_contents()[0])
    raw_at = stream.find(TARGET_CODES)
    print(f'TARGET_CODE_SEQUENCE_RAW_FOUND={raw_at >= 0} offset={raw_at}')
    if raw_at >= 0:
        print('TARGET_CODE_WINDOW=', repr(stream[max(0,raw_at-500):raw_at+len(TARGET_CODES)+500].decode('latin1', errors='replace')))

    # Find the target code sequence even if split by TJ text-showing strings.
    positions=[]
    start=0
    while True:
        pos=stream.find(TARGET_CODES,start)
        if pos<0: break
        positions.append(pos); start=pos+1
    print('TARGET_CODE_POSITIONS=', positions[:20])

    # Report every BT block containing at least one target code.
    for idx, block in enumerate(re.findall(rb'BT(.*?)ET', stream, re.S)):
        if any(bytes([c]) in block for c in TARGET_CODES):
            print(f'BT_TARGET_CODE_BLOCK[{idx}] bytes={len(block)}')
            print('BT_TARGET_CODE_BLOCK_WINDOW=', repr(block[:2500].decode('latin1', errors='replace')))

if not found:
    raise SystemExit('Fixture does not expose the expected needle through text extraction')
print('FIXTURE_TEXT_OK')
