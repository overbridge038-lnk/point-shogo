// ブラウザの「ページを保存（Ctrl+S）」で保存したHTMLを開き直しても、テンキーが2重にならない
const { chromium } = require('playwright'); const S = process.argv[2]; const fs = require('fs'); const os = require('os'); const path = require('path');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined }); const errs = [];
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } }); p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + S + '/../../dist/ポイント照合ツール.html'); await p.waitForFunction(() => /登録済み/.test(document.getElementById('startNote').textContent));
  const cnt = pg => pg.evaluate(() => [document.querySelectorAll('#pad button').length, document.querySelectorAll('#pinPad button').length]);
  console.log('元のページ:', await cnt(p));
  const snap = path.join(os.tmpdir(), 'resave_' + Date.now() + '.html'); fs.writeFileSync(snap, '<!DOCTYPE html>\n' + await p.evaluate(() => document.documentElement.outerHTML)); // 保存したときの中身（作られたボタンも入っている）
  const q = await b.newPage({ viewport: { width: 1280, height: 800 } }); q.on('pageerror', e => errs.push(e.message));
  await q.goto('file://' + snap); await q.waitForFunction(() => /登録済み/.test(document.getElementById('startNote').textContent), null, { timeout: 20000 });
  console.log('保存して開き直したページ:', await cnt(q));
  await q.click('.langBtn[data-lang=ja]'); await q.click('.tab[data-v=set]'); console.log('パスワード画面のボタン数:', await q.locator('#pinPad button').count());
  console.log('pageerrors:', errs.length ? errs : 'none'); await b.close();
})();
