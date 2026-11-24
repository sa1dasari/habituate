const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();
for(const [n,w,h] of [['rd-sh1',390,390],['rd-sh2',390,694],['rd-sh3',820,470],['rd-sh4',390,390],['rd-sh5',390,694],['rd-sh6',820,420],['rd-sh7',390,844]]){const p=await b.newPage({viewport:{width:w,height:h},deviceScaleFactor:2});
await p.goto('file://'+__dirname+'/screens.html?s='+n,{waitUntil:'networkidle'}).catch(()=>{});await p.waitForTimeout(800);await p.screenshot({path:__dirname+'/'+n+'.png'});}
await b.close()})();
