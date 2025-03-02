const conversations = {};
const axios = require("axios");
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
  if (
    !text &&
    message.message?.extendedTextMessage?.contextInfo?.quotedMessage
  ) {
    const quoted =
      message.message.extendedTextMessage.contextInfo.quotedMessage;
    if (quoted.conversation) {
      text = quoted.conversation;
    } else if (quoted.extendedTextMessage?.text) {
      text = quoted.extendedTextMessage.text;
    }
  }
  if (message.message?.buttonsResponseMessage?.selectedButtonId) {
    text = message.message.buttonsResponseMessage.selectedButtonId;
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
      console.log(
        "Debug - client type:",
        typeof client,
        client ? Object.keys(client) : "null"
      );

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
        if (typeof msg === "object" && msg.key && msg.key.remoteJid) {
          sender = msg.key.remoteJid;
        } else if (typeof msg === "object" && msg.sender) {
          sender = msg.sender;
        }
      }

      console.log("Sender final:", sender);

      // Periksa apakah command adalah 'start-ai'
      const command = commandArgs[0];

      if (command === "start-ai") {
        console.log("Memulai sesi AI dengan pengguna:", sender);

        // Gunakan client.reply karena tersedia di client
        if (client && typeof client.reply === "function") {
          await client.reply("Sesi AI dimulai. Silakan ketik pesan Anda.");
          console.log("Pesan balasan terkirim menggunakan client.reply");
        } else {
          console.error("Tidak ada metode pengiriman pesan yang tersedia");
        }
        return;
      } else if (commandArgs.length > 0) {
        // Jika bukan 'start-ai', anggap sebagai prompt untuk AI
        const prompt = commandArgs.join(" ");
        console.log("Mengirim prompt ke API:", prompt);

        try {
          // Kirim prompt ke API GuruSensei
          const apiUrl = `https://api.gurusensei.workers.dev/llama?prompt=${encodeURIComponent(
            prompt
          )}`;
          console.log("API URL:", apiUrl);

          const response = await axios.get(apiUrl);
          console.log("API response status:", response.status);

          // Dapatkan respons dari API
          const aiResponse = response.data;
          console.log("AI response:", aiResponse);

          // Proses respons agar mengeluarkan pesan yang sesuai
          let responseMessage = "";
          if (
            aiResponse &&
            aiResponse.response &&
            aiResponse.response.response
          ) {
            responseMessage = aiResponse.response.response;
          } else if (aiResponse && aiResponse.text) {
            responseMessage = aiResponse.text;
          } else {
            responseMessage = "Tidak ada respons AI yang diterima.";
          }

          // Kirim respons ke pengguna
          if (client && typeof client.reply === "function") {
            await client.reply(responseMessage);
            console.log(
              "Respons AI terkirim menggunakan client.reply:",
              responseMessage
            );
          } else {
            console.error("client.reply tidak tersedia");
          }
        } catch (apiError) {
          console.error("Error saat memanggil API:", apiError.message);

          // Kirim pesan error ke pengguna
          if (client && typeof client.reply === "function") {
            await client.reply("Maaf, terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi nanti.");
          }
        }
      } else {
        // Jika tidak ada command yang valid
        console.log("Perintah tidak dikenali atau kosong");

        // Gunakan client.reply karena tersedia di client
        if (client && typeof client.reply === "function") {
          await client.reply(
            "Perintah tidak dikenali. Gunakan *start-ai* untuk memulai atau ketik pesan untuk bertanya ke AI."
          );
          console.log("Pesan balasan terkirim menggunakan client.reply");
        } else {
          console.error("client.reply tidak tersedia");
        }
      }
    } catch (error) {
      console.error("Error details:", {
        messageObj: msg,
        clientProps: client ? Object.keys(client) : "null",
        errorStack: error.stack,
      });

      // Kirim pesan error ke pengguna
      if (client && typeof client.reply === "function") {
        await client.reply(
          "Maaf, terjadi kesalahan dalam sistem. Silakan coba lagi nanti."
        );
      }

      throw error;
    }
  },
});
global.Oblixn.cmd({
  name: "gemini",
  alias: ["g", "gemini"],
  desc: "Chat dengan AI; aktifkan dengan ketik '!gemini start-gemini'. Setelah aktif, balas pesan untuk melanjutkan percakapan.",
  category: "Ai",
  async exec(client, msg, args) {
    try {
      // Periksa apakah instance geminiAI sudah ada dalam global state
      if (!global.geminiAI) {
        // Inisialisasi GeminiAI instance jika belum ada
        const GeminiAI = require("../lib/gemini"); // Path ke file GeminiAI
        global.geminiAI = new GeminiAI();
        await global.geminiAI.init(); // Pastikan AI diinisialisasi dengan benar
        console.log("GeminiAI instance telah dibuat dan diinisialisasi");
      }

      const commandArgs = args || (msg && msg.args ? msg.args : []);
      console.log("Command args:", commandArgs);

      // Periksa apakah ini adalah command untuk memulai atau melanjutkan percakapan
      if (commandArgs[0] === "start-gemini") {
        // Simpan status aktif dalam session user atau global state
        if (!global.activeGeminiSessions) {
          global.activeGeminiSessions = new Map();
        }

        // Dapatkan ID pengirim pesan untuk tracking session
        const senderId = msg.sender || msg.from || "unknown";
        global.activeGeminiSessions.set(senderId, {
          active: true,
          lastInteraction: Date.now(),
          conversationId: Date.now().toString(),
        });

        await client.reply(
          msg,
          "Gemini AI telah diaktifkan. Silakan kirim pesan untuk memulai percakapan."
        );
        console.log(`Gemini AI diaktifkan untuk user ${senderId}`);
      } else {
        // Gabungkan semua args menjadi pesan user
        const userMessage = commandArgs.join(" ");

        if (!userMessage || userMessage.trim() === "") {
          await client.reply(
            msg,
            "Silakan kirim pesan untuk berinteraksi dengan Gemini AI."
          );
          return;
        }

        console.log(`Menerima pesan dari user: "${userMessage}"`);

        // Tampilkan indikator typing/sedang mengetik jika fitur tersedia
        if (
          client.sendPresenceUpdate &&
          typeof client.sendPresenceUpdate === "function"
        ) {
          await client.sendPresenceUpdate("composing", msg.from);
        }

        try {
          // Proses pesan dengan GeminiAI
          const responseMessage = await global.geminiAI.chatWithGemini(
            userMessage
          );

          // Kirim balasan
          await client.reply(msg, responseMessage);
          console.log(
            "Respons AI terkirim:",
            responseMessage.substring(0, 100) +
              (responseMessage.length > 100 ? "..." : "")
          );

          // Update timestamp interaksi terakhir jika tracking session aktif
          const senderId = msg.sender || msg.from || "unknown";
          if (
            global.activeGeminiSessions &&
            global.activeGeminiSessions.has(senderId)
          ) {
            const session = global.activeGeminiSessions.get(senderId);
            session.lastInteraction = Date.now();
            global.activeGeminiSessions.set(senderId, session);
          }

          // Reset presence status jika fitur tersedia
          if (
            client.sendPresenceUpdate &&
            typeof client.sendPresenceUpdate === "function"
          ) {
            await client.sendPresenceUpdate("available", msg.from);
          }
        } catch (aiError) {
          console.error("Error saat berkomunikasi dengan GeminiAI:", aiError);
          await client.reply(
            msg,
            "Maaf, terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi nanti."
          );

          // Reset presence status jika fitur tersedia
          if (
            client.sendPresenceUpdate &&
            typeof client.sendPresenceUpdate === "function"
          ) {
            await client.sendPresenceUpdate("available", msg.from);
          }
        }
      }
    } catch (error) {
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        messageObj: msg
          ? {
              from: msg.from,
              type: msg.type,
              body: msg.body,
              hasOwnArgs: Boolean(msg.args),
            }
          : "null",
        clientMethods: client
          ? Object.keys(client).filter((k) => typeof client[k] === "function")
          : "null",
      });

      // Pastikan client ada dan memiliki method reply
      if (client && typeof client.reply === "function") {
        try {
          await client.reply(
            msg,
            "Maaf, terjadi kesalahan dalam sistem. Silakan coba lagi nanti."
          );
        } catch (replyError) {
          console.error("Gagal mengirim pesan error:", replyError);
        }
      }
    }
  },
});

// Command tambahan untuk mematikan sesi Gemini
global.Oblixn.cmd({
  name: "gemini-stop",
  alias: ["g-stop", "stop-gemini"],
  desc: "Hentikan sesi chat dengan Gemini AI",
  category: "Ai",
  async exec(client, msg, args) {
    try {
      const senderId = msg.sender || msg.from || "unknown";

      if (
        global.activeGeminiSessions &&
        global.activeGeminiSessions.has(senderId)
      ) {
        global.activeGeminiSessions.delete(senderId);
        await client.reply(msg, "Sesi Gemini AI telah dinonaktifkan.");
        console.log(`Gemini AI dinonaktifkan untuk user ${senderId}`);
      } else {
        await client.reply(
          msg,
          "Anda tidak memiliki sesi Gemini AI yang aktif."
        );
      }
    } catch (error) {
      console.error("Error saat menghentikan sesi Gemini:", error);
      if (client && typeof client.reply === "function") {
        await client.reply(
          msg,
          "Maaf, terjadi kesalahan saat menghentikan sesi. Silakan coba lagi nanti."
        );
      }
    }
  },
});

// Command untuk melihat info dan status GeminiAI
global.Oblixn.cmd({
  name: "gemini-info",
  alias: ["g-info"],
  desc: "Lihat informasi dan status Gemini AI",
  category: "Ai",
  async exec(client, msg, args) {
    try {
      if (!global.geminiAI) {
        await client.reply(
          msg,
          "GeminiAI belum diinisialisasi. Gunakan '!gemini start-gemini' untuk memulai."
        );
        return;
      }

      // Hitung jumlah sesi aktif
      const activeSessions = global.activeGeminiSessions
        ? global.activeGeminiSessions.size
        : 0;

      // Dapatkan info dari GeminiAI instance
      const infoString = [
        "*Status Gemini AI*",
        `- Status: ${global.geminiAI ? "Aktif" : "Tidak Aktif"}`,
        `- Sesi Aktif: ${activeSessions}`,
        `- Features Terkumpul: ${global.geminiAI.geminiInfo.features.length}`,
        `- Capabilities Terkumpul: ${global.geminiAI.geminiInfo.capabilities.length}`,
        `- FAQ Terkumpul: ${global.geminiAI.geminiInfo.faq.length}`,
        `- Jumlah Permintaan: ${global.geminiAI.context.sessionData.requestCount}`,
        `- Terakhir Digunakan: ${
          global.geminiAI.context.sessionData.lastRequestTime
            ? new Date(
                global.geminiAI.context.sessionData.lastRequestTime
              ).toLocaleString()
            : "Belum digunakan"
        }`,
      ].join("\n");

      await client.reply(msg, infoString);
    } catch (error) {
      console.error("Error saat menampilkan info Gemini:", error);
      if (client && typeof client.reply === "function") {
        await client.reply(
          msg,
          "Maaf, terjadi kesalahan saat mengambil informasi. Silakan coba lagi nanti."
        );
      }
    }
  },
});
