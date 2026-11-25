const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();
for(const [n,q,w,h,o] of [['rd-pw','rd-pw',390,844,'pw-daily'],['rd-pw','rd-pw&v=weekly',390,844,'pw-weekly'],['rd-cp','rd-cp',820,700,'cp'],['rd-pw','rd-pw&v=browse',390,844,'pw-browse'],['rd-li','rd-li',390,844,'li'],['rd-su','rd-su',390,844,'su'],['pf-profile','pf-profile&v=plan',390,844,'pf-plan'],['rd-sn','rd-sn',820,470,'sn']]){const p=await b.newPage({viewport:{width:w,height:h},deviceScaleFactor:2});
await p.goto('file://'+__dirname+'/screens.html?s='+q,{waitUntil:'networkidle'}).catch(()=>{});await p.waitForTimeout(1200);await p.screenshot({path:__dirname+'/'+o+'.png'});}
await b.close()})();
