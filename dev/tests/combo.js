const { chromium } = require('playwright'); const S=process.argv[2]; const fs=require('fs');
(async()=>{const b=await chromium.launch({executablePath: process.env.CHROME_PATH || undefined,env:{...process.env,LANG:'C.UTF-8'}});
const p=await b.newPage({viewport:{width:1280,height:800}}); p.on('pageerror',e=>console.log('pageerror',e.message));
await p.goto('file://'+S+'/../../dist/ポイント表照合.html'); await p.waitForFunction(()=>/登録済み/.test(document.getElementById('startNote').textContent)); await p.click('.langBtn[data-lang=ja]');
const pin=async c=>{for(const k of c) await p.click(`#pinPad button:text-is("${k}")`); await p.click('#pinOk');};
await p.click('.tab[data-v=pdf]'); await pin('0000'); await p.setInputFiles('#fileIn',fs.readdirSync(S+'/in3').map(f=>S+'/in3/'+f)); await p.waitForFunction(()=>/取込完了/.test(document.getElementById('impMsg').textContent));
console.log('keys:', await p.evaluate(()=>Object.keys(PDF_INDEX).join(' | ')));
await p.click('.tab[data-v=check]');
async function scan(label,v){ await p.evaluate(v=>{onScan(v);},v); await p.waitForFunction(()=>{const j=document.getElementById('jBig').textContent; return j==='OK'||document.getElementById('ng').classList.contains('on')||document.getElementById('pick').classList.contains('on');},null,{timeout:15000}); if(await p.evaluate(()=>document.getElementById('pick').classList.contains('on'))){ console.log('  (選ぶ画面：候補 '+await p.locator('#pickGrid .pcard').count()+' 件 → やめる)'); await p.click('#pickCancel'); await p.waitForFunction(()=>document.getElementById('ng').classList.contains('on'),null,{timeout:15000}); }
  const ng=await p.evaluate(()=>document.getElementById('ng').classList.contains('on'));
  console.log(label.padEnd(34), ng?'NG: '+await p.textContent('#ngWhy')+' | '+await p.textContent('#ngDet'):'OK  kanban='+await p.textContent('#kPn')+' pdf='+await p.textContent('#pdfName'));
  if(ng){ for(const k of '1234') await p.click(`#pad button:text-is("${k}")`); await p.click('#pad button:text-is("OK")'); await p.waitForTimeout(200);} }
const R='@0>066V40027015111V020L2L400039178 E 1LE27V400039178 E 9K20 116D202610199D410KF1615020PA0U0P74043-60020Q32P017K18Z0796020C00000E22A02-04-01 0110E';
await scan('Toyota QR (A0U0)', R);
await scan('Toyota QR but 背番号 B999', R.replace('PA0U0','PB999'));
await scan('Toyota QR 背番号 C123 (none)', R.replace('PA0U0','PC123'));
await scan('plain 12345-67890', '12345-67890');
// カンマ区切りの登録名は、どれか1つ（3文字以上）を読んだだけでも一致
await scan('only 背番号 A0U0', 'A0U0');
await scan('only 背番号 b999 (lower)', 'b999');
await scan('only 品番 (2 combos -> NG)', '74043-60020');
await scan('too short A0 (NG)', 'A0');
await scan('Toyota QR C123 still NG', R.replace('PA0U0','PC123'));
// template with comma name
await p.click('.tab[data-v=set]'); await pin('0000');
await p.setInputFiles('#tplPhotoIn',[S+'/ph1.jpg']); await p.waitForTimeout(500);
await p.fill('#tplPn','74043-60020,A0U0'); await p.fill('#tplQty','32'); await p.fill('#tplPts','テスト'); p.once('dialog',d=>d.accept()); await p.click('#tplSave'); await p.waitForTimeout(600);
console.log('template save:', await p.textContent('#tplMsg'));
await p.click('.tab[data-v=check]'); await scan('Toyota QR after template', R);
await b.close();})();
