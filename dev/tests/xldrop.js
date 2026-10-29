// 設定タブのExcel枠に、ドラッグ＆ドロップで入れる
const { chromium } = require('playwright'); const S = process.argv[2];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + S + '/../../dist/ポイント表照合.html'); await p.waitForFunction(() => /登録済み/.test(document.getElementById('startNote').textContent)); await p.click('.langBtn[data-lang=ja]');
  await p.click('.tab[data-v=set]'); for (const k of '0000') await p.click(`#pinPad button:text-is("${k}")`); await p.click('#pinOk');
  const cdp = await ctx.newCDPSession(p); const keys = () => p.evaluate(() => Object.keys(PDF_INDEX).sort().join(','));
  const drop = async (files, sel) => { await p.locator(sel).scrollIntoViewIfNeeded(); const bx = await p.locator(sel).boundingBox(); const x = bx.x + 80, y = bx.y + 30;
    for (const type of ['dragEnter', 'dragOver']) await cdp.send('Input.dispatchDragEvent', { type, x, y, data: { dragOperationsMask: 1, items: [], files } });
    const over = await p.evaluate(() => document.getElementById('xlDrop').classList.contains('over'));
    await cdp.send('Input.dispatchDragEvent', { type: 'drop', x, y, data: { dragOperationsMask: 1, items: [], files } }); return over; };
  // 1) 資料（図の入ったExcel）を1件
  p.once('dialog', d => { console.log('confirm:', d.message().split('\n')[0]); d.accept(); });
  console.log('highlight while dragging:', await drop([S + '/かんばん回収.xlsx'], '#xlDrop'));
  await p.waitForFunction(() => /PDFに変換して登録/.test(document.getElementById('xlMsg').textContent), null, { timeout: 60000 });
  console.log('1 file:', (await p.locator('#xlMsg').innerText()).replace(/\n/g, ' / '), '| keys', await keys());
  // 2) 一覧のExcelを1件 → 一覧の確認が出る
  await drop([S + '/list.xlsx'], '#xlDrop'); await p.waitForFunction(() => document.getElementById('xlSum').textContent.length > 0, null, { timeout: 60000 });
  console.log('list:', await p.locator('#xlSum').innerText());
  await p.click('#xlCancel');
  // 3) Excel以外
  await drop([S + '/in/12345-67890.pdf'], '#xlDrop'); await p.waitForFunction(() => /落としてください/.test(document.getElementById('xlMsg').textContent));
  console.log('not excel:', await p.locator('#xlMsg').innerText());
  // 4) 2件いっしょ → どちらも資料として登録
  await drop([S + '/かんばん回収.xlsx', S + '/form.xlsx'], '#xlDrop'); await p.waitForFunction(() => /2 件を、PDFに変換/.test(document.getElementById('xlMsg').textContent), null, { timeout: 60000 });
  console.log('2 files:', (await p.locator('#xlMsg').innerText()).replace(/\n/g, ' / '), '| keys', await keys());
  // 5) 写真の枠に落とした時は、今までどおり写真になる
  await drop([S + '/ph1.jpg'], '#tplDrop'); await p.waitForFunction(() => TPL.imgs.length === 1, null, { timeout: 20000 }); console.log('photo drop still works:', await p.evaluate(() => TPL.imgs.length));
  console.log('pageerrors:', errs.length ? errs : 'none'); await b.close();
})();
