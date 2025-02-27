const conversations = {};
const axios = require('axios');

/**
 * Mendapatkan teks pesan dari objek message Baileys.
 * Jika pesan kosong dan merupakan reply, maka akan mencoba mengambil teks dari pesan yang direply.
 * @param {object} message - Objek pesan WhatsApp.
 * @returns {string} Teks pesan.
 */
function getMessageText(message) {
    let text = "";
    if (message.message?.conversation) {
        text = message.message.conversation;
    } else if (message.message?.extendedTextMessage?.text) {
        text = message.message.extendedTextMessage.text;
    }
    // Jika pesan tidak berisi teks dan merupakan reply, ambil teks dari pesan yang direply.
    if (!text && message.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
        const quoted = message.message.extendedTextMessage.contextInfo.quotedMessage;
        if (quoted.conversation) {
            text = quoted.conversation;
        } else if (quoted.extendedTextMessage?.text) {
            text = quoted.extendedTextMessage.text;
        }
    }
    return text;
}

global.Oblixn.cmd({
  name: "ai",
  alias: ["a", "ai"],
  desc: "Chat dengan AI; aktifkan dengan ketik '!ai start-ai'. Setelah aktif, balas pesan untuk melanjutkan percakapan.",
  category: "Ai",
  async exec(client, msg, args) {
      try {
          console.log("Debug - msg object:", JSON.stringify(msg, null, 2));
          console.log("Debug - client type:", typeof client, client ? Object.keys(client) : 'null');
          
          // Gunakan args dari msg jika args parameter undefined
          const commandArgs = args || (msg && msg.args ? msg.args : []);
          console.log("Command args:", commandArgs);
          
          // Dapatkan nomor pengirim dari berbagai sumber yang mungkin
          let sender = null;
          
          // Coba dapatkan dari client.from (berdasarkan log, client memiliki properti 'from')
          if (client && client.from) {
              sender = client.from;
              console.log("Menggunakan sender dari client.from:", sender);
          } 
          // Coba dapatkan dari client.sender
          else if (client && client.sender) {
              sender = client.sender;
              console.log("Menggunakan sender dari client.sender:", sender);
          }
          // Coba dapatkan dari msg
          else if (msg) {
              if (typeof msg === 'object' && msg.key && msg.key.remoteJid) {
                  sender = msg.key.remoteJid;
              } else if (typeof msg === 'object' && msg.sender) {
                  sender = msg.sender;
              }
          }
          
          
          console.log("Sender final:", sender);
          
          // Periksa apakah command adalah 'start-ai'
          const command = commandArgs[0];
          
          if (command === 'start-ai') {
              console.log("Memulai sesi AI dengan pengguna:", sender);
              
              // Gunakan client.reply karena tersedia di client
              if (client && typeof client.reply === 'function') {
                  await client.reply('Sesi AI dimulai. Silakan ketik pesan Anda.');
                  console.log("Pesan balasan terkirim menggunakan client.reply");
              } else {
                  console.error("Tidak ada metode pengiriman pesan yang tersedia");
              }
              return;
          } else if (commandArgs.length > 0) {
              // Jika bukan 'start-ai', anggap sebagai prompt untuk AI
              const prompt = commandArgs.join(' ');
              console.log("Mengirim prompt ke API:", prompt);
              
              try {
                  // Kirim prompt ke API GuruSensei
                  const apiUrl = `https://api.gurusensei.workers.dev/llama?prompt=${encodeURIComponent(prompt)}`;
                  console.log("API URL:", apiUrl);
                  
                  const response = await axios.get(apiUrl);
                  console.log("API response status:", response.status);
                  
                  // Dapatkan respons dari API
                  const aiResponse = response.data;
                  console.log("AI response:", aiResponse);
                  
                  // Proses respons agar mengeluarkan pesan yang sesuai
                  let responseMessage = "";
                  if (aiResponse && aiResponse.response && aiResponse.response.response) {
                      responseMessage = aiResponse.response.response;
                  } else if (aiResponse && aiResponse.text) {
                      responseMessage = aiResponse.text;
                  } else {
                      responseMessage = "Tidak ada respons AI yang diterima.";
                  }
                  
                  // Kirim respons ke pengguna
                  if (client && typeof client.reply === 'function') {
                      await client.reply(responseMessage);
                      console.log("Respons AI terkirim menggunakan client.reply:", responseMessage);
                  } else {
                      console.error("client.reply tidak tersedia");
                  }
              } catch (apiError) {
                  console.error("Error saat memanggil API:", apiError.message);
                  
                  // Kirim pesan error ke pengguna
                  if (client && typeof client.reply === 'function') {
                      await client.reply('Maaf, terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi nanti.');
                  }
              }
          } else {
              // Jika tidak ada command yang valid
              console.log("Perintah tidak dikenali atau kosong");
              
              // Gunakan client.reply karena tersedia di client
              if (client && typeof client.reply === 'function') {
                  await client.reply('Perintah tidak dikenali. Gunakan *start-ai* untuk memulai atau ketik pesan untuk bertanya ke AI.');
                  console.log("Pesan balasan terkirim menggunakan client.reply");
              } else {
                  console.error("client.reply tidak tersedia");
              }
          }
          
      } catch (error) {
          console.error("Error details:", {
              messageObj: msg,
              clientProps: client ? Object.keys(client) : 'null',
              errorStack: error.stack
          });
          
          // Kirim pesan error ke pengguna
          if (client && typeof client.reply === 'function') {
              await client.reply('Maaf, terjadi kesalahan dalam sistem. Silakan coba lagi nanti.');
          }
          
          throw error;
      }
  }
});