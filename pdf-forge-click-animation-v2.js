// PDF Forge image-sequence animation. Visual only; PDF behavior is untouched.
(function(){
  const BOUND='data-pdf-forge-animation-v4';
  const ANIM='./assets/pdf-forge-spark-sequence.gif?v=20260822-spark1';
  const CYCLE_MS=1100;

  function bind(){
    const zone=document.querySelector('#analysisTool .batch-dropzone');
    const brand=zone?.querySelector('.pdf-forge-upload-brand');
    const img=brand?.querySelector('img');
    if(!zone||!brand||!img||zone.hasAttribute(BOUND)) return false;
    zone.setAttribute(BOUND,'1');

    const idle=img.currentSrc||img.src;
    const pre=new Image();
    pre.src=ANIM;
    let timer=null;
    let depth=0;
    let dragging=false;

    function stopTimer(){
      if(timer){clearTimeout(timer);timer=null;}
    }

    function restore(){
      stopTimer();
      img.src=idle;
    }

    function restartAnimation(keepRunning){
      stopTimer();
      img.removeAttribute('src');
      void img.offsetWidth;
      requestAnimationFrame(()=>{
        img.src=ANIM+'&r='+Date.now();
        if(!keepRunning){
          timer=setTimeout(()=>{if(!dragging) img.src=idle;},CYCLE_MS);
        }
      });
    }

    zone.addEventListener('click',()=>{
      if(!dragging) restartAnimation(false);
    });

    zone.addEventListener('dragenter',()=>{
      depth++;
      if(depth===1){
        dragging=true;
        restartAnimation(true);
      }
    });

    zone.addEventListener('dragover',()=>{
      if(!dragging){
        dragging=true;
        restartAnimation(true);
      }
    });

    zone.addEventListener('dragleave',()=>{
      depth=Math.max(0,depth-1);
      if(depth===0){
        dragging=false;
        restore();
      }
    });

    zone.addEventListener('drop',()=>{
      depth=0;
      dragging=false;
      restartAnimation(false);
    });

    return true;
  }

  if(bind()) return;
  const obs=new MutationObserver(()=>{if(bind())obs.disconnect();});
  obs.observe(document.documentElement,{childList:true,subtree:true});
  setTimeout(()=>obs.disconnect(),15000);
})();
