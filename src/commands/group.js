const { botLogger } = require("../utils/logger");
const { PREFIX } = require("../../config/config");
const {
  checkGroupAndAdmin,
  getGroupMetadata,
  normalizeNumber,
} = require("../handler/groupHandler");

global.Oblixn.cmd({
  name: "add",
  alias: ["tambah", "invite"],
  desc: "Menambahkan anggota ke grup",
  category: "group",
  async exec(msg, { args }) {
    try {
      const { isGroup, isAdmin, isBotAdmin } = await checkGroupAndAdmin(msg);
      const groupMetadata = await getGroupMetadata(msg.chat);
      if (!isGroup || !isAdmin || !isBotAdmin) {
        if (isGroup && !isBotAdmin)
          await msg.reply("Bot harus menjadi admin untuk menambah anggota!");
        return;
      }

      if (!args.length) {
        return msg.reply(
          `Format salah. Gunakan: ${PREFIX}add nomor1,nomor2,...\nContoh: ${PREFIX}add 628123456789,628987654321`
        );
      }

      const numbers = args
        .join(" ")
        .split(",")
        .map((num) => `${normalizeNumber(num)}@s.whatsapp.net`);
      const validNumbers = numbers.filter(
        (n) => !groupMetadata.participants.some((p) => p.id === n)
      );

      if (!validNumbers.length) {
        return msg.reply("Semua nomor sudah ada di grup atau tidak valid!");
      }

      const response = await msg.sock.groupParticipantsUpdate(
        msg.chat,
        validNumbers,
        "add"
      );
      botLogger.info(`Add member result: ${JSON.stringify(response)}`);
      return msg.reply(
        `Berhasil mengundang ${validNumbers.length} anggota ke grup`
      );
    } catch (error) {
      botLogger.error(`Error in add command: ${error.message}`);
      return msg.reply(`Terjadi kesalahan: ${error.message}`);
    }
  },
});
global.Oblixn.cmd({
  name: "kick",
  alias: ["remove", "keluarkan"],
  desc: "Mengeluarkan anggota dari grup",
  category: "group",
  async exec(msg, { args }) {
    try {
      const { isGroup, isAdmin, isBotAdmin } = await checkGroupAndAdmin(msg);
      const groupMetadata = await getGroupMetadata(msg.chat);
      if (!isGroup || !isAdmin || !isBotAdmin) {
        if (isGroup && !isBotAdmin)
          await msg.reply(
            "Bot harus menjadi admin untuk mengeluarkan anggota!"
          );
        return;
      }

      let users = msg.mentions.length ? msg.mentions : [];
      if (
        !users.length &&
        msg.message?.extendedTextMessage?.contextInfo?.participant
      ) {
        users = [msg.message.extendedTextMessage.contextInfo.participant];
      }

      if (!users.length && args.length) {
        users = args.map((num) => `${normalizeNumber(num)}@s.whatsapp.net`);
      }

      if (!users.length) {
        return msg.reply(
          `Format salah. Gunakan: ${PREFIX}kick @user atau ${PREFIX}kick nomor`
        );
      }

      const validUsers = users.filter((u) =>
        groupMetadata.participants.some(
          (p) => p.id === u && p.id !== msg.botNumber
        )
      );

      if (!validUsers.length) {
        return msg.reply(
          "Tidak ada pengguna yang valid atau pengguna tidak ada di grup!"
        );
      }

      const response = await msg.sock.groupParticipantsUpdate(
        msg.chat,
        validUsers,
        "remove"
      );
      botLogger.info(`Kick member result: ${JSON.stringify(response)}`);
      return msg.reply(
        `Berhasil mengeluarkan ${validUsers.length} anggota dari grup`
      );
    } catch (error) {
      botLogger.error(`Error in kick command: ${error.message}`);
      return msg.reply(`Terjadi kesalahan: ${error.message}`);
    }
  },
});

global.Oblixn.cmd({
  name: "promote",
  alias: ["pm", "jadikanadmin"],
  desc: "Menjadikan anggota sebagai admin",
  category: "group",
  async exec(msg, { args }) {
    try {
      if (!msg.isGroup) {
        return msg.reply("Perintah ini hanya dapat digunakan di dalam grup!");
      }

      const { isGroup, isAdmin } = await checkGroupAndAdmin(msg);
      const groupMetadata = await getGroupMetadata(msg.chat);
      if (!isGroup || !isAdmin) return;

      // Get mentioned users or from arguments
      let users = msg.mentions.length > 0 ? msg.mentions : [];

      if (
        users.length === 0 &&
        msg.message?.extendedTextMessage?.contextInfo?.participant
      ) {
        users = [msg.message.extendedTextMessage.contextInfo.participant];
      }

      if (users.length === 0) {
        return msg.reply(`Format salah. Gunakan: ${PREFIX}promote @user`);
      }

      const response = await msg.sock.groupParticipantsUpdate(
        msg.chat,
        users,
        "promote"
      );

      botLogger.info(`Promote member result: ${JSON.stringify(response)}`);
      return msg.reply(
        `Berhasil menjadikan ${users.length} anggota sebagai admin`
      );
    } catch (error) {
      botLogger.error(`Error in promote command: ${error.message}`);
      return msg.reply(`Terjadi kesalahan: ${error.message}`);
    }
  },
});

global.Oblixn.cmd({
  name: "demote",
  alias: ["dm", "cabut"],
  desc: "Mencabut status admin dari anggota",
  category: "group",
  async exec(msg, { args }) {
    try {
      if (!msg.isGroup) {
        return msg.reply("Perintah ini hanya dapat digunakan di dalam grup!");
      }

      const { isGroup, isAdmin } = await checkGroupAndAdmin(msg);
      const groupMetadata = await getGroupMetadata(msg.chat);
      if (!isGroup || !isAdmin) return;

      // Get mentioned users or from arguments
      let users = msg.mentions.length > 0 ? msg.mentions : [];

      if (
        users.length === 0 &&
        msg.message?.extendedTextMessage?.contextInfo?.participant
      ) {
        users = [msg.message.extendedTextMessage.contextInfo.participant];
      }

      if (users.length === 0) {
        return msg.reply(`Format salah. Gunakan: ${PREFIX}demote @user`);
      }

      const response = await msg.sock.groupParticipantsUpdate(
        msg.chat,
        users,
        "demote"
      );

      botLogger.info(`Demote member result: ${JSON.stringify(response)}`);
      return msg.reply(
        `Berhasil mencabut status admin dari ${users.length} anggota`
      );
    } catch (error) {
      botLogger.error(`Error in demote command: ${error.message}`);
      return msg.reply(`Terjadi kesalahan: ${error.message}`);
    }
  },
});

global.Oblixn.cmd({
  name: "changesubject",
  alias: ["setname", "setsubject", "changetitle"],
  desc: "Mengubah nama grup",
  category: "group",
  async exec(msg, { args }) {
    try {
      if (!msg.isGroup) {
        return msg.reply("Perintah ini hanya dapat digunakan di dalam grup!");
      }

      const { isGroup, isAdmin } = await checkGroupAndAdmin(msg);
      if (!isGroup || !isAdmin) return;

      if (args.length === 0) {
        return msg.reply(
          `Format salah. Gunakan: ${PREFIX}changesubject Nama Grup Baru`
        );
      }

      const newSubject = args.join(" ");
      await msg.sock.groupUpdateSubject(msg.chat, newSubject);

      return msg.reply(`Nama grup berhasil diubah menjadi "${newSubject}"`);
    } catch (error) {
      botLogger.error(`Error in changesubject command: ${error.message}`);
      return msg.reply(`Terjadi kesalahan: ${error.message}`);
    }
  },
});

global.Oblixn.cmd({
  name: "changedesc",
  alias: ["setdesc", "setdescription"],
  desc: "Mengubah deskripsi grup",
  category: "group",
  async exec(msg, { args }) {
    try {
      if (!msg.isGroup) {
        return msg.reply("Perintah ini hanya dapat digunakan di dalam grup!");
      }

      const { isGroup, isAdmin } = await checkGroupAndAdmin(msg);
      if (!isGroup || !isAdmin) return;

      if (args.length === 0) {
        return msg.reply(
          `Format salah. Gunakan: ${PREFIX}changedesc Deskripsi Grup Baru`
        );
      }

      const newDesc = args.join(" ");
      await msg.sock.groupUpdateDescription(msg.chat, newDesc);

      return msg.reply(`Deskripsi grup berhasil diubah`);
    } catch (error) {
      botLogger.error(`Error in changedesc command: ${error.message}`);
      return msg.reply(`Terjadi kesalahan: ${error.message}`);
    }
  },
});

global.Oblixn.cmd({
  name: "groupsettings",
  alias: ["groupset", "grupset"],
  desc: "Mengubah pengaturan grup",
  category: "group",
  async exec(msg, { args }) {
    try {
      if (!msg.isGroup) {
        return msg.reply("Perintah ini hanya dapat digunakan di dalam grup!");
      }

      const { isGroup, isAdmin } = await checkGroupAndAdmin(msg);
      if (!isGroup || !isAdmin) return;

      if (args.length < 1) {
        return msg.reply(
          `Format salah. Gunakan:\n${PREFIX}groupsettings close - Hanya admin yang dapat mengirim pesan\n${PREFIX}groupsettings open - Semua anggota dapat mengirim pesan\n${PREFIX}groupsettings announce on/off - Mengaktifkan/menonaktifkan pengumuman`
        );
      }

      const action = args[0].toLowerCase();

      if (action === "close") {
        await msg.sock.groupSettingUpdate(msg.chat, "announcement");
        return msg.reply(
          "Grup telah diubah menjadi hanya admin yang dapat mengirim pesan"
        );
      }
      if (action === "open") {
        await msg.sock.groupSettingUpdate(msg.chat, "not_announcement");
        return msg.reply(
          "Grup telah diubah menjadi semua anggota dapat mengirim pesan"
        );
      }
      if (action === "announce") {
        if (args[1] === "on") {
          await msg.sock.groupSettingUpdate(msg.chat, "announcement");
          return msg.reply("Pengumuman grup diaktifkan");
        } else if (args[1] === "off") {
          await msg.sock.groupSettingUpdate(msg.chat, "not_announcement");
          return msg.reply("Pengumuman grup dinonaktifkan");
        }
      }

      return msg.reply(
        `Format salah. Gunakan:\n${PREFIX}groupsettings close - Hanya admin yang dapat mengirim pesan\n${PREFIX}groupsettings open - Semua anggota dapat mengirim pesan\n${PREFIX}groupsettings announce on/off - Mengaktifkan/menonaktifkan pengumuman`
      );
    } catch (error) {
      botLogger.error(`Error in groupsettings command: ${error.message}`);
      return msg.reply(`Terjadi kesalahan: ${error.message}`);
    }
  },
});

global.Oblixn.cmd({
  name: "listadmins",
  alias: ["admins", "adminlist"],
  desc: "Menampilkan daftar admin dalam grup",
  category: "group",
  async exec(msg, { args }) {
    try {
      if (!msg.isGroup) {
        return msg.reply("Perintah ini hanya dapat digunakan di dalam grup!");
      }

      const groupMetadata = await getGroupMetadata(msg.chat);
      const adminList = groupMetadata.participants
        .filter((p) => p.admin === "admin" || p.admin === "superadmin")
        .map((p) => p.id);

      if (adminList.length === 0) {
        return msg.reply("Tidak ada admin dalam grup ini");
      }

      let message = "🛡️ *DAFTAR ADMIN GRUP* 🛡️\n\n";
      for (let i = 0; i < adminList.length; i++) {
        const contact = adminList[i];
        const adminNum = contact.split("@")[0];
        message += `${i + 1}. @${adminNum}\n`;
      }

      await msg.sock.sendMessage(msg.chat, {
        text: message,
        mentions: adminList,
      });
    } catch (error) {
      botLogger.error(`Error in listadmins command: ${error.message}`);
      return msg.reply(`Terjadi kesalahan: ${error.message}`);
    }
  },
});

global.Oblixn.cmd({
  name: "grouplink",
  alias: ["getlink", "invitelink", "linkgrup"],
  desc: "Mendapatkan link invite grup",
  category: "group",
  async exec(msg, { args }) {
    try {
      if (!msg.isGroup) {
        return msg.reply("Perintah ini hanya dapat digunakan di dalam grup!");
      }

      const { isGroup, isAdmin } = await checkGroupAndAdmin(msg);
      if (!isGroup || !isAdmin) return;

      // Check if bot is admin
      const groupMetadata = await getGroupMetadata(msg.chat);
      const botId = msg.botNumber;
      const isBotAdmin = groupMetadata.participants.find(
        (p) =>
          p.id === botId && (p.admin === "admin" || p.admin === "superadmin")
      );

      if (!isBotAdmin) {
        return msg.reply(
          "Bot harus menjadi admin untuk mendapatkan link grup!"
        );
      }

      const inviteCode = await msg.sock.groupInviteCode(msg.chat);
      const groupName = groupMetadata.subject;

      return msg.reply(
        `🔗 *LINK GROUP*\n\n*${groupName}*\nhttps://chat.whatsapp.com/${inviteCode}`
      );
    } catch (error) {
      botLogger.error(`Error in grouplink command: ${error.message}`);
      return msg.reply(`Terjadi kesalahan: ${error.message}`);
    }
  },
});

global.Oblixn.cmd({
  name: "revoke",
  alias: ["resetlink", "resetgrouplink"],
  desc: "Mereset link grup",
  category: "group",
  async exec(msg, { args }) {
    try {
      if (!msg.isGroup) {
        return msg.reply("Perintah ini hanya dapat digunakan di dalam grup!");
      }

      const { isGroup, isAdmin } = await checkGroupAndAdmin(msg);
      if (!isGroup || !isAdmin) return;

      // Check if bot is admin
      const groupMetadata = await getGroupMetadata(msg.chat);
      const botId = msg.botNumber;
      const isBotAdmin = groupMetadata.participants.find(
        (p) =>
          p.id === botId && (p.admin === "admin" || p.admin === "superadmin")
      );

      if (!isBotAdmin) {
        return msg.reply("Bot harus menjadi admin untuk mereset link grup!");
      }

      await msg.sock.groupRevokeInvite(msg.chat);
      return msg.reply("🔄 Link grup berhasil direset!");
    } catch (error) {
      botLogger.error(`Error in revoke command: ${error.message}`);
      return msg.reply(`Terjadi kesalahan: ${error.message}`);
    }
  },
});

global.Oblixn.cmd({
  name: "groupinfo",
  alias: ["infogroup", "infogrup"],
  desc: "Menampilkan informasi grup",
  category: "group",
  async exec(msg, { args }) {
    try {
      if (!msg.isGroup) {
        return msg.reply("Perintah ini hanya dapat digunakan di dalam grup!");
      }

      const groupMetadata = await getGroupMetadata(msg.chat);

      // Format creation date
      const creationDate = new Date(groupMetadata.creation * 1000);
      const formattedDate = creationDate.toLocaleDateString("id-ID", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      // Count admins
      const adminCount = groupMetadata.participants.filter(
        (p) => p.admin === "admin" || p.admin === "superadmin"
      ).length;

      // Count participants
      const participantCount = groupMetadata.participants.length;

      // Get group description
      const desc = groupMetadata.desc || "Tidak ada deskripsi";

      const infoMessage =
        `*INFO GRUP*\n\n` +
        `*Nama:* ${groupMetadata.subject}\n` +
        `*ID:* ${groupMetadata.id}\n` +
        `*Dibuat pada:* ${formattedDate}\n` +
        `*Dibuat oleh:* @${groupMetadata.owner.split("@")[0]}\n` +
        `*Jumlah Admin:* ${adminCount}\n` +
        `*Jumlah Anggota:* ${participantCount}\n\n` +
        `*Deskripsi:*\n${desc}`;

      await msg.sock.sendMessage(msg.chat, {
        text: infoMessage,
        mentions: [groupMetadata.owner],
      });
    } catch (error) {
      botLogger.error(`Error in groupinfo command: ${error.message}`);
      return msg.reply(`Terjadi kesalahan: ${error.message}`);
    }
  },
});

global.Oblixn.cmd({
  name: "leave",
  alias: ["keluar"],
  desc: "Mengeluarkan bot dari grup",
  category: "group",
  async exec(msg, { args }) {
    try {
      if (!msg.isGroup) {
        return msg.reply("Perintah ini hanya dapat digunakan di dalam grup!");
      }

      // Only owner can make bot leave
      if (!global.Oblixn.isOwner(msg.sender)) {
        return msg.reply(
          "Hanya owner bot yang dapat menggunakan perintah ini!"
        );
      }

      await msg.reply("Selamat tinggal! Bot akan keluar dari grup ini.");
      setTimeout(async () => {
        await msg.sock.groupLeave(msg.chat);
      }, 2000);
    } catch (error) {
      botLogger.error(`Error in leave command: ${error.message}`);
      return msg.reply(`Terjadi kesalahan: ${error.message}`);
    }
  },
});

global.Oblixn.cmd({
  name: "tagadmins",
  alias: ["admintag", "tadmin"],
  desc: "Menandai semua admin grup",
  category: "group",
  async exec(msg, { args }) {
    try {
      if (!msg.isGroup) {
        return msg.reply("Perintah ini hanya dapat digunakan di dalam grup!");
      }

      const { isGroup, isAdmin } = await checkGroupAndAdmin(msg);
      if (!isGroup || !isAdmin) return;

      const groupMetadata = await getGroupMetadata(msg.chat);
      const admins = groupMetadata.participants
        .filter((p) => p.admin === "admin" || p.admin === "superadmin")
        .map((p) => p.id);

      if (admins.length === 0) {
        return msg.reply("Tidak ada admin dalam grup ini");
      }

      const message =
        args.length > 0 ? args.join(" ") : "Perhatian semua admin!";

      await msg.sock.sendMessage(msg.chat, {
        text: message,
        mentions: admins,
      });
    } catch (error) {
      botLogger.error(`Error in tagadmins command: ${error.message}`);
      return msg.reply(`Terjadi kesalahan: ${error.message}`);
    }
  },
});

global.Oblixn.cmd({
  name: "setppgroup",
  alias: ["setppgrup", "setgroupicon"],
  desc: "Mengubah foto profil grup",
  category: "group",
  async exec(msg, { args }) {
    try {
      if (!msg.isGroup) {
        return msg.reply("Perintah ini hanya dapat digunakan di dalam grup!");
      }

      const { isGroup, isAdmin } = await checkGroupAndAdmin(msg);
      if (!isGroup || !isAdmin) return;

      // Check if image is provided
      const quotedMsg =
        msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

      if (!quotedMsg || !quotedMsg.imageMessage) {
        return msg.reply(
          "Silakan reply/quote pesan dengan gambar untuk mengubah foto profil grup!"
        );
      }

      const media = await msg.sock.downloadMediaMessage({
        message: quotedMsg,
      });

      await msg.sock.updateProfilePicture(msg.chat, media);
      return msg.reply("✅ Foto profil grup berhasil diubah!");
    } catch (error) {
      botLogger.error(`Error in setppgroup command: ${error.message}`);
      return msg.reply(`Terjadi kesalahan: ${error.message}`);
    }
  },
});

global.Oblixn.cmd({
  name: "groupmembers",
  alias: ["members", "listmembers", "anggota"],
  desc: "Menampilkan daftar anggota grup",
  category: "group",
  async exec(msg, { args }) {
    try {
      if (!msg.isGroup) {
        return msg.reply("Perintah ini hanya dapat digunakan di dalam grup!");
      }

      const groupMetadata = await getGroupMetadata(msg.chat);
      const members = groupMetadata.participants;

      let message = `*DAFTAR ANGGOTA GRUP*\n*${groupMetadata.subject}*\n*Total: ${members.length} anggota*\n\n`;

      for (let i = 0; i < members.length; i++) {
        const member = members[i];
        const number = member.id.split("@")[0];
        const adminStatus = member.admin
          ? ` (${member.admin === "superadmin" ? "Owner" : "Admin"})`
          : "";
        message += `${i + 1}. @${number}${adminStatus}\n`;
      }

      await msg.sock.sendMessage(msg.chat, {
        text: message,
        mentions: members.map((m) => m.id),
      });
    } catch (error) {
      botLogger.error(`Error in groupmembers command: ${error.message}`);
      return msg.reply(`Terjadi kesalahan: ${error.message}`);
    }
  },
});
