// 写真だけを画面いっぱいに拡大：「つくる」で作った表はそのまま／取り込んだPDFは、管理者が1回だけ範囲を囲んで決める（設定パスワードが要る）
const { chromium } = require('playwright'); const S = process.argv[2]; const fs = require('fs');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined }); const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + S + '/../../dist/ポイント照合ツール.html'); await p.waitForFunction(() => /登録済み/.test(document.getElementById('startNote').textContent)); await p.click('.langBtn[data-lang=ja]');
  const pin = async c => { for (const k of c) await p.click(`#pinPad button:text-is("${k}")`); await p.click('#pinOk'); };
  await p.click('.tab[data-v=set]'); if (await p.locator('#pinPad').isVisible()) await pin('0000');
  await p.setInputFiles('#tplPhotoIn', [S + '/ph1.jpg', S + '/ph2.jpg']); await p.waitForTimeout(500);
  await p.fill('#tplPn', 'MADE-1'); await p.fill('#tplQty', '5'); await p.fill('#tplPts', '確認する'); await p.click('#tplSave'); await p.waitForTimeout(1200);
  const inDir = S + '/in'; const f = fs.readdirSync(inDir).filter(x => /\.pdf$/i.test(x))[0];
  await p.click('.tab[data-v=pdf]'); if (await p.locator('#pinPad').isVisible()) await pin('0000');
  await p.setInputFiles('#fileIn', [inDir + '/' + f]); await p.waitForFunction(() => /取込完了/.test(document.getElementById('impMsg').textContent));
  const imp = f.replace(/\.pdf$/i, '');
  await p.click('.tab[data-v=check]'); await p.waitForTimeout(300);
  // ① つくった表：そのまま拡大
  await p.evaluate(() => onScan('MADE-1')); await p.waitForFunction(() => document.getElementById('jBig').textContent === 'OK');
  console.log('ボタン(作った表):', await p.evaluate(() => !document.getElementById('pbBtn').hidden));
  await p.click('#pbBtn'); await p.waitForTimeout(1500);
  const a = await p.evaluate(() => { const c = document.getElementById('pbCv'); return { on: document.getElementById('pbView').classList.contains('on'), w: c.width, h: c.height }; });
  console.log('拡大(作った表):', JSON.stringify(a), 'ratio', (a.w / a.h).toFixed(2), '(期待 約1.0)');
  await p.click('#pbClose');
  // ② 取り込んだPDF：最初は範囲を決める（パスワード）
  await p.evaluate(() => document.getElementById('resetBtn').click()); await p.waitForTimeout(300);
  await p.evaluate(n => onScan(n), imp); await p.waitForFunction(() => document.getElementById('jBig').textContent === 'OK');
  await p.click('#pbBtn'); await p.waitForSelector('#pinPad', { state: 'visible' }); await pin('0000'); await p.waitForTimeout(1500);
  console.log('範囲を決める画面:', await p.evaluate(() => document.getElementById('pbSel').classList.contains('on')));
  const st = await p.locator('#pbStage').boundingBox();
  await p.mouse.move(st.x + st.width * 0.1, st.y + st.height * 0.2); await p.mouse.down(); await p.mouse.move(st.x + st.width * 0.6, st.y + st.height * 0.7, { steps: 5 }); await p.mouse.up();
  await p.click('#pbOk'); await p.waitForTimeout(1500);
  const c2 = await p.evaluate(() => { const c = document.getElementById('pbCv'); return { on: document.getElementById('pbView').classList.contains('on'), w: c.width, h: c.height }; });
  const box = await p.evaluate(async n => (await getPdf(norm(n + '.pdf'))).pbox, imp);
  console.log('拡大(取り込み):', JSON.stringify(c2), 'saved', JSON.stringify(box && { x: +box.x.toFixed(2), y: +box.y.toFixed(2), w: +box.w.toFixed(2), h: +box.h.toFixed(2) }));
  await p.click('#pbClose'); await p.click('#pbBtn'); await p.waitForTimeout(1000);
  console.log('2回目はパスワードなし:', await p.evaluate(() => document.getElementById('pbView').classList.contains('on')));
  console.log('pageerrors:', errs.length ? errs : 'none'); await b.close();
  const ok = a.on && Math.abs(a.w / a.h - 1.0) < 0.05 && c2.on && box && Math.abs(box.w - 0.5) < 0.05;
  console.log('pbox', ok ? 'OK' : 'NG'); if (!ok) process.exit(1);
})();
