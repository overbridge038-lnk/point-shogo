/* =====================================================================
   簡易QRデコーダ（PDFを画像化したような「きれいなQR」専用）
   - 外部ライブラリなし・オフラインで動く
   - 対応：バージョン1〜10、数字／英数字／8bit(UTF-8・Shift_JIS)／漢字モード
   - 読み取ったデータはリードソロモン検査で確認し、誤読なら null を返す
     （＝あいまいな結果で判定しない。読めない時は止めて人に知らせる）
   ===================================================================== */
(function (global) {
  'use strict';

  // ---- バージョン別のブロック構成表 [EC語数/ブロック, [[ブロック数, データ語数], ...]] 順序 L, M, Q, H
  var EC_TABLE = {
    1: [[7, [[1, 19]]], [10, [[1, 16]]], [13, [[1, 13]]], [17, [[1, 9]]]],
    2: [[10, [[1, 34]]], [16, [[1, 28]]], [22, [[1, 22]]], [28, [[1, 16]]]],
    3: [[15, [[1, 55]]], [26, [[1, 44]]], [18, [[2, 17]]], [22, [[2, 13]]]],
    4: [[20, [[1, 80]]], [18, [[2, 32]]], [26, [[2, 24]]], [16, [[4, 9]]]],
    5: [[26, [[1, 108]]], [24, [[2, 43]]], [18, [[2, 15], [2, 16]]], [22, [[2, 11], [2, 12]]]],
    6: [[18, [[2, 68]]], [16, [[4, 27]]], [24, [[4, 19]]], [28, [[4, 15]]]],
    7: [[20, [[2, 78]]], [18, [[4, 31]]], [18, [[2, 14], [4, 15]]], [26, [[4, 13], [1, 14]]]],
    8: [[24, [[2, 97]]], [22, [[2, 38], [2, 39]]], [22, [[4, 18], [2, 19]]], [26, [[4, 14], [2, 15]]]],
    9: [[30, [[2, 116]]], [22, [[3, 36], [2, 37]]], [20, [[4, 16], [4, 17]]], [24, [[4, 12], [4, 13]]]],
    10: [[18, [[2, 68], [2, 69]]], [26, [[4, 43], [1, 44]]], [24, [[6, 19], [2, 20]]], [28, [[6, 15], [2, 16]]]]
  };
  var ALIGN = {
    1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34],
    7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50]
  };

  // ---- GF(256) と リードソロモン検査
  var EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  (function () {
    var x = 1;
    for (var i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11D; }
    for (var j = 255; j < 512; j++) EXP[j] = EXP[j - 255];
  })();
  function gfMul(a, b) { return (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]]; }
  // ---- リードソロモン誤り訂正（カメラで数マス読み違えても直す。直せない時は null）
  function gfDiv(a, b) { if (a === 0) return 0; return EXP[(LOG[a] + 255 - LOG[b]) % 255]; }
  function gfPow(x, p) { return EXP[((LOG[x] * p) % 255 + 255) % 255]; }
  function pEval(poly, x) { var y = poly[0]; for (var i = 1; i < poly.length; i++) y = gfMul(y, x) ^ poly[i]; return y; }
  function pScale(p, x) { return p.map(function (c) { return gfMul(c, x); }); }
  function pAdd(p, q) {
    var n = Math.max(p.length, q.length), r = new Array(n).fill(0), i;
    for (i = 0; i < p.length; i++) r[i + n - p.length] = p[i];
    for (i = 0; i < q.length; i++) r[i + n - q.length] ^= q[i];
    return r;
  }
  function pMul(p, q) {
    var r = new Array(p.length + q.length - 1).fill(0);
    for (var j = 0; j < q.length; j++) for (var i = 0; i < p.length; i++) r[i + j] ^= gfMul(p[i], q[j]);
    return r;
  }
  function rsCorrect(cw, nsym, maxErr) {
    var msg = cw.slice(), synd = [0], i, j, bad = false;
    for (i = 0; i < nsym; i++) { var v = pEval(msg, EXP[i]); synd.push(v); if (v) bad = true; }
    if (!bad) return msg;
    // Berlekamp-Massey
    var errLoc = [1], oldLoc = [1];
    for (i = 0; i < nsym; i++) {
      var K = i + 1, delta = synd[K];
      for (j = 1; j < errLoc.length; j++) delta ^= gfMul(errLoc[errLoc.length - 1 - j], synd[K - j]);
      oldLoc = oldLoc.concat([0]);
      if (delta !== 0) {
        if (oldLoc.length > errLoc.length) { var nl = pScale(oldLoc, delta); oldLoc = pScale(errLoc, gfDiv(1, delta)); errLoc = nl; }
        errLoc = pAdd(errLoc, pScale(oldLoc, delta));
      }
    }
    while (errLoc.length && errLoc[0] === 0) errLoc.shift();
    var errs = errLoc.length - 1;
    if (errs * 2 > nsym || (maxErr !== undefined && errs > maxErr)) return null;
    // Chien search
    var rev = errLoc.slice().reverse(), pos = [], n = msg.length;
    for (i = 0; i < n; i++) if (pEval(rev, EXP[i]) === 0) pos.push(n - 1 - i);
    if (pos.length !== errs) return null;
    // Forney
    var coef = pos.map(function (p) { return n - 1 - p; }), eLoc = [1];
    coef.forEach(function (c) { eLoc = pMul(eLoc, pAdd([1], [EXP[c], 0])); });
    var sr = synd.slice().reverse(), prod = pMul(sr, eLoc);
    var eEval = prod.slice(prod.length - eLoc.length); // 剰余 = 下位 (len(eLoc)) 項
    var X = coef.map(function (c) { return EXP[c]; });
    for (i = 0; i < X.length; i++) {
      var xi = X[i], xinv = gfDiv(1, xi), lp = 1;
      for (j = 0; j < X.length; j++) if (j !== i) lp = gfMul(lp, 1 ^ gfMul(xinv, X[j]));
      if (lp === 0) return null;
      var y = gfMul(xi, pEval(eEval, xinv));
      msg[pos[i]] ^= gfDiv(y, lp);
    }
    for (i = 0; i < nsym; i++) if (pEval(msg, EXP[i]) !== 0) return null; // 直し切れたか再確認
    return msg;
  }

  // ---- 形式情報（誤り訂正レベル＋マスク）
  var FORMAT = [];
  (function () {
    for (var d = 0; d < 32; d++) {
      var v = d << 10;
      for (var i = 14; i >= 10; i--) if (v & (1 << i)) v ^= 0x537 << (i - 10);
      FORMAT.push({ bits: ((d << 10) | v) ^ 0x5412, data: d });
    }
  })();
  function bitCount(x) { var c = 0; while (x) { c += x & 1; x >>>= 1; } return c; }

  function maskFn(m) {
    return [
      function (i, j) { return (i + j) % 2 === 0; },
      function (i) { return i % 2 === 0; },
      function (i, j) { return j % 3 === 0; },
      function (i, j) { return (i + j) % 3 === 0; },
      function (i, j) { return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0; },
      function (i, j) { var t = i * j; return (t % 2) + (t % 3) === 0; },
      function (i, j) { var t = i * j; return ((t % 2) + (t % 3)) % 2 === 0; },
      function (i, j) { return (((i + j) % 2) + ((i * j) % 3)) % 2 === 0; }
    ][m];
  }

  // ---- 2値化（暗い=1）
  function toGray(px, w, h, channels) {
    var n = w * h, gray = new Uint8Array(n);
    for (var p = 0; p < n; p++) {
      if (channels === 1) gray[p] = px[p];
      else { var o = p * channels; gray[p] = (px[o] * 77 + px[o + 1] * 150 + px[o + 2] * 29) >> 8; }
    }
    return gray;
  }
  // 局所平均で2値化（カメラ写真の明暗ムラ・影に強い）
  function adaptive(gray, w, h) {
    var I = new Float64Array((w + 1) * (h + 1)), x, y;
    for (y = 0; y < h; y++) {
      var rs = 0;
      for (x = 0; x < w; x++) { rs += gray[y * w + x]; I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + rs; }
    }
    var r = Math.max(7, Math.round(Math.min(w, h) / 16)), bin = new Uint8Array(w * h);
    for (y = 0; y < h; y++) {
      var y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
      for (x = 0; x < w; x++) {
        var x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
        var sum = I[y1 * (w + 1) + x1] - I[y0 * (w + 1) + x1] - I[y1 * (w + 1) + x0] + I[y0 * (w + 1) + x0];
        var mean = sum / ((x1 - x0) * (y1 - y0));
        bin[y * w + x] = gray[y * w + x] < mean * 0.88 ? 1 : 0;
      }
    }
    return bin;
  }
  function otsu(gray, w, h) {
    var n = w * h, hist = new Uint32Array(256);
    for (var p = 0; p < n; p++) hist[gray[p]]++;
    // 大津の二値化
    var sum = 0; for (var t = 0; t < 256; t++) sum += t * hist[t];
    var sumB = 0, wB = 0, best = 0, thr = 128;
    for (var t2 = 0; t2 < 256; t2++) {
      wB += hist[t2]; if (!wB) continue;
      var wF = n - wB; if (!wF) break;
      sumB += t2 * hist[t2];
      var mB = sumB / wB, mF = (sum - sumB) / wF, between = wB * wF * (mB - mF) * (mB - mF);
      if (between > best) { best = between; thr = t2; }
    }
    var bin = new Uint8Array(n);
    for (var q = 0; q < n; q++) bin[q] = gray[q] <= thr ? 1 : 0;
    return bin;
  }

  // ---- ファインダパターン（角の四角）探し
  function ratioOk(r) {
    var total = r[0] + r[1] + r[2] + r[3] + r[4];
    if (total < 7) return false;
    var m = total / 7, v = m / 1.8;
    return Math.abs(m - r[0]) < v && Math.abs(m - r[1]) < v && Math.abs(3 * m - r[2]) < 3 * v &&
      Math.abs(m - r[3]) < v && Math.abs(m - r[4]) < v;
  }
  function crossCheck(bin, w, h, cx, cy, vertical) {
    // 中心から両方向に 黒→白→黒 の長さを測る
    function at(k) { return vertical ? bin[k * w + cx] : bin[cy * w + k]; }
    var len = vertical ? h : w, c = vertical ? cy : cx;
    if (!at(c)) return null;
    var r = [0, 0, 0, 0, 0], k = c;
    while (k >= 0 && at(k)) { r[2]++; k--; }
    while (k >= 0 && !at(k)) { r[1]++; k--; }
    while (k >= 0 && at(k)) { r[0]++; k--; }
    k = c + 1;
    while (k < len && at(k)) { r[2]++; k++; }
    while (k < len && !at(k)) { r[3]++; k++; }
    while (k < len && at(k)) { r[4]++; k++; }
    if (!ratioOk(r)) return null;
    return { center: k - r[4] - r[3] - r[2] / 2, size: (r[0] + r[1] + r[2] + r[3] + r[4]) / 7 };
  }
  function findFinders(bin, w, h) {
    var cands = [];
    for (var y = 0; y < h; y++) {
      var row = y * w, runs = [], starts = [], cur = bin[row], len = 0, st = 0;
      for (var x = 0; x <= w; x++) {
        var v = x < w ? bin[row + x] : -1;
        if (v === cur) { len++; continue; }
        runs.push(len); starts.push(st); if (runs.length === 1) runs.color0 = cur;
        cur = v; len = 1; st = x;
      }
      var c0 = runs.color0;
      for (var i = 0; i + 4 < runs.length; i++) {
        if (((i % 2 === 0) ? c0 : 1 - c0) !== 1) continue; // 黒から始まる5連
        var r = [runs[i], runs[i + 1], runs[i + 2], runs[i + 3], runs[i + 4]];
        if (!ratioOk(r)) continue;
        var cx = Math.round(starts[i + 2] + runs[i + 2] / 2);
        var vc = crossCheck(bin, w, h, cx, y, true); if (!vc) continue;
        var cy = Math.round(vc.center);
        var hc = crossCheck(bin, w, h, cx, cy, false); if (!hc) continue;
        var size = (vc.size + hc.size) / 2, fx = hc.center, fy = vc.center, merged = false;
        for (var c = 0; c < cands.length; c++) {
          var o = cands[c];
          if (Math.abs(o.x - fx) < o.size * 2 && Math.abs(o.y - fy) < o.size * 2) {
            o.x = (o.x * o.n + fx) / (o.n + 1); o.y = (o.y * o.n + fy) / (o.n + 1);
            o.size = (o.size * o.n + size) / (o.n + 1); o.n++; merged = true; break;
          }
        }
        if (!merged) cands.push({ x: fx, y: fy, size: size, n: 1 });
      }
    }
    return cands;
  }
  // 直角二等辺三角形になる3つ（左上・右上・左下）を選ぶ
  function pickTriples(cands) {
    cands = cands.filter(function (c) { return c.n >= 2; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 25);
    var out = [];
    for (var a = 0; a < cands.length; a++) for (var b = 0; b < cands.length; b++) for (var c = b + 1; c < cands.length; c++) {
      if (a === b || a === c) continue;
      var A = cands[a], B = cands[b], C = cands[c];
      var sz = [A.size, B.size, C.size], mx = Math.max.apply(0, sz), mn = Math.min.apply(0, sz);
      if (mx > mn * 1.4) continue;
      var abx = B.x - A.x, aby = B.y - A.y, acx = C.x - A.x, acy = C.y - A.y;
      var dB = Math.hypot(abx, aby), dC = Math.hypot(acx, acy);
      if (dB < mn * 10 || dC < mn * 10) continue;
      var lenErr = Math.abs(dB - dC) / Math.max(dB, dC);
      var cos = Math.abs((abx * acx + aby * acy) / (dB * dC));
      if (lenErr > 0.3 || cos > 0.3) continue;
      var cross = abx * acy - aby * acx, TR = cross > 0 ? B : C, BL = cross > 0 ? C : B;
      out.push({ score: lenErr + cos, TL: A, TR: TR, BL: BL });
    }
    return out.sort(function (p, q) { return p.score - q.score; }).slice(0, 4);
  }

  // ---- グリッドを読み取り → 文字列へ
  // 角3つから「平行四辺形」としてマス目→画素の対応を作る
  function affineMap(t, dim) {
    var ex = { x: (t.TR.x - t.TL.x) / (dim - 7), y: (t.TR.y - t.TL.y) / (dim - 7) };
    var ey = { x: (t.BL.x - t.TL.x) / (dim - 7), y: (t.BL.y - t.TL.y) / (dim - 7) };
    var f = function (u, v) { return [t.TL.x + (u - 3.5) * ex.x + (v - 3.5) * ey.x, t.TL.y + (u - 3.5) * ex.y + (v - 3.5) * ey.y]; };
    f.ex = ex; f.ey = ey;
    return f;
  }
  // 4点から射影変換（斜めから撮った写真の台形ゆがみを補正）
  function homography(src, dst) {
    var A = [], i, j, k;
    for (i = 0; i < 4; i++) {
      var u = src[i][0], v = src[i][1], x = dst[i][0], y = dst[i][1];
      A.push([u, v, 1, 0, 0, 0, -u * x, -v * x, x]);
      A.push([0, 0, 0, u, v, 1, -u * y, -v * y, y]);
    }
    for (i = 0; i < 8; i++) {
      var piv = i;
      for (j = i + 1; j < 8; j++) if (Math.abs(A[j][i]) > Math.abs(A[piv][i])) piv = j;
      var tmp = A[i]; A[i] = A[piv]; A[piv] = tmp;
      if (Math.abs(A[i][i]) < 1e-12) return null;
      for (j = 0; j < 8; j++) if (j !== i) { var fct = A[j][i] / A[i][i]; for (k = i; k < 9; k++) A[j][k] -= fct * A[i][k]; }
    }
    var H = []; for (i = 0; i < 8; i++) H.push(A[i][8] / A[i][i]);
    return function (u, v) { var d = H[6] * u + H[7] * v + 1; return [(H[0] * u + H[1] * v + H[2]) / d, (H[3] * u + H[4] * v + H[5]) / d]; };
  }
  // 右下の位置合わせパターン（小さい四角）を探す
  function findAlignment(bin, w, h, aff, dim) {
    var ex = aff.ex, ey = aff.ey, p = aff(dim - 6.5, dim - 6.5);
    var mod = Math.hypot(ex.x, ex.y), R = mod * 4, step = Math.max(1, mod / 3), best = null, bestS = 0;
    for (var dy = -R; dy <= R; dy += step) for (var dx = -R; dx <= R; dx += step) {
      var cx = p[0] + dx, cy = p[1] + dy, s = 0;
      for (var b = -2; b <= 2; b++) for (var a = -2; a <= 2; a++) {
        var X = Math.round(cx + a * ex.x + b * ey.x), Y = Math.round(cy + a * ex.y + b * ey.y);
        if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
        var want = Math.max(Math.abs(a), Math.abs(b)) === 1 ? 0 : 1;
        if (bin[Y * w + X] === want) s++;
      }
      if (s > bestS) { bestS = s; best = [cx, cy]; }
    }
    return bestS >= 23 ? best : null;
  }
  function sampleGrid(bin, w, h, map, dim) {
    var e1 = map(1, 0), e0 = map(0, 0);
    var g = [], s = Math.max(1, Math.floor(Math.hypot(e1[0] - e0[0], e1[1] - e0[1]) / 5));
    for (var r = 0; r < dim; r++) {
      var row = [];
      for (var c = 0; c < dim; c++) {
        var pp = map(c + 0.5, r + 0.5), px = pp[0], py = pp[1];
        // 3x3 の多数決（ぼやけ対策）
        var dark = 0, tot = 0;
        for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
          var X = Math.round(px + dx * s), Y = Math.round(py + dy * s);
          if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
          tot++; dark += bin[Y * w + X];
        }
        row.push(tot && dark * 2 > tot ? 1 : 0);
      }
      g.push(row);
    }
    return g;
  }
  function functionMask(ver, dim) {
    var f = []; for (var i = 0; i < dim; i++) f.push(new Uint8Array(dim));
    function region(left, top, wd, ht) { for (var y = top; y < top + ht; y++) for (var x = left; x < left + wd; x++) f[y][x] = 1; }
    region(0, 0, 9, 9); region(dim - 8, 0, 8, 9); region(0, dim - 8, 9, 8);
    var al = ALIGN[ver], mx = al.length;
    for (var a = 0; a < mx; a++) for (var b = 0; b < mx; b++) {
      if ((a === 0 && (b === 0 || b === mx - 1)) || (a === mx - 1 && b === 0)) continue;
      region(al[b] - 2, al[a] - 2, 5, 5);
    }
    region(6, 9, 1, dim - 17); region(9, 6, dim - 17, 1);
    if (ver > 6) { region(dim - 11, 0, 3, 6); region(0, dim - 11, 6, 3); }
    return f;
  }
  function readFormat(g, dim) {
    function bit(x, y) { return g[y][x]; }
    var f1 = 0, f2 = 0, i;
    for (i = 0; i < 6; i++) f1 = (f1 << 1) | bit(i, 8);
    f1 = (f1 << 1) | bit(7, 8); f1 = (f1 << 1) | bit(8, 8); f1 = (f1 << 1) | bit(8, 7);
    for (i = 5; i >= 0; i--) f1 = (f1 << 1) | bit(8, i);
    for (i = dim - 1; i >= dim - 7; i--) f2 = (f2 << 1) | bit(8, i);
    for (i = dim - 8; i < dim; i++) f2 = (f2 << 1) | bit(i, 8);
    var best = null, bestD = 99;
    FORMAT.forEach(function (fm) {
      var d = Math.min(bitCount(fm.bits ^ f1), bitCount(fm.bits ^ f2));
      if (d < bestD) { bestD = d; best = fm.data; }
    });
    if (bestD > 3) return null;
    var ecIndex = [1, 0, 3, 2][(best >> 3) & 3]; // bits→ M,L,H,Q を L,M,Q,H 順の番号へ
    return { ec: ecIndex, mask: best & 7 };
  }
  function decodeGrid(g, dim, strict) {
    var ver = (dim - 17) / 4;
    if (!EC_TABLE[ver]) return null;
    var fmt = readFormat(g, dim); if (!fmt) return null;
    var fm = functionMask(ver, dim), mk = maskFn(fmt.mask);
    var raw = [], cur = 0, nb = 0, up = true;
    for (var j = dim - 1; j > 0; j -= 2) {
      if (j === 6) j--;
      for (var cnt = 0; cnt < dim; cnt++) {
        var i = up ? dim - 1 - cnt : cnt;
        for (var col = 0; col < 2; col++) {
          var x = j - col;
          if (fm[i][x]) continue;
          cur = (cur << 1) | (g[i][x] ^ (mk(i, x) ? 1 : 0)); nb++;
          if (nb === 8) { raw.push(cur); cur = 0; nb = 0; }
        }
      }
      up = !up;
    }
    // ブロックに分けて並べ直し
    var spec = EC_TABLE[ver][fmt.ec], ecLen = spec[0], blocks = [];
    spec[1].forEach(function (gp) { for (var n = 0; n < gp[0]; n++) blocks.push({ nd: gp[1], cw: new Array(gp[1] + ecLen) }); });
    var total = blocks.reduce(function (s, b) { return s + b.cw.length; }, 0);
    if (raw.length < total) return null;
    var shortTotal = blocks[0].cw.length, longStart = blocks.length - 1;
    while (longStart >= 0 && blocks[longStart].cw.length !== shortTotal) longStart--;
    longStart++;
    var shortData = shortTotal - ecLen, ro = 0, k, b;
    for (k = 0; k < shortData; k++) for (b = 0; b < blocks.length; b++) blocks[b].cw[k] = raw[ro++];
    for (b = longStart; b < blocks.length; b++) blocks[b].cw[shortData] = raw[ro++];
    for (k = shortData; k < shortTotal; k++) for (b = 0; b < blocks.length; b++) blocks[b].cw[b < longStart ? k : k + 1] = raw[ro++];
    var data = [];
    for (b = 0; b < blocks.length; b++) {
      var fixed = rsCorrect(blocks[b].cw, ecLen, strict ? Math.max(1, Math.floor(ecLen / 2) - 2) : undefined);
      if (!fixed) return null; // 直せない＝誤読の疑い → 採用しない
      data = data.concat(fixed.slice(0, blocks[b].nd));
    }
    return parseBits(data, ver);
  }

  // ---- ビット列 → 文字
  function parseBits(bytes, ver) {
    var pos = 0, total = bytes.length * 8;
    function read(n) {
      var v = 0;
      for (var i = 0; i < n; i++) { v = (v << 1) | ((bytes[pos >> 3] >> (7 - (pos & 7))) & 1); pos++; }
      return v;
    }
    var vi = ver < 10 ? 0 : (ver < 27 ? 1 : 2), out = '', eciUtf8 = false;
    var AN = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
    function decodeBytes(arr, kanji) {
      var u8 = new Uint8Array(arr);
      if (!kanji) {
        try { return new TextDecoder('utf-8', { fatal: true }).decode(u8); } catch (e) { if (eciUtf8) return new TextDecoder('utf-8').decode(u8); }
      }
      try { return new TextDecoder('shift_jis').decode(u8); } catch (e2) { return String.fromCharCode.apply(null, arr); }
    }
    while (pos + 4 <= total) {
      var mode = read(4);
      if (mode === 0) break;
      if (mode === 1) { // 数字
        var n = read([10, 12, 14][vi]);
        while (n >= 3) { out += ('00' + read(10)).slice(-3); n -= 3; }
        if (n === 2) out += ('0' + read(7)).slice(-2); else if (n === 1) out += read(4);
      } else if (mode === 2) { // 英数字
        var m = read([9, 11, 13][vi]);
        while (m >= 2) { var v = read(11); out += AN[Math.floor(v / 45)] + AN[v % 45]; m -= 2; }
        if (m === 1) out += AN[read(6)];
      } else if (mode === 4) { // 8bit
        var c = read([8, 16, 16][vi]), arr = [];
        for (var i = 0; i < c; i++) arr.push(read(8));
        out += decodeBytes(arr, false);
      } else if (mode === 8) { // 漢字
        var kc = read([8, 10, 12][vi]), ka = [];
        for (var q = 0; q < kc; q++) {
          var t = read(13), as = ((Math.floor(t / 0xC0)) << 8) | (t % 0xC0);
          as += as < 0x1F00 ? 0x8140 : 0xC140;
          ka.push(as >> 8, as & 0xFF);
        }
        out += decodeBytes(ka, true);
      } else if (mode === 7) { // ECI
        var e = read(8);
        if ((e & 0x80) === 0) { /* 7bit */ } else if ((e & 0xC0) === 0x80) e = ((e & 0x3F) << 8) | read(8);
        else e = ((e & 0x1F) << 16) | read(16);
        eciUtf8 = (e === 26);
      } else if (mode === 3) { read(16); }
      else if (mode === 5) { /* FNC1 */ } else if (mode === 9) { read(8); }
      else break;
    }
    return out;
  }

  function searchCorner(bin, w, h, tr, dim, aff) {
    var p0 = aff(dim - 3.5, dim - 3.5), mod = Math.hypot(aff.ex.x, aff.ex.y), offs = [];
    for (var j = -6; j <= 6; j++) for (var i = -6; i <= 6; i++) if (i || j) offs.push([i * mod / 2, j * mod / 2]);
    offs.sort(function (a, b) { return Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]); });
    var src = [[3.5, 3.5], [dim - 3.5, 3.5], [3.5, dim - 3.5], [dim - 3.5, dim - 3.5]];
    for (var k = 0; k < offs.length; k++) {
      var H = homography(src, [[tr.TL.x, tr.TL.y], [tr.TR.x, tr.TR.y], [tr.BL.x, tr.BL.y], [p0[0] + offs[k][0], p0[1] + offs[k][1]]]);
      if (!H) continue;
      var res = decodeGrid(sampleGrid(bin, w, h, H, dim), dim, true); // 探索時は訂正数に余裕を残して誤読を防ぐ
      if (res !== null && res !== undefined) return res;
    }
    return null;
  }

  /** 画素データからQRを1つ読む。px: RGBA(4) または グレー(1) 配列 */
  function decodeQR(px, w, h, channels) {
    var gray = toGray(px, w, h, channels || 4);
    // まず全体のしきい値、ダメなら局所しきい値（カメラ写真向け）
    var r1 = decodeBin(otsu(gray, w, h), w, h);
    if (r1 !== null) return r1;
    return decodeBin(adaptive(gray, w, h), w, h);
  }
  function decodeBin(bin, w, h) {
    var triples = pickTriples(findFinders(bin, w, h));
    for (var t = 0; t < triples.length; t++) {
      var tr = triples[t];
      var mod = (tr.TL.size + tr.TR.size + tr.BL.size) / 3;
      var d = (Math.hypot(tr.TR.x - tr.TL.x, tr.TR.y - tr.TL.y) + Math.hypot(tr.BL.x - tr.TL.x, tr.BL.y - tr.TL.y)) / 2;
      var est = Math.round(d / mod) + 7, tried = {};
      var tryDims = [est, est - 1, est + 1, est - 2, est + 2, est - 3, est + 3, est - 4, est + 4];
      for (var k = 0; k < tryDims.length; k++) {
        var dim = tryDims[k];
        if (dim < 21 || dim > 57 || (dim - 17) % 4 !== 0 || tried[dim]) continue;
        tried[dim] = 1;
        var aff = affineMap(tr, dim), maps = [];
        if (dim > 21) {
          var al = findAlignment(bin, w, h, aff, dim);
          if (al) {
            var H = homography([[3.5, 3.5], [dim - 3.5, 3.5], [3.5, dim - 3.5], [dim - 6.5, dim - 6.5]],
              [[tr.TL.x, tr.TL.y], [tr.TR.x, tr.TR.y], [tr.BL.x, tr.BL.y], al]);
            if (H) maps.push(H);
          }
        }
        maps.push(aff);
        for (var m = 0; m < maps.length; m++) {
          var res = decodeGrid(sampleGrid(bin, w, h, maps[m], dim), dim);
          if (res !== null && res !== undefined) return res;
        }
        // 斜めから撮った写真：右下の角の位置を少しずつ動かして探す（台形ゆがみ補正）
        var res2 = searchCorner(bin, w, h, tr, dim, aff);
        if (res2 !== null) return res2;
      }
    }
    return null;
  }

  decodeQR._dbg = { toGray: toGray, otsu: otsu, adaptive: adaptive, findFinders: findFinders, pickTriples: pickTriples, affineMap: affineMap, findAlignment: findAlignment, sampleGrid: sampleGrid, decodeGrid: decodeGrid, readFormat: readFormat, rsCorrect: rsCorrect, pMul: pMul };
  global.decodeQR = decodeQR;
  if (typeof module !== 'undefined' && module.exports) module.exports = decodeQR;
})(typeof window !== 'undefined' ? window : globalThis);
