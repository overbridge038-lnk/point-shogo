// 工程：同じ品番でも工程ごとに別の表（名前は 品番【工程】）。かんばんを読んで工程が2つ以上あれば、作業者が選ぶ。工程は設定の「工程の一覧」から選ぶ
const { chromium } = require('playwright'); const S = process.argv[2];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined }); const p = await (await b.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('file://' + S + '/../../dist/ポイント照合ツール.html'); await p.waitForFunction(() => /登録済み/.test(document.getElementById('startNote').textContent)); await p.click('.langBtn[data-lang=ja]');
  const pin = async c => { for (const k of c) await p.click(`#pinPad button:text-is("${k}")`); await p.click('#pinOk'); };
  await p.click('.tab[data-v=set]'); await pin('0000');
  console.log('工程の一覧（初期）:', JSON.stringify(await p.inputValue('#cfProcs')), '| 選択肢:', (await p.locator('#tplPr option').allInnerTexts()).join(','));
  const make = async (pn, pr) => {
    await p.setInputFiles('#tplPhotoIn', S + '/partimg-000.jpg'); await p.waitForTimeout(500);
    await p.fill('#tplPn', pn); await p.fill('#tplQty', '60'); await p.selectOption('#tplPr', pr); await p.fill('#tplPts', pr ? pr + 'のポイント' : 'ポイント');
    await p.click('#tplSave'); await p.waitForFunction(() => /登録しました|上書き/.test(document.getElementById('tplMsg').textContent), null, { timeout: 20000 });
  };
  await make('16611-10040,4078', '掛け置き'); await make('16611-10040,4078', '検査'); await make('99999-11111', '');
  console.log('登録:', await p.evaluate(() => Object.values(PDF_INDEX).map(v => v.name).sort().join(' / ')));
  await p.click('.tab[data-v=check]'); await p.waitForTimeout(200);
  // 品番だけ読む → 工程を選ぶ画面 → 検査
  await p.evaluate(() => { onScan('16611-10040'); }); await p.waitForFunction(() => document.getElementById('pick').classList.contains('on'), null, { timeout: 10000 });
  console.log('選ぶ画面:', (await p.locator('#pickGrid .pcard .mono').allInnerTexts()).join(' / '));
  await p.locator('#pickGrid .pcard', { hasText: '検査' }).locator('button.pri').click();
  await p.waitForFunction(() => document.getElementById('jBig').textContent === 'OK', null, { timeout: 20000 });
  console.log('OK:', await p.locator('#pdfName').innerText());
  await p.screenshot({ path: S + '/process_ok.png' });
  // 長いQR（品番と番号が入っている）→ 選ぶ画面 → やめる → NG
  await p.evaluate(() => { onScan('XXA0U0P16611-10040Q60P4078ZZ'); }); await p.waitForFunction(() => document.getElementById('pick').classList.contains('on'), null, { timeout: 10000 });
  console.log('長いQRの選ぶ画面:', (await p.locator('#pickGrid .pcard .mono').allInnerTexts()).join(' / '));
  await p.click('#pickCancel'); await p.waitForFunction(() => document.getElementById('ng').classList.contains('on')); console.log('選ばない→NG');
  for (const k of ['1', '2', '3', '4', 'OK']) await p.click(`#pad button:text-is("${k}")`); await p.waitForTimeout(300);
  // 工程なしの表は、選ばずにOK
  await p.evaluate(() => { onScan('99999-11111'); }); await p.waitForFunction(() => document.getElementById('jBig').textContent === 'OK', null, { timeout: 20000 });
  console.log('工程なし:', await p.locator('#pdfName').innerText(), '| 選ぶ画面なし', await p.evaluate(() => !document.getElementById('pick').classList.contains('on')));
  // Excelの一覧（「工程」の列）：一覧にない工程はエラー
  await p.click('.tab[data-v=set]'); if (await p.locator('#pinPad').isVisible()) await pin('0000'); await p.setInputFiles('#xlIn', S + '/procs.xlsx'); await p.waitForFunction(() => document.getElementById('xlSum').textContent.length > 0, null, { timeout: 60000 });
  console.log('Excel:', await p.evaluate(() => XL.rows.map(r => r.pn + (r.pr ? '【' + r.pr + '】' : '') + '=' + (r.err ? t(r.err).slice(0, 12) : 'OK')).join(' / ')));
  await p.click('#xlGo'); await p.waitForFunction(() => /登録しました|件/.test(document.getElementById('xlMsg').textContent) && !XL, null, { timeout: 60000 });
  console.log('Excelから登録:', await p.evaluate(() => Object.values(PDF_INDEX).map(v => v.name).filter(n => /55555/.test(n)).sort().join(' / ')));
  // 編集すると工程が戻る
  await p.evaluate(() => editPdf(Object.keys(PDF_INDEX).find(k => /検査/.test(k) && /16611/.test(k)))); await p.waitForTimeout(800);
  console.log('編集で工程:', await p.inputValue('#tplPr'));
  // Excelに書き出すと「工程」の列が入り、読み戻せる
  const back = await p.evaluate(async () => { const list = []; for (const k of Object.keys(PDF_INDEX)) { const r = await getPdf(k); if (r.src) list.push({ pn: r.src.pn, qty: r.src.qty, pr: r.src.pr || '', pts: String(r.src.pts).split('\n'), tr: {}, photos: [] }); } const bl = await xlExport(list); const x = await xlRead(await bl.arrayBuffer()); return x.rows.map(r => r.pn + (r.pr ? '【' + r.pr + '】' : '')).sort().join(' / '); });
  console.log('書き出し→読み戻し:', back);
  console.log('pageerrors:', errs.length ? errs : 'none'); await b.close();
})();
