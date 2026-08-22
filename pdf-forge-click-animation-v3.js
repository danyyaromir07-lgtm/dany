// PDF Forge click animation. Visual only; PDF behavior is untouched.
// Uses the exact approved GIF sequence supplied by the user.
(function(){
  const ANIM='./assets/pdf-forge-click-exact.gif';
  const DURATION=660;
  let timer=null;
  let lastPlay=0;

  function getImage(){
    return document.querySelector('.pdf-forge-upload-brand img, .batch-dropzone .drop-icon img, .batch-dropzone img');
  }

  function play(){
    const now=Date.now();
    if(now-lastPlay<80) return;
    lastPlay=now;
    const img=getImage();
    if(!img) return;
    if(!img.dataset.pdfForgeIdle) img.dataset.pdfForgeIdle=img.currentSrc||img.src;
    const idle=img.dataset.pdfForgeIdle;
    clearTimeout(timer);
    // Cache-bust only to restart the exact GIF from frame 1 on every click.
    img.src=ANIM+'?play='+now;
    timer=setTimeout(()=>{
      img.src=idle;
    },DURATION);
  }

  document.addEventListener('click',e=>{
    const target=e.target;
    if(target?.id==='batchFiles') return play();
    const img=target?.closest?.('img');
    if(img && img.closest('.batch-dropzone')) play();
  },true);
})();
