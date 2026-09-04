from pathlib import Path
p=Path('selector-nubes-multistream-core.html')
s=p.read_text()
old="async function removeGroup(){if(!doc||!activeBytes||!visualSelected.length)return;if(!model){"
new="async function removeGroup(){if(!doc||!activeBytes||!visualSelected.length)return;const earlyHugeVisualCount=classicVisual.length;if(earlyHugeVisualCount>=250000){status.textContent='Borrado bloqueado sin modificar el PDF: página excepcionalmente grande ('+earlyHugeVisualCount+' trazos visuales). Para evitar otro Out of memory, esta versión no inicia deepModel, mapeo, copias ni verificaciones de borrado en páginas de este tamaño. La selección azul se conserva.';setButtons();return}if(!model){"
if old not in s:
    raise SystemExit('anchor not found')
s=s.replace(old,new,1)
p.write_text(s)
print('patched',len(s))
