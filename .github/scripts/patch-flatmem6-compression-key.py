from pathlib import Path

CORE = Path('lab-selector-v4/selector-nubes-multistream-core.html')
WRAP = Path('lab-selector-v4/index.html')
core = CORE.read_text(encoding='utf-8')
wrap = WRAP.read_text(encoding='utf-8')

old = "incremental,compress=flate,compress-effort=0"
new = "incremental,compress=flate,compression-effort=0"
assert old in core, 'flatmem5 save option marker not found'
core = core.replace(old, new, 1)

wrap = wrap.replace('selector-nubes-multistream-core.html?v=20260907-flatmem5',
                    'selector-nubes-multistream-core.html?v=20260907-flatmem6')

CORE.write_text(core, encoding='utf-8')
WRAP.write_text(wrap, encoding='utf-8')
print('flatmem6 compression option key corrected')
