from pathlib import Path
src=Path('selector-nubes-causal-anotaciones-core.html').read_text()
for needle in ["kind==='hybrid'",'attemptHybrid','hybridPlan','annotations:annotationPlans','RUTA CAUSAL COMPLETA']:
 p=src.find(needle)
 print('\n###',needle,p)
 if p>=0: print(src[max(0,p-3500):p+8000])
