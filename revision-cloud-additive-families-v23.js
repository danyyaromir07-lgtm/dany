// Diagnostic-only wrapper around v22. No detection/removal behavior changes.
import { detectAdditiveRevisionCloudFamilies as detectV22, removeAdditiveRevisionCloudFamilies as removeV22 } from './revision-cloud-additive-families-v22.js?v=20260831-byteparser1';
const WS=c=>c===0||c===9||c===10||c===12||c===13||c===32;
const A=(b,s,e)=>{let x='';for(let i=s;i<e;i++)x+=String.fromCharCode(b[i]);return x};
const skip=(b,i)=>{while(i<b.length){if(WS(b[i])){i++;continue}if(b[i]===37){while(i<b.length&&b[i]!==10&&b[i]!==13)i++;continue}break}return i};
function tok(b,i){i=skip(b,i);if(i>=b.length)return null;const s=i;while(i<b.length&&!WS(b[i])&&b[i]!==37)i++;return{s,e:i,t:A(b,s,i)}}
function prev(b,i){i--;while(i>=0&&WS(b[i]))i--;if(i<0)return null;const e=i+1;while(i>=0&&!WS(b[i]))i--;return{s:i+1,e,t:A(b,i+1,e)}}
const N=t=>t&&/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(t.t)?Number(t.t):NaN;
function redOffsets(b){const out=[];for(let i=0;i+1<b.length;i++){if(b[i]!==82||b[i+1]!==71)continue;if(i>0&&!WS(b[i-1]))continue;if(i+2<b.length&&!WS(b[i+2]))continue;const z=prev(b,i),y=z&&prev(b,z.s),x=y&&prev(b,y.s);if(N(x)===1&&N(y)===0&&N(z)===0)out.push({start:x.s,end:i+2})}return out}
function tokenPreview(b,i,n=22){const out=[];for(let k=0;k<n;k++){const t=tok(b,i);if(!t)break;out.push(t.t);i=t.e}return out.join(' ')}
function diagnostic(doc){let objects=0,streams=0,reds=0;const rows=[];try{objects=Number(doc.countObjects?.()||0)}catch(_){return{objects,streams,reds,rows}}for(let xref=1;xref<objects;xref++){try{const ref=doc.newIndirect(xref,0);if(!ref?.isStream?.())continue;streams++;const b=new Uint8Array(ref.readStream().asUint8Array());const rr=redOffsets(b);reds+=rr.length;for(let j=0;j<rr.length;j++)rows.push(`x${xref}r${j+1}=${tokenPreview(b,rr[j].end)}`)}catch(err){rows.push(`x${xref}=ERR:${err?.message||String(err)}`)}}return{objects,streams,reds,rows}}
function diag(stage,extra={}){try{window.__cloudDiagnostic?.({stage,detail:'additive-qcm-v23-token-diag',...extra})}catch(_){}}
export async function detectAdditiveRevisionCloudFamilies(data,context={}){try{const mupdf=await import('https://cdn.jsdelivr.net/npm/mupdf@1.28.0/dist/mupdf.js'),doc=mupdf.PDFDocument.openDocument(new Uint8Array(data),'application/pdf');try{const d=diagnostic(doc);diag('cloud.qcm23.tokens',{file:context.file,reason:`objetos=${d.objects} streams=${d.streams} RGrojos=${d.reds} | ${d.rows.join(' || ').slice(0,6000)}`})}finally{doc.destroy()}}catch(err){diag('cloud.qcm23.error',{file:context.file,error:err?.message||String(err)})}return detectV22(data,context)}
export async function removeAdditiveRevisionCloudFamilies(data,pages,options={}){return removeV22(data,pages,options)}
if(typeof window!=='undefined')window.__revisionCloudAdditiveV23={version:'23-token-diag1'};
