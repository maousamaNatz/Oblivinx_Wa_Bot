const { botLogger } = require("../utils/logger");

// Fungsi untuk menangani pesan grup
async function handleGroupMessage(sock, msg) {
  try {
    // Tambahkan validasi properti key, sender, dan chat jika tidak ada
    if (msg.recv && msg.recv.attrs) {
      msg.key = {
        id: msg.recv.attrs.id,
        participant: msg.recv.attrs.participant,
        remoteJid: msg.recv.attrs.from
      };
      if (!msg.sender) {
        msg.sender = msg.recv.attrs.participant ? msg.recv.attrs.participant : msg.recv.attrs.from;
      }
      if (!msg.chat) {
        msg.chat = msg.recv.attrs.from;
      }
    }

    // Ekstrak teks pesan jika properti messageText tidak tersedia
    if (!msg.messageText) {
      msg.messageText = (msg.message && (msg.message.conversation || (msg.message.extendedTextMessage && msg.message.extendedTextMessage.text))) || "";
    }

    const { sender, messageText, chat } = msg;

    botLogger.info(`Menangani pesan grup dari ${sender}: "${messageText}"`);

    // Jika pesan dimulai dengan prefix, anggap sebagai command
    if (messageText.startsWith(process.env.PREFIX)) {
      const parsedCommand = commandHandler(messageText);
      if (parsedCommand) {
        const { command, args } = parsedCommand;
        botLogger.info(`Menjalankan command grup: ${command} dengan args: ${args.join(' ')}`);
        // Muat executeCommand secara dinamis untuk menghindari circular dependency
        const { executeCommand } = require("../../bot");
        executeCommand(sock, msg, sender, command, args);
        return;
      }
    }

    // Tambahkan logika lain untuk menangani pesan grup di sini jika diperlukan
  } catch (error) {
    botLogger.error(`Error menangani pesan grup: ${error.message}`);
  }
}

// Fungsi untuk mem-parsing command dari teks pesan
function commandHandler(text) {
  const pattern = /^[!\/\.](\w+)(?:\s+(.*))?$/i; // Format: !command args
  const match = text.match(pattern);

  if (match) {
    const command = match[1].toLowerCase();
    const args = match[2] ? match[2].trim().split(/\s+/) : [];
    return { command, args };
  }

  return null;
}

module.exports = {
  handleGroupMessage,
};