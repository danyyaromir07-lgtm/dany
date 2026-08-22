// PDF Forge reliable 3-image sequence. Visual only; PDF behavior is untouched.
(function(){
  const BOUND='data-pdf-forge-animation-v6';
  const FRAMES=[
    './assets/forge-new-3.jpg?v=20260822-frames1',
    './assets/forge-new-1.jpg?v=20260822-frames1',
    './assets/forge-new-2.jpg?v=20260822-frames1',
    './assets/forge-new-1.jpg?v=20260822-frames1',
    './assets/forge-new-3.jpg?v=20260822-frames1'
  ];
  const DURATIONS=[180,120,280,130,250];

  function bind(){
    const zone=document.querySelector('#analysisTool .batch-dropzone');
    const brand=zone?.querySelector('.pdf-forge-upload-brand');
    const img=brand?.querySelector('img');
    if(!zone||!brand||!img||zone.hasAttribute(BOUND)) return false;
    zone.setAttribute(BOUND,'1');

    const idle=img.currentSrc||img.src;
    FRAMES.forEach(src=>{const p=new Image();p.src=src;});
    let timers=[];
    let loopTimer=null;
    let depth=0;
    let dragging=false;

    function clearAll(){timers.forEach(clearTimeout);timers=[];if(loopTimer){clearTimeout(loopTimer);loopTimer=null;}}
    function restore(){clearAll();img.src=idle;}
    function runCycle(loop){
      clearAll();
      let t=0;
      FRAMES.forEach((src,i)=>{
        timers.push(setTimeout(()=>{img.src=src;},t));
        t+=DURATIONS[i];
      });
      if(loop){loopTimer=setTimeout(()=>{if(dragging)runCycle(true);},t);}
      else timers.push(setTimeout(()=>{if(!dragging)img.src=idle;},t));
    }

    zone.addEventListener('click',()=>{if(!dragging)runCycle(false);});
    zone.addEventListener('dragenter',()=>{depth++;if(depth===1){dragging=true;runCycle(true);}});
    zone.addEventListener('dragover',()=>{if(!dragging){dragging=true;runCycle(true);}});
    zone.addEventListener('dragleave',()=>{depth=Math.max(0,depth-1);if(depth===0){dragging=false;restore();}});
    zone.addEventListener('drop',()=>{depth=0;dragging=false;runCycle(false);});
    return true;
  }

  if(bind()) return;
  const obs=new MutationObserver(()=>{if(bind())obs.disconnect();});
  obs.observe(document.documentElement,{childList:true,subtree:true});
  setTimeout(()=>obs.disconnect(),15000);
})();
