// 古いタブレットでは pdf.js が動かない。自作の画像PDF（Excel変換）は pdf.js なしでも、見本・拡大・照合で表示できる
const { chromium } = require('playwright'); const S = process.argv[2]; const fs = require('fs');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + S + '/../../dist/ポイント表照合.html'); await p.waitForFunction(() => /登録済み/.test(document.getElementById('startNote').textContent)); await p.click('.langBtn[data-lang=ja]');
  await p.evaluate(() => { pdfjs = null; PDFJS_ERR = 'test'; }); // pdf.js が動かない状態にする
  await p.click('.tab[data-v=set]'); for (const k of '0000') await p.click(`#pinPad button:text-is("${k}")`); await p.click('#pinOk');
  p.once('dialog', d => d.accept());
  await p.setInputFiles('#xlIn', [{ name: 'A16Z,A170.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: fs.readFileSync(S + '/かんばん回収.xlsx') }]);
  await p.waitForFunction(() => /取込完了|取り込めなかった|読み込めません/.test(document.getElementById('xlMsg').textContent), null, { timeout: 60000 });
  console.log('取込:', (await p.locator('#xlMsg').innerText()).replace(/\n/g, ' / '));
  const k = await p.evaluate(() => Object.keys(PDF_INDEX)[0]);
  await p.evaluate(k => { openPreview(k); }, k); await p.waitForTimeout(1500);
  console.log('拡大の絵:', await p.evaluate(() => { const c = document.querySelector('#pvBody canvas'); if (!c) return 'なし: ' + document.getElementById('pvBody').innerText; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 400) if (d[i] < 200) n++; return c.width + 'x' + c.height + ' 色つき' + n; }));
  await p.evaluate(() => { onScan('A16Z'); }); await p.waitForTimeout(2000);
  console.log('照合の絵:', await p.evaluate(() => document.querySelectorAll('#pdfbox canvas').length), '| 判定', await p.evaluate(() => document.getElementById('big') ? document.getElementById('big').textContent : ''));
  console.log('pageerrors:', errs.length ? errs : 'none'); await b.close();
})();
