// スキャナーがQRの制御文字（GS・RS・EOT など）を「Ctrl＋キー」で送っても、照合画面から離れず正しく読めること（高木新城のQRで発生）
const { chromium } = require('playwright'); const S=process.argv[2]; const fs=require('fs');
(async()=>{const b=await chromium.launch({executablePath: process.env.CHROME_PATH || undefined});
const p=await b.newPage({viewport:{width:1280,height:800}}); p.on('pageerror',e=>console.log('pageerror',e.message));
await p.goto('file://'+S+'/../../dist/ポイント表照合.html'); await p.waitForFunction(()=>/登録済み/.test(document.getElementById('startNote').textContent)); await p.click('.langBtn[data-lang=ja]');
await p.click('.tab[data-v=pdf]'); for(const k of '0000') await p.click(`#pinPad button:text-is("${k}")`); await p.click('#pinOk');
await p.setInputFiles('#fileIn',fs.readdirSync(S+'/in2').map(f=>S+'/in2/'+f)); await p.waitForFunction(()=>/取込完了/.test(document.getElementById('impMsg').textContent));
await p.click('.tab[data-v=check]');
// ブラウザに渡ったCtrl/Altキー（＝止められなかったキー）を数える
await p.evaluate(()=>{ window.__leak=[]; window.addEventListener('keydown', e=>{ if((e.ctrlKey||e.altKey) && !e.defaultPrevented && !/^(Control|Alt|Shift)$/.test(e.key)) window.__leak.push(e.key); }); });
const R='@0>066V40027015111V020L2L400039178 E 1LE27V400039178 E 9K20 116D202610199D410KF1615020PA0U0P74043-60020Q32P017K18Z0796020C00000E22A02-04-01 0110E';
const res=async()=>{await p.waitForTimeout(900); const ng=await p.evaluate(()=>document.getElementById('ng').classList.contains('on')); const r=ng?'NG: '+await p.textContent('#ngWhy'):(await p.textContent('#jBig'))+' '+await p.textContent('#kPn'); if(ng){for(const k of '1234') await p.click(`#pad button:text-is("${k}")`); await p.click('#pad button:text-is("OK")');} return r;};
async function typeWith(parts, end){ for(const x of parts){ if(x.startsWith('^')) await p.keyboard.press(x.slice(1)); else await p.keyboard.type(x,{delay:2}); } if(end) await p.keyboard.press(end); }
// GS（Ctrl+]）・RS（Ctrl+Shift+6）・EOT（Ctrl+D）・Ctrl+E/K/L（アドレスバー検索）を混ぜて送る
await typeWith(['@0>066V400270151^Control+BracketRight','11V020L2L400039178 E 1LE27V400039178 E 9K20 116D202610199D410KF1615020PA0U0^Control+E','P74043-60020^Control+K','Q32P017K18Z0796020^Control+L','C00000E22A02-04-01 0110E^Control+D'], 'Enter');
console.log('ctrl mixed + Enter  :', await res());
await typeWith(['@0>066V400270151^Control+Shift+Digit6', R.slice(15)], 'Control+KeyM');
console.log('ctrl + CR(Ctrl+M)   :', await res());
await p.keyboard.press('Alt'); await p.keyboard.press('Alt+KeyD');
console.log('leaked to browser   :', JSON.stringify(await p.evaluate(()=>window.__leak)));
console.log('still on check tab  :', await p.evaluate(()=>document.getElementById('v-check').classList.contains('on')));
await b.close();})();
