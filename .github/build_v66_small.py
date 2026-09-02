from pathlib import Path
import re

core = Path("cloud-similar-selector-v65-core.html").read_text()
core = core.replace("Selector de nubes v65 · verificación con copia control",
                    "Selector de nubes v66 · copia directa y verificación exacta")
core = core.replace("let doc=null,handle=null,baseUrl=null,detailUrl=null,",
                    "let doc=null,handle=null,activeBytes=null,baseUrl=null,detailUrl=null,")

old_open = """async function openPdf(){if(!('showOpenFilePicker'in window))throw new Error('Usa Chrome o Edge.');const[h]=await showOpenFilePicker({multiple:false,types:[{description:'PDF',accept:{'application/pdf':['.pdf']}}]});const f=await h.getFile();try{doc?.destroy?.()}catch(_){}doc=mupdf.PDFDocument.openDocument(new Uint8Array(await f.arrayBuffer()),'application/pdf');handle=h;pending=false;await renderPage()}"""
new_open = """async function openPdf(){if(!('showOpenFilePicker'in window))throw new Error('Usa Chrome o Edge.');const[h]=await showOpenFilePicker({multiple:false,types:[{description:'PDF',accept:{'application/pdf':['.pdf']}}]});const f=await h.getFile(),bytes=new Uint8Array(await f.arrayBuffer());try{doc?.destroy?.()}catch(_){}activeBytes=bytes;doc=mupdf.PDFDocument.openDocument(activeBytes,'application/pdf');handle=h;pending=false;await renderPage()}"""
assert old_open in core
core = core.replace(old_open, new_open)

core = core.replace(
    "async function removeGroup(){if(!doc||!model||!selectionMapSafe||!visualSelected.length)return;",
    "async function removeGroup(){if(!doc||!model||!activeBytes||!selectionMapSafe||!visualSelected.length)return;"
)

old_expected = "let expected=null;const bagOK=a=>{if(!expected||a.length!==beforeVisual-selectedVisual)return false;"
new_expected = "let expected=new Map();for(const v of classicVisual){if(visualSelected.includes(v))continue;const k=sig(v);expected.set(k,(expected.get(k)||0)+1)}const bagOK=a=>{if(a.length!==beforeVisual-selectedVisual)return false;"
assert old_expected in core
core = core.replace(old_expected, new_expected)

pat = re.compile(r"const base=doc\.saveToBuffer\('garbage=4,compress=yes,appearance=yes'\),outBase=new Uint8Array\(U\(base\)\);let ctrl=null,ctrl2=null,ctrlPage=null;try\{.*?\}finally\{.*?\}let lastError='ninguna correspondencia superó la verificación contra copia control';")
m = pat.search(core)
assert m, "control block not found"
core = core[:m.start()] + "const outBase=new Uint8Array(activeBytes);let lastError='ninguna correspondencia superó la verificación exacta';" + core[m.end():]

old_attempt = "work=mupdf.PDFDocument.openDocument(outBase,'application/pdf');wp=work.loadPage(0);const wm=deepModel(wp);"
new_attempt = "work=mupdf.PDFDocument.openDocument(outBase,'application/pdf');wp=work.loadPage(0);const baselineVisual=collectVisual(wp),wm=deepModel(wp);if(baselineVisual.length!==beforeVisual)throw new Error('la copia directa no reproduce el mismo número de trazos visuales ('+beforeVisual+' → '+baselineVisual.length+')');"
assert old_attempt in core
core = core.replace(old_attempt, new_attempt)

old_savepoint = "if(!touched)throw new Error('no se encontró ningún stream editable');const outBuf=work.saveToBuffer('garbage=4,compress=yes,appearance=yes')"
new_savepoint = "if(!touched)throw new Error('no se encontró ningún stream editable');wp.destroy?.();wp=work.loadPage(0);const previewVisual=collectVisual(wp),previewModel=deepModel(wp);if(!previewModel||previewModel.incomplete||previewModel.strokes.length!==beforeStruct-selectedIdx.length)throw new Error('antes de guardar, el modelo estructural no equivale a original menos operadores seleccionados');if(!bagOK(previewVisual))throw new Error('antes de guardar, la geometría editada no coincide exactamente con original menos azul');const outBuf=work.saveToBuffer('garbage=4,compress=yes,appearance=yes')"
assert old_savepoint in core
core = core.replace(old_savepoint, new_savepoint)

core = core.replace(
    "throw new Error('la geometría resultante no coincide exactamente con copia control menos azul')",
    "throw new Error('después de guardar, la geometría no coincide exactamente con original menos azul')"
)
old_success = "if(ok){doc.destroy();doc=mupdf.PDFDocument.openDocument(ok.out,'application/pdf');"
new_success = "if(ok){activeBytes=ok.out;doc.destroy();doc=mupdf.PDFDocument.openDocument(activeBytes,'application/pdf');"
assert old_success in core
core = core.replace(old_success, new_success)

core = core.replace("ninguna pasó la verificación contra copia control", "ninguna pasó la verificación exacta")

old_disk = "const b=doc.saveToBuffer('garbage=4,compress=yes,appearance=yes');await w.write(new Uint8Array(U(b)));"
new_disk = "if(!activeBytes)throw new Error('No hay una copia activa del PDF para guardar.');await w.write(activeBytes);"
assert old_disk in core
core = core.replace(old_disk, new_disk)
Path("cloud-similar-selector-v66-core.html").write_text(core)

wrap = Path("cloud-similar-selector-v65.html").read_text()
wrap = wrap.replace("Selector de nubes v65 · verificación con copia control",
                    "Selector de nubes v66 · copia directa + metadatos")
wrap = wrap.replace("cloud-similar-selector-v65-core.html?v=20260902-control1",
                    "cloud-similar-selector-v66-core.html?v=20260902-direct1")
wrap = wrap.replace(".fileName{font-weight:700!important}",
                    ".fileName{font-weight:700!important}.fileInfo{min-width:0;display:grid;gap:4px}.fileMeta{font-size:11px;color:#8298ae;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}")

decl = "let entries=[],activeIndex=-1,queuedHandle=null,child=null,childDoc=null,saveObserver=null,nativeChildPicker=null,switchSerial=0;"
decl2 = decl + "const mupdfMetaPromise=import('https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js');const fmtBytes=n=>{if(!Number.isFinite(n))return'—';const u=['B','KB','MB','GB'];let i=0,v=n;while(v>=1024&&i<u.length-1){v/=1024;i++}return(v>=100||i===0?Math.round(v):v.toFixed(1))+' '+u[i]};"
assert decl in wrap
wrap = wrap.replace(decl, decl2)

old_row = "const name=document.createElement('span');name.className='fileName';name.textContent=entry.name;const state=document.createElement('span');state.className='fileState '+stateClass(entry.state);state.textContent=entry.state;row.append(name,state);"
new_row = "const info=document.createElement('span');info.className='fileInfo';const name=document.createElement('span');name.className='fileName';name.textContent=entry.name;const meta=document.createElement('span');meta.className='fileMeta';meta.textContent=(entry.pages==null?'… páginas':entry.pages+' página'+(entry.pages===1?'':'s'))+' · '+fmtBytes(entry.size);info.append(name,meta);const state=document.createElement('span');state.className='fileState '+stateClass(entry.state);state.textContent=entry.state;row.append(info,state);"
assert old_row in wrap
wrap = wrap.replace(old_row, new_row)

old_batch = "entries=handles.map(h=>({handle:h,name:h.name||'PDF sin nombre',state:'Sin abrir'}));activeIndex=-1;queuedHandle=null;searchEl.value='';renderList();await activate(0)"
new_batch = "entries=handles.map(h=>({handle:h,name:h.name||'PDF sin nombre',state:'Sin abrir',size:null,pages:null}));activeIndex=-1;queuedHandle=null;searchEl.value='';renderList();await activate(0);hydrateMetadata()"
assert old_batch in wrap
wrap = wrap.replace(old_batch, new_batch)

marker = "batchBtn.addEventListener('click',loadBatch);"
meta_fn = "async function hydrateMetadata(){let mupdf=null;try{mupdf=await mupdfMetaPromise}catch(_){return}for(let i=0;i<entries.length;i++){const e=entries[i];try{const f=await e.handle.getFile();e.size=f.size;const bytes=new Uint8Array(await f.arrayBuffer()),d=mupdf.PDFDocument.openDocument(bytes,'application/pdf');e.pages=Number(d.countPages?.()||0);d.destroy?.()}catch(_){e.pages=e.pages??null}renderList()}}\n"
assert marker in wrap
wrap = wrap.replace(marker, meta_fn + marker)

Path("cloud-similar-selector-v66.html").write_text(wrap)

scripts=re.findall(r'<script type="module">(.*?)</script>',core,re.S); assert len(scripts)==1
Path("/tmp/v66.mjs").write_text(scripts[0])
plain=re.findall(r'<script>(.*?)</script>',wrap,re.S); assert plain
Path("/tmp/v66-wrapper.js").write_text("\n".join(plain))
assert "activeBytes=ok.out" in core and "await w.write(activeBytes)" in core
assert "antes de guardar" in core and "después de guardar" in core
assert "hydrateMetadata" in wrap and "countPages" in wrap and "fmtBytes" in wrap
