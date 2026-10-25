const { chromium } = require('playwright'); const S=process.argv[2]; const fs=require('fs');
(async()=>{const b=await chromium.launch({executablePath: process.env.CHROME_PATH || undefined});
const p=await b.newPage({viewport:{width:1280,height:800}}); p.on('pageerror',e=>console.log('pageerror',e.message));
await p.goto('file://'+S+'/../../dist/ポイント表照合.html'); await p.waitForFunction(()=>/登録済み/.test(document.getElementById('startNote').textContent)); await p.click('.langBtn[data-lang=ja]');
const pin=async c=>{for(const k of c) await p.click(`#pinPad button:text-is("${k}")`); await p.click('#pinOk');};
await p.click('.tab[data-v=pdf]'); await pin('0000'); await p.setInputFiles('#fileIn',fs.readdirSync(S+'/in').map(f=>S+'/in/'+f)); await p.waitForFunction(()=>/取込完了/.test(document.getElementById('impMsg').textContent));
const n=()=>p.evaluate(()=>Object.keys(PDF_INDEX).length);
// registration tab delete: cancel then OK
p.once('dialog',d=>d.dismiss()); await p.locator('[data-del]').first().click(); await p.waitForTimeout(300); console.log('reg cancel ->', await n());
p.once('dialog',d=>{console.log('confirm text:', d.message().split('\n')[0]); d.accept();}); await p.locator('[data-del]').first().click(); await p.waitForTimeout(400); console.log('reg ok ->', await n(), '| cards', await p.locator('#pdfList .pcard').count());
// badge list delete
await p.click('.tab[data-v=check]'); await p.click('#pCountBadge'); await p.waitForTimeout(300);
console.log('badge del buttons:', await p.locator('[data-pldel]').count());
await p.locator('[data-pldel]').first().click(); await pin('1111'); await p.waitForTimeout(300); console.log('wrong pw ->', await n());
p.once('dialog',d=>d.accept()); await p.locator('[data-pldel]').first().click(); await pin('0000'); await p.waitForTimeout(500); console.log('pw ok ->', await n(), '| list', await p.textContent('#plCount'), '| badge', await p.textContent('#pCountTxt'));
p.once('dialog',d=>d.accept()); await p.locator('[data-pldel]').first().click(); await p.waitForTimeout(500); console.log('2nd (no pw again):', await n(), 'pin open?', await p.evaluate(()=>document.getElementById('pinDlg').classList.contains('on')));
await p.screenshot({path:S+'/del.png'});
await p.click('#plClose'); await p.evaluate(()=>onScan('12345-67890')); await p.waitForTimeout(600); console.log('scan deleted part -> NG:', await p.evaluate(()=>document.getElementById('ng').classList.contains('on')));
await b.close();})();
