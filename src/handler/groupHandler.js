const { botLogger, executeCommand } = require("../utils/logger");

// Fungsi untuk menangani pesan grup
async function handleGroupMessage(sock, msg) {
  try {
    // Guard clause for undefined msg
    if (!sock) {
      botLogger.error("Socket object is undefined");
      return;
    }
    
    if (!msg) {
      botLogger.error("Message object is undefined in handleGroupMessage", { 
        sockExists: !!sock,
        sockUser: sock?.user?.id || "unknown"
      });
      return;
    }

    msg.isGroup = true;
    // Normalisasi properti pesan dengan nilai default yang lebih konsisten
    msg.key = msg.key || {};
    msg.key.from = msg.key.from || msg.key.remoteJid || "unknown"; // Gunakan 'from' sebagai standar
    msg.key.participant = msg.key.participant || "unknown";
    
    // Normalisasi chat dan sender
    msg.chat = msg.chat || msg.key.from || "unknown";
    msg.sender = msg.sender || msg.key.participant || msg.key.from || "unknown";
    msg.isGroup = msg.isGroup !== undefined ? msg.isGroup : msg.chat.endsWith("@g.us");

    // Normalisasi jika recv.attrs ada (opsional, tergantung library)
    if (msg.recv?.attrs) {
      msg.key = {
        id: msg.recv.attrs.id || msg.key.id,
        participant: msg.recv.attrs.participant || msg.recv.attrs.from || msg.key.participant,
        from: msg.recv.attrs.from || msg.key.from, // Konsisten dengan 'from'
      };
      msg.chat = msg.chat || msg.key.from;
      msg.sender = msg.sender || msg.key.participant;
    }

    // Ekstrak teks pesan dengan fallback
    msg.messageText = msg.messageText || 
      msg.message?.conversation || 
      msg.message?.extendedTextMessage?.text || 
      msg.message?.imageMessage?.caption || 
      msg.message?.videoMessage?.caption || "";

    const { sender, messageText, chat, isGroup } = msg;
    // Pastikan pesan berasal dari grup
    if (!isGroup) {
      botLogger.debug("Pesan bukan dari grup, dilewati.", { chat, sender });
      return;
    }

    // Proses command jika diawali prefix
    if (messageText && messageText.startsWith(process.env.PREFIX)) {
      const parsedCommand = commandHandler(messageText);
      botLogger.debug(`Hasil parser command: ${JSON.stringify(parsedCommand)}`, { messageText });

      if (parsedCommand) {
        const { command, args } = parsedCommand;
        botLogger.info(`Menjalankan command grup: ${command} dengan args: ${args.join(" ")}`, { command, args });

        // Muat executeCommand dari bot.js
        if (typeof executeCommand !== "function") {
          throw new Error("executeCommand bukan fungsi, periksa bot.js");
        }
        await executeCommand(sock, msg, sender, command, args);
      } else {
        botLogger.warn("Command tidak terparsing dengan benar.", { messageText });
      }
    } else {
      botLogger.debug("Pesan tidak diawali prefix, melewati perintah.", { messageText });
    }
  } catch (error) {
    botLogger.error(`Error menangani pesan grup: ${error.message}`, { 
      error, 
      msgExists: !!msg,
      stackTrace: error.stack // Menambahkan stack trace untuk membantu debugging
    });
  }
}

// Fungsi untuk mem-parsing command dari teks pesan
function commandHandler(text) {
  if (!text) return null;
  
  const pattern = /^[!\/\.](\w+)(?:\s+(.*))?$/i; // Format: !command args
  const match = text.match(pattern);

  if (match) {
    const command = match[1].toLowerCase();
    const args = match[2]?.trim().split(/\s+/) || [];
    return { command, args };
  }
  return null;
}

// Fungsi untuk mendapatkan metadata grup
async function getGroupMetadata(sock, chatId) {
  try {
    if (!sock) {
      botLogger.error("Socket object is undefined in getGroupMetadata");
      return null;
    }
    
    if (!chatId) {
      botLogger.error("ChatId is undefined in getGroupMetadata", { 
        sockExists: !!sock,
        sockUser: sock?.user?.id || "unknown" 
      });
      return null;
    }
    
    const groupMetadata = await sock.groupMetadata(chatId);
    return groupMetadata;
  } catch (error) {
    botLogger.error(`Error mendapatkan metadata grup: ${error.message}`, { 
      chatId, 
      error,
      sockExists: !!sock,
      sockUser: sock?.user?.id || "unknown",
      stackTrace: error.stack // Menambahkan stack trace untuk membantu debugging
    });
    return null;
  }
}

// Fungsi untuk memeriksa status grup dan admin
async function checkGroupAndAdmin(sock, msg) {
  try {
    // Add more detailed logging about function call
    botLogger.debug("checkGroupAndAdmin called", { 
      sockExists: !!sock,
      sockUser: sock?.user?.id || "unknown",
      msgExists: !!msg,
      msgKey: msg?.key ? JSON.stringify(msg.key) : "undefined",
      callStack: new Error().stack
    });
    
    // Guard clause - check if sock is defined
    if (!sock) {
      botLogger.error("Socket object is undefined in checkGroupAndAdmin");
      return { isGroup: false, isAdmin: false, isBotAdmin: false, groupMetadata: null };
    }

    // Guard clause - check if msg is defined
    if (!msg) {
      botLogger.error("Message object is undefined in checkGroupAndAdmin", { 
        sockExists: !!sock,
        sockUser: sock?.user?.id || "unknown",
        callStack: new Error().stack // Added callstack to identify where it's called from
      });
      return { isGroup: false, isAdmin: false, isBotAdmin: false, groupMetadata: null };
    }

    // Guard clause - check if msg.chat is defined
    if (!msg.chat) {
      // Try to initialize chat from msg.key if available
      if (msg.key?.remoteJid) {
        msg.chat = msg.key.remoteJid;
        botLogger.debug("Recovered chat from remoteJid", { chat: msg.chat });
      } else {
        botLogger.error("Message chat is undefined and couldn't be recovered", { 
          msg: JSON.stringify(msg),
          msgKey: msg.key ? JSON.stringify(msg.key) : "undefined"
        });
        return { isGroup: false, isAdmin: false, isBotAdmin: false, groupMetadata: null };
      }
    }

    botLogger.info(`Memeriksa status grup dan admin untuk ${msg.chat}`, { msg });
    
    const isGroup = msg.chat.endsWith("@g.us");
    if (!isGroup) {
      return { isGroup: false, isAdmin: false, isBotAdmin: false, groupMetadata: null };
    }

    const groupMetadata = await getGroupMetadata(sock, msg.chat);
    if (!groupMetadata) {
      botLogger.error("Gagal mendapatkan metadata grup.", { chatId: msg.chat });
      return { isGroup: true, isAdmin: false, isBotAdmin: false, groupMetadata: null };
    }

    const participants = groupMetadata.participants || [];
    const sender = msg.sender || msg.key?.participant || "unknown";
    const botId = sock?.user?.id || "unknown";

    const isAdmin = participants.some(p => 
      p.id === sender && (p.admin === "admin" || p.admin === "superadmin")
    );
    const isBotAdmin = participants.some(p => 
      p.id === botId && (p.admin === "admin" || p.admin === "superadmin")
    );

    botLogger.info(`Status admin untuk ${sender}: isAdmin=${isAdmin}, isBotAdmin=${isBotAdmin}`, { participants });
    
    return { isGroup: true, isAdmin, isBotAdmin, groupMetadata };
  } catch (error) {
    botLogger.error(`Error memeriksa status grup dan admin: ${error.message}`, { 
      error, 
      msgExists: !!msg,
      sockExists: !!sock,
      stackTrace: error.stack // Menambahkan stack trace untuk membantu debugging
    });
    return { isGroup: msg?.isGroup || false, isAdmin: false, isBotAdmin: false, groupMetadata: null };
  }
}

const normalizeNumber = (num) => {
  let normalized = num.trim().replace(/\D/g, "");
  return normalized.startsWith("08")
    ? "62" + normalized.slice(1)
    : normalized.startsWith("62")
    ? normalized
    : "62" + normalized;
};

module.exports = {
  handleGroupMessage,
  checkGroupAndAdmin,
  getGroupMetadata,
  normalizeNumber,
};