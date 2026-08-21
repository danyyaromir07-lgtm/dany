// PDF Forge click/drag visual animation only. No PDF processing behavior is changed.
(function(){
  const BOUND_ATTR='data-pdf-forge-click-animation';
  const MAGMA_GIF='data:image/gif;base64,R0lGODlheAB4AIQAACRSoRJi26La8iGd71NsnF6g3B40YtTs95Wt1GXQ9AQwpktWcB0kOW2HsIiYuAQ5xzXF8zhHZEl6yDyMvQACEQEJKQMVTQsVMwonbQEabBMmUQENRg03jSw2UAMojTNGbSH/C05FVFNDQVBFMi4wAwEAAAAh+QQIEQAAACwAAAAAeAB4AAAI/wApCBxIsKDBgwgTKlzIsKHDhxAjSpxIsaLFixgzatzIsaPHjyBDihxJsqRJkhUqnFypUSWFlDBjypwJk6VNgzRz6sx5s+fOn0BT9jwZtCjQoSNpWljKtKnTp083SKWJtKNMphkwYOAAoKvXr2C7cjBgYClZAxiWzqyaUeYGC1k5EEAg4IDdu3gF6N0rgK6AAhkMIBiMAIBamWwtXrWwtUBdvHb56iVMmXCDDB8QOCAMIIOFCz8TN1yMAQACyHcnV65coHUDAhYEO5jdurOFo6ITkgbwODXl2atXF0BAYIOG2bMbAChgG3dunDDfZuCNF8ECBheyZ2eqQatWAxzCe//XUMEAcgQNDCxvHvq5QKEwL8DlUAAvAQ2gCxpVyQA4erJzseecaDMxBoB9+LlUEQOaEYaBBgYE6FlRQ9VE0FUe1GdXA/hlxOBgehmgAYQEMOcZaEHdZOF7MV0w3WMCpNWWYHQdUIAGFoxoQAOFpWWUTUDBRcBdsCkWk2B1CQBbdiN+0ICJt6Wook5LNXDXBwoyBJQBjyUAgHYMQLgccz6u9ZJQQP5UZWQaEMQAA2fFKWecI+K4FHV/fZldmGSNCUBaGyA2EJpTKmWBA3YhYMFADEhWmQMNRErApJQSUFZpB/w1wAdgwtmBeq1xcKKgZyKV01KI9rWoQB3shUBrBUj/WmlYhmWgQH21AYDfBXAa8GlXoY4aE4tZprlYqooOROOrrr1WKaUSSNBaWh4EoNcAzN3HK5+ffgAAAX+JGuWAJhnawGRtDrTtm28yiWOdEJ5lgQLUFTDAAACkV6evHXzgbb5/eXAiijqxdKoF5w6WrkTR2VqfANgCKyK/BvgbwbclBixsweXKpF0FbyWMwMIPqQRTBhxYq2kBGID7wVn/YjxpawJIIO64VJU76GIik4yQTm9Vm+S9BWwgmHJdUQrr0npJIHBTOa9EU8iELXxBpLJWusAClHZl63KZFhCAl4FqoDTTroIoQAA3L0UwoR0rxaPCA7XKbAHPTuqVzQoo/2DtAQkQzYFLFeSYIwbgeYXWuyUGUGZ2w0pN5dwIYFA3s3kT4FUAJgoddgDYYlAssToB4PhnZkpOeEwIO6huBP7G/nLFMTs+nYaBj23Y6ArB5O3GK8Zt8lU8bmb5aA37PTToZPOekHZe4xw8SmoWX3nJKW3gAZ65Tzu9QnwCwIHbUScVZAOQImAA8tk7bFcCYo8dQAY1AR0oqx10YKnbkJf/UVAWIACkWKauipElfwiUVwY8J4DcDcBL0ovOUlAmvvstwF/7gxqa4Pa/oFyAAFg7HgU6gLlnYWyBYGvgAALAuQJwIFAxkUoGKOgYBLxQJVvjWlmY0r8NOq8tHgQhCP9F2IHX0IqFAlPAACITv7ENwAMShMv2HJOk3eGQawRIi3w+8zYWhaQoH3xNA0T4QVqtZ4F/0xQLH9gZkEnxW35poAD+dD8KYDGLUfrYsDjIkRZRiVJjvNDqUoKVW72via1RgGf6xrkkwS8BfykLmu6IARi2ByQABKQIdQOyakXmXmtMQAAUuZwkqfBeetEVoSj5tvjUTySZpNQmoQMyW51GhSxkXlfiCL97DQACkCSAB/IzkAU4izwz6WJJ1FSpWeqHkBl6HygfALoGJiABEPDlCkE3gHDdpiDGnBQyaUKwZe7kgwT4QBZ/BhO44MleAXgANbW5zVyGco6iM8gdx3n/SUz60WOTUucsZxK0hwVuAA/wGyhzSc2+zRMCNRvf6O4YQZ58cSYJisnWBCrIt7kzUwcdpd/imdC+ccADjLwX/DiQz2JxjWsV9Z9VMMrPClyQo6RrGAduCcq++VQBHgiqwNDIvDkO7iA2JcDWpIej1PkzmcOzKQbzeSYMSSBs22yoAuS5VQWkJQNr7KYLv3kh0Lx0Aa2sqPlgMiKaXDBCBqgf616ES3vaNQBDrRbzehS8Cpj1gmjdyXvMWbiapmQBAIqrUhbomNzlUpvwfEAS71lBPgpko5zimOpysoBPWcotUpkXbyDGTZVeszUrlOxWufkXBYxzUATZWsVa6VTq/+3xPZ01m2IJydL56MVeD4TkXyTQmciilLKDS8kFvFjMD/QLRVV9SUmW+0xBVeBlumWd1zKkQuHCT6TTyV1CwzpHBag1tr7KbE4rlBPs/iklaWHMSUerl++yEKgzhOcowwq/98aQrM3Nn2aNpVyYkKU0oits4VDW2CaKr5JS4YB4FfpAo84EAApwaQc00AGomqqq8kmJiBB8FQZv88EWgOEGMiAB8a4RogGwYjvNOzyBYLfDZ0IcgA1WIECNWHwEnY74PGNJN94KAvZUKZmSmR+Z3NhkGWBOHQnsNgtwBcGlSS7rmhKoC0jly2AlLX/XpoAiEzTE1zXABRRrga5Eif8oxSrcVrbCua6gxb/tTPFbUgyyL6+YPo4FHUQlML/UpYQryPwAfhQ7IkvC+Zl6VcBYxELidmplzz4KLVzo5Vhf/oVtZl5dm29IAUXHxpU1Juwg2+zC0NrZv0wpjQcmqOc92+qBK/QlJGOcgUAdhnVlsvG7CuyTplbVQDe8gOm6kmDGwIWFnnmKrcZ2UJV+2gNT4U47Wbo6U7/WJxfgJ4oYgyL1IDHPFtgeBqI9QVspT5sQFaUi9ZziX7c5wQNRdHeI+Ux+w/JgIk4ZvtiNFQwI7Ksn9VsBql3h+xKcYEupFr6FXRp/78ziT5VrBUYUm9LYa8hOmc5JZxhUal5T15//VuQMoVKa01noA1r5Emx94tdTqccDHMBWndeNFdABNagKhdi9ILq2Uc7QM9FGGejY9uZ8j4iq2TGVfIh8FbHEeHsrHCoKV+hTFp7c2lxHqaSPLmSQQ/c9ImqrQKKuovcIuZIy4QpXZn07vArVdPF87CkhGb+uq3x7tuGfD0WUo9VVpXBcsWK5Y17JdNe563ftZjaJft+fAnWkHihTTgj/7VIZ7ExNkY9WOq6BCMQXA7dqYuSvCQFgfjqellc42zQPmj2LeNh7pK7UiAW5DXDAZiyd81JKg/eFlrab14RkoKlpT7HdTDsGkmR5cP89OHts6uH5E4KlI/Z50rPC17xW/z25mUv8EnwrvWXru5RJ8xY5Rft/Gv4CVyvooXu3vuPHdUKDyvOmjB51KWEnGMB+hRIfToEWCDYfQPdYrCdcepEp2sQ8YYdSD5YVUIEiT6d5tbVWhAQVtyEd3nFcYVVhMPI+2URP5Qd4Q+VsHgh9XEaA/6Zc7UZ2K2drBieC3OR6vREZ9fV1DPVz/EeD60Zw9HaDmZcBZzddMsgBWOMsJvQVj4Ut4beDqbEXX3diZmRGzwIrA6BI1XdRhcMlqBEZhFEAEqA3mmM6RPOAeXFaWKiFM9MahLEXqNFA7MFjL9FmlJJDfIhZzmVTmSIZVGiFS4M3gNSEmzGHgqg28aOBPP8GX9piWeAkAJvRANICK/UFXDEmPmfBYWeBQPkTARHQh3xYIgSQeANIKtanbIaBcfqkGc6Cd5yzdDEmHvDCLrj4JvwSAaHYLxiEN1shfapofQGkK/2TEBGgGbMChZT2IDiiHdCIi/wCir54Rho4jMSoOWjBRaNzXeixjF8xFmn3jNDYKewCijCzHqNHKD8kOeH2JACwjXq0dgvwjUo1O3ICL+W4j+tCMeoBLNr3hYdHSI2DYh+THZnxGpj1iePIj/v4JvtSO2TyWu24e6XiVxfwAa0RYw/CPwFEiUr1VhvGYXXikOYYih+ARbCyUp2XGFQhg07ycb0VGxEyG/eYP2T/MSLYsY8KsR2M0XLMgUzuETUGqAHhOBYmoz9K9Sk6ySs8KV2cJF/LkWAV2X6R0yLyYZSUpiBc41wa0C786DzAZie/5h6CFDlV1SLmNkoEoT8iApblCJUFkR1voWOSaJY5JZYBmEvrUzeItZPQaFkYiXiKhZfs84V7eS+6Z0cdAJjaQQGL+R7hJmdxdZaGyUnw0Y0VAADXFAEEcQHXUY4MgFQX0AGgERuReZk/k5apBlt+5RgNAE5qBiY/s2Eg8yCqORqsuZopsRwTsJgdEAHQyE6ZZWWpmZuY2Tu9uUKLyQBoBTlI5VcLMHwAUJXIiT2bGWPN+ZyuqFwLoBX0cpzX/+kQGtdmMZYlHfCcvaNsHDBSTTee0DFzeQkXrfEBntdZbPczGdkVnKNluwmf0ekWbfYXu6IdodmOfmUAK1kAMWWdlymgtyMAwgmN6emKZfVBr0IXABBqd6maUUVIWcGZCXAfOvImBIAdWuJXGuAstcFnG4icBRKheZKTb9JZEbFxaQg6dCRTeAk0dDUZsTIpWLQ1vIhA7DKNwVmKd7NSDeqhp4IBqCWHBAA7CZQ/uXilR4pAsIM0psMyTWqYOfEWALBCX8GNDhqgL7MVYyoqRfafzxGmjMFCGPYtBZqE5CkTRrkVIwV3PEogW4ZC8bNsHRmYw6gTPgmFUNKnflo4b0wkp+ITf1zUSimKlWv2AYm3QuKCjUM5Vwu0cuMyU260QE+Dltf5Xxr0olrCmozKFJpaqvsxWFe5H+XUoblJOP+mqgCaq7q6q7zaqwEBADs=';

  function play(img, hold=false){
    if(!img.dataset.pdfForgeStaticSrc) img.dataset.pdfForgeStaticSrc=img.src;
    const staticSrc=img.dataset.pdfForgeStaticSrc;
    img.src='';
    requestAnimationFrame(()=>{ img.src=MAGMA_GIF; });
    if(!hold){
      clearTimeout(img._pdfForgeTimer);
      img._pdfForgeTimer=setTimeout(()=>{ img.src=staticSrc; },760);
    }
  }

  function restore(img){
    clearTimeout(img._pdfForgeTimer);
    if(img.dataset.pdfForgeStaticSrc) img.src=img.dataset.pdfForgeStaticSrc;
  }

  function bind(){
    const zone=document.querySelector('#analysisTool .batch-dropzone');
    const img=zone?.querySelector('.pdf-forge-upload-brand img');
    if(!zone||!img||zone.hasAttribute(BOUND_ATTR)) return false;
    zone.setAttribute(BOUND_ATTR,'1');
    img.dataset.pdfForgeStaticSrc=img.src;

    zone.addEventListener('click',()=>play(img,false));

    let dragDepth=0;
    zone.addEventListener('dragenter',()=>{
      dragDepth++;
      if(dragDepth===1) play(img,true);
    });
    zone.addEventListener('dragover',e=>{ e.preventDefault(); });
    zone.addEventListener('dragleave',()=>{
      dragDepth=Math.max(0,dragDepth-1);
      if(dragDepth===0) restore(img);
    });
    zone.addEventListener('drop',()=>{
      dragDepth=0;
      play(img,false);
    });
    return true;
  }

  if(bind()) return;
  const observer=new MutationObserver(()=>{ if(bind()) observer.disconnect(); });
  observer.observe(document.documentElement,{childList:true,subtree:true});
  setTimeout(()=>observer.disconnect(),12000);
})();
