// PDF Forge click/drag magma-ray animation only. No PDF processing behavior is changed.
(function(){
  const BOUND_ATTR='data-pdf-forge-click-animation-v2';
  const STYLE_ID='pdf-forge-magma-ray-style-v2';

  function ensureStyle(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      .pdf-forge-upload-brand.pdf-forge-magma-wrap{position:relative!important;overflow:visible!important;}
      .pdf-forge-magma-ray{
        position:absolute;inset:0;width:150px!important;height:150px!important;object-fit:cover!important;border-radius:20px!important;
        pointer-events:none!important;opacity:0;z-index:3;
        clip-path:polygon(58% 13%,41% 51%,51% 46%,42% 70%,71% 32%,55% 40%,62% 12%);
        transform-origin:center;
      }
      .pdf-forge-magma-burst{
        position:absolute;left:50%;top:62%;width:8px;height:8px;border-radius:50%;transform:translate(-50%,-50%) scale(.2);
        pointer-events:none;z-index:4;opacity:0;background:#fff7c7;
        box-shadow:0 0 8px 3px #fff,0 0 18px 8px #ffb11b,0 0 34px 15px #ff4b00;
      }
      @keyframes pdfForgeRayStrike{
        0%{opacity:0;filter:hue-rotate(0deg) saturate(1) brightness(1);transform:scale(1)}
        16%{opacity:.35;filter:hue-rotate(95deg) saturate(1.7) brightness(1.2);transform:scale(1.01)}
        38%{opacity:.92;filter:hue-rotate(155deg) saturate(2.7) brightness(1.35) drop-shadow(0 0 5px #ff7a00);transform:scale(1.025)}
        55%{opacity:1;filter:hue-rotate(170deg) saturate(3.3) brightness(1.75) drop-shadow(0 0 8px #ff3b00) drop-shadow(0 0 13px #ffb000);transform:scale(1.04)}
        72%{opacity:.88;filter:hue-rotate(165deg) saturate(3) brightness(1.45) drop-shadow(0 0 7px #ff6200);transform:scale(1.025)}
        100%{opacity:0;filter:hue-rotate(0deg) saturate(1) brightness(1);transform:scale(1)}
      }
      @keyframes pdfForgeBurstStrike{
        0%,18%{opacity:0;transform:translate(-50%,-50%) scale(.2)}
        48%{opacity:.45;transform:translate(-50%,-50%) scale(.9)}
        58%{opacity:1;transform:translate(-50%,-50%) scale(1.9)}
        76%{opacity:.45;transform:translate(-50%,-50%) scale(1.25)}
        100%{opacity:0;transform:translate(-50%,-50%) scale(.2)}
      }
      @keyframes pdfForgeRayDrag{
        0%,100%{opacity:.48;filter:hue-rotate(145deg) saturate(2.4) brightness(1.25) drop-shadow(0 0 5px #ff6500);transform:scale(1.01)}
        50%{opacity:1;filter:hue-rotate(170deg) saturate(3.4) brightness(1.75) drop-shadow(0 0 9px #ff3b00) drop-shadow(0 0 15px #ffb000);transform:scale(1.045)}
      }
      @keyframes pdfForgeBurstDrag{
        0%,100%{opacity:.25;transform:translate(-50%,-50%) scale(.65)}
        50%{opacity:.85;transform:translate(-50%,-50%) scale(1.45)}
      }
      .pdf-forge-magma-ray.is-striking{animation:pdfForgeRayStrike .9s cubic-bezier(.2,.7,.2,1) 1;}
      .pdf-forge-magma-burst.is-striking{animation:pdfForgeBurstStrike .9s ease-out 1;}
      .pdf-forge-magma-ray.is-dragging{animation:pdfForgeRayDrag .82s ease-in-out infinite;}
      .pdf-forge-magma-burst.is-dragging{animation:pdfForgeBurstDrag .82s ease-in-out infinite;}
    `;
    document.head.appendChild(style);
  }

  function restartStrike(ray,burst){
    ray.classList.remove('is-dragging','is-striking');
    burst.classList.remove('is-dragging','is-striking');
    void ray.offsetWidth;
    ray.classList.add('is-striking');
    burst.classList.add('is-striking');
    clearTimeout(ray._pdfForgeTimer);
    ray._pdfForgeTimer=setTimeout(()=>{
      ray.classList.remove('is-striking');
      burst.classList.remove('is-striking');
    },950);
  }

  function setDragging(ray,burst,on){
    clearTimeout(ray._pdfForgeTimer);
    ray.classList.remove('is-striking');
    burst.classList.remove('is-striking');
    ray.classList.toggle('is-dragging',on);
    burst.classList.toggle('is-dragging',on);
  }

  function bind(){
    ensureStyle();
    const zone=document.querySelector('#analysisTool .batch-dropzone');
    const brand=zone?.querySelector('.pdf-forge-upload-brand');
    const img=brand?.querySelector('img');
    if(!zone||!brand||!img||zone.hasAttribute(BOUND_ATTR))return false;
    zone.setAttribute(BOUND_ATTR,'1');
    brand.classList.add('pdf-forge-magma-wrap');

    const ray=img.cloneNode(false);
    ray.alt='';
    ray.className='pdf-forge-magma-ray';
    ray.removeAttribute('style');
    ray.src=img.src;
    const burst=document.createElement('span');
    burst.className='pdf-forge-magma-burst';
    brand.appendChild(ray);
    brand.appendChild(burst);

    zone.addEventListener('click',()=>restartStrike(ray,burst));

    let dragDepth=0;
    zone.addEventListener('dragenter',()=>{
      dragDepth++;
      if(dragDepth===1)setDragging(ray,burst,true);
    });
    zone.addEventListener('dragover',()=>{
      if(!ray.classList.contains('is-dragging'))setDragging(ray,burst,true);
    });
    zone.addEventListener('dragleave',()=>{
      dragDepth=Math.max(0,dragDepth-1);
      if(dragDepth===0)setDragging(ray,burst,false);
    });
    zone.addEventListener('drop',()=>{
      dragDepth=0;
      setDragging(ray,burst,false);
      restartStrike(ray,burst);
    });
    return true;
  }

  if(bind())return;
  const observer=new MutationObserver(()=>{if(bind())observer.disconnect();});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  setTimeout(()=>observer.disconnect(),12000);
})();
