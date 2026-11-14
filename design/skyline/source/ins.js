// Insights boards: main (weeks/months/years) + period details (week/month/year)
const HAB=[{n:'Eat at home',c:'#65A30D'},{n:'10K Steps',c:'#F97316'},{n:'Read a book',c:'#38BDF8'},{n:'Push ups',c:'#A78BFA'},{n:'Job applications',c:'#22D3EE',lot:true}];
const q=new URLSearchParams(location.search);const S=q.get('s');
const H_=q.get('H');if(H_){document.body.style.height=H_+'px';}
const el=document.getElementById('root');
const GLASS=(w,h)=>`<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect x=".6" y=".6" width="${w-1.2}" height="${h-1.2}" rx="${Math.min(w,h)*.25}" fill="#8FB8D8" fill-opacity=".45" stroke="#DDF2FF" stroke-width="1.2"/><path d="M${w/2},${h*.2}L${w*.72},${h*.3}V${h*.52}C${w*.72},${h*.7} ${w*.6},${h*.8} ${w/2},${h*.86}C${w*.4},${h*.8} ${w*.28},${h*.7} ${w*.28},${h*.52}V${h*.3}Z" fill="#fff"/></svg>`;
const OPEN=(w,h)=>`<svg width="${w}" height="${h}"><rect x=".6" y=".6" width="${w-1.2}" height="${h-1.2}" rx="${Math.min(w,h)*.25}" fill="none" stroke="#5B6472" stroke-width="1.2"/></svg>`;
const FUT=(w,h)=>`<svg width="${w}" height="${h}"><rect x=".6" y=".6" width="${w-1.2}" height="${h-1.2}" rx="${Math.min(w,h)*.25}" fill="none" stroke="#2F3944" stroke-dasharray="3 3"/></svg>`;
const TODAY=(w,h)=>`<svg width="${w}" height="${h}"><rect x=".9" y=".9" width="${w-1.8}" height="${h-1.8}" rx="${Math.min(w,h)*.25}" fill="none" stroke="#F2C14E" stroke-width="1.5" stroke-dasharray="4 3"/></svg>`;
const BLD=(w,h,c)=>`<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${Math.min(w,h)*.25}" fill="${c}"/></svg>`;
function bars(cols,labels,{h=170,bw=30,gap=14,hiLast=true,max}){ // cols: arrays of 5 values (stack bottom->top by HAB order) ; null=future
  const mx=max||Math.max(...cols.map(c=>c?c.reduce((a,b)=>a+b,0):0));
  const W=cols.length*(bw+gap)-gap;let out='';
  cols.forEach((c,i)=>{const x=i*(bw+gap);
    if(!c){out+=bw<12?``:`<rect x="${x}" y="${h-4}" width="${bw}" height="3" rx="1.5" fill="#2A333D"/>`;}
    else{let y=h;c.forEach((v,k)=>{if(!v)return;const sh=v/mx*h;out+=`<rect x="${x}" y="${y-sh+.75}" width="${bw}" height="${Math.max(sh-1.5,1)}" rx="2" fill="${HAB[k].c}" ${hiLast&&i!==cols.length-1&&false?'':''}/>`;y-=sh;});}
    out+=`<text x="${x+bw/2}" y="${h+18}" text-anchor="middle" font-size="11.5" font-family="Nunito" font-weight="${i===cols.length-1?800:600}" fill="${i===cols.length-1?'#F2F4F6':'#A3ADB8'}">${labels[i]}</text>`;});
  return `<svg width="${W}" height="${h+24}" style="display:block;margin:0 auto">${out}</svg>`;
}
const sum=a=>a.reduce((x,y)=>x+y,0);
const legend=()=>`<div style="display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:10px">${HAB.map(h=>`<span style="display:flex;align-items:center;gap:6px;font-size:12.5px;color:#C9CED4;font-weight:600"><i style="width:9px;height:9px;border-radius:50%;background:${h.c};display:block"></i>${h.n}</span>`).join('')}</div>`;
const gearBtn=`<div style="position:absolute;right:20px;top:34px;width:44px;height:44px;border-radius:22px;background:#1E252D;display:flex;align-items:center;justify-content:center"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A3ADB8" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2-1.2L14 3h-4l-.6 2.7a7 7 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2 1.2L10 21h4l.6-2.7a7 7 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z"/></svg></div>`;
const tabsBar=`<div style="position:absolute;left:0;right:0;bottom:0;height:76px;border-top:1px solid #222a33;background:#0F1216;display:flex">${[['Skyline',0],['Insights',1],['Community',0],['Profile',0]].map(([t,on])=>`<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font-size:12px;font-weight:${on?800:600};color:${on?'#F2C14E':'#A3ADB8'}"><div style="width:22px;height:22px;border:2px solid currentColor;border-radius:6px"></div>${t}</div>`).join('')}</div>`;
const seg=(labels,on)=>`<div style="display:flex;background:#1A2027;border-radius:24px;padding:4px;height:48px;margin:0">${labels.map((l,i)=>`<div style="flex:1;display:flex;align-items:center;justify-content:center;border-radius:20px;font-weight:700;font-size:15px;${i===on?'background:#F2F4F6;color:#0F1216':'color:#A3ADB8'}">${l}</div>`).join('')}</div>`;
const chips=(on)=>`<div style="display:flex;gap:8px;align-items:center;overflow:hidden;white-space:nowrap"><span style="font-size:12px;font-weight:700;color:#A3ADB8">Habits</span><div style="height:34px;border-radius:17px;padding:0 13px;display:flex;align-items:center;font-size:13.5px;font-weight:700;background:#2B2717;border:1.5px solid #F2C14E;color:#F2F4F6">All</div>${HAB.map(h=>`<div style="height:34px;border-radius:17px;padding:0 13px;display:flex;align-items:center;gap:7px;font-size:13.5px;font-weight:700;background:#1E252D;color:#C9CED4"><i style="width:9px;height:9px;border-radius:50%;background:${h.c};display:block"></i>${h.n}</div>`).join('')}</div>`;

const WEEKS=[[5,6,3,4,2],[6,5,2,3,3],[4,6,3,5,2],[6,7,4,4,3],[5,6,2,3,4],[6,7,3,5,3],[7,6,4,4,3],[4,5,2,3,4]];
const WL=['9/21','9/28','10/5','10/12','10/19','10/26','11/2','Now'];
const MONTHS=[[22,24,12,14,9],[24,26,13,15,11],[21,25,11,13,10],[25,27,14,16,12],[23,26,12,15,13],[17,19,9,11,12]];
const ML=['Jun','Jul','Aug','Sep','Oct','Nov'];
const YEARS=[[210,240,120,150,90],[262,300,150,175,140]];
const YL=['2025','2026'];

if(S==='main'){
  const tab=+(q.get('v')||0);
  const cfg=[{lab:'Sep 21 to Nov 15',nav:'This week',cols:WEEKS,l:WL,head:['18','so far this week','14 floors · 4 lot check-ins','Last week at this point: 20'],bw:28,gap:10},
             {lab:'Jun to Nov 2026',nav:'This month',cols:MONTHS,l:ML,head:['58','so far this month','47 floors · 11 lot check-ins','Last month at this point: 64'],bw:38,gap:14},
             {lab:'2025 to 2026',nav:'This year',cols:YEARS,l:YL,head:['1,284','so far this year','1,052 floors · 232 lot check-ins','Last year to this date: 996'],bw:80,gap:60}][tab];
  el.innerHTML=`${gearBtn}
  <div style="padding:34px 20px 0"><h1 style="font-size:30px;margin-bottom:16px">Insights</h1>
  ${seg(['Weeks','Months','Years'],tab)}<div style="margin-top:12px">${chips()}</div>
  <div style="margin-top:12px;display:flex;align-items:center;justify-content:center;gap:28px"><div style="width:44px;height:44px;border-radius:22px;background:#1E252D;display:flex;align-items:center;justify-content:center;font-size:20px">‹</div><b style="font-size:16px;min-width:96px;text-align:center">${cfg.nav}</b><div style="width:44px;height:44px;border-radius:22px;background:#1E252D;display:flex;align-items:center;justify-content:center;font-size:20px;color:#5B6472">›</div></div>
  <div style="margin-top:10px;background:#161B21;border-radius:22px;padding:18px 18px 16px">
    <div style="display:flex;justify-content:space-between;align-items:baseline"><b style="font-size:18px">Floors built</b><span style="font-size:13px;color:#A3ADB8">Towers and lots</span></div>
    <div style="margin-top:8px;display:flex;align-items:baseline;gap:8px"><span style="font-size:38px;font-weight:800">${cfg.head[0]}</span><span style="color:#A3ADB8;font-size:15px">${cfg.head[1]}</span></div>
    <div style="color:#C9CED4;font-size:13px;margin-top:2px">${cfg.head[2]}</div><div style="color:#A3ADB8;font-size:13px;margin-top:1px">${cfg.head[3]}</div>
    <div style="margin-top:14px">${bars(cfg.cols,cfg.l,{h:150,bw:cfg.bw,gap:cfg.gap})}</div>
    ${legend()}
    <div style="margin-top:12px;padding-top:11px;border-top:1px solid #232b34;display:flex;justify-content:space-between;align-items:center;color:#F2C14E;font-weight:800;font-size:13.5px"><span>Tap a bar to see everything for that ${['week','month','year'][tab]}</span><span>›</span></div>
  </div>
  <div style="margin-top:12px;background:#161B21;border-radius:22px;padding:18px"><b style="font-size:18px">Runs</b><span style="float:right;font-size:13px;color:#A3ADB8">Current and best</span></div>
  </div>${tabsBar}`;
}

// ---------- details ----------
function stripCells(states,cw,ch,cols){ // states: b(colorIdx)/o/s/t(today)/f(future)
  return `<div style="display:grid;grid-template-columns:repeat(${cols},${cw}px);gap:5px">${states.map(s=>{const k=s[0];const c=s[1];return k==='b'?BLD(cw,ch,HAB[c].c):k==='s'?GLASS(cw,ch):k==='t'?TODAY(cw,ch):k==='f'?FUT(cw,ch):OPEN(cw,ch)}).join('')}</div>`;
}
const card=(h,body)=>`<div style="background:#161B21;border-radius:20px;padding:16px;margin-top:12px">${h}${body}</div>`;
const tile=(big,sub,sub2)=>`<div style="flex:1;background:#1B2128;border-radius:16px;padding:14px"><div style="font-size:28px;font-weight:800;line-height:1.1">${big}</div><div style="font-size:13px;color:#C9CED4;margin-top:4px">${sub}</div><div style="font-size:12px;color:#A3ADB8;margin-top:2px">${sub2}</div></div>`;
function pageHead(kind,title,sub){const step=kind==='week'?'week':kind==='month'?'month':'year';return `
 <div style="padding:30px 20px 0"><div style="display:flex;align-items:center;justify-content:space-between"><div style="font-size:16px;font-weight:700">‹&nbsp; Insights</div>
 <div style="display:flex;gap:10px"><div style="width:44px;height:44px;border-radius:22px;background:#1E252D;display:flex;align-items:center;justify-content:center;font-size:20px">‹</div><div style="width:44px;height:44px;border-radius:22px;background:#1E252D;display:flex;align-items:center;justify-content:center;font-size:20px;color:#5B6472">›</div></div></div>
 <div style="color:#A3ADB8;font-size:11.5px;font-weight:800;letter-spacing:.8px;margin-top:8px">${step.toUpperCase()} DETAILS</div><h1 style="font-size:28px;line-height:1.15">${title}</h1><div style="color:#A3ADB8;font-size:13.5px;margin-top:2px">${sub}</div>`}
const habitCard=(i,top,rows,foot)=>`<div style="background:#1B2128;border-radius:16px;padding:13px 14px;margin-top:10px"><div style="display:flex;align-items:center;gap:8px"><i style="width:10px;height:10px;border-radius:50%;background:${HAB[i].c};display:block"></i><b style="font-size:15.5px;flex:1">${HAB[i].n}${HAB[i].lot?' <span style="font-weight:600;font-size:11.5px;color:#A3ADB8">· lot, monthly</span>':''}</b><span style="font-size:14px;font-weight:800">${top[0]}</span></div>
 <div style="color:#A3ADB8;font-size:12px;margin:3px 0 9px 18px">${top[1]}</div>${rows}<div style="display:flex;gap:14px;margin-top:9px;font-size:12px;color:#A3ADB8;flex-wrap:wrap">${foot}</div></div>`;
const runTxt=(r,b)=>`<span>Run <b style="color:#F2F4F6">${r}</b> · best ${b}</span>`;
const shieldTxt=n=>n?`<span style="display:flex;align-items:center;gap:5px">${GLASS(14,14)} ${n} Shield Day${n>1?'s':''} used</span>`:'';

if(S==='det-week'){
  // Mon..Sun, today Sat
  const dayCols=[[1,1,0,1,1],[1,1,1,0,0],[0,1,0,1,1],[1,1,0,0,1],[1,1,1,0,0],[0,0,0,1,1],null];
  const dl=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const st={eat:['b','b','s','b','b','t','f'],k:['b','b','b','b','b','t','f'],read:['o','b','o','o','b','t','f'],push:['b','o','b','o','o','b','f']};
  const m=(a,i)=>a.map(x=>x==='b'?['b',i]:[x]);
  el.innerHTML=pageHead('week','Week of Nov 9','Mon Nov 9 to Sun Nov 15 · today is Saturday')+`
  <div style="display:flex;gap:10px;margin-top:14px">${tile('18','built so far','14 floors · 4 lot check-ins')}${tile('6 of 6','days with a build','Last week at this point: 20')}</div>
  ${card('<b style="font-size:16px">Day by day</b>',`<div style="margin-top:12px">${bars(dayCols.map(c=>c?c:null),dl,{h:120,bw:28,gap:10,max:5})}</div>${legend()}`)}
  ${card('<b style="font-size:16px">By habit</b><span style="float:right;font-size:12.5px;color:#A3ADB8">Mon to Sun</span>',
   habitCard(0,['4 floors','Last week at this point: 5'],stripCells(m(st.eat,0),36,32,7),runTxt('9 days','9')+shieldTxt(1))+
   habitCard(1,['5 floors','Last week at this point: 6'],stripCells(m(st.k,1),36,32,7),runTxt('17 days','17'))+
   habitCard(2,['2 floors','Last week at this point: 3'],stripCells(m(st.read,2),36,32,7),runTxt('1 day','6'))+
   habitCard(3,['3 floors','Last week at this point: 3'],stripCells(m(st.push,3),36,32,7),runTxt('1 day','8'))+
   habitCard(4,['4 check-ins','23 of 50 this month'],`<div style="height:10px;border-radius:5px;background:#232b34;overflow:hidden"><div style="width:46%;height:100%;background:${HAB[4].c}"></div></div>`,`<span>Monthly target 50 · 27 to go</span>`))}
  <div style="color:#A3ADB8;font-size:12.5px;line-height:1.45;margin:14px 2px 0">A glass square is a Shield Day. A soft outline is an open day. Floors never come down.</div>`;
}
if(S==='det-month'){
  const grid=(vals,idx)=>vals.map(v=>v==='b'?['b',idx]:v==='s'?['s']:v==='t'?['t']:v==='f'?['f']:['o']);
  const n=30;const mk=(pat)=>Array.from({length:n},(_,i)=>{const d=i+1;if(d>14)return d===14?'t':'f';return pat(d)});
  const mkp=(p)=>Array.from({length:n},(_,i)=>{const d=i+1;if(d===14)return 't';if(d>14)return 'f';return p(d)});
  const eat=mkp(d=>(d%7===3?'s':(d%5===0?'o':'b'))),k=mkp(d=>d%6===0?'o':'b'),rd=mkp(d=>d%3===0?'b':'o'),pu=mkp(d=>d%2===0?'b':'o');
  const dayVals=Array.from({length:30},(_,i)=>{const d=i+1;if(d>14)return null;return [eat[i]==='b'?1:0,k[i]==='b'?1:0,rd[i]==='b'?1:0,pu[i]==='b'?1:0,(d%4===0?1:0)]});
  const lab=Array.from({length:30},(_,i)=>(i===0||i===7||i===14||i===21)?String(i+1):'');
  el.innerHTML=pageHead('month','November 2026','Nov 1 to Nov 30 · day 14 of 30')+`
  <div style="display:flex;gap:10px;margin-top:14px">${tile('58','built so far','47 floors · 11 lot check-ins')}${tile('13 of 13','days with a build','Last month at this point: 64')}</div>
  ${card('<b style="font-size:16px">Day by day</b>',`<div style="margin-top:12px">${bars(dayVals,lab,{h:110,bw:7,gap:3,max:5})}</div>${legend()}`)}
  ${card('<b style="font-size:16px">By habit</b><span style="float:right;font-size:12.5px;color:#A3ADB8">Each row is 7 days</span>',
   habitCard(0,['10 floors','Last month at this point: 12'],stripCells(grid(eat,0),36,22,7),runTxt('9 days','9')+shieldTxt(2))+
   habitCard(1,['12 floors','Last month at this point: 13'],stripCells(grid(k,1),36,22,7),runTxt('17 days','17'))+
   habitCard(2,['5 floors','Last month at this point: 6'],stripCells(grid(rd,2),36,22,7),runTxt('1 day','6'))+
   habitCard(3,['7 floors','Last month at this point: 7'],stripCells(grid(pu,3),36,22,7),runTxt('1 day','8'))+
   habitCard(4,['11 check-ins','Monthly target 50'],`<div style="height:10px;border-radius:5px;background:#232b34;overflow:hidden"><div style="width:22%;height:100%;background:${HAB[4].c}"></div></div>`,`<span>11 of 50 so far · 39 to go</span>`))}`;
}
if(S==='det-year'){
  const ml=['Dec','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov'];
  const ym=[[18,20,10,12,8],[20,22,11,13,9],[17,20,9,11,8],[22,24,12,14,10],[20,23,11,13,11],[23,25,12,14,12],[22,24,12,14,9],[24,26,13,15,11],[21,25,11,13,10],[25,27,14,16,12],[23,26,12,15,13],[17,19,9,11,12]];
  const mini=(vals,i)=>`<svg width="288" height="46" style="display:block">${vals.map((v,k)=>`<rect x="${k*24}" y="${46-v/28*40-4}" width="19" height="${v/28*40+4}" rx="3" fill="${HAB[i].c}" opacity="${k===11?1:.85}"/>`).join('')}</svg><div style="display:flex;justify-content:space-between;font-size:10.5px;color:#A3ADB8;width:288px;margin-top:3px">${ml.map(x=>`<span style="width:24px">${x[0]}</span>`).join('')}</div>`;
  el.innerHTML=pageHead('year','Last 12 months','Dec 2025 to Nov 2026 · this month is still in progress')+`
  <div style="display:flex;gap:10px;margin-top:14px">${tile('1,284','built in 12 months','1,052 floors · 232 lot check-ins')}${tile('Oct','busiest month','Best month so far: 74')}</div>
  ${card('<b style="font-size:16px">Month by month</b>',`<div style="margin-top:12px">${bars(ym,ml,{h:120,bw:18,gap:8})}</div>${legend()}`)}
  ${card('<b style="font-size:16px">By habit</b><span style="float:right;font-size:12.5px;color:#A3ADB8">Floors per month</span>',
   habitCard(0,['246 floors','Previous 12 months: 210'],mini(ym.map(r=>r[0]),0),runTxt('9 days','9')+shieldTxt(5))+
   habitCard(1,['271 floors','Previous 12 months: 240'],mini(ym.map(r=>r[1]),1),runTxt('17 days','17'))+
   habitCard(2,['136 floors','Previous 12 months: 120'],mini(ym.map(r=>r[2]),2),runTxt('1 day','21'))+
   habitCard(3,['160 floors','Previous 12 months: 150'],mini(ym.map(r=>r[3]),3),runTxt('1 day','12'))+
   habitCard(4,['132 check-ins','Monthly target 50'],mini(ym.map(r=>r[4]*2),4),`<span>Target met in 0 of 12 months · closest 36 of 50</span>`))}`;
}
