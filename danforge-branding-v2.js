// PDF Forge branding only. Presentation metadata and visible brand only; no tool behavior is touched.
const ICON = new URL('./assets/pdf-forge-icon.jpg?v=20260818-pdfforge3', import.meta.url).href;

function addBatchUploadBrand(iconUrl){
  const zone=document.querySelector('#analysisTool .batch-dropzone');
  if(!zone || zone.querySelector('.pdf-forge-upload-brand'))return;

  const oldIcon=zone.querySelector('.drop-icon');
  if(oldIcon)oldIcon.style.display='none';

  const brand=document.createElement('div');
  brand.className='pdf-forge-upload-brand';
  Object.assign(brand.style,{
    display:'flex',
    alignItems:'center',
    justifyContent:'center',
    margin:'0 0 12px',
    pointerEvents:'none',
    userSelect:'none'
  });

  const img=document.createElement('img');
  img.src=iconUrl;
  img.alt='PDF Forge';
  Object.assign(img.style,{
    display:'block',
    width:'150px',
    height:'150px',
    objectFit:'cover',
    borderRadius:'20px',
    boxShadow:'0 10px 28px rgba(0,111,238,.14)',
    pointerEvents:'none'
  });

  brand.appendChild(img);
  const title=zone.querySelector('strong');
  if(title)zone.insertBefore(brand,title);else zone.prepend(brand);
}

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
    Object.assign(img.style,{display:'block',width:'100%',height:'100%',objectFit:'cover',borderRadius:'inherit',pointerEvents:'none'});
    mark.appendChild(img);
  }

  addBatchUploadBrand(ICON);

  const name=document.querySelector('.brand-copy strong');
  if(name)name.textContent='PDF Forge';

  const meta=document.querySelector('meta[name="description"]');
  if(meta)meta.content='PDF Forge: edición, análisis y procesamiento local de documentos PDF técnicos.';
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',applyBrand,{once:true});
else applyBrand();
