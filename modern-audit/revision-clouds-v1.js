import * as mupdf from 'https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js';

const BOX = '#batchRemoveRevisionClouds';
const SUMMARY = '#batchSummary';
const STATUS = '#batchStatus';
const $ = s => document.querySelector(s);

function redPixel(r,g,b){return r>=150&&g<=150&&b<=150&&r>=g+45&&r>=b+45;}
function rgbRed(c){if(!Array.isArray(c)||c.length<3)return false;const [r,g,b]=c.map(Number);return r>=0.65&&g<=0.35&&b<=0.35&&r>=g+0.35&&r>=b+0.35;}
function box(a){return a?[+a[0],+a[1],+a[2],+a[3]]:null;}
function area(b){return Math.max(0,b[2]-b[0])*Math.max(0,b[3]-b[1]);}
function hit(a,b,p=0){return !(a[2]<b[0]-p||a[0]>b[2]+p||a[3]<b[1]-p||a[1]>b[3]+p);}
function nearEdge(a,b,p=2){return Math.abs(a[0]-b[0])<=p||Math.abs(a[1]-b[1])<=p||Math.abs(a[2]-b[2])<=p||Math.abs(a[3]-b[3])<=p||a[0]<=b[0]+p||a[1]<=b[1]+p||a[2]>=b[2]-p||a[3]>=b[3]-p;}
function tp(x,y,m){return [m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];}
function ops(path,ctm){const out=[];path.walk({moveTo(x,y){const p=tp(x,y,ctm);out.push(['m',p[0],p[1]])},lineTo(x,y){const p=tp(x,y,ctm);out.push(['l',p[0],p[1]])},curveTo(x1,y1,x2,y2,x3,y3){const a=tp(x1,y1,ctm),b=tp(x2,y2,ctm),c=tp(x3,y3,ctm);out.push(['c',a[0],a[1],b[0],b[1],c[0],c[1]])},closePath(){out.push(['h'])}});return out;}

function rasterComponents(page,scale=.35){
  const pix=page.toPixmap(mupdf.Matrix.scale(scale,scale),mupdf.ColorSpace.DeviceRGB,false,false);
  const w=pix.getWidth(),h=pix.getHeight(),nc=pix.getNumberOfComponents();if(nc<3||!w||!h)return[];
  const px=pix.getPixels(),m=new Uint8Array(w*h);
  for(let i=0,p=0;i<m.length;i++,p+=nc)m[i]=redPixel(px[p],px[p+1],px[p+2])?1:0;
  for(let pass=0;pass<2;pass++){
    const src=m.slice();
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const i=y*w+x;if(src[i])continue;let found=false;
      for(let dy=-1;dy<=1&&!found;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const nx=x+dx,ny=y+dy;if(nx>=0&&nx<w&&ny>=0&&ny<h&&src[ny*w+nx]){found=true;break}}
      if(found)m[i]=1;
    }
  }
  const seen=new Uint8Array(w*h),stack=new Int32Array(w*h),pb=box(page.getBounds()),out=[];
  for(let sy=0;sy<h;sy++)for(let sx=0;sx<w;sx++){
    const seed=sy*w+sx;if(!m[seed]||seen[seed])continue;let top=0,n=0,minX=sx,maxX=sx,minY=sy,maxY=sy;stack[top++]=seed;seen[seed]=1;
    while(top){const idx=stack[--top],y=(idx/w)|0,x=idx-y*w;n++;if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;
      const ns=[idx-1,idx+1,idx-w,idx+w];if(x>0&&m[ns[0]]&&!seen[ns[0]]){seen[ns[0]]=1;stack[top++]=ns[0]}if(x+1<w&&m[ns[1]]&&!seen[ns[1]]){seen[ns[1]]=1;stack[top++]=ns[1]}if(y>0&&m[ns[2]]&&!seen[ns[2]]){seen[ns[2]]=1;stack[top++]=ns[2]}if(y+1<h&&m[ns[3]]&&!seen[ns[3]]){seen[ns[3]]=1;stack[top++]=ns[3]}
    }
    const rw=maxX-minX+1,rh=maxY-minY+1,d=n/Math.max(1,rw*rh);
    if(n<250||rw<80||rh<80||d>0.15)continue;
    const rough=Math.max(rw,rh)/Math.max(1,Math.min(rw,rh));
    if(rough<1.1)continue;
    const sx2=(pb[2]-pb[0])/w,sy2=(pb[3]-pb[1])/h;
    out.push({box:[pb[0]+minX*sx2,pb[1]+minY*sy2,pb[0]+(maxX+1)*sx2,pb[1]+(maxY+1)*sy2],area:n,density:d});
  }
  return out.sort((a,b)=>b.area-a.area).slice(0,6);
}

function collectRedPaths(page,candidates){const paths=[];if(!candidates.length)return paths;const dev=new mupdf.Device({strokePath(path,stroke,ctm,cs,color,alpha){if(!rgbRed(color)||Number(alpha??1)<.25)return;const width=Number(stroke?.lineWidth??0);if(width<=0||width>2.0)return;let b;try{b=box(path.getBounds(stroke,ctm))}catch(_){return}if(!b||area(b)<=0)return;for(const c of candidates){const p=Math.max(1.5,width*3);if(hit(b,c.box,p)&&nearEdge(b,c.box,Math.max(2,p+0.5))){paths.push({ops:ops(path,ctm),width,bounds:b});break}}}});page.runPageContents(dev,mupdf.Matrix.identity);dev.close();return paths;}
function append(doc,page,data){const o=page.getObject(),s=doc.addStream(data,{}),c=o.get('Contents');if(!c||c.isNull()){o.put('Contents',s);return}if(c.isArray()){c.push(s);return}const a=doc.newArray();a.push(c);a.push(s);o.put('Contents',a)}
function serialize(paths){const out=['q','1 1 1 RG','1 J','1 j'];for(const p of paths){out.push(`${Math.max(.32,Math.min(1.8,p.width*2.4)).toFixed(3)} w`);for(const o of p.ops){if(o[0]==='m')out.push(`${o[1].toFixed(3)} ${o[2].toFixed(3)} m`);else if(o[0]==='l')out.push(`${o[1].toFixed(3)} ${o[2].toFixed(3)} l`);else if(o[0]==='c')out.push(`${o[1].toFixed(3)} ${o[2].toFixed(3)} ${o[3].toFixed(3)} ${o[4].toFixed(3)} ${o[5].toFixed(3)} ${o[6].toFixed(3)} c`);else out.push('h')}out.push('S')}out.push('Q');return new TextEncoder().encode(out.join('\n'));}

export async function detectRevisionClouds(data){const doc=mupdf.PDFDocument.openDocument(new Uint8Array(data),'application/pdf'),res=[];try{for(let i=0;i<doc.countPages();i++){const page=doc.loadPage(i),cand=rasterComponents(page);if(!cand.length)continue;const paths=collectRedPaths(page,cand);if(!paths.length)continue;const matched=cand.map(c=>({box:c.box,pathCount:paths.filter(p=>hit(p.bounds,c.box,2)).length,density:c.density})).filter(c=>c.pathCount>=20);if(matched.length)res.push({page:i+1,clouds:matched})}}finally{doc.destroy()}return res}
export async function removeRevisionClouds(data,detected){if(!detected?.length)return{bytes:new Uint8Array(data),count:0};const doc=mupdf.PDFDocument.openDocument(new Uint8Array(data),'application/pdf');let count=0;try{for(const pi of detected){const page=doc.loadPage(pi.page-1),paths=collectRedPaths(page,pi.clouds);if(!paths.length)continue;append(doc,page,serialize(paths));count+=pi.clouds.length}const b=doc.saveToBuffer('garbage=4,compress=yes,appearance=yes');return{bytes:new Uint8Array(b.asUint8Array()),count}}finally{doc.destroy()}}
async function analyze(){if(!$(BOX)?.checked)return;const batch=window.__batchAnalysis||[];for(const item of batch){if(item?.error||!item.data)continue;try{const d=await detectRevisionClouds(item.data);item.revisionClouds=d;item.revisionCloudCount=d.reduce((s,p)=>s+p.clouds.length,0)}catch(e){item.revisionClouds=[];item.revisionCloudError=e?.message||String(e)}}const total=batch.reduce((s,a)=>s+(a.revisionCloudCount||0),0);if(total){const s=$(SUMMARY);if(s){s.textContent=(s.textContent||'').replace(/ · ☁️[^·]*/g,'')+` · ☁️ ${total} nube${total===1?'':'s'} de revisión detectada${total===1?'':'s'}`;s.classList.remove('hidden')}}if($(STATUS))$(STATUS).textContent=total?`Detectadas ${total} nube${total===1?'':'s'} de revisión gráfica${total===1?'':'s'}.`:'No se detectaron nubes de revisión gráficas.'}
async function prepare(){if(!$(BOX)?.checked)return;const batch=window.__batchAnalysis||[];for(const item of batch){if(item?.error||!item.data)continue;const d=Array.isArray(item.revisionClouds)?item.revisionClouds:await detectRevisionClouds(item.data);if(!d.length)continue;const r=await removeRevisionClouds(item.data,d);item.data=r.bytes;item.revisionCloudApplied=r.count}}
function inject(){if($(BOX))return;const comments=$('#batchRemoveComments'),host=comments?.closest('.option-box');if(!host)return;const b=document.createElement('div');b.className='option-box';b.style.marginTop='10px';b.innerHTML='<label><input id="batchRemoveRevisionClouds" type="checkbox"><span>☁️ Eliminar nubes de revisión gráficas</span></label><small>Detecta automáticamente nubes de revisión dibujadas como vector. Solo se ejecuta al activar esta opción.</small>';host.parentElement?.insertBefore(b,host.nextElementSibling)}
function hook(){const cur=window.__prepareBatchAnnotationOperations;if(typeof cur!=='function'){setTimeout(hook,0);return}if(cur.__withRevisionClouds)return;const w=async()=>{await cur();await prepare()};w.__withRevisionClouds=true;window.__prepareBatchAnnotationOperations=w}
function wire(){inject();$('#batchAnalyze')?.addEventListener('click',()=>setTimeout(()=>analyze().catch(e=>console.error('[revision-clouds]',e)),300));hook()}
window.__prepareRevisionCloudOperations=prepare;window.__detectRevisionClouds=detectRevisionClouds;if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
