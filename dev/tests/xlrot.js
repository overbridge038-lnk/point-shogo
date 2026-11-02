// Excelの一覧：貼った写真の向き（90度回転・左右反転）のまま、ポイント表の写真にする
const { chromium } = require('playwright'); const S = process.argv[2];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined }); const p = await b.newPage({ viewport: { width: 1280, height: 900 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + S + '/../../dist/ポイント照合ツール.html'); await p.waitForFunction(() => /登録済み/.test(document.getElementById('startNote').textContent)); await p.click('.langBtn[data-lang=ja]');
  await p.click('.tab[data-v=set]'); for (const k of '0000') await p.click(`#pinPad button:text-is("${k}")`); await p.click('#pinOk');
  await p.setInputFiles('#xlIn', S + '/rotpic.xlsx'); await p.waitForFunction(() => document.getElementById('xlSum').textContent.length > 0, null, { timeout: 60000 });
  console.log('読んだ写真の情報:', JSON.stringify(await p.evaluate(() => XL.rows.map(r => r.urls.map(u => ({ rot: u.rot, flipH: u.flipH }))))));
  // 向きを直した写真の、大きさと、左右の色（元：左が赤・右が青、200×100）
  console.log('直した写真:', JSON.stringify(await p.evaluate(async () => {
    const out = [];
    for (const r of XL.rows) { const im = await xlLoadOriented(r.urls[0]); const cv = document.createElement('canvas'); cv.width = im.naturalWidth; cv.height = im.naturalHeight; const cx = cv.getContext('2d'); cx.drawImage(im, 0, 0);
      const px = (x, y) => { const d = cx.getImageData(x, y, 1, 1).data; return d[0] > 150 && d[2] < 100 ? '赤' : d[2] > 150 && d[0] < 100 ? '青' : '他'; };
      out.push(cv.width + '×' + cv.height + ' 左=' + px(3, cv.height >> 1) + ' 右=' + px(cv.width - 4, cv.height >> 1) + ' 上=' + px(cv.width >> 1, 3) + ' 下=' + px(cv.width >> 1, cv.height - 4)); }
    return out; })));
  await p.click('#xlGo'); await p.waitForFunction(() => Object.keys(PDF_INDEX).length === 3, null, { timeout: 60000 });
  console.log('登録:', await p.evaluate(async () => { const r = await getPdf(Object.keys(PDF_INDEX).sort()[0]); return r.src.photos.length + '枚'; }));
  console.log('pageerrors:', errs.length ? errs : 'none'); await b.close();
})();
