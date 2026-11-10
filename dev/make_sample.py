"""PCでポイント表をつくる用のExcelひな形を作る（sample/ に出力）。
  ① ポイント表一覧_ひな形.xlsx … 品番・収容数・ポイント＋10言語の翻訳（入力例つき）
  ② ポイント表一覧_ひな形（自動翻訳）.xlsx … ①と同じ列。翻訳の列に GOOGLETRANSLATE の式が入っている。
     Googleスプレッドシートに取り込むと、日本語のポイントから10言語が自動で入る（そのままダウンロードして .xlsx にすると、訳した結果が残る）
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
    PINK = PatternFill('solid', fgColor='FDE7EC'); PINKH = PatternFill('solid', fgColor='E11D48'); dash = Side(style='dashed', color='E11D48'); dbox = Border(left=dash, right=dash, top=dash, bottom=dash)
    # 列：A 品番 / B 収容数 / C ハンガー種類 / D 掛け数 / E〜H 写真①〜④を貼る場所（ツールは読まない）/ I〜P ポイント1〜8（1つのセルに1つ。改行の操作はいらない）/ Q〜Z 翻訳10言語。
    # ツールは「見出しの文字」で列を探すので、順番を変えても読める
    NP = 8
    heads = ['品番', '収容数', 'ハンガー種類', '掛け数'] + ['📷 写真%s' % x for x in '①②③④'] + ['ポイント%d' % (i + 1) for i in range(NP)] + [n for n, _, _ in LANGS]
    PH0 = 5; P0 = PH0 + 4; L0 = P0 + NP   # 写真①の列(E)、ポイント1の列(I)、英語の列(Q)
    HR = 2; R0 = HR + 1; rows = 50 if auto else 3
    banner = ('📷 写真の貼りかた：E列〜H列（ピンクのセル）に、その品番の行に合わせて貼ります。\n'
              '　① 挿入 → 画像 → このデバイス で写真を選ぶ　② 写真の左上の角を、その行のピンクのセルに置く（写真は小さくしてOK）　③ 1行に4枚まで（左から ①②③④）。次の品番は次の行に。写真がなくてもポイント表はできます。\n'
              '✏ 入力のしかた：黄色＝日本語で入力。ポイントは「ポイント1」「ポイント2」…のセルに、1つずつ書きます（8つまで。改行の操作はいりません。Tab キーで右のセルへ）。多いと文字が小さくなるので、短く書くのがおすすめです。薄紫＝翻訳（空欄でもOK。ツールの「🌐 空の翻訳を自動で入れる」で入ります）。\n'
              '※ 見出し（品番・収容数・ハンガー種類・掛け数・ポイント1〜8・各言語）の文字は変えないでください。3行目の入力例は消して、自分の内容を書きます。')
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=L0 - 1)
    bc = ws.cell(1, 1, banner); bc.alignment = Alignment(wrap_text=True, vertical='center', horizontal='left'); bc.fill = PatternFill('solid', fgColor='FFF9DB'); bc.font = Font(size=11)
    ws.row_dimensions[1].height = 100
    last = L0 - 1
    for c in range(1, last + 1): ws.cell(1, c).border = Border(left=Side(style='medium', color='D4A800') if c == 1 else None, right=Side(style='medium', color='D4A800') if c == last else None, top=Side(style='medium', color='D4A800'), bottom=Side(style='medium', color='D4A800'))
    for c, h in enumerate(heads, 1):
        x = ws.cell(HR, c, h); x.font = Font(bold=True, color='FFFFFF'); x.fill = PINKH if PH0 <= c < P0 else HEAD; x.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True); x.border = box
    for r in range(R0, R0 + rows):
        ex = (r == R0)
        for c in range(1, len(heads) + 1):
            x = ws.cell(r, c); x.border = box; x.alignment = Alignment(vertical='top', wrap_text=True, horizontal='left')
            if P0 <= c < L0: x.fill = JA
            if PH0 <= c < P0: x.fill = PINK; x.border = dbox
            if c >= L0: x.fill = TR
        if ex:
            ws.cell(r, 1, '12345-67890'); ws.cell(r, 2, 20); ws.cell(r, 3, 'A型'); ws.cell(r, 4, 6)
            for i, t in enumerate(PTS.split('\n')): ws.cell(r, P0 + i, t)
            for i in range(4):
                x = ws.cell(r, PH0 + i, '写真%sを\nここに貼る\n（左上の角を\nこのセルに）' % '①②③④'[i]); x.font = Font(size=9, color='E11D48'); x.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
        for i, (n, code, ex_txt) in enumerate(LANGS):
            if auto:
                cells = ','.join('IF($%s%d="","",GOOGLETRANSLATE($%s%d,"ja","%s"))' % (L(P0 + k), r, L(P0 + k), r, code) for k in range(NP))
                ws.cell(r, L0 + i, '=IF(COUNTA($%s%d:$%s%d)=0,"",TEXTJOIN(CHAR(10),TRUE,%s))' % (L(P0), r, L(L0 - 1), r, cells))
            elif ex: ws.cell(r, L0 + i, ex_txt)
    ws.row_dimensions[HR].height = 24
    for r in range(R0, R0 + rows): ws.row_dimensions[r].height = 80
    ws.column_dimensions['A'].width = 16; ws.column_dimensions['B'].width = 9; ws.column_dimensions['C'].width = 16; ws.column_dimensions['D'].width = 9
    for c in range(PH0, P0): ws.column_dimensions[L(c)].width = 16
    for c in range(P0, L0): ws.column_dimensions[L(c)].width = 22
    for c in range(L0, L0 + len(LANGS)): ws.column_dimensions[L(c)].width = 28
    ws.freeze_panes = 'A%d' % R0
    g = wb.create_sheet('使い方'); g.column_dimensions['A'].width = 120
    lines = ['【使い方】', '1. 「ポイント表一覧」の3行目の入力例を消して、自分の内容を書きます。1行が1つのポイント表です。',
     '2. 黄色のセルに、日本語で入力します（ハンガー種類・掛け数は空欄でもOK）。ポイントは「ポイント1」「ポイント2」…のセルに、1つずつ書きます（8つまで。改行の操作はいりません。Tab キーで右のセルへ進めます）。9つ以上のときは、いちばん右の列に「ポイント9」「ポイント10」…と見出しを付けて書きます。多いと、ポイント表の文字が小さくなるので、短く書くのがおすすめです。',
     '3. 写真は、E列〜H列（ピンクのセル）に、その品番の行に合わせて貼り付けます（4枚まで）。写真の左上の角が、その行のセルの中にあれば、その行の写真になります。左にある写真から順に使います。写真は小さくしてOKです。写真がなくてもポイント表はできます。']
    if auto:
        lines += ['4. このファイルを Google ドライブにアップロードして、Googleスプレッドシートで開きます（右クリック → アプリで開く → Googleスプレッドシート）。',
         '5. 薄紫の列（英語〜シンハラ語）に、日本語のポイントから自動で翻訳が入ります（式：GOOGLETRANSLATE）。インターネットが必要です。',
         '6. 翻訳を確認して、必要なら直します（式を消して文字を直接書くと、その文字が使われます）。',
         '7. 「ファイル → ダウンロード → Microsoft Excel (.xlsx)」で保存します。',
         '8. ツールの 設定 → 「Excelの一覧から、まとめてポイント表を作る」にそのファイルを入れます。',
         '※ Excel でそのまま開くと、翻訳の列に「#NAME?」と出ます（Googleスプレッドシートで開くと、翻訳が入ります）。']
    else:
        lines += ['4. 翻訳（英語〜シンハラ語）は、日本語のポイントと同じ順番・同じ行数で書きます（1つのセルに、行を変えるときは Alt＋Enter）。空欄でも登録できます。',
         '   翻訳は、ツールの「🌐 空の翻訳を自動で入れる」で、まとめて入れられます（オンラインのとき）。Googleスプレッドシートで作る「ひな形（自動翻訳）」もあります。',
         '5. ツールの 設定 → 「Excelの一覧から、まとめてポイント表を作る」にそのファイルを入れます。']
    lines += ['', '※ 見出しの文字（品番・収容数・ハンガー種類・掛け数・ポイント1〜8・英語…）は、変えないでください。']
    for i, t in enumerate(lines, 1):
        g.cell(i, 1, t).alignment = Alignment(wrap_text=True)
    g['A1'].font = Font(bold=True, size=13)
    wb.save(path)

build('sample/ポイント表一覧_ひな形.xlsx', False)
build('sample/ポイント表一覧_ひな形（自動翻訳）.xlsx', True)
print('ok')
