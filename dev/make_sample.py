"""PCでポイント表をつくる用のExcelひな形を作る（sample/ に出力）。
  ① ポイント表一覧_ひな形.xlsx … 品番・収容数・ポイント＋10言語の翻訳（入力例つき）
  ② ポイント表一覧_ひな形（自動翻訳）.xlsx … ①と同じ列。翻訳の列に GOOGLETRANSLATE の式が入っている。
     Googleスプレッドシートに取り込むと、日本語のポイントから9言語が自動で入る（そのままダウンロードして .xlsx にすると、訳した結果が残る）
使い方: cd dev && python3 make_sample.py   （openpyxl が必要）"""
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter as L

LANGS = [('英語', 'en', 'Check the direction\nNo scratches or dents\nCheck the stamp'),
 ('ベトナム語', 'vi', 'Kiểm tra chiều\nKhông có vết xước hay vết lõm\nKiểm tra dấu khắc'),
 ('インドネシア語', 'id', 'Cek arah\nTidak ada goresan atau penyok\nCek cap'),
 ('ミャンマー語', 'my', 'ဦးတည်ရာကို စစ်ဆေးပါ\nခြစ်ရာ၊ ချိုင့်ရာ မရှိရ\nတံဆိပ်ခတ်ကို စစ်ဆေးပါ'),
 ('ネパール語', 'ne', 'दिशा जाँच गर्नुहोस्\nखरोंच वा टुटफुट नहुनु\nछाप जाँच गर्नुहोस्'),
 ('タガログ語', 'tl', 'Tingnan ang direksyon\nWalang gasgas o yupi\nTingnan ang tatak'),
 ('ベンガル語', 'bn', 'দিক ঠিক আছে কি না দেখুন\nআঁচড় বা টোল নেই\nছাপ দেখুন'),
 ('モンゴル語', 'mn', 'Чиглэлийг шалга\nЗураас, хонхор байхгүй\nТамгыг шалга'),
 ('ポルトガル語', 'pt', 'Conferir a direção\nSem riscos nem amassados\nConferir a marcação'),
 ('シンハラ語', 'si', 'දිශාව පරීක්ෂා කරන්න\nඉරි හෝ තැලීම් නැත\nසලකුණ පරීක්ෂා කරන්න')]
PTS = '向きを確認する\nキズ・打痕がないこと\n刻印を確認する'
side = Side(style='thin', color='999999'); box = Border(left=side, right=side, top=side, bottom=side)
HEAD = PatternFill('solid', fgColor='4C2A9E'); TR = PatternFill('solid', fgColor='EDE7FB'); JA = PatternFill('solid', fgColor='FFF3C4')

def build(path, auto):
    wb = openpyxl.Workbook(); ws = wb.active; ws.title = 'ポイント表一覧'
    heads = ['品番', '収容数', 'ポイント'] + [n for n, _, _ in LANGS]
    for c, h in enumerate(heads, 1):
        x = ws.cell(1, c, h); x.font = Font(bold=True, color='FFFFFF'); x.fill = HEAD; x.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True); x.border = box
    rows = 50 if auto else 3
    for r in range(2, rows + 2):
        ex = (r == 2)
        for c in range(1, len(heads) + 1):
            x = ws.cell(r, c); x.border = box; x.alignment = Alignment(vertical='top', wrap_text=True)
            if c == 3: x.fill = JA
            if c >= 4: x.fill = TR
        if ex:
            ws.cell(r, 1, '12345-67890'); ws.cell(r, 2, 20); ws.cell(r, 3, PTS)
        if auto:
            for i, (n, code, ex_txt) in enumerate(LANGS):
                ws.cell(r, 4 + i, '=IF($C%d="","",GOOGLETRANSLATE($C%d,"ja","%s"))' % (r, r, code))
        elif ex:
            for i, (n, code, ex_txt) in enumerate(LANGS): ws.cell(r, 4 + i, ex_txt)
    ws.row_dimensions[1].height = 24
    for r in range(2, rows + 2): ws.row_dimensions[r].height = 64
    ws.column_dimensions['A'].width = 16; ws.column_dimensions['B'].width = 9; ws.column_dimensions['C'].width = 30
    for c in range(4, 4 + len(LANGS)): ws.column_dimensions[L(c)].width = 28
    ws.freeze_panes = 'D2'
    g = wb.create_sheet('使い方'); g.column_dimensions['A'].width = 110
    lines = ['【使い方】', '1. 「ポイント表一覧」の2行目の入力例を消して、自分の内容を書きます。1行が1つのポイント表です。',
     '2. 黄色の列に、日本語で入力します。ポイントは、1つのセルに書き、行を変えるときは Alt＋Enter を押します（1行に1ポイント）。',
     '3. 写真は、その行のセルに貼り付けます（4枚まで）。写真がなくてもポイント表はできます。']
    if auto:
        lines += ['4. このファイルを Google ドライブにアップロードして、Googleスプレッドシートで開きます（右クリック → アプリで開く → Googleスプレッドシート）。',
         '5. 薄紫の列（英語〜シンハラ語）に、日本語のポイントから自動で翻訳が入ります（式：GOOGLETRANSLATE）。インターネットが必要です。',
         '6. 翻訳を確認して、必要なら直します（式を消して文字を直接書くと、その文字が使われます）。',
         '7. 「ファイル → ダウンロード → Microsoft Excel (.xlsx)」で保存します。',
         '8. ツールの 設定 → 「Excelの一覧から、まとめてポイント表を作る」にそのファイルを入れます。',
         '※ Excel でそのまま開くと、翻訳の列に「#NAME?」と出ます（Googleスプレッドシートで開くと、翻訳が入ります）。']
    else:
        lines += ['4. 翻訳（英語〜シンハラ語）は、日本語のポイントと同じ順番・同じ行数で書きます。空欄でも登録できます。',
         '   翻訳は、Googleスプレッドシート（GOOGLETRANSLATE）や翻訳サービスで、まとめて作ると速いです。式つきのひな形（自動翻訳）もあります。',
         '5. ツールの 設定 → 「Excelの一覧から、まとめてポイント表を作る」にそのファイルを入れます。']
    lines += ['', '※ 1行目の見出しの文字（品番・収容数・ポイント・英語…）は、変えないでください。']
    for i, t in enumerate(lines, 1):
        g.cell(i, 1, t).alignment = Alignment(wrap_text=True)
    g['A1'].font = Font(bold=True, size=13)
    wb.save(path)

build('sample/ポイント表一覧_ひな形.xlsx', False)
build('sample/ポイント表一覧_ひな形（自動翻訳）.xlsx', True)
print('ok')
