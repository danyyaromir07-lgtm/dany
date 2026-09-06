from pathlib import Path

p=Path('selector-nubes-multistream-core.html')
s=p.read_text()
anchor=s.index('async function compactModel')
head,tail=s[:anchor],s[anchor:]
old="while(i<text.length){const t=nextToken(text,i);if(!t)break;i=t.next;if(t.type==='num'||t.type==='name'){args.push(t);continue}"
new="while(i<text.length){const prev=i,t=nextToken(text,i);if(!t)break;if(t.next<=prev){i=prev+1;args=[];continue}i=t.next;if(t.type==='num'||t.type==='name'){args.push(t);continue}"
if new in tail:
    print('compact scanner progress guard already present')
else:
    assert old in tail, 'compact scan loop not found'
    tail=tail.replace(old,new,1)
    p.write_text(head+tail)
    print('compact scanner progress guard applied')
