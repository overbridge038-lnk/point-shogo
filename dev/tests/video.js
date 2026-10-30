// ポイント表に動画をつける：登録タブでつける → 照合でOKのとき「▶ 動画を見る」が出て再生画面が開く → 消せる。大きすぎる動画・動画でないファイルは断る
const { chromium } = require('playwright'); const S = process.argv[2]; const fs = require('fs');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } }); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('file://' + S + '/../../dist/ポイント表照合.html'); await p.waitForFunction(() => /登録済み/.test(document.getElementById('startNote').textContent)); await p.click('.langBtn[data-lang=ja]');
  const pin = async c => { for (const k of c) await p.click(`#pinPad button:text-is("${k}")`); await p.click('#pinOk'); };
  const goPdf = async () => { await p.click('.tab[data-v=pdf]'); if (await p.locator('#pinPad').isVisible()) await pin('0000'); };
  await goPdf();
  await p.setInputFiles('#fileIn', S + '/in/12345-67890.pdf'); await p.waitForFunction(() => /取込完了/.test(document.getElementById('impMsg').textContent));
  const card = () => p.locator('#pdfList .pcard').first();
  console.log('つける前のボタン:', await card().locator('button').allInnerTexts());
  const toast = async () => (await p.textContent('#toast')).trim();
  await p.evaluate(() => { VID_TARGET = Object.keys(PDF_INDEX)[0]; });
  await p.setInputFiles('#vidIn', { name: 'メモ.txt', mimeType: 'text/plain', buffer: Buffer.from('x') }); await p.waitForTimeout(300); console.log('動画でないファイル:', await toast());
  await p.setInputFiles('#vidIn', { name: 'big.mp4', mimeType: 'video/mp4', buffer: Buffer.alloc(31 * 1024 * 1024) }); await p.waitForTimeout(500); console.log('大きすぎる動画:', await toast(), '| 登録', await p.evaluate(() => Object.keys(VID_INDEX).length));
  await p.setInputFiles('#vidIn', S + '/video.webm'); await p.waitForFunction(() => Object.keys(VID_INDEX).length === 1);
  console.log('つけたあとのボタン:', await card().locator('button').allInnerTexts());
  await p.locator('[data-vidplay]').first().click(); await p.waitForFunction(() => document.getElementById('vidEl').readyState >= 1, null, { timeout: 10000 });
  console.log('登録画面で再生: 長さ', await p.evaluate(() => Math.round(document.getElementById('vidEl').duration * 10) / 10), '秒'); await p.click('#vidClose'); console.log('閉じた:', await p.evaluate(() => !document.getElementById('vidView').classList.contains('on') && !document.getElementById('vidEl').getAttribute('src')));
  // 照合：OKのときだけボタンが出る
  await p.click('.tab[data-v=check]'); console.log('スキャン前のボタン:', await p.evaluate(() => document.getElementById('vidBtn').hidden));
  await p.evaluate(() => { onScan('12345-67890'); }); await p.waitForSelector('#pdfbox canvas', { timeout: 30000 }); await p.waitForTimeout(400);
  console.log('OK後のボタン表示:', await p.evaluate(() => !document.getElementById('vidBtn').hidden), '|', await p.textContent('#vidBtn'));
  await p.click('#vidBtn'); await p.waitForFunction(() => document.getElementById('vidEl').readyState >= 1, null, { timeout: 10000 }); console.log('照合画面で再生:', await p.evaluate(() => document.getElementById('vidView').classList.contains('on')), await p.textContent('#vidName')); await p.screenshot({ path: S + '/video_play.png' }); await p.click('#vidClose');
  // 動画のないポイント表ではボタンが出ない／保存しなおしても動画は残る／消せる／ポイント表を消すと動画も消える
  await p.setInputFiles('#fileIn', S + '/in/12345-67890.pdf'); await p.waitForFunction(() => /取込完了/.test(document.getElementById('impMsg').textContent)).catch(() => {}); await goPdf();
  console.log('上書きしても動画:', await p.evaluate(() => Object.keys(VID_INDEX).length));
  await goPdf(); await p.locator('[data-viddel]').first().click(); await p.waitForFunction(() => Object.keys(VID_INDEX).length === 0); console.log('動画を消した:', await toast());
  await p.evaluate(() => { VID_TARGET = Object.keys(PDF_INDEX)[0]; }); await p.setInputFiles('#vidIn', S + '/video.webm'); await p.waitForFunction(() => Object.keys(VID_INDEX).length === 1);
  await p.locator('[data-del]').first().click(); await p.waitForFunction(() => Object.keys(PDF_INDEX).length === 0);
  await p.reload(); await p.waitForFunction(() => /登録済み/.test(document.getElementById('startNote').textContent)); console.log('ポイント表を消すと動画も消える:', await p.evaluate(() => Object.keys(VID_INDEX).length === 0));
  console.log('pageerrors:', errs.length ? errs : 'none'); await b.close();
})();
