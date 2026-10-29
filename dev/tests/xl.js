// Excelの一覧から、まとめてポイント表を作る
const { chromium } = require('playwright'); const S = process.argv[2];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + S + '/../../dist/ポイント表照合.html');
  await p.waitForFunction(() => /登録済み/.test(document.getElementById('startNote').textContent)); await p.click('.langBtn[data-lang=ja]');
  await p.click('.tab[data-v=set]'); for (const k of '0000') await p.click(`#pinPad button:text-is("${k}")`); await p.click('#pinOk');
  const keys = () => p.evaluate(() => Object.keys(PDF_INDEX).sort().join(','));
  // 古い形式・壊れたファイル
  const fs = require('fs'), os = require('os'), path = require('path'); const bad = path.join(os.tmpdir(), 'bad.xlsx'); fs.writeFileSync(bad, 'hello');
  await p.setInputFiles('#xlIn', bad); await p.waitForFunction(() => /読めませんでした/.test(document.getElementById('xlMsg').textContent)); console.log('broken file:', await p.locator('#xlMsg').innerText());
  await p.evaluate(() => { document.getElementById('xlIn').value = ''; });
  await p.setInputFiles('#xlIn', S + '/list.xlsx'); await p.waitForFunction(() => document.getElementById('xlSum').textContent.length > 0);
  console.log('summary:', await p.locator('#xlSum').innerText());
  console.log(await p.locator('#xlTbl tr').evaluateAll(trs => trs.map(t => [...t.children].map(c => c.innerText.replace(/\s+/g, ' ')).join(' | ')).join('\n')));
  await p.locator('#xlCard').scrollIntoViewIfNeeded(); await p.screenshot({ path: S + '/xl.png' });
  await p.click('#xlGo'); await p.waitForFunction(() => /登録しました：/.test(document.getElementById('xlMsg').textContent), null, { timeout: 60000 });
  console.log('done:', await p.locator('#xlMsg').innerText(), '| keys', await keys());
  const info = await p.evaluate(async () => { const r = await getPdf('7184201000W'), q = await getPdf('1234567890'), z = await getPdf('5555566666'); return { photos: r.src.photos.length, tr: r.src.tr.en, pts: r.src.pts, q: q.src.pts, qphotos: q.src.photos.length, z: z.src.photos.length, pdf: String.fromCharCode(...new Uint8Array(r.data.slice(0, 5))) }; });
  console.log('rec:', JSON.stringify(info));
  // 照合：英語にすると翻訳が出る
  await p.click('.tab[data-v=check]'); await p.evaluate(() => { CF.lang = 'en'; LANG = 'en'; applyLang(); });
  await p.evaluate(() => onScan('SIMPR-A0347 827184201000①60⃣0⃣2②0⃣260⃣4⑬380⃣8➂0⃣500⃣0⃣0⃣20⑩10①2,718－42010－00Ｗ.000000.000000．000000000.000')); await p.waitForTimeout(1500);
  console.log('scan:', await p.textContent('#jBig'), '| trans:', await p.evaluate(() => document.getElementById('ptTrans').innerText.replace(/\s+/g, ' ')));
  await p.screenshot({ path: S + '/xl_check.png' });
  // 同じ一覧をもう一度 → 上書き
  await p.evaluate(() => { CF.lang = 'ja'; LANG = 'ja'; applyLang(); }); await p.click('.tab[data-v=set]'); if (await p.locator('#pinPad').isVisible()) { for (const k of '0000') await p.click(`#pinPad button:text-is("${k}")`); await p.click('#pinOk'); }
  await p.evaluate(() => { document.getElementById('xlIn').value = ''; }); await p.setInputFiles('#xlIn', S + '/list.xlsx'); await p.waitForFunction(() => document.getElementById('xlSum').textContent.length > 0);
  console.log('again:', await p.locator('#xlSum').innerText());
  p.once('dialog', d => { console.log('confirm:', d.message()); d.accept(); }); await p.click('#xlGo'); await p.waitForFunction(() => /上書き 3/.test(document.getElementById('xlMsg').textContent), null, { timeout: 60000 });
  console.log('after again keys', await keys(), '| pageerrors:', errs.length ? errs : 'none');
  await b.close();
})();
