from pathlib import Path
p=Path('selector-nubes-multistream-core.html')
s=p.read_text()
old="function similar(x,s){if(colorDist(x.rgb,s.rgb)>.035)return false;const wt=Math.max(.06,Math.abs(s.width)*.22);if(Math.abs(x.width-s.width)>wt)return false;if((x.curves>0)!==(s.curves>0)||(x.lines>0)!==(s.lines>0))return false;const ds=diag(s.bbox),dx=diag(x.bbox);if(ds>0&&(dx/ds<.48||dx/ds>2.1))return false;const tol=Math.max(2,Math.ceil(s.segs*.45));return Math.abs(x.segs-s.segs)<=tol}"
new="function similar(x,s){if(colorDist(x.rgb,s.rgb)>.028)return false;const wt=Math.max(.045,Math.abs(s.width)*.16);if(Math.abs(x.width-s.width)>wt)return false;if((x.curves>0)!==(s.curves>0)||(x.lines>0)!==(s.lines>0))return false;const sw=Math.max(.001,Math.abs(s.bbox[2]-s.bbox[0])),sh=Math.max(.001,Math.abs(s.bbox[3]-s.bbox[1])),xw=Math.max(.001,Math.abs(x.bbox[2]-x.bbox[0])),xh=Math.max(.001,Math.abs(x.bbox[3]-x.bbox[1])),ds=Math.hypot(sw,sh),dx=Math.hypot(xw,xh);if(ds>0&&(dx/ds<.68||dx/ds>1.47))return false;const sar=sw/sh,xar=xw/xh;if(Math.max(sar,xar)/Math.max(.001,Math.min(sar,xar))>1.45)return false;const curveRatioS=s.curves/Math.max(1,s.segs),curveRatioX=x.curves/Math.max(1,x.segs);if(Math.abs(curveRatioX-curveRatioS)>.18)return false;const tol=Math.max(1,Math.ceil(s.segs*.25));return Math.abs(x.segs-s.segs)<=tol}"
if old not in s:
    raise SystemExit('old similar() not found exactly')
s=s.replace(old,new,1)
p.write_text(s)
print('tightened similar()')
