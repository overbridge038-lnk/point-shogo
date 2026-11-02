// PCで作る用のひな形：アプリからダウンロードできる／ひな形（翻訳10言語の入力例つき）をそのまま取り込める／自動翻訳版を取り込んでもエラーにならない
const { chromium } = require('playwright'); const S = process.argv[2]; const fs = require('fs'); const path = require('path');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('file://' + S + '/../../dist/ポイント照合ツール.html'); await p.waitForFunction(() => /登録済み/.test(document.getElementById('startNote').textContent)); await p.click('.langBtn[data-lang=ja]');
  await p.click('.tab[data-v=set]'); for (const k of '0000') await p.click(`#pinPad button:text-is("${k}")`); await p.click('#pinOk');
  const SM = path.join(S, '..', '..', 'sample');
  for (const [id, f] of [['xlTpl1', 'ポイント表一覧_ひな形.xlsx'], ['xlTpl2', 'ポイント表一覧_ひな形（自動翻訳）.xlsx']]) {
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#' + id)]); const tmp = path.join(require('os').tmpdir(), 'dl_' + Date.now() + '.xlsx'); await dl.saveAs(tmp);
    console.log(id, dl.suggestedFilename(), '| 元のひな形と同じ:', Buffer.compare(fs.readFileSync(tmp), fs.readFileSync(path.join(SM, f))) === 0);
    console.log('  案内の画面:', await p.evaluate(() => document.getElementById('gdView').classList.contains('on')), '|', (await p.locator('#gdView .gdSt').allInnerTexts()).length + '個の手順'); if (id === 'xlTpl1') await p.screenshot({ path: S + '/gd_screen.png' }); await p.click('#gdClose'); console.log('  閉じた:', await p.evaluate(() => !document.getElementById('gdView').classList.contains('on')));
  }
  // ひな形そのもの → 取り込める（入力例の1行）
  await p.setInputFiles('#xlIn', path.join(SM, 'ポイント表一覧_ひな形.xlsx')); await p.waitForFunction(() => document.getElementById('xlSum').textContent.length > 0, null, { timeout: 60000 });
  console.log('ひな形:', (await p.locator('#xlSum').innerText()).replace(/\n/g, ' / ')); await p.click('#xlGo'); await p.waitForFunction(() => /登録しました|Registered|登録済み/.test(document.getElementById('xlMsg').textContent) && Object.keys(PDF_INDEX).length === 1, null, { timeout: 60000 });
  console.log('登録された翻訳:', await p.evaluate(async () => { const r = await getPdf(Object.keys(PDF_INDEX)[0]); return Object.keys(r.src.tr).filter(k => r.src.tr[k]).join(',') + ' | ポイント ' + r.src.pts.split('\n').length + '行 | 英語の行数 ' + r.src.tr.en.split('\n').length; }));
  // 自動翻訳版：Excelで開いたまま（式の結果が空）でも、取り込める（翻訳は空）
  await p.setInputFiles('#xlIn', path.join(SM, 'ポイント表一覧_ひな形（自動翻訳）.xlsx')); await p.waitForFunction(() => document.getElementById('xlSum').textContent.length > 0, null, { timeout: 60000 });
  console.log('自動翻訳版:', (await p.locator('#xlSum').innerText()).replace(/\n/g, ' / '));
  console.log('pageerrors:', errs.length ? errs : 'none'); await b.close();
})();
