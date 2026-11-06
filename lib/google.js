'use strict';
const { OAuth2Client, JWT } = require('google-auth-library');
const { sheets: makeSheets } = require('@googleapis/sheets');

// Muat .env sederhana (tanpa dependensi tambahan)
function loadEnv() {
  try {
    const lines = require('fs').readFileSync(require('path').join(__dirname, '..', '.env'), 'utf8').split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (!m || lines[i].trim().startsWith('#')) continue;
      const key = m[1];
      let value = m[2];
      if (key === 'GOOGLE_SERVICE_ACCOUNT_JSON' && value.startsWith('{')) {
        while (i + 1 < lines.length) {
          try { JSON.parse(value); break; } catch (e) { value += '\n' + lines[++i]; }
        }
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch (e) { /* tidak ada .env */ }
}

function authClient() {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    let credentials;
    try { credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON); }
    catch (e) { throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON harus berupa JSON service account yang valid.'); }
    if (!credentials.client_email || !credentials.private_key) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON harus berisi client_email dan private_key.');
    }
    return new JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
  }
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    throw new Error('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN belum diisi (lihat README).');
  }
  const c = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
  c.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });
  return c;
}

function clients() {
  const auth = authClient();
  return { sheets: makeSheets({ version: 'v4', auth }) };
}

module.exports = { loadEnv, clients };
