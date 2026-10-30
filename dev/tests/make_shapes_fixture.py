"""テスト用のExcel（矢印・×・自由な形だけの図）を作る。実際の資料は使わない。
   使い方: python3 make_shapes_fixture.py もとのxlsx 出力.xlsx"""
import sys, zipfile, re
src, out = sys.argv[1], sys.argv[2]
NS = 'xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"'
def cell(c, r): return '<xdr:col>%d</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>%d</xdr:row><xdr:rowOff>0</xdr:rowOff>' % (c, r)
def sp(i, c1, r1, c2, r2, geom, fill, line):
    f = '<a:solidFill><a:srgbClr val="%s"/></a:solidFill>' % fill if fill else '<a:noFill/>'
    ln = '<a:ln w="38100"><a:solidFill><a:srgbClr val="%s"/></a:solidFill></a:ln>' % line if line else '<a:ln><a:noFill/></a:ln>'
    return ('<xdr:twoCellAnchor><xdr:from>%s</xdr:from><xdr:to>%s</xdr:to><xdr:sp macro="" textlink=""><xdr:nvSpPr><xdr:cNvPr id="%d" name="図形 %d"/><xdr:cNvSpPr/></xdr:nvSpPr>'
            '<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="10" cy="10"/></a:xfrm>%s%s%s</xdr:spPr></xdr:sp><xdr:clientData/></xdr:twoCellAnchor>') % (cell(c1, r1), cell(c2, r2), i, i, geom, f, ln)
prst = lambda n: '<a:prstGeom prst="%s"><a:avLst/></a:prstGeom>' % n
tri = ('<a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="0" t="0" r="r" b="b"/><a:pathLst><a:path w="100" h="100"><a:moveTo><a:pt x="0" y="100"/></a:moveTo>'
       '<a:lnTo><a:pt x="50" y="0"/></a:lnTo><a:lnTo><a:pt x="100" y="100"/></a:lnTo><a:close/></a:path></a:pathLst></a:custGeom>')
items = [sp(2, 1, 1, 3, 6, prst('downArrow'), 'E02020', None), sp(3, 4, 1, 7, 6, prst('mathMultiply'), None, 'E02020'), sp(4, 1, 8, 3, 12, tri, '20A040', None), sp(5, 4, 8, 8, 11, prst('rightArrow'), '2A7FD0', None)]
drawing = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr %s>%s</xdr:wsDr>' % (NS, ''.join(items))
with zipfile.ZipFile(src) as zi, zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as zo:
    for n in zi.namelist():
        if n == 'xl/drawings/drawing1.xml': zo.writestr(n, drawing)
        elif n.startswith('xl/media/'): continue
        elif n == 'xl/drawings/_rels/drawing1.xml.rels': zo.writestr(n, '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>')
        else: zo.writestr(n, zi.read(n))
