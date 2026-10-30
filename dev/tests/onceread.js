// タブレットによっては、選んだファイルを2回読ませてくれない（NotReadableError）。1回だけ読んで使い回せば、登録できる
const { chromium } = require('playwright'); const S = process.argv[2]; const fs = require('fs');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  // 同じファイルの2回目の読み取りを、すべて失敗させる（arrayBuffer も FileReader も）
  await ctx.addInitScript(() => {
    const seen = new WeakSet(); const fail = f => { if (seen.has(f)) { const e = new Error('The requested file could not be read'); e.name = 'NotReadableError'; throw e; } seen.add(f); };
    const ab = File.prototype.arrayBuffer; File.prototype.arrayBuffer = function () { try { fail(this); } catch (e) { return Promise.reject(e); } return ab.call(this); };
    const ra = FileReader.prototype.readAsArrayBuffer; FileReader.prototype.readAsArrayBuffer = function (f) { try { fail(f); } catch (e) { const fr = this; setTimeout(() => { Object.defineProperty(fr, 'error', { value: e }); fr.onerror && fr.onerror(); }, 0); return; } return ra.call(this, f); };
  });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + S + '/../../dist/ポイント表照合.html'); await p.waitForFunction(() => /登録済み/.test(document.getElementById('startNote').textContent)); await p.click('.langBtn[data-lang=ja]');
  await p.click('.tab[data-v=set]'); for (const k of '0000') await p.click(`#pinPad button:text-is("${k}")`); await p.click('#pinOk');
  p.once('dialog', d => d.accept());
  await p.setInputFiles('#xlIn', [{ name: 'A16Z,A170.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: fs.readFileSync(S + '/かんばん回収.xlsx') }]);
  await p.waitForFunction(() => /取込完了|取り込めなかった|読み込めません/.test(document.getElementById('xlMsg').textContent), null, { timeout: 60000 });
  console.log('資料Excel（2回目は読めない端末）:', (await p.locator('#xlMsg').innerText()).replace(/\n/g, ' / '), '| keys', await p.evaluate(() => Object.keys(PDF_INDEX).join('|')));
  console.log('pageerrors:', errs.length ? errs : 'none'); await b.close();
})();
