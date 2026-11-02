// 「ポイント表をつくる」の写真の枠にも、Excel(.xlsx)をドラッグ＆ドロップ／選択で入れられる（Excelの枠と同じ処理）
const { chromium } = require('playwright'); const S = process.argv[2]; const fs = require('fs');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('file://' + S + '/../../dist/ポイント表照合.html'); await p.waitForFunction(() => /登録済み/.test(document.getElementById('startNote').textContent)); await p.click('.langBtn[data-lang=ja]');
  await p.click('.tab[data-v=set]'); for (const k of '0000') await p.click(`#pinPad button:text-is("${k}")`); await p.click('#pinOk');
  const cdp = await ctx.newCDPSession(p); const keys = () => p.evaluate(() => Object.keys(PDF_INDEX).sort().join(','));
  const drop = async (files, sel) => { await p.locator(sel).scrollIntoViewIfNeeded(); const bx = await p.locator(sel).boundingBox(); const x = bx.x + 80, y = bx.y + 30;
    for (const type of ['dragEnter', 'dragOver']) await cdp.send('Input.dispatchDragEvent', { type, x, y, data: { dragOperationsMask: 1, items: [], files } });
    await cdp.send('Input.dispatchDragEvent', { type: 'drop', x, y, data: { dragOperationsMask: 1, items: [], files } }); };
  console.log('枠の案内:', (await p.locator('#tplDropTxt').innerText()).replace(/\n/g, ' / '));
  // 1) 資料のExcelを写真の枠に落とす → PDFに変換して登録（確認あり）
  await drop([S + '/かんばん回収.xlsx'], '#tplDrop');
  await p.waitForFunction(() => /PDFに変換して登録/.test(document.getElementById('xlMsg').textContent), null, { timeout: 60000 });
  console.log('資料Excel:', (await p.locator('#xlMsg').innerText()).replace(/\n/g, ' / '), '| keys', await keys(), '| 枠のメッセージ:', (await p.locator('#tplPhotoMsg').innerText().catch(() => '')).slice(0, 60));
  // 2) 一覧のExcelを写真の枠に落とす → 一覧の確認が出る
  await drop([S + '/list.xlsx'], '#tplDrop'); await p.waitForFunction(() => document.getElementById('xlSum').textContent.length > 0, null, { timeout: 60000 });
  console.log('一覧Excel:', await p.locator('#xlSum').innerText()); await p.click('#xlCancel');
  // 3) 写真は今までどおり写真になる／写真とExcelいっしょでも両方
  await drop([S + '/ph1.jpg'], '#tplDrop'); await p.waitForFunction(() => TPL.imgs.length === 1, null, { timeout: 20000 }); console.log('写真:', await p.evaluate(() => TPL.imgs.length));
  // 4) ファイル選択（タップ）でも
  await p.setInputFiles('#tplPhotoIn', [{ name: 'form.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: fs.readFileSync(S + '/form.xlsx') }]);
  await p.waitForFunction(() => /FORM/i.test(Object.keys(PDF_INDEX).join(',')), null, { timeout: 60000 }); console.log('選択でExcel:', await keys(), '| 写真はそのまま', await p.evaluate(() => TPL.imgs.length));
  console.log('pageerrors:', errs.length ? errs : 'none'); await b.close();
})();
