'use strict';
// Definisi kolom spreadsheet: [judul, key, angka?]
const SITE_COLS = [
  ['PIC', 'pic'], ['Site ID', 'siteId'], ['Site Name', 'siteName'], ['Class Site', 'classSite'], ['Cluster', 'cluster'], ['NOP', 'nop'],
  ['ID PLN', 'idPln'], ['MCB KWH', 'mcbKwh'], ['Daya MCB KWH', 'dayaMcbKwh'],
  ['Volt N-R (V)', 'voltNr', 1], ['Volt N-S (V)', 'voltNs', 1], ['Volt N-T (V)', 'voltNt', 1], ['Volt G-N (V)', 'voltGn', 1],
  ['Arus R (A)', 'arusR', 1], ['Arus S (A)', 'arusS', 1], ['Arus T (A)', 'arusT', 1],
  ['Arester KWH', 'aresterKwh'], ['Connector COS KWH', 'connectorCosKwh'], ['Handle Switch COS', 'handleCos'], ['Arester ACPDB', 'aresterAcpdb'],
  ['Jumlah Rectifier', 'jumlahRect', 1],
  ['Tes Backup Battery', 'backupTest'], ['Start Backup', 'backupStart'], ['End Backup', 'backupEnd'], ['Durasi Backup', 'backupTime'],
  ['Main Fail', 'mainFail'], ['Rect Fail', 'rectFail'], ['Battery Stolen', 'batteryStolen'],
  ['Belting Rect', 'beltingRect'], ['Belting RBS', 'beltingRbs'],
  ['Foto ID PLN', 'fotoIdPln'], ['Foto MCB KWH', 'fotoMcbKwh'],
  ['Foto N-R', 'fotoVoltNr'], ['Foto N-S', 'fotoVoltNs'], ['Foto N-T', 'fotoVoltNt'], ['Foto G-N', 'fotoVoltGn'],
  ['Foto Arus R', 'fotoArusR'], ['Foto Arus S', 'fotoArusS'], ['Foto Arus T', 'fotoArusT'],
  ['Foto Arester KWH', 'fotoAresterKwh'], ['Foto Connector COS KWH', 'fotoConnectorCosKwh'],
  ['Foto Handle Switch COS', 'fotoHandleCos'], ['Foto Arester ACPDB', 'fotoAresterAcpdb'],
  ['Foto Panel ACPDB', 'fotoPanelAcpdb'], ['Foto MCB Main ACPDB', 'fotoMcbMainAcpdb'], ['Foto MCB Distribusi ACPDB', 'fotoMcbDistribusiAcpdb'],
  ['Foto Validasi EAS', 'fotoValidasiEas'], ['Foto Belting Rect', 'fotoBeltingRect'], ['Foto Belting RBS', 'fotoBeltingRbs'],
  ['Folder Foto Site', 'folderUrl']
];
const RECT_COLS = [
  ['Type Rectifier', 'typeRect'], ['Status Rectifier', 'statusRect'], ['Type Controller', 'ncuType'], ['Modul Rectifier', 'modulRect'],
  ['Jumlah Modul Rectifier', 'jumlahModulRect', 1], ['Voltase (VDC)', 'voltRect', 1], ['Daya (ADC)', 'adcRect', 1],
  ['Modul Good', 'modulGood', 1], ['Modul Faulty', 'modulFaulty', 1],
  ['Jenis Battery', 'jenisBattery'], ['Tipe Battery', 'batteryType'], ['Status Battery', 'statusBattery'],
  ['Jumlah Battery', 'jumlahBattery'], ['Battery Good', 'batteryGood'], ['Battery Faulty', 'batteryFaulty'],
  ['Foto Type Rectifier', 'fotoTypeRect'], ['Foto NCU', 'fotoNcu'], ['Foto Modul Rectifier', 'fotoModulRect'],
  ['Foto Voltase & Daya', 'fotoRectPower'], ['Foto MCB Battery', 'fotoMcbBattery'],
  ['Foto Arester Rectifier', 'fotoAresterRect'], ['Foto Battery', 'fotoJumlahBattery']
];
const BACKUP_COLS = [
  ['SN Battery', 'snBattery'],
  ['T0 Voltage', 't0Voltage', 1], ['T0 Current', 't0Current', 1], ['T10 Voltage', 't10Voltage', 1], ['T10 Current', 't10Current', 1],
  ['T20 Voltage', 't20Voltage', 1], ['T20 Current', 't20Current', 1], ['T30 Voltage', 't30Voltage', 1], ['T30 Current', 't30Current', 1]
];
const TABS = {
  SITE:   { name: 'Healty Cheak & Validasi EAS' },
  RECT:   { name: ' Rect & Batt Other' },
  SN:     { name: 'Modul & Battery Good/Faulty' },
  BACKUP: { name: 'TEST BECKUP RESULT' },
  EAS:    { name: 'EAS & Security' },
  MASTER: { name: 'Master Site', head: ['Site ID', 'Site Name', 'Class Site', 'Cluster', 'NOP'] }
};

// Kategori folder foto di Drive: NOP / Site ID / <kategori>
const SITE_PHOTO_CAT = {
  fotoIdPln: 'KWH Meter', fotoMcbKwh: 'KWH Meter',
  fotoVoltNr: 'KWH Meter', fotoVoltNs: 'KWH Meter', fotoVoltNt: 'KWH Meter', fotoVoltGn: 'KWH Meter',
  fotoArusR: 'KWH Meter', fotoArusS: 'KWH Meter', fotoArusT: 'KWH Meter',
  fotoAresterKwh: 'KWH Meter', fotoConnectorCosKwh: 'KWH Meter', fotoHandleCos: 'KWH Meter',
  fotoAresterAcpdb: 'ACPDB', fotoPanelAcpdb: 'ACPDB', fotoMcbMainAcpdb: 'ACPDB', fotoMcbDistribusiAcpdb: 'ACPDB',
  fotoValidasiEas: 'Validasi EAS',
  fotoBeltingRect: 'Security Perangkat', fotoBeltingRbs: 'Security Perangkat'
};
const RECT_PHOTO_CAT = {
  fotoTypeRect: 'Rectifier', fotoNcu: 'Rectifier', fotoModulRect: 'Rectifier', fotoRectPower: 'Rectifier',
  fotoMcbBattery: 'Rectifier', fotoAresterRect: 'Rectifier',
  fotoJumlahBattery: 'Battery', fotoBatteryGood: 'Battery', fotoBatteryFaulty: 'Battery'
};

module.exports = { SITE_COLS, RECT_COLS, BACKUP_COLS, TABS, SITE_PHOTO_CAT, RECT_PHOTO_CAT };
