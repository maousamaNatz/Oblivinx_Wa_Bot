// Contoh penggunaan logger dengan fitur toggle logging
const { log, toggleLogging, getLoggingStatus } = require('./src/utils/logger');

// Fungsi untuk menjalankan demo logger
async function demoLogger() {
  console.log('===== DEMO LOGGER =====');
  
  // Status awal
  console.log(`Status logging: ${getLoggingStatus() ? 'Aktif' : 'Nonaktif'}`);
  
  // Log pesan dengan berbagai level
  log('Ini adalah pesan info standar');
  log('Ini adalah pesan kesalahan', 'error');
  log('Ini adalah pesan peringatan', 'warn');
  log('Ini adalah pesan debug', 'debug');
  log('Ini adalah pesan trace', 'trace');
  
  // Menonaktifkan logging
  console.log('\nMenonaktifkan logging...');
  toggleLogging(false);
  console.log(`Status logging: ${getLoggingStatus() ? 'Aktif' : 'Nonaktif'}`);
  
  // Mencoba log pesan setelah logging dinonaktifkan
  // Pesan ini harusnya hanya muncul di file error.log
  log('Pesan ini tidak akan muncul di konsol atau combined.log');
  log('Tetapi pesan error ini tetap dicatat dalam file error.log', 'error');
  
  // Mengaktifkan logging kembali
  console.log('\nMengaktifkan logging kembali...');
  toggleLogging(true);
  console.log(`Status logging: ${getLoggingStatus() ? 'Aktif' : 'Nonaktif'}`);
  
  // Log pesan setelah logging diaktifkan kembali
  log('Pesan info kembali muncul di konsol dan file');
  log('Pesan error tetap muncul seperti biasa', 'error');
  
  console.log('\n===== DEMO SELESAI =====');
}

// Jalankan demo
demoLogger(); 