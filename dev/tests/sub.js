const { chromium } = require('playwright'); const S=process.argv[2]; const fs=require('fs');
(async()=>{const b=await chromium.launch({executablePath: process.env.CHROME_PATH || undefined});
const p=await b.newPage({viewport:{width:1280,height:800}}); p.on('pageerror',e=>console.log('pageerror',e.message));
await p.goto('file://'+S+'/../../dist/ポイント表照合.html'); await p.waitForFunction(()=>/登録済み/.test(document.getElementById('startNote').textContent)); await p.click('.langBtn[data-lang=ja]');
const pin=async c=>{for(const k of c) await p.click(`#pinPad button:text-is("${k}")`); await p.click('#pinOk');};
await p.click('.tab[data-v=pdf]'); await pin('0000'); await p.setInputFiles('#fileIn',fs.readdirSync(S+'/in').map(f=>S+'/in/'+f)); await p.waitForFunction(()=>/取込完了/.test(document.getElementById('impMsg').textContent));
await p.click('.tab[data-v=check]');
async function scan(v){ await p.evaluate(v=>{onScan(v);},v); await p.waitForFunction(()=>{const j=document.getElementById('jBig').textContent; return j==='OK'||document.getElementById('ng').classList.contains('on')||document.getElementById('pick').classList.contains('on');},null,{timeout:15000}); if(await p.evaluate(()=>document.getElementById('pick').classList.contains('on'))){ console.log('  (選ぶ画面：候補 '+await p.locator('#pickGrid .pcard').count()+' 件 → やめる)'); await p.click('#pickCancel'); await p.waitForFunction(()=>document.getElementById('ng').classList.contains('on'),null,{timeout:15000}); }
  const ng=await p.evaluate(()=>document.getElementById('ng').classList.contains('on'));
  console.log(JSON.stringify(v).padEnd(44), ng?'NG: '+await p.textContent('#ngWhy')+' | '+await p.textContent('#ngDet'):'OK  kanban='+await p.textContent('#kPn')+' pdf='+await p.textContent('#pdfName'));
  if(ng){ for(const k of '1234') await p.click(`#pad button:text-is("${k}")`); await p.click('#pad button:text-is("OK")'); await p.waitForTimeout(200);} }
await scan('12345-67890');                       // そのまま
await scan('AAA,12345-67890,TOYOTA,6');          // 区切りあり
await scan('TOYOTA1234567890A0020LOT77');        // 区切りなし・ハイフンなしで中に含む
await scan('X0023456-78901-Y99');                // 区切りなし・ハイフンありで中に含む
await scan('ZZ345678901299');                    // 3456789012 を含む
await scan('9999999999');                        // どれも含まない
await p.evaluate(()=>tx('pdfs','readwrite',s=>s.put({key:'4567890123',name:'4567890123.pdf',size:1,at:'x',data:new ArrayBuffer(8)})));
await p.evaluate(()=>loadPdfIndex());
await scan('Q12345678901234567890');             // 1234567890 だけ（12345678901234567890 には 4567890123 は無い）
await p.evaluate(()=>tx('pdfs','readwrite',s=>s.put({key:'2345678901',name:'2345678901x.pdf',size:1,at:'x',data:new ArrayBuffer(8)})));
await scan('A1234567890B2345678901');            // 同じ長さで2つ → NG
await b.close();})();
