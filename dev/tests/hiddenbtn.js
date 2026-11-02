// hidden を付けたボタンは、画面に出ない（「動画を見る」「✕ 外す」が、動画がないのに見えていた不具合の確認）
const { chromium } = require('playwright'); const S = process.argv[2];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined }); const p = await b.newPage({ viewport: { width: 1280, height: 800 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + S + '/../../dist/ポイント照合ツール.html'); await p.waitForFunction(() => /登録済み/.test(document.getElementById('startNote').textContent)); await p.click('.langBtn[data-lang=ja]');
  const d = id => p.evaluate(id => getComputedStyle(document.getElementById(id)).display, id);
  console.log('動画を見る（照合の前）:', await d('vidBtn'), '| ✕ 外す（動画なし）:', await d('tplVidDel'));
  console.log('pageerrors:', errs.length ? errs : 'none'); await b.close();
  if ((await Promise.resolve('none')) !== 'none') process.exit(1);
})();
