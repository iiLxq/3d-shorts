// ---------- palettes & lights ----------
const C={wall:[.16,.18,.24],wall2:[.12,.13,.18],rail:[.62,.66,.72],bracket:[.30,.33,.40],
 car:[.86,.88,.92],carDark:[.30,.34,.42],accent:[.10,.65,.95],frame:[.95,.72,.10],rope:[.72,.74,.78],
 gov:[1.,.42,.10],govDark:[.22,.24,.30],weight:[1.,.55,.08],wedge:[1.,.80,.15],light:[.35,.85,1.],hi:[.3,.9,1.]};
const L_MR={dir:[.4,.85,.5],k1:[1.25,1.15,1.0],k2:[.18,.22,.3],a0:[.16,.16,.18],a1:[.3,.3,.32]};
const L_SHAFT={dir:[.55,.75,.6],k1:[1.2,1.14,1.05],k2:[.12,.19,.32],a0:[.10,.12,.17],a1:[.22,.25,.32]};
const FOG_SHAFT=[.035,.05,.09];
// ---------- SHAFT ----------
const ROPEX=[-.25,-.15,-.05,.05,.15,.25];
const SHC=[0,21.6,-.568],SHR=.568,SNAPY=5.2;
const GOV=[-1.75,13,.3],GR=.4;
function sparkBurst(p0,d,n,seed,spd,life,size,col){ // d = time since burst
 if(d<0||d>life)return;for(let i=0;i<n;i++){const k=i+seed;const v=[(rnd(k)-.5)*2*spd,(rnd(k+9)-.35)*2*spd,(rnd(k+19)-.5)*1.4*spd];const lf=life*(.4+.6*rnd(k+5));if(d>lf)continue;
  for(let j=0;j<3;j++){const a=Math.max(0,d-j*.01);const p=add(p0,add(scl(v,a),[0,-4.9*a*a,0]));pt(p,col||[1,.75,.35],(1-d/lf)*(1-j*.3),size*(1-j*.25))}}}
function shaft(st){
 const yc=st.yc,cy=st.camY;
 // walls & landings
 box([0,-93,-1.35],[5.4,226,.2],C.wall,{rough:.95});
 box([-2.7,-93,0],[.2,226,2.9],C.wall2,{rough:.95});box([2.7,-93,0],[.2,226,2.9],C.wall2,{rough:.95});
 const streak=st.streak||0;
 for(let y=-206;y<=18;y+=3.5){if(Math.abs(y-cy)>50)continue;
  box([0,y,-1.22],[5.2,.12,.08],[.24,.27,.34],{rough:.9});
  box([0,y+2.9,-1.22],[3.2,.035+streak,.03],[0,0,0],{emis:scl(C.light,.9)});}
 for(const sx of[-1,1]){
  box([sx*1.10,-93,0],[.10,226,.03],C.rail,{rough:.25});
  box([sx*1.17,-93,0],[.04,226,.16],C.rail,{rough:.3});
  for(let y=-204;y<19;y+=5){if(Math.abs(y-cy)>50)continue;box([sx*1.92,y,-.05],[1.46,.06,.08],C.bracket,{rough:.7})}}
 // machine room (above slab)
 box([0,20.2,0],[5.6,.4,2.9],C.wall2,{rough:.95});
 if(cy>14){
  box([0,20.25,-.6],[7,.3,5],[.32,.3,.29],{rough:.9});
  box([0,22.5,-3.1],[7,5,.2],[.30,.29,.28],{rough:.95});box([-3.4,22.5,-.6],[.2,5,5],[.27,.26,.26],{rough:.95});box([3.4,22.5,-.6],[.2,5,5],[.27,.26,.26],{rough:.95});
  box([0,25,-.6],[7,.2,5],[.2,.2,.2]);box([-2.2,21.3,-2.7],[1.2,1.8,.5],[.35,.38,.42],{rough:.5});for(let k=0;k<4;k++)box([-2.5+k*.2,21.9,-2.44],[.06,.06,.02],[0,0,0],{emis:k%2?[.2,1,.3]:[1,.5,.1]});box([-2.2,21.2,-2.44],[.9,.9,.01],[.25,.27,.3]);box([0,24.85,-.6],[1.6,.06,.4],[0,0,0],{emis:[1.4,1.25,1.0]});
  // machine base, motor, brake, sheave
  box([.5,20.7,-.568],[2.4,.3,1.0],[.2,.22,.27],{rough:.6});
  const ang=st.sheaveAng||0;const Bs=rotX(ang);
  discX([0,21.6,-.568],SHR-.02,.72,[.32,.34,.38],{rough:.35},Bs);
  for(const x of ROPEX)discX([x,21.6,-.568],SHR-.035,.03,[.12,.13,.16],{},Bs);
  for(const sx of[-1,1]){for(let k=0;k<5;k++){const a=ang+k*Math.PI*2/5;const B=bmul(rotX(a),I3);box(add([sx*.37,21.6,-.568],bapply(rotX(a),[0,.25,0])),[.03,.45,.07],[.85,.55,.12],{},rotX(a))}
   discX([sx*.38,21.6,-.568],.09,.04,[.8,.82,.86],{rough:.2})}
  cylB([-.6,21.6,-.568],[1.8,21.6,-.568],.06,[.7,.72,.76],{rough:.2},CYL);
  discX([1.25,21.6,-.568],.52,.9,[.10,.42,.75],{rough:.4});discX([1.25,21.6,-.568],.47,.95,[.08,.30,.55],{rough:.4});
  for(let k=0;k<8;k++)discX([1.25,21.6,-.568],.535,.02,[.15,.5,.85],{});
  discX([.6,21.6,-.568],.32,.18,[.82,.2,.12],{rough:.4},rotX(ang*3));
  box([1.25,21.05,-.568],[.8,.2,.8],[.18,.2,.24]);
 }
 // governor
 const g=st.gov||{ang:0,spread:0,trip:0,jaw:0,glow:0};
 box([GOV[0],GOV[1]-.05,.02],[.14,.9,.06],C.govDark,{rough:.6});
 box([-2.25,GOV[1]-.45,.1],[.7,.1,.3],C.govDark,{rough:.6});
 box([GOV[0],GOV[1],.12],[.1,.1,.32],C.govDark);
 const Bg=rotZ(g.ang);const ge=scl([1,.45,.1],g.glow||0);
 disc(GOV,GR,.09,C.gov,{rough:.35,emis:ge},Bg);
 disc(add(GOV,[0,0,.05]),GR*.82,.02,[.16,.17,.22],{},Bg);
 for(let k=0;k<4;k++){const a=g.ang+k*Math.PI/2;box(add(GOV,[Math.cos(a)*GR*.42,Math.sin(a)*GR*.42,.065]),[GR*.8,.05,.03],C.gov,{rough:.4,emis:ge},rotZ(a))}
 disc(add(GOV,[0,0,.08]),.06,.06,[.8,.82,.86],{rough:.2});
 for(let k=0;k<2;k++){const a=g.ang+k*Math.PI;const piv=add(GOV,[Math.cos(a)*.10,Math.sin(a)*.10,.1]);const ta=a+Math.PI/2-g.spread;
  const tip=add(piv,[Math.cos(ta)*.22,Math.sin(ta)*.22,0]);cylB(piv,tip,.018,[.85,.85,.9],{rough:.3});
  box(tip,[.09,.06,.05],C.weight,{rough:.35,emis:scl([1,.4,.05],.3*g.spread+(g.wglow||0))},rotZ(ta));}
 const lat=-.55*g.trip;const lp=[GOV[0]+.32,GOV[1]+.5,.36];
 box(add(lp,[-.12*Math.cos(lat),.12*Math.sin(lat),0]),[.26,.05,.05],C.weight,{emis:scl([1,.1,.05],g.latchGlow||0)},rotZ(lat));
 disc(lp,.03,.07,[.8,.8,.85],{rough:.2});cylB(lp,[-1.32,GOV[1]-.1,.33],.012,[.75,.76,.8],{emis:scl([1,.2,.05],(g.latchGlow||0)*.5)});
 const jw=.06*(1-g.jaw);
 box([-1.35+.05+jw,GOV[1]-.2,.3],[.05,.18,.08],C.govDark,{emis:scl([1,.15,.05],g.jawGlow||0)});
 box([-1.35-.05-jw,GOV[1]-.2,.3],[.05,.18,.08],C.govDark,{emis:scl([1,.15,.05],g.jawGlow||0)});
 // governor rope
 const lift=st.lift||0;const attach=[-1.35,yc+.45+lift*.16,.3];
 const grc=st.govRopeGlow?{rough:.4,emis:scl([1,.45,.1],st.govRopeGlow)}:{rough:.4};
 cylB([-1.35,GOV[1],.3],attach,.012,C.rope,grc);
 cylB(attach,[-1.35,-210,.3],.012,C.rope,{rough:.4});
 cylB([-2.15,GOV[1],.3],[-2.15,-210,.3],.012,C.rope,{rough:.4});
 // car
 const P=v=>add([0,yc,0],v);
 box(P([0,1.35,0]),[1.7,2.4,1.5],C.car,{rough:.45});
 box(P([0,1.35,.755]),[1.7,.10,.01],C.accent,{rough:.3,emis:scl(C.accent,.25)});
 box(P([-.33,1.25,.76]),[.62,2.1,.02],[.68,.72,.80],{rough:.2});box(P([.33,1.25,.76]),[.62,2.1,.02],[.68,.72,.80],{rough:.2});
 box(P([0,1.25,.765]),[.012,2.1,.02],[.2,.22,.28]);
 box(P([0,2.62,0]),[1.74,.12,1.54],C.carDark);box(P([0,.12,0]),[1.74,.14,1.54],C.carDark);
 box(P([0,2.76,0]),[2.1,.18,.22],C.frame,{rough:.5});box(P([0,.04,0]),[2.1,.14,.22],C.frame,{rough:.5});
 box(P([0,2.88,0]),[.7,.06,.16],C.carDark); // rope hitch plate
 for(const sx of[-1,1]){box(P([sx*.99,1.4,0]),[.08,2.88,.2],C.frame,{rough:.5});box(P([sx*1.04,2.62,0]),[.06,.16,.14],C.carDark);}
 const heat=st.heat||0;const wg=st.wedgeGlow||0;
 for(const sx of[-1,1]){box(P([sx*1.0,.18,0]),[.06,.36,.24],C.carDark);
  for(const sz of[-1,1]){
   if(sz<0)box(P([sx*1.09,.18,sz*.10]),[.14,.36,.05],C.carDark,{rough:.5});
   else{box(P([sx*1.09,.37,.07]),[.14,.03,.11],C.carDark);box(P([sx*1.09,-.01,.07]),[.14,.03,.11],C.carDark);}
   const gap=.03*(1-lift);
   box(P([sx*1.10,.12+.10*lift,sz*(.015+.02+gap)]),[.12,.2,.04],vlerp(C.wedge,[.35,.08,.02],Math.min(1,heat)),{rough:.3,emis:add(scl([1,.28,.03],heat*.9),scl([1,.8,.2],wg))});}}
 cylB(P([-1.0,.42,.14]),attach,.02,C.frame,{rough:.4,emis:scl([1,.6,.1],st.leverGlow||0)});
 box(attach,[.07,.07,.07],C.carDark);
 cylB(P([-1.0,.42,.14]),P([-1.06,.18+.12*lift,.11]),.012,[.85,.85,.9]);
 // hoist ropes
 const topY=yc+2.91;const snap=st.snapD||[];const hi=st.hi||[],gh=st.ghost||[];
 for(let i=0;i<6;i++){const x=ROPEX[i];const g2=gh[i]||0;const col=vlerp(C.rope,[.06,.08,.12],g2);const r=.018*(1-.45*g2);
  const o={rough:.35,emis:scl(C.hi,(hi[i]||0)*(1-g2))};
  const d=snap[i];
  if(d==null||d<0){
   if(st.fray&&st.fray.idx===i){frayRope(x,topY,st.fray,col,r,o)}
   else if(st.strands&&i>=2&&i<=4){cylB([x,topY,0],[x,4.9,0],r,col,o);cylB([x,5.9,0],[x,21.6,0],r,col,o);strands(x,4.9,5.9,r,col,o)}
   else cylB([x,topY,0],[x,21.6,0],r,col,o);
  } else {
   const ry=SNAPY+11*(1-Math.exp(-3.5*d)),wh=.55*Math.sin(22*d+i*1.7)*Math.exp(-2.2*d)*(i%2?1:-1);
   const mid=[x+wh,lerp(ry,21.6,.4),.15*wh];cylB([x+wh*.4,ry,.1*wh],mid,r,col,o);cylB(mid,[x,21.6,0],r,col,o);
   const Lr=SNAPY-2.91,seg=5;let p=[x,topY,0];const flop=st.flop||0;const side=(i<3?-1:1);const fl=st.flutter??1;
   for(let k=1;k<=seg;k++){const a=side*(k/seg)*(.22*fl*Math.sin(9*d+i)+flop*(.4+k*.2));const ang=a+side*.04*k;
    const q=add(p,[Math.sin(ang)*Lr/seg,Math.cos(ang)*Lr/seg,.04*fl*Math.sin(5*d+k+i)]);cylB(p,q,r,col,o);p=q}
   if(st.burst!==false)sparkBurst([x,SNAPY,0],d,14,i*40,5,.6,.035);
   if(d<.15&&st.burst!==false)pt([x,SNAPY,.05],[1,.9,.7],(1-d/.15)*1.2,.9);
  }
  // rope arc over sheave + back side
  if(cy>14){const pts=[];for(let k=0;k<=12;k++){const ph=k/12*Math.PI;pts.push([x,21.6+SHR*Math.sin(ph),-.568+SHR*Math.cos(ph)])}poly(pts,r,col,o);
   cylB([x,21.6,-1.136],[x,20.3,-1.136],r,col,o);
   if(st.markers!=null&&(d==null||d<0)){const tr=st.markers;for(let k=0;k<8;k++){let yy=20.4+((k*.45+tr)%3.6);if(yy<21.6)cylB([x,yy-.025,0],[x,yy+.025,0],r*1.25,[.3,.32,.36]);
     let yb=21.6-((k*.45+tr)%3.6);if(yb>20.4)cylB([x,yb-.025,-1.136],[x,yb+.025,-1.136],r*1.25,[.3,.32,.36]);}}}
 }
 if(st.dust!==false)for(let i=0;i<220;i++){const p=[(rnd(i)-.5)*4.6,cy-14+rnd(i+1)*28+Math.sin((st.t||0)*.4+i)*.1,(rnd(i+2)-.5)*2.2];pt(p,[.6,.75,1],.16,.012)}
}
function strands(x,y0,y1,r,col,o){const n=Math.max(4,Math.round((y1-y0)*120));for(let k=0;k<3;k++){const pts=[];for(let j=0;j<=n;j++){const y=lerp(y0,y1,j/n);const a=k*2.094+y*16;pts.push([x+Math.cos(a)*r*.45,y,Math.sin(a)*r*.45])}poly(pts,r*.56,col,o)}}
function frayRope(x,topY,f,col,r,o){
 const yf=f.y,bul=f.f;
 if(f.d==null||f.d<0){
  cylB([x,topY,0],[x,4.9,0],r,col,o);strands(x,4.9,yf-.07,r,col,o);strands(x,yf+.07,5.9,r,col,o);cylB([x,5.9,0],[x,21.6,0],r,col,o);
  for(let k=0;k<14;k++){const a=k/14*Math.PI*2+.3;const br=bul>(k+1)/15.5;const ro=.008+.03*bul*(.6+.4*rnd(k));
   const c0=[x+Math.cos(a)*.008,yf-.07,Math.sin(a)*.008],c1=[x+Math.cos(a)*.008,yf+.07,Math.sin(a)*.008],m=[x+Math.cos(a)*ro,yf,Math.sin(a)*ro];
   if(!br)poly([c0,m,c1],.0019,[.8,.8,.82],{rough:.3});
   else{const curl=.018+.015*rnd(k+3);const m0=add(c0,[Math.cos(a)*curl*.6,.025,Math.sin(a)*curl*.6]),m1=add(c1,[Math.cos(a)*curl*.6,-.025,Math.sin(a)*curl*.6]);poly([c0,m0,add(m0,[Math.cos(a)*curl,.004,Math.sin(a)*curl])],.0019,[.9,.82,.7],{rough:.3});poly([c1,m1,add(m1,[Math.cos(a)*curl,-.004,Math.sin(a)*curl])],.0019,[.9,.82,.7],{rough:.3})}}
 } else {
  const d=f.d;const ry=yf+.07+9*(1-Math.exp(-3*d));const wh=.35*Math.sin(20*d)*Math.exp(-2*d);
  cylB([x+wh,ry,.2*wh],[x,21.6,0],r,col,o);
  // lower piece falls slack onto roof
  const fall=easeIn(d/.45);const Lr=yf-.07-topY;const pts=[[x,topY,0]];
  for(let k=1;k<=5;k++){const a=(k/5)*fall*1.3;pts.push(add(pts[k-1],[Math.sin(a)*Lr/5,Math.cos(a)*Lr/5,.05*Math.sin(k+d*8)*(1-fall)]))}
  poly(pts,r,col,o);
  sparkBurst([x,yf,0],d,40,7,3.5,.7,.03);if(d<.12)pt([x,yf,.05],[1,.9,.7],(1-d/.12)*1.4,.7);
 }
}
// ---------- CABIN (inside elevator, looking at doors) ----------
const L_CAB={dir:[.2,1,.3],k1:[.9,.88,.82],k2:[.2,.22,.28],a0:[.18,.18,.2],a1:[.35,.34,.33]};
function cabin(st){
 const steel=[.78,.79,.82],steel2=[.70,.71,.75];
 box([0,.05,0],[1.7,.1,1.5],[.22,.2,.19],{rough:.8});
 for(let k=-3;k<=3;k++)box([k*.24,.101,0],[.01,.002,1.5],[.1,.1,.11]);
 box([0,2.55,0],[1.7,.1,1.5],[.75,.75,.76]);
 const fl=st.flicker||1;box([0,2.49,0],[1.2,.02,1.0],[0,0,0],{emis:scl([1.2,1.15,1.05],fl)});
 box([0,1.3,-.77],[1.7,2.5,.04],steel,{rough:.25});for(const x of[-.28,.28])box([x,1.3,-.745],[.008,2.4,.01],[.25,.26,.3]);
 for(const sx of[-1,1]){box([sx*.87,1.3,0],[.04,2.5,1.5],steel2,{rough:.25});box([sx*.845,1.3,0],[.008,2.4,.01],[.25,.26,.3]);
  cylB([sx*.80,.95,-.6],[sx*.80,.95,.6],.02,[.85,.86,.9],{rough:.15},CYL);
  for(const z of[-.55,.55])cylB([sx*.85,.95,z],[sx*.80,.95,z],.012,[.8,.8,.85],{},CYL);}
 // front wall panels and header
 for(const sx of[-1,1])box([sx*.65,1.3,.74],[.4,2.5,.04],steel,{rough:.25});
 box([0,2.33,.74],[.9,.44,.04],steel,{rough:.25});
 // control panel (right)
 box([.62,1.25,.715],[.16,.5,.01],[.1,.1,.12]);
 for(let k=0;k<8;k++){const x=.585+(k%2)*.07,y=1.42-Math.floor(k/2)*.1;const lit=k===1;disc([x,y,.708],.022,.012,[.7,.7,.72],{emis:lit?[1,.55,.1]:[0,0,0]})}
 // floor indicator
 box([0,2.25,.718],[.36,.16,.01],[.03,.03,.04]);
 const fl0=st.floor??18;digit([.05,2.25,.71],.11,Math.floor(fl0/10)%10,[1.4,.5,.1],rotY(Math.PI));digit([-.05,2.25,.71],.11,fl0%10,[1.4,.5,.1],rotY(Math.PI));
 // doors
 const o=st.doorOpen??1;const dx=lerp(.225,.66,o);
 for(const sx of[-1,1]){box([sx*dx,1.12,.78],[.45,2.1,.03],[.86,.87,.9],{rough:.15});box([sx*(dx-.2),1.12,.765],[.01,2.0,.01],[.4,.42,.46])}
 // lobby outside
 box([0,-.05,3.8],[8,.1,6],[.72,.68,.62],{rough:.35});
 for(let k=-4;k<=4;k++)box([k*.8,.002,3.8],[.01,.004,6],[.55,.5,.45]);
 box([0,1.6,5.5],[8,3.2,.2],[.78,.62,.45],{rough:.8});
 for(const sx of[-1,1]){box([sx*1.4,2.0,5.38],[.12,.3,.06],[0,0,0],{emis:[1.6,1.2,.7]});}
 obj(CYL,[-.9,.25,4.6],I3,[.4,.5,.4],[.35,.22,.15]);sph([-.9,.85,4.6],.38,[.15,.35,.18],{rough:.8});sph([-.75,1.1,4.5],.25,[.18,.42,.2],{rough:.8});
 box([0,3.0,3.8],[8,.1,6],[.9,.88,.84]);box([0,2.94,3.6],[2,.02,.6],[0,0,0],{emis:[1.5,1.4,1.2]});
}
// ---------- HALL 1854 ----------
const L_HALL={dir:[.3,.9,.45],k1:[1.15,1.05,.9],k2:[.18,.18,.2],a0:[.16,.15,.14],a1:[.32,.3,.28]};
const WOOD=[.50,.34,.20],WOOD2=[.42,.28,.16],IRON=[.22,.23,.25];
function person(o){
 const B=rotY(o.yaw),s=o.sc||1;const at=v=>add(o.pos,bapply(B,scl(v,s)));
 if(o.skirt){obj(CYL,at([0,.45,0]),B,[.6*s,.9*s,.5*s],o.pants)}
 else{box(at([-.09,.43,0]),[.13*s,.86*s,.15*s],o.pants,{},B);box(at([.09,.43,0]),[.13*s,.86*s,.15*s],o.pants,{},B)}
 const lean=o.lean||0;const BL=bmul(B,rotX(lean));
 const T=v=>add(o.pos,bapply(B,scl(add([0,.86,0],bapply(rotX(lean),v)),s)));
 box(T([0,.32,0]),[.4*s,.64*s,.24*s],o.coat,{},BL);
 const head=T([0,.78,0]);sph(head,.115*s,o.skin||[.85,.7,.58]);
 const arm=(side,a,f)=>{const sh=T([side*.25,.6,0]);let d=bapply(rotZ(side*a),[0,-1,0]);d=bapply(rotX(-f),d);const dw=bapply(BL,d);const end=add(sh,scl(dw,.6*s));
  cylB(sh,end,.055*s,o.coat,{},CYL);sph(end,.05*s,o.skin||[.85,.7,.58]);return end};
 const r=arm(1,o.armR?.a||.08,o.armR?.f||0);arm(-1,o.armL?.a||.08,o.armL?.f||0);
 const hat=o.hat;if(hat){let hp=T([0,.9,0]),HB=BL;if(o.hatLift){hp=add(vlerp(hp,add(r,[0,.12*s,0]),o.hatLift),[0,0,0]);HB=bmul(BL,rotX(-.5*o.hatLift))}
  const hc=o.hatCol||[.08,.08,.09];
  if(hat==='top'){obj(CYL,add(hp,bapply(HB,[0,.12*s,0])),HB,[.2*s,.24*s,.2*s],hc);obj(CYL,hp,HB,[.32*s,.02*s,.32*s],hc)}
  else if(hat==='bowler'){sph(add(hp,[0,.03*s,0]),.12*s,hc,{},HB,[.22*s,.16*s,.22*s]);obj(CYL,hp,HB,[.3*s,.02*s,.3*s],hc)}
  else if(hat==='bonnet'){sph(add(head,bapply(B,[0,.04*s,-.03*s])),.14*s,hc,{},B,[.3*s,.28*s,.28*s])}}
}
const CROWD=[];(function(){let k=0;for(let row=0;row<6;row++){const n=7+row*2;for(let i=0;i<n;i++){const ang=(i/(n-1)-.5)*1.5;const R=4.2+row*1.15+rnd(k)*.3;
 const x=Math.sin(ang)*R,z=Math.cos(ang)*R+.6;const coats=[[.18,.14,.12],[.22,.2,.18],[.12,.13,.18],[.32,.24,.16],[.25,.12,.1],[.15,.18,.14],[.36,.3,.22]];
 const fem=rnd(k+2)>.68;CROWD.push({x,z,yaw:Math.atan2(-x,-(z-.6))+(rnd(k+7)-.5)*.3,sc:.92+rnd(k+3)*.14,coat:coats[Math.floor(rnd(k+4)*coats.length)],pants:fem?[.3+rnd(k)*.2,.18,.15]:[.1,.1,.11],
  skirt:fem,hat:fem?'bonnet':(rnd(k+5)>.45?'top':'bowler'),hatCol:fem?[.55,.45,.35]:[.07,.07,.08],ph:rnd(k+6)*6.28,k});k++}}})();
function hall(st){
 // floor boards
 box([0,-.05,0],[60,.1,60],WOOD2,{rough:.85});
 for(let k=-20;k<=20;k++)box([k*.6,.001,0],[.015,.004,60],[.3,.2,.12]);
 // iron & glass arches
 for(let zi=-5;zi<=5;zi++){const z=zi*4;for(const sx of[-1,1]){cylB([sx*13,0,z],[sx*13,5,z],.18,IRON,{},CYL)}
  const pts=[];for(let k=0;k<=18;k++){const a=k/18*Math.PI;pts.push([Math.cos(a)*13,5+Math.sin(a)*11,z])}poly(pts,.12,IRON,{});}
 for(let k=1;k<9;k++){const a=k/9*Math.PI;const x=Math.cos(a)*13,y=5+Math.sin(a)*11;cylB([x,y,-20],[x,y,20],.06,IRON,{})}
 // bunting/banners
 for(let zi=-4;zi<=4;zi+=2){const z=zi*4;for(let k=0;k<7;k++){const x=-9+k*3;const cc=[[.6,.15,.12],[.75,.68,.5],[.2,.25,.45]][k%3];box([x,9.5-Math.abs(x)*.12,z],[.9,1.6,.02],cc,{rough:.9})}}
 // hoist tower
 const ph=st.ph;
 for(const sx of[-1,1]){box([sx*1.0,4.8,0],[.18,9.6,.22],WOOD,{rough:.8});
  for(let y=.6;y<9.2;y+=.2){box([sx*.89,y,0],[.05,.07,.16],[.35,.36,.38],{rough:.4},rotZ(sx*.6))}}
 box([0,9.7,0],[2.6,.22,.3],WOOD,{rough:.8});
 disc([0,10.0,0],.25,.08,[.3,.3,.32],{},rotZ(st.pulley||0));disc([1.45,10.0,0],.18,.08,[.3,.3,.32],{},rotZ(st.pulley||0));
 box([1.45,9.8,0],[.3,.2,.3],WOOD,{rough:.8});
 // winch at base
 disc([1.55,.6,.0],.28,.5,[.35,.24,.15],{},I3);box([1.55,.3,0],[.7,.6,.6],WOOD2,{rough:.85});
 // platform
 box([0,ph,0],[1.75,.1,1.3],WOOD,{rough:.8});
 for(const sx of[-1,1]){cylB([sx*.85,ph,.6],[sx*.85,ph+1.0,.6],.025,WOOD2,{},CYL);cylB([sx*.85,ph,-.6],[sx*.85,ph+1.0,-.6],.025,WOOD2,{},CYL);
  cylB([sx*.85,ph+1.0,.6],[sx*.85,ph+1.0,-.6],.02,WOOD2,{},CYL);
  cylB([sx*.78,ph,0],[sx*.78,ph+1.95,0],.04,IRON,{},CYL);}
 cylB([-.85,ph+1.0,-.6],[.85,ph+1.0,-.6],.02,WOOD2,{},CYL);
 cylB([-.8,ph+1.98,0],[.8,ph+1.98,0],.05,IRON,{},CYL);
 // crates & barrel
 box([-.45,ph+.25,-.35],[.4,.4,.4],[.55,.4,.25],{rough:.85});obj(CYL,[.5,ph+.3,-.35],I3,[.36,.5,.36],[.45,.3,.18]);
 // wagon spring (bow) + pawls
 const sag=st.sag;const spts=[];for(let k=0;k<=10;k++){const x=-.72+k*.144;const y=ph+1.82+sag*(1-(x/.72)**2);spts.push([x,y,0])}
 poly(spts,.045,[.3,.3,.33],{rough:.25});
 const ext=st.pawl;for(const sx of[-1,1])box([sx*(.74+ext*.09),ph+1.82,0],[.14,.09,.14],[.62,.62,.66],{rough:.3,emis:scl([1,.8,.4],st.pawlGlow||0)});
 // rope: spring center -> pulley -> right pulley -> down to winch (cut at yCut)
 const sc=[0,ph+1.82+sag,0];
 if(st.cut==null){poly([sc,[0,9.75,0]],.02,[.62,.52,.36]);poly([[0,10.25,0],[1.45,10.18,0]],.02,[.62,.52,.36]);poly([[1.63,10.0,0],[1.63,.85,0]],.02,[.62,.52,.36]);}
 else{const d=st.cut;const up=Math.min(2.5,d*6);const wig=.15*Math.sin(d*25)*Math.exp(-d*3);
  poly([sc,[0,9.75,0]],.02,[.62,.52,.36]);poly([[0,10.25,0],[1.45,10.18,0]],.02,[.62,.52,.36]);
  poly([[1.63,10.0,0],[1.63+wig,1.35+up,0]],.02,[.62,.52,.36]);poly([[1.63,.85,0],[1.63-wig*.5,1.2,0]],.02,[.62,.52,.36]);
  sparkBurst([1.63,1.28,0],d,30,3,2.2,.6,.03,[1,.85,.6]);}
 // people
 const t=st.t;
 person({pos:[.15,ph+.05,.15],yaw:.15,sc:1,coat:[.06,.06,.08],pants:[.08,.08,.09],hat:'top',armR:st.otisArm||{a:.1,f:0},armL:{a:.1,f:0},hatLift:st.hatLift||0});
 person({pos:[2.6,0,.45],yaw:-2.006,sc:1,coat:[.38,.26,.18],pants:[.18,.16,.14],hat:'bowler',hatCol:[.2,.16,.12],armR:st.axeArm||{a:.1,f:0},armL:st.axeArm||{a:.1,f:0},lean:st.axeLean||0});
 if(st.axe){const a=st.axe;cylB(a.h0,a.h1,.025,[.5,.36,.2],{},CYL);box(a.h1,[.18,.12,.03],[.6,.62,.66],{rough:.2},a.B)}
 for(const c of CROWD){const gasp=st.gasp||0,cheer=st.cheer||0;
  const wave=cheer*(.5+.5*Math.sin(t*9+c.ph));
  const ar={a:.15+cheer*(2.4+.4*Math.sin(t*7+c.ph)),f:gasp*.6};const al={a:.15+cheer*(2.2+.4*Math.sin(t*6+c.ph+1)),f:gasp*.5};
  person({pos:[c.x,.0+.03*Math.sin(t*2+c.ph)*0+cheer*.05*Math.max(0,Math.sin(t*8+c.ph)),c.z],yaw:c.yaw,sc:c.sc,coat:c.coat,pants:c.pants,skirt:c.skirt,hat:c.hat,hatCol:c.hatCol,armR:ar,armL:al,lean:-gasp*.18})}
 if(st.dustPuff!=null){const d=st.dustPuff;for(let i=0;i<60;i++){const sx=i%2?1:-1;const v=[sx*(.2+rnd(i)*.6),(rnd(i+3)-.2)*.6,(rnd(i+5)-.5)*.6];const p=add([sx*.86,ph+1.82,0],scl(v,d));pt(p,[.9,.85,.75],Math.max(0,1-d/1.2)*.35,.12)}}
 for(let i=0;i<300;i++){const p=[(rnd(i)-.5)*14,rnd(i+1)*10+Math.sin(t*.3+i)*.15,(rnd(i+2)-.5)*14];pt(p,[1,.95,.8],.12,.02)}
}
// ---------- CITY ----------
const L_CITY={dir:[-.4,.6,.7],k1:[.35,.4,.55],k2:[.1,.15,.3],a0:[.05,.06,.1],a1:[.10,.12,.2]};
const TOWERS=[];(function(){let k=0;for(let i=-6;i<=6;i++)for(let j=-7;j<=4;j++){if(Math.abs(i)<=1&&j>=-1&&j<=4)continue;const n=1+Math.floor(rnd(k)*3);
 for(let m=0;m<n;m++){const w=3+rnd(k+1)*5,d=3+rnd(k+2)*5;const h=8+Math.pow(rnd(k+3),2)*55*(1-Math.min(1,Math.hypot(i,j)/9)*.5);
  TOWERS.push({x:i*13+(rnd(k+4)-.5)*5,z:j*13+(rnd(k+5)-.5)*5,w,d,h,seed:rnd(k+6)*100,col:[.10+rnd(k+7)*.08,.12+rnd(k+7)*.08,.17+rnd(k+8)*.08]});k+=11}k++}})();
function city(st){
 box([0,-.05,0],[300,.1,300],[.05,.055,.07],{rough:.9});
 for(let i=-12;i<=12;i++){box([i*13+6.5,.003,0],[2.2,.006,300],[.09,.09,.1]);box([0,.003,i*13+6.5],[300,.006,2.2],[.09,.09,.1])}
 for(const b of TOWERS)box([b.x,b.h/2,b.z],[b.w,b.h,b.d],b.col,{mode:1,seed:b.seed,rough:.4});
 // hero tower
 box([0,48,0],[10,96,10],[.12,.15,.22],{mode:1,seed:3.7,rough:.2});box([0,97,0],[6,2.5,6],[.15,.17,.22]);cylB([0,98,0],[0,108,0],.15,[.5,.5,.55],{emis:[.2,.05,.05]},CYL);
 pt([0,108.2,0],[1,.15,.1],.6+.4*Math.sin(st.t*6),1.5);
 // glass shaft on front face
 box([2.2,48,5.25],[1.8,96,.5],[.1,.2,.3],{emis:[.04,.12,.2],rough:.1});
 for(let y=0;y<96;y+=4)box([2.2,y,5.52],[1.85,.08,.05],[.3,.35,.4]);
 const cy=st.carY;box([2.2,cy,5.3],[1.5,2.6,.6],[.9,.92,.95],{emis:[1.0,.95,.8]});pt([2.2,cy,5.8],[1,.95,.8],.8,6);
 // street lights
 for(let k=-6;k<=6;k++){for(const sx of[-1,1]){const p=[sx*7.5,4.5,k*6];cylB([sx*7.5,0,k*6],p,.08,[.2,.2,.22],{},CYL);pt(p,[1,.75,.4],.9,1.2)}}
 for(let i=0;i<120;i++){pt([(rnd(i)-.5)*300,60+rnd(i+1)*120,-150-rnd(i+2)*20],[.8,.85,1],.5,.4)}
}
