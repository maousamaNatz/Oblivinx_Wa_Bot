globalThis.crypto = require("crypto");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  makeInMemoryStore,
  MessageType,
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
  logStartup,
} = require("./src/utils/logger");
const leveling = require("./src/leveling");
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
const { log } = require("./src/utils/logger");
const os = require("os");
const { messageQueue } = require("./src/utils/messageQueue");
const messageHandlers = require("./src/utils/messageHandlers");
process.env.PREFIX = process.env.PREFIX?.trim() || "!";
// Define the path to the ASCII file
const asciiFilePath = path.join(__dirname, "database", "ascii.txt");

// Jika MessageType belum didefinisikan dari library, definisikan manual
if (!MessageType) {
  const MessageType = {
    GROUP_CHANGE: 1,
    GROUP_CHANGE_SUBJECT: 27,
    GROUP_CHANGE_ICON: 28,
    GROUP_CHANGE_INVITE_LINK: 31,
    GROUP_CHANGE_DESCRIPTION: 32,
    GROUP_SETTINGS_CHANGED: 35,
    GROUP_CHANGE_ANNOUNCE: 36,
    GROUP_CHANGE_RESTRICT: 37,
    GROUP_PARTICIPANT_ADD: 28,
    GROUP_PARTICIPANT_REMOVE: 27,
    GROUP_PARTICIPANT_PROMOTE: 47,
    GROUP_PARTICIPANT_DEMOTE: 48
  };
  
  // Export MessageType 
  global.MessageType = MessageType;
}

// Function to read the ASCII file and display bot introduction
function readAsciiFile() {
  try {
    // Read ASCII art banner from file
    const banner = fs.existsSync(asciiFilePath)
      ? fs.readFileSync(asciiFilePath, "utf8")
      : "=== Oblivinx Bot ===";

    // Always show the banner and bot info regardless of logging status
    // Both on console and in log files
    logAlways(banner, "info");
    logToFile(banner, "info");

    const botInfo = [
      `${config.bot.opening}`,
      `${config.bot.welcome}`,
      `${config.bot.bug}`,
      `${config.bot.contribute}`,
      `${config.bot.thankyou}`,
      `${config.bot.contact}`,
      `${config.bot.name}`,
      `${config.bot.phone}`,
      `${config.bot.email}`,
      `${config.bot.github}`,
      `${config.bot.instagram}`,
      `${config.bot.version}`,
      `${config.bot.author}`,
      `${config.bot.license}`,
      `${config.bot.description}`,
      `${config.bot.contribute}`,
      `${config.bot.thankyou}`,
      `${config.bot.contact}`,
    ];

    // Log each line of info to both console and file
    botInfo.forEach((line) => {
      logAlways(line, "info");
      logToFile(line, "info");
    });
  } catch (error) {
    botLogger.error(`${config.logs.error.error9} : ${error.message}`);
  }
}

// Function untuk menampilkan banner startup di terminal
function displayStartupBanner() {
  try {
    // Baca ASCII art banner dari file
    const banner = fs.existsSync(asciiFilePath)
      ? fs.readFileSync(asciiFilePath, "utf8")
      : "=== Oblivinx Bot ===";

    // Tampilkan banner dengan warna khusus
    console.log("\n"); // Tambahkan baris kosong untuk kejelasan
    logStartup(banner, "info");

    // Tambahkan garis pembatas
    const separator = "=".repeat(70);
    logStartup(separator, "info");

    // Tampilkan informasi pengembang bot
    logStartup("👨‍💻 DEVELOPER INFO", "info");
    logStartup(`Name    : ${process.env.OWNER1_NAME || "Natz"}`, "info");
    logStartup(
      `Phone   : ${process.env.OWNER_NUMBER_ONE || "081910058235"}`,
      "info"
    );
    logStartup(
      `Email   : ${process.env.OWNER1_EMAIL || "riobelly@gmail.com"}`,
      "info"
    );
    logStartup(
      `GitHub  : ${process.env.OWNER1_GITHUB || "https://github.com/RioBelly"}`,
      "info"
    );
    logStartup(`Instagram: patch.cpp`, "info");

    // Tampilkan informasi sistem
    logStartup(separator, "info");
    logStartup("🖥️ SYSTEM INFO", "info");

    const cpuModel = os.cpus()[0].model;
    const platform = os.platform();
    const memTotal = formatBytes(os.totalmem());
    const hostname = os.hostname();

    logStartup(`System  : ${platform} (${os.release()})`, "info");
    logStartup(`Hostname: ${hostname}`, "info");
    logStartup(`CPU     : ${cpuModel}`, "info");
    logStartup(`Memory  : ${memTotal}`, "info");
    logStartup(`WorkDir : ${process.cwd()}`, "info");

    // Tampilkan informasi konfigurasi bot
    logStartup(separator, "info");
    logStartup("🤖 BOT CONFIGURATION", "info");
    logStartup(`Name    : ${config.botName}`, "info");
    logStartup(`Prefix  : ${config.prefix}`, "info");
    logStartup(
      `Debug   : ${process.env.DEBUG_MODE === "true" ? "Enabled" : "Disabled"}`,
      "info"
    );
    logStartup(
      `Logging : ${
        process.env.LOGGING_ENABLED !== "false"
          ? "Enabled"
          : "Disabled (errors only)"
      }`,
      "info"
    );

    logStartup(separator, "info");
    logStartup("📡 INITIALIZING BOT SERVICES...", "info");
    console.log("\n"); // Tambahkan baris kosong untuk kejelasan
  } catch (error) {
    botLogger.error("Error displaying startup banner: " + error.message);
  }
}

// Tambahkan fungsi promiseWithTimeout di bagian atas file
function promiseWithTimeout(promise, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Promise timeout after ${timeoutMs}ms`));
    }, timeoutMs);
    
    promise
      .then(result => {
        clearTimeout(timeout);
        resolve(result);
      })
      .catch(error => {
        clearTimeout(timeout);
        reject(error);
      });
  });
}

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
              if (
                !global.Oblixn.isOwner(msg.key.participant || msg.key.remoteJid)
              ) {
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

            // Periksa apakah ini adalah notifikasi perubahan grup
            if (msg.messageStubType) {
              await handleGroupNotification(effectiveSock, msg, sender, isGroup, groupId);
              return; // Hentikan pemrosesan pesan lebih lanjut untuk notifikasi
            }

            const xpResult = await leveling.trackActivityXP(
              userId,
              groupId,
              "message",
              1,
              effectiveSock
            );

            if (xpResult.user?.leveledUp) {
              botLogger.info(
                `User ${userId} leveled up from ${xpResult.user.oldLevel} to ${xpResult.user.newLevel}`
              );
            }
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
              groupMetadata: isGroup
                ? groupMetadata || groupCache.get(sender)
                : null,
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
              timestamp: Date.now(),
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
        'groups.update': async (updates) => {
          if (isReconnecting) {
            botLogger.info("Skipping groups.update during reconnection");
            return;
          }
          if (!sock || typeof sock.groupMetadata !== "function") {
            botLogger.warn("Socket not available for groups.update");
            return;
          }
          
          botLogger.info(`Menerima pembaruan grup: ${JSON.stringify(updates)}`);
          
          for (const update of updates) {
            try {
              // Ambil metadata grup terbaru
              const metadata = await promiseWithTimeout(
                sock.groupMetadata(update.id),
                5000
              );
              
              // Perbarui cache
              groupCache.set(update.id, metadata);
              
              // Ambil data grup dari database
              const existingGroup = await db.getGroup(update.id);
              
              // Siapkan data yang akan diperbarui
              const updateData = {
                updated_at: new Date().toISOString()
              };
              
              // Update berdasarkan tipe pembaruan yang diterima
              if (update.subject) {
                updateData.group_name = update.subject;
                botLogger.info(`Grup ${update.id} mengubah nama menjadi: ${update.subject}`);
              }
              
              if (update.announce !== undefined) {
                botLogger.info(`Grup ${update.id} mengubah pengaturan announce: ${update.announce}`);
              }
              
              if (update.restrict !== undefined) {
                botLogger.info(`Grup ${update.id} mengubah pengaturan restrict: ${update.restrict}`);
              }
              
              if (update.descId) {
                // Deskripsi grup berubah, coba ambil deskripsi baru
                if (metadata.desc) {
                  updateData.description = metadata.desc;
                  botLogger.info(`Grup ${update.id} mengubah deskripsi`);
                }
              }
              
              // Perbarui jumlah anggota dan status admin
              updateData.total_members = metadata.participants.length;
              updateData.bot_is_admin = metadata.participants.some(
                p => p.id === sock.user.id && (p.admin === 'admin' || p.admin === 'superadmin')
              ) ? 1 : 0;
              
              // Periksa apakah grupnya ada atau perlu dibuat baru
              if (existingGroup) {
                // Update grup yang sudah ada
                await db.updateGroup(update.id, updateData);
                botLogger.info(`Berhasil memperbarui data grup ${update.id}`);
              } else {
                // Tambahkan grup baru jika belum ada
                const ownerJid = metadata.owner || metadata.participants[0]?.id;
                await db.addGroup({
                  group_id: update.id,
                  group_name: metadata.subject || "Unnamed Group",
                  owner_id: ownerJid,
                  total_members: metadata.participants.length,
                  description: metadata.desc || null,
                  created_at: new Date().toISOString(),
                  registration_date: new Date().toISOString(),
                  bot_is_admin: updateData.bot_is_admin
                });
                botLogger.info(`Grup baru ditambahkan ke database: ${update.id}`);
              }
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

            // Update data di database
            const groupId = event.id;
            let existingGroup = await db.getGroup(groupId);
            
            if (existingGroup) {
              // Update total anggota
              await db.updateGroup(groupId, {
                total_members: metadata.participants.length,
                updated_at: new Date().toISOString()
              });
              
              botLogger.info(`Updated group ${groupId} member count to ${metadata.participants.length}`);
            } else {
              // Grup belum ada di database, tambahkan
              try {
                const ownerJid = metadata.owner || metadata.participants[0]?.id;
                
                // Cek apakah bot adalah admin
                const isBotAdmin = metadata.participants.some(
                  p => p.id === sock.user.id && (p.admin === 'admin' || p.admin === 'superadmin')
                );
                
                existingGroup = await db.addGroup({
                  group_id: groupId,
                  group_name: metadata.subject || "Unnamed Group",
                  owner_id: ownerJid,
                  total_members: metadata.participants.length,
                  created_at: new Date().toISOString(),
                  registration_date: new Date().toISOString(),
                  bot_is_admin: isBotAdmin ? 1 : 0,
                  welcome_message: 1, // Aktifkan welcome message secara default
                  goodbye_message: 1, // Aktifkan goodbye message secara default
                  level: 1,
                  total_xp: 0,
                  current_xp: 0,
                  xp_to_next_level: 1000
                });
                botLogger.info(`Added new group to database: ${groupId}`);
              } catch (error) {
                botLogger.error(`Failed to add group to database: ${error.message}`);
                return; // Keluar jika gagal menambahkan grup
              }
            }

            // Cek tipe update (add/remove)
            const { participants, action } = event;
            
            // Import fungsi welcome/goodbye
            const {
              handleGroupJoin,
              handleGroupLeave,
            } = require("./src/lib/welcomeNgoodbyemsg");

            // Buat pesan yang sesuai format untuk diproses
            const mockMsg = {
              key: {
                remoteJid: event.id,
              },
              messageContent: {},
            };

            // Tambahkan data yang sesuai berdasarkan tipe event
            if (action === "add") {
              // Cek apakah welcome_message aktif
              if (existingGroup && existingGroup.welcome_message === 1) {
                mockMsg.messageContent.groupParticipantAddNotif = {
                  participants: participants,
                };
                mockMsg.messageStubType = 28; // GROUP_PARTICIPANT_ADD
                mockMsg.messageStubParameters = participants;

                // Panggil fungsi untuk handle welcome
                try {
                  botLogger.info(`Memanggil handleGroupJoin untuk ${participants.length} peserta baru di grup ${event.id}`);
                  await handleGroupJoin(sock, mockMsg);
                } catch (err) {
                  botLogger.error(`Error handling group join via event: ${err.message}`, err);
                }
              } else {
                botLogger.info(`Welcome message tidak aktif untuk grup ${event.id} atau grup tidak ditemukan`);
              }
            } else if (action === "remove") {
              // Cek apakah goodbye_message aktif
              if (existingGroup && existingGroup.goodbye_message === 1) {
                mockMsg.messageContent.groupParticipantRemoveNotif = {
                  participants: participants,
                };
                mockMsg.messageStubType = 27; // GROUP_PARTICIPANT_LEAVE
                mockMsg.messageStubParameters = participants;

                // Panggil fungsi untuk handle goodbye
                try {
                  botLogger.info(`Memanggil handleGroupLeave untuk ${participants.length} peserta yang keluar dari grup ${event.id}`);
                  await handleGroupLeave(sock, mockMsg);
                } catch (err) {
                  botLogger.error(`Error handling group leave via event: ${err.message}`, err);
                }
              } else {
                botLogger.info(`Goodbye message tidak aktif untuk grup ${event.id} atau grup tidak ditemukan`);
              }
            } else if (action === "promote" || action === "demote") {
              // Update status admin di cache jika perlu
              const updatedMetadata = await promiseWithTimeout(
                sock.groupMetadata(event.id),
                5000
              );
              groupCache.set(event.id, updatedMetadata);
              
              botLogger.info(`Group ${event.id} participant(s) ${action}d: ${participants.join(', ')}`);
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
      sock.ev.on("messages.upsert", async ({ messages, type }) => {
        try {
          if (type !== "notify") return;

          const msg = messages[0];
          if (!msg) return;
          
          // Proses pesan dan cek jika ini adalah pesan grup
          if (msg.key.remoteJid) {
            const isGroup = msg.key.remoteJid.endsWith('@g.us');
            const groupId = isGroup ? msg.key.remoteJid : null;
            const sender = isGroup ? (msg.key.participant || msg.key.remoteJid) : msg.key.remoteJid;
            
            // Handle notifikasi grup jika pesan dari grup dan memiliki messageStubType
            if (isGroup && msg.messageStubType) {
              await handleGroupNotification(sock, msg, sender, isGroup, groupId);
            }
            
            // Lanjutkan ke handler normal untuk semua jenis pesan
            handlers.messagesUpsert({ messages, type });
          }
        } catch (error) {
          botLogger.error(`Error saat memproses pesan: ${error.message}`, error);
        }
      });
      sock.ev.on("call", handlers.call);
      sock.ev.on("groups.update", handlers['groups.update']);
      sock.ev.on(
        "group-participants.update",
        handlers["group-participants.update"]
      );
      sock._eventHandlers = handlers;
    };

    const { state, saveCreds } = await useMultiFileAuthState(
      "auth_info_baileys"
    );
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
        `Memory usage - RSS: ${formatBytes(used.rss)}, Heap: ${formatBytes(
          used.heapUsed
        )}`
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
          botLogger.error(`Error in blockUser: ${error.message}`, {
            userId,
            reason,
            blockedBy,
          });
          throw error;
        }
      },
      unblockUser: async (userId, unblockBy) => {
        try {
          const cleanUserId = normalizeJid(userId);
          const result = await db.unbanUser(cleanUserId);
          return result.success && result.wasUnbanned;
        } catch (error) {
          botLogger.error(`Error in unblockUser: ${error.message}`, {
            userId,
            unblockBy,
          });
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

    // Tambahkan setelah socket berhasil terhubung
    // Sinkronisasi grup sekali setelah bot terhubung
    let initialSync = false;
    activeSocket.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === "close") {
        // ... existing code ...
      } else if (connection === "open") {
        botLogger.info(
          `${config.logs.info.socketOpen} ${config.bot.name} telah berhasil tersambung ke WhatsApp!`
        );
        
        // Jalankan sinkronisasi grup saat koneksi terbuka
        if (!initialSync) {
          setTimeout(async () => {
            try {
              botLogger.info("Menjalankan sinkronisasi awal grup...");
              await fullGroupSync(activeSocket);
              initialSync = true;
              botLogger.info("Sinkronisasi awal grup selesai");
            } catch (error) {
              botLogger.error(`Error saat sinkronisasi awal grup: ${error.message}`, error);
            }
          }, 5000); // Tunggu 5 detik setelah koneksi terbuka untuk sinkronisasi
        }
      }
    });

    // Tambahkan interval untuk sinkronisasi grup berkala - setiap 30 menit
    setInterval(async () => {
      try {
        botLogger.info("Menjalankan sinkronisasi berkala grup...");
        await fullGroupSync(activeSocket);
        botLogger.info("Sinkronisasi berkala grup selesai");
      } catch (error) {
        botLogger.error(`Error saat sinkronisasi berkala grup: ${error.message}`, error);
      }
    }, 30 * 60 * 1000); // 30 menit

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
          botLogger.warn(
            `Bot ${bot.number} has no credentials, initializing with empty state`
          );
          await startChildBot(bot.number, null);
        } else {
          try {
            const credentials = JSON.parse(bot.credentials);
            await startChildBot(bot.number, credentials);
            botLogger.info(`Bot ${bot.number} berhasil diinisialisasi`);
          } catch (parseError) {
            botLogger.error(
              `Invalid credentials format for bot ${bot.number}: ${parseError.message}`
            );
            await startChildBot(bot.number, null);
          }
        }
      } catch (error) {
        botLogger.error(
          `Gagal inisialisasi bot ${bot.number}: ${error.message}`
        );
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
      botLogger.warn(
        `No valid credentials for ${phoneNumber}, initializing empty state`
      );
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
          db.handleQrCode(qr, phoneNumber).catch((err) =>
            botLogger.error(
              `Error handling QR code for ${phoneNumber}: ${err.message}`
            )
          );
        }
      }

      if (connection === "close") {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        botLogger.info(
          `Child bot ${phoneNumber} connection closed with status: ${statusCode}`
        );
      } else if (connection === "open") {
        botLogger.info(`Child bot ${phoneNumber} connected successfully`);

        // Update status bot di database jika perlu
        db.getBotInstances()
          .then(async (bots) => {
            const bot = bots.find((b) => b.number === phoneNumber);
            if (bot) {
              bot.status = "active";
              bot.updated_at = new Date().toISOString();
              await db
                .writeDatabase({ bot_instances: bots })
                .catch((err) =>
                  botLogger.error(`Error updating bot status: ${err.message}`)
                );
            }
          })
          .catch((err) =>
            botLogger.error(`Error getting bot instances: ${err.message}`)
          );
      }
    });

    // Handle credential updates
    const saveCreds = async () => {
      const authFolder = path.join(__dirname, `sessions/${phoneNumber}`);
      const { state } = await useMultiFileAuthState(authFolder);

      // Update credentials di database jika perlu
      db.getBotInstances()
        .then(async (bots) => {
          const bot = bots.find((b) => b.number === phoneNumber);
          if (bot) {
            bot.credentials = JSON.stringify(state);
            bot.updated_at = new Date().toISOString();
            await db
              .writeDatabase({ bot_instances: bots })
              .catch((err) =>
                botLogger.error(
                  `Error updating bot credentials: ${err.message}`
                )
              );
          }
        })
        .catch((err) =>
          botLogger.error(`Error getting bot instances: ${err.message}`)
        );
    };

    childSocket.ev.on("creds.update", saveCreds);

    // Store in global map if not exists
    if (!global.childBots) {
      global.childBots = new Map();
    }

    global.childBots.set(phoneNumber, childSocket);
    return childSocket;
  } catch (error) {
    botLogger.error(
      `Error starting child bot ${phoneNumber}: ${error.message}`
    );
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
    const activeChildBots = bots.filter(
      (bot) => bot.status === "active" && bot.number !== config.number
    );

    if (activeChildBots.length > 0) {
      logStartup(
        `Initializing ${activeChildBots.length} child bots...`,
        "info"
      );

      // Inisialisasi setiap bot anak secara berurutan
      for (const bot of activeChildBots) {
        try {
          const childSocket = await startChildBot(
            bot.number,
            bot.credentials ? JSON.parse(bot.credentials) : null
          );

          logStartup(
            `Child bot ${bot.number} initialized successfully`,
            "info"
          );
        } catch (error) {
          botLogger.error(
            `Failed to initialize child bot ${bot.number}: ${error.message}`
          );
        }
      }
    } else {
      logStartup("No active child bots to initialize", "info");
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
    leveling.setupMessageHandler(mainBot);

    // Setelah bot utama berhasil diinisialisasi, coba inisialisasi bot anak
    try {
      await startChildBots();
    } catch (childBotsError) {
      // Lanjutkan meski ada error dengan bot anak
      botLogger.error(`Error with child bots: ${childBotsError.message}`);
      logStartup("Continuing with main bot only...", "warn");
    }

    // Tampilkan pesan bahwa bot siap digunakan
    console.log("\n"); // Tambahkan baris kosong untuk kejelasan
    logStartup("=====================================================", "info");
    logStartup("✅ BOT IS NOW ONLINE AND READY!", "info");
    logStartup("=====================================================", "info");
    logStartup(
      `Use "${config.prefix}help" or "${config.prefix}menu" to see available commands`,
      "info"
    );
    logStartup(`Use "${config.prefix}botinfo" to see bot information`, "info");
    console.log("\n"); // Tambahkan baris kosong untuk kejelasan

    // Setelah bot terhubung, panggil update status admin
    setTimeout(() => {
      if (mainBot && mainBot.user) {
        // Jalankan update grup sekaligus untuk sinkronisasi awal
        fullGroupSync(mainBot).then(() => {
          botLogger.info('Sinkronisasi awal grup selesai');
        }).catch(err => {
          botLogger.error('Error saat sinkronisasi awal grup:', err);
        });
        
        // Set interval untuk pemeriksaan berkala setiap jam
        const adminCheckInterval = setInterval(() => {
          if (mainBot && mainBot.user) {
            updateBotAdminStatus(mainBot);
          } else {
            clearInterval(adminCheckInterval);
          }
        }, 60 * 60 * 1000); // Periksa setiap jam
        
        // Set interval untuk sinkronisasi penuh setiap 12 jam
        const fullSyncInterval = setInterval(() => {
          if (mainBot && mainBot.user) {
            fullGroupSync(mainBot).then(() => {
              botLogger.info('Sinkronisasi penuh grup selesai');
            }).catch(err => {
              botLogger.error('Error saat sinkronisasi penuh grup:', err);
            });
          } else {
            clearInterval(fullSyncInterval);
          }
        }, 12 * 60 * 60 * 1000); // Setiap 12 jam
      }
    }, 30000); // Tunggu 30 detik setelah koneksi untuk pemeriksaan pertama
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
  messageQueue.registerHandler("text", (msg, metadata) =>
    messageHandlers.handleTextMessage(msg, metadata)
  );
  messageQueue.registerHandler("image", (msg, metadata) =>
    messageHandlers.handleImageMessage(msg, metadata)
  );
  messageQueue.registerHandler("sticker", (msg, metadata) =>
    messageHandlers.handleStickerMessage(msg, metadata)
  );
  messageQueue.setDefaultHandler((msg, metadata) =>
    messageHandlers.handleDefaultMessage(msg, metadata)
  );

  // Log status antrian dimulai
  botLogger.info(
    `Message queue system initialized with capacity for ${messageQueue.maxQueueSize.toLocaleString()} messages`
  );
  botLogger.info(
    `Processing up to ${messageQueue.maxConcurrentProcessing} messages concurrently`
  );
}

// Perbarui fungsi updateBotAdminStatus untuk menggunakan fullGroupSync
async function updateBotAdminStatus(socket) {
  try {
    if (!socket || !socket.user) {
      botLogger.warn('Tidak dapat mengupdate status admin: Socket tidak tersedia');
      return;
    }
    
    botLogger.info('Memulai update status admin bot di semua grup...');
    
    // Gunakan fullGroupSync untuk memastikan semua grup tersinkronisasi dengan baik
    const syncResult = await fullGroupSync(socket);
    
    // Update botInfo jika bot bergabung ke grup baru
    const botInfo = await db.getCurrentBotInfo();
    if (syncResult.addedCount > 0 || syncResult.updatedCount > 0) {
      const updatedGroups = await db.readDatabase().then(data => data.groups || []);
      const adminGroups = updatedGroups.filter(g => g.bot_is_admin === 1).length;
      
      await db.updateBotInfo({
        total_group: updatedGroups.length,
        admin_group: adminGroups,
        updated_at: new Date().toISOString()
      });
      
      botLogger.info(`Info bot diperbarui: total grup=${updatedGroups.length}, grup sebagai admin=${adminGroups}`);
    }
    
    return { success: true, message: 'Status admin bot berhasil diperbarui' };
  } catch (error) {
    botLogger.error(`Error saat mengupdate status admin bot: ${error.message}`, error);
    return { success: false, message: error.message };
  }
}

// Tambahkan fungsi ini bersama fungsi updateBotAdminStatus
async function handleGroupNotification(socket, msg, sender, isGroup, groupId) {
  if (!isGroup || !groupId) return;
  
  try {
    // Cek apakah pesan adalah notifikasi grup
    if (msg.messageStubType) {
      const notifType = msg.messageStubType;
      botLogger.info(`Menerima notifikasi grup ${groupId}: tipe=${notifType}`);
      
      // Ambil data grup saat ini
      const dbData = await db.readDatabase();
      const groupData = dbData.groups?.find(g => g.group_id === groupId);
      
      if (!groupData) {
        botLogger.warn(`Grup ${groupId} tidak ditemukan di database, mencoba sinkronisasi`);
        await fullGroupSync(socket);
        return;
      }
      
      // Perbarui metadata grup untuk perubahan yang umum terjadi
      if ([
        MessageType.GROUP_CHANGE, 
        MessageType.GROUP_CHANGE_SUBJECT,
        MessageType.GROUP_CHANGE_ICON,
        MessageType.GROUP_CHANGE_INVITE_LINK,
        MessageType.GROUP_CHANGE_DESCRIPTION,
        MessageType.GROUP_PARTICIPANT_ADD,
        MessageType.GROUP_PARTICIPANT_REMOVE,
        MessageType.GROUP_PARTICIPANT_PROMOTE,
        MessageType.GROUP_PARTICIPANT_DEMOTE
      ].includes(notifType)) {
        botLogger.info(`Perubahan grup terdeteksi di ${groupId}, memperbarui metadata...`);
        
        try {
          // Ambil metadata grup terbaru
          const metadata = await socket.groupMetadata(groupId);
          
          // Siapkan data yang akan diperbarui
          const updateData = {
            updated_at: new Date().toISOString()
          };
          
          // Update nama grup jika berubah
          if (metadata.subject && metadata.subject !== groupData.group_name) {
            updateData.group_name = metadata.subject;
            botLogger.info(`Nama grup berubah: ${groupData.group_name} -> ${metadata.subject}`);
          }
          
          // Update jumlah anggota
          updateData.total_members = metadata.participants.length;
          
          // Update deskripsi jika berubah
          if (metadata.desc && metadata.desc !== groupData.description) {
            updateData.description = metadata.desc;
            botLogger.info(`Deskripsi grup diperbarui`);
          }
          
          // Update status admin bot
          const botId = socket.user.id;
          const isBotAdmin = metadata.participants.some(
            p => p.id === botId && (p.admin === 'admin' || p.admin === 'superadmin')
          );
          
          if (groupData.bot_is_admin !== (isBotAdmin ? 1 : 0)) {
            updateData.bot_is_admin = isBotAdmin ? 1 : 0;
            botLogger.info(`Status admin bot berubah: ${groupData.bot_is_admin} -> ${isBotAdmin ? 1 : 0}`);
          }
          
          // Update owner jika berubah
          if (metadata.owner && metadata.owner !== groupData.owner_id) {
            updateData.owner_id = metadata.owner;
            botLogger.info(`Owner grup berubah: ${groupData.owner_id} -> ${metadata.owner}`);
          }
          
          // Pastikan welcome_message dan goodbye_message ada
          if (groupData.welcome_message === undefined) {
            updateData.welcome_message = 1; // Aktifkan welcome message secara default
            botLogger.info(`Setting welcome_message=1 untuk grup ${groupId} karena tidak ada dalam database`);
          }
          
          if (groupData.goodbye_message === undefined) {
            updateData.goodbye_message = 1; // Aktifkan goodbye message secara default
            botLogger.info(`Setting goodbye_message=1 untuk grup ${groupId} karena tidak ada dalam database`);
          }
          
          // Perbarui data grup
          const result = await db.updateGroup(groupId, updateData);
          if (result.success) {
            botLogger.info(`Grup ${groupId} berhasil diperbarui setelah perubahan`);
            // Perbarui cache
            groupCache.set(groupId, metadata);
          } else {
            botLogger.error(`Gagal memperbarui grup ${groupId} setelah perubahan: ${result.message}`);
          }
          
          // Jika bot menjadi admin atau bukan admin lagi, update botInfo
          if (groupData.bot_is_admin !== (isBotAdmin ? 1 : 0)) {
            const allGroups = dbData.groups || [];
            const adminGroups = allGroups.filter(g => g.bot_is_admin === 1).length + (isBotAdmin ? 1 : -1);
            
            await db.updateBotInfo({
              admin_group: adminGroups,
              updated_at: new Date().toISOString()
            });
            
            botLogger.info(`Info bot diperbarui: grup sebagai admin=${adminGroups}`);
          }
          
          // Handle welcome and goodbye messages
          const { handleGroupJoin, handleGroupLeave } = require('./src/lib/welcomeNgoodbyemsg');
          
          // Tangani join/add
          if (notifType === MessageType.GROUP_PARTICIPANT_ADD && groupData.welcome_message === 1) {
            botLogger.info(`Menangani pesan welcome untuk anggota baru di grup ${groupId}`);
            try {
              // Panggil handleGroupJoin untuk menangani welcome message
              await handleGroupJoin(socket, msg);
            } catch (err) {
              botLogger.error(`Error saat menangani welcome message: ${err.message}`, err);
            }
          }
          
          // Tangani leave/remove
          if (notifType === MessageType.GROUP_PARTICIPANT_REMOVE && groupData.goodbye_message === 1) {
            botLogger.info(`Menangani pesan goodbye untuk anggota yang keluar dari grup ${groupId}`);
            try {
              // Panggil handleGroupLeave untuk menangani goodbye message
              await handleGroupLeave(socket, msg);
            } catch (err) {
              botLogger.error(`Error saat menangani goodbye message: ${err.message}`, err);
            }
          }
        } catch (error) {
          botLogger.error(`Error memperbarui metadata grup ${groupId}: ${error.message}`, error);
        }
      }
    }
  } catch (error) {
    botLogger.error(`Error menangani notifikasi grup ${groupId}: ${error.message}`, error);
  }
}

// Tambahkan fungsi ini bersama fungsi updateBotAdminStatus
async function fullGroupSync(socket) {
  try {
    if (!socket || !socket.user) {
      botLogger.warn('Tidak dapat melakukan sinkronisasi grup: Socket tidak tersedia');
      return;
    }
    
    botLogger.info('Memulai sinkronisasi penuh grup...');
    
    // 1. Ambil semua grup di mana bot adalah anggota
    const participatingGroups = await socket.groupFetchAllParticipating();
    if (!participatingGroups || Object.keys(participatingGroups).length === 0) {
      botLogger.info('Tidak ada grup yang diikuti oleh bot');
      return;
    }
    
    // 2. Ambil data dari database
    const dbData = await db.readDatabase();
    let groupsInDb = dbData.groups || [];
    if (!Array.isArray(groupsInDb)) groupsInDb = [];
    
    botLogger.info(`Bot mengikuti ${Object.keys(participatingGroups).length} grup, ${groupsInDb.length} grup di database`);
    
    // 3. Sinkronisasi setiap grup yang ada di WhatsApp API
    let addedCount = 0;
    let updatedCount = 0;
    const botId = socket.user.id;
    
    botLogger.info(`ID Bot untuk pengecekan admin: ${botId}`);
    
    for (const [groupId, metadata] of Object.entries(participatingGroups)) {
      try {
        // Debug informasi admin
        const admins = metadata.participants
          .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
          .map(p => ({ id: p.id, admin: p.admin }));
        
        botLogger.info(`Grup ${groupId} (${metadata.subject}) memiliki ${admins.length} admin: ${JSON.stringify(admins)}`);
        
        // Cari grup di database
        let existingGroup = groupsInDb.find(g => g.group_id === groupId);
        
        // Identifikasi apakah bot adalah admin dengan logging lebih detail
        let isBotAdmin = false;
        for (const participant of metadata.participants) {
          if (participant.id === botId && (participant.admin === 'admin' || participant.admin === 'superadmin')) {
            isBotAdmin = true;
            botLogger.info(`Bot terdeteksi sebagai admin di grup ${groupId} - ID: ${participant.id}, Role: ${participant.admin}`);
            break;
          }
        }
        
        if (!isBotAdmin) {
          botLogger.info(`Bot BUKAN admin di grup ${groupId} - ID Bot: ${botId}`);
        }
        
        // Identifikasi owner
        const ownerJid = metadata.owner || 
                         metadata.participants.find(p => p.admin === 'superadmin')?.id || 
                         metadata.participants[0]?.id;
        
        // Jika grup tidak ada di database, tambahkan
        if (!existingGroup) {
          botLogger.info(`Menambahkan grup baru: ${metadata.subject} (${groupId}), bot admin: ${isBotAdmin}`);
          
          const result = await db.addGroup({
            group_id: groupId,
            group_name: metadata.subject || "Unnamed Group",
            owner_id: ownerJid,
            total_members: metadata.participants.length,
            description: metadata.desc || null,
            created_at: new Date().toISOString(),
            registration_date: new Date().toISOString(),
            bot_is_admin: isBotAdmin ? 1 : 0,
            welcome_message: 1, // Aktifkan welcome message secara default
            goodbye_message: 1, // Aktifkan goodbye message secara default
            level: 1,
            total_xp: 0,
            current_xp: 0,
            xp_to_next_level: 1000
          });
          
          if (result.success) {
            botLogger.info(`Grup baru ditambahkan: ${metadata.subject} (${groupId})`);
            addedCount++;
          } else {
            botLogger.error(`Gagal menambahkan grup: ${result.message}`);
          }
        } 
        // Jika grup sudah ada, perbarui data
        else {
          // Siapkan data yang akan diperbarui
          const updateData = {
            group_name: metadata.subject,
            total_members: metadata.participants.length,
            bot_is_admin: isBotAdmin ? 1 : 0,
            updated_at: new Date().toISOString()
          };
          
          // Perbaharui status admin
          if (existingGroup.bot_is_admin !== (isBotAdmin ? 1 : 0)) {
            botLogger.info(`Memperbarui status admin bot untuk grup ${groupId}: ${existingGroup.bot_is_admin} -> ${isBotAdmin ? 1 : 0}`);
          }
          
          // Tambahkan deskripsi jika ada
          if (metadata.desc) {
            updateData.description = metadata.desc;
          }
          
          // Tambahkan owner jika ada
          if (ownerJid) {
            updateData.owner_id = ownerJid;
          }
          
          // Pastikan welcome_message dan goodbye_message ada dan valid
          if (existingGroup.welcome_message === undefined) {
            updateData.welcome_message = 1; // Aktifkan welcome message secara default
            botLogger.info(`Setting welcome_message=1 untuk grup ${groupId} karena tidak ada dalam database`);
          }
          
          if (existingGroup.goodbye_message === undefined) {
            updateData.goodbye_message = 1; // Aktifkan goodbye message secara default 
            botLogger.info(`Setting goodbye_message=1 untuk grup ${groupId} karena tidak ada dalam database`);
          }
          
          // Perbarui data grup
          const result = await db.updateGroup(groupId, updateData);
          if (result.success) {
            updatedCount++;
            botLogger.info(`Grup ${groupId} diperbarui dengan data: ${JSON.stringify(updateData)}`);
          } else {
            botLogger.error(`Gagal memperbarui grup ${groupId}: ${result.message}`);
          }
        }
        
        // Perbarui cache
        groupCache.set(groupId, metadata);
        
      } catch (error) {
        botLogger.error(`Error saat sinkronisasi grup ${groupId}: ${error.message}`, error);
      }
    }
    
    // 4. Cek apakah ada grup di database yang sudah tidak diikuti oleh bot
    const notExistingGroups = groupsInDb.filter(dbGroup => 
      !Object.keys(participatingGroups).includes(dbGroup.group_id)
    );
    
    botLogger.info(`Ditemukan ${notExistingGroups.length} grup di database yang mungkin sudah tidak diikuti bot`);
    
    // Verifikasi grup-grup tersebut
    let removedCount = 0;
    for (const group of notExistingGroups) {
      try {
        // Coba ambil metadata untuk memverifikasi keberadaan grup
        try {
          await promiseWithTimeout(socket.groupMetadata(group.group_id), 5000);
          // Grup masih ada dan bot masih anggota, jangan lakukan apa-apa
        } catch (error) {
          // Grup tidak ada atau bot bukan anggota, update status
          botLogger.info(`Bot tidak lagi menjadi anggota grup ${group.group_id}`);
          // Opsional: tandai grup sebagai tidak aktif atau hapus dari database
          // await db.updateGroup(group.group_id, { is_active: 0 });
          removedCount++;
        }
      } catch (error) {
        botLogger.error(`Error memeriksa grup tidak aktif ${group.group_id}: ${error.message}`);
      }
    }
    
    botLogger.info(`Sinkronisasi selesai: ${addedCount} grup ditambahkan, ${updatedCount} grup diperbarui, ${removedCount} grup tidak aktif`);
    return { addedCount, updatedCount, removedCount };
    
  } catch (error) {
    botLogger.error(`Error saat melakukan sinkronisasi penuh grup: ${error.message}`, error);
    throw error;
  }
}

function makeHandleGroupMessage(sock) {
  return async (msg, sender, isGroup, groupId) => {
    try {
      // Handle notifikasi grup
      if (msg.messageStubType) {
        await handleGroupNotification(sock, msg, sender, isGroup, groupId);
      }
      
      // Sisanya adalah proses pesan normal
      // ... existing code ...
    } catch (error) {
      botLogger.error(`Error saat menangani pesan grup: ${error.message}`, error);
    }
  };
}