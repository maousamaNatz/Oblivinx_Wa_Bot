const { botLogger } = require('../utils/logger');
const { PREFIX, commands } = require('../../config/config');
const { handleGroupMessage } = require('../handler/groupHandler');
const { handleGroupJoin, handleGroupLeave } = require('../lib/welcomeNgoodbyemsg');

/**
 * Menangani pesan yang masuk baik dari pribadi maupun grup.
 * @param {object} client - Instance client baileys.
 * @param {object} message - Objek pesan WhatsApp yang telah ditingkatkan.
 */
async function handleMessage(client, message) {
  try {
    // Log untuk debugging
    botLogger.debug(`Menangani pesan: ${JSON.stringify(message, null, 2)}`);
    
    const sender = message.sender;
    const chat = message.chat;
    
    // Ekstrak teks pesan
    const messageText = message.message?.conversation || 
                        message.message?.extendedTextMessage?.text || 
                        message.message?.imageMessage?.caption || 
                        message.message?.buttonsResponseMessage?.selectedButtonId ||
                        message.message?.listResponseMessage?.singleSelectReply?.selectedRowId || 
                        "";
    
    // Log untuk debugging dengan detail lebih kompleks
    botLogger.info(`Pesan diterima dari: ${sender} di chat: ${chat}`);
    botLogger.info(`Isi pesan: "${messageText.substring(0, 50)}${messageText.length > 50 ? '...' : ''}"`);
    botLogger.info(`Detail pesan: ${JSON.stringify(message.message, null, 2)}`);
    
    // Jika pesan berasal dari grup
    if (message.isGroup) {
      // Cek apakah ini adalah event grup (join/leave)
      if (message.messageStubType) {
        switch (message.messageStubType) {
          case 27: // GROUP_PARTICIPANT_LEAVE
            await handleGroupLeave(client, message);
            return;
          case 28: // GROUP_PARTICIPANT_ADD
            await handleGroupJoin(client, message);
            return;
          default:
            // Lanjutkan dengan handleGroupMessage untuk event grup lainnya
            break;
        }
      }
      
      // Jika pesan dimulai dengan PREFIX, ini adalah perintah
      if (messageText.startsWith(PREFIX)) {
        botLogger.info(`Pesan grup dimulai dengan ${PREFIX}, mungkin perintah`);
        const args = messageText.slice(PREFIX.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();
        
        if (commands.has(command)) {
          botLogger.info(`Perintah ${command} dikenali, mengeksekusi`);
          try {
            await commands.get(command).execute(client, message, args);
          } catch (error) {
            botLogger.error(`Gagal mengeksekusi perintah ${command}: ${error.message}`);
            await message.reply(`Terjadi kesalahan saat menjalankan perintah ${command}`);
          }
          return;
        }
      }
      
      // Jika bukan perintah yang dikenali, tangani sebagai pesan grup biasa
      botLogger.info(`Memanggil handleGroupMessage untuk chat: ${chat}`);
      await handleGroupMessage(client, message);
      return;
    }
    
    // Jika pesan kosong, keluar
    if (!messageText) {
      botLogger.debug('Pesan kosong, dilewati');
      return;
    }
    
    // Parsing perintah untuk pesan pribadi
    const args = messageText.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    
    // Cek apakah pesan dimulai dengan prefix
    if (messageText.startsWith(PREFIX)) {
      botLogger.info(`Pesan pribadi dimulai dengan ${PREFIX}, mungkin perintah`);
      
      // Cek apakah perintah ada dalam daftar
      if (commands.has(command)) {
        botLogger.info(`Perintah ${command} dikenali, mengeksekusi`);
        try {
          await commands.get(command).execute(client, message, args);
        } catch (error) {
          botLogger.error(`Gagal mengeksekusi perintah ${command}: ${error.message}`);
          await message.reply(`Terjadi kesalahan saat menjalankan perintah ${command}`);
        }
      } else {
        botLogger.info(`Perintah ${command} tidak dikenali`);
        await message.reply(`Perintah ${command} tidak dikenali, ketik ${PREFIX}help untuk melihat daftar perintah.`);
      }
    } else {
      // Tangani pesan biasa (non-perintah)
      botLogger.info(`Pesan biasa dari ${sender}: ${messageText.substring(0, 30)}${messageText.length > 30 ? '...' : ''}`);
      
      // Di sini Anda bisa menambahkan logika untuk menanggapi pesan biasa
      if (messageText.toLowerCase().includes('hai') || messageText.toLowerCase().includes('halo')) {
        await message.reply(`Hai ${message.pushName || 'kak'}! Ada yang bisa saya bantu? Ketik ${PREFIX}help untuk melihat daftar perintah.`);
      }
    }
  } catch (error) {
    botLogger.error(`Error di handleMessage: ${error.message}`, error);
    try {
      await message.reply('Terjadi kesalahan saat memproses pesan Anda.');
    } catch (replyError) {
      botLogger.error(`Tidak dapat mengirim pesan error: ${replyError.message}`);
    }
  }
}

/**
 * Fungsi untuk unban user
 * @param {string} userId - ID pengguna yang akan di-unban
 * @param {string} unbannedBy - ID admin yang melakukan unban
 * @returns {Promise<boolean>} - true jika berhasil, false jika gagal
 */
async function unbanUser(userId, unbannedBy) {
  try {
    const cleanUserId = userId.split("@")[0];
    const [result] = await pool.execute(
      `UPDATE banned_users SET 
       is_banned = 0, 
       unbanned_by = ?, 
       unbanned_at = CURRENT_TIMESTAMP
       WHERE user_id = ? AND is_banned = 1`,
      [unbannedBy, cleanUserId]
    );
    return result.affectedRows > 0;
  } catch (error) {
    console.error(`Error in unbanUser: ${error.message}`);
    return false;
  }
}

// Export fungsi-fungsi
module.exports = {
  handleMessage,
  unbanUser
};