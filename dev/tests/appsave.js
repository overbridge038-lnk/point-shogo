// 「このツールをファイルとして保存」：公開URL（https/http）で開いている時は、元のHTMLが保存される（作られたボタンが入っていない）／ファイルから開いている時は理由を出す
const { chromium } = require('playwright'); const S = process.argv[2]; const fs = require('fs'); const http = require('http'); const path = require('path'); const os = require('os');
(async () => {
  const root = path.join(S, '..', '..', '..'); // リポジトリの直下（index.html のある所）
  const srv = http.createServer((q, r) => { const f = path.join(root, q.url === '/' ? 'index.html' : decodeURIComponent(q.url.split('?')[0])); if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.statusCode = 404; return r.end(); } r.setHeader('content-type', f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream'); r.end(fs.readFileSync(f)); }).listen(0);
  const port = srv.address().port;
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined }); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true, serviceWorkers: 'block' }); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  const pin = async c => { for (const k of c) await p.click(`#pinPad button:text-is("${k}")`); await p.click('#pinOk'); };
  await p.goto(`http://localhost:${port}/`); await p.waitForFunction(() => /登録済み/.test(document.getElementById('startNote').textContent)); await p.click('.langBtn[data-lang=ja]');
  await p.click('.tab[data-v=set]'); await pin('0000');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#appSave')]); const f = path.join(os.tmpdir(), 'app_' + Date.now() + '.html'); await dl.saveAs(f);
  const txt = fs.readFileSync(f, 'utf8');
  console.log('保存:', dl.suggestedFilename(), '| 元のindex.htmlと同じ:', txt === fs.readFileSync(path.join(root, 'index.html'), 'utf8'), '| 作られたボタンが入っていない:', /id="pad"><\/div>/.test(txt) && /id="pinPad"><\/div>/.test(txt));
  // 保存したファイルを開いて、動く
  const q = await b.newPage({ viewport: { width: 1280, height: 800 } }); q.on('pageerror', e => errs.push(e.message)); await q.goto('file://' + f); await q.waitForFunction(() => /登録済み/.test(document.getElementById('startNote').textContent), null, { timeout: 20000 });
  console.log('保存したファイルを開く:', await q.evaluate(() => document.querySelectorAll('#pinPad button').length + '個のテンキー'));
  // ファイルから開いている時
  await q.click('.langBtn[data-lang=ja]'); await q.click('.tab[data-v=set]'); for (const k of '0000') await q.click(`#pinPad button:text-is("${k}")`); await q.click('#pinOk'); await q.click('#appSave'); await q.waitForTimeout(400);
  console.log('ファイルから開いている時:', (await q.textContent('#toast')).trim());
  console.log('pageerrors:', errs.length ? errs : 'none'); await b.close(); srv.close();
})();
