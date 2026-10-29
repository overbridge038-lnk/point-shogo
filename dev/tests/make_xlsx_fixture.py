"""テスト用のExcel（図形・矢印・回転した写真だけで作った図）を作る。実際の資料は使わない。
   使い方: python3 make_xlsx_fixture.py 出力.xlsx 写真.jpg"""
import sys, zipfile
out, jpg = sys.argv[1], sys.argv[2]
NS = 'xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
def anchor(x, y, cx, cy, body):
    return ('<xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>0</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>'
            '<xdr:to><xdr:col>8</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>20</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>' + body + '<xdr:clientData/></xdr:twoCellAnchor>')
def box(i, x, y, cx, cy, text, sz=1400, fill=None, line=False, ptag=''):
    f = '<a:solidFill><a:schemeClr val="lt1"/></a:solidFill>' if fill else '<a:noFill/>'
    ln = '<a:ln w="9525"><a:solidFill><a:srgbClr val="000000"/></a:solidFill></a:ln>' if line else '<a:ln w="0"><a:noFill/></a:ln>'
    return ('<xdr:sp macro="" textlink=""><xdr:nvSpPr><xdr:cNvPr id="%d" name="テキスト ボックス %d"/><xdr:cNvSpPr txBox="1"/></xdr:nvSpPr><xdr:spPr><a:xfrm><a:off x="%d" y="%d"/><a:ext cx="%d" cy="%d"/></a:xfrm>'
            '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>%s%s</xdr:spPr><xdr:style><a:lnRef idx="0"><a:scrgbClr r="0" g="0" b="0"/></a:lnRef><a:fillRef idx="0"><a:scrgbClr r="0" g="0" b="0"/></a:fillRef><a:effectRef idx="0"><a:scrgbClr r="0" g="0" b="0"/></a:effectRef><a:fontRef idx="minor"><a:schemeClr val="tx1"/></a:fontRef></xdr:style>'
            '<xdr:txBody><a:bodyPr wrap="square" anchor="t"/><a:lstStyle/><a:p><a:r><a:rPr lang="ja-JP" sz="%d"/><a:t>%s</a:t></a:r></a:p></xdr:txBody></xdr:sp>') % (i, i, x, y, cx, cy, f, ln, sz, text)
arrow = ('<xdr:cxnSp macro=""><xdr:nvCxnSpPr><xdr:cNvPr id="20" name="直線矢印コネクタ 19"/><xdr:cNvCxnSpPr/></xdr:nvCxnSpPr><xdr:spPr><a:xfrm flipV="1"><a:off x="1500000" y="1800000"/><a:ext cx="900000" cy="300000"/></a:xfrm>'
         '<a:prstGeom prst="straightConnector1"><a:avLst/></a:prstGeom><a:ln><a:tailEnd type="arrow"/></a:ln></xdr:spPr><xdr:style><a:lnRef idx="1"><a:schemeClr val="accent1"/></a:lnRef><a:fillRef idx="0"><a:schemeClr val="accent1"/></a:fillRef><a:effectRef idx="0"><a:schemeClr val="accent1"/></a:effectRef><a:fontRef idx="minor"><a:schemeClr val="tx1"/></a:fontRef></xdr:style></xdr:cxnSp>')
pic = ('<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="30" name="図 1"/><xdr:cNvPicPr/></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>'
       '<xdr:spPr><a:xfrm rot="5400000"><a:off x="200000" y="900000"/><a:ext cx="1500000" cy="1200000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic>')
items = [box(2, 500000, 100000, 2400000, 420000, 'テスト用かんばん回収', 2000), box(3, 100000, 600000, 365760, 373380, '①', 1600, True, True), pic, arrow,
         box(5, 2600000, 900000, 2200000, 900000, '向きを確認する'), box(6, 2600000, 1900000, 2200000, 420000, '枚数を記入する')]
drawing = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr %s>%s</xdr:wsDr>' % (NS, ''.join(anchor(0, 0, 0, 0, b) for b in items))
files = {
 '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpeg" ContentType="image/jpeg"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>',
 '_rels/.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
 'xl/workbook.xml': '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="かんばん回収" sheetId="1" r:id="rId1"/></sheets></workbook>',
 'xl/_rels/workbook.xml.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
 'xl/worksheets/sheet1.xml': '<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><dimension ref="A1"/><sheetFormatPr defaultRowHeight="13.5"/><sheetData/><drawing r:id="rId1"/></worksheet>',
 'xl/worksheets/_rels/sheet1.xml.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>',
 'xl/drawings/drawing1.xml': drawing,
 'xl/drawings/_rels/drawing1.xml.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.jpeg"/></Relationships>',
}
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for k, v in files.items(): z.writestr(k, v)
    z.write(jpg, 'xl/media/image1.jpeg')
