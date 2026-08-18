// PDF Forge branding only. Presentation metadata and visible brand only; no tool behavior is touched.
const ICON = new URL('./assets/pdf-forge-icon.jpg?v=20260818-pdfforge1', import.meta.url).href;

function applyBrand(){
  document.title='PDF Forge';
  let fav=document.querySelector('link[rel~="icon"]');
  if(!fav){fav=document.createElement('link');fav.rel='icon';document.head.appendChild(fav);}
  fav.type='image/jpeg';
  fav.href=ICON;

  const mark=document.querySelector('.brand-mark');
  if(mark){
    mark.textContent='';
    mark.style.overflow='hidden';
    mark.style.padding='0';
    mark.style.background='#06172f';
    const img=document.createElement('img');
    img.src=ICON;
    img.alt='PDF Forge';
    Object.assign(img.style,{display:'block',width:'100%',height:'100%',objectFit:'cover',borderRadius:'inherit'});
    mark.appendChild(img);
  }

  const name=document.querySelector('.brand-copy strong');
  if(name)name.textContent='PDF Forge';

  const meta=document.querySelector('meta[name="description"]');
  if(meta)meta.content='PDF Forge: edición, análisis y procesamiento local de documentos PDF técnicos.';
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',applyBrand,{once:true});
else applyBrand();
