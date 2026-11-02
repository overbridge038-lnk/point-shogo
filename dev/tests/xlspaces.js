// Excelの一覧：空白を並べて行を変えたポイント（空白が2つ以上）も、別のポイントとして読む。1つだけの空白は区切りにしない。改行は今までどおり
const { chromium } = require('playwright'); const S = process.argv[2];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined }); const p = await b.newPage({ viewport: { width: 1280, height: 900 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + S + '/../../dist/ポイント照合ツール.html'); await p.waitForFunction(() => /登録済み/.test(document.getElementById('startNote').textContent)); await p.click('.langBtn[data-lang=ja]');
  await p.click('.tab[data-v=set]'); for (const k of '0000') await p.click(`#pinPad button:text-is("${k}")`); await p.click('#pinOk');
  await p.setInputFiles('#xlIn', S + '/spaces.xlsx'); await p.waitForFunction(() => document.getElementById('xlSum').textContent.length > 0, null, { timeout: 60000 });
  console.log(JSON.stringify(await p.evaluate(() => XL.rows.map(r => ({ pn: r.pn, 行: r.pts, 英語: r.tr.en })))));
  console.log('pageerrors:', errs.length ? errs : 'none'); await b.close();
})();
