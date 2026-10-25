"""ポイント表照合をビルドする。
  src.html + pdf.js（pdfjs-dist 6.2.108）+ qrdecode.js を1つのHTMLにまとめる。
  出力1: dev/dist/ポイント表照合.html … 1ファイル版（USBなどで配る用）
  出力2: ../index.html               … GitHub Pages 用（PWAのmanifest・Service Worker登録つき）
使い方:  cd dev && npm install && python build.py
"""
import base64, pathlib, sys
d = pathlib.Path(__file__).resolve().parent
cands = [d / 'node_modules/pdfjs-dist/legacy/build', pathlib.Path('/opt/npm-tools/node_modules/pdfjs-dist/legacy/build')]
P = next((c for c in cands if (c / 'pdf.min.mjs').exists()), None)
if not P:
    sys.exit('pdfjs-dist が見つかりません。dev フォルダで npm install を実行してください')
h = (d / 'src.html').read_text(encoding='utf-8')
h = h.replace('@@PDFJS@@', base64.b64encode((P / 'pdf.min.mjs').read_bytes()).decode())
h = h.replace('@@WORKER@@', base64.b64encode((P / 'pdf.worker.min.mjs').read_bytes()).decode())
h = h.replace('@@QRDECODE@@', (d / 'qrdecode.js').read_text(encoding='utf-8'))
(d / 'dist').mkdir(exist_ok=True)
(d / 'dist/ポイント表照合.html').write_text(h, encoding='utf-8')

head = ('<link rel="manifest" href="manifest.webmanifest">\n<meta name="theme-color" content="#8B5CF6">\n'
        '<link rel="icon" href="icon-192.png">\n<link rel="apple-touch-icon" href="icon-192.png">\n')
sw = ("<script>\nif ('serviceWorker' in navigator && location.protocol === 'https:') {\n"
      "  window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });\n"
      "}\n</script>\n")
p = h.replace('</head>', head + '</head>', 1)
i = p.rindex('</body>'); p = p[:i] + sw + p[i:]
(d.parent / 'index.html').write_text(p, encoding='utf-8')
print('built', len(h) // 1024, 'KB  ->  dev/dist/ポイント表照合.html , index.html')
