// PDF Forge branding only. Presentation metadata and visible brand only; no tool behavior is touched.
const ICON = new URL('./assets/pdf-forge-icon.jpg?v=20260818-pdfforge1', import.meta.url).href;

function addBatchUploadBrand(){
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
    gap:'14px',
    margin:'0 0 12px',
    pointerEvents:'none',
    userSelect:'none'
  });

  const img=document.createElement('img');
  img.src=ICON;
  img.alt='PDF Forge';
  Object.assign(img.style,{
    display:'block',
    width:'92px',
    height:'92px',
    objectFit:'cover',
    borderRadius:'18px',
    boxShadow:'0 8px 24px rgba(0,111,238,.16)'
  });

  const wordmark=document.createElement('div');
  wordmark.textContent='PDF Forge';
  Object.assign(wordmark.style,{
    fontSize:'34px',
    lineHeight:'1',
    fontWeight:'800',
    letterSpacing:'-.035em',
    color:'#172033',
    whiteSpace:'nowrap'
  });

  brand.append(img,wordmark);
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
    Object.assign(img.style,{display:'block',width:'100%',height:'100%',objectFit:'cover',borderRadius:'inherit'});
    mark.appendChild(img);
  }

  const name=document.querySelector('.brand-copy strong');
  if(name)name.textContent='PDF Forge';

  const meta=document.querySelector('meta[name="description"]');
  if(meta)meta.content='PDF Forge: edición, análisis y procesamiento local de documentos PDF técnicos.';

  addBatchUploadBrand();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',applyBrand,{once:true});
else applyBrand();
