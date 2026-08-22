// PDF Forge click animation. Visual only; PDF behavior is untouched.
// Plays the exact approved GIF as a temporary overlay, leaving the static icon untouched.
(function(){
  const SOURCE='https://raw.githubusercontent.com/danyyaromir07-lgtm/dany/71c0ce3f2fd4ee3bbbd10777eedad9360a60a30d/pdf-forge-click-animation-v3.js';
  const DURATION=680;
  let lastPlay=0;
  let activeOverlay=null;

  const animReady=fetch(SOURCE,{cache:'force-cache'})
    .then(r=>{if(!r.ok)throw new Error('animation source '+r.status);return r.text();})
    .then(src=>{
      const m=src.match(/const ANIM='([^']+)'/);
      if(!m)throw new Error('No se encontró el GIF aprobado.');
      return m[1];
    });

  function getImage(){
    return document.querySelector('.pdf-forge-upload-brand img, .batch-dropzone .drop-icon img, .batch-dropzone img');
  }

  async function play(){
    const now=Date.now();
    if(now-lastPlay<120)return;
    lastPlay=now;

    const img=getImage();
    if(!img)return;

    try{
      const anim=await animReady;
      const rect=img.getBoundingClientRect();
      const cs=getComputedStyle(img);

      if(activeOverlay)activeOverlay.remove();
      const overlay=document.createElement('img');
      activeOverlay=overlay;
      overlay.alt='';
      overlay.setAttribute('aria-hidden','true');
      overlay.src=anim;
      Object.assign(overlay.style,{
        position:'fixed',
        left:rect.left+'px',
        top:rect.top+'px',
        width:rect.width+'px',
        height:rect.height+'px',
        objectFit:cs.objectFit||'cover',
        objectPosition:cs.objectPosition||'center',
        borderRadius:cs.borderRadius||'0',
        margin:'0',
        padding:'0',
        display:'block',
        pointerEvents:'none',
        zIndex:'2147483647'
      });
      document.body.appendChild(overlay);
      setTimeout(()=>{
        if(overlay.isConnected)overlay.remove();
        if(activeOverlay===overlay)activeOverlay=null;
      },DURATION);
    }catch(err){
      console.error('PDF Forge click animation:',err);
    }
  }

  document.addEventListener('click',e=>{
    const target=e.target;
    if(target?.id==='batchFiles')return play();
    const img=target?.closest?.('img');
    if(img&&img.closest('.batch-dropzone'))play();
  },true);
})();
