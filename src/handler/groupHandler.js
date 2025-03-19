const { botLogger } = require("../utils/logger");
const db = require("../../database/confLowDb/lowdb"); // Impor dari lowdb.js yang menggunakan AJV
const { groupCache } = require("../../config/config");
const { createWelcomeText, createGoodbyeText } = require("../lib/welcomeNgoodbyemsg");
const path = require("path");
const fileManager = require("../../config/memoryAsync/readfile");

// Objek untuk melacak pesan error yang sudah dikirim
const errorSentTracker = new Map();

async function handleGroupMessage(sock, msg) {
  let chat; // Definisikan chat di luar try agar tersedia di catch
  try {
    const { sender, chat: chatId, messageText, pushName, reply } = msg;
    chat = chatId; // Simpan chatId ke variabel chat untuk digunakan di catch

    // Normalisasi userId untuk pengecekan status ban
    const userId = sender.split("@")[0];
    const normalizedUserId = userId.startsWith("08")
      ? "62" + userId.slice(1)
      : userId.replace("+62", "62");

    // Cek status ban pengguna menggunakan fungsi dari lowdb.js
    const status = await db.checkUserStatus(normalizedUserId);
    if (status.isBanned) {
      const banDate = new Date().toLocaleDateString("id-ID"); // Gunakan tanggal saat ini jika tidak ada data ban spesifik
      const banMessage = `❌ *Akses Ditolak*\n\nMaaf, Anda telah dibanned dari menggunakan bot!\n\n*Detail Ban:*\n📝 Alasan: ${
        status.banReason || "Tidak diketahui"
      }\n📅 Tanggal: ${banDate}\n\nSilakan hubungi owner untuk unbanned.`;
      await reply(banMessage);
      return;
    }

    // Ambil metadata grup dari cache atau langsung dari WhatsApp
    let groupMetadata = groupCache.get(chat);
    if (!groupMetadata) {
      try {
        groupMetadata = await sock.groupMetadata(chat);
        if (
          !groupMetadata ||
          !groupMetadata.participants ||
          !Array.isArray(groupMetadata.participants)
        ) {
          throw new Error("Metadata grup tidak lengkap atau tidak tersedia.");
        }
        groupCache.set(chat, groupMetadata);
        botLogger.info("Metadata grup berhasil diambil:", {
          subject: groupMetadata.subject,
          participantsCount: groupMetadata.participants.length,
        });
      } catch (error) {
        botLogger.error(`Error mendapatkan metadata grup: ${error.message}`, {
          chat,
          errorStack: error.stack,
        });
        const lastSent = errorSentTracker.get(chat);
        if (!lastSent || Date.now() - lastSent > 5 * 60 * 1000) {
          // 5 menit cooldown
          await reply(
            "Terjadi kesalahan saat mengakses informasi grup. Silakan coba lagi nanti."
          );
          errorSentTracker.set(chat, Date.now());
        }
        return;
      }
    }

    // Validasi groupMetadata sebelum digunakan
    if (!groupMetadata || !Array.isArray(groupMetadata.participants)) {
      botLogger.error("Group metadata tidak valid:", {
        groupMetadata: groupMetadata ? groupMetadata : "undefined",
        hasParticipants:
          groupMetadata && Array.isArray(groupMetadata.participants)
            ? groupMetadata.participants.length > 0
            : false,
        isArray: Array.isArray(groupMetadata?.participants),
      });
      const lastSent = errorSentTracker.get(chat);
      if (!lastSent || Date.now() - lastSent > 5 * 60 * 1000) {
        // 5 menit cooldown
        await reply("Data grup tidak valid. Silakan coba lagi nanti.");
        errorSentTracker.set(chat, Date.now());
      }
      return;
    }

    // Reset tracker jika metadata valid
    errorSentTracker.delete(chat);

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
      await reply(
        `Hai ${pushName}! Saya bot di grup ${groupMetadata.subject}. Ada yang bisa saya bantu?`
      );
      return;
    }

    // Logika untuk admin grup
    const isAdmin = groupMetadata.participants.some(
      (p) =>
        p.id === sender && (p.admin === "admin" || p.admin === "superadmin")
    );
    if (isAdmin) {
      botLogger.info(
        `Admin terdeteksi: ${sender} di grup ${groupMetadata.subject}`
      );
      if (messageText.toLowerCase() === "!info") {
        const totalMembers = groupMetadata.participants.length;
        const admins = groupMetadata.participants
          .filter((p) => p.admin)
          .map((p) => p.id.split("@")[0]);
        const infoMessage = `📋 *Info Grup*\n\nNama: ${
          groupMetadata.subject
        }\nID: ${chat}\nTotal Anggota: ${totalMembers}\nAdmin: ${admins.join(
          ", "
        )}\nDibuat: ${new Date(groupMetadata.creation * 1000).toLocaleString(
          "id-ID"
        )}`;
        await reply(infoMessage);
        return;
      }
    }

    // Handle welcome dan goodbye message
    if (msg.key.participant && msg.messageStubType) {
      const group = await db.getGroup(chat);
      if (!group) return;

      const isWelcomeEnabled = group.welcome_message === 1;
      if (!isWelcomeEnabled) return;

      const action = msg.messageStubType === 28 ? "welcome" : "goodbye"; // 28 = GROUP_PARTICIPANT_ADD
      const backgroundPath = path.join(__dirname, '../assets/background.png');

      try {
        // Cek keberadaan file background
        const backgroundExists = await fileManager.fileExists(backgroundPath);
        if (!backgroundExists) {
          throw new Error('File background tidak ditemukan');
        }

        let imagePath;
        if (action === "welcome") {
          imagePath = await createWelcomeText(backgroundPath);
        } else {
          imagePath = await createGoodbyeText(backgroundPath);
        }

        if (!imagePath) {
          throw new Error(`Gagal membuat gambar ${action}`);
        }

        // Cek keberadaan file gambar yang dibuat
        const imageExists = await fileManager.fileExists(imagePath);
        if (!imageExists) {
          throw new Error('File gambar tidak ditemukan');
        }

        // Kirim gambar dengan caption
        const caption = action === "welcome" 
          ? `Selamat datang @${userId} di ${groupMetadata.subject}! 🌸`
          : `Selamat tinggal @${userId} dari ${groupMetadata.subject}! 👋`;

        await sock.sendMessage(chat, {
          image: await fileManager.readFile(imagePath),
          caption: caption,
          mentions: [sender]
        });

        // Hapus file gambar setelah dikirim
        await fileManager.deleteFile(imagePath);
      } catch (error) {
        botLogger.error(`Error creating ${action} message:`, error);
        // Fallback ke pesan teks jika gagal membuat gambar
        await reply(
          `@${userId} telah ${action === "welcome" ? "bergabung" : "keluar"} dari grup ${groupMetadata.subject}!`
        );
      }
      return;
    }
  } catch (error) {
    const errorLog = {
      level: "error",
      message: "Terjadi kesalahan di handleGroupMessage",
      error: error.message,
      stack: error.stack,
      chat: chat || "tidak terdefinisi",
    };
    botLogger.error(JSON.stringify(errorLog));
    if (chat) {
      const lastSent = errorSentTracker.get(chat);
      if (!lastSent || Date.now() - lastSent > 5 * 60 * 1000) {
        // 5 menit cooldown
        await msg.reply(
          "Terjadi kesalahan saat memproses pesan grup. Silakan coba lagi nanti."
        );
        errorSentTracker.set(chat, Date.now());
      }
    } else {
      botLogger.warn(
        "Chat tidak terdefinisi dalam blok catch, skipping reply."
      );
    }
  }
}

async function checkBanStatus(userId) {
  try {
    const status = await db.checkUserStatus(userId); // Gunakan fungsi dari lowdb.js
    botLogger.info(`Memeriksa status ban untuk user: ${userId}`);
    return {
      isBanned: status.isBanned,
      banInfo: status.isBanned
        ? {
            reason: status.banReason || "Tidak ada alasan spesifik",
            banned_at: status.created_at || new Date(), // Gunakan created_at dari database jika ada
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