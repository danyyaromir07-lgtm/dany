from pathlib import Path
src=Path('selector-nubes-causal-anotaciones-core.html').read_text()
for needle in ['kind:\'hybrid\'','attemptHybrid','hybridPlan','annotations:annotationPlans','INSTANCIA AISLADA LISTA']:
    p=src.find(needle)
    print('\n###',needle,p)
    if p>=0: print(src[max(0,p-5000):p+9000])
