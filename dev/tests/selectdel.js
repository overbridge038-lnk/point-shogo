// 登録済みの表を、まとめて選んで削除する
const { chromium } = require('playwright'); const S = process.argv[2]; const fs = require('fs');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined }); const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + S + '/../../dist/ポイント照合ツール.html'); await p.waitForFunction(() => /登録済み/.test(document.getElementById('startNote').textContent)); await p.click('.langBtn[data-lang=ja]');
  const pin = async c => { for (const k of c) await p.click(`#pinPad button:text-is("${k}")`); await p.click('#pinOk'); };
  await p.click('.tab[data-v=pdf]'); if (await p.locator('#pinPad').isVisible()) await pin('0000');
  const dir = S + '/in', fs_ = fs.readdirSync(dir).filter(x => /\.pdf$/i.test(x)).map(x => dir + '/' + x);
  await p.setInputFiles('#fileIn', fs_); await p.waitForFunction(() => /取込完了/.test(document.getElementById('impMsg').textContent));
  const n0 = await p.evaluate(() => Object.keys(PDF_INDEX).length); console.log('登録', n0);
  await p.click('#selMode'); await p.waitForTimeout(200);
  const btn0 = await p.locator('#selDel').innerText(); console.log('削除ボタン(0件):', btn0, await p.locator('#selDel').isDisabled());
  const cards = p.locator('#pdfList .pcard'); await cards.nth(0).click(); await cards.nth(1).click();
  console.log('2件選ぶ:', await p.locator('#selDel').innerText(), '| picked', await p.locator('#pdfList .pcard.picked').count());
  await cards.nth(1).click(); console.log('1件外す:', await p.locator('#selDel').innerText());
  await p.click('#selAll'); console.log('すべて選ぶ:', await p.locator('#selDel').innerText());
  await p.click('#selNone'); await cards.nth(0).click(); await cards.nth(2).click();
  let msg = ''; p.once('dialog', async d => { msg = d.message(); await d.accept(); });
  const gone = await p.evaluate(() => Object.keys(PDF_INDEX).sort().filter((k, i) => i === 0 || i === 2));
  await p.click('#selDel'); await p.waitForTimeout(1200);
  const n1 = await p.evaluate(() => Object.keys(PDF_INDEX)); console.log('確認文:', msg.split('\n').slice(0, 5).join(' / '));
  console.log('削除後', n1.length, '消えた?', gone.every(k => !n1.includes(k)), '| モード終了', await p.evaluate(() => !SEL.on && document.getElementById('selMode').offsetParent !== null));
  console.log('pageerrors:', errs.length ? errs : 'none'); await b.close();
  const ok = n0 >= 3 && n1.length === n0 - 2 && gone.every(k => !n1.includes(k)); console.log('selectdel', ok ? 'OK' : 'NG'); if (!ok) process.exit(1);
})();
