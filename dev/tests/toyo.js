const { chromium } = require('playwright'); const S=process.argv[2]; const fs=require('fs');
(async()=>{const b=await chromium.launch({executablePath: process.env.CHROME_PATH || undefined});
const p=await b.newPage({viewport:{width:1280,height:800}}); p.on('pageerror',e=>console.log('pageerror',e.message));
await p.goto('file://'+S+'/../../dist/ポイント表照合.html'); await p.waitForFunction(()=>/登録済み/.test(document.getElementById('startNote').textContent)); await p.click('.langBtn[data-lang=ja]');
await p.click('.tab[data-v=pdf]'); for(const k of '0000') await p.click(`#pinPad button:text-is("${k}")`); await p.click('#pinOk');
await p.setInputFiles('#fileIn',fs.readdirSync(S+'/in2').map(f=>S+'/in2/'+f)); await p.waitForFunction(()=>/取込完了/.test(document.getElementById('impMsg').textContent));
await p.click('.tab[data-v=check]');
const R='@0>066V40027015111V020L2L400039178 E 1LE27V400039178 E 9K20 116D202610199D410KF1615020PA0U0P74043-60020Q32P017K18Z0796020C00000E22A02-04-01 0110E';
const res=async()=>{await p.waitForTimeout(900); const ng=await p.evaluate(()=>document.getElementById('ng').classList.contains('on')); const r=ng?'NG: '+await p.textContent('#ngWhy')+' | '+await p.textContent('#ngDet'):(await p.textContent('#jBig'))+' '+await p.textContent('#kPn')+' / '+await p.textContent('#scanShow')+' / warn:'+await p.textContent('#scanWarn'); if(ng){for(const k of '1234') await p.click(`#pad button:text-is("${k}")`); await p.click('#pad button:text-is("OK")');} return r;};
await p.evaluate(r=>onScan(r),R); console.log('direct onScan      :', await res());
await p.keyboard.type(R,{delay:2}); await p.keyboard.press('Enter'); console.log('keyboard typed     :', await res());
// with GS separators like real ANSI MH10.8 data
const G=R.replace('V020','\x1dV020').replace('PA0U0','\x1dPA0U0').replace('P74043','\x1dP74043').replace('Q32','\x1dQ32');
await p.evaluate(r=>onScan(r),G); console.log('onScan with GS     :', await res());
await p.evaluate(r=>{ const inp=document.getElementById('scanInput'); inp.focus(); inp.value=r; inp.dispatchEvent(new Event('input')); }, G); console.log('field value w/ GS  :', await res());
// manual entry
await p.click('#manBtn'); await p.fill('#manIn', R); await p.press('#manIn','Enter'); console.log('manual             :', await res());
await p.click('.tab[data-v=pdf]'); for(const k of '0000') await p.click(`#pinPad button:text-is("${k}")`); await p.click('#pinOk');
p.once('dialog',d=>d.accept()); await p.locator('#pdfList .pcard', {hasText:'74043'}).locator('[data-del]').click(); await p.waitForTimeout(400);
await p.click('.tab[data-v=check]');
await p.evaluate(r=>onScan(r),R); console.log('not registered     :', await res());
await b.close();})();
