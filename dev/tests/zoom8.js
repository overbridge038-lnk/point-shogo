// 800% まで拡大でき、高倍率では見えている所が高解像度で描き直されること
const { chromium } = require('playwright'); const S=process.argv[2];
(async()=>{const b=await chromium.launch({executablePath: process.env.CHROME_PATH || undefined});
const ctx=await b.newContext({viewport:{width:853,height:533},deviceScaleFactor:1.5,hasTouch:true}); const p=await ctx.newPage(); p.on('pageerror',e=>console.log('pageerror',e.message));
await p.goto('file://'+S+'/../../dist/ポイント照合ツール.html'); await p.waitForFunction(()=>/登録済み/.test(document.getElementById('startNote').textContent)); await p.click('.langBtn[data-lang=ja]');
await p.click('.tab[data-v=pdf]'); for(const k of '0000') await p.click(`#pinPad button:text-is("${k}")`); await p.click('#pinOk');
await p.setInputFiles('#fileIn',[S+'/tpl_pc.pdf']); await p.waitForFunction(()=>/取込完了/.test(document.getElementById('impMsg').textContent));
await p.click('.tab[data-v=check]'); await p.evaluate(()=>{document.getElementById('toast').style.display='none'; onScan('TPLPC')});
await p.waitForFunction(()=>document.getElementById('jBig').textContent==='OK'); await p.waitForTimeout(300);
const st=()=>p.evaluate(()=>({lbl:document.getElementById('zLbl').textContent, sharp:document.querySelectorAll('#pdfbox canvas.sharp').length,
  sw:(document.querySelector('#pdfbox canvas.sharp')||{}).width||0}));
const steps=[]; for(let i=0;i<8;i++){ await p.click('#zIn'); steps.push((await st()).lbl); }
console.log('zIn steps:', steps.join(' → '));
await p.waitForTimeout(800); const s1=await st(); console.log('at max:', JSON.stringify(s1));
await p.screenshot({path:S+'/zoom8_max.png'});
await p.evaluate(()=>{const b=document.getElementById('pdfbox'); b.scrollTop+=300; b.scrollLeft+=200;}); await p.waitForTimeout(800);
console.log('after scroll:', JSON.stringify(await st()));
await p.screenshot({path:S+'/zoom8_scroll.png'});
await p.click('#zFit'); await p.waitForTimeout(400); console.log('fit:', JSON.stringify(await st()));
await p.evaluate(()=>setZoom(1.4)); await p.waitForTimeout(600); console.log('140% (no sharp needed?):', JSON.stringify(await st()));
// double tap cycle
const cdp=await ctx.newCDPSession(p); const bx=await p.locator('#pdfbox').boundingBox(); const cx=bx.x+bx.width*0.4, cy=bx.y+bx.height*0.4;
await p.click('#zFit'); const seq=[];
for(let r=0;r<3;r++){ for (let k=0;k<2;k++){ await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx,y:cy,id:3}]}); await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); await p.waitForTimeout(80);} seq.push((await st()).lbl); await p.waitForTimeout(400);}
console.log('double tap cycle:', seq.join(' → '));
await p.evaluate(()=>resetView()); await p.waitForTimeout(300); console.log('after reset sharp:', (await st()).sharp);
await b.close();})();
