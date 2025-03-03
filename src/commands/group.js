// src/commands/groupInfo.js
const { getGroupAdminInfo } = require("../handler/permission");

global.Oblixn.cmd({
  name: "infoGrup",
  alias: ["statistikGrup", "infoG"],
  desc: "Menampilkan detail grup termasuk jumlah admin",
  category: "grup",
  async exec(msg, { args }) {
    if (!msg.isGroup) {
      return await msg.reply("Perintah ini hanya bisa digunakan di grup!");
    }

    try {
      const infoGrup = msg.groupInfo || await getGroupAdminInfo(msg.sock, msg.chat);
      
      const balasan = [
        `📊 *Detail Grup*`,
        `Nama: ${msg.groupMetadata.subject}`,
        `Jumlah Anggota: ${infoGrup.totalParticipants}`,
        `Jumlah Admin: ${infoGrup.totalAdmins}`,
        `Bot Admin: ${infoGrup.isBotAdmin ? "✅ Ya" : "❌ Tidak"}`,
        `Daftar Admin:`,
        ...infoGrup.adminList.map((admin, i) => 
          `${i + 1}. ${admin.id.split('@')[0]} (${admin.admin})`
        )
      ].join("\n");

      await msg.reply(balasan);
    } catch (error) {
      await msg.reply("Gagal mendapatkan detail grup: " + error.message);
    }
  }
});

// Command tambahan untuk memeriksa status admin
global.Oblixn.cmd({
  name: "cekAdmin",
  alias: ["apakahAdmin", "adminSaya"],
  desc: "Memeriksa apakah pengguna adalah admin",
  category: "grup",
  async exec(msg, { args }) {
    if (!msg.isGroup) {
      return await msg.reply("Perintah ini hanya bisa digunakan di grup!");
    }

    const target = args[0] ? `${args[0]}@s.whatsapp.net` : msg.sender;
    const infoGrup = msg.groupInfo || await getGroupAdminInfo(msg.sock, msg.chat);
    
    const isAdmin = infoGrup.adminList.some(admin => admin.id === target);
    const targetNumber = target.split('@')[0];
    
    const balasan = isAdmin
      ? `✅ @${targetNumber} adalah admin di grup ini`
      : `❌ @${targetNumber} bukan admin di grup ini`;
    
    await msg.reply(balasan, { mentions: [target] });
  }
});