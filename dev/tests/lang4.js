const { chromium } = require('playwright'); const S=process.argv[2]; const fs=require('fs');
(async()=>{const b=await chromium.launch({executablePath: process.env.CHROME_PATH || undefined});
const p=await b.newPage({viewport:{width:1280,height:800}}); p.on('pageerror',e=>console.log('PAGEERROR',e.message));
await p.goto('file://'+S+'/../../dist/ポイント表照合.html'); await p.waitForFunction(()=>/登録済み/.test(document.getElementById('startNote').textContent));
await p.screenshot({path:S+'/l4_start.png'});
const pin=async(c)=>{for(const k of c) await p.click(`#pinPad button:text-is("${k}")`); await p.click('#pinOk');};
await p.click('.langBtn[data-lang=ja]'); await p.click('.tab[data-v=pdf]'); await pin('0000');
await p.setInputFiles('#fileIn',fs.readdirSync(S+'/in').map(f=>S+'/in/'+f)); await p.waitForFunction(()=>/取込完了/.test(document.getElementById('impMsg').textContent));
const jpRe=/[぀-ヿ一-鿿]/;
for (const L of ['id','tl','en','ja']){
  await p.click('.tab[data-v=check]'); await p.click('#langSw'); await p.click(`.langBtn[data-lang=${L}]`);
  await p.evaluate(()=>{document.getElementById('toast').style.display='none'; resetView();});
  await p.evaluate(()=>onScan('12345-67890')); await p.waitForFunction(()=>document.getElementById('judge').classList.contains('ok'));
  console.log(L,'OK:', await p.textContent('#jBig'),'|',await p.textContent('#jMsg'),'| hinfo:',await p.textContent('#hinfo'));
  await p.evaluate(()=>onScan('99999-99999')); await p.waitForFunction(()=>document.getElementById('ng').classList.contains('on'));
  console.log(L,'NG:', await p.textContent('#ngWhy'));
  for(const k of ['1','2','3','4','OK']) await p.click(`#pad button:text-is("${k}")`); await p.waitForTimeout(200);
  for (const v of ['pdf','log','set']){
    await p.click(`.tab[data-v=${v}]`); if(await p.isVisible('#pinPad')) await pin('0000'); await p.waitForTimeout(400);
    const txt=await p.evaluate(v=>{const e=document.getElementById('v-'+v); return e.innerText;},v);
    const jp = L==='ja'?[]: txt.split('\n').filter(x=>jpRe.test(x));
    console.log(L,v,'japanese lines:',jp.length, jp.slice(0,8).join(' ‖ '));
    await p.screenshot({path:S+`/l4_${L}_${v}.png`, fullPage:true});
  }
}
await b.close();})();
