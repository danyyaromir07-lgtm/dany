// PDF Forge animation loader with stable final frame. Visual only; PDF behavior is untouched.
(async function(){
  try{
    const OLD='https://raw.githubusercontent.com/danyyaromir07-lgtm/dany/23b18ffca5acd7b7c9e9d58751edf636bb4ccfe4/pdf-forge-click-animation-v3.js';
    const r=await fetch(OLD,{cache:'no-store'});
    if(!r.ok) throw new Error('animation source '+r.status);
    let src=await r.text();
    // Preserve the working animation, but make the calm artwork the guaranteed restore frame.
    // The previous restore target could resolve to a transient/empty image after the cycle.
    src=src.replace('const idle=img.currentSrc||img.src;','const idle=F3;');
    (0,eval)(src);
  }catch(err){
    console.error('PDF Forge animation loader:',err);
  }
})();
