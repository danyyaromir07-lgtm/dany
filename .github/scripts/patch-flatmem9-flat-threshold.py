from pathlib import Path

CORE = Path('lab-selector-v4/selector-nubes-multistream-core.html')
WRAP = Path('lab-selector-v4/index.html')

core = CORE.read_text(encoding='utf-8')
wrap = WRAP.read_text(encoding='utf-8')

old = 'compressed<10_000_000'
new = 'compressed<8_000_000'

if core.count(old) != 1:
    raise SystemExit(f'Expected exactly one flat giant threshold marker {old!r}, found {core.count(old)}')
core = core.replace(old, new, 1)

# Cache-bust only the isolated lab wrapper; no UI/behavior changes.
if '20260907-flatmem8' not in wrap:
    raise SystemExit('Expected flatmem8 cache marker not found in wrapper')
wrap = wrap.replace('20260907-flatmem8', '20260907-flatmem9')

CORE.write_text(core, encoding='utf-8')
WRAP.write_text(wrap, encoding='utf-8')
print('flatmem9: existing flat exact threshold lowered from 10 MB to 8 MB')
