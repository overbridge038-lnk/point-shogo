// 矢印・×・自由な形（custGeom）が四角ではなく、その形で描かれる（Excelの図形の形に対応）
const { chromium } = require('playwright'); const S = process.argv[2]; const fs = require('fs');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined }); const p = await b.newPage({ viewport: { width: 900, height: 600 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + S + '/../../dist/ポイント表照合.html'); await p.waitForFunction(() => window.XV);
  const buf = [...fs.readFileSync(S + '/図形.xlsx')];
  const r = await p.evaluate(async arr => {
    const sh = await XV.parse(new Uint8Array(arr).buffer), host = document.createElement('div'); document.body.appendChild(host); XV.render(sh, host);
    const svgs = [...host.querySelectorAll('svg')].map(s => s.querySelector('path') ? s.querySelector('path').getAttribute('d').replace(/[\d.]+/g, '#').length : 0);
    return { shapes: sh[0].shapes.map(x => x.geom + (x.cust ? '+cust' : '')), svgs: svgs.length, paths: host.querySelectorAll('svg path').length, plain: host.querySelectorAll('.xlsheet > div').length };
  }, buf);
  console.log('図形の読み取り:', r.shapes.join(', '), '| SVGの形', r.paths, '個（4個なら全部その形で描けた）');
  console.log('pageerrors:', errs.length ? errs : 'none'); await b.close();
  if (r.paths !== 4) { console.log('!! FAILED shapes'); process.exit(1); }
})();
