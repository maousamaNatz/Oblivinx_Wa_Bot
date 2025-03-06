const winston = require('winston');
const { combine, timestamp, printf, colorize } = winston.format;
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Variabel untuk menyimpan status debug
let isDebugEnabled = process.env.DEBUG_MODE || 'false';

// Level log yang lebih sederhana
const logLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
    trace: 4
  },
  colors: {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    debug: 'blue',
    trace: 'grey'
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
  botLogger.level = isDebugEnabled ? 'debug' : 'info';
  updateEnvFile('DEBUG_MODE', isDebugEnabled.toString());
  return isDebugEnabled;
};

// Fungsi untuk update file .env
const updateEnvFile = (key, value) => {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    let envContent = fs.readFileSync(envPath, 'utf8');
    const regex = new RegExp(`^${key}=.*`, 'm');
    
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      envContent += `\n${key}=${value}`;
    }
    
    fs.writeFileSync(envPath, envContent);
    return true;
  } catch (error) {
    console.error('Error updating .env file:', error);
    return false;
  }
};

// Logger utama
const botLogger = winston.createLogger({
  levels: logLevels.levels,
  level: isDebugEnabled ? 'debug' : 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    simpleFormat
  ),
  transports: [
    // Console transport untuk semua level
    new winston.transports.Console({
      format: combine(
        colorize({ all: true }),
        consoleFormat
      )
    }),
    // File transport hanya untuk error
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: combine(timestamp(), simpleFormat)
    })
  ]
});

// Logger Baileys
const baileysLogger = winston.createLogger({
  levels: logLevels.levels,
  level: isDebugEnabled ? 'debug' : 'error',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    simpleFormat
  ),
  transports: [
    // Console transport untuk semua level
    new winston.transports.Console({
      format: combine(
        colorize({ all: true }),
        consoleFormat
      )
    }),
    // File transport hanya untuk error
    new winston.transports.File({
      filename: 'logs/baileys-error.log',
      level: 'error',
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
  if (!isDebugEnabled && (type === 'debug' || type === 'trace')) return;
  
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
    case 'infoowner':
      botLogger.debug(`[Owner] ${message}`);
      break;
    case 'success':
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