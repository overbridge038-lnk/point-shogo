// 自動翻訳ボタン：オンライン=翻訳サービス（テストでは偽物）で3言語に入る／オフライン=入らない／失敗=何も変えない
const { chromium } = require('playwright'); const S = process.argv[2];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  let mode = 'ok', calls = 0;
  await p.route('https://api.mymemory.translated.net/**', r => {
    calls++; const u = new URL(r.request().url()), q = u.searchParams.get('q'), lp = u.searchParams.get('langpair');
    if (mode === 'fail') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ responseData: { translatedText: 'MYMEMORY WARNING: QUOTA' }, responseStatus: 429 }) });
    r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ responseData: { translatedText: '[' + lp.split('|')[1] + '] ' + q + ' it&#39;s' }, responseStatus: 200 }) });
  });
  await p.goto('file://' + S + '/../../dist/ポイント表照合.html');
  await p.waitForFunction(() => /登録済み/.test(document.getElementById('startNote').textContent)); await p.click('.langBtn[data-lang=ja]');
  await p.click('.tab[data-v=set]'); for (const k of '0000') await p.click(`#pinPad button:text-is("${k}")`); await p.click('#pinOk');
  await p.locator('#tplTrBox summary').click();
  const v = id => p.inputValue(id);
  // 日本語が空
  await p.click('#tplTrAuto'); console.log('no jp:', await p.locator('#tplTrMsg').innerText());
  await p.fill('#tplPts', '向きを確認\nキズなし');
  // オンライン
  await p.click('#tplTrAuto'); await p.waitForFunction(() => /自動翻訳を入れました/.test(document.getElementById('tplTrMsg').textContent));
  console.log('en:', JSON.stringify(await v('#tplTr_en')), '| id:', JSON.stringify(await v('#tplTr_id')), '| tl:', JSON.stringify(await v('#tplTr_tl')), '| calls', calls);
  // 失敗：何も変えない（上書き確認はOK）
  mode = 'fail'; p.once('dialog', d => d.accept()); await p.fill('#tplPts', '向きを確認\n刻印を確認');
  await p.click('#tplTrAuto'); await p.waitForFunction(() => /翻訳できませんでした/.test(document.getElementById('tplTrMsg').textContent));
  console.log('fail keeps en:', JSON.stringify(await v('#tplTr_en')));
  // オフライン：通信しない
  await ctx.setOffline(true); const before = calls; await p.evaluate(() => { document.getElementById('tplTrMsg').textContent = ''; });
  await p.click('#tplTrAuto'); console.log('offline:', await p.locator('#tplTrMsg').innerText(), '| extra calls', calls - before);
  console.log('pageerrors:', errs.length ? errs : 'none');
  await b.close();
})();
