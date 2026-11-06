# Healthy Check & Validasi EAS (Node.js + Google Sheets + foto di server)

- Data masuk **realtime** ke Google Sheets.
- Foto disimpan di **disk server** (Hostinger) dengan susunan:

```
<FILES_DIR> / <NOP> / <Site ID> / <Kategori> / <tanggal-jam>_<SiteID>_<jenis foto>.jpg
Kategori: KWH Meter, ACPDB, Rectifier 1.., Battery 1.., Validasi EAS, Security Perangkat
```

Site tanpa NOP masuk ke folder `Tanpa NOP`.

- Link foto di spreadsheet membuka `https://domainmu.com/files/...` dan **wajib login** (`FILES_USER` / `FILES_PASS`).
  Kolom "Folder Foto Site" membuka folder `NOP / Site ID`, tampil sebagai galeri thumbnail.
  Klik **Lihat foto** di header halaman form untuk menelusuri foto per NOP, Site ID, lalu kategori.
  Buka `https://domainmu.com/files/` untuk menelusuri semua NOP.

## Setup (sekali saja, di komputer)

### 1. Install

```
npm install
cp .env.example .env
```

### 2. Kredensial Google (hanya untuk Sheets)

1. https://console.cloud.google.com → buat project dan aktifkan **Google Sheets API**.
2. IAM & Admin → Service Accounts → buat service account dan buat key JSON.
3. Isi `GOOGLE_SERVICE_ACCOUNT_JSON` di `.env` dengan seluruh isi key JSON. JSON boleh ditulis dalam beberapa baris.
4. Jika spreadsheet sudah ada, isi ID-nya di `GOOGLE_SHEET_ID` dan bagikan spreadsheet ke `client_email` pada key JSON sebagai Editor.

### 3. Validasi spreadsheet yang sudah ada

```
npm run setup
```

Setup hanya memeriksa tab yang diperlukan pada `GOOGLE_SHEET_ID`; setup tidak membuat spreadsheet/tab dan tidak menulis atau mengosongkan isi. Tab yang dipakai aplikasi: `Healty Cheak & Validasi EAS`, ` Rect & Batt Other`, `Modul & Battery Good/Faulty`, `TEST BECKUP RESULT`, dan `EAS & Security`.

### 5. Isi `.env` bagian foto

`FILES_PASS` (wajib), `FILES_DIR`, dan `BASE_URL` (opsional). Spreadsheet lama tidak menyediakan kolom foto, jadi foto disimpan di `FILES_DIR` dan tidak ditambahkan sebagai kolom baru.

### 6. Jalankan

```
npm start        # http://localhost:3000
```

## Master Site (isi otomatis Site Name / Class / Cluster / NOP)

Isi tab **Master Site** di spreadsheet. Perubahan terbaca maks. 30 detik tanpa restart.
Folder foto mengikuti NOP, jadi isi NOP selengkap mungkin.

## Pasang di Hostinger (Node.js Web App)

1. hPanel → Websites → Add website → **Node.js Apps** (paket Business / Cloud).
2. Upload isi proyek (tanpa `node_modules`, tanpa `.env`), startup file `server.js`, klik **NPM install**.
3. Environment Variables: semua isi `.env.example`. Untuk `FILES_DIR` pakai folder di luar folder aplikasi.
4. Aktifkan SSL (HTTPS) supaya kamera HP berfungsi. Restart.

## Penting: penyimpanan server

- Satu submit lengkap ±25–40 foto ≈ 10–15 MB. Pantau sisa disk di hPanel.
- Foto TIDAK otomatis dibackup oleh aplikasi ini. Aktifkan backup Hostinger atau unduh `FILES_DIR` berkala.
- Jangan hapus/ubah nama folder foto, karena link di spreadsheet menunjuk ke path tersebut.
- Jangan ubah nama tab / urutan kolom spreadsheet (isi Master Site boleh diubah).
