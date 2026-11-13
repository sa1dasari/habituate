const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
for(const s of ['towersheet','crosssection']){await p.goto('file://'+__dirname+'/screens.html?s='+s,{waitUntil:'networkidle'}).catch(()=>{});await p.waitForTimeout(800);
const f=await p.evaluate(()=>document.fonts.check('16px Nunito'));console.log(s,'nunito',f);await p.screenshot({path:__dirname+'/'+s+'.png'});}
await b.close();})();
