// New boards: first-run, notifications, retired, coach, friend skyline, forms
(function(){
const Q=new URLSearchParams(location.search);const S2=Q.get('s');
if(!/^(fr-|nt-|rt-|co-|fs-|fm-)/.test(S2||''))return;

const R=document.getElementById('root');const ICO={'heart-pulse':'<path d="M12 21s-8-5.5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.5-8 11-8 11Z"/>','book-open-outline':'<path d="M3 5.5c3-1 6-1 9 1.5 3-2.5 6-2.5 9-1.5V19c-3-1-6-1-9 1.5C9 18 6 18 3 19Z M12 7v13"/>','meditation':'<circle cx="12" cy="6" r="2.5"/><path d="M5 20c0-4 3-6 7-6s7 2 7 6M8 14l-3 3M16 14l3 3"/>','dumbbell':'<path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10"/>','weather-night':'<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/>','home-outline':'<path d="M4 11l8-7 8 7v9H4ZM10 20v-6h4v6"/>','pencil-plus-outline':'<path d="M4 20l1-4L16 5l3 3L8 19ZM15 6l3 3"/>','bell-ring-outline':'<path d="M6 17V11a6 6 0 0 1 12 0v6l2 2H4ZM10 21h4"/>','weather-partly-cloudy':'<path d="M7 19a4 4 0 0 1 0-8 5 5 0 0 1 9.5 1A3.5 3.5 0 0 1 16 19ZM5 5l1.5 1.5M12 3v2M19 5l-1.5 1.5"/>','archive-outline':'<path d="M3 5h18v4H3ZM5 9v10h14V9M10 13h4"/>'};
const mdi=(n,s=20,c='currentColor')=>`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${ICO[n]||''}</svg>`;
const star=(n,h,seed=0)=>{let o='';for(let i=0;i<n;i++)o+=`<circle cx="${((i+seed)*97)%390}" cy="${((i+seed)*53)%h+6}" r="${i%3?0.9:1.4}" fill="#dfe6ff" opacity="${0.35+(i%4)*0.15}"/>`;return o};
const sky=(h)=>`<defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0B1030"/><stop offset="1" stop-color="#232a5a"/></linearGradient></defs><rect width="390" height="${h}" fill="url(#sg)"/>${star(70,h-80)}`;
const moon=(x,y)=>`<circle cx="${x}" cy="${y}" r="22" fill="#F4EFD8"/><circle cx="${x+10}" cy="${y-6}" r="20" fill="#121836"/>`;
const pad=(x,y,w=84,plus=true)=>`<path d="M${x},${y}h${w}l18,-10h${-w}Z" fill="none" stroke="#7A86A8" stroke-width="1.6" stroke-dasharray="5 4"/>${plus?`<circle cx="${x+w/2+9}" cy="${y-42}" r="17" fill="none" stroke="#fff" stroke-width="2"/><path d="M${x+w/2+9},${y-50}v16M${x+w/2+1},${y-42}h16" stroke="#fff" stroke-width="2"/>`:''}`;
const hdrIcons=(n)=>{const ic=['<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F2F4F6" stroke-width="2"><path d="M4 5h16v11H9l-5 4Z"/></svg>','<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F2F4F6" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>'];return `<div style="display:flex;gap:8px">${ic.slice(0,n).map(i=>`<div style="width:44px;height:44px;border-radius:22px;background:#1E252D;display:flex;align-items:center;justify-content:center">${i}</div>`).join('')}</div>`};
const shell=(inner)=>`<div style="position:absolute;inset:0;overflow:hidden">${inner}</div>${tabs}`;
const btn=(t,kind='pri',extra='')=>kind==='pri'?`<div style="height:52px;border-radius:26px;background:#F2C14E;color:#1b1608;font-weight:800;font-size:16px;display:flex;align-items:center;justify-content:center;${extra}">${t}</div>`:`<div style="height:48px;border-radius:24px;border:1.5px solid #2F3944;color:#F2F4F6;font-weight:700;font-size:15px;display:flex;align-items:center;justify-content:center;${extra}">${t}</div>`;

if(S2==='fr-empty'){
  R.innerHTML=shell(`<svg width="390" height="540" style="position:absolute;top:0;left:0">${sky(540)}${moon(320,170)}
   <rect y="480" width="390" height="60" fill="#0F1216"/>${pad(30,468)}${pad(148,468)}${pad(266,468)}</svg>
   <div style="position:absolute;top:34px;left:20px;right:20px;display:flex;justify-content:space-between;align-items:flex-start"><div><h1 style="font-size:30px">Skyline</h1><div style="color:#A3ADB8;font-size:14px;margin-top:2px">Your skyline starts here</div></div>${hdrIcons(2)}</div>
   <div style="position:absolute;top:540px;left:0;right:0;bottom:76px;background:#161B21;border-radius:24px 24px 0 0;padding:14px 20px"><div style="width:40px;height:4px;border-radius:2px;background:#3A4552;margin:0 auto 18px"></div>
   <div style="font-size:20px;font-weight:800">Lay your first foundation</div>
   <div style="color:#A3ADB8;font-size:14px;line-height:1.45;margin:6px 0 16px">Tap an empty lot to start a tower. Each time you build a floor, it grows.</div>${btn('Lay a foundation')}</div>`);
}
if(S2==='fr-templates'){
  const T=[['Drink water','heart-pulse','#EF4444'],['Read 10 minutes','book-open-outline','#14B8A6'],['Meditate','meditation','#8B5CF6'],['Go for a walk','dumbbell','#F97316'],['Sleep by 11pm','weather-night','#6366F1'],['Tidy up','home-outline','#92400E']];
  R.innerHTML=shell(`<div style="padding:26px 20px 0"><div style="color:#A3ADB8;font-size:16px;font-weight:600">Cancel</div><h1 style="font-size:30px;margin-top:14px">Lay a foundation</h1><div style="color:#A3ADB8;font-size:14px;margin-top:2px;line-height:1.4">Pick one to start, or make your own. You can change anything later.</div></div>
  <div style="padding:16px 20px 0;display:grid;grid-template-columns:1fr 1fr;gap:10px">${T.map(([n,i,c])=>`<div style="background:#161B21;border-radius:18px;min-height:96px;padding:14px;display:flex;flex-direction:column;justify-content:space-between"><div style="width:36px;height:36px;border-radius:10px;background:${c}33;display:flex;align-items:center;justify-content:center">${mdi(i,20,c)}</div><div style="font-weight:700;font-size:15px">${n}</div></div>`).join('')}
   <div style="grid-column:1/3;border:1.5px dashed #3A4552;border-radius:18px;min-height:64px;display:flex;align-items:center;justify-content:center;gap:8px;font-weight:700;font-size:15px;color:#F2F4F6">${mdi('pencil-plus-outline',20)} Custom</div></div>`);
}
if(S2==='fr-hold'){
  const fl=[...rep('lit',1)];
  R.innerHTML=shell(`<svg width="390" height="640" style="position:absolute;top:0;left:0">${sky(640)}${moon(320,190)}<rect y="540" width="390" height="100" fill="#0F1216"/>
   ${tower({x:150,base:540,w:84,fh:20,dx:22,dy:12,floors:fl,windows:2,today:true})}
   <circle cx="192" cy="486" r="30" fill="#121836" stroke="#3A4552" stroke-width="5"/><path d="M192,456a30,30,0,1,1,-26,15" fill="none" stroke="#F2C14E" stroke-width="5" stroke-linecap="round"/><text x="192" y="491" text-anchor="middle" font-size="13" font-weight="800" fill="#fff" font-family="Nunito">Hold</text>
   <text x="192" y="570" text-anchor="middle" font-size="13" font-weight="700" fill="#F2F4F6" font-family="Nunito">Read 10 minutes</text></svg>
   <div style="position:absolute;top:34px;left:20px;right:20px"><h1 style="font-size:28px">Build your first floor</h1><div style="color:#A3ADB8;font-size:14px;margin-top:4px;line-height:1.4">Press and hold the top of your tower for about a second. Let go early and nothing is built.</div></div>
   <div style="position:absolute;left:20px;right:20px;top:660px;color:#A3ADB8;font-size:13.5px;line-height:1.45">Prefer a quick tap? Turn on Tap to build in Profile, Accessibility.</div>`);
}
const dim=(inner)=>`<div style="position:absolute;inset:0;overflow:hidden"><svg width="390" height="844" style="position:absolute;inset:0">${sky(844)}${moon(320,120)}<rect y="700" width="390" height="144" fill="#0F1216"/>${tower({x:150,base:700,w:84,fh:20,dx:22,dy:12,floors:['lit','lit','lit'],windows:2,today:true})}</svg><div style="position:absolute;inset:0;background:rgba(4,6,10,.7)"></div>${inner}</div>`;
if(S2==='fr-notif'){
  R.innerHTML=dim(`<div style="position:absolute;left:20px;right:20px;top:230px;background:#1B2128;border-radius:24px;padding:24px 22px"><div style="width:48px;height:48px;border-radius:14px;background:#2B2717;display:flex;align-items:center;justify-content:center">${mdi('bell-ring-outline',26,'#F2C14E')}</div>
   <div style="font-size:22px;font-weight:800;margin-top:16px;line-height:1.2">A gentle reminder, if you want one</div>
   <div style="color:#C9CED4;font-size:14.5px;line-height:1.5;margin-top:8px">We can remind you at the time you choose for each tower, and tell you when a friend builds beside you. You can change this any time in Profile.</div>
   <div style="display:flex;gap:10px;margin-top:20px"><div style="flex:1">${btn('Not now','sec')}</div><div style="flex:1">${btn('Turn on','pri','height:48px;font-size:15px')}</div></div></div>`);
}
if(S2==='fr-loc'){
  R.innerHTML=dim(`<div style="position:absolute;left:20px;right:20px;top:210px;background:#1B2128;border-radius:24px;padding:24px 22px"><div style="width:48px;height:48px;border-radius:14px;background:#17304a;display:flex;align-items:center;justify-content:center">${mdi('weather-partly-cloudy',26,'#7DC4F0')}</div>
   <div style="font-size:22px;font-weight:800;margin-top:16px;line-height:1.2">Match your sky to your weather</div>
   <div style="color:#C9CED4;font-size:14.5px;line-height:1.5;margin-top:8px">With your approximate location, your skyline's sky can show real clouds, rain or snow — not just the clock. It's never shown precisely, never shared, and stays on this device. Skip and the sky still follows the time of day.</div>
   <div style="display:flex;gap:10px;margin-top:20px"><div style="flex:1">${btn('Skip','sec')}</div><div style="flex:1">${btn('Allow location','pri','height:48px;font-size:15px')}</div></div></div>`);
}
})();
