// いろんなタブレットで続き：①受け渡し（.ptpack）に動画と設定も入れて、別のタブレットで取り込む ②作りかけ（.ptdraft）を保存して、別のタブレットで開く
const { chromium } = require('playwright'); const S = process.argv[2]; const fs = require('fs'); const os = require('os'); const path = require('path');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined }); const errs = [];
  async function tablet() {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true }); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
    await p.goto('file://' + S + '/../../dist/ポイント照合ツール.html'); await p.waitForFunction(() => /登録済み/.test(document.getElementById('startNote').textContent)); await p.click('.langBtn[data-lang=ja]'); return p;
  }
  const pin = async (p, c) => { for (const k of c) await p.click(`#pinPad button:text-is("${k}")`); await p.click('#pinOk'); };
  const go = async (p, v) => { await p.click(`.tab[data-v=${v}]`); if (await p.locator('#pinPad').isVisible()) await pin(p, '0000'); };
  const video = fs.readFileSync(S + '/video.webm');
  // ---- ① 受け渡し
  const A = await tablet(); await go(A, 'pdf'); await A.setInputFiles('#fileIn', [{ name: '12345-67890.pdf', mimeType: 'application/pdf', buffer: fs.readFileSync(S + '/in/12345-67890.pdf') }, { name: '12345-67890.mp4', mimeType: 'video/mp4', buffer: video }]);
  await A.waitForFunction(() => /動画を取り込みました/.test(document.getElementById('impMsg').textContent));
  await go(A, 'set'); await A.evaluate(() => { CF.sound = '0'; CF.code = '5555'; CF.setpw = '7777'; CF.term = 'A1'; return saveCfStore(); }); const pack = path.join(os.tmpdir(), 'sync_test.ptpack');
  const [dl] = await Promise.all([A.waitForEvent('download'), A.click('#pkOut')]); await dl.saveAs(pack);
  console.log('書き出し:', dl.suggestedFilename(), '| 大きさ>PDFだけ:', fs.statSync(pack).size > fs.statSync(S + '/in/12345-67890.pdf').size + video.length);
  const B = await tablet(); await B.evaluate(() => { CF.term = 'B2'; return saveCfStore(); }); await go(B, 'set');
  await B.setInputFiles('#pkIn', pack); await B.waitForSelector('#pkBox', { state: 'visible' });
  console.log('取り込み画面:', (await B.locator('#pkFrom').innerText()), '| 動画の選択', await B.locator('#pkInVidL').isVisible(), '| 設定の選択', await B.locator('#pkInCfL').isVisible());
  await B.click('#pkApply'); await B.waitForFunction(() => Object.keys(VID_INDEX).length === 1, null, { timeout: 20000 });
  console.log('取り込み後:', await B.evaluate(() => 'PDF ' + Object.keys(PDF_INDEX).length + '件 | 動画 ' + Object.keys(VID_INDEX).length + '本 | 解除番号 ' + CF.code + ' | パスワード ' + CF.setpw + ' | 音 ' + CF.sound + ' | 端末番号 ' + CF.term + '（B2のまま）'));
  // 動画と設定を外して取り込む → 入らない
  const C = await tablet(); await go(C, 'set'); await C.setInputFiles('#pkIn', pack); await C.waitForSelector('#pkBox', { state: 'visible' }); await C.uncheck('#pkInVid'); await C.uncheck('#pkInCf'); await C.click('#pkApply'); await C.waitForFunction(() => Object.keys(PDF_INDEX).length === 1, null, { timeout: 20000 });
  console.log('外して取り込み:', await C.evaluate(() => '動画 ' + Object.keys(VID_INDEX).length + '本 | 解除番号 ' + CF.code));
  // ---- ② 作りかけ
  await A.setInputFiles('#tplPhotoIn', [{ name: 'p.jpg', mimeType: 'image/jpeg', buffer: fs.readFileSync(S + '/partimg-000.jpg') }]); await A.waitForFunction(() => TPL.imgs.length === 1);
  await A.fill('#tplPn', '33333-44444'); await A.fill('#tplQty', '12'); await A.fill('#tplPts', '向きを確認\nキズなし'); await A.click('#tplTrBox summary'); await A.fill('#tplTr_en', 'Check direction\nNo scratches'); await A.fill('#tplTr_si', 'දිශාව\nඉරි නැත');
  const [dl2] = await Promise.all([A.waitForEvent('download'), A.click('#drSave')]); const dr = path.join(os.tmpdir(), 'draft_test.ptdraft'); await dl2.saveAs(dr);
  console.log('作りかけ保存:', dl2.suggestedFilename(), '| 大きさ', fs.statSync(dr).size > 1000);
  const D = await tablet(); await go(D, 'set'); await D.setInputFiles('#drIn', dr); await D.waitForFunction(() => document.getElementById('tplPn').value === '33333-44444', null, { timeout: 20000 }); await D.waitForFunction(() => TPL.imgs.length === 1);
  console.log('別のタブレットで開いた:', await D.evaluate(() => [document.getElementById('tplPn').value, document.getElementById('tplQty').value, JSON.stringify(document.getElementById('tplPts').value), JSON.stringify(document.getElementById('tplTr_en').value), JSON.stringify(document.getElementById('tplTr_si').value), '写真 ' + TPL.imgs.length].join(' | ')));
  await D.click('#tplSave'); await D.waitForFunction(() => /登録しました/.test(document.getElementById('tplMsg').textContent), null, { timeout: 20000 }); console.log('続きを登録:', await D.evaluate(() => Object.keys(PDF_INDEX).join(',')));
  await D.setInputFiles('#drIn', { name: 'x.ptdraft', mimeType: 'application/json', buffer: Buffer.from('{"a":1}') }); await D.waitForTimeout(400); console.log('違うファイル:', (await D.textContent('#toast')).trim());
  console.log('pageerrors:', errs.length ? errs : 'none'); await b.close();
})();
