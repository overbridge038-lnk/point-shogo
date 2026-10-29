/* 自作のExcel(.xlsx)読み取り部品。通信なし・外部部品なし。
   ZIPをほどき（ブラウザ標準の DecompressionStream）、セルの文字と、行に貼ってある画像を取り出す。
   計算式は、保存されている計算結果をそのまま読む。
   使い方： const sheets = await XV.parse(arrayBuffer);
     sheets[i] = { name, cells: { "行,列": { v:文字, r:行, c:列 } }, maxR, maxC, images: [{ url, from:{r,c} }] }（行・列は、cells は1から、images の from は0から数える） */
(function (g) {
  'use strict';
  var NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

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
  function resolve(base, target) {
    if (target.charAt(0) === '/') return target.slice(1);
    var parts = (base.slice(0, base.lastIndexOf('/') + 1) + target).split('/'), out = [];
    parts.forEach(function (x) { if (x === '..') out.pop(); else if (x && x !== '.') out.push(x); });
    return out.join('/');
  }
  async function rels(z, path) { // path のファイルに付いている関係（rId → 行き先）
    var rp = path.slice(0, path.lastIndexOf('/') + 1) + '_rels/' + path.slice(path.lastIndexOf('/') + 1) + '.rels', doc = xml(await z.text(rp)), m = {};
    if (doc) kids(doc.documentElement, 'Relationship').forEach(function (r) { m[r.getAttribute('Id')] = resolve(path, r.getAttribute('Target')); });
    return m;
  }

  // ---------- 数字・日付の表示（書式） ----------
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
    var wbRels = await rels(z, 'xl/workbook.xml'), numFmts = {}, xfNum = [], sst = [];
    var sty = xml(await z.text('xl/styles.xml'));
    if (sty) {
      kids(kid(sty.documentElement, 'numFmts'), 'numFmt').forEach(function (n) { numFmts[n.getAttribute('numFmtId')] = n.getAttribute('formatCode'); });
      kids(kid(sty.documentElement, 'cellXfs'), 'xf').forEach(function (x) { xfNum.push(x.getAttribute('numFmtId') || '0'); });
    }
    var sd = xml(await z.text('xl/sharedStrings.xml')); if (sd) kids(sd.documentElement, 'si').forEach(function (si) { sst.push(textOf(si)); });
    var sheets = [], shs = kids(kid(wb.documentElement, 'sheets'), 'sheet');
    for (var si = 0; si < shs.length; si++) {
      var sh = shs[si]; if (sh.getAttribute('state') === 'hidden' || sh.getAttribute('state') === 'veryHidden') continue;
      var path = wbRels[sh.getAttributeNS(NS_R, 'id')]; if (!path) continue;
      var doc = xml(await z.text(path)); if (!doc) continue;
      var root = doc.documentElement, cells = {}, maxR = 0, maxC = 0;
      kids(kid(root, 'sheetData'), 'row').forEach(function (r) {
        kids(r, 'c').forEach(function (c) {
          var pos = colNum(c.getAttribute('r')), t = c.getAttribute('t'), v = kid(c, 'v'), val = '';
          if (t === 's') val = sst[+(v && v.textContent)] || '';
          else if (t === 'inlineStr') val = textOf(kid(c, 'is') || c);
          else if (t === 'b') val = v && v.textContent === '1' ? 'TRUE' : 'FALSE';
          else if (t === 'str' || t === 'e') val = v ? v.textContent : '';
          else if (v && v.textContent !== '') { var id = xfNum[+(c.getAttribute('s') || 0)] || '0'; val = fmtNumber(v.textContent, numFmts[id] || BUILTIN_NUM[id]); }
          if (val === '') return;
          cells[pos.r + ',' + pos.c] = { v: val, r: pos.r, c: pos.c };
          maxR = Math.max(maxR, pos.r); maxC = Math.max(maxC, pos.c);
        });
      });
      var images = [], dr = kid(root, 'drawing');
      if (dr) { var drPath = (await rels(z, path))[dr.getAttributeNS(NS_R, 'id')]; if (drPath) images = await readDrawing(z, drPath); }
      sheets.push({ name: sh.getAttribute('name'), cells: cells, maxR: maxR, maxC: maxC, images: images });
    }
    if (!sheets.length) throw new Error('no sheet');
    return sheets;
  }
  /** 図面（drawing）から、貼ってある写真と、その位置（左上のセル）を取り出す */
  async function readDrawing(z, path) {
    var dd = xml(await z.text(path)); if (!dd) return [];
    var drels = await rels(z, path), out = [];
    for (var a = dd.documentElement.firstElementChild; a; a = a.nextElementSibling) {
      if (a.localName !== 'twoCellAnchor' && a.localName !== 'oneCellAnchor') continue;
      var pic = kid(a, 'pic'), from = kid(a, 'from'); if (!pic || !from) continue;
      var blip = pic.getElementsByTagNameNS('*', 'blip')[0]; if (!blip) continue;
      var target = drels[blip.getAttributeNS(NS_R, 'embed')]; if (!target) continue;
      var bytes = await z.bytes(target), mime = MIME[target.slice(target.lastIndexOf('.') + 1).toLowerCase()]; if (!bytes || !mime) continue;
      var rr = kid(from, 'row'), cc = kid(from, 'col');
      out.push({ url: URL.createObjectURL(new Blob([bytes], { type: mime })), from: { r: rr ? +rr.textContent : 0, c: cc ? +cc.textContent : 0 } });
    }
    return out;
  }
  g.XV = { parse: parse };
})(window);
