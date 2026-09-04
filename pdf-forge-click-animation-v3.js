// PDF Forge click animation. Visual only; PDF behavior is untouched.
// Replays the exact approved GIF by creating a fresh Blob URL on every click.
(function(){
  const SOURCE='https://raw.githubusercontent.com/danyyaromir07-lgtm/dany/ed41112434492d9925429602c36e2270616253a7/pdf-forge-click-animation-v3.js';
  const DURATION=760;
  let lastPlay=0;
  let activeOverlay=null;
  let activeUrl=null;

  const gifBytesReady=fetch(SOURCE,{cache:'force-cache'})
    .then(r=>{if(!r.ok)throw new Error('animation source '+r.status);return r.text();})
    .then(src=>{
      const m=src.match(/const ANIM='data:image\/gif;base64,([^']+)'/);
      if(!m)throw new Error('No se encontró el GIF exacto aprobado.');
      const bin=atob(m[1]);
      const bytes=new Uint8Array(bin.length);
      for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
      return bytes;
    });

  function getImage(){
    return document.querySelector('.pdf-forge-upload-brand img, .batch-dropzone .drop-icon img, .batch-dropzone img');
  }

  function cleanup(){
    if(activeOverlay){activeOverlay.remove();activeOverlay=null;}
    if(activeUrl){URL.revokeObjectURL(activeUrl);activeUrl=null;}
  }

  async function play(){
    const now=Date.now();
    if(now-lastPlay<180)return;
    lastPlay=now;
    const img=getImage();
    if(!img)return;

    try{
      const bytes=await gifBytesReady;
      cleanup();

      // A new Blob URL forces the browser to start the GIF at frame 1 every time.
      activeUrl=URL.createObjectURL(new Blob([bytes],{type:'image/gif'}));
      const rect=img.getBoundingClientRect();
      const cs=getComputedStyle(img);
      const overlay=document.createElement('img');
      activeOverlay=overlay;
      overlay.alt='';
      overlay.setAttribute('aria-hidden','true');
      overlay.src=activeUrl;
      Object.assign(overlay.style,{
        position:'fixed',
        left:rect.left+'px',
        top:rect.top+'px',
        width:rect.width+'px',
        height:rect.height+'px',
        objectFit:cs.objectFit||'cover',
        objectPosition:cs.objectPosition||'center',
        borderRadius:cs.borderRadius||'0',
        margin:'0',padding:'0',display:'block',
        pointerEvents:'none',zIndex:'2147483647'
      });
      document.body.appendChild(overlay);
      setTimeout(cleanup,DURATION);
    }catch(err){
      cleanup();
      console.error('PDF Forge click animation:',err);
    }
  }

  document.addEventListener('click',e=>{
    const t=e.target;
    if(t?.id==='batchFiles')return play();
    const img=t?.closest?.('img');
    if(img&&img.closest('.batch-dropzone'))play();
  },true);
})();
