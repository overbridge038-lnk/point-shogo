// ハンディスキャナー専用：照合画面で読取欄にカーソルがあることを見せ、手入力ボタンは初期は出さない（設定で出せる）
const { chromium } = require('playwright'); const S = process.argv[2];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined }); const p = await b.newPage({ viewport: { width: 1280, height: 800 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + S + '/../../dist/ポイント照合ツール.html'); await p.waitForFunction(() => /登録済み/.test(document.getElementById('startNote').textContent)); await p.click('.langBtn[data-lang=ja]');
  await p.waitForTimeout(900);
  const st = await p.evaluate(() => ({ man: getComputedStyle(document.getElementById('manBtn')).display, ready: document.getElementById('scanBox').classList.contains('ready'), focus: document.activeElement.id, hint: document.getElementById('scanHint').textContent }));
  console.log('手入力ボタン(初期):', st.man, '| 緑の読み取り待ち:', st.ready, '| カーソル:', st.focus, '|', st.hint);
  // 画面のどこかをさわってカーソルが外れても、戻る
  await p.evaluate(() => { document.activeElement.blur(); });
  await p.waitForTimeout(1000);
  console.log('外れたあと戻る     :', await p.evaluate(() => document.activeElement.id + ' ' + document.getElementById('scanBox').classList.contains('ready')));
  // 設定で出す
  await p.evaluate(() => { CF.manual = '1'; applyManual(); });
  console.log('設定で出す         :', await p.evaluate(() => getComputedStyle(document.getElementById('manBtn')).display));
  console.log('pageerrors:', errs.length ? errs : 'none'); await b.close();
})();
