// 古いブラウザ（Chrome 102以前など：deflate-raw の展開が使えない）でも、Excelが読める
const { chromium } = require('playwright'); const S = process.argv[2]; const fs = require('fs');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  // ブラウザ標準の展開を、使えない状態にする（古いChromeを再現）
  await ctx.addInitScript(() => { delete window.DecompressionStream; });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + S + '/../../dist/ポイント表照合.html'); await p.waitForFunction(() => /登録済み/.test(document.getElementById('startNote').textContent)); await p.click('.langBtn[data-lang=ja]');
  console.log('native deflate-raw usable:', await p.evaluate(() => { return typeof DecompressionStream !== 'undefined'; }));
  await p.click('.tab[data-v=pdf]'); for (const k of '0000') await p.click(`#pinPad button:text-is("${k}")`); await p.click('#pinOk');
  await p.setInputFiles('#fileIn', [{ name: 'A0PP,A023.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: fs.readFileSync(S + '/かんばん回収.xlsx') }]);
  await p.waitForFunction(() => /取込完了|取り込めなかった/.test(document.getElementById('impMsg').textContent), null, { timeout: 60000 });
  console.log('import:', (await p.locator('#impMsg').innerText()).replace(/\n/g, ' / '), '| keys', await p.evaluate(() => Object.keys(PDF_INDEX).join('|')));
  await p.click('.tab[data-v=check]'); await p.evaluate(() => { onScan('a0pp'); }); await p.waitForSelector('#pdfbox canvas', { timeout: 30000 }); await p.waitForFunction(() => document.getElementById('jBig').textContent === 'OK', null, { timeout: 30000 });
  console.log('scan a0pp:', await p.textContent('#jBig'), '|', await p.textContent('#pdfName'));
  await p.click('.tab[data-v=set]'); for (const k of '0000') await p.click(`#pinPad button:text-is("${k}")`).catch(() => {}); await p.click('#pinOk').catch(() => {});
  await p.setInputFiles('#xlIn', [{ name: 'broken.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.from('PK not really excel') }]); await p.waitForFunction(() => /読めませんでした/.test(document.getElementById('xlMsg').textContent));
  console.log('broken file message:', await p.locator('#xlMsg').innerText());
  console.log('pageerrors:', errs.length ? errs : 'none'); await b.close();
})();
