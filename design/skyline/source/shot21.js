const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:760,height:640},deviceScaleFactor:2});
await p.goto('file://'+__dirname+'/screens.html?s=rd-21',{waitUntil:'networkidle'}).catch(()=>{});await p.waitForTimeout(800);await p.screenshot({path:__dirname+'/rd-21.png'});await b.close()})();
