// 上の「ポイント表 ◯件」から開く一覧でも、選んで削除・全部削除（設定パスワードを1回だけ確かめる）
const { chromium } = require('playwright'); const S = process.argv[2]; const fs = require('fs');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined }); const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + S + '/../../dist/ポイント照合ツール.html'); await p.waitForFunction(() => /登録済み/.test(document.getElementById('startNote').textContent)); await p.click('.langBtn[data-lang=ja]');
  const pin = async c => { for (const k of c) await p.click(`#pinPad button:text-is("${k}")`); await p.click('#pinOk'); };
  await p.click('.tab[data-v=pdf]'); if (await p.locator('#pinPad').isVisible()) await pin('0000');
  const dir = S + '/in2'; await p.setInputFiles('#fileIn', fs.readdirSync(dir).filter(x => /\.pdf$/i.test(x)).map(x => dir + '/' + x));
  await p.waitForFunction(() => /取込完了/.test(document.getElementById('impMsg').textContent));
  const n = () => p.evaluate(() => Object.keys(PDF_INDEX).length); const n0 = await n(); console.log('登録', n0);
  await p.click('.tab[data-v=check]'); await p.click('#pCountBadge'); await p.waitForTimeout(300);
  console.log('ボタン:', await p.locator('#plSelMode').isVisible(), await p.locator('#plClear').isVisible());
  // パスワードちがい → 選ぶモードにならない
  await p.click('#plSelMode'); await pin('9999'); await p.waitForTimeout(300); console.log('パスワードちがい→モードにならない:', await p.evaluate(() => !PLSEL.on));
  await p.click('#plSelMode'); await pin('0000'); await p.waitForTimeout(200);
  const cards = p.locator('#plGrid .pcard'); await cards.nth(0).click(); await cards.nth(1).click();
  console.log('2件選ぶ:', await p.locator('#plSelDel').innerText(), '| 見る画面は開かない:', await p.evaluate(() => !document.getElementById('pv') || !document.getElementById('pv').classList.contains('on')));
  await p.waitForTimeout(800); await p.screenshot({ path: S + '/plistdel_sel.png' });
  let msg = ''; p.once('dialog', async d => { msg = d.message(); await d.accept(); });
  await p.click('#plSelDel'); await p.waitForTimeout(1000);
  console.log('確認文:', msg.split('\n')[0], '| 残り', await n(), '| 一覧の数', await p.locator('#plGrid .pcard').count(), '| モード終了', await p.evaluate(() => !PLSEL.on));
  // 検索で絞って「すべて選ぶ」
  await p.click('#plSelMode'); await p.fill('#plSearch', '74043'); await p.dispatchEvent('#plSearch', 'input'); await p.click('#plSelAll');
  console.log('絞ってすべて選ぶ:', await p.locator('#plSelDel').innerText()); await p.click('#plSelCancel'); await p.fill('#plSearch', ''); await p.dispatchEvent('#plSearch', 'input');
  // 全部削除（パスワードは開いている間1回だけ）：やめる → 消えない／OK → 全部消える
  p.once('dialog', d => d.dismiss()); await p.click('#plClear'); await p.waitForTimeout(500); console.log('やめる→残る:', await n());
  p.once('dialog', async d => { msg = d.message(); await d.accept(); }); await p.click('#plClear'); await p.waitForTimeout(1000);
  console.log('全部削除:', msg.split('\n')[0], '| 残り', await n(), '| 上の件数', await p.locator('#pCountNum').innerText());
  console.log('pageerrors:', errs.length ? errs : 'none'); await b.close();
})();
