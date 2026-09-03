from pathlib import Path

core = Path('selector-nubes-multistream-core.html')
wrap = Path('selector-fast.html')

c = core.read_text(encoding='utf-8')
w = wrap.read_text(encoding='utf-8')

repls_core = [
("const dpr=Math.min(2,window.devicePixelRatio||1),maxDim=2600,maxPixels=5_000_000,base=Math.min(1.55*dpr,maxDim/Math.max(pageW,pageH),Math.sqrt(maxPixels/Math.max(1,pageW*pageH)));baseRs=Math.max(.45,base);",
 "const dpr=Math.min(2,window.devicePixelRatio||1),maxDim=1900,maxPixels=2_000_000,base=Math.min(1.20*dpr,maxDim/Math.max(pageW,pageH),Math.sqrt(maxPixels/Math.max(1,pageW*pageH)));baseRs=Math.max(.30,base);"),
("await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));",
 "await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(r,40))));"),
("scheduleSharp(650)\n}",
 "if('requestIdleCallback'in window)requestIdleCallback(()=>scheduleSharp(80),{timeout:4500});else scheduleSharp(2500)\n}")
]
for old,new in repls_core:
    if old not in c:
        raise SystemExit('missing core pattern: '+old[:100])
    c=c.replace(old,new,1)

old = "let entries=[],activeIndex=-1,queuedHandle=null,child=null,childDoc=null,saveObserver=null,nativeChildPicker=null,switchSerial=0;const mupdfMetaPromise=import('https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js');const fmtBytes="
new = "let entries=[],activeIndex=-1,queuedHandle=null,child=null,childDoc=null,saveObserver=null,nativeChildPicker=null,switchSerial=0,mupdfMetaPromise=null;const getMupdfMeta=()=>mupdfMetaPromise||(mupdfMetaPromise=import('https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js'));const fmtBytes="
if old not in w: raise SystemExit('missing wrapper import pattern')
w=w.replace(old,new,1)
if "mupdf=await mupdfMetaPromise" not in w: raise SystemExit('missing wrapper await pattern')
w=w.replace("mupdf=await mupdfMetaPromise","mupdf=await getMupdfMeta()",1)
if "requestIdleCallback(run,{timeout:2500});else setTimeout(run,1200)" not in w: raise SystemExit('missing wrapper idle pattern')
w=w.replace("requestIdleCallback(run,{timeout:2500});else setTimeout(run,1200)","requestIdleCallback(run,{timeout:6000});else setTimeout(run,3500)",1)
w=w.replace("./selector-nubes-multistream-core.html?v=20260903-compact1","./selector-nubes-multistream-core.html?v=20260903-previewfast2",1)

core.write_text(c,encoding='utf-8')
wrap.write_text(w,encoding='utf-8')
print('patched preview pipeline + lazy metadata MuPDF')
