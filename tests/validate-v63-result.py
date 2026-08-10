import fitz
from pathlib import Path

SRC = Path('test-pdfs/UP3_LIM_E03_PLA_I59_02_ER_70_A34_7034.pdf')
OUT = Path('test-pdfs/_v63_result.pdf')
OLD = 'UP3_LIM_E03_PLA_I59_02_ER_70_A34_7034'
NEW = 'UP3_LIM_O03_PLA_I59_02_ER_70_A34_7034'
OLD_CODES = bytes.fromhex('170e204914030a49191711')
NEW_CODES = bytes.fromhex('170e20490f030a49191711')

if not OUT.exists():
    raise SystemExit('Edited PDF was not produced')

src = fitz.open(SRC)
out = fitz.open(OUT)
if out.page_count != src.page_count:
    raise SystemExit(f'page count changed: {src.page_count} -> {out.page_count}')

src_page = src[0]
out_page = out[0]
src_text = src_page.get_text('text')
out_text = out_page.get_text('text')
print('OUTPUT_PDF_VALID= true')
print('EXPECTED_NEW_TEXT=', NEW in out_text)
print('OLD_FULL_TEXT_ABSENT=', OLD not in out_text)
if NEW not in out_text:
    raise SystemExit('new text not found by extraction')
if OLD in out_text:
    raise SystemExit('old full text still present')

src_ann = len(list(src_page.annots() or []))
out_ann = len(list(out_page.annots() or []))
src_img = len(src_page.get_images(full=True))
out_img = len(out_page.get_images(full=True))
print(f'ANNOTATIONS={src_ann}->{out_ann}')
print(f'IMAGES={src_img}->{out_img}')
if src_ann != out_ann:
    raise SystemExit('annotation count changed; text edit must not create annotations/FreeText')
if src_img != out_img:
    raise SystemExit('image count changed; text edit must not rasterize/replace content with images')

src_fonts = {f[4] for f in src_page.get_fonts(full=True)}
out_fonts = {f[4] for f in out_page.get_fonts(full=True)}
print('FONT_RESOURCES_PRESERVED=', src_fonts == out_fonts)
if not src_fonts.issubset(out_fonts):
    raise SystemExit('original font resources were not preserved')

src_spans = [s for b in src_page.get_text('dict')['blocks'] if 'lines' in b for l in b['lines'] for s in l['spans'] if OLD in s['text']]
out_spans = [s for b in out_page.get_text('dict')['blocks'] if 'lines' in b for l in b['lines'] for s in l['spans'] if NEW in s['text']]
if not src_spans or not out_spans:
    raise SystemExit('could not locate original/new text spans for geometry comparison')
a, b = src_spans[0], out_spans[0]
print('SPAN_FONT_PRESERVED=', a['font'] == b['font'])
print('SPAN_SIZE_PRESERVED=', abs(a['size'] - b['size']) < 1e-6)
print('SPAN_COLOR_PRESERVED=', a.get('color') == b.get('color'))
print('SPAN_FLAGS_PRESERVED=', a.get('flags') == b.get('flags'))
print('SPAN_ORIGIN_PRESERVED=', all(abs(x-y) < 1e-4 for x,y in zip(a['origin'], b['origin'])))
if a['font'] != b['font'] or abs(a['size']-b['size']) >= 1e-6 or a.get('color') != b.get('color') or a.get('flags') != b.get('flags'):
    raise SystemExit('font/style characteristics changed')

for page in out:
    for cx in page.get_contents():
        raw = out.xref_stream(cx) or b''
        if NEW_CODES in raw:
            print('NEW_CODE_SEQUENCE_IN_CONTENT_STREAM= true')
        if OLD_CODES in raw:
            print('OLD_CODE_SEQUENCE_STILL_IN_CONTENT_STREAM= true')
            raise SystemExit('original target code sequence remains in content stream')

print('V63_OUTPUT_VALIDATION_OK')
