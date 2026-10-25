// すべての回帰テストを順番に実行する（ビルド後に実行）
//   cd dev && npx playwright install chromium && npm test
//   既存のChromeを使う場合: CHROME_PATH=/path/to/chrome npm test
const { execFileSync } = require('child_process'); const path = require('path');
const F = path.join(__dirname, 'fixtures');
const tests = ['e2e', 'toyo', 'combo', 'sub', 'edit', 'del', 'zoom', 'lock', 'pack', 'tplpdf', 'lang4', 'lang5'];
let ng = 0;
for (const t of tests) {
  process.stdout.write('\n===== ' + t + ' =====\n');
  try { process.stdout.write(execFileSync('node', [path.join(__dirname, t + '.js'), F], { encoding: 'utf8', timeout: 180000, env: { ...process.env, LANG: 'C.UTF-8' } })); }
  catch (e) { ng++; process.stdout.write((e.stdout || '') + '\n!! FAILED: ' + t + '\n' + (e.stderr || '').slice(0, 800)); }
}
console.log('\n' + (ng ? ng + ' test(s) failed' : 'all tests finished'));
process.exit(ng ? 1 : 0);
