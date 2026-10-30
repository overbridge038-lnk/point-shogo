// 古い形式（.xls）を選んだとき、理由が出る（登録タブ）。選ぶ画面の設定にExcelの形式名が入っている
const { chromium } = require('playwright'); const S = process.argv[2];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + S + '/../../dist/ポイント表照合.html'); await p.waitForFunction(() => /登録済み/.test(document.getElementById('startNote').textContent)); await p.click('.langBtn[data-lang=ja]');
  console.log('accept has xlsx mime:', await p.evaluate(() => /spreadsheetml\.sheet/.test(document.getElementById('fileIn').accept) && /spreadsheetml\.sheet/.test(document.getElementById('xlIn').accept)));
  await p.click('.tab[data-v=pdf]'); for (const k of '0000') await p.click(`#pinPad button:text-is("${k}")`); await p.click('#pinOk');
  await p.setInputFiles('#fileIn', [{ name: '旧形式.xls', mimeType: 'application/vnd.ms-excel', buffer: Buffer.from('dummy') }]); await p.waitForFunction(() => /xls/.test(document.getElementById('impMsg').textContent));
  console.log('xls:', (await p.locator('#impMsg').innerText()).replace(/\n/g, ' / '), '| registered', await p.evaluate(() => Object.keys(PDF_INDEX).length));
  await p.setInputFiles('#fileIn', [{ name: '新形式.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: require('fs').readFileSync(S + '/かんばん回収.xlsx') }]); await p.waitForFunction(() => /取込完了/.test(document.getElementById('impMsg').textContent), null, { timeout: 30000 });
  console.log('xlsx:', (await p.locator('#impMsg').innerText()).split('\n')[0], '| registered', await p.evaluate(() => Object.keys(PDF_INDEX).length));
  console.log('pageerrors:', errs.length ? errs : 'none'); await b.close();
})();
