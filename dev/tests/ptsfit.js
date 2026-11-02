// ポイントが多いとき：8個までそのまま／12個は文字を小さくして全部入る／長すぎる文はみ出す→警告。Excelの一覧では、ポイント9以降の列（ポイント9〜）も読める
const { chromium } = require('playwright'); const S = process.argv[2];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined }); const p = await b.newPage({ viewport: { width: 1280, height: 900 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + S + '/../../dist/ポイント照合ツール.html'); await p.waitForFunction(() => /登録済み/.test(document.getElementById('startNote').textContent)); await p.click('.langBtn[data-lang=ja]');
  console.log('文字の倍率:', JSON.stringify(await p.evaluate(() => { const cx = document.createElement('canvas').getContext('2d'); const f = n => { const r = tplPtsFit(cx, Array.from({ length: n }, (_, i) => '向きを確認する')); return n + '個: ' + r.sc.toFixed(2) + (r.ok ? '' : ' 入りきらない'); }; return [1, 4, 8, 9, 12, 16, 30].map(f); })));
  await p.click('.tab[data-v=set]'); for (const k of '0000') await p.click(`#pinPad button:text-is("${k}")`); await p.click('#pinOk');
  await p.setInputFiles('#xlIn', S + '/manypts.xlsx'); await p.waitForFunction(() => document.getElementById('xlSum').textContent.length > 0, null, { timeout: 60000 });
  console.log('読んだポイントの数:', await p.evaluate(() => XL.rows.map(r => r.pn + ':' + r.pts.length + '個' + (r.warn2 ? '（警告）' : '')).join(' | ')));
  console.log('画面の警告:', (await p.locator('#xlTbl').innerText()).split('\n').filter(x => /入りきりません/.test(x)).length + '行');
  await p.click('#xlGo'); await p.waitForFunction(() => Object.keys(PDF_INDEX).length === 3, null, { timeout: 60000 });
  console.log('登録:', await p.evaluate(() => Object.keys(PDF_INDEX).sort().join(',')));
  console.log('pageerrors:', errs.length ? errs : 'none'); await b.close();
})();
