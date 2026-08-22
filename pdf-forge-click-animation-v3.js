// PDF Forge explicit image-frame animation. Visual only; PDF behavior is untouched.
(function(){
  const BOUND='data-pdf-forge-animation-v7';
  const FRAME_FILES=[
    './assets/forge-new-3.b64?v=20260822-realframes2',
    './assets/forge-new-1.b64?v=20260822-realframes2',
    './assets/forge-new-2.b64?v=20260822-realframes2',
    './assets/forge-new-1.b64?v=20260822-realframes2',
    './assets/forge-new-3.b64?v=20260822-realframes2'
  ];
  const DURATIONS=[180,130,300,140,260];
  let FRAMES=null;

  async function loadFrames(){
    if(FRAMES) return FRAMES;
    const unique=[...new Set(FRAME_FILES)];
    const map=new Map();
    await Promise.all(unique.map(async url=>{
      const r=await fetch(url,{cache:'no-store'});
      if(!r.ok) throw new Error('No se pudo cargar fotograma PDF Forge: '+r.status);
      const b64=(await r.text()).trim();
      if(b64.length<1000) throw new Error('Fotograma PDF Forge incompleto');
      map.set(url,'data:image/jpeg;base64,'+b64);
    }));
    FRAMES=FRAME_FILES.map(url=>map.get(url));
    await Promise.all([...new Set(FRAMES)].map(src=>new Promise((resolve,reject)=>{
      const p=new Image();
      p.onload=resolve;
      p.onerror=reject;
      p.src=src;
    })));
    return FRAMES;
  }

  async function bind(){
    const zone=document.querySelector('#analysisTool .batch-dropzone');
    const brand=zone?.querySelector('.pdf-forge-upload-brand');
    const img=brand?.querySelector('img');
    if(!zone||!brand||!img||zone.hasAttribute(BOUND)) return false;

    let frames;
    try{frames=await loadFrames();}
    catch(err){console.error('PDF Forge animation frames:',err);return false;}

    zone.setAttribute(BOUND,'1');
    const idle=img.currentSrc||img.src;
    let timers=[];
    let loopTimer=null;
    let depth=0;
    let dragging=false;

    function clearAll(){
      timers.forEach(clearTimeout);
      timers=[];
      if(loopTimer){clearTimeout(loopTimer);loopTimer=null;}
    }

    function restore(){
      clearAll();
      img.src=idle;
    }

    function runCycle(loop){
      clearAll();
      let t=0;
      frames.forEach((src,i)=>{
        timers.push(setTimeout(()=>{img.src=src;},t));
        t+=DURATIONS[i];
      });
      if(loop){
        loopTimer=setTimeout(()=>{if(dragging)runCycle(true);},t);
      }else{
        timers.push(setTimeout(()=>{if(!dragging)img.src=idle;},t));
      }
    }

    zone.addEventListener('click',()=>{if(!dragging)runCycle(false);});
    zone.addEventListener('dragenter',()=>{
      depth++;
      if(depth===1){dragging=true;runCycle(true);}
    });
    zone.addEventListener('dragover',()=>{
      if(!dragging){dragging=true;runCycle(true);}
    });
    zone.addEventListener('dragleave',()=>{
      depth=Math.max(0,depth-1);
      if(depth===0){dragging=false;restore();}
    });
    zone.addEventListener('drop',()=>{
      depth=0;
      dragging=false;
      runCycle(false);
    });
    return true;
  }

  async function boot(){
    if(await bind()) return;
    const obs=new MutationObserver(async()=>{
      if(await bind()) obs.disconnect();
    });
    obs.observe(document.documentElement,{childList:true,subtree:true});
    setTimeout(()=>obs.disconnect(),15000);
  }

  boot();
})();
