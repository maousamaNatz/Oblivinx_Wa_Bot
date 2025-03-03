const { botLogger } = require("../utils/logger");
const { config } = require("../../config/config");
const {
  banUser,
  pool,
  unbanUser,
  checkBanStatus,
  getListBannedUsers,
} = require("../../config/dbConf/database");
const { normalizeJid } = require("../handler/permission"); // Impor normalizeJid
const fs = require("fs");
const path = require("path");

// ... Command la
// Command: ownerinfo
global.Oblixn.cmd({
  name: "ownerinfo",
  alias: ["owner"],
  desc: "Menampilkan informasi owner bot",
  category: "info",
  async exec(msg) {
    try {
      if (!msg.sock) {
        botLogger.error("Socket tidak tersedia pada msg di ownerinfo");
        throw new Error("Socket tidak tersedia");
      }

      const senderNumber = msg.sender?.split("@")[0] || "unknown";
      const owner1 = process.env.OWNER_NUMBER_ONE || "Tidak tersedia";
      const owner2 = process.env.OWNER_NUMBER_TWO || "Tidak tersedia";

      const basicMessage =
        `*OWNER BOT CONTACT*\n\n` +
        `Silahkan hubungi owner jika ada keperluan penting!\n\n` +
        `*Owner 1*\n` +
        `• Nama: ${process.env.OWNER1_NAME || "Tidak diatur"}\n` +
        `• WA: wa.me/${owner1}\n\n` +
        `*Owner 2*\n` +
        `• Nama: ${process.env.OWNER2_NAME || "Tidak diatur"}\n` +
        `• WA: wa.me/${owner2}\n\n` +
        `_Note: Mohon chat owner jika ada keperluan penting saja_`;

      await msg.sock.sendMessage(
        msg.chat,
        { text: basicMessage },
        { quoted: msg }
      );
    } catch (error) {
      botLogger.error("Error in ownerinfo command:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
      await msg.reply("❌ Terjadi kesalahan pada sistem");
    }
  },
});

// Command: restart
global.Oblixn.cmd({
  name: "restart",
  desc: "Restart bot",
  category: "ownercommand",
  async exec(msg) {
    if (!global.Oblixn.isOwner(msg.sender)) {
      return await msg.reply("⚠️ Perintah ini hanya untuk owner bot!");
    }

    await msg.reply("🔄 Memulai ulang bot...");
    process.exit(1); // PM2 atau proses manager akan merestart bot
  },
});

// Command: shutdown
global.Oblixn.cmd({
  name: "shutdown",
  desc: "Matikan bot",
  category: "ownercommand",
  async exec(msg) {
    if (!global.Oblixn.isOwner(msg.sender)) {
      return await msg.reply("⚠️ Perintah ini hanya untuk owner bot!");
    }

    await msg.reply("⚠️ Mematikan bot...");
    process.exit(0); // Keluar tanpa restart
  },
});
global.Oblixn.cmd({
  name: "broadcast",
  alias: ["bc"],
  desc: "Broadcast pesan ke semua grup",
  category: "ownercommand",
  async exec(msg, { args }) {
    if (!global.Oblixn.isOwner(msg.sender)) {
      return await msg.reply("⚠️ Perintah ini hanya untuk owner bot!");
    }

    if (!msg.sock) {
      botLogger.error("Socket tidak tersedia pada msg di broadcast");
      return await msg.reply("❌ Socket tidak tersedia");
    }

    if (
      !args.length &&
      !msg.message.imageMessage &&
      !msg.message.extendedTextMessage?.contextInfo?.quotedMessage
    ) {
      return await msg.reply(
        `*Cara Penggunaan Broadcast:*\n` +
          `1️⃣ Teks: !bc [teks]\n` +
          `2️⃣ Reply Gambar: Reply gambar + !bc [caption]\n` +
          `3️⃣ Kirim Gambar: Kirim gambar + !bc [caption]\n` +
          `4️⃣ URL Gambar: !bc image [URL] [caption]`
      );
    }

    try {
      const senderNumber = normalizeJid(msg.sender);
      const mentionJid = `${senderNumber}@s.whatsapp.net`;
      const message = args.join(" ");
      const chats = await msg.sock.groupFetchAllParticipating();
      const chatIds = Object.keys(chats);

      await msg.reply(`🔄 Memulai broadcast ke ${chatIds.length} grup...`);

      let successCount = 0;
      let failCount = 0;

      const isImageUrl = message?.startsWith("image ");
      const isImageMessage = !!msg.message.imageMessage;
      const quotedMsg =
        msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
      const isReplyImage = !!quotedMsg?.imageMessage;

      async function broadcastMessage(chatId, content) {
        try {
          await msg.sock.sendMessage(chatId, content, { quoted: msg });
          successCount++;
          await new Promise((resolve) => setTimeout(resolve, 2000)); // Delay 2 detik
        } catch (error) {
          if (error.message === "rate-overlimit") {
            botLogger.warn(
              `Rate limit tercapai untuk ${chatId}, mencoba lagi setelah delay...`
            );
            await new Promise((resolve) => setTimeout(resolve, 5000)); // Tunggu 5 detik
            await msg.sock.sendMessage(chatId, content, { quoted: msg });
            successCount++;
          } else {
            failCount++;
            botLogger.error(`Broadcast error for ${chatId}:`, error);
          }
        }
      }

      if (isImageMessage) {
        const media = await msg.sock.downloadMediaMessage(msg);
        const caption = message || "";
        for (const chatId of chatIds) {
          await broadcastMessage(chatId, {
            image: media,
            caption: `*[BROADCAST DARI @${senderNumber}]*\n\n${caption}`,
            mentions: [mentionJid],
          });
        }
      } else if (isImageUrl) {
        const [_, url, ...caption] = message.split(" ");
        const captionText = caption.join(" ");
        for (const chatId of chatIds) {
          await broadcastMessage(chatId, {
            image: { url },
            caption: `*[BROADCAST DARI @${senderNumber}]*\n\n${captionText}`,
            mentions: [mentionJid],
          });
        }
      } else if (isReplyImage) {
        const media = await msg.sock.downloadMediaMessage({
          message: quotedMsg,
        });
        for (const chatId of chatIds) {
          await broadcastMessage(chatId, {
            image: media,
            caption: `*[BROADCAST DARI @${senderNumber}]*\n\n${message}`,
            mentions: [mentionJid],
          });
        }
      } else {
        for (const chatId of chatIds) {
          await broadcastMessage(chatId, {
            text: `*[BROADCAST DARI @${senderNumber}]*\n\n${message}`,
            mentions: [mentionJid],
          });
        }
      }

      const broadcastType = isImageMessage
        ? "Gambar (Kirim)"
        : isImageUrl
        ? "Gambar (URL)"
        : isReplyImage
        ? "Gambar (Reply)"
        : "Teks";
      await msg.reply(
        `✅ Broadcast selesai!\n\n` +
          `*Detail:*\n` +
          `📝 Tipe: ${broadcastType}\n` +
          `✅ Berhasil: ${successCount} grup\n` +
          `❌ Gagal: ${failCount} grup`
      );
    } catch (error) {
      botLogger.error("Error in broadcast command:", error);
      await msg.reply("❌ Terjadi kesalahan saat melakukan broadcast");
    }
  },
});

// ... Command lain tetap sama ...
// Command: ban
global.Oblixn.cmd({
  name: "ban",
  desc: "Ban user dari menggunakan bot",
  category: "ownercommand",
  async exec(msg, { args }) {
    if (!global.Oblixn.isOwner(msg.sender)) {
      return await msg.reply("⚠️ Perintah ini hanya untuk owner bot!");
    }

    if (!args[0]) {
      return await msg.reply(
        "❌ Gunakan: !ban [nomor] [alasan]\nContoh: !ban 6281234567890 Spamming"
      );
    }

    try {
      const number = args[0].replace(/[^0-9]/g, "");
      const userId = number.startsWith("0")
        ? `62${number.slice(1)}@s.whatsapp.net`
        : `${number}@s.whatsapp.net`;
      const reason = args.slice(1).join(" ") || "Tidak ada alasan";

      await banUser(userId, reason, msg.sender);
      await msg.reply(
        `✅ Berhasil ban user ${normalizeJid(userId)}\nAlasan: ${reason}`
      );
    } catch (error) {
      botLogger.error("Error in ban command:", error);
      await msg.reply("❌ Gagal ban user: " + error.message);
    }
  },
});

// Command: unban
global.Oblixn.cmd({
  name: "unban",
  desc: "Unban user yang dibanned",
  category: "ownercommand",
  async exec(msg, { args }) {
    if (!global.Oblixn.isOwner(msg.sender)) {
      return await msg.reply("⚠️ Perintah ini hanya untuk owner bot!");
    }

    if (!args[0]) {
      return await msg.reply(
        "❌ Gunakan: !unban [nomor]\nContoh: !unban 6281234567890"
      );
    }

    try {
      let number = args[0].replace(/[^0-9]/g, "");
      if (number.startsWith("0")) number = "62" + number.slice(1);
      else if (!number.startsWith("62")) number = "62" + number;

      const userId = `${number}@s.whatsapp.net`;
      const result = await unbanUser(userId);

      if (result) {
        await msg.reply(`✅ Berhasil unban user ${number}`);
      } else {
        await msg.reply(
          `❌ User ${number} tidak ditemukan dalam daftar banned`
        );
      }
    } catch (error) {
      botLogger.error("Error in unban command:", error);
      await msg.reply("❌ Gagal unban user: " + error.message);
    }
  },
});

// Command: listban
global.Oblixn.cmd({
  name: "listban",
  desc: "Menampilkan daftar user yang dibanned",
  category: "ownercommand",
  async exec(msg) {
    if (!global.Oblixn.isOwner(msg.sender)) {
      return await msg.reply("⚠️ Perintah ini hanya untuk owner bot!");
    }

    try {
      const bannedUsers = await getListBannedUsers();
      if (!bannedUsers || bannedUsers.length === 0) {
        return await msg.reply("📝 Tidak ada user yang dibanned saat ini");
      }

      let message = "*DAFTAR USER BANNED*\n\n";
      bannedUsers.forEach((user, index) => {
        message +=
          `${index + 1}. Nomor: ${normalizeJid(user.user_id)}\n` +
          `   Alasan: ${user.reason}\n` +
          `   Dibanned oleh: ${normalizeJid(user.banned_by)}\n` +
          `   Tanggal: ${new Date(user.banned_at).toLocaleString("id-ID")}\n\n`;
      });

      await msg.reply(message);
    } catch (error) {
      botLogger.error("Error in listban command:", error);
      await msg.reply("❌ Gagal mengambil daftar banned: " + error.message);
    }
  },
});

// Command: ownerhelp
global.Oblixn.cmd({
  name: "ownerhelp",
  alias: ["adminhelp"],
  desc: "Menampilkan daftar perintah khusus owner",
  category: "ownercommand",
  async exec(msg) {
    if (!global.Oblixn.isOwner(msg.sender)) {
      return await msg.reply("⚠️ Perintah ini hanya untuk owner bot!");
    }

    try {
      const ownerCommands = [
        {
          category: "🛠️ Bot Management",
          commands: [
            "!restart - Restart bot",
            "!shutdown - Matikan bot",
            "!broadcast - Broadcast pesan ke semua grup",
            "!boton - Aktifkan bot",
            "!botoff - Nonaktifkan bot",
          ],
        },
        {
          category: "👥 User Management",
          commands: [
            "!ban [nomor] [alasan] - Ban user",
            "!unban [nomor] - Unban user",
            "!listban - Daftar user yang dibanned",
          ],
        },
      ];

      let helpMessage = `*👑 OWNER COMMANDS 👑*\n\n`;
      ownerCommands.forEach((category) => {
        helpMessage += `*${category.category}:*\n`;
        category.commands.forEach((cmd) => (helpMessage += `• ${cmd}\n`));
        helpMessage += "\n";
      });
      helpMessage += `_Gunakan command dengan bijak!_`;

      await msg.reply(helpMessage);
    } catch (error) {
      botLogger.error("Error in ownerhelp command:", error);
      await msg.reply("❌ Terjadi kesalahan saat menampilkan menu owner");
    }
  },
});

// Command: boton
global.Oblixn.cmd({
  name: "boton",
  alias: ["turnon", "hidupkan"],
  desc: "Mengaktifkan bot",
  category: "ownercommand",
  async exec(msg) {
    if (!global.Oblixn.isOwner(msg.sender)) {
      return await msg.reply("⚠️ Perintah ini hanya untuk owner bot!");
    }

    try {
      const configPath = path.join(__dirname, "../../json/bot.json");
      let botConfig = {};

      if (fs.existsSync(configPath)) {
        botConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
      } else {
        botConfig = { bot: { status: true } };
      }

      botConfig.bot.status = true;
      fs.writeFileSync(configPath, JSON.stringify(botConfig, null, 2));
      global.botActive = true;

      await msg.reply(
        "✅ Bot telah diaktifkan\n_Bot sekarang dapat digunakan oleh semua user_"
      );
    } catch (error) {
      botLogger.error("Error in boton command:", error);
      await msg.reply("❌ Gagal mengaktifkan bot");
    }
  },
});

// Command: botoff
global.Oblixn.cmd({
  name: "botoff",
  alias: ["turnoff", "matikan"],
  desc: "Menonaktifkan bot",
  category: "ownercommand",
  async exec(msg) {
    if (!global.Oblixn.isOwner(msg.sender)) {
      return await msg.reply("⚠️ Perintah ini hanya untuk owner bot!");
    }

    try {
      const configPath = path.join(__dirname, "../../json/bot.json");
      let botConfig = {};

      if (fs.existsSync(configPath)) {
        botConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
      } else {
        botConfig = { bot: { status: false } };
      }

      botConfig.bot.status = false;
      fs.writeFileSync(configPath, JSON.stringify(botConfig, null, 2));
      global.botActive = false;

      await msg.reply(
        "✅ Bot telah dinonaktifkan\n_Bot hanya akan merespon perintah owner_"
      );
    } catch (error) {
      botLogger.error("Error in botoff command:", error);
      await msg.reply("❌ Gagal menonaktifkan bot");
    }
  },
});
