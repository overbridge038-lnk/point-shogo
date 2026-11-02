// 「ポイント表をつくる」の写真の枠にExcel(.xlsx)を入れる（ドラッグ＆ドロップ／選択）：Excelの見た目が写真になり、ポイントを足して登録できる
const { chromium } = require('playwright'); const S = process.argv[2]; const fs = require('fs');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('file://' + S + '/../../dist/ポイント照合ツール.html'); await p.waitForFunction(() => /登録済み/.test(document.getElementById('startNote').textContent)); await p.click('.langBtn[data-lang=ja]');
  await p.click('.tab[data-v=set]'); for (const k of '0000') await p.click(`#pinPad button:text-is("${k}")`); await p.click('#pinOk');
  const cdp = await ctx.newCDPSession(p);
  const drop = async (files, sel) => { await p.locator(sel).scrollIntoViewIfNeeded(); const bx = await p.locator(sel).boundingBox(); const x = bx.x + 80, y = bx.y + 30;
    for (const type of ['dragEnter', 'dragOver']) await cdp.send('Input.dispatchDragEvent', { type, x, y, data: { dragOperationsMask: 1, items: [], files } });
    await cdp.send('Input.dispatchDragEvent', { type: 'drop', x, y, data: { dragOperationsMask: 1, items: [], files } }); };
  // 1) ドラッグ＆ドロップ：Excelの見た目が写真になる（Excelそのものは登録されない）
  await drop([S + '/かんばん回収.xlsx'], '#tplDrop'); await p.waitForFunction(() => TPL.imgs.length === 1, null, { timeout: 60000 });
  console.log('ドロップ → 写真の数:', await p.evaluate(() => TPL.imgs.length), '| 登録されたもの:', await p.evaluate(() => Object.keys(PDF_INDEX).length), '| 写真の大きさ:', await p.evaluate(() => TPL.imgs[0].im.naturalWidth + 'x' + TPL.imgs[0].im.naturalHeight));
  // 2) ファイル選択でも入る（もう1枚）
  await p.setInputFiles('#tplPhotoIn', [{ name: 'form.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: fs.readFileSync(S + '/form.xlsx') }]);
  await p.waitForFunction(() => TPL.imgs.length === 2, null, { timeout: 60000 }); console.log('選択 → 写真の数:', await p.evaluate(() => TPL.imgs.length));
  // 3) 古い.xlsや壊れたファイルは断る
  await p.setInputFiles('#tplPhotoIn', [{ name: 'broken.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('PKxx not excel') }]);
  await p.waitForFunction(() => /Excelとして読めませんでした|読めません/.test(document.getElementById('tplPhotoMsg').textContent), null, { timeout: 30000 }); console.log('壊れたExcel:', (await p.locator('#tplPhotoMsg').innerText()).slice(0, 70), '| 写真の数', await p.evaluate(() => TPL.imgs.length));
  // 4) ポイントを足して登録 → 翻訳つきのポイント表になる
  await p.fill('#tplPn', '88888-99999'); await p.fill('#tplQty', '6'); await p.fill('#tplPts', '掛け孔を確認\n向きをそろえる');
  await p.click('#tplTrBox summary'); await p.fill('#tplTr_en', 'Check the hanging hole\nAlign the direction'); await p.fill('#tplTr_vi', 'Kiểm tra lỗ treo\nCăn hướng');
  await p.click('#tplSave'); await p.waitForFunction(() => /登録しました/.test(document.getElementById('tplMsg').textContent), null, { timeout: 30000 });
  console.log('登録:', await p.evaluate(async () => { const r = await getPdf(Object.keys(PDF_INDEX)[0]); return Object.keys(PDF_INDEX).join(',') + ' | 写真 ' + r.src.photos.length + ' 枚 | 翻訳 ' + Object.keys(r.src.tr).filter(k => r.src.tr[k]).join(','); }));
  console.log('pageerrors:', errs.length ? errs : 'none'); await b.close();
})();
