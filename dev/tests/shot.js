// 「写真を撮る」：偽のカメラ映像で、撮った写真がポイント表の写真に追加される（4枚でいっぱい→自動で閉じる）
const { chromium } = require('playwright'); const S = process.argv[2];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, permissions: ['camera'] }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + S + '/../../dist/ポイント表照合.html');
  await p.waitForFunction(() => /登録済み/.test(document.getElementById('startNote').textContent)); await p.click('.langBtn[data-lang=ja]');
  await p.click('.tab[data-v=set]'); for (const k of '0000') await p.click(`#pinPad button:text-is("${k}")`); await p.click('#pinOk');
  const n = () => p.evaluate(() => TPL.imgs.length);
  await p.locator('#tplShot').scrollIntoViewIfNeeded();
  console.log('button visible:', await p.locator('#tplShot').isVisible(), '| photos', await n());
  await p.click('#tplShot'); await p.waitForFunction(() => document.getElementById('shot').classList.contains('on'));
  await p.waitForFunction(() => document.getElementById('shotVideo').videoWidth > 0);
  console.log('camera open | info:', await p.textContent('#shotInfo'));
  await p.click('#shotDo'); await p.waitForFunction(() => TPL.imgs.length === 1); console.log('after 1 shot:', await n(), '| still open:', await p.evaluate(() => document.getElementById('shot').classList.contains('on')));
  await p.screenshot({ path: S + '/shot.png' });
  for (let i = 2; i <= 4; i++) { await p.click('#shotDo'); await p.waitForFunction(k => TPL.imgs.length === k, i); }
  await p.waitForTimeout(300);
  console.log('after 4 shots:', await n(), '| closed:', await p.evaluate(() => !document.getElementById('shot').classList.contains('on')), '| button hidden:', await p.evaluate(() => document.getElementById('tplShot').hidden));
  // 4枚ぶんの写真で登録できる
  await p.fill('#tplPn', '11111-22222'); await p.fill('#tplQty', '5'); await p.fill('#tplPts', '撮影テスト'); await p.click('#tplSave'); await p.waitForFunction(() => /登録しました/.test(document.getElementById('tplMsg').textContent), null, { timeout: 15000 });
  console.log('msg:', await p.textContent('#tplMsg'));
  console.log('saved:', await p.evaluate(() => Object.keys(PDF_INDEX).join(',')), '| src photos:', await p.evaluate(async () => (await getPdf('1111122222')).src.photos.length));
  console.log('pageerrors:', errs.length ? errs : 'none');
  await b.close();
})();
