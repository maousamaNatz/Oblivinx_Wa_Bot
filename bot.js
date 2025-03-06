const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  makeInMemoryStore,
} = require("@whiskeysockets/baileys");
const fs = require("fs");
const { getGroupAdminInfo, normalizeJid } = require("./src/handler/permission");
const path = require("path");
require("dotenv").config();
const permissionHandler = require("./src/handler/permission");
const {
  botLogger,
  baileysLogger,
  getDebugStatus,
} = require("./src/utils/logger");
const {
  config,
  store,
  msgRetryCounterCache,
  commands,
  PREFIX,
  MAX_RETRIES,
  RETRY_INTERVAL,
  retryCount,
  callAttempts,
  MAX_CALL_ATTEMPTS,
  BAN_TYPES,
  RECONNECT_INTERVAL,
  MAX_RECONNECT_RETRIES,
  CONNECTION_TIMEOUT,
  groupCache,
} = require("./config/config");
const db = require("./database/confLowDb/lowdb");
const { handleGroupMessage } = require("./src/handler/groupHandler");
const crypto = require("crypto");
const {log} = require('./src/utils/logger');
process.env.PREFIX = process.env.PREFIX?.trim() || "!";

const id = fs.readFileSync("./src/i18n/langId.json", "utf8");
const en = fs.readFileSync("./src/i18n/langEn.json", "utf8");
// Define the path to the ASCII file
const asciiFilePath = path.join(__dirname, 'database', 'ascii.txt');

// Function to read the ASCII file
function readAsciiFile() {
    fs.readFile(asciiFilePath, 'utf8', (err, data) => {
        if (err) {
            log('Error reading the file:', 'error');
            return;
        }
        log(data , 'infoowner');
    });

    log( 'Hello everyone Im Natz', 'infoowner');
    log( 'welcome to Oblivinx bot! Please enjoy the services available. ', 'infoowner');
    log( 'If you encounter any bugs, please do not hesitate to reach out to the contacts listed. ', 'infoowner');
    log( 'You can also contribute to the development of this bot by forking our repository on GitHub and submitting a pull request.', 'infoowner');
    log( 'Thank you for using Oblivinx bot, hope it helps! 🚀', 'infoowner');
    log( 'Contact Developer:', 'infoowner');
    log( 'Natz: 081910058235', 'infoowner');
    log( 'Instagram: patch.cpp', 'infoowner');
    log( 'Hello everyone Im Natz', 'infoowner');
}

// Fungsi pembantu untuk membungkus operasi dengan timeout
const promiseWithTimeout = (promise, ms) => {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Timed Out")), ms)
  );
  return Promise.race([promise, timeout]);
};

function registerCommand(cmdConfig, handler) {
  if (!cmdConfig.pattern || typeof handler !== "function") {
    throw new Error("Command harus memiliki pattern dan handler.");
  }
  commands.push({ config: cmdConfig, handler });
}

async function executeCommand(sock, msg, sender, command, args) {
  try {
    if (!global.Oblixn?.commands?.has(command)) {
      botLogger.warn(`Command ${command} tidak ditemukan.`);
      await msg.reply(`Perintah ${command} tidak dikenali!`);
      return;
    }

    const cmd = global.Oblixn.commands.get(command);
    if (!cmd || !cmd.config) {
      botLogger.error(
        `Command ${command} tidak memiliki config yang valid.`,
        cmd
      );
      await msg.reply("Terjadi kesalahan internal saat memproses perintah.");
      return;
    }

    const isOwnerCommand =
      cmd.config.category === "owner" || cmd.config.category === "ownercommand";

    if (global.botActive === false && !global.Oblixn.isOwner(msg.sender)) {
      await msg.reply(
        "Bot sedang offline. Hanya owner yang dapat mengakses perintah saat ini."
      );
      return;
    }

    if (isOwnerCommand && !global.Oblixn.isOwner(msg.sender)) {
      await msg.reply("Perintah ini hanya untuk owner bot!");
      return;
    }

    return await cmd.exec(msg, {
      args,
      sock: msg.sock || sock,
      groupInfo: msg.groupInfo,
    });
  } catch (error) {
    botLogger.error(
      `Error menjalankan command ${command}: ${error.message}`,
      error.stack
    );
    await msg.reply(`Terjadi kesalahan: ${error.message}`);
  }
}

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
          delete require.cache[require.resolve(fullPath)];
          require(fullPath);
          loadedCount++;
        } catch (error) {
          botLogger.error(
            `Error loading command file ${file}: ${error.message}`,
            { file, fullPath, stack: error.stack }
          );
        }
      }
    });
    botLogger.info(`${loadedCount} command files loaded successfully`);
    
  } catch (error) {
    botLogger.error(`Error loading commands: ${error.message}`, {
      stack: error.stack,
    });
  }
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

global.Oblixn = {
  commands: new Map(),
  cmd: function (options) {
    const { name, alias = [], desc = "", category = "utility", exec } = options;
    if (!name || typeof exec !== "function") {
      throw new Error(
        `Command harus memiliki "name" dan "exec" sebagai function: ${JSON.stringify(
          options
        )}`
      );
    }

    const wrappedExec = async (msg, params) => {
      try {
        if (category !== "owner" && category !== "ownercommand") {
          const userId = msg.sender.split("@")[0];
          let normalizedUserId = userId.startsWith("08")
            ? "62" + userId.slice(1)
            : userId.replace("+62", "62");
          const status = await db.checkUserStatus(normalizedUserId);
          if (status.isBanned) {
            const banDate = status.banReason
              ? new Date().toLocaleDateString("id-ID")
              : new Date().toLocaleDateString("id-ID");
            const banMessage = `❌ *Akses Ditolak*\n\nMaaf, Anda telah dibanned dari menggunakan bot!\n\n*Detail Ban:*\n📝 Alasan: ${
              status.banReason || "Tidak diketahui"
            }\n📅 Tanggal: ${banDate}\n\nSilakan hubungi owner untuk unbanned.`;
            await msg.reply(banMessage);
            return;
          }
        }
        return await exec(msg, params);
      } catch (error) {
        botLogger.error(`Error executing command ${name}: ${error.message}`, {
          stack: error.stack,
          params,
          msg,
        });
        await msg.reply("Terjadi kesalahan saat menjalankan perintah.");
      }
    };

    const cmdConfig = {
      name,
      pattern: `^${escapeRegex(name)}(?:\\s+(.*))?$`,
      secondPattern: alias.map((cmd) => `^${escapeRegex(cmd)}(?:\\s+(.*))?$`),
      fromMe: false,
      desc,
      category,
      use: category,
    };

    const commandData = { config: cmdConfig, exec: wrappedExec };
    this.commands.set(name, commandData);
    alias.forEach((alt) => {
      this.commands.set(alt, commandData);
    });
  },
  isOwner: function (sender) {
    if (!sender) {
      botLogger.error("Sender tidak didefinisikan dalam pengecekan owner.");
      return false;
    }
    const senderNumber = sender.split("@")[0];
    const ownerNumbers = [
      ...process.env.OWNER_NUMBER_ONE.split(",").map((num) => num.trim()),
      ...(process.env.OWNER_NUMBER_TWO?.split(",").map((num) => num.trim()) ||
        []),
    ].map((num) => {
      return num.startsWith("+62")
        ? num.replace("+62", "62")
        : num.startsWith("08")
        ? "62" + num.slice(1)
        : num;
    });

    const normalizedSender = senderNumber.startsWith("08")
      ? "62" + senderNumber.slice(1)
      : senderNumber.startsWith("+62")
      ? senderNumber.replace("+62", "62")
      : senderNumber;

    botLogger.info(
      `Checking owner: ${normalizedSender} against ${ownerNumbers}`
    );
    const isOwner = ownerNumbers.includes(normalizedSender);
    if (!isOwner) {
      botLogger.warn(
        `Sender ${normalizedSender} bukan owner. Owner list: ${ownerNumbers}`
      );
    }
    return isOwner;
  },
};

let activeSocket = null;
let qrTimer = null;
let isReconnecting = false;
global.otpHandlers = {};
let reconnectAttempts = 0;
let socketInstance = null;

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
      botLogger.info(
        `Mencoba reconnect... (Percobaan ${reconnectAttempts}/${MAX_RECONNECT_RETRIES})`
      );
      if (reconnectAttempts > MAX_RECONNECT_RETRIES) {
        botLogger.error(
          "Melebihi batas maksimum reconnect, menghentikan bot..."
        );
        process.exit(1);
      }
      await new Promise((resolve) => setTimeout(resolve, RECONNECT_INTERVAL));
      try {
        if (activeSocket?.ws) {
          activeSocket.ws.close();
          activeSocket.ev.removeAllListeners();
        }
        await initBot();
      } catch (error) {
        botLogger.error("Gagal melakukan reconnect:", error);
        isReconnecting = false;
      }
    };

    const setupSocketHandlers = (sock, saveCreds) => {
      const handlers = {
        connectionUpdate: async (update) => {
          const { connection, lastDisconnect, qr } = update;
          if (qr && !sock.user) {
            botLogger.info("QR Code baru tersedia, scan untuk login");
            await db.handleQrCode(qr, sock.user?.id.split(":")[0] || "unknown");
          }
          if (connection === "close") {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const errorMessage =
              lastDisconnect?.error?.message || "Unknown error";
            botLogger.error(
              `Connection closed: ${statusCode} - ${errorMessage}`,
              { statusCode, errorMessage }
            );
            if (statusCode === 515 && sock.user) {
              botLogger.warn(
                "Stream error 515 with active session, skipping reconnect"
              );
              return;
            }
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect && !isReconnecting) {
              handleReconnect();
            } else if (statusCode === DisconnectReason.loggedOut) {
              botLogger.warn("Logged out, please scan new QR code");
              setTimeout(handleReconnect, RECONNECT_INTERVAL);
            }
          } else if (connection === "open") {
            botLogger.info(`Connected as ${sock.user?.id || "unknown"}`);
            resetReconnectState();
          }
        },
        credsUpdate: saveCreds,
        messagesUpsert: async (m) => {
          try {
            if (isReconnecting) return;
            if (!m.messages || !m.messages[0]) return;
            const msg = m.messages[0];
            const effectiveSock = sock || activeSocket;

            if (!effectiveSock) {
              botLogger.error("No valid socket available in messagesUpsert");
              return;
            }

            if (msg.key.fromMe) {
              botLogger.info("Mengabaikan pesan dari bot sendiri.");
              return;
            }

            if (global.botActive === false) {
              if (!global.Oblixn.isOwner(msg.key.participant || msg.key.remoteJid)) {
                botLogger.info(
                  "Bot dalam status nonaktif, pesan diabaikan (bukan owner)."
                );
                return;
              }
              botLogger.info("Pesan dari owner diterima meskipun bot off.");
            }

            const sender = msg.key.remoteJid;
            const isGroup = sender.endsWith("@g.us");
            const participant =
              msg.key.participant || msg.participant || sender;
            const messageText =
              msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text ||
              msg.message?.imageMessage?.caption ||
              msg.message?.buttonsResponseMessage?.selectedButtonId ||
              msg.message?.listResponseMessage?.singleSelectReply
                ?.selectedRowId ||
              msg.message?.extendedTextMessage?.contextInfo?.protocolMessage
                ?.conversation ||
              "";
            let groupInfo = null;
            let groupMetadata = null;

            // Normalisasi userId dan groupId
            const userId = normalizeJid(participant);
            const groupId = isGroup ? normalizeJid(sender) : null;

            // Otomatis membuat atau memperbarui user
            let userData = await db.getUser(userId);
            if (!userData) {
              const newUser = await db.addUser({
                user_id: userId,
                username: msg.pushName,
              });
              userData = newUser.data;
              botLogger.info(`User baru dibuat: ${userId}`);
            }

            // Otomatis menghitung pesan dan leveling
            userData.total_messages += 1;
            const messagesForLevelUp = 120;
            const newLevel = Math.floor(userData.total_messages / messagesForLevelUp) + 1;
            if (newLevel > userData.level) {
              userData.level = newLevel;
              userData.updated_at = new Date().toISOString();
              botLogger.info(`User ${userId} naik ke level ${newLevel}`);
              await effectiveSock.sendMessage(sender, {
                text: `🎉 Selamat! Anda naik ke level ${newLevel} setelah mengirim ${userData.total_messages} pesan!`,
              });
            }
            await db.updateUser(userId, {
              total_messages: userData.total_messages,
              level: userData.level,
              updated_at: userData.updated_at,
            });

            // Otomatis membuat atau memperbarui group (jika pesan dari grup)
            if (isGroup) {
              let groupData = await db.getGroup(groupId);
              if (!groupData) {
                try {
                  groupMetadata = await promiseWithTimeout(
                    effectiveSock.groupMetadata(groupId),
                    5000 // Timeout 5 detik
                  );
                  const newGroup = await db.addGroup({
                    group_id: groupId,
                    group_name: groupMetadata.subject || "Unnamed Group",
                    owner_id: userId,
                  });
                  groupData = newGroup.data;
                  botLogger.info(`Grup baru dibuat: ${groupId}`);
                } catch (error) {
                  botLogger.warn(
                    `Gagal mengambil metadata grup ${groupId}: ${error.message}, menggunakan default`
                  );
                  const newGroup = await db.addGroup({
                    group_id: groupId,
                    group_name: "Unnamed Group",
                    owner_id: userId,
                  });
                  groupData = newGroup.data;
                  botLogger.info(`Grup baru dibuat dengan default: ${groupId}`);
                }
              }

              if (groupCache.has(sender)) {
                groupInfo = groupCache.get(sender);
                if (
                  !groupInfo ||
                  !groupInfo.participants ||
                  !Array.isArray(groupInfo.participants)
                ) {
                  botLogger.warn(
                    `Cache grup ${sender} tidak valid, mengambil ulang...`
                  );
                  groupCache.delete(sender);
                  groupInfo = null;
                } else {
                  botLogger.info(
                    `Menggunakan groupInfo dari cache untuk ${sender}`
                  );
                }
              }
              if (!groupInfo) {
                try {
                  groupInfo = await promiseWithTimeout(
                    getGroupAdminInfo(effectiveSock, sender),
                    5000
                  );
                  groupCache.set(sender, groupInfo);
                } catch (error) {
                  botLogger.error(
                    `Error saat mengambil groupInfo: ${error.message}`
                  );
                  groupInfo = null;
                }
              }
              botLogger.info(
                `Group Info - isBotAdmin: ${groupInfo?.isBotAdmin || false}`
              );

              // Gunakan groupMetadata dari cache atau ambil sekali saja
              if (!groupMetadata && groupInfo) {
                groupMetadata = groupInfo;
              } else if (!groupMetadata) {
                try {
                  groupMetadata = await promiseWithTimeout(
                    effectiveSock.groupMetadata(groupId),
                    5000
                  );
                } catch (error) {
                  botLogger.warn(
                    `Gagal mengambil groupMetadata: ${error.message}`
                  );
                  groupMetadata = null;
                }
              }
            }

            const enhancedMsg = {
              ...msg,
              sock: effectiveSock,
              chat: sender,
              from: sender,
              sender: participant,
              isGroup,
              groupInfo,
              isAdmin: isGroup
                ? groupInfo?.adminList?.some(
                    (admin) =>
                      normalizeJid(admin.id) === normalizeJid(participant)
                  ) || false
                : false,
              isBotAdmin: isGroup ? groupInfo?.isBotAdmin || false : false,
              botNumber: effectiveSock.user?.id || "unknown",
              pushName: msg.pushName,
              messageText,
              groupMetadata: isGroup ? groupMetadata || groupCache.get(sender) : null,
              mentions:
                msg.message?.extendedTextMessage?.contextInfo?.mentionedJid ||
                [],
              reply: async (content) => {
                try {
                  const messageContent =
                    typeof content === "object"
                      ? content
                      : { text: String(content) };
                  return await effectiveSock.sendMessage(
                    sender,
                    messageContent,
                    { quoted: msg }
                  );
                } catch (error) {
                  botLogger.error(`Error mengirim balasan: ${error.message}`, {
                    content,
                    sender,
                    msg,
                  });
                  return null;
                }
              },
            };

            botLogger.info(
              "Enhanced Msg - sock available:",
              !!enhancedMsg.sock
            );

            if (isGroup) {
              if (messageText.startsWith(PREFIX)) {
                const parsedCommand = commandHandler(messageText);
                if (parsedCommand) {
                  const { command, args } = parsedCommand;
                  botLogger.info(`Memproses command di grup: ${command}`);
                  try {
                    await executeCommand(
                      effectiveSock,
                      enhancedMsg,
                      sender,
                      command,
                      args
                    );
                  } catch (error) {
                    botLogger.error(
                      `Error executing command ${command}: ${error.message}`
                    );
                    await enhancedMsg.reply(
                      "Terjadi kesalahan saat memproses perintah."
                    );
                  }
                  return;
                }
              } else if (msg.key.participant && msg.messageStubType) {
                botLogger.info(
                  `Memproses event grup: ${messageText || "event"}`
                );
                await handleGroupMessage(effectiveSock, enhancedMsg);
                return;
              } else {
                botLogger.info(`Mengabaikan pesan grup biasa: ${messageText}`);
                return;
              }
            }

            if (messageText.startsWith(PREFIX)) {
              const parsedCommand = commandHandler(messageText);
              if (parsedCommand) {
                const { command, args } = parsedCommand;
                botLogger.info(`Memproses command di chat pribadi: ${command}`);
                await executeCommand(
                  effectiveSock,
                  enhancedMsg,
                  sender,
                  command,
                  args
                );
              } else {
                botLogger.info(`Pesan pribadi bukan command: ${messageText}`);
              }
            } else {
              botLogger.info(
                `Mengabaikan pesan pribadi tanpa PREFIX: ${messageText}`
              );
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
            botLogger.warn(
              `Pengguna ${callerId} telah mencoba menelepon ${MAX_CALL_ATTEMPTS} kali, memblokir pengguna`
            );
            await sock.sendMessage(callerId, {
              text: `⚠️ *PERINGATAN*\nAnda telah mencoba menelepon bot sebanyak ${MAX_CALL_ATTEMPTS} kali. Nomor Anda akan diblokir oleh sistem.`,
            });
            await db.blockUserBySystem(callerId);
            delete callAttempts[callerId];
            return;
          }
          await sock.rejectCall(call.id, call.from);
          await sock.sendMessage(callerId, {
            text: `⚠️ *PERINGATAN*\nBot tidak dapat menerima panggilan. Mohon jangan menelepon bot.\n\nPercobaan: ${callAttempts[callerId]}/${MAX_CALL_ATTEMPTS}`,
          });
          botLogger.info(
            `Panggilan dari ${callerId} ditolak (Percobaan: ${callAttempts[callerId]}/${MAX_CALL_ATTEMPTS})`
          );
        },
        "groups.update": async (updates) => {
          if (isReconnecting) {
            botLogger.info("Skipping groups.update during reconnection");
            return;
          }
          if (!sock || typeof sock.groupMetadata !== "function") {
            botLogger.warn("Socket not available for groups.update");
            return;
          }
          for (const update of updates) {
            try {
              const metadata = await promiseWithTimeout(
                sock.groupMetadata(update.id),
                5000
              );
              groupCache.set(update.id, metadata);
            } catch (error) {
              botLogger.error(`Error updating group ${update.id}:`, error);
            }
          }
        },
        "group-participants.update": async (event) => {
          if (isReconnecting) {
            botLogger.info(
              "Skipping group-participants.update during reconnection"
            );
            return;
          }
          if (!sock || typeof sock.groupMetadata !== "function") {
            botLogger.warn(
              "Socket not available for group-participants.update"
            );
            return;
          }
          try {
            const metadata = await promiseWithTimeout(
              sock.groupMetadata(event.id),
              5000
            );
            groupCache.set(event.id, metadata);
          } catch (error) {
            botLogger.error(
              `Error updating participants in ${event.id}:`,
              error
            );
          }
        },
      };

      sock.ev.on("connection.update", handlers.connectionUpdate);
      sock.ev.on("creds.update", handlers.credsUpdate);
      sock.ev.on("messages.upsert", handlers.messagesUpsert);
      sock.ev.on("call", handlers.call);
      sock.ev.on("groups.update", handlers["groups.update"]);
      sock.ev.on("group-participants.update", handlers["group-participants.update"]);
      sock._eventHandlers = handlers;
    };

    const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");
    activeSocket = makeWASocket({
      auth: state,
      printQRInTerminal: true,
      logger: baileysLogger,
      browser: ["Oblivinx Bot", "Chrome", "1.0.0"],
      connectTimeoutMs: CONNECTION_TIMEOUT,
      keepAliveIntervalMs: 30000,
      retryRequestDelayMs: 5000,
    });

    socketInstance = activeSocket;

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
      botLogger.info(
        `Memory usage - RSS: ${formatBytes(used.rss)}, Heap: ${formatBytes(used.heapUsed)}`
      );
    }, config.monitorMemoryInterval);

    activeSocket._intervals = [clearCacheInterval, monitorMemoryInterval];

    // Integrasi fungsi database AJV ke global.db
    global.db = {
      ...global.db,
      banUser: db.banUser,
      unbanUser: db.unbanUser,
      checkUserStatus: db.checkUserStatus,
      blockUserBySystem: db.blockUserBySystem,
      handleQrCode: db.handleQrCode,
      getBotInstances: db.getBotInstances,
      blockUser: async (userId, reason, blockedBy) => {
        try {
          const cleanUserId = normalizeJid(userId);
          const result = await db.blockUserBySystem(cleanUserId);
          if (result.success) return { affectedRows: 1 };
          throw new Error(result.message);
        } catch (error) {
          botLogger.error(`Error in blockUser: ${error.message}`, { userId, reason, blockedBy });
          throw error;
        }
      },
      unblockUser: async (userId, unblockBy) => {
        try {
          const cleanUserId = normalizeJid(userId);
          const result = await db.unbanUser(cleanUserId);
          return result.success && result.wasUnbanned;
        } catch (error) {
          botLogger.error(`Error in unblockUser: ${error.message}`, { userId, unblockBy });
          throw error;
        }
      },
      isBlocked: async (userId) => {
        try {
          const cleanUserId = normalizeJid(userId);
          const status = await db.checkUserStatus(cleanUserId);
          return status.isBlocked;
        } catch (error) {
          botLogger.error(`Error in isBlocked: ${error.message}`, { userId });
          return false;
        }
      },
    };

    return activeSocket;
  } catch (error) {
    botLogger.error("Error in initBot:", error);
    process.exit(1);
  }
};

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function setupGlobalErrorHandlers() {
  process.on("unhandledRejection", (reason, promise) => {
    if (reason.message?.includes("Timed Out")) {
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
      botLogger.error(
        "Unhandled rejection at " + promise + " reason: " + reason,
        { promise, reason }
      );
    }
  });
}

async function initializeAllBots() {
  try {
    await db.initializeDatabase(); // Pastikan database diinisialisasi
    const bots = await db.getBotInstances();
    const activeBots = bots.filter((bot) => bot.status === "active");
    for (const bot of activeBots) {
      try {
        await startChildBot(bot.number, JSON.parse(bot.credentials));
        botLogger.info(`Bot ${bot.number} berhasil diinisialisasi`);
      } catch (error) {
        botLogger.error(`Gagal inisialisasi bot ${bot.number}:`, error);
      }
    }
  } catch (error) {
    botLogger.error("Error initializing bots:", error);
  }
}

initializeAllBots();

(async () => {
  botLogger.info("Starting bot...");
  setupGlobalErrorHandlers();
  readAsciiFile();
  loadCommands(path.join(__dirname, "src/commands"));
  try {
    await db.initializeDatabase(); // Pastikan database diinisialisasi sebelum operasi lain
    await initializeAllBots(); // Panggil setelah initBot
    await initBot();
    await startChildBots(); // Panggil setelah initBot
  } catch (error) {
    botLogger.error(`Failed to start bot: ${error.message}`);
    process.exit(1);
  }
})();

process.on("uncaughtException", (err) => {
  if (botLogger) botLogger.error("Uncaught Exception: " + err);
  else console.error("Fallback error logging:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  cleanupAndExit(1);
});

async function cleanupAndExit(code = 0) {
  botLogger.info("🛑 Cleaning up before exit...");
  try {
    await store.close();
    for (const [number, sock] of global.childBots) {
      await sock.end();
    }
  } catch (cleanupError) {
    botLogger.error("Cleanup error:", cleanupError);
  }
  process.exit(code);
}

async function checkBanStatus(userId) {
  try {
    const status = await db.checkUserStatus(userId);
    botLogger.info(`Memeriksa status ban untuk user: ${userId}`);
    let banInfo = null;
    if (status.isBanned) {
      banInfo = {
        reason: status.banReason || "Diblokir oleh admin",
        banned_at: status.created_at || new Date().toISOString(),
      };
    }
    return { isBanned: status.isBanned, banInfo };
  } catch (error) {
    botLogger.error("Error memeriksa status ban:", error);
    return { isBanned: false, banInfo: null };
  }
}

process.on("SIGINT", async () => {
  botLogger.info("Menerima signal SIGINT, membersihkan...");
  if (activeSocket?.ws) {
    activeSocket.ws.close();
    activeSocket.ev.removeAllListeners();
  }
  process.exit(0);
});

async function startChildBot(phoneNumber, credentials) {
  try {
    const validateCredentials = (creds) => {
      return (
        creds?.me?.id &&
        creds?.noiseKey?.length === 32 &&
        creds?.signedIdentityKey?.length === 32
      );
    };

    if (!validateCredentials(credentials)) {
      console.warn(`⚠️ Regenerasi credentials untuk ${phoneNumber}`);
      const { state } = await useMultiFileAuthState(
        path.join(__dirname, `sessions/${phoneNumber}`)
      );
      try {
        const bots = await db.getBotInstances();
        const exists = bots.find((bot) => bot.number === phoneNumber);
        if (exists) {
          exists.credentials = JSON.stringify(state);
          exists.updated_at = new Date().toISOString();
          await db.writeDatabase({ bot_instances: bots });
        } else {
          bots.push({
            id: db.getNewId(bots),
            number: phoneNumber,
            credentials: JSON.stringify(state),
            status: "active",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          await db.writeDatabase({ bot_instances: bots });
        }
        console.log(`✅ Berhasil update credentials ${phoneNumber}`);
        credentials = state;
      } catch (dbError) {
        console.error("Gagal update database:", dbError);
        throw new Error("Gagal update credentials di database");
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
      keepAliveIntervalMs: 7200000,
    });

    childSock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr && !childSock.user) {
        console.log("⚠️ QR Code diperlukan untuk", phoneNumber);
        db.handleQrCode(qr, phoneNumber).catch(console.error);
      }
      if (connection === "close") {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        if (statusCode === 401 || statusCode === 403 || statusCode === 404) {
          fs.rmSync(path.join(__dirname, `sessions/${phoneNumber}`), {
            recursive: true,
            force: true,
          });
          console.log("⚠️ Session dihapus karena error auth");
          db.getBotInstances().then((bots) => {
            const bot = bots.find((b) => b.number === phoneNumber);
            if (bot) {
              bot.status = "inactive";
              db.writeDatabase({ bot_instances: bots });
            }
          });
        }
      }
      if (connection === "open") {
        db.getBotInstances().then(async (bots) => {
          const bot = bots.find((b) => b.number === phoneNumber);
          if (bot) {
            bot.status = "active";
            bot.updated_at = new Date().toISOString();
            await db.writeDatabase({ bot_instances: bots });
            botLogger.info(`Bot ${phoneNumber} status updated to active`);
          }
        });
      }
    });

    return childSock;
  } catch (error) {
    console.error(`🚨 Gagal mutlak untuk ${phoneNumber}:`, error);
    db.getBotInstances().then((bots) => {
      const bot = bots.find((b) => b.number === phoneNumber);
      if (bot) {
        bot.status = "inactive";
        db.writeDatabase({ bot_instances: bots });
      }
    });
    throw new Error(`Di nonaktifkan otomatis: ${error.message}`);
  }
}

process.on("SIGINT", async () => {
  console.log("\n🛑 Cleaning up child bots...");
  for (const [number, sock] of global.childBots) {
    await sock.end();
  }
  store.close();
  process.exit(0);
});

async function startChildBots() {
  try {
    await db.initializeDatabase(); // Pastikan database diinisialisasi
    const bots = await db.getBotInstances();
    const rows = bots.filter((bot) => bot.status === "active");
    for (const row of rows) {
      if (row.number !== config.mainNumber) {
        await initializeBot(row.number);
      }
    }
  } catch (error) {
    console.error("Error starting child bots:", error);
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
        botLogger.info(`🗑 Session kosong dihapus untuk ${phoneNumber}`);
      }
    }
    const { state, saveCreds } = await useMultiFileAuthState(authFolder);
    sock = makeWASocket({
      auth: { creds: state.creds, keys: state.keys },
      logger: baileysLogger,
      msgRetryCounterCache,
      getMessage: async (key) => {
        const message = await store.loadMessage(key.remoteJid, key.id);
        return message || {};
      },
      connectTimeoutMs: 30000,
      keepAliveIntervalMs: 15000,
      autoReconnect: true,
      connectionOptions: { timeout: 30000, keepAlive: true },
    });
    const setupEventHandlers = () => {
      sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
          console.log(`🔌 Koneksi ${phoneNumber} terputus:`, lastDisconnect.error);
        } else if (connection === "open") {
          console.log(`✅ Koneksi ${phoneNumber} stabil`);
        }
      });
      sock.ev.on("creds.update", saveCreds);
    };
    setupEventHandlers();
    global.childBots.set(phoneNumber, sock);
    botLogger.info(`🤖 Bot ${phoneNumber} berhasil diinisialisasi`);
    return sock;
  } catch (error) {
    botLogger.error(`❌ Gagal inisialisasi bot ${phoneNumber}:`, error);
    if (sock !== null) {
      sock.ev.removeAllListeners();
      sock.ws.close();
    }
    fs.rmSync(path.join(__dirname, `sessions/${phoneNumber}`), {
      recursive: true,
      force: true,
    });
    throw error;
  }
}

process.on("exit", () => {
  console.log("Membersihkan koneksi...");
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
    botLogger.info(`Parsed command: ${command}, args: ${args}`);
    return { command, args };
  }
  botLogger.info(`Tidak ada command ditemukan di teks: ${text}`);
  return null;
};

