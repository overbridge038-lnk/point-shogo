// 同じ読み取りに複数のポイント表が当たった時、どれを使うか選べる
const { chromium } = require('playwright'); const S = process.argv[2]; const fs = require('fs'); const os = require('os'); const path = require('path');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + S + '/../../dist/ポイント表照合.html'); await p.waitForFunction(() => /登録済み/.test(document.getElementById('startNote').textContent)); await p.click('.langBtn[data-lang=ja]');
  await p.click('.tab[data-v=pdf]'); for (const k of '0000') await p.click(`#pinPad button:text-is("${k}")`); await p.click('#pinOk');
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'pick')); const src = fs.readFileSync(S + '/in/12345-67890.pdf'), other = fs.readFileSync(S + '/in/23456-78901.pdf');
  fs.writeFileSync(d + '/17850-V1010,A0AK.pdf', src); fs.writeFileSync(d + '/17850-V1010,A0AK - コピー.pdf', src); fs.writeFileSync(d + '/17850-V1010,B999.pdf', other);
  await p.setInputFiles('#fileIn', fs.readdirSync(d).map(f => d + '/' + f)); await p.waitForFunction(() => /取込完了/.test(document.getElementById('impMsg').textContent));
  console.log('keys:', await p.evaluate(() => Object.keys(PDF_INDEX).join(' | ')));
  await p.click('.tab[data-v=check]');
  const shown = () => p.evaluate(() => document.getElementById('pick').classList.contains('on'));
  // 1) 品番だけ読む → 3件当たる → 選ぶ画面
  await p.evaluate(() => { onScan('17850-V1010'); }); await p.waitForFunction(() => document.getElementById('pick').classList.contains('on'));
  console.log('chooser shown:', await shown(), '| NG screen:', await p.evaluate(() => document.getElementById('ng').classList.contains('on')), '| judge:', await p.textContent('#jBig'));
  console.log('cards:', await p.locator('#pickGrid .pcard').evaluateAll(cs => cs.map(c => c.querySelector('.mono').textContent + ' [' + c.className.replace('pcard ', '') + '] ' + c.querySelector('.badge').textContent).join(' || ')));
  await p.screenshot({ path: S + '/pick.png' });
  // 2) 1つ選ぶ → OK でそのPDFが開く
  await p.locator('#pickGrid .pcard', { hasText: 'コピー' }).locator('button.pri').click();
  await p.waitForFunction(() => document.getElementById('jBig').textContent === 'OK', null, { timeout: 30000 });
  console.log('chosen:', await p.textContent('#pdfName'), '| chooser closed:', !(await shown()));
  console.log('log reason:', await p.evaluate(async () => { const rows = await new Promise(r => { const q = DB.transaction('logs').objectStore('logs').getAll(); q.onsuccess = () => r(q.result); }); const x = rows[rows.length - 1]; return x.result + ' / ' + x.reason + ' / ' + x.pdf; }));
  // 3) やめる → NG で止まる
  await p.evaluate(() => { onScan('17850-V1010'); }); await p.waitForFunction(() => document.getElementById('pick').classList.contains('on'));
  await p.click('#pickCancel'); await p.waitForFunction(() => document.getElementById('ng').classList.contains('on'));
  console.log('cancel -> NG:', await p.textContent('#ngWhy'));
  for (const k of '1234') await p.click(`#pad button:text-is("${k}")`); await p.click('#pad button:text-is("OK")'); await p.waitForTimeout(300);
  // 3.5) 背番だけ（a0ak）：元とコピーが当たるので、NGにもOKにもせず、選ばせる（コピーは名前が「 - コピー」で別の名前に見えても）
  await p.evaluate(() => { onScan('a0ak'); }); await p.waitForFunction(() => document.getElementById('pick').classList.contains('on'));
  console.log('a0ak chooser:', await p.locator('#pickGrid .pcard .mono').allInnerTexts()); await p.click('#pickCancel'); await p.waitForFunction(() => document.getElementById('ng').classList.contains('on'));
  for (const k of '1234') await p.click(`#pad button:text-is("${k}")`); await p.click('#pad button:text-is("OK")'); await p.waitForTimeout(300);
  // 3.6) コピーがある単独の名前（99999-11111 と 99999-11111 (1)）
  await p.click('.tab[data-v=pdf]'); if (await p.locator('#pinPad').isVisible()) { for (const k of '0000') await p.click(`#pinPad button:text-is("${k}")`); await p.click('#pinOk'); } await p.setInputFiles('#fileIn', [{ name: '99999-11111.pdf', mimeType: 'application/pdf', buffer: src }, { name: '99999-11111 (1).pdf', mimeType: 'application/pdf', buffer: src }]);
  await p.waitForFunction(() => Object.keys(PDF_INDEX).length === 5); await p.click('.tab[data-v=check]');
  await p.evaluate(() => { onScan('99999-11111'); }); await p.waitForFunction(() => document.getElementById('pick').classList.contains('on'));
  console.log('single name + (1) copy chooser:', await p.locator('#pickGrid .pcard .mono').allInnerTexts()); await p.click('#pickCancel'); await p.waitForFunction(() => document.getElementById('ng').classList.contains('on'));
  for (const k of '1234') await p.click(`#pad button:text-is("${k}")`); await p.click('#pad button:text-is("OK")'); await p.waitForTimeout(300);
  // 4) 1つに決まる読み取りは、選ばずにそのまま OK
  await p.evaluate(() => onScan('17850-V1010,B999')); await p.waitForFunction(() => document.getElementById('jBig').textContent === 'OK', null, { timeout: 30000 });
  console.log('single match:', await p.textContent('#pdfName'), '| chooser shown:', await shown());
  console.log('pageerrors:', errs.length ? errs : 'none'); await b.close();
})();
