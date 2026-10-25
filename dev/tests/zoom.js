const { chromium } = require('playwright'); const S=process.argv[2];
(async()=>{const b=await chromium.launch({executablePath: process.env.CHROME_PATH || undefined});
const ctx=await b.newContext({viewport:{width:853,height:533},deviceScaleFactor:1.5,hasTouch:true}); const p=await ctx.newPage(); p.on('pageerror',e=>console.log('pageerror',e.message));
await p.goto('file://'+S+'/../../dist/ポイント表照合.html'); await p.waitForFunction(()=>/登録済み/.test(document.getElementById('startNote').textContent)); await p.click('.langBtn[data-lang=ja]');
await p.click('.tab[data-v=pdf]'); for(const k of '0000') await p.click(`#pinPad button:text-is("${k}")`); await p.click('#pinOk');
await p.setInputFiles('#fileIn',[S+'/tpl_pc.pdf']); await p.waitForFunction(()=>/取込完了/.test(document.getElementById('impMsg').textContent));
await p.click('.tab[data-v=check]'); await p.evaluate(()=>{document.getElementById('toast').style.display='none'; onScan('TPLPC')});
await p.waitForFunction(()=>document.getElementById('jBig').textContent==='OK'); await p.waitForTimeout(300);
const st=()=>p.evaluate(()=>({lbl:document.getElementById('zLbl').textContent, w:document.querySelector('#pdfbox canvas').style.width, cw:document.querySelector('#pdfbox canvas').width, sl:Math.round(document.getElementById('pdfbox').scrollLeft)}));
console.log('fit:', JSON.stringify(await st()), 'bar visible', await p.isVisible('#zoomBar'));
await p.click('#zIn'); await p.click('#zIn'); console.log('+ +:', JSON.stringify(await st()));
await p.screenshot({path:S+'/zoom_in.png'});
await p.click('#zFit'); console.log('fit:', JSON.stringify(await st()));
// pinch via CDP touch
const cdp=await ctx.newCDPSession(p); const bx=await p.locator('#pdfbox').boundingBox(); const cx=bx.x+bx.width*0.3, cy=bx.y+bx.height*0.5;
await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx-30,y:cy,id:1},{x:cx+30,y:cy,id:2}]});
for (let i=1;i<=6;i++) await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx-30-i*15,y:cy,id:1},{x:cx+30+i*15,y:cy,id:2}]});
await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); console.log('pinch:', JSON.stringify(await st()));
await p.screenshot({path:S+'/zoom_pinch.png'});
// double tap toggles back
for (let k=0;k<2;k++){ await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx,y:cy,id:3}]}); await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); await p.waitForTimeout(80);}
console.log('double tap:', JSON.stringify(await st()));
await p.evaluate(()=>resetView()); console.log('after reset bar hidden:', !(await p.isVisible('#zoomBar')));
await b.close();})();
