// 親機の表の共有（Googleドライブ＋GAS）：gas/Code.gs を偽のGoogleドライブの上でそのまま動かし、
// 親機が送る → 子機が受け取る（端末だけの表は残る）→ 親機が1件消して送る → 子機が自動で受け取る、を確かめる
const { chromium } = require('playwright'); const S = process.argv[2]; const fs = require('fs'); const path = require('path'); const vm = require('vm');
const URL_ = 'https://script.google.com/macros/s/TEST/exec';
// ---- 偽のGoogleドライブ・GASの部品 ----
function fakeGas(src) {
  let props = {}, fid = 0;
  const iter = a => { let i = 0; return { hasNext: () => i < a.length, next: () => a[i++] }; };
  function Folder(name, parent) {
    const f = { id: ++fid, name, parent, trashed: false, created: new Date(), folders: [], files: [] };
    f.getName = () => f.name; f.setName = n => { f.name = n; }; f.setTrashed = v => { f.trashed = v; }; f.getDateCreated = () => f.created;
    f.getFoldersByName = n => iter(f.folders.filter(x => !x.trashed && x.name === n));
    f.getFolders = () => iter(f.folders.filter(x => !x.trashed));
    f.getFilesByName = n => iter(f.files.filter(x => !x.trashed && x.name === n));
    f.createFolder = n => { const c = Folder(n, f); f.folders.push(c); return c; };
    f.createFile = (n, data) => { const x = { name: n, trashed: false, data: String(data), setTrashed: v => { x.trashed = v; }, getBlob: () => ({ getDataAsString: () => x.data }) }; f.files.push(x); return x; };
    return f;
  }
  const root = Folder('root');
  const ctx = {
    DriveApp: { getFoldersByName: n => root.getFoldersByName(n), createFolder: n => root.createFolder(n) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ s, setMimeType() { return this; } }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = v; } }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    MimeType: { PLAIN_TEXT: 'text/plain' }, JSON, Date, Number, String, Math
  };
  vm.createContext(ctx); vm.runInContext(src, ctx);
  return { post: body => ctx.doPost({ postData: { contents: body } }).s, root };
}
const code = fs.readFileSync(path.join(__dirname, '../../gas/Code.gs'), 'utf8');
// 合言葉が書き換えられていないときは、使えない（setup）
console.log('合言葉が未設定のとき:', JSON.parse(fakeGas(code).post(JSON.stringify({ action: 'info', key: '' }))).err);
const G = fakeGas(code.replace("'ここに閲覧の合言葉'", "'yomu1'").replace("'ここに送信の合言葉'", "'okuru9'"));
let calls = 0;
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const errs = [];
  async function tablet() {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
    await ctx.route(URL_ + '*', async r => { calls++; await r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: G.post(r.request().postData() || '{}') }); });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
    await p.goto('file://' + S + '/../../dist/ポイント照合ツール.html');
    await p.waitForFunction(() => /登録済み/.test(document.getElementById('startNote').textContent));
    await p.click('.langBtn[data-lang=ja]'); return p;
  }
  const pin = async (p, c) => { for (const k of c) await p.click(`#pinPad button:text-is("${k}")`); await p.click('#pinOk'); };
  const imp = async (p, files) => {
    await p.click('.tab[data-v=pdf]'); if (await p.locator('#pinPad').isVisible()) await pin(p, '0000');
    await p.setInputFiles('#fileIn', files); await p.waitForFunction(() => /取込完了/.test(document.getElementById('impMsg').textContent));
  };
  const openSet = async p => { await p.click('.tab[data-v=set]'); if (await p.locator('#pinPad').isVisible()) await pin(p, '0000'); };
  const state = p => p.evaluate(() => Object.keys(PDF_INDEX).sort().map(k => k + (PDF_INDEX[k].m ? '(親)' : '(端末)')).join(' '));
  const setup = async (p, key) => { await p.fill('#msUrl', URL_); await p.dispatchEvent('#msUrl', 'change'); await p.fill('#msKey', key); await p.dispatchEvent('#msKey', 'change'); };

  // ---- 親機：4件を登録して、親機の表として送る（細かく分けて送る＝分割のしくみも確かめる）----
  const A = await tablet(); await imp(A, fs.readdirSync(S + '/in').map(f => S + '/in/' + f));
  await openSet(A); await setup(A, 'yomu1'); await A.evaluate(() => { MS_CHUNK = 60000; });
  await A.click('#msAdm summary');
  await A.fill('#msSendKey', 'yomu1'); await A.click('#msSend'); await A.waitForFunction(() => !MS_BUSY && /⚠/.test(document.getElementById('msMsg').textContent));
  console.log('閲覧の合言葉では送れない:', await A.locator('#msMsg').innerText());
  await A.fill('#msSendKey', 'okuru9'); await A.click('#msSend'); await A.waitForFunction(() => /送りました/.test(document.getElementById('msMsg').textContent), null, { timeout: 30000 });
  console.log('親機 送信:', await A.locator('#msMsg').innerText(), '| 分けた数', JSON.parse(G.post(JSON.stringify({ action: 'info', key: 'yomu1' }))).m.parts);
  console.log('親機の表:', await state(A));

  // ---- 子機：端末だけの表（1件）と、親機と同じ品番の古い表（1件）を先に入れておく ----
  const B = await tablet(); await imp(B, [S + '/in2/74043-60020.pdf', S + '/in2/12345-67890.pdf']);
  await openSet(B); await B.fill('#msUrl', URL_); await B.dispatchEvent('#msUrl', 'change');
  await B.fill('#msKey', 'machigai'); await B.dispatchEvent('#msKey', 'change'); await B.click('#msGet'); await B.waitForFunction(() => !MS_BUSY && /⚠/.test(document.getElementById('msMsg').textContent));
  console.log('合言葉ちがい:', await B.locator('#msMsg').innerText());
  await B.fill('#msKey', 'yomu1'); await B.dispatchEvent('#msKey', 'change');
  await B.click('#msGet'); await B.waitForFunction(() => /第1版にしました/.test(document.getElementById('msMsg').textContent), null, { timeout: 30000 });
  console.log('子機 受け取り:', await B.locator('#msMsg').innerText());
  console.log('子機の表:', await state(B));
  await B.click('#msGet'); await B.waitForFunction(() => /最新/.test(document.getElementById('msMsg').textContent));
  console.log('もう一度:', await B.locator('#msMsg').innerText());
  console.log('子機の状態欄:', (await B.locator('#msStat').innerText()).replace(/\n/g, ' / ').replace(/\d{4}-\d\d-\d\d \d\d:\d\d(:\d\d)?/g, '(日時)'));
  await B.screenshot({ path: S + '/master_set.png', clip: await B.locator('#msCard').boundingBox() });

  // ---- 親機：1件消して、もう一度送る（第2版）→ 子機は自動で受け取る ----
  await A.evaluate(async () => { await tx('pdfs', 'readwrite', s => { s.delete('3456789012'); }); await loadPdfIndex(); });
  await A.click('#msSend'); await A.waitForFunction(() => /第2版/.test(document.getElementById('msMsg').textContent), null, { timeout: 30000 });
  await B.click('.tab[data-v=check]'); await B.evaluate(() => msReceive(true)); await B.waitForFunction(() => CF.mver === 2 && !MS_BUSY, null, { timeout: 30000 });
  console.log('子機 自動で第2版:', await state(B));
  console.log('ヘッダー:', await B.locator('#hinfo').innerText());
  // 照合：親機の表はOK・記録に版が残る／端末だけの表もOK
  await B.evaluate(() => onScan('23456-78901')); await B.waitForFunction(() => document.getElementById('jBig').textContent === 'OK', null, { timeout: 20000 });
  await B.waitForTimeout(300); await B.evaluate(() => resetView && resetView());
  await B.evaluate(() => onScan('74043-60020')); await B.waitForFunction(() => document.getElementById('jBig').textContent === 'OK', null, { timeout: 20000 }); await B.waitForTimeout(300);
  console.log('記録の版:', await B.evaluate(async () => (await getLogs(today())).map(r => r.part + '=' + (r.mv || '端末')).join(' ')));
  // オフラインのときは何もしない
  await B.context().setOffline(true); const before = calls; await B.evaluate(() => msReceive(true)); await B.waitForTimeout(300);
  console.log('オフラインで通信しない:', calls === before); await B.context().setOffline(false);
  await B.click('.tab[data-v=pdf]'); if (await B.locator('#pinPad').isVisible()) await pin(B, '0000'); await B.waitForTimeout(800); await B.screenshot({ path: S + '/master_list.png' });
  console.log('一覧の印:', await B.evaluate(() => [...document.querySelectorAll('#pdfList .tag')].map(x => x.textContent).join(',')));
  console.log('古い版の掃除（残る版のフォルダ）:', G.root.folders[0].folders.filter(f => !f.trashed).map(f => f.name).join(','));
  // ---- 親機：子機の親機の表をすべて消す（第3版＝中身なし）→ 子機は親機の表だけ消え、端末だけの表は残る ----
  let cmsg = []; const h = async d => { cmsg.push(d.message().slice(0, 20)); }; A.on('dialog', h);
  await A.click('#msClear'); await A.waitForFunction(() => /第3版/.test(document.getElementById('msMsg').textContent), null, { timeout: 30000 }); A.off('dialog', h);
  console.log('確認の回数', cmsg.length, '|', await A.locator('#msMsg').innerText());
  console.log('親機の表は消えず、端末だけに戻る:', await state(A));
  await B.evaluate(() => msReceive(true)); await B.waitForFunction(() => CF.mver === 3 && !MS_BUSY, null, { timeout: 30000 });
  console.log('子機 第3版:', await state(B));
  console.log('pageerrors:', errs.length ? errs : 'none');
  await b.close();
})();
