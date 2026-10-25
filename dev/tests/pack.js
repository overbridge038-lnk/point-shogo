// ポイント表の受け渡し：親の端末で書き出し → 別の端末（別の保存領域）へ取り込み
const { chromium } = require('playwright'); const S = process.argv[2]; const fs = require('fs'); const os = require('os'); const path = require('path');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const errs = [];
  async function tablet() {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + S + '/../../dist/ポイント表照合.html');
    await p.waitForFunction(() => /登録済み/.test(document.getElementById('startNote').textContent));
    await p.click('.langBtn[data-lang=ja]'); return p;
  }
  const pin = async (p, c) => { for (const k of c) await p.click(`#pinPad button:text-is("${k}")`); await p.click('#pinOk'); };
  const imp = async (p, dir) => {
    await p.click('.tab[data-v=pdf]'); if (await p.locator('#pinPad').isVisible()) await pin(p, '0000');
    await p.setInputFiles('#fileIn', fs.readdirSync(dir).map(f => dir + '/' + f));
    await p.waitForFunction(() => /取込完了/.test(document.getElementById('impMsg').textContent));
  };
  const n = p => p.evaluate(() => Object.keys(PDF_INDEX).length);
  const openSet = async p => { await p.click('.tab[data-v=set]'); if (await p.locator('#pinPad').isVisible()) await pin(p, '0000'); };

  // 親の端末：4件登録して書き出す
  const A = await tablet(); await imp(A, S + '/in'); console.log('A registered', await n(A));
  await openSet(A);
  const [dl] = await Promise.all([A.waitForEvent('download'), A.click('#pkOut')]);
  const pack = path.join(os.tmpdir(), 'pack_test.ptpack'); await dl.saveAs(pack);
  console.log('file name:', dl.suggestedFilename(), '| size>0:', fs.statSync(pack).size > 0);

  // もう1台：古い表（in2 の5件。うち4件は同じ、1件は一式にない）を登録済みの状態
  const B = await tablet(); await imp(B, S + '/in2'); console.log('B before', await n(B));
  await openSet(B);
  // 壊れたファイル
  fs.writeFileSync(path.join(os.tmpdir(), 'bad.ptpack'), 'hello');
  await B.setInputFiles('#pkIn', path.join(os.tmpdir(), 'bad.ptpack')); await B.waitForTimeout(400);
  console.log('bad file box hidden:', await B.evaluate(() => document.getElementById('pkBox').style.display === 'none'));
  // 追加・上書き
  await B.setInputFiles('#pkIn', pack); await B.waitForFunction(() => document.getElementById('pkPrev').textContent.length > 0);
  console.log('merge preview:', await B.locator('#pkPrev').innerText());
  await B.click('#pkApply'); await B.waitForTimeout(600); console.log('B after merge', await n(B));
  // 全部入れ替え（一式にない1件が消える）
  await B.evaluate(() => { document.getElementById('pkIn').value = ''; });
  await B.setInputFiles('#pkIn', pack); await B.waitForFunction(() => document.getElementById('pkPrev').textContent.length > 0);
  await B.selectOption('#pkMode', 'replace'); await B.waitForTimeout(500);
  console.log('replace preview:', await B.locator('#pkPrev').innerText());
  B.once('dialog', d => { console.log('confirm:', d.message()); d.accept(); });
  await B.click('#pkApply'); await B.waitForTimeout(700); console.log('B after replace', await n(B));
  await B.evaluate(() => onScan('12345-67890')); await B.waitForTimeout(600);
  console.log('scan after import OK?', await B.evaluate(() => document.getElementById('jBig').textContent));
  await B.click('.tab[data-v=set]'); await B.locator('#pkCard').scrollIntoViewIfNeeded(); await B.screenshot({ path: S + '/pack.png' });
  console.log('pageerrors:', errs.length ? errs : 'none');
  await b.close();
})();
