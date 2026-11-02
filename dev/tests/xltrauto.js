// Excel一覧の取り込み画面：「空の翻訳を自動で入れる」（オンラインのとき）。同じ行は1回でまとめて翻訳／行数がずれたら1行ずつ／すでにある翻訳はそのまま／オフラインは通信しない
const { chromium } = require('playwright'); const S = process.argv[2];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  let mode = 'batch', calls = 0;
  await p.route('https://api.mymemory.translated.net/**', r => {
    calls++; const u = new URL(r.request().url()), q = u.searchParams.get('q'), l = u.searchParams.get('langpair').split('|')[1];
    const txt = mode === 'collapse' ? '[' + l + '] ' + q.replace(/\n/g, ' ') : q.split('\n').map(x => '[' + l + '] ' + x).join('\n');
    r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ responseData: { translatedText: txt }, responseStatus: 200 }) });
  });
  await p.goto('file://' + S + '/../../dist/ポイント照合ツール.html'); await p.waitForFunction(() => /登録済み/.test(document.getElementById('startNote').textContent)); await p.click('.langBtn[data-lang=ja]');
  await p.click('.tab[data-v=set]'); for (const k of '0000') await p.click(`#pinPad button:text-is("${k}")`); await p.click('#pinOk');
  const load = async () => { await p.setInputFiles('#xlIn', S + '/list.xlsx'); await p.waitForFunction(() => document.getElementById('xlSum').textContent.length > 0, null, { timeout: 60000 }); };
  const state = () => p.evaluate(() => XL.rows.filter(r => !r.err).map(r => r.pn + ':' + TRL.filter(l => r.tr[l]).length + '/' + r.pts.length + '行'));
  await load(); console.log('取り込み直後:', await state(), '| 表の列:', (await p.locator('#xlTbl th').allInnerTexts()).join(','));
  // 1つだけ先に翻訳を入れておく → そこは変わらない
  await p.evaluate(() => { XL.rows.find(r => !r.err).tr.en = 'MY ENGLISH'; });
  await p.click('#xlTrAuto'); await p.waitForFunction(() => /翻訳を入れました/.test(document.getElementById('xlMsg').textContent), null, { timeout: 30000 });
  console.log('まとめて翻訳:', await state(), '| 通信', calls, '| 先に入れた英語:', await p.evaluate(() => XL.rows.find(r => !r.err).tr.en), '|', (await p.locator('#xlMsg').innerText()));
  console.log('2行目の英語:', JSON.stringify(await p.evaluate(() => XL.rows.filter(r => !r.err)[1].tr.en)));
  // 全部入っているとき
  await p.click('#xlTrAuto'); console.log('もう空がない:', (await p.locator('#xlMsg').innerText()));
  // 行数がずれる翻訳サービス → 1行ずつにやり直す
  mode = 'collapse'; calls = 0; await load(); await p.click('#xlTrAuto'); await p.waitForFunction(() => /翻訳を入れました/.test(document.getElementById('xlMsg').textContent), null, { timeout: 30000 });
  console.log('1行ずつ:', await state(), '| 通信', calls, '| 行数', JSON.stringify(await p.evaluate(() => XL.rows.filter(r => !r.err)[0].tr.en.split('\n').length + '行 / ポイント' + XL.rows.filter(r => !r.err)[0].pts.length + '行')));
  // 登録すると翻訳が保存される
  await p.click('#xlGo'); await p.waitForFunction(() => Object.keys(PDF_INDEX).length >= 1, null, { timeout: 60000 }); await p.waitForTimeout(500);
  console.log('保存された翻訳:', await p.evaluate(async () => { const r = await getPdf(Object.keys(PDF_INDEX)[0]); return Object.keys(r.src.tr).filter(k => r.src.tr[k]).length + '言語'; }));
  // オフライン
  await load(); await ctx.setOffline(true); calls = 0; await p.click('#xlTrAuto'); console.log('オフライン:', (await p.locator('#xlMsg').innerText()), '| 通信', calls);
  console.log('pageerrors:', errs.length ? errs : 'none'); await b.close();
})();
