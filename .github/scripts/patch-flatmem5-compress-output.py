from pathlib import Path

CORE = Path('lab-selector-v4/selector-nubes-multistream-core.html')
WRAP = Path('lab-selector-v4/index.html')
core = CORE.read_text(encoding='utf-8')
wrap = WRAP.read_text(encoding='utf-8')

old = "const outBuf=work.saveToBuffer('incremental'),out=new Uint8Array(U(outBuf));"
new = "const outBuf=work.saveToBuffer('incremental,compress=flate,compress-effort=0'),out=new Uint8Array(U(outBuf));if(model?.flatCurveExact&&out.length>Math.max(activeBytes.length*4,activeBytes.length+64_000_000))throw new Error('el PDF resultante quedó anormalmente grande; se cancela antes de sustituir la copia activa');"
assert old in core, 'exact flat save marker not found'
core = core.replace(old, new, 1)

wrap = wrap.replace('selector-nubes-multistream-core.html?v=20260907-flatmem4',
                    'selector-nubes-multistream-core.html?v=20260907-flatmem5')

CORE.write_text(core, encoding='utf-8')
WRAP.write_text(wrap, encoding='utf-8')
print('flatmem5 compressed-output patch applied')
