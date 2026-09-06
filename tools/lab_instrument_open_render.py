from pathlib import Path
p=Path('selector-nubes-multistream-core.html')
s=p.read_text()
repls=[
("async function renderPage(){\n clearDetail();", "async function renderPage(){\n console.log('PRE:renderPage:enter');clearDetail();"),
(" const p=doc.loadPage(0);pageBounds=p.getBounds();", " console.log('PRE:before-loadPage');const p=doc.loadPage(0);console.log('PRE:after-loadPage');pageBounds=p.getBounds();"),
(" const pm=p.toPixmap(mupdf.Matrix.scale(baseRs,baseRs),mupdf.ColorSpace.DeviceRGB,false,true),png=pm.asPNG();", " console.log('PRE:before-pixmap',baseRs,pageW,pageH);const pm=p.toPixmap(mupdf.Matrix.scale(baseRs,baseRs),mupdf.ColorSpace.DeviceRGB,false,true);console.log('PRE:after-pixmap');const png=pm.asPNG();console.log('PRE:after-png',U(png)?.length);"),
("img.src=baseUrl;await img.decode();img.style.width=", "img.src=baseUrl;console.log('PRE:before-img-decode');await img.decode();console.log('PRE:after-img-decode');img.style.width="),
(" await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(r,40))));\n try{\n  classicVisual=collectVisual(p);", " console.log('PRE:before-frame-yield');await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(r,40))));console.log('PRE:after-frame-yield');\n try{\n  console.log('PRE:before-collectVisual');classicVisual=collectVisual(p);console.log('PRE:after-collectVisual',classicVisual.length);"),
(" indexPromise=startCompactIndex();", " console.log('PRE:before-startCompactIndex');indexPromise=startCompactIndex();console.log('PRE:after-startCompactIndex-call');"),
("async function openPdf(){if(!('showOpenFilePicker'in window))throw new Error('Usa Chrome o Edge.');const[h]=await showOpenFilePicker", "async function openPdf(){console.log('PRE:openPdf:enter');if(!('showOpenFilePicker'in window))throw new Error('Usa Chrome o Edge.');console.log('PRE:before-picker');const[h]=await showOpenFilePicker"),
("const f=await h.getFile(),bytes=new Uint8Array(await f.arrayBuffer());try{doc?.destroy?.()}catch(_){}activeBytes=bytes;doc=mupdf.PDFDocument.openDocument(activeBytes,'application/pdf');handle=h;pending=false;await renderPage()}", "console.log('PRE:after-picker');const f=await h.getFile();console.log('PRE:after-getFile',f.size);const bytes=new Uint8Array(await f.arrayBuffer());console.log('PRE:after-arrayBuffer',bytes.length);try{doc?.destroy?.()}catch(_){}activeBytes=bytes;console.log('PRE:before-openDocument');doc=mupdf.PDFDocument.openDocument(activeBytes,'application/pdf');console.log('PRE:after-openDocument');handle=h;pending=false;console.log('PRE:before-renderPage');await renderPage();console.log('PRE:after-renderPage')}")
]
for old,new in repls:
    if old not in s: raise SystemExit('anchor not found: '+old[:120])
    s=s.replace(old,new,1)
p.write_text(s)
print('open/render instrumentation applied')
