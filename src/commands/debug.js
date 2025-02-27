const { botLogger } = require('../utils/logger');

// Perintah debug untuk mengirim pesan langsung
global.Oblixn.cmd({
  name: "debug",
  alias: ["debugsend"],
  desc: "Mengirim pesan debug langsung",
  category: "utility",
  exec: async (msg, { args }) => {
    try {
      botLogger.info("Menjalankan perintah debug");
      
      // Log informasi pesan
      botLogger.info(`Debug info - chat: ${msg.chat}, sender: ${msg.sender}, isGroup: ${msg.isGroup}`);
      
      // Kirim pesan langsung tanpa menggunakan reply
      await global.activeSocket.sendMessage(msg.chat, {
        text: "🔍 *Pesan Debug*\n\nIni adalah pesan debug yang dikirim langsung."
      });
      
      botLogger.info(`Berhasil mengirim pesan debug ke ${msg.chat}`);
      return true;
    } catch (error) {
      botLogger.error(`Error dalam perintah debug: ${error.message}`);
      console.error(error); // Tampilkan stack trace lengkap
      return false;
    }
  }
}); 