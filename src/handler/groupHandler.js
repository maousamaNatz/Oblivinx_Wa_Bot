// src/handler/groupHandler.js

const { botLogger } = require("../utils/logger");
const { checkUserStatus } = require("../../config/dbConf/database");
const { groupCache } = require("../../config/config");

async function handleGroupMessage(sock, msg) {
  try {
    const { sender, chat, messageText, pushName, reply } = msg;

    // Normalisasi userId untuk pengecekan status ban
    const userId = sender.split("@")[0];
    const normalizedUserId = userId.startsWith("08") ? "62" + userId.slice(1) : userId.replace("+62", "");

    // Cek status ban pengguna
    const { isBanned, banInfo } = await checkBanStatus(normalizedUserId);
    if (isBanned) {
      const banDate = new Date(banInfo.banned_at).toLocaleDateString("id-ID");
      const banMessage = `❌ *Akses Ditolak*\n\nMaaf, Anda telah dibanned dari menggunakan bot!\n\n*Detail Ban:*\n📝 Alasan: ${banInfo.reason}\n📅 Tanggal: ${banDate}\n\nSilakan hubungi owner untuk unbanned.`;
      await reply(banMessage);
      return;
    }

    // Ambil metadata grup dari cache atau langsung dari WhatsApp
    let groupMetadata = groupCache.get(chat);
    if (!groupMetadata) {
      try {
        groupMetadata = await sock.groupMetadata(chat);
        groupCache.set(chat, groupMetadata);
        botLogger.info("Metadata grup berhasil diambil.");
      } catch (error) {
        botLogger.error(`Error mendapatkan metadata grup: ${error.message}`);
        await reply("Terjadi kesalahan saat mengakses informasi grup.");
        return;
      }
    }

    // Log pesan grup
    const logMessage = {
      level: "info",
      message: `Pesan grup dari ${pushName} (${sender}) di ${groupMetadata.subject}`,
      details: {
        messageText: messageText,
        chatId: chat,
        userId: normalizedUserId,
      },
    };
    botLogger.info(JSON.stringify(logMessage));

    // Contoh logika khusus grup
    if (messageText.toLowerCase() === "hai bot") {
      await reply(`Hai ${pushName}! Saya bot di grup ${groupMetadata.subject}. Ada yang bisa saya bantu?`);
      return;
    }

    // Logika untuk admin grup
    const isAdmin = groupMetadata.participants.some(p => p.id === sender && (p.admin === "admin" || p.admin === "superadmin"));
    if (isAdmin) {
      botLogger.info(`Admin terdeteksi: ${sender} di grup ${groupMetadata.subject}`);
      if (messageText.toLowerCase() === "!info") {
        const totalMembers = groupMetadata.participants.length;
        const admins = groupMetadata.participants.filter(p => p.admin).map(p => p.id.split("@")[0]);
        const infoMessage = `📋 *Info Grup*\n\nNama: ${groupMetadata.subject}\nID: ${chat}\nTotal Anggota: ${totalMembers}\nAdmin: ${admins.join(", ")}\nDibuat: ${new Date(groupMetadata.creation * 1000).toLocaleString("id-ID")}`;
        await reply(infoMessage);
        return;
      }
    }

    // Contoh pesan selamat datang atau perpisahan (opsional, bisa diaktifkan berdasarkan event)
    if (msg.key.participant && msg.messageStubType) {
      const action = msg.messageStubType === "GROUP_PARTICIPANT_ADD" ? "bergabung" : "keluar";
      await reply(`@${userId} telah ${action} dari grup ${groupMetadata.subject}!`);
      return;
    }

  } catch (error) {
    const errorLog = {
      level: "error",
      message: `Error di handleGroupMessage`,
      error: error.message,
      stack: error.stack,
    };
    botLogger.error(JSON.stringify(errorLog));
    await msg.reply("Terjadi kesalahan saat memproses pesan grup. Silakan coba lagi nanti.");
  }
}

// Fungsi untuk memeriksa status ban (dipisah agar reusable)
async function checkBanStatus(userId) {
  try {
    const status = await checkUserStatus(userId);
    botLogger.info(`Memeriksa status ban untuk user: ${userId}`);
    return {
      isBanned: status.isBanned,
      banInfo: status.isBanned
        ? {
            reason: status.reason || "Tidak ada alasan spesifik",
            banned_at: status.banned_at || new Date(),
          }
        : null,
    };
  } catch (error) {
    botLogger.error(`Error memeriksa status ban: ${error.message}`);
    return { isBanned: false, banInfo: null };
  }
}

module.exports = {
  handleGroupMessage,
};