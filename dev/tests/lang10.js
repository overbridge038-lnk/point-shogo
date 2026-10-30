// 10言語（日本語・英語・ベトナム語・インドネシア語・ミャンマー語・ネパール語・タガログ語・ベンガル語・モンゴル語・ポルトガル語）
const { chromium } = require('playwright'); const S = process.argv[2]; const LS = ['ja', 'en', 'vi', 'id', 'my', 'ne', 'tl', 'bn', 'mn', 'pt'];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } }); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('file://' + S + '/../../dist/ポイント表照合.html'); await p.waitForFunction(() => /登録済み/.test(document.getElementById('startNote').textContent));
  console.log('開始画面の言語ボタン:', await p.locator('#start .langBtn').count(), '| スクロール不要で全部見える:', await p.evaluate(() => [...document.querySelectorAll('#start .langBtn')].every(b => { const r = b.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; })));
  // 全言語のキーと {置換} がそろっているか
  const bad = await p.evaluate(() => { const o = [], ph = x => (String(x).match(/\{\w+\}/g) || []).sort().join(); for (const l in I18N) for (const k in I18N.ja) { if (!I18N[l][k]) o.push(l + ':' + k + ' なし'); else if (ph(I18N[l][k]) !== ph(I18N.ja[k])) o.push(l + ':' + k + ' {}ちがい'); } for (const l in I18N) for (const k in I18N[l]) if (!(k in I18N.ja)) o.push(l + ':' + k + ' 余分'); return o; });
  console.log('キー・置換の不足:', bad.length ? bad.slice(0, 10) : 'なし', '| 言語数', await p.evaluate(() => Object.keys(I18N).length));
  // 翻訳つきのポイント表を1つ作る（日本語で操作）
  await p.click('.langBtn[data-lang=ja]'); const pin = async c => { for (const k of c) await p.click(`#pinPad button:text-is("${k}")`); await p.click('#pinOk'); };
  await p.click('.tab[data-v=set]'); await pin('0000'); console.log('翻訳の入力欄:', await p.locator('[id^=tplTr_]').count());
  await p.setInputFiles('#tplPhotoIn', S + '/partimg-000.jpg'); await p.waitForTimeout(800);
  await p.fill('#tplPn', '77777-88888'); await p.fill('#tplQty', '8'); await p.fill('#tplPts', '向きを確認\nキズなし');
  await p.click('#tplTrBox summary');
  for (const l of ['en', 'vi', 'id', 'my', 'ne', 'tl', 'bn', 'mn', 'pt']) await p.fill('#tplTr_' + l, l + '-1\n' + l + '-2');
  await p.click('#tplSave'); await p.waitForFunction(() => /登録しました/.test(document.getElementById('tplMsg').textContent), null, { timeout: 20000 });
  console.log('保存された翻訳:', await p.evaluate(async () => { const r = await getPdf(Object.keys(PDF_INDEX)[0]); return Object.keys(r.src.tr).join(','); }));
  for (const l of LS) {
    await p.click('.tab[data-v=check]'); await p.evaluate(() => { document.getElementById('start').style.display = 'flex'; });
    await p.click(`.langBtn[data-lang=${l}]`); await p.waitForTimeout(150);
    await p.evaluate(() => { onScan('77777-88888'); }); await p.waitForSelector('#pdfbox canvas', { timeout: 20000 }); await p.waitForTimeout(500);
    const info = await p.evaluate(() => ({ lang: document.documentElement.lang, tab: document.querySelector('.tab[data-v=check]').textContent.trim(), big: document.getElementById('jBig').textContent.trim(), tr: document.getElementById('ptTrans').hidden ? '(なし)' : document.querySelector('#ptTrans .tx').textContent, over: document.documentElement.scrollWidth > innerWidth }));
    console.log(l, JSON.stringify(info)); await p.screenshot({ path: S + '/l10_' + l + '.png' });
    await p.evaluate(() => { onScan('99999-00000'); }); await p.waitForFunction(() => document.getElementById('ng').classList.contains('on')); // NGで止まったら解除
    for (const k of ['1', '2', '3', '4', 'OK']) await p.click(`#pad button:text-is("${k}")`); await p.waitForTimeout(200);
  }
  console.log('pageerrors:', errs.length ? errs : 'none'); await b.close();
})();
