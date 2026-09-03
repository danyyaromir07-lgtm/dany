from pathlib import Path
src=Path('selector-nubes-causal-anotaciones-core.html').read_text()
def fn(name):
 p=src.find('async function '+name+'(')
 if p<0:return ''
 b=src.find('{',p);d=0;i=b
 while i<len(src):
  if src[i]=='{': d+=1
  elif src[i]=='}':
   d-=1
   if d==0:return src[p:i+1]
  i+=1
 return ''
text=fn('attemptHybrid')
text=text.replace(';',';\n').replace('){','){\n').replace('}catch','}\ncatch').replace('}finally','}\nfinally')
print(text)
