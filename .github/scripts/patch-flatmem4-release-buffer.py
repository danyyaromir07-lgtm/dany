from pathlib import Path

CORE = Path('lab-selector-v4/selector-nubes-multistream-core.html')
WRAP = Path('lab-selector-v4/index.html')
core = CORE.read_text(encoding='utf-8')
wrap = WRAP.read_text(encoding='utf-8')

old = "return{refs:[ref],strokes:out,incomplete:false,forms:0,locators,ordinalSafe:true,flatCurveExact:true,flatStreamLength:u.length,flatCompressedLength:info.compressed}}"
new = "const flatStreamLength=u.length;try{buf?.destroy?.()}catch(_){}return{refs:[ref],strokes:out,incomplete:false,forms:0,locators,ordinalSafe:true,flatCurveExact:true,flatStreamLength,flatCompressedLength:info.compressed}}"
assert old in core, 'flat giant model return marker not found'
core = core.replace(old, new, 1)

# New cache key/path only; no UI or navigation behavior changes.
wrap = wrap.replace('selector-nubes-multistream-core.html?v=20260907-flatmem3',
                    'selector-nubes-multistream-core.html?v=20260907-flatmem4')

CORE.write_text(core, encoding='utf-8')
WRAP.write_text(wrap, encoding='utf-8')
print('flatmem4 buffer-release patch applied')
