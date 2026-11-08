// ---------- shared timelines (video time t, seconds) ----------
const shk=(t,amp)=>[Math.sin(t*71)*amp+Math.sin(t*23)*amp*.5,Math.sin(t*53+1)*amp,Math.sin(t*37+2)*amp*.5];
const hand=(t,a)=>[Math.sin(t*1.3)*a,Math.sin(t*1.7+1)*a,Math.sin(t*1.1+2)*a*.5];
const bump=(t,a,b)=>t<a||t>b?0:Math.sin(Math.PI*(t-a)/(b-a));
// governor
function govAng(t){const u=t-23.65;if(u<0)return-(2*u);if(t<29.9)return-(2*u+.8*u*u);const A1=2*6.25+.8*6.25*6.25;
 if(t<33.15)return-(A1+12*(t-29.9));const A2=A1+12*3.25;const d=Math.min(t-33.15,.1);return-(A2+12*d-60*d*d)}
function gov(t){return{ang:govAng(t),spread:.1*clamp((t-23.65)/6,0,1)+.75*ease((t-30.75)/.8),trip:ease((t-32.25)/.12),jaw:ease((t-33.1)/.08),
 glow:.4*bump(t,28.5,29.9),wglow:.5*bump(t,30.6,31.8),latchGlow:t>32.25?2.5*Math.exp(-(t-32.25)*2.5):0,jawGlow:t>33.12?1.6*Math.exp(-(t-33.12)*2.5):0}}
// car fall (S7..S8b): free fall from 20.2
const fallY=t=>t<20.2?0:-.5*9*(t-20.2)**2;
// braking phase (S13..S15)
const Y13=-60,V13=17,TB=37.75,DECEL=17/2.7,TSTOP=TB+2.7;
function brakeY(t){if(t<TB)return Y13-V13*(t-34.8);const d=Math.min(t,TSTOP)-TB;return Y13-V13*(TB-34.8)-V13*d+.5*DECEL*d*d}
function brakeV(t){if(t<TB)return V13;return t<TSTOP?V13-DECEL*(t-TB):0}
const YSTOP=brakeY(TSTOP);
function brakeSparks(t){const t0=TB+.03;if(t<t0)return;
 for(let i=0;i<1800;i++){const b=t0+rnd(i*3.1)*(TSTOP-t0);const age=t-b;const life=.12+rnd(i+.7)*.25;if(age<0||age>life)continue;
  const vb=brakeV(b),yb=brakeY(b);const sx=i%2?-1:1;const sz=rnd(i+5)>.5?1:-1;const p0=[sx*1.10,yb+.2,sz*.03];const sp=(vb/V13)*.9+.3;
  const vel=[sx*(.3+rnd(i+1)*2.2)*sp,(rnd(i+2)*2.6-1.0)*sp*1.6-vb*.9,sz*(.6+rnd(i+3)*3.2)*sp];const hot=1-age/life;
  for(let k=0;k<4;k++){const aa=Math.max(0,age-k*.004);const p=add(p0,add(scl(vel,aa),[0,-6*aa*aa,0]));pt(p,[1,.55+.4*hot,.15+.3*hot],hot*(1-k*.22)*1.4,.026*(1-k*.2))}}
 if(t<TSTOP+.1){const k=Math.min(1,brakeV(t)/V13+.3);for(const sx of[-1,1])pt([sx*1.1,brakeY(t)+.2,.03],[1,.55,.15],k*1.1,.35)}}
const allSnap=(d)=>[0,1,2,3,4,5].map(i=>d-.012*i);
const SH=(st,cam,extra={})=>Object.assign({world:'shaft',st,cam,light:L_SHAFT,fog:FOG_SHAFT,fogd:.045},extra);
const HL=(st,cam,extra={})=>Object.assign({world:'hall',st,cam,light:L_HALL,fog:[.36,.31,.25],fogd:.018,sepia:1},extra);
const SHOTS=[
 // S1 cabin, doors closing
 {t0:0,t1:2.10,f:t=>{const fl=t>1.75&&t<2.05?(rnd(Math.floor(t*30))>.5?.35:1):1;
  return{world:'cabin',st:{doorOpen:1-ease((t-.25)/1.25),flicker:fl,floor:18},cam:{e:add([.03,1.5,lerp(-.72,-.62,t/2.1)],hand(t,.008)),l:[0,1.45,1],fov:76},
   light:L_CAB,fog:[.25,.21,.17],fogd:.02,flash:.5*Math.exp(-t*8)}}},
 // S2 single rope frays and snaps
 {t0:2.10,t1:4.60,f:t=>{const ts=4.02;const d=t-ts;const sk=d>0?shk(t,.05*Math.exp(-d*6)):[0,0,0];
  return SH({yc:0,camY:5,t,strands:1,fray:{idx:3,y:5.4,f:ease((t-2.2)/1.7),d:d>=0?d:null}},{e:add(vlerp(vlerp([.32,5.3,.5],[.2,5.36,.36],ease((t-2.1)/2.5)),[.75,5.0,1.5],easeOut((t-4.02)/.4)),add(sk,hand(t,.004))),l:vlerp([.05,5.4,0],[.05,5.8,0],easeOut((t-4.02)/.4)),fov:40},{flash:d>0?.3*Math.exp(-d*12):0})}},
 // S3 machine room, ropes over the sheave
 {t0:4.60,t1:8.10,f:t=>{const tr=.9*(t-4.6);const a=lerp(-.8,-.45,(t-4.6)/3.5);const c=[.2,21.4,-.6];
  return SH({yc:-6+tr,camY:22,t,sheaveAng:tr/SHR,markers:tr},{e:add([c[0]+3.4*Math.sin(a),22.9,c[2]+3.4*Math.cos(a)],hand(t,.01)),l:[.3,21.3,-.6],fov:56},{light:L_MR,fog:[.06,.065,.08],fogd:.03})}},
 // S4 several ropes highlight one by one
 {t0:8.10,t1:11.00,f:t=>{const hi=ROPEX.map((_,i)=>{const ti=8.95+.2*i;return t<ti?0:.35+1.3*Math.exp(-(t-ti)*3.5)});const u=ease((t-8.1)/2.9);
  return SH({yc:0,camY:4,t,hi},{e:add(vlerp([2.6,2.9,5.6],[2.0,3.8,4.6],u),hand(t,.01)),l:vlerp([0,4.0,0],[0,5.2,0],u),fov:55})}},
 // S5 each one alone can hold the car
 {t0:11.00,t1:14.45,f:t=>{const g=ease((t-11.45)/.6)*(1-ease((t-13.95)/.45));const ghost=ROPEX.map((_,i)=>i===2?0:g);const hi=ROPEX.map((_,i)=>i===2?.35+1.1*g:.35);
  const a=lerp(-.45,.15,(t-11)/3.45);return SH({yc:-.03*ease((t-11.5)/.25)*Math.exp(-Math.max(0,t-11.75)*2),camY:4,t,hi,ghost},{e:[5.2*Math.sin(a),3.5,5.2*Math.cos(a)],l:[0,4.4,0],fov:55})}},
 // S6a tension -> every single one breaks
 {t0:14.45,t1:17.75,f:t=>{const ts=17.5;const d=t-ts;const sk=d>0?shk(t,.09*Math.exp(-d*5)):shk(t,.004*ease((t-15.5)/1.7));
  return SH({yc:0,camY:4,t,snapD:d>=0?allSnap(d):null},{e:add(vlerp([3.0,3.3,6.6],[2.0,4.0,4.5],ease((t-14.45)/2.75)),sk),l:[0,4.4,0],fov:55},{flash:d>0?.45*Math.exp(-d*9):0})}},
 // S6b slow-motion replay from above
 {t0:17.75,t1:19.75,f:t=>{const d=.03+(t-17.75)*.12;return SH({yc:0,camY:6,t,snapD:allSnap(d)},{e:add(vlerp([1.4,8.7,2.7],[1.1,8.3,2.2],(t-17.75)/2),hand(t,.01)),l:[0,4.2,0],fov:50})}},
 // S7 the car drops
 {t0:19.75,t1:21.05,f:t=>{const yc=fallY(t);const sk=t>20.2?shk(t,.02):[0,0,0];return SH({yc,camY:-2,t,snapD:allSnap(.3+(t-19.75))},{e:add([2.1,-4.8,3.0],sk),l:[-.2,1.4,0],fov:62})}},
 // S8 picking up speed
 {t0:21.05,t1:22.25,f:t=>{const yc=fallY(t),v=9*(t-20.2);return SH({yc,camY:yc+3,t,streak:Math.min(1.4,v*.07),snapD:allSnap(1+(t-19.75)),flutter:1.5},{e:add([2.0,yc+4.6,3.4],shk(t,.025)),l:[-.2,yc+.6,0],fov:64})}},
 // S8b whip up the shaft to the governor
 {t0:22.25,t1:23.65,f:t=>{const u=ease((t-22.25)/1.25);const yc=fallY(t);const e0=[2.0,fallY(22.25)+4.6,3.4],e1=add(GOV,[.45,-.3,2.0]);
  const e=vlerp(e0,e1,u);const d0=norm(sub([-.2,fallY(22.25)+.6,0],e0)),d1=norm(sub(GOV,e1));const dir=norm(add(vlerp(d0,d1,ease(u*1.4)),[0,1.3*Math.sin(Math.PI*u),0]));
  return SH({yc,camY:e[1],t,streak:1.0*Math.sin(Math.PI*u),snapD:allSnap(2),gov:gov(t)},{e,l:add(e,dir),fov:60})}},
 // S9 governor spins faster and faster
 {t0:23.65,t1:28.45,f:t=>{const a=lerp(-.35,.25,(t-23.65)/4.8);return SH({yc:-40,camY:13,t,gov:gov(t),snapD:allSnap(3)},{e:add(add(GOV,[1.9*Math.sin(a),-.2,1.9*Math.cos(a)]),shk(t,.004*clamp((t-25)/3,0,1))),l:add(GOV,[0,-.05,0]),fov:48})}},
 // S10 "That's the governor."
 {t0:28.45,t1:29.90,f:t=>{const u=(t-28.45)/1.45;return SH({yc:-40,camY:13,t,gov:gov(t),snapD:allSnap(3)},{e:add(GOV,vlerp([-.95,.55,1.6],[-.7,.42,1.35],u)),l:add(GOV,[0,-.08,0]),fov:46})}},
 // S11 weights fling outward
 {t0:29.90,t1:31.75,f:t=>{const u=(t-29.9)/1.85;return SH({yc:-40,camY:13,t,gov:gov(t),snapD:allSnap(3)},{e:add(add(GOV,vlerp([.36,.14,1.3],[.28,.08,1.08],u)),shk(t,.005)),l:add(GOV,[0,0,.08]),fov:50})}},
 // S12 trip a latch -> locks onto the second rope
 {t0:31.75,t1:34.80,f:t=>{const sk=t>33.15?shk(t,.03*Math.exp(-(t-33.15)*5)):t>32.25?shk(t,.015*Math.exp(-(t-32.25)*6)):[0,0,0];
  return SH({yc:-40,camY:13,t,gov:gov(t),snapD:allSnap(3),govRopeGlow:t>33.15?.5*Math.exp(-(t-33.15)*1.2):0},{e:add(add(GOV,[.85,.05,1.35]),sk),l:add(GOV,[.3,.05,.2]),fov:52},{flash:t>33.15?.12*Math.exp(-(t-33.15)*10):0})}},
 // S13 that rope yanks up on steel wedges
 {t0:34.80,t1:37.65,f:t=>{const yc=brakeY(t);const u=ease((t-35.9)/.8);
  return SH({yc,camY:yc,t,streak:.4,gov:gov(t),snapD:allSnap(4),flutter:1.5,lift:.55*ease((t-35.25)/.4),leverGlow:.9*bump(t,35.1,36.2),govRopeGlow:.7*bump(t,34.8,35.8),wedgeGlow:.45*bump(t,35.95,36.9)},
   {e:add(vlerp([-1.95,yc+1.65,1.75],[-1.72,yc+.82,1.32],u),shk(t,.012)),l:vlerp([-1.2,yc+.45,.1],[-1.08,yc+.28,0],u),fov:50})}},
 // S14 jams them into the rails
 {t0:37.65,t1:39.60,f:t=>{const yc=brakeY(t);const v=brakeV(t);const st={yc,camY:yc,t,streak:Math.min(.4,v*.025),gov:gov(t),snapD:allSnap(4),flutter:1.5,
   lift:.55+.45*ease((t-37.7)/.25),heat:ease((t-37.78)/.35)};const w0=()=>brakeSparks(t);
  return SH(st,{e:add([-1.72,yc+.8,1.3],shk(t,.03*(v/V13)+.008)),l:[-1.08,yc+.28,0],fov:48},{post:w0})}},
 // S15 stopped
 {t0:39.60,t1:42.40,f:t=>{const yc=brakeY(t);const v=brakeV(t);const ds=t-TSTOP;const sk=ds>0?shk(t,.05*Math.exp(-ds*6)):shk(t,.012*v/6);
  const st={yc,camY:yc,t,gov:gov(t),snapD:allSnap(4),burst:false,flutter:ds>0?Math.exp(-ds*3):1.4,flop:ease(ds/.6),lift:1,heat:t<TSTOP?1:Math.exp(-ds*1.2)};
  return SH(st,{e:add(vlerp([2.45,YSTOP+.95,6.1],[2.2,YSTOP+.85,5.5],(t-39.6)/2.8),sk),l:[-.1,YSTOP+1.45,0],fov:60},{post:()=>{brakeSparks(t);if(ds>0)for(const sx of[-1,1])sparkBurst([sx*1.1,YSTOP+.1,0],ds,25,sx*50+9,1.2,1.4,.06,[.6,.62,.7])}})}},
 // S16 1854 establishing
 {t0:42.40,t1:45.25,f:t=>{const u=ease((t-42.4)/2.85);return HL({t,ph:6,sag:.25,pawl:0},{e:vlerp([0,16,27],[3.6,5.0,15.5],u),l:vlerp([0,8,0],[0,5.2,0],u),fov:50},{flash:.9*Math.exp(-(t-42.4)*5)})}},
 // S17 Otis on the raised platform
 {t0:45.25,t1:48.95,f:t=>{const u=(t-45.25)/3.7;const g=bump(t,47.9,48.95);return HL({t,ph:6,sag:.25,pawl:0,otisArm:{a:.15+.5*g,f:1.2*g}},{e:add(vlerp([-2.7,1.8,10.6],[-2.1,1.95,9.3],u),hand(t,.02)),l:[.1,7.0,0],fov:42})}},
 // S17b "ordered the rope cut" - axe
 {t0:48.95,t1:50.70,f:t=>{const s1=ease((t-48.95)/.5),s2=easeIn((t-49.55)/.27);const fA=lerp(lerp(.3,2.9,s1),1.35,s2);
  const yaw=-2.006,B=rotY(yaw);const d=bapply(B,[0,-Math.cos(fA),Math.sin(fA)]);const sh=add([2.6,0,.45],bapply(B,[0,1.46,0]));const hnd=add(sh,scl(d,.6));const h1=add(hnd,scl(d,.55));
  const side=norm(cross(d,[0,1,0]));const AB=[norm(cross(side,d)),d,side];const cut=t>=49.82?t-49.82:null;const sk=cut!=null?shk(t,.03*Math.exp(-cut*6)):[0,0,0];
  return HL({t,ph:6,sag:.25,pawl:0,cut,axeArm:{a:.05,f:fA},axe:{h0:hnd,h1,B:AB},axeLean:.15*s2,otisArm:{a:.4,f:1.3}},{e:add([4.5,2.0,4.3],add(sk,hand(t,.015))),l:[1.95,1.45,.1],fov:48},{flash:cut!=null?.25*Math.exp(-cut*12):0})}},
 // S18 dropped a few inches... and stopped
 {t0:50.70,t1:53.40,f:t=>{const TC=52.5;const ph=t<TC?6-.1*easeIn((t-50.8)/(TC-50.8)):5.9;const dc=t-TC;const sk=dc>0?shk(t,.03*Math.exp(-dc*6)):[0,0,0];
  return HL({t,ph,sag:.03+.22*(1-ease((t-50.85)/.25)),pawl:ease((t-50.9)/.3),cut:t-49.82,pawlGlow:dc>0?.8*Math.exp(-dc*3):0,dustPuff:dc>0?dc:null,gasp:ease((t-50.7)/.3)},
   {e:add(vlerp([-2.7,7.1,3.4],[-2.4,7.05,3.0],(t-50.7)/2.7),sk),l:[-.45,7.35,0],fov:44})}},
 // S19 All safe, gentlemen
 {t0:53.40,t1:56.10,f:t=>{const hl=ease((t-53.6)/.6);return HL({t,ph:5.9,sag:.03,pawl:1,cut:3,hatLift:hl,otisArm:{a:.35,f:lerp(.1,2.7,hl)},cheer:ease((t-54.2)/.5),gasp:1-ease((t-53.9)/.5)},
   {e:vlerp([1.3,2.7,7.6],[1.0,2.95,6.6],(t-53.4)/2.7),l:[.15,7.0,0],fov:38})}},
 // S20 skyscrapers
 {t0:56.10,t1:60.50,f:t=>{const u=ease((t-56.1)/4.4);const carY=4+15*(t-56.1);
  return{world:'city',st:{t,carY},cam:{e:vlerp([5,2.2,46],[4,8,34],u),l:[2.2,lerp(16,74,u),5],fov:52,far:500},light:L_CITY,fog:[.03,.045,.09],fogd:.006,skyTop:[.01,.02,.06],skyBot:[.10,.12,.24],
   flash:.7*Math.exp(-(t-56.1)*5),expo:1-ease((t-59.9)/.6)}}},
];
const DUR=60.5;
function frame(i,t){const s=SHOTS[i].f(t);Q=[];PTS=[];
 if(s.world==='shaft')shaft(s.st);else if(s.world==='cabin')cabin(s.st);else if(s.world==='hall')hall(s.st);else city(s.st);
 if(s.post)s.post();
 draw({e:s.cam.e,l:s.cam.l,fov:s.cam.fov,far:s.cam.far,light:s.light,fog:s.fog,fogd:s.fogd,sepia:s.sepia||0,expo:s.expo??1,flash:s.flash||0,skyTop:s.skyTop,skyBot:s.skyBot});
 return cv.toDataURL('image/jpeg',.92)}
window.frame=frame;window.SHOTS_T=SHOTS.map(s=>[s.t0,s.t1]);window.DUR=DUR;
