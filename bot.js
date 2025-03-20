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
  logAlways,
  logToFile,
  logStartup
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
const os = require("os");
const { messageQueue } = require('./src/utils/messageQueue');
const messageHandlers = require('./src/utils/messageHandlers');
process.env.PREFIX = process.env.PREFIX?.trim() || "!";

const id = fs.readFileSync("./src/i18n/langId.json", "utf8");
const en = fs.readFileSync("./src/i18n/langEn.json", "utf8");
// Define the path to the ASCII file
const asciiFilePath = path.join(__dirname, 'database', 'ascii.txt');

// Function to read the ASCII file and display bot introduction
function readAsciiFile() {
  try {
    // Read ASCII art banner from file
    const banner = fs.existsSync(asciiFilePath) 
      ? fs.readFileSync(asciiFilePath, 'utf8')
      : "=== Oblivinx Bot ===";
    
    // Always show the banner and bot info regardless of logging status
    // Both on console and in log files
    logAlways(banner, 'info');
    logToFile(banner, 'info');
    
    const botInfo = [
      'Hello everyone! Im Oblivinx Bot',
      'Welcome to Oblivinx bot! Please enjoy the services available.',
      'If you encounter any bugs, please do not hesitate to reach out to the contacts listed.',
      'You can also contribute to the development of this bot by forking our repository on GitHub and submitting a pull request.',
      'Thank you for using Oblivinx bot, hope it helps! 🚀',
      '=========================== Contact Developer ============================',
      `Name: ${process.env.OWNER1_NAME || 'Natz'}`,
      `Phone: ${process.env.OWNER_NUMBER_ONE || '081910058235'}`,
      `Email: ${process.env.OWNER1_EMAIL || 'riobelly@gmail.com'}`,
      `GitHub: ${process.env.OWNER1_GITHUB || 'https://github.com/RioBelly'}`,
      'Instagram: patch.cpp',
      '=========================================================================='
    ];
    
    // Log each line of info to both console and file
    botInfo.forEach(line => {
      logAlways(line, 'info');
      logToFile(line, 'info');
    });
    
  } catch (error) {
    botLogger.error('Error reading ASCII file: ' + error.message);
  }
}

// Function untuk menampilkan banner startup di terminal
function displayStartupBanner() {
  try {
    // Baca ASCII art banner dari file
    const banner = fs.existsSync(asciiFilePath) 
      ? fs.readFileSync(asciiFilePath, 'utf8')
      : "=== Oblivinx Bot ===";
    
    // Tampilkan banner dengan warna khusus
    console.log('\n'); // Tambahkan baris kosong untuk kejelasan
    logStartup(banner, 'info');
    
    // Tambahkan garis pembatas
    const separator = '='.repeat(70);
    logStartup(separator, 'info');
    
    // Tampilkan informasi pengembang bot
    logStartup('👨‍💻 DEVELOPER INFO', 'info');
    logStartup(`Name    : ${process.env.OWNER1_NAME || 'Natz'}`, 'info');
    logStartup(`Phone   : ${process.env.OWNER_NUMBER_ONE || '081910058235'}`, 'info');
    logStartup(`Email   : ${process.env.OWNER1_EMAIL || 'riobelly@gmail.com'}`, 'info');
    logStartup(`GitHub  : ${process.env.OWNER1_GITHUB || 'https://github.com/RioBelly'}`, 'info');
    logStartup(`Instagram: patch.cpp`, 'info');
    
    // Tampilkan informasi sistem
    logStartup(separator, 'info');
    logStartup('🖥️ SYSTEM INFO', 'info');
    
    const cpuModel = os.cpus()[0].model;
    const platform = os.platform();
    const memTotal = formatBytes(os.totalmem());
    const hostname = os.hostname();
    
    logStartup(`System  : ${platform} (${os.release()})`, 'info');
    logStartup(`Hostname: ${hostname}`, 'info');
    logStartup(`CPU     : ${cpuModel}`, 'info');
    logStartup(`Memory  : ${memTotal}`, 'info');
    logStartup(`WorkDir : ${process.cwd()}`, 'info');
    
    // Tampilkan informasi konfigurasi bot
    logStartup(separator, 'info');
    logStartup('🤖 BOT CONFIGURATION', 'info');
    logStartup(`Name    : ${config.botName}`, 'info');
    logStartup(`Prefix  : ${config.prefix}`, 'info');
    logStartup(`Debug   : ${process.env.DEBUG_MODE === 'true' ? 'Enabled' : 'Disabled'}`, 'info');
    logStartup(`Logging : ${process.env.LOGGING_ENABLED !== 'false' ? 'Enabled' : 'Disabled (errors only)'}`, 'info');
    
    logStartup(separator, 'info');
    logStartup('📡 INITIALIZING BOT SERVICES...', 'info');
    console.log('\n'); // Tambahkan baris kosong untuk kejelasan
  } catch (error) {
    botLogger.error('Error displaying startup banner: ' + error.message);
  }
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

            // Masukkan pesan ke dalam antrian
            const messageId = messageQueue.enqueue(enhancedMsg, {
              isCommand: messageText.startsWith(PREFIX),
              isFromGroup: isGroup,
              isPremium: false, // Tentukan apakah user premium atau tidak
              timestamp: Date.now()
            });

            if (messageId) {
              botLogger.debug(`Message queued with ID: ${messageId}`);
            } else {
              botLogger.warn(`Failed to queue message from ${participant}`);
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
            // Update cache metadata grup
            const metadata = await promiseWithTimeout(
              sock.groupMetadata(event.id),
              5000
            );
            groupCache.set(event.id, metadata);
            
            // Cek tipe update (add/remove)
            const { participants, action } = event;
            
            // Import fungsi welcome/goodbye
            const { handleGroupJoin, handleGroupLeave } = require('./src/lib/welcomeNgoodbyemsg');
            
            // Buat pesan yang sesuai format untuk diproses
            const mockMsg = {
              key: {
                remoteJid: event.id
              },
              messageContent: {}
            };
            
            // Tambahkan data yang sesuai berdasarkan tipe event
            if (action === 'add') {
              mockMsg.messageContent.groupParticipantAddNotif = {
                participants: participants
              };
              mockMsg.messageStubType = 28; // GROUP_PARTICIPANT_ADD
              mockMsg.messageStubParameters = participants;
              
              // Panggil fungsi untuk handle welcome
              try {
                await handleGroupJoin(sock, mockMsg);
              } catch (err) {
                botLogger.error('Error handling group join via event:', err);
              }
            } 
            else if (action === 'remove') {
              mockMsg.messageContent.groupParticipantRemoveNotif = {
                participants: participants
              };
              mockMsg.messageStubType = 27; // GROUP_PARTICIPANT_LEAVE
              mockMsg.messageStubParameters = participants;
              
              // Panggil fungsi untuk handle goodbye
              try {
                await handleGroupLeave(sock, mockMsg);
              } catch (err) {
                botLogger.error('Error handling group leave via event:', err);
              }
            }
          } catch (error) {
            botLogger.error(
              `Error in group-participants.update (${event.id}):`,
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
    
    if (!bots || !Array.isArray(bots)) {
      botLogger.warn("No bots found or bot data is invalid");
      return;
    }
    
    const activeBots = bots.filter((bot) => bot.status === "active");
    
    if (activeBots.length === 0) {
      botLogger.info("No active bots to initialize");
      return;
    }
    
    botLogger.info(`Found ${activeBots.length} active bots to initialize`);
    
    for (const bot of activeBots) {
      try {
        if (!bot.number) {
          botLogger.warn("Bot without number found, skipping");
          continue;
        }
        
        if (!bot.credentials) {
          botLogger.warn(`Bot ${bot.number} has no credentials, initializing with empty state`);
          await startChildBot(bot.number, null);
        } else {
          try {
            const credentials = JSON.parse(bot.credentials);
            await startChildBot(bot.number, credentials);
            botLogger.info(`Bot ${bot.number} berhasil diinisialisasi`);
          } catch (parseError) {
            botLogger.error(`Invalid credentials format for bot ${bot.number}: ${parseError.message}`);
            await startChildBot(bot.number, null);
          }
        }
      } catch (error) {
        botLogger.error(`Gagal inisialisasi bot ${bot.number}: ${error.message}`);
        // Lanjutkan ke bot berikutnya
      }
    }
  } catch (error) {
    botLogger.error("Error initializing bots: " + error.message);
    // Tidak throw error, untuk menghindari crash aplikasi
  }
}

// Implementasi untuk startChildBot yang digunakan di initializeAllBots
async function startChildBot(phoneNumber, credentials) {
  try {
    if (!credentials || !credentials.creds) {
      botLogger.warn(`No valid credentials for ${phoneNumber}, initializing empty state`);
      const authFolder = path.join(__dirname, `sessions/${phoneNumber}`);
      if (!fs.existsSync(authFolder)) {
        fs.mkdirSync(authFolder, { recursive: true });
      }
      const { state } = await useMultiFileAuthState(authFolder);
      credentials = state;
    }
    
    const childSocket = makeWASocket({
      auth: credentials,
      printQRInTerminal: true,
      logger: baileysLogger,
      browser: ["Oblivinx Child Bot", "Chrome", "1.0.0"],
      connectTimeoutMs: CONNECTION_TIMEOUT,
      keepAliveIntervalMs: 15000,
    });
    
    // Set up basic event handlers
    childSocket.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        botLogger.info(`QR Code available for ${phoneNumber}, scan to login`);
        // Simpan QR Code jika diperlukan
        if (db.handleQrCode) {
          db.handleQrCode(qr, phoneNumber).catch(err => 
            botLogger.error(`Error handling QR code for ${phoneNumber}: ${err.message}`)
          );
        }
      }
      
      if (connection === "close") {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        botLogger.info(`Child bot ${phoneNumber} connection closed with status: ${statusCode}`);
      } else if (connection === "open") {
        botLogger.info(`Child bot ${phoneNumber} connected successfully`);
        
        // Update status bot di database jika perlu
        db.getBotInstances().then(async (bots) => {
          const bot = bots.find((b) => b.number === phoneNumber);
          if (bot) {
            bot.status = "active";
            bot.updated_at = new Date().toISOString();
            await db.writeDatabase({ bot_instances: bots }).catch(err => 
              botLogger.error(`Error updating bot status: ${err.message}`)
            );
          }
        }).catch(err => botLogger.error(`Error getting bot instances: ${err.message}`));
      }
    });
    
    // Handle credential updates
    const saveCreds = async () => {
      const authFolder = path.join(__dirname, `sessions/${phoneNumber}`);
      const { state } = await useMultiFileAuthState(authFolder);
      
      // Update credentials di database jika perlu
      db.getBotInstances().then(async (bots) => {
        const bot = bots.find((b) => b.number === phoneNumber);
        if (bot) {
          bot.credentials = JSON.stringify(state);
          bot.updated_at = new Date().toISOString();
          await db.writeDatabase({ bot_instances: bots }).catch(err => 
            botLogger.error(`Error updating bot credentials: ${err.message}`)
          );
        }
      }).catch(err => botLogger.error(`Error getting bot instances: ${err.message}`));
    };
    
    childSocket.ev.on("creds.update", saveCreds);
    
    // Store in global map if not exists
    if (!global.childBots) {
      global.childBots = new Map();
    }
    
    global.childBots.set(phoneNumber, childSocket);
    return childSocket;
  } catch (error) {
    botLogger.error(`Error starting child bot ${phoneNumber}: ${error.message}`);
    throw error; // Re-throw to be handled by caller
  }
}

// Implementasi fungsi startChildBots yang dipanggil di IIFE
async function startChildBots() {
  try {
    // Pastikan database diinisialisasi
    await db.initializeDatabase();
    
    // Ambil daftar bot dari database
    const bots = await db.getBotInstances();
    
    // Filter bot yang aktif dan bukan bot utama
    const activeChildBots = bots.filter(bot => 
      bot.status === "active" && bot.number !== config.number
    );
    
    if (activeChildBots.length > 0) {
      logStartup(`Initializing ${activeChildBots.length} child bots...`, 'info');
      
      // Inisialisasi setiap bot anak secara berurutan
      for (const bot of activeChildBots) {
        try {
          const childSocket = await startChildBot(
            bot.number, 
            bot.credentials ? JSON.parse(bot.credentials) : null
          );
          
          logStartup(`Child bot ${bot.number} initialized successfully`, 'info');
        } catch (error) {
          botLogger.error(`Failed to initialize child bot ${bot.number}: ${error.message}`);
        }
      }
    } else {
      logStartup('No active child bots to initialize', 'info');
    }
  } catch (error) {
    botLogger.error(`Error starting child bots: ${error.message}`);
    throw error; // Re-throw to be handled by caller
  }
}

// Fungsi untuk mengurai teks pesan menjadi command dan argumen
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

// Tambahkan fungsi untuk menginisialisasi message queue di bagian akhir IIFE
(async () => {
  botLogger.info("Starting bot...");
  setupGlobalErrorHandlers();
  
  // Tampilkan banner startup di awal
  displayStartupBanner();
  
  loadCommands(path.join(__dirname, "src/commands"));
  try {
    // Inisialisasi database terlebih dahulu
    await db.initializeDatabase();
    
    // Inisialisasi bot utama
    const mainBot = await initBot();
    if (!mainBot) {
      throw new Error("Failed to initialize main bot");
    }
    
    // Inisialisasi message queue handlers
    initializeMessageQueue();
    
    // Setelah bot utama berhasil diinisialisasi, coba inisialisasi bot anak
    try {
      await startChildBots();
    } catch (childBotsError) {
      // Lanjutkan meski ada error dengan bot anak
      botLogger.error(`Error with child bots: ${childBotsError.message}`);
      logStartup('Continuing with main bot only...', 'warn');
    }
    
    // Tampilkan pesan bahwa bot siap digunakan
    console.log('\n'); // Tambahkan baris kosong untuk kejelasan
    logStartup('=====================================================', 'info');
    logStartup('✅ BOT IS NOW ONLINE AND READY!', 'info');
    logStartup('=====================================================', 'info');
    
    // Tampilkan cara menggunakan bot
    logStartup(`Use "${config.prefix}help" or "${config.prefix}menu" to see available commands`, 'info');
    logStartup(`Use "${config.prefix}botinfo" to see bot information`, 'info');
    console.log('\n'); // Tambahkan baris kosong untuk kejelasan
  } catch (error) {
    botLogger.error(`Failed to start bot: ${error.message}`);
    process.exit(1);
  }
})();

/**
 * Inisialisasi sistem antrian pesan dan mendaftarkan handler
 */
function initializeMessageQueue() {
  // Set up command handlers
  messageHandlers.setupCommandHandlers(commandHandler, executeCommand);
  
  // Register message handlers untuk berbagai tipe pesan
  messageQueue.registerHandler('text', (msg, metadata) => messageHandlers.handleTextMessage(msg, metadata));
  messageQueue.registerHandler('image', (msg, metadata) => messageHandlers.handleImageMessage(msg, metadata));
  messageQueue.registerHandler('sticker', (msg, metadata) => messageHandlers.handleStickerMessage(msg, metadata));
  
  // Register default handler untuk semua tipe pesan lainnya
  messageQueue.setDefaultHandler((msg, metadata) => messageHandlers.handleDefaultMessage(msg, metadata));
  
  // Log status antrian dimulai
  botLogger.info(`Message queue system initialized with capacity for ${messageQueue.maxQueueSize.toLocaleString()} messages`);
  botLogger.info(`Processing up to ${messageQueue.maxConcurrentProcessing} messages concurrently`);
} 