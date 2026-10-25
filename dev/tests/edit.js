const { chromium } = require('playwright'); const S=process.argv[2];
(async()=>{const b=await chromium.launch({executablePath: process.env.CHROME_PATH || undefined});
const p=await b.newPage({viewport:{width:1280,height:800}}); p.on('pageerror',e=>console.log('pageerror',e.message));
await p.goto('file://'+S+'/../../dist/ポイント表照合.html'); await p.waitForFunction(()=>/登録済み/.test(document.getElementById('startNote').textContent)); await p.click('.langBtn[data-lang=ja]');
const pin=async c=>{for(const k of c) await p.click(`#pinPad button:text-is("${k}")`); await p.click('#pinOk');};
const keys=()=>p.evaluate(()=>Object.keys(PDF_INDEX).sort().join(','));
// make one via template
await p.click('.tab[data-v=set]'); await pin('0000');
await p.setInputFiles('#tplPhotoIn',[S+'/ph1.jpg',S+'/ph2.jpg']); await p.waitForTimeout(700);
await p.fill('#tplPn','74043-60020'); await p.fill('#tplQty','20'); await p.fill('#tplPts','向きを確認\nキズなし');
await p.click('#tplSave'); await p.waitForTimeout(600); console.log('made:', await keys());
// import a plain PDF too
await p.click('.tab[data-v=pdf]'); await pin('0000'); await p.setInputFiles('#fileIn',[S+'/in/23456-78901.pdf']); await p.waitForFunction(()=>/取込完了/.test(document.getElementById('impMsg').textContent));
await p.screenshot({path:S+'/edit_cards.png'});
// edit template-made from registration tab
await p.locator('#pdfList .pcard',{hasText:'74043'}).locator('[data-edit]').click(); await p.waitForTimeout(1200);
console.log('edit loaded:', JSON.stringify({view:await p.evaluate(()=>document.querySelector('.tab.on').dataset.v), bar:await p.textContent('#editName'), pn:await p.inputValue('#tplPn'), qty:await p.inputValue('#tplQty'), pts:await p.inputValue('#tplPts'), photos:await p.evaluate(()=>TPL.imgs.length), btn:await p.textContent('#tplSave')}));
await p.locator('#tplCard').scrollIntoViewIfNeeded(); await p.screenshot({path:S+'/edit_form.png'});
await p.fill('#tplQty','25'); await p.fill('#tplPts','向きを確認\nキズなし\n刻印を確認'); await p.click('#tplSave'); await p.waitForTimeout(700);
console.log('overwrite:', await p.textContent('#tplMsg'), '| keys', await keys(), '| src qty', await p.evaluate(async()=>(await getPdf('7404360020')).src.qty), '| bar hidden', await p.evaluate(()=>document.getElementById('editBar').hidden));
// edit again and change part number
await p.click('.tab[data-v=pdf]'); await pin('0000'); await p.locator('#pdfList .pcard',{hasText:'74043'}).locator('[data-edit]').click(); await p.waitForTimeout(1200);
await p.fill('#tplPn','74043-60030'); p.once('dialog',d=>{console.log('rename confirm:', d.message().split('\n')[0]); d.accept();}); await p.click('#tplSave'); await p.waitForTimeout(700); console.log('renamed keys:', await keys());
// edit imported pdf (no src)
await p.click('.tab[data-v=pdf]'); await pin('0000'); await p.locator('#pdfList .pcard',{hasText:'23456'}).locator('[data-edit]').click(); await p.waitForTimeout(1500);
console.log('imported edit:', JSON.stringify({pn:await p.inputValue('#tplPn'), photos:await p.evaluate(()=>TPL.imgs.length), msg:(await p.textContent('#tplPhotoMsg')).slice(0,40)}));
p.once('dialog',d=>d.accept()); await p.click('#editCancel'); console.log('cancel -> bar hidden', await p.evaluate(()=>document.getElementById('editBar').hidden), 'keys', await keys());
// badge list edit with pw
await p.click('.tab[data-v=check]'); await p.click('#pCountBadge'); await p.waitForTimeout(300);
await p.locator('#plGrid [data-pledit]').first().click(); await pin('0000'); await p.waitForTimeout(1200);
console.log('badge edit -> view', await p.evaluate(()=>document.querySelector('.tab.on').dataset.v), 'editing', await p.textContent('#editName'));
await b.close();})();
