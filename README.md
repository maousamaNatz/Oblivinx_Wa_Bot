i dont know

## Logger

Sistem logger mendukung fitur untuk mengaktifkan dan menonaktifkan pencatatan log. Ketika dinonaktifkan, hanya log error yang akan dicatat ke dalam file.

### Konfigurasi

Konfigurasi logger dapat diatur di file `.env`:

```
LOGGING_ENABLED=true    # true untuk mengaktifkan, false untuk menonaktifkan
DEBUG_MODE=false        # true untuk mengaktifkan mode debug
```

### Penggunaan

```javascript
const { log, toggleLogging, getLoggingStatus } = require('./src/utils/logger');

// Memeriksa status logging
const status = getLoggingStatus(); // true atau false

// Menonaktifkan logging (hanya error yang akan dicatat ke file)
toggleLogging(false);

// Mengaktifkan logging kembali
toggleLogging(true);

// Mencatat log
log('Pesan info standar');
log('Pesan error', 'error');
log('Pesan peringatan', 'warn');
log('Pesan debug', 'debug');
log('Pesan trace', 'trace');
```

### Demo

Untuk mencoba fitur logger, jalankan:

```
node test-logger.js
```