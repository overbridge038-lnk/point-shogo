/* 自作のExcel(.xlsx)読み取り・表示部品。通信なし・外部部品なし。
   ZIPをほどき（ブラウザ標準の DecompressionStream）、セルの文字・色・罫線・結合・列幅・行高と、
   シートに貼ってある図形（文字の箱・矢印・四角）・写真（回転・切り抜きも）を読む。計算式は、保存されている計算結果をそのまま読む。
   使い方： const sheets = await XV.parse(arrayBuffer);   // 読み取り（一覧からの作成にも使う）
            XV.render(sheets, 入れ物の要素);               // 画面に描く
   sheets[i] = { name, cells: { "行,列": { v:文字, s:書式番号, r:行, c:列 } }, maxR, maxC（文字のある範囲）,
                 images: [{ url, from:{r,c} }]（一覧作成用：行・列は、cells は1から、images の from は0から数える）, … } */
(function (g) {
  'use strict';
  var NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  var EMU = 9525; // 1px = 9525 EMU

  // ---------- ZIP ----------
  function u16(d, o) { return d[o] | (d[o + 1] << 8); }
  function u32(d, o) { return (d[o] | (d[o + 1] << 8) | (d[o + 2] << 16) | (d[o + 3] << 24)) >>> 0; }
  async function inflate(raw) {
    var ds = new DecompressionStream('deflate-raw');
    return new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(ds)).arrayBuffer());
  }
  async function unzip(buf) {
    var d = new Uint8Array(buf), e = d.length - 22;
    while (e >= 0 && u32(d, e) !== 0x06054b50) e--;
    if (e < 0) throw new Error('not zip');
    var n = u16(d, e + 10), o = u32(d, e + 16), files = {};
    for (var i = 0; i < n; i++) {
      if (u32(d, o) !== 0x02014b50) throw new Error('bad zip');
      var method = u16(d, o + 10), csize = u32(d, o + 20), nlen = u16(d, o + 28), xlen = u16(d, o + 30), clen = u16(d, o + 32), lho = u32(d, o + 42);
      files[new TextDecoder().decode(d.subarray(o + 46, o + 46 + nlen))] = { method: method, csize: csize, lho: lho };
      o += 46 + nlen + xlen + clen;
    }
    return {
      bytes: async function (name) {
        var f = files[name]; if (!f) return null;
        var p = f.lho, start = p + 30 + u16(d, p + 26) + u16(d, p + 28), raw = d.subarray(start, start + f.csize);
        return f.method === 0 ? raw : f.method === 8 ? await inflate(raw) : null;
      },
      text: async function (name) { var b = await this.bytes(name); return b ? new TextDecoder('utf-8').decode(b) : null; }
    };
  }
  function xml(s) { return s ? new DOMParser().parseFromString(s, 'application/xml') : null; }
  function kids(el, name) { var r = []; if (!el) return r; for (var c = el.firstElementChild; c; c = c.nextElementSibling) if (c.localName === name) r.push(c); return r; }
  function kid(el, name) { return kids(el, name)[0] || null; }
  function attr(el, name, def) { var v = el && el.getAttribute(name); return v === null || v === undefined ? def : v; }
  function resolve(base, target) {
    if (target.charAt(0) === '/') return target.slice(1);
    var parts = (base.slice(0, base.lastIndexOf('/') + 1) + target).split('/'), out = [];
    parts.forEach(function (x) { if (x === '..') out.pop(); else if (x && x !== '.') out.push(x); });
    return out.join('/');
  }
  async function rels(z, path) { // path のファイルに付いている関係（rId → {target, type}）
    var rp = path.slice(0, path.lastIndexOf('/') + 1) + '_rels/' + path.slice(path.lastIndexOf('/') + 1) + '.rels', doc = xml(await z.text(rp)), m = {};
    if (doc) kids(doc.documentElement, 'Relationship').forEach(function (r) { m[r.getAttribute('Id')] = { target: resolve(path, r.getAttribute('Target')), type: r.getAttribute('Type') || '' }; });
    return m;
  }

  // ---------- 色 ----------
  var INDEXED = ['000000', 'FFFFFF', 'FF0000', '00FF00', '0000FF', 'FFFF00', 'FF00FF', '00FFFF', '000000', 'FFFFFF', 'FF0000', '00FF00', '0000FF', 'FFFF00', 'FF00FF', '00FFFF',
    '800000', '008000', '000080', '808000', '800080', '008080', 'C0C0C0', '808080', '9999FF', '993366', 'FFFFCC', 'CCFFFF', '660066', 'FF8080', '0066CC', 'CCCCFF',
    '000080', 'FF00FF', 'FFFF00', '00FFFF', '800080', '800000', '008080', '0000FF', '00CCFF', 'CCFFFF', 'CCFFCC', 'FFFF99', '99CCFF', 'FF99CC', 'CC99FF', 'FFCC99',
    '3366FF', '33CCCC', '99CC00', 'FFCC00', 'FF9900', 'FF6600', '666699', '969696', '003366', '339966', '003300', '333300', '993300', '993366', '333399', '333333'];
  var THEME_ORDER = ['lt1', 'dk1', 'lt2', 'dk2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink']; // セルの色の theme 番号の順
  var THEME_DEF = { lt1: 'FFFFFF', dk1: '000000', lt2: 'E7E6E6', dk2: '44546A', accent1: '4472C4', accent2: 'ED7D31', accent3: 'A5A5A5', accent4: 'FFC000', accent5: '5B9BD5', accent6: '70AD47', hlink: '0563C1', folHlink: '954F72' };
  var SCHEME_ALIAS = { tx1: 'dk1', bg1: 'lt1', tx2: 'dk2', bg2: 'lt2' };
  function toRgb(hex) { return [0, 2, 4].map(function (i) { return parseInt(hex.substr(i, 2), 16); }); }
  function toHex(c) { return '#' + c.map(function (v) { return ('0' + Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2); }).join(''); }
  function rgb2hsl(c) {
    var r = c[0] / 255, g = c[1] / 255, b = c[2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, h = 0, s = 0;
    if (mx !== mn) { var d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; }
    return [h, s, l];
  }
  function hsl2rgb(c) {
    var h = c[0], s = c[1], l = c[2];
    if (!s) return [l * 255, l * 255, l * 255];
    function f(p, q, t) { if (t < 0) t += 1; if (t > 1) t -= 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    return [f(p, q, h + 1 / 3) * 255, f(p, q, h) * 255, f(p, q, h - 1 / 3) * 255];
  }
  /** セルの色（<color rgb/theme/indexed tint>） */
  function cellColor(el, theme) {
    if (!el) return null;
    var hex = null;
    if (el.getAttribute('rgb')) hex = el.getAttribute('rgb').slice(-6);
    else if (el.getAttribute('theme') !== null) hex = theme[THEME_ORDER[+el.getAttribute('theme')]] || '000000';
    else if (el.getAttribute('indexed') !== null) hex = INDEXED[+el.getAttribute('indexed')] || '000000';
    else return null;
    var t = parseFloat(el.getAttribute('tint') || '0'), c = toRgb(hex);
    if (t) c = c.map(function (v) { return t < 0 ? v * (1 + t) : v + (255 - v) * t; });
    return toHex(c);
  }
  /** 図形の色（<a:schemeClr val=…> など。明るさの変化つき）。{ color, alpha } */
  function drawColor(el, theme) {
    if (!el) return null;
    var base = null, n = el.localName, v = el.getAttribute('val');
    if (n === 'srgbClr') base = toRgb(v);
    else if (n === 'schemeClr') base = toRgb(theme[SCHEME_ALIAS[v] || v] || '000000');
    else if (n === 'sysClr') base = toRgb(el.getAttribute('lastClr') || (v === 'window' ? 'FFFFFF' : '000000'));
    else if (n === 'scrgbClr') base = [+el.getAttribute('r') / 1000, +el.getAttribute('g') / 1000, +el.getAttribute('b') / 1000].map(function (x) { return x * 2.55; });
    else if (n === 'prstClr') base = v === 'white' ? [255, 255, 255] : v === 'red' ? [255, 0, 0] : v === 'yellow' ? [255, 255, 0] : [0, 0, 0];
    if (!base) return null;
    var c = base, alpha = 1;
    for (var k = el.firstElementChild; k; k = k.nextElementSibling) {
      var x = +k.getAttribute('val') / 100000;
      if (k.localName === 'lumMod') { var h = rgb2hsl(c); h[2] = Math.min(1, h[2] * x); c = hsl2rgb(h); }
      else if (k.localName === 'lumOff') { var h2 = rgb2hsl(c); h2[2] = Math.max(0, Math.min(1, h2[2] + x)); c = hsl2rgb(h2); }
      else if (k.localName === 'shade') c = c.map(function (q) { return q * x; });
      else if (k.localName === 'tint') c = c.map(function (q) { return 255 - (255 - q) * x; });
      else if (k.localName === 'alpha') alpha = x;
    }
    return { color: toHex(c), alpha: alpha };
  }
  async function readTheme(z, wbRels) {
    var theme = {}, lines = [];
    for (var k in THEME_DEF) theme[k] = THEME_DEF[k];
    for (var id in wbRels) if (/theme$/.test(wbRels[id].type)) {
      var doc = xml(await z.text(wbRels[id].target)); if (!doc) break;
      var cs = doc.getElementsByTagNameNS('*', 'clrScheme')[0];
      if (cs) THEME_ORDER.forEach(function (nm) {
        var nd = kid(cs, nm), c = nd && nd.firstElementChild; if (!c) return;
        theme[nm] = c.localName === 'srgbClr' ? c.getAttribute('val') : (c.getAttribute('lastClr') || theme[nm]);
      });
      var ls = doc.getElementsByTagNameNS('*', 'lnStyleLst')[0];
      if (ls) kids(ls, 'ln').forEach(function (l) { lines.push(+l.getAttribute('w') || 12700); });
      break;
    }
    theme._lines = lines.length ? lines : [6350, 12700, 19050];
    return theme;
  }

  // ---------- 書式（styles.xml） ----------
  var BUILTIN_NUM = { 9: '0%', 10: '0.00%', 14: 'yyyy/m/d', 15: 'd-mmm-yy', 16: 'd-mmm', 17: 'mmm-yy', 22: 'yyyy/m/d h:mm', 3: '#,##0', 4: '#,##0.00', 37: '#,##0', 38: '#,##0', 39: '#,##0.00', 40: '#,##0.00', 1: '0', 2: '0.00' };
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmtNumber(v, code) {
    var n = parseFloat(v); if (isNaN(n)) return String(v);
    code = (code || 'General').split(';')[0].replace(/\[[^\]]*\]/g, '').replace(/"/g, '');
    if (code === 'General' || code === '@') return String(Math.round(n * 1e10) / 1e10);
    if (/[ymdh]/i.test(code) && !/[0#]/.test(code)) { // 日付・時刻
      var d = new Date(Math.round((n - 25569) * 86400000)), Y = d.getUTCFullYear(), M = d.getUTCMonth() + 1, D = d.getUTCDate(), h = d.getUTCHours(), mi = d.getUTCMinutes(), hasDate = /[yd]/i.test(code);
      return code.replace(/yyyy|yy/gi, function (m) { return m.length === 4 ? Y : pad(Y % 100); })
        .replace(/mm|m/g, function (m) { return hasDate ? (m === 'mm' ? pad(M) : String(M)) : pad(mi); })
        .replace(/dd|d/gi, function (m) { return m.length === 2 ? pad(D) : String(D); })
        .replace(/hh|h/gi, function (m) { return m.length === 2 ? pad(h) : String(h); }).replace(/\\/g, '');
    }
    var pct = /%/.test(code), dec = (code.split('.')[1] || '').replace(/[^0#]/g, '').length, comma = /,/.test(code.split('.')[0]);
    if (pct) n *= 100;
    var s = n.toFixed(dec); if (comma) { var p = s.split('.'); p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ','); s = p.join('.'); }
    return s + (pct ? '%' : '');
  }
  function readStyles(doc, theme) {
    var st = { fonts: [], fills: [], borders: [], xfs: [], numFmts: {} };
    if (!doc) return st;
    var root = doc.documentElement;
    kids(kid(root, 'numFmts'), 'numFmt').forEach(function (n) { st.numFmts[n.getAttribute('numFmtId')] = n.getAttribute('formatCode'); });
    kids(kid(root, 'fonts'), 'font').forEach(function (f) {
      var b = kid(f, 'b'), sz = kid(f, 'sz');
      st.fonts.push({ b: !!b && b.getAttribute('val') !== '0', i: !!kid(f, 'i'), u: !!kid(f, 'u'), s: !!kid(f, 'strike'), sz: sz ? parseFloat(sz.getAttribute('val')) : 11, color: cellColor(kid(f, 'color'), theme) });
    });
    kids(kid(root, 'fills'), 'fill').forEach(function (f) {
      var pf = kid(f, 'patternFill'), t = pf && pf.getAttribute('patternType');
      st.fills.push(pf && t && t !== 'none' ? (cellColor(kid(pf, 'fgColor'), theme) || null) : null);
    });
    kids(kid(root, 'borders'), 'border').forEach(function (b) {
      var o = {};
      ['left', 'right', 'top', 'bottom'].forEach(function (side) { var e = kid(b, side); if (e && e.getAttribute('style')) o[side] = { style: e.getAttribute('style'), color: cellColor(kid(e, 'color'), theme) || '#000000' }; });
      st.borders.push(o);
    });
    kids(kid(root, 'cellXfs'), 'xf').forEach(function (x) {
      var al = kid(x, 'alignment');
      st.xfs.push({ num: x.getAttribute('numFmtId') || '0', font: +(x.getAttribute('fontId') || 0), fill: +(x.getAttribute('fillId') || 0), border: +(x.getAttribute('borderId') || 0),
        h: attr(al, 'horizontal', null), v: attr(al, 'vertical', null), wrap: !!al && al.getAttribute('wrapText') === '1', indent: +attr(al, 'indent', 0) });
    });
    return st;
  }

  // ---------- シート ----------
  function colNum(ref) { var m = /^([A-Z]+)(\d+)$/.exec(ref), c = 0; for (var i = 0; i < m[1].length; i++) c = c * 26 + m[1].charCodeAt(i) - 64; return { c: c, r: +m[2] }; }
  function textOf(si) { // 共有文字列 <si> のテキスト（ふりがなは除く）
    var s = ''; for (var c = si.firstElementChild; c; c = c.nextElementSibling) {
      if (c.localName === 't') s += c.textContent; else if (c.localName === 'r') { var t = kid(c, 't'); if (t) s += t.textContent; }
    } return s;
  }
  var MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp' };

  async function parse(buf) {
    var z = await unzip(buf);
    var wb = xml(await z.text('xl/workbook.xml')); if (!wb) throw new Error('no workbook');
    var wbRels = await rels(z, 'xl/workbook.xml'), theme = await readTheme(z, wbRels);
    var styles = readStyles(xml(await z.text('xl/styles.xml')), theme), sst = [];
    var sd = xml(await z.text('xl/sharedStrings.xml')); if (sd) kids(sd.documentElement, 'si').forEach(function (si) { sst.push(textOf(si)); });
    var sheets = [], shs = kids(kid(wb.documentElement, 'sheets'), 'sheet');
    for (var si = 0; si < shs.length; si++) {
      var sh = shs[si]; if (sh.getAttribute('state') === 'hidden' || sh.getAttribute('state') === 'veryHidden') continue;
      var rel = wbRels[sh.getAttributeNS(NS_R, 'id')]; if (!rel) continue;
      var doc = xml(await z.text(rel.target)); if (!doc) continue;
      sheets.push(await readSheet(z, rel.target, doc, sh.getAttribute('name'), styles, sst, theme));
    }
    if (!sheets.length) throw new Error('no sheet');
    return sheets;
  }
  async function readSheet(z, path, doc, name, styles, sst, theme) {
    var root = doc.documentElement, fmt = kid(root, 'sheetFormatPr');
    var defH = fmt && fmt.getAttribute('defaultRowHeight') ? parseFloat(fmt.getAttribute('defaultRowHeight')) * 96 / 72 : 20;
    var defW = fmt && fmt.getAttribute('defaultColWidth') ? parseFloat(fmt.getAttribute('defaultColWidth')) * 7 : 64; // 列幅(文字数)×7px（保存されている幅には、すき間ぶんがすでに入っている）
    var cols = {}, rows = {}, cells = {}, maxR = 0, maxC = 0, extR = 0, extC = 0, merges = [];
    kids(kid(root, 'cols'), 'col').forEach(function (c) {
      var hid = c.getAttribute('hidden') === '1', w = c.getAttribute('width') ? parseFloat(c.getAttribute('width')) * 7 : defW;
      for (var i = +c.getAttribute('min'); i <= Math.min(+c.getAttribute('max'), 200); i++) cols[i] = hid ? 0 : w;
    });
    kids(kid(root, 'sheetData'), 'row').forEach(function (r) {
      var rn = +r.getAttribute('r');
      rows[rn] = r.getAttribute('hidden') === '1' ? 0 : (r.getAttribute('ht') ? parseFloat(r.getAttribute('ht')) * 96 / 72 : defH);
      kids(r, 'c').forEach(function (c) {
        var pos = colNum(c.getAttribute('r')), t = c.getAttribute('t'), v = kid(c, 'v'), val = '', s = +(c.getAttribute('s') || 0);
        if (t === 's') val = sst[+(v && v.textContent)] || '';
        else if (t === 'inlineStr') val = textOf(kid(c, 'is') || c);
        else if (t === 'b') val = v && v.textContent === '1' ? 'TRUE' : 'FALSE';
        else if (t === 'str' || t === 'e') val = v ? v.textContent : '';
        else if (v && v.textContent !== '') { var xf = styles.xfs[s] || {}; val = fmtNumber(v.textContent, styles.numFmts[xf.num] || BUILTIN_NUM[xf.num]); }
        if (val === '' && !s) return;
        cells[pos.r + ',' + pos.c] = { v: val, s: s, r: pos.r, c: pos.c };
        extR = Math.max(extR, pos.r); extC = Math.max(extC, pos.c);
        if (val !== '') { maxR = Math.max(maxR, pos.r); maxC = Math.max(maxC, pos.c); }
      });
    });
    kids(kid(root, 'mergeCells'), 'mergeCell').forEach(function (m) {
      var p = m.getAttribute('ref').split(':'), a = colNum(p[0]), b = colNum(p[1] || p[0]); merges.push({ r1: a.r, c1: a.c, r2: b.r, c2: b.c });
      extR = Math.max(extR, b.r); extC = Math.max(extC, b.c);
    });
    var images = [], shapes = [], dr = kid(root, 'drawing');
    if (dr) {
      var drel = (await rels(z, path))[dr.getAttributeNS(NS_R, 'id')];
      if (drel) { var d = await readDrawing(z, drel.target, theme); images = d.images; shapes = d.shapes; }
    }
    return { name: name, cells: cells, maxR: maxR, maxC: maxC, extR: Math.min(extR, 1000), extC: Math.min(extC, 100), merges: merges, cols: cols, rows: rows, defH: defH, defW: defW, styles: styles, images: images, shapes: shapes };
  }

  // ---------- 図面（図形・矢印・写真） ----------
  async function readDrawing(z, path, theme) {
    var dd = xml(await z.text(path)); if (!dd) return { images: [], shapes: [] };
    var drels = await rels(z, path), images = [], shapes = [];
    async function img(blip) {
      var rel = drels[blip.getAttributeNS(NS_R, 'embed')]; if (!rel) return null;
      var bytes = await z.bytes(rel.target), mime = MIME[rel.target.slice(rel.target.lastIndexOf('.') + 1).toLowerCase()]; if (!bytes || !mime) return null;
      return URL.createObjectURL(new Blob([bytes], { type: mime }));
    }
    function fillOf(pr, st) { // 塗り：図形の指定 → なければ style の fillRef
      if (!pr) return null;
      if (kid(pr, 'noFill')) return null;
      var sf = kid(pr, 'solidFill'); if (sf) return drawColor(sf.firstElementChild, theme);
      var gf = kid(pr, 'gradFill'); if (gf) { var gs = kid(kid(gf, 'gsLst'), 'gs'); if (gs) return drawColor(gs.firstElementChild, theme); }
      var fr = st && kid(st, 'fillRef'); if (fr && +fr.getAttribute('idx') > 0) return drawColor(fr.firstElementChild, theme);
      return null;
    }
    function lineOf(pr, st) { // 線：{ w(px), color, dash, head, tail }
      var ln = pr && kid(pr, 'ln'), lr = st && kid(st, 'lnRef'), o = null, w = null;
      if (ln && kid(ln, 'noFill')) return null;
      if (ln && kid(ln, 'solidFill')) o = drawColor(kid(ln, 'solidFill').firstElementChild, theme);
      else if (lr && +lr.getAttribute('idx') > 0) o = drawColor(lr.firstElementChild, theme);
      if (!o) return null;
      if (ln && ln.getAttribute('w') !== null) w = +ln.getAttribute('w');
      else if (lr && +lr.getAttribute('idx') > 0) w = theme._lines[+lr.getAttribute('idx') - 1];
      var he = ln && kid(ln, 'headEnd'), te = ln && kid(ln, 'tailEnd'), pd = ln && kid(ln, 'prstDash');
      return { w: Math.max(1, (w || 12700) / EMU), color: o.color, dash: pd ? pd.getAttribute('val') : 'solid',
        head: he && he.getAttribute('type') !== 'none' ? he.getAttribute('type') : '', tail: te && te.getAttribute('type') !== 'none' ? te.getAttribute('type') : '' };
    }
    function textOfShape(tb, st) {
      if (!tb) return null;
      var bp = kid(tb, 'bodyPr'), fr = st && kid(st, 'fontRef'), fcol = fr ? drawColor(fr.firstElementChild, theme) : null, paras = [], any = false;
      kids(tb, 'p').forEach(function (p) {
        var pp = kid(p, 'pPr'), runs = [], last = kid(p, 'endParaRPr');
        for (var c = p.firstElementChild; c; c = c.nextElementSibling) {
          if (c.localName === 'br') { runs.push({ br: true }); continue; }
          if (c.localName !== 'r' && c.localName !== 'fld') continue;
          var rp = kid(c, 'rPr'), t = kid(c, 't'), col = rp && kid(rp, 'solidFill') ? drawColor(kid(rp, 'solidFill').firstElementChild, theme) : fcol;
          runs.push({ t: t ? t.textContent : '', sz: rp && rp.getAttribute('sz') ? +rp.getAttribute('sz') / 100 : 11, b: !!rp && rp.getAttribute('b') === '1', i: !!rp && rp.getAttribute('i') === '1',
            u: !!rp && !!rp.getAttribute('u') && rp.getAttribute('u') !== 'none', s: !!rp && rp.getAttribute('strike') && rp.getAttribute('strike') !== 'noStrike', color: col ? col.color : '#000000' });
          if (t && t.textContent.trim()) any = true;
        }
        paras.push({ algn: pp ? pp.getAttribute('algn') : null, runs: runs, sz: last && last.getAttribute('sz') ? +last.getAttribute('sz') / 100 : (runs.length && runs[0].sz) || 11 });
      });
      if (!any) return null;
      return { paras: paras, anchor: attr(bp, 'anchor', 't'), wrap: attr(bp, 'wrap', 'square') !== 'none',
        l: +attr(bp, 'lIns', 91440) / EMU, t: +attr(bp, 'tIns', 45720) / EMU, r: +attr(bp, 'rIns', 91440) / EMU, b: +attr(bp, 'bIns', 45720) / EMU };
    }
    // 位置：図形自身の xfrm（絶対位置）を優先。グループの中は、グループの座標から変換する
    async function readItem(el, m, anchor, inGrp, top) {
      var kind = el.localName; if (kind !== 'sp' && kind !== 'pic' && kind !== 'cxnSp' && kind !== 'grpSp') return;
      var pr = kid(el, kind === 'grpSp' ? 'grpSpPr' : 'spPr'), xf = pr && kid(pr, 'xfrm');
      if (kind === 'grpSp') {
        var off = kid(xf, 'off'), ext = kid(xf, 'ext'), co = kid(xf, 'chOff'), ce = kid(xf, 'chExt'); if (!off || !ext || !co || !ce) return;
        var sx = +ext.getAttribute('cx') / (+ce.getAttribute('cx') || 1), sy = +ext.getAttribute('cy') / (+ce.getAttribute('cy') || 1);
        var m2 = { sx: m.sx * sx, sy: m.sy * sy, ox: m.ox + m.sx * (+off.getAttribute('x') - +co.getAttribute('x') * sx), oy: m.oy + m.sy * (+off.getAttribute('y') - +co.getAttribute('y') * sy) };
        var top2 = top || { x: +off.getAttribute('x'), y: +off.getAttribute('y'), cx: +ext.getAttribute('cx') || 1, cy: +ext.getAttribute('cy') || 1 }; // いちばん外のグループの枠（保存された位置）
        for (var c = el.firstElementChild; c; c = c.nextElementSibling) await readItem(c, m2, anchor, true, top2);
        return;
      }
      var o = xf && kid(xf, 'off'), e = xf && kid(xf, 'ext'), x, y, w, h;
      if (o && e) { x = (m.ox + +o.getAttribute('x') * m.sx) / EMU; y = (m.oy + +o.getAttribute('y') * m.sy) / EMU; w = +e.getAttribute('cx') * m.sx / EMU; h = +e.getAttribute('cy') * m.sy / EMU; }
      else if (anchor) { x = anchor.x; y = anchor.y; w = anchor.w; h = anchor.h; }
      else return;
      var st = kid(el, 'style'), it = { grp: !!inGrp, kind: kind, x: x, y: y, w: w, h: h, rot: xf ? +attr(xf, 'rot', 0) / 60000 : 0, flipH: !!xf && xf.getAttribute('flipH') === '1', flipV: !!xf && xf.getAttribute('flipV') === '1' };
      if (inGrp && top) it.frac = { x: (x * EMU - top.x) / top.cx, y: (y * EMU - top.y) / top.cy, w: w * EMU / top.cx, h: h * EMU / top.cy }; // グループの枠の中での位置（割合）
      var geom = pr && kid(pr, 'prstGeom'); it.geom = geom ? geom.getAttribute('prst') : 'rect';
      if (kind === 'pic') {
        var blip = el.getElementsByTagNameNS('*', 'blip')[0]; if (!blip) return;
        it.url = await img(blip); if (!it.url) return;
        var sr = kid(kid(el, 'blipFill'), 'srcRect');
        if (sr) it.crop = { l: +attr(sr, 'l', 0) / 100000, t: +attr(sr, 't', 0) / 100000, r: +attr(sr, 'r', 0) / 100000, b: +attr(sr, 'b', 0) / 100000 };
        it.line = lineOf(pr, null);
        // 一覧作成用：図形の位置ではなく、貼ってあるセルで行を決める
        if (anchor && anchor.from) images.push({ url: it.url, from: anchor.from });
      } else {
        it.fill = kind === 'sp' ? fillOf(pr, st) : null; it.line = lineOf(pr, st);
        it.text = kind === 'sp' ? textOfShape(kid(el, 'txBody'), st) : null;
        if (kind === 'sp' && !it.fill && !it.line && !it.text) return;
      }
      shapes.push(it);
    }
    for (var a = dd.documentElement.firstElementChild; a; a = a.nextElementSibling) {
      var k = a.localName; if (k !== 'twoCellAnchor' && k !== 'oneCellAnchor' && k !== 'absoluteAnchor') continue;
      var from = kid(a, 'from'), fr = null;
      if (from) { var gg = function (n) { var q = kid(from, n); return q ? +q.textContent : 0; }; fr = { r: gg('row'), c: gg('col'), ro: gg('rowOff'), co: gg('colOff') }; }
      var anchor = { from: fr ? { r: fr.r, c: fr.c } : null, cell: fr, to: null, ext: null };
      var tt = kid(a, 'to'); if (tt) { var g2 = function (n) { var q = kid(tt, n); return q ? +q.textContent : 0; }; anchor.to = { r: g2('row'), c: g2('col'), ro: g2('rowOff'), co: g2('colOff') }; }
      var ex = kid(a, 'ext') || (kid(a, 'pos') ? kid(a, 'ext') : null); if (ex) anchor.ext = { w: +ex.getAttribute('cx') / EMU, h: +ex.getAttribute('cy') / EMU };
      anchor.pending = true; // 位置は、列幅・行高が決まってから（描画時に）セル位置から計算
      for (var c2 = a.firstElementChild; c2; c2 = c2.nextElementSibling) {
        if (['sp', 'pic', 'cxnSp', 'grpSp'].indexOf(c2.localName) < 0) continue;
        var before = shapes.length, an = { from: anchor.from, x: 0, y: 0, w: anchor.ext ? anchor.ext.w : 0, h: anchor.ext ? anchor.ext.h : 0, cell: anchor.cell, to: anchor.to };
        await readItem(c2, { sx: 1, sy: 1, ox: 0, oy: 0 }, an);
        for (var q2 = before; q2 < shapes.length; q2++) shapes[q2].anchor = an; // xfrm がないときの予備
      }
    }
    return { images: images, shapes: shapes };
  }

  // ---------- 描画 ----------
  var BW = { thin: 1, hair: 1, medium: 2, dashed: 1, dotted: 1, double: 3, thick: 3, mediumDashed: 2, dashDot: 1, dotDash: 1 };
  function bcss(b) { return b ? (BW[b.style] || 1) + 'px ' + (/dash|dot/.test(b.style) ? (b.style === 'dotted' || b.style === 'hair' ? 'dotted' : 'dashed') : b.style === 'double' ? 'double' : 'solid') + ' ' + b.color : 'none'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var FONT = "'Hiragino Maru Gothic ProN','Hiragino Kaku Gothic ProN','Yu Gothic UI','Yu Gothic','Meiryo','Noto Sans JP','Noto Sans CJK JP',sans-serif";

  function renderTable(sh, colX, rowY, W) {
    var S = sh.styles, mergeAt = {}, skip = {}, r, c;
    sh.merges.forEach(function (m) {
      mergeAt[m.r1 + ',' + m.c1] = m;
      for (var rr = m.r1; rr <= m.r2; rr++) for (var cc = m.c1; cc <= m.c2; cc++) if (rr !== m.r1 || cc !== m.c1) skip[rr + ',' + cc] = 1;
    });
    function cw(c) { return sh.cols[c] !== undefined ? sh.cols[c] : sh.defW; }
    function styleOf(cell, m) {
      var xf = S.xfs[cell ? cell.s : 0] || {}, f = S.fonts[xf.font] || {}, bd = S.borders[xf.border] || {}, css = [];
      if (m) { var le = S.xfs[(sh.cells[m.r2 + ',' + m.c2] || {}).s] || {}, eb = S.borders[le.border] || {}; bd = { left: bd.left, top: bd.top, right: eb.right || bd.right, bottom: eb.bottom || bd.bottom }; }
      var bg = S.fills[xf.fill]; if (bg) css.push('background:' + bg);
      ['left', 'right', 'top', 'bottom'].forEach(function (side) { if (bd[side]) css.push('border-' + side + ':' + bcss(bd[side])); });
      css.push('font-size:' + Math.round((f.sz || 11) * 96 / 72 * 10) / 10 + 'px');
      if (f.b) css.push('font-weight:700'); if (f.i) css.push('font-style:italic');
      if (f.u || f.s) css.push('text-decoration:' + (f.u ? 'underline' : '') + (f.s ? ' line-through' : ''));
      css.push('color:' + (f.color || '#000'));
      var h = xf.h; if (!h || h === 'general') h = cell && /^-?[\d.,%]+$/.test(cell.v) ? 'right' : 'left';
      css.push('text-align:' + (h === 'centerContinuous' ? 'center' : h === 'fill' || h === 'justify' || h === 'distributed' ? 'left' : h));
      css.push('vertical-align:' + (xf.v === 'top' ? 'top' : xf.v === 'center' ? 'middle' : 'bottom'));
      if (xf.indent) css.push('padding-left:' + (xf.indent * 9 + 2) + 'px');
      css.push(xf.wrap ? 'white-space:pre-wrap;overflow:hidden;word-break:break-all' : 'white-space:pre;overflow:visible');
      return css.join(';');
    }
    var h = '<table style="position:absolute;left:0;top:0;border-collapse:collapse;table-layout:fixed;width:' + colX[sh.extC] + 'px;font-family:' + FONT + '"><colgroup>';
    for (c = 1; c <= sh.extC; c++) h += '<col style="width:' + cw(c) + 'px">';
    h += '</colgroup>';
    for (r = 1; r <= sh.extR; r++) {
      var rh = sh.rows[r] !== undefined ? sh.rows[r] : sh.defH; if (rh === 0) continue;
      h += '<tr style="height:' + rh + 'px">';
      for (c = 1; c <= sh.extC; c++) {
        var key = r + ',' + c; if (skip[key] || cw(c) === 0) continue;
        var cell = sh.cells[key], m = mergeAt[key];
        h += '<td' + (m && m.c2 > m.c1 ? ' colspan="' + (m.c2 - m.c1 + 1) + '"' : '') + (m && m.r2 > m.r1 ? ' rowspan="' + (m.r2 - m.r1 + 1) + '"' : '') +
          ' style="padding:0 2px;line-height:1.25;' + styleOf(cell, m) + '">' + (cell ? esc(cell.v) : '') + '</td>';
      }
      h += '</tr>';
    }
    return h + '</table>';
  }
  function shapeEl(it) {
    var d = document.createElement('div'), ln = it.line, tr = [];
    d.style.cssText = 'position:absolute;left:' + it.x + 'px;top:' + it.y + 'px;width:' + it.w + 'px;height:' + it.h + 'px;box-sizing:border-box';
    if (it.rot) tr.push('rotate(' + it.rot + 'deg)');
    if (it.kind === 'cxnSp') { // 直線・矢印
      var w = Math.max(it.w, 0.5), hh = Math.max(it.h, 0.5), x1 = it.flipH ? w : 0, y1 = it.flipV ? hh : 0, x2 = it.flipH ? 0 : w, y2 = it.flipV ? 0 : hh;
      var lw = ln ? ln.w : 1, col = ln ? ln.color : '#000', id = 'm' + Math.random().toString(36).slice(2, 8);
      var mk = function (suffix, type) { return type ? '<marker id="' + id + suffix + '" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="' + Math.max(3, 3.2) + '" markerHeight="3.2" orient="auto-start-reverse" markerUnits="strokeWidth"><path d="M0 0L10 5L0 10' + (type === 'arrow' || type === 'stealth' ? '' : 'z') + '" fill="' + (type === 'arrow' ? 'none' : col) + '" stroke="' + col + '" stroke-width="1.4"/></marker>' : ''; };
      d.style.overflow = 'visible';
      d.innerHTML = '<svg width="' + w + '" height="' + hh + '" style="overflow:visible;position:absolute;left:0;top:0"><defs>' + mk('h', ln && ln.head) + mk('t', ln && ln.tail) + '</defs><line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + col + '" stroke-width="' + lw + '"' +
        (ln && /dash/.test(ln.dash) ? ' stroke-dasharray="' + lw * 4 + ' ' + lw * 2 + '"' : '') + (ln && ln.head ? ' marker-start="url(#' + id + 'h)"' : '') + (ln && ln.tail ? ' marker-end="url(#' + id + 't)"' : '') + '/></svg>';
    } else if (it.kind === 'pic') {
      var cr = it.crop;
      d.style.overflow = 'hidden'; if (ln) d.style.border = ln.w + 'px solid ' + ln.color;
      var im = document.createElement('img'); im.src = it.url; im.alt = ''; im.draggable = false;
      if (cr) { var iw = it.w / (1 - cr.l - cr.r), ih = it.h / (1 - cr.t - cr.b); im.style.cssText = 'position:absolute;max-width:none;width:' + iw + 'px;height:' + ih + 'px;left:' + (-cr.l * iw) + 'px;top:' + (-cr.t * ih) + 'px'; }
      else im.style.cssText = 'position:absolute;max-width:none;width:100%;height:100%;left:0;top:0';
      d.appendChild(im);
    } else {
      if (it.fill) d.style.background = it.fill.alpha < 1 ? it.fill.color + Math.round(it.fill.alpha * 255).toString(16).padStart(2, '0') : it.fill.color;
      if (ln) d.style.border = ln.w + 'px ' + (/dash/.test(ln.dash) ? 'dashed' : /dot/.test(ln.dash) ? 'dotted' : 'solid') + ' ' + ln.color;
      if (it.geom === 'ellipse') d.style.borderRadius = '50%'; else if (it.geom === 'roundRect') d.style.borderRadius = Math.min(it.w, it.h) * 0.16 + 'px';
      var tx = it.text;
      if (tx) {
        d.style.display = 'flex'; d.style.flexDirection = 'column'; d.style.justifyContent = tx.anchor === 'ctr' ? 'center' : tx.anchor === 'b' ? 'flex-end' : 'flex-start';
        d.style.padding = tx.t + 'px ' + tx.r + 'px ' + tx.b + 'px ' + tx.l + 'px'; d.style.fontFamily = FONT; d.style.lineHeight = '1.25';
        var inner = document.createElement('div'); inner.style.cssText = 'width:100%;' + (tx.wrap ? 'white-space:pre-wrap;word-break:break-all' : 'white-space:pre');
        tx.paras.forEach(function (p) {
          var pd = document.createElement('div'); pd.style.textAlign = p.algn === 'ctr' ? 'center' : p.algn === 'r' ? 'right' : 'left';
          if (!p.runs.length) { pd.style.fontSize = p.sz * 96 / 72 + 'px'; pd.innerHTML = '&#8203;'; }
          p.runs.forEach(function (r) {
            if (r.br) { pd.appendChild(document.createElement('br')); return; }
            var sp = document.createElement('span'); sp.textContent = r.t; sp.style.cssText = 'font-size:' + r.sz * 96 / 72 + 'px;color:' + r.color + (r.b ? ';font-weight:700' : '') + (r.i ? ';font-style:italic' : '') + (r.u || r.s ? ';text-decoration:' + (r.u ? 'underline ' : '') + (r.s ? 'line-through' : '') : '');
            pd.appendChild(sp);
          });
          inner.appendChild(pd);
        });
        d.appendChild(inner);
      }
    }
    if (it.flipH && it.kind !== 'cxnSp' && it.kind !== 'sp') tr.unshift('scaleX(-1)');
    if (it.kind === 'pic' && (it.flipH || it.flipV)) tr = [it.flipH ? 'scaleX(-1)' : '', it.flipV ? 'scaleY(-1)' : ''].concat(tr);
    if (tr.length) d.style.transform = tr.filter(Boolean).join(' ');
    return d;
  }
  function bounds(it) { // 回転を含めた見えている範囲
    var cx = it.x + it.w / 2, cy = it.y + it.h / 2, a = (it.rot || 0) * Math.PI / 180, cs = Math.abs(Math.cos(a)), sn = Math.abs(Math.sin(a));
    var hw = (it.w * cs + it.h * sn) / 2, hh = (it.w * sn + it.h * cs) / 2;
    return { l: cx - hw, t: cy - hh, r: cx + hw, b: cy + hh };
  }
  function renderSheet(sh) {
    var colX = [0], rowY = [0], i;
    var maxC = Math.max(sh.extC, 1), maxR = Math.max(sh.extR, 1);
    // xfrm がない図形のため、セル位置から座標を決められるよう、列・行の範囲を図形ぶんまで広げる
    sh.shapes.forEach(function (it) { var an = it.anchor; if (an && an.to) { maxC = Math.max(maxC, an.to.c + 1); maxR = Math.max(maxR, an.to.r + 1); } if (an && an.cell) { maxC = Math.max(maxC, an.cell.c + 1); maxR = Math.max(maxR, an.cell.r + 1); } });
    for (i = 1; i <= maxC + 1; i++) colX[i] = colX[i - 1] + (sh.cols[i] !== undefined ? sh.cols[i] : sh.defW);
    for (i = 1; i <= maxR + 1; i++) rowY[i] = rowY[i - 1] + (sh.rows[i] !== undefined ? sh.rows[i] : sh.defH);
    var items = sh.shapes.map(function (it) {
      var o = {}; for (var k in it) o[k] = it[k];
      // 位置は、貼ってあるセルを基準にする（表の枠と、ずれないように）。回転した図形は、セルで決めた枠の中心に置く。大きさは図形自身の値
      if (o.grp && o.frac && o.anchor && o.anchor.cell && o.anchor.to) {
        var ga = o.anchor, gx = (colX[ga.cell.c] || 0) + ga.cell.co / EMU, gy = (rowY[ga.cell.r] || 0) + ga.cell.ro / EMU;
        var gw = (colX[ga.to.c] || 0) + ga.to.co / EMU - gx, gh = (rowY[ga.to.r] || 0) + ga.to.ro / EMU - gy;
        o.x = gx + o.frac.x * gw; o.y = gy + o.frac.y * gh; o.w = o.frac.w * gw; o.h = o.frac.h * gh;
      } else if (o.anchor && o.anchor.cell && !o.grp) {
        var an = o.anchor, fx = (colX[an.cell.c] || 0) + an.cell.co / EMU, fy = (rowY[an.cell.r] || 0) + an.cell.ro / EMU;
        var tx = an.to ? (colX[an.to.c] || 0) + an.to.co / EMU : fx + (o.w || an.w), ty = an.to ? (rowY[an.to.r] || 0) + an.to.ro / EMU : fy + (o.h || an.h);
        if (!(o.w || o.h)) { o.w = tx - fx; o.h = ty - fy; }
        if (o.rot) { o.x = (fx + tx) / 2 - o.w / 2; o.y = (fy + ty) / 2 - o.h / 2; }
        else if (an.to && an.to.c > 0 || an.to && an.to.r > 0) { o.x = fx; o.y = fy; o.w = Math.max(1, tx - fx); o.h = Math.max(1, ty - fy); }
        else { o.x = fx; o.y = fy; }
      }
      return o;
    });
    var W = sh.extC ? colX[sh.extC] : 0, H = sh.extR ? rowY[sh.extR] : 0;
    items.forEach(function (it) { var b = bounds(it); W = Math.max(W, b.r); H = Math.max(H, b.b); });
    W = Math.ceil(W + 12); H = Math.ceil(H + 12);
    var wrap = document.createElement('div');
    wrap.className = 'xlsheet'; wrap.style.cssText = 'position:relative;width:' + W + 'px;height:' + H + 'px;background:#fff;text-align:left;overflow:hidden';
    if (sh.extC && sh.extR && Object.keys(sh.cells).length) wrap.insertAdjacentHTML('afterbegin', renderTable(sh, colX, rowY, W));
    items.forEach(function (it) { wrap.appendChild(shapeEl(it)); });
    wrap.setAttribute('data-w', W);
    return wrap;
  }
  /** 入れ物に全シートを縦に並べて描く（シートが2枚以上なら見出しをつける） */
  function render(sheets, box) {
    var shown = sheets.filter(function (sh) { return Object.keys(sh.cells).length || sh.shapes.length; }); // 中身が空のシートは出さない
    if (shown.length) sheets = shown;
    sheets.forEach(function (sh) {
      var part = document.createElement('div');
      part.className = 'xlwrap'; part.style.cssText = 'display:inline-block;text-align:left;margin:0 auto 12px;vertical-align:top;border:2px solid #241A4A;border-radius:8px;overflow:hidden;background:#fff';
      if (sheets.length > 1) { var t = document.createElement('div'); t.className = 'xltitle'; t.style.cssText = 'padding:4px 10px;font-weight:900;background:#E4DAFF;border-bottom:2px solid #241A4A'; t.textContent = sh.name; part.appendChild(t); }
      var s = renderSheet(sh); part.appendChild(s); part.setAttribute('data-w', s.getAttribute('data-w'));
      var line = document.createElement('div'); line.style.cssText = 'text-align:center'; line.appendChild(part); box.appendChild(line);
    });
  }
  /** 読み取りで作った画像のURLを手放す（使い終わったとき） */
  function release(sheets) { (sheets || []).forEach(function (sh) { sh.shapes.forEach(function (it) { if (it.url) { try { URL.revokeObjectURL(it.url); } catch (e) {} } }); }); }
  g.XV = { parse: parse, render: render, release: release };
})(window);
