// PDF Forge spark-sequence overlay. Visual only; PDF behavior is untouched.
(function(){
  const BOUND='data-pdf-forge-animation-v5';
  const ANIM='./assets/pdf-forge-spark-sequence.gif?v=20260822-spark2';
  const CYCLE_MS=1150;

  function bind(){
    const zone=document.querySelector('#analysisTool .batch-dropzone');
    const brand=zone?.querySelector('.pdf-forge-upload-brand');
    const base=brand?.querySelector('img');
    if(!zone||!brand||!base||zone.hasAttribute(BOUND)) return false;
    zone.setAttribute(BOUND,'1');

    brand.style.position='relative';

    // Keep the original icon permanently in place. The animation is a second image
    // layered on top, so a failed/reloading animation can never make the icon vanish.
    const overlay=document.createElement('img');
    overlay.alt='';
    overlay.setAttribute('aria-hidden','true');
    Object.assign(overlay.style,{
      position:'absolute',
      inset:'0',
      width:'100%',
      height:'100%',
      objectFit:'cover',
      borderRadius:'inherit',
      opacity:'0',
      pointerEvents:'none',
      zIndex:'2'
    });
    brand.appendChild(overlay);

    // Preload the animation once. The click version gets a cache-buster so the GIF
    // always restarts from frame one.
    const preload=new Image();
    preload.src=ANIM;

    let timer=null;
    let depth=0;
    let dragging=false;

    function clearTimer(){
      if(timer){clearTimeout(timer);timer=null;}
    }

    function hideOverlay(){
      clearTimer();
      overlay.style.opacity='0';
      overlay.removeAttribute('src');
    }

    function playOnce(){
      clearTimer();
      overlay.style.opacity='0';
      overlay.src=ANIM+'&r='+Date.now();
      requestAnimationFrame(()=>{overlay.style.opacity='1';});
      timer=setTimeout(()=>{
        if(!dragging) hideOverlay();
      },CYCLE_MS);
    }

    function startDrag(){
      clearTimer();
      dragging=true;
      overlay.src=ANIM+'&drag='+Date.now();
      overlay.style.opacity='1';
    }

    zone.addEventListener('click',()=>{
      if(!dragging) playOnce();
    });

    zone.addEventListener('dragenter',()=>{
      depth++;
      if(depth===1) startDrag();
    });

    zone.addEventListener('dragover',()=>{
      if(!dragging) startDrag();
    });

    zone.addEventListener('dragleave',()=>{
      depth=Math.max(0,depth-1);
      if(depth===0){
        dragging=false;
        hideOverlay();
      }
    });

    zone.addEventListener('drop',()=>{
      depth=0;
      dragging=false;
      playOnce();
    });

    return true;
  }

  if(bind()) return;
  const obs=new MutationObserver(()=>{if(bind())obs.disconnect();});
  obs.observe(document.documentElement,{childList:true,subtree:true});
  setTimeout(()=>obs.disconnect(),15000);
})();
