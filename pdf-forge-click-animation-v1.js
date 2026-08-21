// PDF Forge click animation only. No PDF processing behavior is changed.
(function(){
  const STYLE_ID='pdf-forge-click-animation-style';
  const BOUND_ATTR='data-pdf-forge-click-animation';

  function ensureStyle(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      @keyframes pdfForgeClickPulse{
        0%{transform:scale(1);filter:brightness(1) saturate(1) drop-shadow(0 0 0 rgba(54,167,255,0));}
        24%{transform:scale(1.045);filter:brightness(1.55) saturate(1.35) drop-shadow(0 0 12px rgba(54,167,255,.95));}
        48%{transform:scale(1.025);filter:brightness(1.85) saturate(1.55) drop-shadow(0 0 22px rgba(70,185,255,1));}
        72%{transform:scale(1.055);filter:brightness(1.45) saturate(1.3) drop-shadow(0 0 15px rgba(54,167,255,.9));}
        100%{transform:scale(1);filter:brightness(1) saturate(1) drop-shadow(0 0 0 rgba(54,167,255,0));}
      }
      .pdf-forge-upload-brand img.pdf-forge-clicking{
        animation:pdfForgeClickPulse .58s cubic-bezier(.2,.7,.2,1);
        transform-origin:center;
        will-change:transform,filter;
      }
    `;
    document.head.appendChild(style);
  }

  function bind(){
    ensureStyle();
    const zone=document.querySelector('#analysisTool .batch-dropzone');
    const img=zone?.querySelector('.pdf-forge-upload-brand img');
    if(!zone||!img||zone.hasAttribute(BOUND_ATTR))return false;
    zone.setAttribute(BOUND_ATTR,'1');
    zone.addEventListener('click',()=>{
      img.classList.remove('pdf-forge-clicking');
      void img.offsetWidth;
      img.classList.add('pdf-forge-clicking');
      window.setTimeout(()=>img.classList.remove('pdf-forge-clicking'),620);
    });
    return true;
  }

  if(bind())return;
  const observer=new MutationObserver(()=>{if(bind())observer.disconnect();});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  window.setTimeout(()=>observer.disconnect(),12000);
})();
