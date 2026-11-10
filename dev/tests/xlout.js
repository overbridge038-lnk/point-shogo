// 受け渡しファイル（.ptpack）→ 修正用Excelに書き出し → その Excel を「Excelの一覧から作る」で読み戻して、中身（品番・収容数・ポイント・翻訳・写真）が同じか確かめる
const { chromium } = require('playwright'); const S = process.argv[2]; const fs = require('fs'); const os = require('os'); const path = require('path');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const errs = []; const p = await (await b.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true })).newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + S + '/../../dist/ポイント照合ツール.html'); await p.waitForFunction(() => /登録済み/.test(document.getElementById('startNote').textContent)); await p.click('.langBtn[data-lang=ja]');
  const ph = f => 'data:image/jpeg;base64,' + fs.readFileSync(S + '/' + f).toString('base64');
  const tr = { en: 'Check direction\nNo scratches', vi: 'Kiểm tra chiều\nKhông xước', my: 'ဦးတည်ရာ\nခြစ်ရာ မရှိ' };
  const items = [
    { key: 'AAA11111', name: 'AAA-11111.pdf', at: '2026-11-06 10:00:00', size: 4, src: { pn: 'AAA-11111', qty: '20', hg: 'A型', hk: '6', pts: '向きを確認\nキズなし\n刻印を見る', tr, photos: [ph('ph1.jpg'), ph('ph2.jpg')] } },
    { key: '1661110040,4078', name: '16611-10040,4078.pdf', at: '2026-11-06 10:00:00', size: 4, src: { pn: '16611-10040,4078', qty: '60', pts: Array.from({ length: 10 }, (_, i) => 'ポイント内容' + (i + 1)).join('\n'), tr: {}, photos: [ph('ph1.jpg')] } },
    { key: 'DOC', name: 'かんばん.pdf', at: '2026-11-06 10:00:00', size: 4, src: null }
  ];
  const hdr = Buffer.from(JSON.stringify({ v: 1, term: '01', at: '2026-11-10 11:00:00', items: items.map(i => ({ key: i.key, name: i.name, at: i.at, size: i.size, src: i.src, kind: null, xl: null })), videos: [], cf: null }));
  const top = Buffer.alloc(12); top.write('PTPACK1\n', 0); top.writeUInt32BE(hdr.length, 8);
  const pk = path.join(os.tmpdir(), 'xlout.ptpack'); fs.writeFileSync(pk, Buffer.concat([top, hdr, Buffer.from('%PDF%PDF%PDF%PDF%PDF%PDF%PDF%PDF%PDF%PDF%PDF%PDF')]));
  await p.click('.tab[data-v=set]'); if (await p.locator('#pinPad').isVisible()) { for (const k of '0000') await p.click(`#pinPad button:text-is("${k}")`); await p.click('#pinOk'); }
  await p.setInputFiles('#pkIn', pk); await p.waitForSelector('#pkXl2', { state: 'visible' });
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#pkXl2')]);
  const out = path.join(os.tmpdir(), 'xlout.xlsx'); await dl.saveAs(out); console.log('file:', dl.suggestedFilename(), fs.statSync(out).size > 1000);
  console.log('toast:', await p.locator('#toast').innerText());
  await p.setInputFiles('#xlIn', out); await p.waitForFunction(() => document.getElementById('xlSum').textContent.length > 0);
  const rows = await p.evaluate(() => XL.rows.map(r => ({ pn: r.pn, qty: r.qty, hg: r.hg, hk: r.hk, pts: r.pts.length, p1: r.pts[0], photos: r.urls.length, en: r.tr.en, vi: r.tr.vi, my: r.tr.my, err: r.err })));
  rows.forEach(r => console.log(JSON.stringify(r)));
  console.log('summary:', await p.locator('#xlSum').innerText());
  // 一覧で翻訳を入れた状態（自動翻訳の代わりに直接入れる）→「翻訳を入れたExcelとして保存」→ もう一度読み込んで同じか
  await p.evaluate(() => { XL.rows.forEach(r => { r.tr.id = 'TR-' + r.pn; }); });
  const [dl2] = await Promise.all([p.waitForEvent('download'), p.click('#xlSaveXl')]); const out2 = path.join(os.tmpdir(), 'xlout2.xlsx'); await dl2.saveAs(out2); console.log('file2:', dl2.suggestedFilename());
  await p.evaluate(() => { document.getElementById('xlIn').value = ''; });
  await p.setInputFiles('#xlIn', out2); await p.waitForTimeout(1500);
  const r2 = await p.evaluate(() => XL.rows.map(r => ({ pn: r.pn, id: r.tr.id, en: r.tr.en, photos: r.urls.length, pts: r.pts.length })));
  console.log(JSON.stringify(r2));
  const ok2 = r2.length === 2 && r2.every(r => r.id === 'TR-' + r.pn) && r2.find(r => r.pn === 'AAA-11111').photos === 2 && r2.find(r => r.pn === 'AAA-11111').en === 'Check direction\nNo scratches';
  console.log('save with translations', ok2 ? 'OK' : 'NG'); if (!ok2) process.exit(1);
  console.log('pageerrors:', errs.length ? errs : 'none'); await b.close();
  const A = rows.find(r => r.pn === 'AAA-11111'), B = rows.find(r => r.pn === '16611-10040,4078'); const ok = rows.length === 2 && A && B && A.hg === 'A型' && A.hk === '6' && B.hg === '' && A.pts === 3 && A.photos === 2 && A.en === 'Check direction\nNo scratches' && A.my.indexOf('ခြစ်ရာ') > 0 && B.pts === 10 && B.photos === 1 && !rows.some(r => r.err);
  console.log('roundtrip', ok ? 'OK' : 'NG'); if (!ok) process.exit(1);
})();
