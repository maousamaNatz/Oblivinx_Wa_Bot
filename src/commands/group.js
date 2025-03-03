// src/commands/groupInfo.js
const { getGroupAdminInfo, normalizeJid } = require("../handler/permission"); // Impor normalizeJid

global.Oblixn.cmd({
  name: "groupinfo",
  alias: ["infogroup", "groupstats"],
  desc: "Menampilkan informasi grup termasuk jumlah admin",
  category: "group",
  async exec(msg, { args }) {
    if (!msg.isGroup) return await msg.reply("Perintah ini hanya bisa digunakan di grup!");

    try {
      const groupInfo = msg.groupInfo || await getGroupAdminInfo(msg.sock, msg.chat);
      
      const response = [
        `📊 *Informasi Grup*`,
        `Nama: ${msg.groupMetadata.subject}`,
        `Total Member: ${groupInfo.totalParticipants}`,
        `Total Admin: ${groupInfo.totalAdmins}`,
        `Bot Admin: ${groupInfo.isBotAdmin ? "✅ Ya" : "❌ Tidak"}`,
        `Admin List:`,
        ...groupInfo.adminList.map((admin, i) => 
          `${i + 1}. ${normalizeJid(admin.id).split('@')[0]} (${admin.admin})`
        )
      ].join("\n");

      await msg.reply(response);
    } catch (error) {
      await msg.reply("Gagal mendapatkan informasi grup: " + error.message);
    }
  }
});

// Command checkadmin
global.Oblixn.cmd({
  name: "checkadmin",
  alias: ["amadmin", "adminsaya"],
  desc: "Memeriksa apakah pengguna adalah admin",
  category: "group",
  async exec(msg, { args }) {
    if (!msg.isGroup) return await msg.reply("Perintah ini hanya bisa digunakan di grup!");

    const target = args[0] ? `${args[0]}@s.whatsapp.net` : msg.sender;
    const groupInfo = msg.groupInfo || await getGroupAdminInfo(msg.sock, msg.chat);
    
    const normalizedTarget = normalizeJid(target);
    const isAdmin = groupInfo.adminList.some(admin => normalizeJid(admin.id) === normalizedTarget);
    const targetNumber = normalizedTarget.split('@')[0];
    
    const response = isAdmin
      ? `✅ @${targetNumber} adalah admin di grup ini`
      : `❌ @${targetNumber} bukan admin di grup ini`;
    
    await msg.reply(response, { mentions: [target] });
  }
});

// ... command lainnya ...