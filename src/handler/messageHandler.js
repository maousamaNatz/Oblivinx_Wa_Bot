const { botLogger } = require('../utils/logger');
const { PREFIX, commands } = require('../../config/config');
const { handleGroupMessage } = require('../handler/groupHandler');

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
    
    // Jika pesan kosong, keluar
    if (!messageText) {
      botLogger.debug('Pesan kosong, dilewati');
      return;
    }
    
    // Jika pesan berasal dari grup, gunakan handleGroupMessage
    if (message.isGroup) {
      botLogger.info(`Pesan berasal dari grup, memanggil handleGroupMessage untuk chat: ${chat}`);
      await handleGroupMessage(client, message);
      return;
    }
    
    // Parsing perintah
    const args = messageText.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    
    botLogger.info(`Menjalankan perintah: ${command} dengan argumen: ${args.join(', ')}`);
    
    // Cari perintah yang cocok
    let foundCommand = false;
    
    // Cek di commands dari config
    for (const cmd of commands) {
      const pattern = new RegExp(cmd.config.pattern);
      if (pattern.test(command)) {
        botLogger.info(`Menemukan perintah yang cocok: ${command}`);
        try {
          await cmd.handler(client, message, args);
          foundCommand = true;
          botLogger.info(`Perintah ${command} berhasil dijalankan.`);
          break;
        } catch (error) {
          botLogger.error(`Error menjalankan perintah ${command}: ${error.message}`);
          await message.reply(`Terjadi kesalahan saat menjalankan perintah: ${error.message}`);
        }
      }
    }
    
    // Cek di global.Oblixn.commands jika tidak ditemukan di commands
    if (!foundCommand && global.Oblixn && global.Oblixn.commands) {
      if (global.Oblixn.commands.has(command)) {
        botLogger.info(`Menemukan perintah di Oblixn: ${command}`);
        const cmd = global.Oblixn.commands.get(command);
        try {
          await cmd.exec(message, { args });
          foundCommand = true;
          botLogger.info(`Perintah Oblixn ${command} berhasil dijalankan.`);
        } catch (error) {
          botLogger.error(`Error menjalankan perintah Oblixn ${command}: ${error.message}`);
          await message.reply(`Terjadi kesalahan saat menjalankan perintah: ${error.message}`);
        }
      } else {
        // Cek alias
        for (const [cmdName, cmdObj] of global.Oblixn.commands.entries()) {
          if (cmdObj.alias && cmdObj.alias.includes(command)) {
            botLogger.info(`Menemukan alias untuk perintah ${cmdName}: ${command}`);
            try {
              await cmdObj.exec(message, { args });
              foundCommand = true;
              botLogger.info(`Perintah alias ${cmdName} berhasil dijalankan.`);
              break;
            } catch (error) {
              botLogger.error(`Error menjalankan perintah alias ${command}: ${error.message}`);
              await message.reply(`Terjadi kesalahan saat menjalankan perintah: ${error.message}`);
            }
          }
        }
      }
    }
    
    // Jika perintah tidak ditemukan
    if (!foundCommand) {
      botLogger.warn(`Perintah tidak ditemukan: ${command}`);
      await message.reply(`Maaf, perintah *${command}* tidak ditemukan. Gunakan ${PREFIX}help untuk melihat daftar perintah.`);
    }
    
  } catch (error) {
    botLogger.error(`Error dalam handleMessage: ${error.message}`);
    console.error(error); // Tampilkan stack trace lengkap
    
    // Coba kirim pesan error ke pengirim
    try {
      await message.reply('Terjadi kesalahan saat memproses pesan Anda. Silakan coba lagi nanti.');
    } catch (replyError) {
      botLogger.error(`Gagal mengirim pesan error: ${replyError.message}`);
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