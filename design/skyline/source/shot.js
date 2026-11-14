const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
for(const s of (process.argv[2]?process.argv.slice(2):['towersheet','crosssection'])){const [nm,qq]=s.split(':');await p.goto('file://'+__dirname+'/screens.html?s='+nm+(qq?'&v='+qq:''),{waitUntil:'networkidle'}).catch(()=>{});await p.waitForTimeout(800);
const f=await p.evaluate(()=>document.fonts.check('16px Nunito'));console.log(s,'nunito',f);await p.screenshot({path:__dirname+'/'+s.replace(':','-')+'.png'});}
await b.close();})();
