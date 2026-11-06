'use strict';
// Validasi spreadsheet yang sudah ada tanpa membuat tab atau menulis header.
const { loadEnv, clients } = require('./lib/google');
const { TABS } = require('./lib/schema');
loadEnv();

(async () => {
  const id = process.env.SPREADSHEET_ID || process.env.GOOGLE_SHEET_ID;
  if (!id) throw new Error('Isi GOOGLE_SHEET_ID dengan ID spreadsheet yang sudah ada.');
  const { sheets } = clients();
  const result = await sheets.spreadsheets.get({ spreadsheetId: id, fields: 'sheets.properties.title' });
  const titles = new Set(result.data.sheets.map((sheet) => sheet.properties.title));
  const required = [TABS.SITE, TABS.RECT, TABS.SN, TABS.BACKUP, TABS.EAS];
  const missing = required.filter((tab) => !titles.has(tab.name)).map((tab) => tab.name);
  if (missing.length) throw new Error('Tab yang belum ada di spreadsheet: ' + missing.join(', '));
  console.log('Spreadsheet siap. Tidak ada tab, header, atau isi yang diubah.');
  console.log('ID: ' + id);
})().catch((e) => { console.error('Gagal:', e.errors || e.message); process.exit(1); });