'use strict';
// Jalankan SEKALI di komputer sendiri: npm run token
// Menghasilkan GOOGLE_REFRESH_TOKEN untuk akun Google pemilik spreadsheet.
const http = require('http');
const { OAuth2Client } = require('google-auth-library');
const { loadEnv } = require('./lib/google');
loadEnv();

if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
  console.log('Service account sudah dikonfigurasi; refresh token tidak diperlukan. Jalankan: npm run setup');
  process.exit(0);
}

const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;
if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.error('Isi GOOGLE_CLIENT_ID dan GOOGLE_CLIENT_SECRET di file .env dulu.');
  process.exit(1);
}
const PORT = 3333;
const redirect = 'http://localhost:' + PORT;
const client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, redirect);
const url = client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: ['https://www.googleapis.com/auth/spreadsheets']
});

const srv = http.createServer(async (req, res) => {
  const code = new URL(req.url, redirect).searchParams.get('code');
  if (!code) { res.end('Menunggu…'); return; }
  try {
    const { tokens } = await client.getToken(code);
    res.end('Berhasil. Kembali ke terminal.');
    if (!tokens.refresh_token) {
      console.error('\nTidak ada refresh token. Buka https://myaccount.google.com/permissions, cabut akses aplikasi ini, lalu ulangi.');
    } else {
      console.log('\nTempel baris ini ke .env / Environment Variables:\n\nGOOGLE_REFRESH_TOKEN=' + tokens.refresh_token + '\n');
    }
  } catch (e) {
    res.end('Gagal: ' + e.message); console.error(e.message);
  }
  srv.close();
});
srv.listen(PORT, () => console.log('Buka link ini di browser dan login dengan akun Google pemilik data:\n\n' + url + '\n'));
