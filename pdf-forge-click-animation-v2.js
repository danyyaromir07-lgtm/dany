// PDF Forge visible 5-step click/drag animation. Visual only; PDF behavior is untouched.
(function(){
  const BOUND='data-pdf-forge-animation-v2';
  const STYLE='pdf-forge-animation-v2-style';

  function ensureStyle(){
    if(document.getElementById(STYLE)) return;
    const s=document.createElement('style');
    s.id=STYLE;
    s.textContent=`
      .pdf-forge-upload-brand{position:relative!important;overflow:visible!important}
      .pdf-forge-upload-brand::after{
        content:'';position:absolute;left:50%;top:63%;width:12px;height:12px;border-radius:50%;
        transform:translate(-50%,-50%) scale(.1);opacity:0;pointer-events:none;z-index:5;
        background:#fff7d1;
        box-shadow:0 0 8px 4px #fff,0 0 20px 9px #ffb000,0 0 38px 18px #ff4d00;
      }
      @keyframes pdfForgeFiveStep{
        0%   {transform:scale(1);filter:brightness(1) saturate(1) drop-shadow(0 0 0 rgba(48,165,255,0));}
        22%  {transform:scale(1.035);filter:brightness(1.35) saturate(1.35) drop-shadow(0 0 12px rgba(65,180,255,.95));}
        50%  {transform:scale(1.055);filter:brightness(1.9) saturate(1.55) drop-shadow(0 0 22px rgba(100,210,255,1));}
        73%  {transform:scale(1.035);filter:brightness(1.38) saturate(1.35) drop-shadow(0 0 14px rgba(65,180,255,.95));}
        100% {transform:scale(1);filter:brightness(1) saturate(1) drop-shadow(0 0 0 rgba(48,165,255,0));}
      }
      @keyframes pdfForgeMagmaBurst{
        0%,24%{opacity:0;transform:translate(-50%,-50%) scale(.1)}
        45%{opacity:.35;transform:translate(-50%,-50%) scale(.7)}
        52%{opacity:1;transform:translate(-50%,-50%) scale(2.5)}
        64%{opacity:.55;transform:translate(-50%,-50%) scale(1.45)}
        100%{opacity:0;transform:translate(-50%,-50%) scale(.1)}
      }
      @keyframes pdfForgeDragLoop{
        0%,100%{transform:scale(1.02);filter:brightness(1.18) saturate(1.2) drop-shadow(0 0 9px rgba(75,180,255,.75));}
        42%{transform:scale(1.045);filter:brightness(1.5) saturate(1.4) drop-shadow(0 0 17px rgba(75,190,255,1));}
        55%{transform:scale(1.055);filter:brightness(1.75) saturate(1.55) drop-shadow(0 0 20px rgba(255,115,20,.8));}
        70%{transform:scale(1.04);filter:brightness(1.4) saturate(1.35) drop-shadow(0 0 14px rgba(75,190,255,.9));}
      }
      .pdf-forge-upload-brand.pdf-forge-strike img{animation:pdfForgeFiveStep .95s cubic-bezier(.2,.7,.2,1) 1;transform-origin:center;will-change:transform,filter}
      .pdf-forge-upload-brand.pdf-forge-strike::after{animation:pdfForgeMagmaBurst .95s ease-out 1}
      .pdf-forge-upload-brand.pdf-forge-drag img{animation:pdfForgeDragLoop 1.05s ease-in-out infinite;transform-origin:center;will-change:transform,filter}
      .pdf-forge-upload-brand.pdf-forge-drag::after{animation:pdfForgeMagmaBurst 1.05s ease-in-out infinite}
    `;
    document.head.appendChild(s);
  }

  function strike(brand){
    brand.classList.remove('pdf-forge-drag','pdf-forge-strike');
    void brand.offsetWidth;
    brand.classList.add('pdf-forge-strike');
    clearTimeout(brand._pdfForgeTimer);
    brand._pdfForgeTimer=setTimeout(()=>brand.classList.remove('pdf-forge-strike'),1000);
  }

  function bind(){
    ensureStyle();
    const zone=document.querySelector('#analysisTool .batch-dropzone');
    const brand=zone?.querySelector('.pdf-forge-upload-brand');
    const img=brand?.querySelector('img');
    if(!zone||!brand||!img||zone.hasAttribute(BOUND)) return false;
    zone.setAttribute(BOUND,'1');

    zone.addEventListener('click',()=>strike(brand));

    let depth=0;
    zone.addEventListener('dragenter',()=>{
      depth++;
      brand.classList.remove('pdf-forge-strike');
      brand.classList.add('pdf-forge-drag');
    });
    zone.addEventListener('dragover',()=>{
      if(!brand.classList.contains('pdf-forge-drag')) brand.classList.add('pdf-forge-drag');
    });
    zone.addEventListener('dragleave',()=>{
      depth=Math.max(0,depth-1);
      if(depth===0) brand.classList.remove('pdf-forge-drag');
    });
    zone.addEventListener('drop',()=>{
      depth=0;
      brand.classList.remove('pdf-forge-drag');
      strike(brand);
    });
    return true;
  }

  if(bind()) return;
  const obs=new MutationObserver(()=>{if(bind())obs.disconnect();});
  obs.observe(document.documentElement,{childList:true,subtree:true});
  setTimeout(()=>obs.disconnect(),15000);
})();
