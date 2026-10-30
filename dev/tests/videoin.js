// 動画の取り込み：登録タブで「ファイル名＝品番」の動画をまとめて取り込む／つくる画面で動画をつけて登録する
const { chromium } = require('playwright'); const S = process.argv[2]; const fs = require('fs');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } }); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('file://' + S + '/../../dist/ポイント表照合.html'); await p.waitForFunction(() => /登録済み/.test(document.getElementById('startNote').textContent)); await p.click('.langBtn[data-lang=ja]');
  const pin = async c => { for (const k of c) await p.click(`#pinPad button:text-is("${k}")`); await p.click('#pinOk'); };
  const goto = async v => { await p.click(`.tab[data-v=${v}]`); if (await p.locator('#pinPad').isVisible()) await pin('0000'); };
  const vid = fs.readFileSync(S + '/video.webm'); const mp = n => ({ name: n, mimeType: 'video/mp4', buffer: vid });
  await goto('pdf'); await p.setInputFiles('#fileIn', S + '/in/12345-67890.pdf'); await p.waitForFunction(() => /取込完了/.test(document.getElementById('impMsg').textContent));
  // ① まとめて取り込み（合う・合わない・大きすぎる・全角ハイフン）
  await p.setInputFiles('#vidMulti', [mp('１２３４５－６７８９０.MP4'), mp('99999-00000.mp4'), { name: '12345-67890.mov', mimeType: 'video/quicktime', buffer: Buffer.alloc(31 * 1024 * 1024) }]);
  await p.waitForFunction(() => /動画を取り込みました/.test(document.getElementById('impMsg').textContent));
  console.log('まとめて取り込み:', (await p.locator('#impMsg').innerText()).replace(/\n/g, ' / '), '| 付いた', await p.evaluate(() => Object.keys(VID_INDEX).join(',')));
  // ② 枠（fileIn）にPDFと動画を一緒に選んでも両方入る
  await p.evaluate(() => { VID_INDEX = {}; });
  await p.setInputFiles('#fileIn', [{ name: '12345-67890.pdf', mimeType: 'application/pdf', buffer: fs.readFileSync(S + '/in/12345-67890.pdf') }, mp('12345-67890.mp4')]); await p.waitForFunction(() => /取込完了/.test(document.getElementById('impMsg').textContent) && /動画を取り込みました/.test(document.getElementById('impMsg').textContent));
  console.log('PDFと動画いっしょ:', (await p.locator('#impMsg').innerText()).replace(/\n/g, ' / '));
  // ③ つくる画面：写真の枠に動画を入れる→登録→動画がつく
  await p.evaluate(() => { return tx('kv', 'readwrite', s => { s.clear(); }); }); await p.evaluate(() => { VID_INDEX = {}; });
  await goto('set'); console.log('つくる画面の動画欄:', await p.locator('#tplVidBtn').isVisible(), await p.textContent('#tplVidBtn'));
  await p.setInputFiles('#tplPhotoIn', [mp('メモ動画.mp4'), { name: 'p.jpg', mimeType: 'image/jpeg', buffer: fs.readFileSync(S + '/partimg-000.jpg') }]); await p.waitForTimeout(900);
  console.log('写真の枠に動画:', await p.textContent('#tplVidInfo'), '| 写真', await p.textContent('#tplCnt'));
  await p.fill('#tplPn', '55555-66666'); await p.fill('#tplQty', '4'); await p.fill('#tplPts', 'a\nb');
  await p.screenshot({ path: S + '/videoin_tpl.png' });
  await p.click('#tplSave'); await p.waitForFunction(() => /登録しました/.test(document.getElementById('tplMsg').textContent), null, { timeout: 20000 });
  console.log('登録後に動画:', await p.evaluate(() => Object.keys(VID_INDEX).join(',')), '| 入力欄の動画表示', JSON.stringify(await p.textContent('#tplVidInfo')));
  // ④ ボタンで選ぶ／外す
  await p.setInputFiles('#tplVidIn', mp('x.mp4')); await p.waitForFunction(() => /登録するときに/.test(document.getElementById('tplVidInfo').textContent)); await p.click('#tplVidDel'); console.log('外した:', JSON.stringify(await p.textContent('#tplVidInfo')));
  console.log('pageerrors:', errs.length ? errs : 'none'); await b.close();
})();
