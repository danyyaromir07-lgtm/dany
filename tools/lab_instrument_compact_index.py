from pathlib import Path

p=Path('selector-nubes-multistream-core.html')
s=p.read_text()

repls = [
("async function compactModel(page,epoch=-1,emit=null,collect=true){\n const out=collect?[]:null,roots=refs(page),ctx={incomplete:false,forms:0},rootRes=deepPageResources(page.getObject()),locators=new Map();let pageBase=[1,0,0,1,0,0];",
 "async function compactModel(page,epoch=-1,emit=null,collect=true){\n console.log('IDX:compactModel:enter',epoch,collect);\n const out=collect?[]:null;console.log('IDX:compactModel:before-refs');const roots=refs(page);console.log('IDX:compactModel:after-refs',roots.length);const ctx={incomplete:false,forms:0},rootRes=deepPageResources(page.getObject()),locators=new Map();let pageBase=[1,0,0,1,0,0];"),
(" const rootState={ctm:[...pageBase],rgb:[0,0,0],width:1,path:null,stack:[]};for(let ri=0;ri<roots.length;ri++){if(epoch>=0&&epoch!==indexEpoch)throw new Error('índice cancelado');try{if(rootState.path&&deepKey(rootState.path.sourceRef)!==deepKey(roots[ri]))rootState.path.cross=true;scanText(latin(roots[ri].readStream()),roots[ri],rootRes,rootState,'P'+ri,0,[],{root:ri,names:[]})}catch(e){if(e?.message==='índice cancelado')throw e;ctx.incomplete=true}if((ri&31)===31)await uiYield()}\n if(rootState.path)ctx.incomplete=true;return{refs:roots,strokes:out||[],incomplete:ctx.incomplete,forms:ctx.forms,locators};",
 " const rootState={ctm:[...pageBase],rgb:[0,0,0],width:1,path:null,stack:[]};for(let ri=0;ri<roots.length;ri++){if(epoch>=0&&epoch!==indexEpoch)throw new Error('índice cancelado');try{console.log('IDX:root:begin',ri);if(rootState.path&&deepKey(rootState.path.sourceRef)!==deepKey(roots[ri]))rootState.path.cross=true;console.log('IDX:root:before-read',ri);const __buf=roots[ri].readStream();console.log('IDX:root:after-read',ri,U(__buf)?.length);const __text=latin(__buf);console.log('IDX:root:before-scan',ri,__text.length);scanText(__text,roots[ri],rootRes,rootState,'P'+ri,0,[],{root:ri,names:[]});console.log('IDX:root:after-scan',ri,out?.length??-1)}catch(e){console.log('IDX:root:error',ri,String(e));if(e?.message==='índice cancelado')throw e;ctx.incomplete=true}if((ri&31)===31)await uiYield()}\n console.log('IDX:compactModel:roots-done',out?.length??-1,ctx.incomplete);if(rootState.path)ctx.incomplete=true;console.log('IDX:compactModel:return',out?.length??-1,ctx.incomplete);return{refs:roots,strokes:out||[],incomplete:ctx.incomplete,forms:ctx.forms,locators};"),
("async function startCompactIndex(){const my=++indexEpoch;indexReady=false;let p=null;try{p=doc.loadPage(0);const m=await compactModel(p,my);if(my!==indexEpoch)return null;let ordinal=m.strokes.length===classicVisual.length&&!m.incomplete;",
 "async function startCompactIndex(){const my=++indexEpoch;indexReady=false;let p=null;console.log('IDX:start',my);try{console.log('IDX:before-loadPage');p=doc.loadPage(0);console.log('IDX:after-loadPage');console.log('IDX:before-compactModel');const m=await compactModel(p,my);console.log('IDX:after-compactModel',m?.strokes?.length,m?.incomplete);if(my!==indexEpoch)return null;console.log('IDX:before-ordinal',classicVisual.length,m.strokes.length);let ordinal=m.strokes.length===classicVisual.length&&!m.incomplete;"),
("m.ordinalSafe=ordinal;model=m;indexReady=true;if(!visualSelected.length)status.textContent=",
 "console.log('IDX:after-ordinal',ordinal);m.ordinalSafe=ordinal;model=m;indexReady=true;if(!visualSelected.length)status.textContent="),
]

for old,new in repls:
    if old not in s:
        raise SystemExit('anchor not found: '+old[:100])
    s=s.replace(old,new,1)

p.write_text(s)
print('instrumentation applied')
