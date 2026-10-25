const { chromium } = require('playwright');
const S = process.argv[2];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  p.on('console', m => { if (m.type()==='error' || m.type()==='warning') console.log('console:', m.text().slice(0,200)); });
  p.on('pageerror', e => console.log('pageerror:', e.message));
  await p.goto('file://' + S + '/../../dist/ポイント表照合.html');
  await p.waitForFunction(() => /登録済み|エラー/.test(document.getElementById('startNote').textContent), null, {timeout:20000});
  console.log('start:', await p.textContent('#startNote'));
  await p.screenshot({path:S+'/shot_start.png'}); await p.click('.langBtn[data-lang=ja]');
  await p.click('.tab[data-v=pdf]'); for (const k of '0000') await p.click('#pinPad button:text-is("'+k+'")'); await p.click('#pinOk');
  const fs=require('fs'); await p.setInputFiles('#fileIn', fs.readdirSync(S+'/in').map(f=>S+'/in/'+f));
  await p.waitForFunction(() => /取込完了/.test(document.getElementById('impMsg').textContent));
  console.log('import:', await p.textContent('#impMsg'));
  await p.screenshot({ path: S + '/shot_pdf.png' });
  await p.click('.tab[data-v=check]');
  async function scan(v){ await p.keyboard.type(v, {delay:5}); await p.keyboard.press('Enter');
    await p.waitForFunction(() => !/確認中/.test(document.getElementById('jBig').textContent) && document.getElementById('jBig').textContent!=='かんばんを読む', null, {timeout:30000});
    const ng = await p.evaluate(()=>document.getElementById('ng').classList.contains('on'));
    console.log('scan', v, '=>', await p.textContent('#jBig'), '|', await p.textContent('#jMsg'), ng ? '| NG: '+await p.textContent('#ngWhy') : '', '| pRaw', await p.textContent('#pRaw')); return ng; }
  await scan('12345-67890'); await p.screenshot({ path: S + '/shot_ok.png' });
  await scan('23456-78901');
  await scan('34567-89012');
  if (await scan('45678-90123')) { await p.screenshot({ path: S + '/shot_ng.png' });
    for (const k of ['1','1','OK']) await p.click(`#pad button:text-is("${k}")`); console.log('wrong code still NG:', await p.evaluate(()=>document.getElementById('ng').classList.contains('on')));
    for (const k of ['1','2','3','4','OK']) await p.click(`#pad button:text-is("${k}")`); console.log('unlock ->', await p.evaluate(()=>document.getElementById('ng').classList.contains('on'))); }
  if (await scan('56789-01234')) for (const k of ['1','2','3','4','OK']) await p.click(`#pad button:text-is("${k}")`);
  await p.evaluate(()=>onScan('ＡＡＡ，１２３４５ー６７８９０，TOYOTA，6'));
  await p.waitForFunction(() => !/確認中/.test(document.getElementById('jBig').textContent) && document.getElementById('jBig').textContent!=='かんばんを読む');
  console.log('fullwidth csv kanban =>', await p.textContent('#jBig'), await p.textContent('#kPn'));
  await p.click('.tab[data-v=log]'); await p.waitForTimeout(300);
  console.log('log sums', await p.textContent('#sAll'), await p.textContent('#sOk'), await p.textContent('#sNg'));
  await p.screenshot({ path: S + '/shot_log.png' });
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#csvBtn')]);
  await dl.saveAs(S + '/test.csv'); console.log('csv', dl.suggestedFilename());
  await b.close();
})();
