from pathlib import Path

CORE = Path('lab-selector-v4/selector-nubes-multistream-core.html')
WRAP = Path('lab-selector-v4/index.html')
core = CORE.read_text(encoding='utf-8')
wrap = WRAP.read_text(encoding='utf-8')

old = "saveToBuffer('incremental,compress')"
new = "saveToBuffer('compress')"
assert old in core, 'flatmem7 save option marker not found'
core = core.replace(old, new, 1)

wrap = wrap.replace('selector-nubes-multistream-core.html?v=20260907-flatmem7',
                    'selector-nubes-multistream-core.html?v=20260907-flatmem8')

CORE.write_text(core, encoding='utf-8')
WRAP.write_text(wrap, encoding='utf-8')
print('flatmem8 full rewrite with compression applied')
