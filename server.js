'use strict';
const express = require('express');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { TABS, SITE_PHOTO_CAT, RECT_PHOTO_CAT } = require('./lib/schema');

// Nama folder/file aman: tanpa / \ : * ? " < > | dan tidak boleh diawali titik (cegah "..")
const cleanName = (s, fallback) => {
  const t = String(s == null ? '' : s)
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').replace(/\s+/g, ' ').replace(/^[.\s]+/, '').trim().slice(0, 80);
  return t || fallback;
};
const safeKey = (s) => String(s || '').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 60);
const str = (v, n) => String(v == null ? '' : v).slice(0, n || 500);
const html = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const encPath = (parts) => parts.map(encodeURIComponent).join('/');

function createApp({ sheets, spreadsheetId, filesDir, user, pass, baseUrl, tz }) {
  tz = tz || 'Asia/Jakarta';
  if (!pass) throw new Error('FILES_PASS wajib diisi (password untuk membuka foto).');
  filesDir = path.resolve(filesDir);
  fs.mkdirSync(filesDir, { recursive: true });
  const stamp = (d) => new Intl.DateTimeFormat('sv-SE', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(d);
  const origin = (req) => (baseUrl || (req.protocol + '://' + req.get('host'))).replace(/\/+$/, '');
  const sitePath = (nop, siteId) => [cleanName(nop, 'Tanpa NOP').toUpperCase(), cleanName(siteId, 'Tanpa Site ID').toUpperCase()];

  /* ---------- Sheets ---------- */
  let sheetIds = null;
  async function getSheetIds() {
    if (sheetIds) return sheetIds;
    const r = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties(sheetId,title)' });
    const m = {};
    r.data.sheets.forEach((s) => { m[s.properties.title] = s.properties.sheetId; });
    [TABS.SITE, TABS.RECT, TABS.SN, TABS.BACKUP, TABS.EAS].forEach((t) => {
      if (m[t.name] === undefined) throw new Error('Tab "' + t.name + '" tidak ada di spreadsheet.');
    });
    sheetIds = m;
    return m;
  }
  // linkOk: hanya link ke foto di server ini yang dijadikan hyperlink
  function makeCell(linkOk) {
    return function cell(v, isNum) {
      if (v == null || v === '') return {};
      if (typeof v === 'number') return { userEnteredValue: { numberValue: v } };
      v = String(v).trim().slice(0, 500);
      if (isNum && v !== '' && !isNaN(Number(v))) return { userEnteredValue: { numberValue: Number(v) } };
      if (linkOk(v)) return { userEnteredValue: { formulaValue: '=HYPERLINK("' + v + '","Buka")' } };
      return { userEnteredValue: { stringValue: v } }; // teks apa adanya, tidak dieksekusi sebagai rumus
    };
  }
  const pick = (o, k) => (o[k] != null ? o[k] : o.photos && o.photos[k] != null ? o.photos[k] : '');

  let master = { t: 0, map: new Map() };
  async function loadMaster() {
    if (Date.now() - master.t < 30000) return master.map;
    try {
      const ids = await getSheetIds();
      if (ids[TABS.MASTER.name] === undefined) {
        master = { t: Date.now(), map: new Map() };
        return master.map;
      }
      const r = await sheets.spreadsheets.values.get({ spreadsheetId, range: "'" + TABS.MASTER.name + "'!A2:E" });
      const map = new Map();
      (r.data.values || []).forEach((c) => { if (c[0]) map.set(String(c[0]).trim().toUpperCase(), { siteName: String(c[1] || '').trim().toUpperCase(), classSite: String(c[2] || '').trim().toUpperCase(), cluster: String(c[3] || '').trim().toUpperCase(), nop: String(c[4] || '').trim().toUpperCase() }); });
      master = { t: Date.now(), map };
    } catch (e) { console.error('Master Site:', e.message); master.t = Date.now() - 20000; }
    return master.map;
  }

  /* ---------- Express ---------- */
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '8mb' }));
  app.use('/api', rateLimit({ windowMs: 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }));
  const wrap = (fn) => (req, res) => Promise.resolve().then(() => fn(req, res)).catch((e) => {
    console.error(e && e.errors ? JSON.stringify(e.errors) : e);
    res.status(500).json({ error: 'Server gagal memproses (Sheets/penyimpanan). Coba lagi sebentar lagi.' });
  });

  app.get('/api/site/:id', wrap(async (req, res) => {
    const map = await loadMaster();
    res.json(map.get(String(req.params.id || '').trim().toUpperCase()) || null);
  }));

  // Simpan foto: <filesDir>/<NOP>/<Site ID>/<Kategori>/<file>.jpg
  app.post('/api/image', wrap(async (req, res) => {
    const b = req.body || {};
    const siteId = str(b.siteId, 60).trim().toUpperCase();
    if (!siteId) return res.status(400).json({ error: 'Site ID wajib diisi.' });
    const key = String(b.key || '');
    const rectNo = String(b.rectNo || '');
    let cat;
    if (rectNo) {
      if (!/^\d{1,2}$/.test(rectNo) || !RECT_PHOTO_CAT[key]) return res.status(400).json({ error: 'Jenis foto tidak dikenal.' });
      cat = RECT_PHOTO_CAT[key] + ' ' + rectNo;
    } else {
      cat = SITE_PHOTO_CAT[key];
      if (!cat) return res.status(400).json({ error: 'Jenis foto tidak dikenal.' });
    }
    if (typeof b.data !== 'string' || !b.data.startsWith('/9j/')) return res.status(400).json({ error: 'File harus berupa foto JPEG.' });
    const visit = /^\d{8}-\d{6}$/.test(String(b.visit)) ? b.visit : stamp(new Date()).replace(/[-:]/g, '').replace(' ', '-');
    const idx = /^\d{1,2}$/.test(String(b.idx || '')) ? '_' + b.idx : '';
    const fileName = visit + '_' + safeKey(siteId) + '_' + key.replace(/^foto/, '') + idx + '.jpg';

    const parts = sitePath(b.nop, siteId).concat([cat]);
    const dir = path.join(filesDir, ...parts);
    if (!dir.startsWith(filesDir + path.sep)) return res.status(400).json({ error: 'Nama folder tidak valid.' });
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(path.join(dir, fileName), Buffer.from(b.data, 'base64'));
    res.json({ url: origin(req) + '/files/' + encPath(parts.concat([fileName])) });
  }));

  const done = new Map(); // submitKey -> hasil (cegah dobel saat kirim ulang)
  app.post('/api/submit', wrap(async (req, res) => {
    const d = req.body || {};
    const siteId = str(d.siteId, 60).trim().toUpperCase();
    d.siteId = siteId;
    if (!siteId) return res.status(400).json({ error: 'Site ID wajib diisi.' });
    ['siteName', 'classSite', 'cluster', 'nop'].forEach((key) => { d[key] = str(d[key], 500).trim().toUpperCase(); });
    const sk = /^[a-z0-9]{8,40}$/.test(String(d.submitKey)) ? d.submitKey : null;
    if (sk && done.has(sk)) return res.json(done.get(sk));

    const now = new Date(), ts = stamp(now);
    const id = 'HC-' + ts.replace(/[-: ]/g, '') + '-' + safeKey(siteId) + '-' + crypto.randomBytes(2).toString('hex');
    const rects = Array.isArray(d.rectifiers) ? d.rectifiers.slice(0, 30) : [];
    d.jumlahRect = rects.length;

    const ids = await getSheetIds();
    const cell = makeCell(() => false);
    const reqs = [];
    const blankRow = (length) => Array.from({ length }, () => ({}));
    const set = (row, index, value, isNum) => { row[index] = cell(value, isNum); };
    const date = ts.slice(0, 10), time = ts.slice(11);
    const setSite = (row, start, includePic) => {
      set(row, start, date); set(row, start + 1, time);
      const offset = start + 2;
      if (includePic) set(row, offset, d.pic);
      const base = offset + (includePic ? 1 : 0);
      ['siteId', 'siteName', 'classSite', 'cluster', 'nop'].forEach((key, index) => set(row, base + index, d[key]));
    };
    const setRectifier = (row, start, rect) => {
      if (!rect) return;
      [
        ['typeRect'], ['statusRect'], ['ncuType'], ['modulRect'], ['jumlahModulRect', true],
        ['voltRect', true], ['adcRect', true], ['modulGood', true], ['modulFaulty', true],
        ['jenisBattery'], ['batteryType'], ['statusBattery'], ['jumlahBattery'], ['batteryGood'], ['batteryFaulty']
      ].forEach((field, index) => set(row, start + index, rect[field[0]], field[1]));
    };
    const append = (tab, rows) => {
      if (rows.length) reqs.push({ appendCells: { sheetId: ids[tab.name], rows: rows.map((values) => ({ values })), fields: 'userEnteredValue' } });
    };

    const siteRow = blankRow(38);
    setSite(siteRow, 0, true);
    [
      ['idPln', 8], ['mcbKwh', 9], ['dayaMcbKwh', 10], ['voltNr', 11, true], ['voltNs', 12, true],
      ['voltNt', 13, true], ['voltGn', 14, true], ['arusR', 15, true], ['arusS', 16, true], ['arusT', 17, true],
      ['aresterKwh', 18], ['connectorCosKwh', 19], ['handleCos', 20], ['aresterAcpdb', 21], ['backupTime', 37]
    ].forEach((field) => set(siteRow, field[1], d[field[0]], field[2]));
    setRectifier(siteRow, 22, rects[0]);
    append(TABS.SITE, [siteRow]);

    const easRow = blankRow(13);
    setSite(easRow, 0, true);
    [['mainFail', 8], ['rectFail', 9], ['batteryStolen', 10], ['beltingRect', 11], ['beltingRbs', 12]]
      .forEach((field) => set(easRow, field[1], d[field[0]]));
    append(TABS.EAS, [easRow]);

    const rectRows = rects.slice(1).map((rect) => {
      const row = blankRow(24);
      setSite(row, 0, true);
      setRectifier(row, 8, rect);
      set(row, 23, rect.rectNo);
      return row;
    });
    append(TABS.RECT, rectRows);

    const snRows = [];
    const snColumns = { 'Modul Good': 8, 'Battery Good': 13, 'Modul Faulty': 18, 'Battery Faulty': 23 };
    rects.forEach((rect) => {
      const entries = Array.isArray(rect.sn) ? rect.sn : [];
      if (!entries.some((entry) => entry.sn)) return;
      const row = blankRow(29);
      setSite(row, 0, true);
      entries.forEach((entry) => {
        const start = snColumns[entry.kategori];
        const slot = Number(entry.no) - 1;
        if (start !== undefined && slot >= 0 && slot < 5) set(row, start + slot, entry.sn);
      });
      set(row, 28, rect.rectNo);
      snRows.push(row);
    });
    append(TABS.SN, snRows);

    const backupRows = (Array.isArray(d.backupResults) ? d.backupResults : []).map((result) => {
      const row = blankRow(19);
      set(row, 0, date); set(row, 1, time);
      ['siteId', 'siteName', 'classSite', 'cluster', 'nop'].forEach((key, index) => set(row, index + 2, d[key]));
      set(row, 7, result.rectNo); set(row, 8, result.batteryNo); set(row, 9, result.snBattery);
      [
        ['t0Voltage', true], ['t0Current', true], ['t10Voltage', true], ['t10Current', true],
        ['t20Voltage', true], ['t20Current', true], ['t30Voltage', true], ['t30Current', true]
      ].forEach((field, index) => set(row, index + 10, result[field[0]], field[1]));
      set(row, 18, d.backupTime);
      return row;
    });
    append(TABS.BACKUP, backupRows);

    // satu permintaan = semua tab terisi bersamaan (atomik)
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: reqs } });

    const result = { ok: true, submitId: id };
    if (sk) { done.set(sk, result); if (done.size > 500) done.delete(done.keys().next().value); }
    res.json(result);
  }));

  /* ---------- Lihat foto (wajib login) ---------- */
  function auth(req, res, next) {
    const h = req.headers.authorization || '';
    const [u, p] = Buffer.from(h.replace(/^Basic /, ''), 'base64').toString().split(/:(.*)/s);
    const same = (a, b) => { const x = Buffer.from(String(a || '')), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
    if (same(u, user) && same(p, pass)) return next();
    res.set('WWW-Authenticate', 'Basic realm="Foto Healthy Check"').status(401).send('Login diperlukan.');
  }
  app.get(/^\/files(\/.*)?$/, auth, (req, res) => {
    let rel;
    try { rel = decodeURIComponent(req.path.replace(/^\/files\/?/, '')); } catch (e) { return res.sendStatus(400); }
    const target = path.resolve(filesDir, rel);
    if (target !== filesDir && !target.startsWith(filesDir + path.sep)) return res.sendStatus(403);
    if (!fs.existsSync(target)) return res.sendStatus(404);
    const st = fs.statSync(target);
    if (st.isFile()) return res.sendFile(target, { dotfiles: 'deny', headers: { 'Content-Disposition': 'inline', 'X-Content-Type-Options': 'nosniff' } });

    // daftar isi folder (gambar tampil sebagai thumbnail)
    const parts = rel.split('/').filter(Boolean);
    const base = '/files/' + (parts.length ? encPath(parts) + '/' : '');
    const entries = fs.readdirSync(target, { withFileTypes: true }).filter((e) => !e.name.startsWith('.'))
      .sort((a, b) => (a.isDirectory() === b.isDirectory() ? a.name.localeCompare(b.name, 'id', { numeric: true }) : a.isDirectory() ? -1 : 1));
    const crumbs = ['<a href="/files/">Semua NOP</a>'].concat(parts.map((p, i) => '<a href="/files/' + encPath(parts.slice(0, i + 1)) + '/">' + html(p) + '</a>')).join(' / ');
    const dirs = entries.filter((e) => e.isDirectory()).map((e) => '<a class="d" href="' + base + encodeURIComponent(e.name) + '/">📁 ' + html(e.name) + '</a>').join('');
    const imgs = entries.filter((e) => e.isFile()).map((e) => '<a class="i" href="' + base + encodeURIComponent(e.name) + '" target="_blank"><img loading="lazy" src="' + base + encodeURIComponent(e.name) + '" alt=""><span>' + html(e.name) + '</span></a>').join('');
    res.send('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Foto</title>' +
      '<style>body{font:15px system-ui,sans-serif;margin:0;padding:16px;background:#eef2f7}header{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px}nav{font-weight:600}a{color:#1565c0;text-decoration:none}.home{display:inline-block;background:#1565c0;color:#fff;border-radius:8px;padding:9px 13px;font-weight:600}' +
      '.d{display:block;background:#fff;border:1px solid #cfd8e3;border-radius:8px;padding:12px 14px;margin-bottom:8px;color:#1b2733}' +
      '.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-top:10px}.i{background:#fff;border:1px solid #cfd8e3;border-radius:8px;overflow:hidden}' +
      '.i img{width:100%;aspect-ratio:1;object-fit:cover;display:block;background:#dde4ec}.i span{display:block;padding:6px 8px;font-size:11.5px;word-break:break-all;color:#1b2733}</style>' +
      '<header><nav>' + crumbs + '</nav><a class="home" href="/">Kembali ke form</a></header>' + dirs + (imgs ? '<div class="g">' + imgs + '</div>' : '') + (!dirs && !imgs ? '<p>Folder kosong.</p>' : ''));
  });

  app.use(express.static(path.join(__dirname, 'public')));
  return app;
}

module.exports = { createApp };

const { loadEnv, clients } = require('./lib/google');
loadEnv();
const e = process.env;
const spreadsheetId = e.SPREADSHEET_ID || e.GOOGLE_SHEET_ID;
const missing = [!spreadsheetId && 'SPREADSHEET_ID / GOOGLE_SHEET_ID', !e.FILES_PASS && 'FILES_PASS'].filter(Boolean);
if (missing.length) { console.error('Belum diisi: ' + missing.join(', ') + ' (lihat README)'); process.exit(1); }
const { sheets } = clients();
createApp({
  sheets, spreadsheetId, tz: e.TZ, baseUrl: e.BASE_URL,
  filesDir: e.FILES_DIR || path.join(__dirname, 'uploads'), user: e.FILES_USER || 'admin', pass: e.FILES_PASS
}).listen(e.PORT || 3000, () => console.log('Berjalan di port ' + (e.PORT || 3000) + ' | foto: ' + path.resolve(e.FILES_DIR || path.join(__dirname, 'uploads'))));
