const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
} = require("@whiskeysockets/baileys");
const fs = require("fs");
const path = require("path");
require("dotenv").config();
const permissionHandler = require("./src/handler/permission");
const {
  botLogger,
  baileysLogger,
  getDebugStatus
} = require("./src/utils/logger");
const {
  config,
  store,
  msgRetryCounterCache,
  commands,
  PREFIX,
  messageQueue,
  RATE_LIMIT,
  MAX_RETRIES,
  RETRY_INTERVAL,
  retryCount,
  callAttempts,
  MAX_CALL_ATTEMPTS,
  BAN_TYPES,
  RECONNECT_INTERVAL,
  MAX_RECONNECT_RETRIES,
  CONNECTION_TIMEOUT
} = require("./config/config");
const {
  pool,
  banUser,
  blockUserBySystem,
  checkUserStatus,
  registerUser,
  getBotCredentials,
  saveBotCredentials,
  handleQrCode,
} = require("./config/dbConf/database");
const { unbanUser } = require("./src/handler/messageHandler");
const { handleGroupMessage } = require("./src/handler/groupHandler");
const crypto = require("crypto");

// Tambahkan di awal file, tepat setelah baris pertama (misalnya 'use strict' jika ada)
if (!process.env.PREFIX || process.env.PREFIX.trim() === "") {
  process.env.PREFIX = "!";
}

// ====== LOGGER ======
const log = (type, message) => {
  require("./src/utils/logger").log(message, type);
};

// ====== COMMAND HANDLER ======
function registerCommand(cmdConfig, handler) {
  if (!cmdConfig.pattern || typeof handler !== "function") {
    throw new Error("Command harus memiliki pattern dan handler.");
  }
  commands.push({ config: cmdConfig, handler });
}

function executeCommand(sock, msg, sender, command, args) {
  botLogger.info(`Menjalankan command: ${command} dengan args: ${args.join(' ')}`);
  try {
    // Cari command di global.Oblixn terlebih dahulu
    if (global.Oblixn && global.Oblixn.commands && global.Oblixn.commands.has(command)) {
      const cmd = global.Oblixn.commands.get(command);
      return cmd.exec(msg, { args });
    }
    // Cek alias bila tidak ditemukan
    if (global.Oblixn && global.Oblixn.commands) {
      for (const [cmdName, cmdObj] of global.Oblixn.commands.entries()) {
        if (cmdObj.alias && cmdObj.alias.includes(command)) {
          return cmdObj.exec(msg, { args });
        }
      }
    }
    // Jika tidak, cari di commands
    for (const cmd of commands) {
      const pattern = new RegExp(cmd.config.pattern);
      if (pattern.test(command)) {
        return cmd.handler(sock, msg, args);
      }
    }
    msg.reply(`Maaf, perintah *${command}* tidak ditemukan. Gunakan ${PREFIX}help untuk melihat daftar perintah.`);
    botLogger.warn(`Command tidak ditemukan: ${command}`);
  } catch (error) {
    botLogger.error(`Error menjalankan command ${command}: ${error.message}`);
    msg.reply(`Terjadi kesalahan saat menjalankan perintah: ${error.message}`);
  }
}

// ====== LOAD COMMANDS ======
function loadCommands(commandsPath) {
  try {
    botLogger.info(`Loading commands from ${commandsPath}`);
    if (!fs.existsSync(commandsPath)) {
      botLogger.error(`Directory not found: ${commandsPath}`);
      return;
    }
    const files = fs.readdirSync(commandsPath);
    let loadedCount = 0;
    files.forEach((file) => {
      const fullPath = path.join(commandsPath, file);
      if (fs.lstatSync(fullPath).isFile() && file.endsWith(".js")) {
        try {
          require(fullPath);
          loadedCount++;
        } catch (error) {
          botLogger.error(`Error loading command file ${file}: ${error.message}`);
        }
      }
    });
    botLogger.info(`${loadedCount} command files loaded successfully`);
  } catch (error) {
    botLogger.error(`Error loading commands: ${error.message}`);
  }
}

// ====== DEFINE OBLIXN CMD ======
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

global.Oblixn = {
  commands: new Map(),
  cmd: function (options) {
    const { name, alias = [], desc = "", category = "utility", exec } = options;
    if (!name || typeof exec !== "function") {
      throw new Error('Command harus memiliki "name" dan "exec" sebagai function.');
    }
    const wrappedExec = async (msg, params) => {
      try {
        if (category !== "owner" && category !== "ownercommand") {
          const userId = msg.sender.split("@")[0];
          let normalizedUserId = userId;
          if (normalizedUserId.startsWith("08")) {
            normalizedUserId = "62" + normalizedUserId.slice(1);
          } else if (normalizedUserId.startsWith("+62")) {
            normalizedUserId = normalizedUserId.slice(1);
          }
          const { isBanned, banInfo } = await checkBanStatus(normalizedUserId);
          if (isBanned) {
            const banDate = new Date(banInfo.banned_at).toLocaleDateString("id-ID");
            const banMessage = `❌ *Akses Ditolak*\n\nMaaf, Anda telah dibanned dari menggunakan bot!\n\n*Detail Ban:*\n📝 Alasan: ${banInfo.reason}\n📅 Tanggal: ${banDate}\n\nSilakan hubungi owner untuk unbanned.`;
            await msg.reply(banMessage);
            return;
          }
        }
        return await exec(msg, params);
      } catch (error) {
        botLogger.error(`Error executing command ${name}:`, error);
        msg.reply("Terjadi kesalahan saat menjalankan perintah.");
      }
    };
    const patterns = [name, ...alias].map((cmd) => `^${escapeRegex(cmd)}(?:\s+(.*))?$`);
    registerCommand({
      pattern: patterns[0],
      secondPattern: patterns.slice(1),
      fromMe: false,
      desc,
      use: category
    }, wrappedExec);
    this.commands.set(name, { ...options, exec: wrappedExec });
  },
  isOwner: function (sender) {
    const senderNumber = sender.split("@")[0];
    const ownerNumbers = process.env.OWNER_NUMBER_ONE.split(",").concat(
      process.env.OWNER_NUMBER_TWO ? process.env.OWNER_NUMBER_TWO.split(",") : []
    );
    const normalizedSender = senderNumber.startsWith("62") ? "0" + senderNumber.slice(2) : senderNumber;
    botLogger.info(`Checking owner: ${normalizedSender}`);
    return ownerNumbers.includes(normalizedSender);
  }
};

// ====== CONNECTION HANDLER ======
let activeSocket = null;
let qrTimer = null;
let isReconnecting = false;
global.otpHandlers = {};

let reconnectAttempts = 0;

const initBot = async () => {
  if (activeSocket && activeSocket.user) {
    botLogger.info("Session utama sudah login, melewati inisialisasi ulang.");
    return activeSocket;
  }
  try {
    const resetReconnectState = () => {
      isReconnecting = false;
      reconnectAttempts = 0;
    };

    const handleReconnect = async () => {
      if (isReconnecting) return;
      isReconnecting = true;
      reconnectAttempts++;
      botLogger.info(`Mencoba reconnect... (Percobaan ${reconnectAttempts}/${MAX_RECONNECT_RETRIES})`);
      if (reconnectAttempts > MAX_RECONNECT_RETRIES) {
        botLogger.error('Melebihi batas maksimum reconnect, menghentikan bot...');
        process.exit(1);
      }
      await new Promise(resolve => setTimeout(resolve, RECONNECT_INTERVAL));
      try {
        if (activeSocket?.ws) {
          activeSocket.ws.close();
          activeSocket.ev.removeAllListeners();
        }
        const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
        activeSocket = makeWASocket({
          auth: state,
          printQRInTerminal: true,
          logger: baileysLogger,
          browser: ['Oblivinx Bot', 'Chrome', '1.0.0'],
          connectTimeoutMs: CONNECTION_TIMEOUT,
          keepAliveIntervalMs: 30000,
          retryRequestDelayMs: 5000
        });
        global.activeSocket = activeSocket;
        setupSocketHandlers(activeSocket, saveCreds);
        isReconnecting = false;
      } catch (error) {
        botLogger.error('Gagal melakukan reconnect:', error);
        isReconnecting = false;
      }
    };

    const setupSocketHandlers = (sock, saveCreds) => {
      const handlers = {
        connectionUpdate: async (update) => {
          const { connection, lastDisconnect, qr } = update;
          if (qr && !sock.user) {
            botLogger.info('QR Code baru tersedia, scan untuk login');
          }
          if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const errorMessage = lastDisconnect?.error?.message || 'Unknown error';
            if (statusCode === 515 && sock.user) {
              botLogger.warn('Terjadi stream error 515 namun sesi aktif, tidak melakukan reconnect.');
              return;
            }
            botLogger.error(`Koneksi terputus dengan status: ${statusCode}, pesan: ${errorMessage}`);
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect && !isReconnecting) {
              botLogger.info(`Mencoba reconnect dalam ${RECONNECT_INTERVAL/1000} detik...`);
              if (errorMessage.includes('conflict')) {
                botLogger.warn('Terdeteksi konflik sesi, menghapus credentials...');
                try {
                  const authDir = path.join(process.cwd(), 'auth_info_baileys');
                  if (fs.existsSync(authDir)) {
                    fs.rmSync(authDir, { recursive: true, force: true });
                    botLogger.info('Berhasil menghapus credentials yang konflik');
                  }
                } catch (err) {
                  botLogger.error('Gagal menghapus credentials:', err);
                }
              }
              handleReconnect();
            } else if (statusCode === DisconnectReason.loggedOut) {
              botLogger.warn('Anda telah logout, silakan scan QR code baru untuk login kembali');
              try {
                const authDir = path.join(process.cwd(), 'auth_info_baileys');
                if (fs.existsSync(authDir)) {
                  fs.rmSync(authDir, { recursive: true, force: true });
                  botLogger.info('Berhasil menghapus credentials setelah logout');
                }
              } catch (err) {
                botLogger.error('Gagal menghapus credentials:', err);
              }
              setTimeout(() => {
                botLogger.info('Mencoba memulai koneksi baru...');
                handleReconnect();
              }, RECONNECT_INTERVAL);
            }
          } else if (connection === 'open') {
            botLogger.info('Koneksi terbuka!');
            resetReconnectState();
          }
        },
        credsUpdate: saveCreds,
        messagesUpsert: async (m) => {
          try {
            if (isReconnecting) {
              botLogger.info('Skip processing message during reconnection');
              return;
            }
            botLogger.debug(`Struktur pesan: ${JSON.stringify(m, null, 2)}`);
            const msg = m.messages[0];
            if (!msg) {
              botLogger.debug('Pesan kosong, dilewati');
              return;
            }
            const sender = msg.key.remoteJid;
            if (!sender || msg.key.fromMe) {
              botLogger.debug('Pesan dari diri sendiri atau tidak memiliki pengirim, dilewati');
              return;
            }
            const isGroup = sender.endsWith("@g.us");
            const participant = msg.key.participant || msg.participant || sender;
            const messageText = msg.message?.conversation || 
                               msg.message?.extendedTextMessage?.text || 
                               msg.message?.imageMessage?.caption || 
                               msg.message?.buttonsResponseMessage?.selectedButtonId ||
                               msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
                               "";
            const enhancedMsg = {
              ...msg,
              chat: sender,
              from: sender,
              sender: participant,
              isGroup: isGroup,
              botNumber: sock.user.id,
              pushName: msg.pushName,
              messageText: messageText,
              mentions: msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [],
              reply: async (content) => {
                try {
                  const messageContent = typeof content === "object" ? content : { text: String(content) };
                  return await sock.sendMessage(sender, messageContent, { quoted: msg });
                } catch (error) {
                  botLogger.error(`Error mengirim balasan: ${error.message}`);
                  try {
                    const messageContent = typeof content === "object" ? content : { text: String(content) };
                    return await sock.sendMessage(sender, messageContent);
                  } catch (retryError) {
                    botLogger.error(`Gagal kirim ulang: ${retryError.message}`);
                    throw retryError;
                  }
                }
              }
            };
            if (isGroup) {
              botLogger.info(`Menangani pesan grup dari ${participant} di ${sender}: "${messageText}"`);
              if (messageText.startsWith(PREFIX)) {
                const parsedCommand = commandHandler(messageText);
                if (parsedCommand) {
                  const { command, args } = parsedCommand;
                  botLogger.info(`Menjalankan command grup: ${command} dengan args: ${args.join(' ')}`);
                  executeCommand(sock, enhancedMsg, sender, command, args);
                  return;
                }
              }
              handleGroupMessage(sock, enhancedMsg).catch(error => {
                botLogger.error(`Error handling group message: ${error.message}`);
              });
              return;
            }
            if (messageText.startsWith(PREFIX)) {
              const parsedCommand = commandHandler(messageText);
              if (parsedCommand) {
                const { command, args } = parsedCommand;
                executeCommand(sock, enhancedMsg, sender, command, args);
              }
            }
            const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (quoted && quoted.conversation && quoted.conversation.includes('Balas pesan ini dengan kode OTP')) {
              const match = quoted.conversation.match(/\d+/);
              if (match) {
                const targetNumber = match[0];
                if (global.otpHandlers[targetNumber]) {
                  const otp = msg.message.extendedTextMessage.text;
                  await global.otpHandlers[targetNumber](otp);
                  delete global.otpHandlers[targetNumber];
                }
              }
            }
          } catch (error) {
            botLogger.error("Error processing message:", error);
            console.error(error);
          }
        },
        call: async (calls) => {
          if (!calls || calls.length === 0) return;
          const call = calls[0];
          if (call.status !== "offer") return;
          const callerId = call.from;
          callAttempts[callerId] = (callAttempts[callerId] || 0) + 1;
          if (callAttempts[callerId] >= MAX_CALL_ATTEMPTS) {
            botLogger.warn(`Pengguna ${callerId} telah mencoba menelepon ${MAX_CALL_ATTEMPTS} kali, memblokir pengguna`);
            await sock.sendMessage(callerId, { text: `⚠️ *PERINGATAN*\nAnda telah mencoba menelepon bot sebanyak ${MAX_CALL_ATTEMPTS} kali. Nomor Anda akan diblokir oleh sistem.` });
            await blockUserBySystem(callerId, "Terlalu banyak percobaan panggilan", "system");
            delete callAttempts[callerId];
            return;
          }
          await sock.rejectCall(call.id, call.from);
          await sock.sendMessage(callerId, { text: `⚠️ *PERINGATAN*\nBot tidak dapat menerima panggilan. Mohon jangan menelepon bot.\n\nPercobaan: ${callAttempts[callerId]}/${MAX_CALL_ATTEMPTS}` });
          botLogger.info(`Panggilan dari ${callerId} ditolak (Percobaan: ${callAttempts[callerId]}/${MAX_CALL_ATTEMPTS})`);
        }
      };
      sock.ev.on('connection.update', handlers.connectionUpdate);
      sock.ev.on('creds.update', handlers.credsUpdate);
      sock.ev.on('messages.upsert', handlers.messagesUpsert);
      sock.ev.on('call', handlers.call);
      sock._eventHandlers = handlers;
    };

    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    activeSocket = makeWASocket({
      auth: state,
      printQRInTerminal: true,
      logger: baileysLogger,
      browser: ['Oblivinx Bot', 'Chrome', '1.0.0'],
      connectTimeoutMs: CONNECTION_TIMEOUT,
      keepAliveIntervalMs: 30000,
      retryRequestDelayMs: 5000
    });

    store.bind(activeSocket.ev);
    setupSocketHandlers(activeSocket, saveCreds);

    permissionHandler.setup(activeSocket);

    const clearCacheInterval = setInterval(() => {
      if (global.gc) global.gc();
      store.writeToFile("./baileys_store.json");
      botLogger.info("Cache cleared automatically");
    }, config.clearCacheInterval);

    const monitorMemoryInterval = setInterval(() => {
      const used = process.memoryUsage();
      botLogger.info(`Memory usage - RSS: ${formatBytes(used.rss)}, Heap: ${formatBytes(used.heapUsed)}`);
    }, config.monitorMemoryInterval);

    activeSocket._intervals = [clearCacheInterval, monitorMemoryInterval];

    global.db = {
      ...global.db,
      banUser: async (userId, reason, bannedBy, banType = BAN_TYPES.MANUAL) => {
        try {
          const cleanUserId = userId.split("@")[0];
          const [result] = await pool.execute(
            `INSERT INTO banned_users (user_id, reason, banned_by, ban_type) 
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE 
             reason = VALUES(reason),
             banned_by = VALUES(banned_by),
             ban_type = VALUES(ban_type),
             banned_at = CURRENT_TIMESTAMP`,
            [cleanUserId, reason, bannedBy, banType]
          );
          return result;
        } catch (error) {
          botLogger.error(`Error in banUser: ${error.message}`);
          throw error;
        }
      },
      unbanUser,
      blockUser: async (userId, reason, blockedBy) => {
        try {
          const cleanUserId = userId.split("@")[0];
          const [result] = await pool.execute(
            `INSERT INTO blocked_users (user_id, reason, blocked_by) 
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE 
             reason = VALUES(reason),
             blocked_by = VALUES(blocked_by),
             blocked_at = CURRENT_TIMESTAMP`,
            [cleanUserId, reason, blockedBy]
          );
          return result;
        } catch (error) {
          botLogger.error(`Error in blockUser: ${error.message}`);
          throw error;
        }
      },
      unblockUser: async (userId, unblockBy) => {
        try {
          const cleanUserId = userId.split("@")[0];
          const [result] = await pool.execute(
            `UPDATE blocked_users SET 
             is_blocked = 0, 
             unblocked_by = ?, 
             unblocked_at = CURRENT_TIMESTAMP
             WHERE user_id = ? AND is_blocked = 1`,
            [unblockBy, cleanUserId]
          );
          return result.affectedRows > 0;
        } catch (error) {
          botLogger.error(`Error in unblockUser: ${error.message}`);
          throw error;
        }
      },
      isBlocked: async (userId) => {
        try {
          const cleanUserId = userId.split("@")[0];
          const [rows] = await pool.execute(
            `SELECT * FROM blocked_users WHERE user_id = ? AND is_blocked = 1`,
            [cleanUserId]
          );
          return rows.length > 0;
        } catch (error) {
          botLogger.error(`Error in isBlocked: ${error.message}`);
          return false;
        }
      }
    };

    return activeSocket;
  } catch (error) {
    botLogger.error('Error in initBot:', error);
    process.exit(1);
  }
};

// Helper function untuk format bytes
function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

// Setup global error handlers
function setupGlobalErrorHandlers() {
  process.on("unhandledRejection", (reason, promise) => {
    if (reason.message.includes("Timed Out")) {
      botLogger.warn("Timeout detected, attempting to reconnect...");
      if (!global.isConnected && retryCount < MAX_RETRIES) {
        setTimeout(async () => {
          try {
            await initBot();
          } catch (error) {
            botLogger.error(`Failed to reconnect: ${error.message}`);
          }
        }, RETRY_INTERVAL);
      }
    } else {
      botLogger.error("Unhandled rejection at " + promise + " reason: " + reason);
    }
  });
}

async function initializeAllBots() {
  try {
    const [bots] = await pool.query('SELECT number, credentials FROM bot_instances WHERE status = "active"');
    for (const bot of bots) {
      try {
        await startChildBot(bot.number, JSON.parse(bot.credentials));
        console.log(`Bot ${bot.number} berhasil diinisialisasi`);
      } catch (error) {
        console.error(`Gagal inisialisasi bot ${bot.number}:`, error);
      }
    }
  } catch (error) {
    console.error('Error initializing bots:', error);
  }
}

// Panggil saat bot utama mulai
initializeAllBots();

(async () => {
  botLogger.info("Starting bot...");
  setupGlobalErrorHandlers();
  loadCommands(path.join(__dirname, "src/commands"));
  try {
    await initBot();
  } catch (error) {
    botLogger.error(`Failed to start bot: ${error.message}`);
    process.exit(1);
  }
})();

// Handler untuk uncaughtException dan unhandledRejection
process.on("uncaughtException", (err) => {
  if(botLogger) {
    botLogger.error("Uncaught Exception: " + err);
  } else {
    console.error("Fallback error logging:", err);
  }
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    cleanupAndExit(1);
});

async function cleanupAndExit(code = 0) {
    console.log('🛑 Cleaning up before exit...');
    try {
        await store.close();
        for (const [number, sock] of global.childBots) {
            await sock.end();
        }
    } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
    }
    process.exit(code);
}

// Fungsi untuk cek status ban
async function checkBanStatus(userId) {
  try {
    const status = await checkUserStatus(userId);
    botLogger.info(`Memeriksa status ban untuk user: ${userId}`);
    return {
      isBanned: status.isBanned,
      banInfo: status.isBanned ? { reason: "Diblokir oleh admin" } : null,
    };
  } catch (error) {
    botLogger.error("Error memeriksa status ban:", error);
    return { isBanned: false, banInfo: null };
  }
}

process.on('SIGINT', async () => {
  botLogger.info('Menerima signal SIGINT, membersihkan...');
  if (activeSocket?.ws) {
    activeSocket.ws.close();
    activeSocket.ev.removeAllListeners();
  }
  process.exit(0);
});

// Fungsi untuk memulai child bot
async function startChildBot(phoneNumber, credentials) {
    try {
        const validateCredentials = (creds) => {
            return creds?.me?.id && 
                   creds?.noiseKey?.length === 32 &&
                   creds?.signedIdentityKey?.length === 32;
        };

        if (!validateCredentials(credentials.creds)) {
            console.warn(`⚠️ Regenerasi credentials untuk ${phoneNumber}`);
            const { state } = await useMultiFileAuthState(path.join(__dirname, `sessions/${phoneNumber}`));
            try {
                await pool.execute(
                    'UPDATE bot_instances SET credentials = ? WHERE number = ?',
                    [JSON.stringify(state), phoneNumber]
                );
                console.log(`✅ Berhasil update credentials ${phoneNumber}`);
                credentials = state;
            } catch (dbError) {
                console.error('Gagal update database:', dbError);
                throw new Error('Gagal update credentials di database');
            }
        }

        const childSock = makeWASocket({
            auth: { ...credentials, mobile: true },
            browser: ["FORCE-CONNECT", "Chrome", "3.0"],
            version: [3, 3234, 9],
            logger: baileysLogger,
            connectTimeoutMs: 60000,
            shouldIgnoreJid: () => false,
            generateHighQualityLinkPreview: true,
            getMessage: async () => null,
            keepAliveIntervalMs: 7200000 
        });

        childSock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;
            if (qr && !childSock.user) {
                console.log('⚠️ QR Code diperlukan untuk', phoneNumber);
                handleQrCode(qr, phoneNumber).catch(console.error);
            }
            if (connection === 'close') {
                const statusCode = lastDisconnect.error?.output?.statusCode;
                if (statusCode === 401 || statusCode === 403 || statusCode === 404) {
                    fs.rmSync(path.join(__dirname, `sessions/${phoneNumber}`), { recursive: true, force: true });
                    console.log('⚠️ Session dihapus karena error auth');
                }
            }
        });

        return childSock;
    } catch (error) {
        console.error(`🚨 Gagal mutlak untuk ${phoneNumber}:`, error);
        await pool.execute("UPDATE bot_instances SET status = 'inactive' WHERE number = ?", [phoneNumber]);
        throw new Error(`Di nonaktifkan otomatis: ${error.message}`);
    }
}

process.on('SIGINT', async () => {
    console.log('\n🛑 Cleaning up child bots...');
    for (const [number, sock] of global.childBots) {
        await sock.end();
    }
    store.close();
    process.exit(0);
});

async function startChildBots() {
    try {
        const [rows] = await pool.execute('SELECT number FROM bot_instances WHERE status = "active"');
        for (const row of rows) {
            if(row.number !== config.mainNumber) {
                await initializeBot(row.number);
            }
        }
    } catch (error) {
        console.error('Error starting child bots:', error);
    }
}

startChildBots();

if (!global.childBots) {
    global.childBots = new Map();
}

async function initializeBot(phoneNumber) {
    let sock = null;
    try {
        const authFolder = path.join(__dirname, `sessions/${phoneNumber}`);
        if (fs.existsSync(authFolder)) {
            const sessionFiles = fs.readdirSync(authFolder);
            if (sessionFiles.length === 0) {
                fs.rmSync(authFolder, { recursive: true, force: true });
                console.log(`🗑 Session kosong dihapus untuk ${phoneNumber}`);
            }
        }
        const { state, saveCreds } = await useMultiFileAuthState(authFolder);
        sock = makeWASocket({
            auth: { creds: state.creds, keys: state.keys },
            logger: baileysLogger,
            msgRetryCounterCache,
            getMessage: async key => {
                return store.loadMessage(key.remoteJid, key.id) || {};
            },
            connectTimeoutMs: 30000,
            keepAliveIntervalMs: 15000
        });
        const setupEventHandlers = () => {
            sock.ev.on('connection.update', (update) => {
                const { connection, lastDisconnect } = update;
                if (connection === 'close') {
                    console.log(`🔌 Koneksi ${phoneNumber} terputus:`, lastDisconnect.error);
                } else if (connection === 'open') {
                    console.log(`✅ Koneksi ${phoneNumber} stabil`);
                }
            });
            sock.ev.on('creds.update', saveCreds);
        };
        setupEventHandlers();
        global.childBots.set(phoneNumber, sock);
        console.log(`🤖 Bot ${phoneNumber} berhasil diinisialisasi`);
        return sock;
    } catch (error) {
        console.error(`❌ Gagal inisialisasi bot ${phoneNumber}:`, error);
        if (sock !== null) {
            sock.ev.removeAllListeners();
            sock.ws.close();
        }
        fs.rmSync(path.join(__dirname, `sessions/${phoneNumber}`), { recursive: true, force: true });
        throw error;
    }
}

process.on('exit', () => {
    console.log('Membersihkan koneksi...');
    global.childBots.forEach((sock, number) => {
        sock.ev.removeAllListeners();
        sock.ws.close();
    });
    global.childBots.clear();
});

const commandHandler = (text) => {
  const pattern = /^[!\/\.](\w+)(?:\s+(.*))?$/i;
  const match = text.match(pattern);
  if (match) {
    const command = match[1].toLowerCase();
    const args = match[2] ? match[2].trim().split(/\s+/) : [];
    return { command, args };
  }
  return null;
};