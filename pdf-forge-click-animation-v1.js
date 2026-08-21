// PDF Forge click/drag animation only. No PDF processing behavior is changed.
(function(){
  const STYLE_ID='pdf-forge-click-animation-style';
  const BOUND_ATTR='data-pdf-forge-click-animation';

  function ensureStyle(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      @keyframes pdfForgeMagmaPulse{
        0%{transform:scale(1);filter:brightness(1) saturate(1) drop-shadow(0 0 0 rgba(255,88,18,0));}
        24%{transform:scale(1.045);filter:brightness(1.42) saturate(1.38) drop-shadow(0 0 10px rgba(255,94,18,.95)) drop-shadow(0 0 20px rgba(255,170,32,.55));}
        48%{transform:scale(1.028);filter:brightness(1.72) saturate(1.65) drop-shadow(0 0 18px rgba(255,78,8,1)) drop-shadow(0 0 30px rgba(255,184,38,.72));}
        72%{transform:scale(1.055);filter:brightness(1.38) saturate(1.42) drop-shadow(0 0 13px rgba(255,92,16,.92)) drop-shadow(0 0 23px rgba(255,154,20,.55));}
        100%{transform:scale(1);filter:brightness(1) saturate(1) drop-shadow(0 0 0 rgba(255,88,18,0));}
      }
      @keyframes pdfForgeMagmaDrag{
        0%,100%{transform:scale(1.025);filter:brightness(1.25) saturate(1.3) drop-shadow(0 0 10px rgba(255,92,16,.82)) drop-shadow(0 0 18px rgba(255,168,28,.42));}
        50%{transform:scale(1.055);filter:brightness(1.58) saturate(1.55) drop-shadow(0 0 18px rgba(255,72,8,1)) drop-shadow(0 0 30px rgba(255,187,42,.68));}
      }
      .pdf-forge-upload-brand img.pdf-forge-clicking{
        animation:pdfForgeMagmaPulse .62s cubic-bezier(.2,.7,.2,1);
        transform-origin:center;
        will-change:transform,filter;
      }
      .pdf-forge-upload-brand img.pdf-forge-dragging{
        animation:pdfForgeMagmaDrag .82s ease-in-out infinite;
        transform-origin:center;
        will-change:transform,filter;
      }
    `;
    document.head.appendChild(style);
  }

  function pulse(img){
    img.classList.remove('pdf-forge-clicking');
    void img.offsetWidth;
    img.classList.add('pdf-forge-clicking');
    window.setTimeout(()=>img.classList.remove('pdf-forge-clicking'),680);
  }

  function bind(){
    ensureStyle();
    const zone=document.querySelector('#analysisTool .batch-dropzone');
    const img=zone?.querySelector('.pdf-forge-upload-brand img');
    if(!zone||!img||zone.hasAttribute(BOUND_ATTR))return false;
    zone.setAttribute(BOUND_ATTR,'1');

    zone.addEventListener('click',()=>pulse(img));

    let dragDepth=0;
    zone.addEventListener('dragenter',()=>{
      dragDepth++;
      img.classList.remove('pdf-forge-clicking');
      img.classList.add('pdf-forge-dragging');
    });
    zone.addEventListener('dragover',()=>{
      if(!img.classList.contains('pdf-forge-dragging'))img.classList.add('pdf-forge-dragging');
    });
    zone.addEventListener('dragleave',()=>{
      dragDepth=Math.max(0,dragDepth-1);
      if(dragDepth===0)img.classList.remove('pdf-forge-dragging');
    });
    zone.addEventListener('drop',()=>{
      dragDepth=0;
      img.classList.remove('pdf-forge-dragging');
      pulse(img);
    });

    return true;
  }

  if(bind())return;
  const observer=new MutationObserver(()=>{if(bind())observer.disconnect();});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  window.setTimeout(()=>observer.disconnect(),12000);
})();
