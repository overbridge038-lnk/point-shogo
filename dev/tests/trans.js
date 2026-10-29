// ポイントの翻訳：登録時に3言語の文を入れる → 言語を切り替えると照合画面のPDFの上に出る → 一式の受け渡しでも残る
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
  const openSet = async p => { await p.click('.tab[data-v=set]'); if (await p.locator('#pinPad').isVisible()) await pin(p, '0000'); };
  const panel = p => p.evaluate(() => { var e = document.getElementById('ptTrans'); return e.hidden ? '(非表示)' : e.innerText.replace(/\s+/g, ' ').trim(); });

  const A = await tablet(); await openSet(A);
  await A.setInputFiles('#tplPhotoIn', [S + '/ph1.jpg']); await A.waitForFunction(() => TPL.imgs.length === 1);
  await A.fill('#tplPn', '74043-60020'); await A.fill('#tplQty', '20'); await A.fill('#tplPts', '向きを確認\nキズなし');
  await A.locator('#tplTrBox summary').click();
  await A.fill('#tplTr_en', 'Check the direction\nNo scratches'); await A.fill('#tplTr_id', 'Cek arah'); // 行数ちがい（警告）
  console.log('warn:', await A.locator('#tplTrMsg').innerText());
  await A.fill('#tplTr_id', 'Cek arah\nTidak ada goresan'); await A.fill('#tplTr_tl', 'Tingnan ang direksyon\nWalang gasgas');
  console.log('warn cleared:', JSON.stringify(await A.locator('#tplTrMsg').innerText()));
  await A.click('#tplSave'); await A.waitForFunction(() => /登録しました/.test(document.getElementById('tplMsg').textContent), null, { timeout: 30000 });
  // 日本語：翻訳は出ない
  await A.click('.tab[data-v=check]'); await A.evaluate(() => onScan('74043-60020')); await A.waitForFunction(() => document.getElementById('jBig').textContent === 'OK', null, { timeout: 30000 });
  console.log('ja  :', await panel(A));
  // 言語を切り替え（ヘッダーの言語ボタン）
  for (const [lg, label] of [['en', 'English'], ['id', 'Bahasa Indonesia'], ['tl', 'Tagalog']]) {
    await A.evaluate(l => { CF.lang = l; LANG = l; applyLang(); }, lg); await A.waitForTimeout(200);
    console.log(lg + '  :', await panel(A));
  }
  await A.evaluate(() => { CF.lang = 'en'; LANG = 'en'; applyLang(); });
  await A.screenshot({ path: S + '/trans.png' });
  // 受け渡し：もう1台でも翻訳が出る
  await A.evaluate(() => { CF.lang = 'ja'; LANG = 'ja'; applyLang(); });
  await openSet(A);
  const [dl] = await Promise.all([A.waitForEvent('download'), A.click('#pkOut')]);
  const pack = path.join(os.tmpdir(), 'trans_test.ptpack'); await dl.saveAs(pack);
  const B = await tablet(); await openSet(B);
  await B.setInputFiles('#pkIn', pack); await B.waitForFunction(() => document.getElementById('pkPrev').textContent.length > 0);
  await B.click('#pkApply'); await B.waitForFunction(() => Object.keys(PDF_INDEX).length === 1, null, { timeout: 30000 });
  await B.evaluate(() => { CF.lang = 'tl'; LANG = 'tl'; applyLang(); });
  await B.click('.tab[data-v=check]'); await B.evaluate(() => onScan('74043-60020')); await B.waitForFunction(() => document.getElementById('jBig').textContent === 'OK', null, { timeout: 30000 });
  console.log('B tl :', await panel(B));
  // 編集で翻訳が戻る
  await B.evaluate(() => { CF.lang = 'ja'; LANG = 'ja'; applyLang(); });
  await B.evaluate(() => editPdf('7404360020')); await B.waitForFunction(() => document.getElementById('tplTr_en').value.length > 0, null, { timeout: 30000 });
  console.log('edit restore en:', JSON.stringify(await B.inputValue('#tplTr_en')));
  console.log('pageerrors:', errs.length ? errs : 'none');
  await b.close();
})();
