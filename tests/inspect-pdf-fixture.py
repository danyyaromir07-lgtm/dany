import fitz
import re
from pathlib import Path

PDF = Path('test-pdfs/UP3_LIM_E03_PLA_I59_02_ER_70_A34_7034.pdf')
NEEDLE = 'LIM_E03_PLA'

def parse_cmap(data: bytes):
    s = data.decode('latin1', errors='replace')
    m = {}
    for block in re.findall(r'(?:\d+\s+)?beginbfchar(.*?)endbfchar', s, re.S):
        for a, b in re.findall(r'<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>', block):
            raw = bytes.fromhex(b)
            m[int(a, 16)] = raw.decode('utf-16-be') if len(raw) % 2 == 0 else raw.decode('latin1')
    for block in re.findall(r'(?:\d+\s+)?beginbfrange(.*?)endbfrange', s, re.S):
        for a, z, u in re.findall(r'<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>', block):
            a, z, u = int(a, 16), int(z, 16), int(u, 16)
            for c in range(a, z + 1):
                m[c] = chr(u + c - a)
        for a, z, arr in re.findall(r'<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*\[([^\]]+)\]', block, re.S):
            a, z = int(a, 16), int(z, 16)
            vals = re.findall(r'<([0-9a-fA-F]+)>', arr)
            for c, rawhex in zip(range(a, z + 1), vals):
                raw = bytes.fromhex(rawhex)
                m[c] = raw.decode('utf-16-be') if len(raw) % 2 == 0 else raw.decode('latin1')
    return m

def decode_pdf_string(raw: bytes, cmap):
    # Only the simple literal strings emitted by this fixture are needed here.
    out = []
    for b in raw:
        out.append(cmap.get(b, f'\\x{b:02x}'))
    return ''.join(out)

doc = fitz.open(PDF)
print(f'pages={doc.page_count}')
found = False
for pno, page in enumerate(doc):
    text = page.get_text('text')
    print(f'page={pno+1} extracted_chars={len(text)} needle={NEEDLE in text}')
    if NEEDLE in text:
        found = True
        print('EXTRACTED_MATCH=', text[text.index(NEEDLE)-30:text.index(NEEDLE)+len(NEEDLE)+30].replace('\n', '\\n'))

    r12 = next((f[0] for f in page.get_fonts(full=True) if f[4] == 'R12'), None)
    if r12 is None:
        raise SystemExit('R12 font resource not found')
    kind, value = doc.xref_get_key(r12, 'ToUnicode')
    mref = re.search(r'(\d+)\s+0\s+R', value or '')
    if not mref:
        raise SystemExit(f'R12 ToUnicode is not an indirect reference: {kind=} {value=}')
    tu_xref = int(mref.group(1))
    cmap = parse_cmap(doc.xref_stream(tu_xref))
    print(f'R12 font xref={r12} ToUnicode xref={tu_xref} cmap_entries={len(cmap)}')
    print('R12 sample=', {k: cmap[k] for k in sorted(cmap)[:12]})
    for code, ch in cmap.items():
        if ch in 'LIM_E03OPLA':
            print(f'  code {code:02x} -> {ch!r}')

    stream = doc.xref_stream(page.get_contents()[0]).decode('latin1', errors='replace')
    # Capture every BT..ET block and decode R12 strings inside it.
    bt_blocks = re.findall(r'BT(.*?)ET', stream, re.S)
    decoded_blocks = []
    for idx, block in enumerate(bt_blocks):
        if '/R12' not in block:
            continue
        pieces = []
        for lit in re.findall(r'\(([^()]*)\)', block):
            pieces.append(decode_pdf_string(lit.encode('latin1'), cmap))
        for hx in re.findall(r'<([0-9a-fA-F\s]+)>', block):
            raw = bytes.fromhex(re.sub(r'\s+', '', hx))
            pieces.append(''.join(cmap.get(b, f'\\x{b:02x}') for b in raw))
        decoded = ''.join(pieces)
        decoded_blocks.append((idx, decoded))
        if any(ch in decoded for ch in 'LIM_E03OPLA'):
            print(f'R12_BT[{idx}]={decoded!r}')

    joined = ''.join(x[1] for x in decoded_blocks)
    print('R12_JOINED_CONTAINS_NEEDLE=', NEEDLE in joined)
    if NEEDLE in joined:
        at = joined.index(NEEDLE)
        print('R12_JOINED_MATCH=', joined[max(0, at-40):at+len(NEEDLE)+40])
        # Identify which BT blocks contain the characters around the match.
        cur = 0
        for idx, decoded in decoded_blocks:
            nxt = cur + len(decoded)
            if at < nxt and at + len(NEEDLE) > cur:
                print(f'NEEDLE_TOUCHES_BT index={idx} decoded={decoded!r}')
            cur = nxt

if not found:
    raise SystemExit('Fixture does not expose the expected needle through text extraction')
print('FIXTURE_TEXT_OK')
