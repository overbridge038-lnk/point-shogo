// Excel(.xlsx)をそのまま登録して、資料名（ファイル名）のQRで開く
const { chromium } = require('playwright'); const S = process.argv[2]; const fs = require('fs'); const os = require('os'); const path = require('path');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + S + '/../../dist/ポイント表照合.html');
  await p.waitForFunction(() => /登録済み/.test(document.getElementById('startNote').textContent)); await p.click('.langBtn[data-lang=ja]');
  const pin = async () => { if (await p.locator('#pinPad').isVisible()) { for (const k of '0000') await p.click(`#pinPad button:text-is("${k}")`); await p.click('#pinOk'); } };
  await p.click('.tab[data-v=pdf]'); await pin();
  const bad = path.join(os.tmpdir(), 'broken.xlsx'); fs.writeFileSync(bad, 'PKxx not a real excel');
  await p.setInputFiles('#fileIn', [S + '/かんばん回収.xlsx', S + '/in/12345-67890.pdf', bad]);
  await p.waitForFunction(() => /取込完了/.test(document.getElementById('impMsg').textContent));
  console.log('import:', (await p.locator('#impMsg').innerText()).replace(/\n/g, ' / '));
  console.log('keys:', await p.evaluate(() => Object.keys(PDF_INDEX).join(' | ')), '| kinds:', await p.evaluate(() => Object.values(PDF_INDEX).map(v => v.kind || 'pdf').join(',')));
  console.log('card buttons (xlsx):', await p.locator('#pdfList .pcard', { hasText: 'かんばん回収' }).locator('button').allInnerTexts());
  await p.screenshot({ path: S + '/xlview_list.png' });
  // プレビュー
  await p.locator('#pdfList .pcard', { hasText: 'かんばん回収' }).locator('[data-view]').first().click(); await p.waitForSelector('#pvBody .xlwrap'); await p.waitForTimeout(500);
  await p.screenshot({ path: S + '/xlview_preview.png' }); await p.click('#pvClose').catch(() => {}); await p.keyboard.press('Escape');
  // 照合：資料名のQR
  await p.evaluate(() => { document.getElementById('pview').classList.remove('on'); });
  await p.click('.tab[data-v=check]'); await p.evaluate(() => onScan('かんばん回収')); await p.waitForSelector('#pdfbox .xlwrap', { timeout: 20000 }); await p.waitForTimeout(800);
  console.log('scan かんばん回収:', await p.textContent('#jBig'), '|', await p.textContent('#pdfName'), '| zoom label', await p.textContent('#zLbl'));
  await p.screenshot({ path: S + '/xlview_check.png' });
  await p.click('#zIn'); await p.waitForTimeout(200); console.log('zoom in:', await p.textContent('#zLbl'), 'css zoom', await p.evaluate(() => document.querySelector('#pdfbox .xlwrap').style.zoom));
  await p.click('#zFit');
  await p.evaluate(() => onScan('12345-67890')); await p.waitForTimeout(1500); console.log('scan pdf still works:', await p.textContent('#jBig'), '| canvas', await p.locator('#pdfbox canvas').count());
  // 受け渡し（書き出し→別の台に取り込み）でも Excel のまま
  await p.click('.tab[data-v=set]'); await pin();
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#pkOut')]); const pack = path.join(os.tmpdir(), 'xl_pack.ptpack'); await dl.saveAs(pack);
  const ctx2 = await b.newContext({ viewport: { width: 1280, height: 800 } }); const q = await ctx2.newPage();
  await q.goto('file://' + S + '/../../dist/ポイント表照合.html'); await q.waitForFunction(() => /登録済み/.test(document.getElementById('startNote').textContent)); await q.click('.langBtn[data-lang=ja]');
  await q.click('.tab[data-v=set]'); for (const k of '0000') await q.click(`#pinPad button:text-is("${k}")`); await q.click('#pinOk');
  await q.setInputFiles('#pkIn', pack); await q.waitForFunction(() => document.getElementById('pkPrev').textContent.length > 0); await q.click('#pkApply'); await q.waitForTimeout(800);
  await q.click('.tab[data-v=check]'); await q.evaluate(() => onScan('かんばん回収')); await q.waitForSelector('#pdfbox .xlwrap', { timeout: 20000 });
  console.log('other tablet after import:', await q.textContent('#jBig'), '| kind', await q.evaluate(async () => (await getPdf(norm('かんばん回収'))).kind));
  console.log('pageerrors:', errs.length ? errs : 'none');
  await b.close();
})();
