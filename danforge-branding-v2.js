// PDF Forge branding only. Presentation metadata and visible brand only; no tool behavior is touched.
const ICON_SOURCE = new URL('./assets/pdf-forge-icon.jpg?v=20260818-pdfforge1', import.meta.url).href;
let ICON = '';

async function resolveIcon(){
  if(ICON)return ICON;
  // The repository asset is stored as base64 text. Convert it to a browser-safe data URL.
  const response=await fetch(ICON_SOURCE,{cache:'force-cache'});
  if(!response.ok)throw new Error(`No se pudo cargar el logo PDF Forge (${response.status})`);
  const base64=(await response.text()).replace(/\s+/g,'');
  if(!base64)throw new Error('El recurso del logo PDF Forge está vacío.');
  ICON=`data:image/jpeg;base64,${base64}`;
  return ICON;
}

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

async function applyBrand(){
  document.title='PDF Forge';

  let iconUrl='';
  try{iconUrl=await resolveIcon();}
  catch(err){console.warn('[PDF Forge branding] Logo no disponible:',err);}

  if(iconUrl){
    let fav=document.querySelector('link[rel~="icon"]');
    if(!fav){fav=document.createElement('link');fav.rel='icon';document.head.appendChild(fav);}
    fav.type='image/jpeg';
    fav.href=iconUrl;

    const mark=document.querySelector('.brand-mark');
    if(mark){
      mark.textContent='';
      mark.style.overflow='hidden';
      mark.style.padding='0';
      mark.style.background='#06172f';
      const img=document.createElement('img');
      img.src=iconUrl;
      img.alt='PDF Forge';
      Object.assign(img.style,{display:'block',width:'100%',height:'100%',objectFit:'cover',borderRadius:'inherit',pointerEvents:'none'});
      mark.appendChild(img);
    }

    addBatchUploadBrand(iconUrl);
  }

  const name=document.querySelector('.brand-copy strong');
  if(name)name.textContent='PDF Forge';

  const meta=document.querySelector('meta[name="description"]');
  if(meta)meta.content='PDF Forge: edición, análisis y procesamiento local de documentos PDF técnicos.';
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',applyBrand,{once:true});
else applyBrand();
