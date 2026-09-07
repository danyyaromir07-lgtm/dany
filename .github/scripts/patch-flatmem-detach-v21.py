from pathlib import Path
import re

CORE=Path('lab-selector-v4/selector-nubes-multistream-core.html')
WRAP=Path('lab-selector-v4/index.html')
s=CORE.read_text(encoding='utf-8')
w=WRAP.read_text(encoding='utf-8')

old="const bytes=new Uint8Array(await f.arrayBuffer());try{doc?.destroy?.()}catch(_){}activeBytes=bytes;doc=mupdf.PDFDocument.openDocument(activeBytes,'application/pdf');handle=h;pending=false;await renderPage();"
new="const bytes=new Uint8Array(await f.arrayBuffer());try{doc?.destroy?.()}catch(_){}activeBytes=bytes;const mupdfOpenBytes=bytes.slice();doc=mupdf.PDFDocument.openDocument(mupdfOpenBytes,'application/pdf');handle=h;pending=false;await renderPage();"
if old not in s:
    raise SystemExit('openPdf pattern not found')
s=s.replace(old,new,1)

# Give the isolated publication a fresh cache key only.
w=w.replace('selector-nubes-multistream-core.html?v=20260907-flatmem1','selector-nubes-multistream-core.html?v=20260907-flatmem2')

CORE.write_text(s,encoding='utf-8')
WRAP.write_text(w,encoding='utf-8')
print('patched detached-buffer ownership')
