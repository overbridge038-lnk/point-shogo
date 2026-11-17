/**
 * ポイント照合ツール：親機の表をGoogleドライブで配るためのプログラム（Google Apps Script）
 *
 * ■ しくみ
 *  ・親機（管理者のタブレット／PC）が「親機の表として送る」を押すと、ポイント表一式がこのドライブに入る（版の番号が1つ上がる）
 *  ・子機は、ネットにつながったとき「新しい版があるか」を確かめて、親機の表だけを受け取る
 *  ・子機が自分で入れた表（端末だけの表）は、受け取っても消えない
 *
 * ■ 最初にここだけ書き換える（合言葉は、ほかの人に推測されにくいものに）
 *  ・READ_KEY … 閲覧の合言葉（子機に入れる。受け取りだけできる）
 *  ・SEND_KEY … 送信の合言葉（管理者だけが知る。親機の表を送れる）
 * ※このファイルをGitHubなどに公開するときは、本物の合言葉を書かないこと
 */
var READ_KEY = 'ここに閲覧の合言葉';
var SEND_KEY = 'ここに送信の合言葉';
var FOLDER_NAME = 'ポイント照合ツール_親機データ'; // マイドライブに自動で作られるフォルダ

// ------------------------------------------------------------------
// ここから下は書き換えなくてよい
// ------------------------------------------------------------------
var VERSION_PREFIX = 'v', UPLOAD_PREFIX = 'up_';

function doGet(e) { return handle_((e && e.parameter) || {}); }
function doPost(e) {
  var p = {};
  try { p = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (x) { p = {}; }
  return handle_(p);
}
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function handle_(p) {
  try {
    var a = String(p.action || ''), key = String(p.key || '');
    if (READ_KEY.indexOf('ここに') === 0 || SEND_KEY.indexOf('ここに') === 0) return out_({ ok: false, err: 'setup' }); // 合言葉が未設定
    var canSend = key === SEND_KEY, canRead = canSend || key === READ_KEY;
    if (a === 'info') {
      if (!canRead) return out_({ ok: false, err: 'key' });
      return out_({ ok: true, m: manifest_(), send: canSend });
    }
    if (a === 'part') {
      if (!canRead) return out_({ ok: false, err: 'key' });
      var vf = sub_(root_(), VERSION_PREFIX + Number(p.ver));
      var f = vf && file_(vf, 'p' + Number(p.n) + '.txt');
      if (!f) return out_({ ok: false, err: 'gone' }); // 受け取り中に新しい版が送られた → 最初からやり直す
      return out_({ ok: true, data: f.getBlob().getDataAsString() });
    }
    if (a === 'begin' || a === 'up' || a === 'commit') {
      if (!canSend) return out_({ ok: false, err: 'key' });
      var id = String(p.id || '').replace(/[^0-9a-zA-Z]/g, '').slice(0, 40);
      if (!id) return out_({ ok: false, err: 'id' });
      var r = root_(), name = UPLOAD_PREFIX + id;
      if (a === 'begin') { cleanUploads_(r); r.createFolder(name); return out_({ ok: true }); }
      var uf = sub_(r, name); if (!uf) return out_({ ok: false, err: 'noup' });
      if (a === 'up') {
        var pn = 'p' + Number(p.n) + '.txt', old = file_(uf, pn); if (old) old.setTrashed(true);
        uf.createFile(pn, String(p.data || ''), MimeType.PLAIN_TEXT);
        return out_({ ok: true });
      }
      // commit：全部そろっていれば、新しい版として公開する
      var parts = Number(p.parts);
      for (var i = 0; i < parts; i++) if (!file_(uf, 'p' + i + '.txt')) return out_({ ok: false, err: 'missing', n: i });
      var lock = LockService.getScriptLock(); lock.waitLock(30000);
      try {
        var m = manifest_(), ver = (m.ver || 0) + 1;
        uf.setName(VERSION_PREFIX + ver);
        var nm = { ver: ver, at: String(p.at || ''), term: String(p.term || ''), count: Number(p.count) || 0, size: Number(p.size) || 0, parts: parts };
        PropertiesService.getScriptProperties().setProperty('manifest', JSON.stringify(nm));
        cleanVersions_(r, ver);
        return out_({ ok: true, m: nm });
      } finally { lock.releaseLock(); }
    }
    return out_({ ok: false, err: 'action' });
  } catch (e) { return out_({ ok: false, err: 'server', msg: String(e && e.message || e).slice(0, 200) }); }
}
function manifest_() { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('manifest') || '{"ver":0}'); } catch (e) { return { ver: 0 }; } }
function root_() { var it = DriveApp.getFoldersByName(FOLDER_NAME); return it.hasNext() ? it.next() : DriveApp.createFolder(FOLDER_NAME); }
function sub_(f, name) { var it = f.getFoldersByName(name); return it.hasNext() ? it.next() : null; }
function file_(f, name) { var it = f.getFilesByName(name); return it.hasNext() ? it.next() : null; }
/** 古い版は消す（いま受け取り中の子機のために、1つ前の版だけ残す） */
function cleanVersions_(r, ver) {
  var it = r.getFolders();
  while (it.hasNext()) { var f = it.next(), n = f.getName(); if (n.indexOf(VERSION_PREFIX) === 0 && /^\d+$/.test(n.slice(1)) && Number(n.slice(1)) < ver - 1) f.setTrashed(true); }
}
/** 1日以上前の送りかけ（途中で止まった送信）を消す */
function cleanUploads_(r) {
  var it = r.getFolders(), lim = Date.now() - 24 * 3600 * 1000;
  while (it.hasNext()) { var f = it.next(); if (f.getName().indexOf(UPLOAD_PREFIX) === 0 && f.getDateCreated().getTime() < lim) f.setTrashed(true); }
}
