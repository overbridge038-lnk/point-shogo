// Excel一覧の自動翻訳：同じ文は1回だけ翻訳する（翻訳サービスの1日の上限対策）。Excelに入っている翻訳も覚えて使う。
// 上限に達したら、入った分は残して知らせ、次に押すと空の所だけ続きから入る。（fixtures/samepts.xlsx は作り物：30行・同じ文4種類）
const { chromium } = require('playwright'); const S = process.argv[2];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  let calls = 0, chars = 0, limit = 1e9;
  await p.route('https://api.mymemory.translated.net/**', r => {
    const u = new URL(r.request().url()), q = u.searchParams.get('q'), l = u.searchParams.get('langpair').split('|')[1];
    if (chars + q.length > limit) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ responseData: { translatedText: 'MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY.' }, responseStatus: 429 }) });
    calls++; chars += q.length;
    r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ responseData: { translatedText: q.split('\n').map(x => '[' + l + '] ' + x).join('\n') }, responseStatus: 200 }) });
  });
  await p.goto('file://' + S + '/../../dist/ポイント照合ツール.html'); await p.waitForFunction(() => /登録済み/.test(document.getElementById('startNote').textContent)); await p.click('.langBtn[data-lang=ja]');
  await p.click('.tab[data-v=set]'); for (const k of '0000') await p.click(`#pinPad button:text-is("${k}")`); await p.click('#pinOk');
  const load = async () => { await p.setInputFiles('#xlIn', S + '/samepts.xlsx'); await p.waitForFunction(() => document.getElementById('xlSum').textContent.length > 0, null, { timeout: 60000 }); };
  const filled = () => p.evaluate(() => XL.rows.filter(r => !r.err).reduce((a, r) => a + TRL.filter(l => r.tr[l]).length, 0) + ' / ' + XL.rows.filter(r => !r.err).length * 10);
  // ① 上限が小さい（日本語で60文字ぶん）→ 途中で止まり、知らせる
  limit = 60; await load(); console.log('行数', await p.evaluate(() => XL.rows.filter(r => !r.err).length), '| 入っている翻訳', await filled());
  await p.click('#xlTrAuto'); await p.waitForFunction(() => /翻訳を入れました/.test(document.getElementById('xlMsg').textContent), null, { timeout: 30000 });
  console.log('上限で止まる:', await filled(), '| 通信', calls, '|', (await p.locator('#xlMsg').innerText()).replace(/\n/g, ' / ').slice(0, 90));
  console.log('Excelの英語を覚えて使った（ポイント3つの15行は、通信なしで英語が入る）:', await p.evaluate(() => XL.rows.filter(r => !r.err && r.tr.en).length), '| 2行目の英語:', JSON.stringify(await p.evaluate(() => XL.rows.filter(r => !r.err)[1].tr.en)));
  // ② 次の日（上限が戻った）にもう一度押す → 空の所だけ、覚えていない文だけ翻訳する
  limit = 1e9; const c0 = calls, ch0 = chars;
  await p.click('#xlTrAuto'); await p.waitForFunction(() => /翻訳を入れました/.test(document.getElementById('xlMsg').textContent) && !document.getElementById('xlTrAuto').disabled, null, { timeout: 30000 });
  console.log('続きから:', await filled(), '| 追加の通信', calls - c0, '| 送った文字', chars - ch0, '(全部を行ごとに送ると約', 30 * 9 * 30, '文字)');
  // ③ 開き直しても、覚えた翻訳は端末に残る（通信なしで全部入る）
  await p.reload(); await p.waitForFunction(() => /登録済み/.test(document.getElementById('startNote').textContent)); await p.click('.langBtn[data-lang=ja]');
  await p.click('.tab[data-v=set]'); for (const k of '0000') await p.click(`#pinPad button:text-is("${k}")`); await p.click('#pinOk');
  const c1 = calls; await load(); await p.click('#xlTrAuto'); await p.waitForFunction(() => /翻訳を入れました/.test(document.getElementById('xlMsg').textContent), null, { timeout: 30000 });
  console.log('開き直し:', await filled(), '| 通信', calls - c1);
  console.log('pageerrors:', errs.length ? errs : 'none'); await b.close();
})();
