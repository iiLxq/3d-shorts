// ---------- engine: math, GL, meshes, draw queue ----------
const W=1080,H=1920;
const cv=document.getElementById('c');cv.width=W;cv.height=H;
const gl=cv.getContext('webgl2',{antialias:true,preserveDrawingBuffer:true});
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],
 scl=(a,s)=>[a[0]*s,a[1]*s,a[2]*s],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],
 cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],
 len=a=>Math.hypot(a[0],a[1],a[2]),norm=a=>scl(a,1/len(a)),lerp=(a,b,t)=>a+(b-a)*t,
 clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),ease=t=>{t=clamp(t,0,1);return t*t*(3-2*t)},
 easeIn=t=>{t=clamp(t,0,1);return t*t},easeOut=t=>{t=clamp(t,0,1);return 1-(1-t)*(1-t)},
 vlerp=(a,b,t)=>[lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t)];
function rnd(i){const x=Math.sin(i*127.1+311.7)*43758.5453;return x-Math.floor(x)}
function persp(fy,a,n,f){const t=1/Math.tan(fy/2);return[t/a,0,0,0,0,t,0,0,0,0,(f+n)/(n-f),-1,0,0,2*f*n/(n-f),0]}
function mul(a,b){const o=new Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+r]*b[c*4+k];o[c*4+r]=s}return o}
function lookAt(e,t,u){const z=norm(sub(e,t)),x=norm(cross(u,z)),y=cross(z,x);return[x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,e),-dot(y,e),-dot(z,e),1]}
const I3=[[1,0,0],[0,1,0],[0,0,1]];
function rotZ(a){const c=Math.cos(a),s=Math.sin(a);return[[c,s,0],[-s,c,0],[0,0,1]]}
function rotX(a){const c=Math.cos(a),s=Math.sin(a);return[[1,0,0],[0,c,s],[0,-s,c]]}
function rotY(a){const c=Math.cos(a),s=Math.sin(a);return[[c,0,-s],[0,1,0],[s,0,c]]}
function bmul(A,B){const ap=v=>add(add(scl(A[0],v[0]),scl(A[1],v[1])),scl(A[2],v[2]));return[ap(B[0]),ap(B[1]),ap(B[2])]}
function bapply(A,v){return add(add(scl(A[0],v[0]),scl(A[1],v[1])),scl(A[2],v[2]))}
function prog(vs,fs){const p=gl.createProgram();for(const[t,s]of[[gl.VERTEX_SHADER,vs],[gl.FRAGMENT_SHADER,fs]]){const sh=gl.createShader(t);gl.shaderSource(sh,s);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw gl.getShaderInfoLog(sh);gl.attachShader(p,sh)}gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw gl.getProgramInfoLog(p);return p}
const GRADE=`
uniform float sepia,expo,flash;
vec3 grade(vec3 c){float l=dot(c,vec3(.299,.587,.114));vec3 sp=vec3(l)*vec3(1.12,.92,.66)*1.05;c=mix(c,sp,sepia);c*=expo;c+=vec3(flash);return c;}`;
const P=prog(`#version 300 es
layout(location=0) in vec3 p;layout(location=1) in vec3 n;
uniform mat4 M,VP;uniform mat3 N;out vec3 vN,vW;
void main(){vec4 w=M*vec4(p,1.);vW=w.xyz;vN=N*n;gl_Position=VP*w;}`,
`#version 300 es
precision highp float;in vec3 vN,vW;uniform vec3 col,emis,cam,fogc,L1,K1,K2,amb0,amb1;uniform float rough,fogd,mode,seed;out vec4 o;
${GRADE}
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
void main(){vec3 n=normalize(vN);if(!gl_FrontFacing)n=-n;vec3 v=normalize(cam-vW);
 vec3 L2=normalize(vec3(-.7,.2,-.5));
 float d1=max(dot(n,L1),0.),d2=max(dot(n,L2),0.);
 float hemi=.5+.5*n.y;
 vec3 base=col;vec3 e=emis;
 if(mode>.5&&abs(n.y)<.5){vec2 uv=vec2(abs(n.x)>.5?vW.z:vW.x,vW.y);vec2 cell=floor(uv/vec2(1.5,2.2));vec2 f=fract(uv/vec2(1.5,2.2));
  float win=step(.18,f.x)*step(f.x,.82)*step(.22,f.y)*step(f.y,.8);float hsh=h21(cell+seed*17.1);
  float lit=step(.58,hsh);vec3 wc=mix(vec3(1.,.78,.45),vec3(.65,.85,1.),step(.85,hsh));
  base=mix(base,vec3(.05,.07,.1),win);e+=win*lit*wc*1.1*(.6+.4*h21(cell+3.3));}
 vec3 c=base*(mix(amb0,amb1,hemi)+K1*d1+K2*d2);
 vec3 h=normalize(L1+v);c+=K1*pow(max(dot(n,h),0.),mix(90.,12.,rough))*(1.-rough)*.5;
 float fr=pow(1.-max(dot(n,v),0.),3.);c+=K2*fr*.4;
 c+=e;
 float dist=length(cam-vW);float f=1.-exp(-dist*fogd);
 c=mix(c,fogc,f);
 c=c/(1.+c*.12);
 c=grade(c);
 o=vec4(pow(max(c,0.),vec3(1./1.1)),1.);}`);
const PP=prog(`#version 300 es
layout(location=0) in vec3 p;layout(location=1) in vec4 c;layout(location=2) in float s;
uniform mat4 VP;uniform float psc;out vec4 vc;
void main(){gl_Position=VP*vec4(p,1.);gl_PointSize=clamp(s*psc/gl_Position.w,1.,800.);vc=c;}`,
`#version 300 es
precision highp float;in vec4 vc;out vec4 o;
${GRADE}
void main(){vec2 d=gl_PointCoord-.5;float r=length(d)*2.;float a=exp(-r*r*4.)*(1.-smoothstep(.85,1.,r));vec3 c=vc.rgb*a*vc.a;c=mix(c,vec3(dot(c,vec3(.3,.59,.11)))*vec3(1.12,.92,.66),sepia);o=vec4(c*expo,1.);}`);
const PB_=prog(`#version 300 es
layout(location=0) in vec2 p;out vec2 uv;void main(){uv=p*.5+.5;gl_Position=vec4(p,0.,1.);}`,
`#version 300 es
precision highp float;in vec2 uv;uniform vec3 top,bot;${GRADE}out vec4 o;void main(){vec3 c=mix(bot,top,smoothstep(0.,1.,uv.y));c=grade(c);o=vec4(pow(max(c,0.),vec3(1./1.1)),1.);}`);
const U={};for(const k of['M','VP','N','col','emis','cam','fogc','rough','fogd','mode','seed','L1','K1','K2','amb0','amb1','sepia','expo','flash'])U[k]=gl.getUniformLocation(P,k);
const UP={VP:gl.getUniformLocation(PP,'VP'),psc:gl.getUniformLocation(PP,'psc'),sepia:gl.getUniformLocation(PP,'sepia'),expo:gl.getUniformLocation(PP,'expo')};
const UB={top:gl.getUniformLocation(PB_,'top'),bot:gl.getUniformLocation(PB_,'bot'),sepia:gl.getUniformLocation(PB_,'sepia'),expo:gl.getUniformLocation(PB_,'expo'),flash:gl.getUniformLocation(PB_,'flash')};
function mesh(pos,nor,idx){const va=gl.createVertexArray();gl.bindVertexArray(va);
 const b1=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b1);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(pos),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);
 const b2=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b2);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(nor),gl.STATIC_DRAW);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,0,0);
 const b3=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,b3);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(idx),gl.STATIC_DRAW);return{va,n:idx.length}}
function boxMesh(){const P=[],N=[],I=[];const f=[[[1,0,0],[0,1,0],[0,0,1]],[[-1,0,0],[0,1,0],[0,0,-1]],[[0,1,0],[0,0,1],[1,0,0]],[[0,-1,0],[0,0,1],[-1,0,0]],[[0,0,1],[1,0,0],[0,1,0]],[[0,0,-1],[-1,0,0],[0,1,0]]];
 for(const[n,u,v]of f){const b=P.length/3;for(const[a,c]of[[-1,-1],[1,-1],[1,1],[-1,1]]){const q=add(scl(n,.5),add(scl(u,.5*a),scl(v,.5*c)));P.push(...q);N.push(...n)}
  const cr=cross(u,v);if(dot(cr,n)>0)I.push(b,b+1,b+2,b,b+2,b+3);else I.push(b,b+2,b+1,b,b+3,b+2)}return mesh(P,N,I)}
function cylMesh(sg){const P=[],N=[],I=[];for(let i=0;i<=sg;i++){const a=i/sg*Math.PI*2,x=Math.cos(a),z=Math.sin(a);P.push(x*.5,-.5,z*.5,x*.5,.5,z*.5);N.push(x,0,z,x,0,z)}
 for(let i=0;i<sg;i++){const a=i*2;I.push(a,a+1,a+3,a,a+3,a+2)}
 for(const y of[-.5,.5]){const c=P.length/3;P.push(0,y,0);N.push(0,Math.sign(y),0);for(let i=0;i<=sg;i++){const a=i/sg*Math.PI*2;P.push(Math.cos(a)*.5,y,Math.sin(a)*.5);N.push(0,Math.sign(y),0)}
  for(let i=0;i<sg;i++)y>0?I.push(c,c+2+i,c+1+i):I.push(c,c+1+i,c+2+i)}return mesh(P,N,I)}
function sphMesh(a,b){const P=[],N=[],I=[];for(let i=0;i<=a;i++){const th=i/a*Math.PI;for(let j=0;j<=b;j++){const ph=j/b*Math.PI*2;const n=[Math.sin(th)*Math.cos(ph),Math.cos(th),Math.sin(th)*Math.sin(ph)];P.push(...scl(n,.5));N.push(...n)}}
 for(let i=0;i<a;i++)for(let j=0;j<b;j++){const p=i*(b+1)+j,q=p+b+1;I.push(p,p+1,q+1,p,q+1,q)}return mesh(P,N,I)}
const BOX=boxMesh(),CYL=cylMesh(32),ROPE=cylMesh(10),SPH=sphMesh(14,22);
let Q=[],PTS=[];
function obj(m,c,basis,s,col,o={}){Q.push({m,c,B:basis||I3,s,col,emis:o.emis||[0,0,0],rough:o.rough??.5,mode:o.mode||0,seed:o.seed||0})}
const box=(c,s,col,o,B)=>obj(BOX,c,B,s,col,o);
const sph=(c,r,col,o,B,sc)=>obj(SPH,c,B,sc||[2*r,2*r,2*r],col,o);
function cylB(a,b,r,col,o,m=ROPE){const d=sub(b,a),L=len(d);if(L<1e-4)return;const ay=scl(d,1/L);const ref=Math.abs(ay[1])<.9?[0,1,0]:[1,0,0];const ax=norm(cross(ay,ref)),az=cross(ax,ay);
 obj(m,scl(add(a,b),.5),[ax,ay,az],[2*r,L,2*r],col,o)}
function disc(c,r,th,col,o,B){obj(CYL,c,bmul(B||I3,[[1,0,0],[0,0,1],[0,-1,0]]),[2*r,th,2*r],col,o)} // axis Z
function discX(c,r,th,col,o,B){obj(CYL,c,bmul(B||I3,[[0,-1,0],[1,0,0],[0,0,1]]),[2*r,th,2*r],col,o)} // axis X
function poly(pts,r,col,o){for(let i=0;i+1<pts.length;i++)cylB(pts[i],pts[i+1],r,col,o)}
function pt(p,c,a,s){PTS.push(p[0],p[1],p[2],c[0],c[1],c[2],a,s)}
const PV=gl.createVertexArray(),PBUF=gl.createBuffer();
gl.bindVertexArray(PV);gl.bindBuffer(gl.ARRAY_BUFFER,PBUF);
gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,32,0);
gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,4,gl.FLOAT,false,32,12);
gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,1,gl.FLOAT,false,32,28);
const QV=gl.createVertexArray(),QB=gl.createBuffer();gl.bindVertexArray(QV);gl.bindBuffer(gl.ARRAY_BUFFER,QB);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
// 7-seg digit: draws in plane facing +z (or basis B)
const SEG={0:'abcdef',1:'bc',2:'abged',3:'abgcd',4:'fgbc',5:'afgcd',6:'afgedc',7:'abc',8:'abcdefg',9:'abcdfg'};
function digit(c,h,d,col,B){const w=h*.5,t=h*.12;const S={a:[0,h/2,1],b:[w/2,h/4,0],c:[w/2,-h/4,0],d:[0,-h/2,1],e:[-w/2,-h/4,0],f:[-w/2,h/4,0],g:[0,0,1]};
 for(const k of'abcdefg'){const on=SEG[d].includes(k);const s=S[k];const p=add(c,bapply(B||I3,[s[0],s[1],0]));
  box(p,s[2]?[w*.8,t,.01]:[t,h*.42,.01],on?[.05,.02,.01]:[.06,.05,.05],{emis:on?col:[0,0,0]},B)}}
// draw everything
function draw(view){
 const VP=mul(persp(view.fov*Math.PI/180,W/H,view.near||.05,view.far||400),lookAt(view.e,view.l,view.up||[0,1,0]));
 const L=view.light;
 gl.viewport(0,0,W,H);gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
 // background gradient
 gl.disable(gl.DEPTH_TEST);gl.useProgram(PB_);gl.uniform3fv(UB.top,view.skyTop||view.fog);gl.uniform3fv(UB.bot,view.skyBot||view.fog);
 gl.uniform1f(UB.sepia,view.sepia||0);gl.uniform1f(UB.expo,view.expo??1);gl.uniform1f(UB.flash,view.flash||0);
 gl.bindVertexArray(QV);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
 gl.enable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.enable(gl.CULL_FACE);
 gl.useProgram(P);gl.uniformMatrix4fv(U.VP,false,VP);gl.uniform3fv(U.cam,view.e);gl.uniform3fv(U.fogc,view.fog);gl.uniform1f(U.fogd,view.fogd);
 gl.uniform3fv(U.L1,norm(L.dir));gl.uniform3fv(U.K1,L.k1);gl.uniform3fv(U.K2,L.k2);gl.uniform3fv(U.amb0,L.a0);gl.uniform3fv(U.amb1,L.a1);
 gl.uniform1f(U.sepia,view.sepia||0);gl.uniform1f(U.expo,view.expo??1);gl.uniform1f(U.flash,view.flash||0);
 for(const o of Q){const[ax,ay,az]=o.B;const s3=o.s;
  const M=[...scl(ax,s3[0]),0,...scl(ay,s3[1]),0,...scl(az,s3[2]),0,...o.c,1];
  const N=[...scl(ax,1/s3[0]),...scl(ay,1/s3[1]),...scl(az,1/s3[2])];
  gl.uniformMatrix4fv(U.M,false,M);gl.uniformMatrix3fv(U.N,false,N);gl.uniform3fv(U.col,o.col);gl.uniform3fv(U.emis,o.emis);gl.uniform1f(U.rough,o.rough);gl.uniform1f(U.mode,o.mode);gl.uniform1f(U.seed,o.seed);
  gl.bindVertexArray(o.m.va);gl.drawElements(gl.TRIANGLES,o.m.n,gl.UNSIGNED_SHORT,0)}
 if(PTS.length){gl.useProgram(PP);gl.uniformMatrix4fv(UP.VP,false,VP);gl.uniform1f(UP.psc,1000);gl.uniform1f(UP.sepia,view.sepia||0);gl.uniform1f(UP.expo,view.expo??1);
  gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);gl.depthMask(false);
  gl.bindVertexArray(PV);gl.bindBuffer(gl.ARRAY_BUFFER,PBUF);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(PTS),gl.DYNAMIC_DRAW);
  gl.drawArrays(gl.POINTS,0,PTS.length/8);gl.depthMask(true);}
}
