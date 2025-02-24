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
  baileysLogger
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
  const now = new Date().toLocaleString();
  console.log(`[${now}] [${type}] ${message}`);
};

// ====== COMMAND HANDLER ======
function registerCommand(config, handler) {
  if (!config.pattern || typeof handler !== "function") {
    throw new Error("Command harus memiliki pattern dan handler.");
  }
  commands.push({ config, handler });
}

function executeCommand(sock, msg, sender, messageText) {
  for (const { config, handler } of commands) {
    const patterns = [config.pattern, ...(config.secondPattern || [])];
    for (const pattern of patterns) {
      const match = messageText.match(new RegExp(pattern));
      if (match) {
        log("INFO", `Command executed: ${pattern}`);
        return handler(msg, {
          match,
          args: match[1] ? match[1].trim().split(/\s+/) : [],
        });
      }
    }
  }
  log("WARNING", `No matching command for: ${messageText}`);
}

// ====== LOAD COMMANDS ======
function loadCommands(commandsPath) {
  const files = fs.readdirSync(commandsPath);

  files.forEach((file) => {
    const fullPath = path.join(commandsPath, file);

    if (fs.lstatSync(fullPath).isFile() && file.endsWith(".js")) {
      require(fullPath);
    }
  });

  log("SUCCESS", "Command berhasil di load");
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

    registerCommand(
      {
        pattern: patterns[0],
        secondPattern: patterns.slice(1),
        fromMe: false,
        desc,
        use: category,
      },
      wrappedExec
    );

    this.commands.set(name, {
      ...options,
      exec: wrappedExec,
    });
  },
  isOwner: function (sender) {
    const senderNumber = sender.split("@")[0];
    const ownerNumbers = process.env.OWNER_NUMBER_ONE.split(",").concat(
      process.env.OWNER_NUMBER_TWO ? process.env.OWNER_NUMBER_TWO.split(",") : []
    );
    const normalizedSender = senderNumber.startsWith("62")
      ? "0" + senderNumber.slice(2)
      : senderNumber;
    botLogger.info(`Checking owner: ${normalizedSender}`);
    return ownerNumbers.includes(normalizedSender);
  },
};

// ====== CONNECTION HANDLER ======
let activeSocket = null;
let qrTimer = null;
let isReconnecting = false;
global.otpHandlers = {};

let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_INTERVAL = 5000;

const initBot = async () => {
  try {
    // Tambahkan state untuk tracking reconnect
    let isReconnecting = false;
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 5;
    const RECONNECT_INTERVAL = 5000;

    // Fungsi untuk reset state reconnect
    const resetReconnectState = () => {
      isReconnecting = false;
      reconnectAttempts = 0;
    };

    // Fungsi untuk handle reconnect
    const handleReconnect = async () => {
      if (isReconnecting) return;
      
      isReconnecting = true;
      reconnectAttempts++;

      botLogger.info(`Mencoba reconnect... (Percobaan ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);

      if (reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
        botLogger.error('Melebihi batas maksimum reconnect, menghentikan bot...');
        process.exit(1);
      }

      // Tunggu sebelum mencoba reconnect
      await new Promise(resolve => setTimeout(resolve, RECONNECT_INTERVAL));

      try {
        // Cleanup socket lama
        if (activeSocket?.ws) {
          activeSocket.ws.close();
          activeSocket.ev.removeAllListeners();
        }

        // Inisialisasi ulang socket
        const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
        activeSocket = makeWASocket({
          auth: state,
          printQRInTerminal: true,
          logger: baileysLogger,
          browser: ['Oblivinx Bot', 'Chrome', '1.0.0'],
          connectTimeoutMs: 60000,
          keepAliveIntervalMs: 30000,
          retryRequestDelayMs: 5000
        });

        // Bind store ke socket baru
        store.bind(activeSocket.ev);

        // Setup event handlers
        setupSocketHandlers(activeSocket, saveCreds);

        isReconnecting = false;
      } catch (error) {
        botLogger.error('Gagal melakukan reconnect:', error);
        isReconnecting = false;
      }
    };

    // Setup event handlers
    const setupSocketHandlers = (sock, saveCreds) => {
      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'close') {
          const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
          botLogger.info('Koneksi terputus karena:', lastDisconnect?.error?.message);

          if (shouldReconnect && !isReconnecting) {
            handleReconnect();
          }
        } else if (connection === 'open') {
          botLogger.info('Koneksi terbuka!');
          resetReconnectState();
        }
      });

      sock.ev.on('creds.update', saveCreds);

      // Handle pesan masuk
      sock.ev.on("messages.upsert", async (m) => {
        try {
          if (isReconnecting) {
            botLogger.info('Skip processing message during reconnection');
            return;
          }

          const msg = m.messages[0];
          if (!msg.message) return;

          const sender = msg.key.remoteJid;
          if (!sender || msg.key.fromMe) return;

          const isGroup = sender.endsWith("@g.us");
          const participant = msg.key.participant || msg.participant || sender;
          let senderNumber = (isGroup ? participant : sender).split("@")[0];

          if (senderNumber.startsWith("62") && /^62[8-9][0-9]{8,11}$/.test(senderNumber)) {
            try {
              await registerUser(senderNumber, msg.pushName);
            } catch (error) {
              console.error("Error registering user:", error);
            }
          }

          const lastMessageTime = messageQueue.get(sender) || 0;
          const now = Date.now();
          if (now - lastMessageTime < RATE_LIMIT) return;
          messageQueue.set(sender, now);

          const enhancedMsg = {
            ...msg,
            chat: sender,
            from: sender,
            sender: participant,
            isGroup: isGroup,
            botNumber: activeSocket.user.id,
            pushName: msg.pushName,
            mentions: msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [],
            reply: async (content) => {
              let messageContent = typeof content === "object" ? content : { text: String(content) };
              return await activeSocket.sendMessage(sender, messageContent, { quoted: msg });
            },
          };

          const messageText = msg.message?.conversation || 
            msg.message?.extendedTextMessage?.text || 
            msg.message?.imageMessage?.caption || "";

          if (messageText.startsWith(PREFIX)) {
            const cleanText = messageText.slice(PREFIX.length);
            executeCommand(activeSocket, enhancedMsg, sender, cleanText);
          }

          const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
          if (quoted && quoted.conversation.includes('Balas pesan ini dengan kode OTP')) {
            const targetNumber = quoted.conversation.match(/\d+/)[0];
            if (global.otpHandlers[targetNumber]) {
              const otp = msg.message.extendedTextMessage.text;
              await global.otpHandlers[targetNumber](otp);
              delete global.otpHandlers[targetNumber];
            }
          }
        } catch (error) {
          botLogger.error("Error processing message:", error);
        }
      });
    };

    // Inisialisasi awal
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    activeSocket = makeWASocket({
      auth: state,
      printQRInTerminal: true,
      logger: baileysLogger,
      browser: ['Oblivinx Bot', 'Chrome', '1.0.0'],
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 30000,
      retryRequestDelayMs: 5000
    });

    store.bind(activeSocket.ev);
    setupSocketHandlers(activeSocket, saveCreds);

    permissionHandler.setup(activeSocket);

    setInterval(() => {
      if (global.gc) global.gc();
      store.writeToFile("./baileys_store.json");
      botLogger.info("Cache cleared automatically");
    }, config.clearCacheInterval);

    setInterval(() => {
      const used = process.memoryUsage();
      botLogger.info(`Memory usage - RSS: ${formatBytes(used.rss)}, Heap: ${formatBytes(used.heapUsed)}`);
    }, config.monitorMemoryInterval);

    activeSocket.ev.on("history.notification", (notification) => {
      botLogger.info(`History notification received: syncType=${notification.syncType}`);
    });

    activeSocket.ev.on("error", (err) => {
      botLogger.error("WebSocket Error:", err);
      global.isConnected = false;
    });

    activeSocket.ev.on("close", () => {
      botLogger.info("Connection closed");
      global.isConnected = false;
    });

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
          console.error(`Error in banUser: ${error.message}`);
          throw error;
        }
      },
      unbanUser,
      blockUser: async (userId, reason, blockedBy) => {
        // ... (tetap sama)
      },
      unblockUser: async (userId, unblockBy) => {
        // ... (tetap sama)
      },
      isBlocked: async (userId) => {
        // ... (tetap sama)
      }
    };

    activeSocket.ev.on("call", async ([call]) => {
      // ... (tetap sama)
    });

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

// Tambahkan fungsi untuk handle timeout secara global
function setupGlobalErrorHandlers() {
  process.on("unhandledRejection", (reason, promise) => {
    if (reason.message.includes("Timed Out")) {
      botLogger.warning("Timeout detected, attempting to reconnect...");
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
      botLogger.error(
        "Unhandled rejection at " + promise + " reason: " + reason
      );
    }
  });
}

// Fungsi untuk memulai semua bot yang tersimpan
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
initBot();
initializeAllBots();

// ====== MAIN FUNCTION ======
(async () => {
  botLogger.info("Starting bot...");
  setupGlobalErrorHandlers();

  // Load commands from src/commands directory
  loadCommands(path.join(__dirname, "src/commands"));

  try {
    await initBot();
  } catch (error) {
    botLogger.error(`Failed to start bot: ${error.message}`);
    process.exit(1);
  }
})();

// Contoh penggunaan di tempat lain
process.on("uncaughtException", (err) => {
  if(botLogger) {
    botLogger.error("Uncaught Exception: " + err);
  } else {
    console.error("Fallback error logging:", err); // Fallback jika logger gagal
  }
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Log ke file atau layanan monitoring
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // Restart process setelah cleanup
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
    return {
      isBanned: false,
      banInfo: null,
    };
  }
}

// Contoh penggunaan fungsi banUser
async function handleBanCommand(userId, reason, bannedBy) {
  try {
    const result = await banUser(userId, reason, bannedBy);
    if (result.success) {
      console.log(result.message);
    } else {
      console.error(result.message);
    }
  } catch (error) {
    console.error("Error handling ban command:", error);
  }
}

// Tambahkan cleanup handler untuk SIGINT
process.on('SIGINT', async () => {
  botLogger.info('Menerima signal SIGINT, membersihkan...');
  if (activeSocket?.ws) {
    activeSocket.ws.close();
    activeSocket.ev.removeAllListeners();
  }
  process.exit(0);
});

// Tambahkan handler untuk uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  initBot(); // Restart bot
});

// Fungsi untuk memulai child bot
async function startChildBot(phoneNumber, credentials) {
    try {
        // Validasi credentials dan regenerasi jika perlu
        const validateCredentials = (creds) => {
            return creds?.me?.id && 
                   creds?.noiseKey?.length === 32 &&
                   creds?.signedIdentityKey?.length === 32;
        };

        // Jika credentials tidak valid, generate ulang
        if (!validateCredentials(credentials.creds)) {
            console.warn(`⚠️ Regenerasi credentials untuk ${phoneNumber}`);
            
            // Generate credentials baru
            const { state } = await useMultiFileAuthState(
                path.join(__dirname, `sessions/${phoneNumber}`)
            );
            
            // Update database dengan credentials baru
            try {
                await pool.execute(
                    'UPDATE bot_instances SET credentials = ? WHERE number = ?',
                    [JSON.stringify(state), phoneNumber]
                );
                console.log(`✅ Berhasil update credentials ${phoneNumber}`);
                credentials = state; // Gunakan credentials baru
            } catch (dbError) {
                console.error('Gagal update database:', dbError);
                throw new Error('Gagal update credentials di database');
            }
        }

        // Paksa koneksi dengan credentials terbaru
        const childSock = makeWASocket({
            auth: {
                ...credentials,
                mobile: true
            },
            browser: ["FORCE-CONNECT", "Chrome", "3.0"],
            version: [3, 3234, 9],
            logger: baileysLogger,
            connectTimeoutMs: 60000,
            // Tambahkan handler untuk memaksa QR jika diperlukan
            shouldIgnoreJid: () => false,
            generateHighQualityLinkPreview: true,
            getMessage: async () => null,
            // Tambahkan reconnect interval 2 jam (7200 detik)
            keepAliveIntervalMs: 7200000 
        });

        // Paksa update connection state
        childSock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                console.log('⚠️ BUTUH QR untuk', phoneNumber);
                // Panggil fungsi yang sudah didefinisikan
                handleQrCode(qr, phoneNumber).catch(console.error);
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect.error?.output?.statusCode;
                if (statusCode === 401 || statusCode === 403 || statusCode === 404) {
                    // Hapus session jika error auth
                    fs.rmSync(authFolder, { recursive: true, force: true });
                    console.log('⚠️ Session dihapus karena error auth');
                }
            }
        });

        return childSock;
    } catch (error) {
        console.error(`🚨 Gagal mutlak untuk ${phoneNumber}:`, error);
        // Jika tetap gagal, nonaktifkan di database
        await pool.execute(
            "UPDATE bot_instances SET status = 'inactive' WHERE number = ?",
            [phoneNumber]
        );
        throw new Error(`Di nonaktifkan otomatis: ${error.message}`);
    }
}

// Tambahkan cleanup handler
process.on('SIGINT', async () => {
    console.log('\n🛑 Cleaning up child bots...');
    for (const [number, sock] of global.childBots) {
        await sock.end();
    }
    store.close();
    process.exit(0);
});

// Auto-start child bots
async function startChildBots() {
    try {
        const [rows] = await pool.execute(
            'SELECT number FROM bot_instances WHERE status = "active"'
        );
        
        for (const row of rows) {
            if(row.number !== config.mainNumber) {
                await initializeBot(row.number);
            }
        }
    } catch (error) {
        console.error('Error starting child bots:', error);
    }
}

// Panggil fungsi setelah bot utama ready
startChildBots();

if (!global.childBots) {
    global.childBots = new Map();
}

async function initializeBot(phoneNumber) {
    let sock = null; // Deklarasi eksplisit dengan nilai null
    
    try {
        const authFolder = path.join(__dirname, `sessions/${phoneNumber}`);
        
        // 1. Cleanup session korup
        if (fs.existsSync(authFolder)) {
            const sessionFiles = fs.readdirSync(authFolder);
            if (sessionFiles.length === 0) {
                fs.rmSync(authFolder, { recursive: true, force: true });
                console.log(`🗑 Session kosong dihapus untuk ${phoneNumber}`);
            }
        }

        // 2. Inisialisasi socket
        const { state, saveCreds } = await useMultiFileAuthState(authFolder);
        sock = makeWASocket({
            auth: {
                creds: state.creds,
                keys: state.keys
            },
            logger: baileysLogger,
            msgRetryCounterCache,
            getMessage: async key => {
                return store.loadMessage(key.remoteJid, key.id) || {};
            },
            connectTimeoutMs: 30000,
            keepAliveIntervalMs: 15000
        });

        // 3. Pasang event handlers
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

        // 4. Simpan ke global map
        global.childBots.set(phoneNumber, sock);
        console.log(`🤖 Bot ${phoneNumber} berhasil diinisialisasi`);

        return sock;

    } catch (error) {
        console.error(`❌ Gagal inisialisasi bot ${phoneNumber}:`, error);
        
        // 5. Cleanup jika sock sempat terinisialisasi
        if (sock !== null) {
            sock.ev.removeAllListeners();
            sock.ws.close();
        }
        
        // 6. Hapus session yang gagal
        fs.rmSync(authFolder, { recursive: true, force: true });
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
  const pattern = /^[!\/\.](\w+)(?:\s+(.*))?$/i;  // Format: !command args
  const match = text.match(pattern);
  return match ? { command: match[1], args: match[2] } : null;
};