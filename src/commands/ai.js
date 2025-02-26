Oblixn.cmd({
  name: "ai",
  alias: ["ai"],
  desc: "🌤 Mendapatkan informasi cuaca untuk lokasi tertentu",
  category: "general",
  async exec(msg, { args, m }) {
    let text = args.join(" ") || (m.quoted && m.quoted.text);

    if (!text) {
      throw "Silakan berikan teks atau kutip pesan untuk mendapatkan respons.";
    }

    try {
      if (typeof msg.client?.sendPresenceUpdate === "function") {
        await msg.client.sendPresenceUpdate("composing", m.chat);
      }

      const prompt = encodeURIComponent(text);
      const endpoint = `https://ultimetron.guruapi.tech/gita?prompt=${prompt}`;

      const response = await fetch(endpoint);

      if (!response.ok) {
        throw `Gagal mendapatkan respons dari server (Status: ${response.status})`;
      }

      const data = await response.json();
      const result = data.completion || "Maaf, tidak ada respons yang tersedia.";

      m.reply(result);
    } catch (error) {
      console.error("Error:", error);
      throw "*ERROR: Terjadi kesalahan saat memproses permintaan.*";
    }
  }
});
