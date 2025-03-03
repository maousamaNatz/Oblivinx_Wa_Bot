const winston = require('winston');
const { combine, timestamp, printf, colorize } = winston.format;
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Variabel untuk menyimpan status debug
let isDebugEnabled = process.env.DEBUG_MODE === 'false';

// Level log yang lebih sederhana
const logLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
    trace: 4  // Menambahkan level trace
  },
  colors: {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    debug: 'blue',
    trace: 'grey'  // Menambahkan warna untuk trace
  }
};

// Format log sederhana
const simpleFormat = printf(({ level, message, timestamp }) => {
  return `${timestamp} [${level.toUpperCase()}] ${message}`;
});

// Format konsol sederhana
const consoleFormat = printf(({ level, message }) => {
  return `[${level.toUpperCase()}] ${message}`;
});

// Fungsi untuk mengaktifkan atau menonaktifkan debug
const toggleDebug = (enable) => {
  isDebugEnabled = enable;
  
  // Update level pada logger
  botLogger.level = isDebugEnabled ? 'debug' : 'info';
  
  // Update .env file
  updateEnvFile('DEBUG_MODE', isDebugEnabled.toString());
  
  return isDebugEnabled;
};

// Fungsi untuk update file .env
const updateEnvFile = (key, value) => {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // Cek apakah key sudah ada
    const regex = new RegExp(`^${key}=.*`, 'm');
    
    if (regex.test(envContent)) {
      // Update nilai yang sudah ada
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      // Tambahkan key baru
      envContent += `\n${key}=${value}`;
    }
    
    // Tulis kembali ke file
    fs.writeFileSync(envPath, envContent);
    return true;
  } catch (error) {
    console.error('Error updating .env file:', error);
    return false;
  }
};

// Logger utama yang lebih sederhana
const botLogger = winston.createLogger({
  levels: logLevels.levels,
  level: isDebugEnabled ? 'debug' : 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    simpleFormat
  ),
  transports: [
    new winston.transports.Console({
      format: combine(
        colorize({ all: true }),
        consoleFormat
      )
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      format: combine(timestamp(), simpleFormat)
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: combine(timestamp(), simpleFormat)
    })
  ]
});

// Logger Baileys sederhana
const baileysLogger = winston.createLogger({
  levels: logLevels.levels,
  level: isDebugEnabled ? 'debug' : 'error',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    simpleFormat
  ),
  transports: [
    new winston.transports.Console({
      format: combine(
        colorize({ all: true }),
        consoleFormat
      )
    }),
    new winston.transports.File({
      filename: 'logs/baileys.log',
      format: combine(timestamp(), simpleFormat)
    })
  ]
});

// Tambahkan fungsi trace ke baileysLogger
baileysLogger.trace = function(message) {
  if (isDebugEnabled) {
    this.debug(`[TRACE] ${message}`);
  }
};

// Tambahkan warna ke level
winston.addColors(logLevels.colors);

// Fungsi log sederhana
const log = (message, type = 'info') => {
  // Jika debug dinonaktifkan dan tipe adalah debug, jangan tampilkan
  if (!isDebugEnabled && (type === 'debug' || type === 'trace')) return;
  
  // Standarisasi nilai type ke lowercase untuk memastikan konsistensi
  const normalizedType = type.toLowerCase();
  
  switch(normalizedType) {
    case 'error':
      botLogger.error(message);
      break;
    case 'warn':
    case 'warning':
      botLogger.warn(message);
      break;
    case 'debug':
      botLogger.debug(message);
      break;
    case 'trace':
      botLogger.debug(`[TRACE] ${message}`);
      break;
    case 'success':
      // Perlakukan 'success' sebagai level 'info'
      botLogger.info(message);
      break;
    default:
      botLogger.info(message);
  }
};

// Fungsi untuk mendapatkan status debug
const getDebugStatus = () => {
  return isDebugEnabled;
};

module.exports = { 
  botLogger,
  baileysLogger,
  log,
  toggleDebug,
  getDebugStatus
};