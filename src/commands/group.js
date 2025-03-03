const { getGroupAdminInfo, normalizeJid } = require("../handler/permission");
const { botLogger } = require("../utils/logger");

global.Oblixn.cmd({
  name: "groupinfo",
  alias: ["infogroup", "groupstats"],
  desc: "Menampilkan informasi grup termasuk jumlah admin",
  category: "group",
  async exec(msg, { args }) {
    if (!msg.isGroup)
      return await msg.reply("Perintah ini hanya bisa digunakan di grup!");

    try {
      const groupInfo =
        msg.groupInfo || (await getGroupAdminInfo(msg.sock, msg.chat));
      const metadata = msg.groupMetadata;

      const response = [
        `📊 *Informasi Grup*`,
        `Nama: ${metadata.subject}`,
        `Total Member: ${groupInfo.totalParticipants}`,
        `Total Admin: ${groupInfo.totalAdmins}`,
        `Bot Admin: ${groupInfo.isBotAdmin ? "✅ Ya" : "❌ Tidak"}`,
        `Deskripsi: ${metadata.desc || "Tidak ada deskripsi"}`,
        `Dibuat oleh: ${normalizeJid(metadata.owner) || "Tidak diketahui"}`,
        `Admin List:`,
        ...groupInfo.adminList.map(
          (admin, i) => `${i + 1}. ${normalizeJid(admin.id)} (${admin.admin})`
        ),
      ].join("\n");

      await msg.reply(response);
    } catch (error) {
      await msg.reply(`Gagal mendapatkan informasi grup: ${error.message}`);
    }
  },
});

global.Oblixn.cmd({
  name: "checkadmin",
  alias: ["amadmin", "adminsaya"],
  desc: "Memeriksa apakah pengguna adalah admin",
  category: "group",
  async exec(msg, { args }) {
    if (!msg.isGroup)
      return await msg.reply("Perintah ini hanya bisa digunakan di grup!");

    const target = args[0] ? `${args[0]}@s.whatsapp.net` : msg.sender;
    const groupInfo =
      msg.groupInfo || (await getGroupAdminInfo(msg.sock, msg.chat));
    const normalizedTarget = normalizeJid(target);
    const isAdmin = groupInfo.adminList.some(
      (admin) => normalizeJid(admin.id) === normalizedTarget
    );

    const response = isAdmin
      ? `✅ @${normalizedTarget} adalah admin di grup ini`
      : `❌ @${normalizedTarget} bukan admin di grup ini`;

    await msg.reply(response, { mentions: [target] });
  },
});

global.Oblixn.cmd({
  name: "settinggroup",
  alias: ["setgroup", "pengaturangrup"],
  desc: "Mengatur pengaturan grup (nama, deskripsi, dll)",
  category: "group",
  async exec(msg, { args }) {
    if (!msg.isGroup)
      return await msg.reply("Perintah ini hanya bisa digunakan di grup!");
    if (!msg.isBotAdmin)
      return await msg.reply("Bot harus menjadi admin untuk melakukan ini!");
    if (!msg.isAdmin)
      return await msg.reply("Hanya admin yang bisa mengatur grup!");

    if (!args[0])
      return await msg.reply(
        "Gunakan: !settinggroup [nama/deskripsi] [nilai]\nContoh: !settinggroup nama Grup Baru"
      );

    const setting = args[0].toLowerCase();
    const value = args.slice(1).join(" ");

    try {
      switch (setting) {
        case "nama":
          if (!value) return await msg.reply("Masukkan nama grup baru!");
          await msg.sock.groupUpdateSubject(msg.chat, value);
          await msg.reply(`Nama grup berhasil diubah menjadi: ${value}`);
          break;
        case "deskripsi":
          if (!value) return await msg.reply("Masukkan deskripsi baru!");
          await msg.sock.groupUpdateDescription(msg.chat, value);
          await msg.reply("Deskripsi grup berhasil diubah!");
          break;
        default:
          await msg.reply(
            "Pengaturan tidak dikenali. Gunakan 'nama' atau 'deskripsi'."
          );
      }
    } catch (error) {
      await msg.reply(`Gagal mengatur grup: ${error.message}`);
    }
  },
});

global.Oblixn.cmd({
  name: "addmember",
  alias: ["tambahmember", "addanggota", "add"],
  desc: "Menambahkan anggota ke grup",
  category: "group",
  async exec(msg, { args }) {
    if (!msg.isGroup)
      return await msg.reply("Perintah ini hanya bisa digunakan di grup!");
    if (!msg.isBotAdmin)
      return await msg.reply("Bot harus menjadi admin untuk melakukan ini!");
    if (!msg.isAdmin)
      return await msg.reply("Hanya admin yang bisa menambah anggota!");

    if (!args.length)
      return await msg.reply(
        "Masukkan nomor yang akan ditambahkan!\nContoh: !add 6281234567890"
      );

    try {
      if (!msg.sock) throw new Error("Socket tidak tersedia pada msg");
      botLogger.info("msg.sock tersedia:", !!msg.sock.groupParticipantsUpdate);

      const membersToAdd = args.map((num) => {
        const cleanNum = num.replace(/[^0-9]/g, "");
        return cleanNum.startsWith("0")
          ? `62${cleanNum.slice(1)}@s.whatsapp.net`
          : `${cleanNum}@s.whatsapp.net`;
      });

      let response;
      if (msg.sock.groupParticipantsUpdate) {
        response = await msg.sock.groupParticipantsUpdate(
          msg.chat,
          membersToAdd,
          "add"
        );
        const added = response
          .filter((r) => r.status === "200")
          .map((r) => normalizeJid(r.jid));
        if (added.length) {
          await msg.reply(`Berhasil menambahkan: ${added.join(", ")}`, {
            mentions: membersToAdd,
          });
        } else {
          await msg.reply(
            "Gagal menambahkan anggota. Pastikan nomor valid dan belum ada di grup."
          );
        }
      } else {
        response = await msg.sock.groupAdd(msg.chat, membersToAdd);
        await msg.reply(
          `Berhasil menambahkan: ${membersToAdd.map(normalizeJid).join(", ")}`,
          { mentions: membersToAdd }
        );
      }
    } catch (error) {
      botLogger.error("Error in addmember:", error);
      await msg.reply(`Gagal menambahkan anggota: ${error.message}`);
    }
  },
});

global.Oblixn.cmd({
  name: "removemember",
  alias: ["hapusmember", "removeanggota", "kick"],
  desc: "Menghapus anggota dari grup",
  category: "group",
  async exec(msg, { args }) {
    if (!msg.isGroup)
      return await msg.reply("Perintah ini hanya bisa digunakan di grup!");
    if (!msg.isBotAdmin)
      return await msg.reply("Bot harus menjadi admin untuk melakukan ini!");
    if (!msg.isAdmin)
      return await msg.reply("Hanya admin yang bisa menghapus anggota!");

    if (!args.length)
      return await msg.reply(
        "Masukkan nomor yang akan dihapus!\nContoh: !kick 6281234567890"
      );

    try {
      const membersToRemove = args.map((num) => {
        const cleanNum = num.replace(/[^0-9]/g, "");
        return cleanNum.startsWith("0")
          ? `62${cleanNum.slice(1)}@s.whatsapp.net`
          : `${cleanNum}@s.whatsapp.net`;
      });

      let response;
      if (msg.sock.groupParticipantsUpdate) {
        response = await msg.sock.groupParticipantsUpdate(
          msg.chat,
          membersToRemove,
          "remove"
        );
        const removed = response
          .filter((r) => r.status === "200")
          .map((r) => normalizeJid(r.jid));
        if (removed.length) {
          await msg.reply(`Berhasil menghapus: ${removed.join(", ")}`, {
            mentions: membersToRemove,
          });
        } else {
          await msg.reply(
            "Gagal menghapus anggota. Pastikan nomor ada di grup."
          );
        }
      } else {
        response = await msg.sock.groupRemove(msg.chat, membersToRemove);
        await msg.reply(
          `Berhasil menghapus: ${membersToRemove.map(normalizeJid).join(", ")}`,
          { mentions: membersToRemove }
        );
      }
    } catch (error) {
      botLogger.error("Error in removemember:", error);
      await msg.reply(`Gagal menghapus anggota: ${error.message}`);
    }
  },
});

global.Oblixn.cmd({
  name: "listmembers",
  alias: ["daftarmember", "anggotalist"],
  desc: "Menampilkan daftar semua anggota grup",
  category: "group",
  async exec(msg) {
    if (!msg.isGroup)
      return await msg.reply("Perintah ini hanya bisa digunakan di grup!");

    try {
      const metadata = await msg.sock.groupMetadata(msg.chat);
      const participants = metadata.participants;
      const memberList = participants
        .map((p, i) => {
          const role = p.admin ? `(${p.admin})` : "(member)";
          return `${i + 1}. ${normalizeJid(p.id)} ${role}`;
        })
        .join("\n");

      await msg.reply(
        `📋 *Daftar Anggota Grup* (${participants.length} total):\n${memberList}`
      );
    } catch (error) {
      await msg.reply(`Gagal mendapatkan daftar anggota: ${error.message}`);
    }
  },
});

global.Oblixn.cmd({
  name: "promote",
  alias: ["jadikanadmin", "upadmin"],
  desc: "Mempromosikan anggota menjadi admin",
  category: "group",
  async exec(msg, { args }) {
    if (!msg.isGroup)
      return await msg.reply("Perintah ini hanya bisa digunakan di grup!");
    if (!msg.isBotAdmin)
      return await msg.reply("Bot harus menjadi admin untuk melakukan ini!");
    if (!msg.isAdmin)
      return await msg.reply("Hanya admin yang bisa mempromosikan anggota!");

    if (!args.length)
      return await msg.reply(
        "Masukkan nomor yang akan dipromosikan!\nContoh: !promote 6281234567890"
      );

    try {
      const membersToPromote = args.map((num) => {
        const cleanNum = num.replace(/[^0-9]/g, "");
        return cleanNum.startsWith("0")
          ? `62${cleanNum.slice(1)}@s.whatsapp.net`
          : `${cleanNum}@s.whatsapp.net`;
      });

      let response;
      if (msg.sock.groupParticipantsUpdate) {
        response = await msg.sock.groupParticipantsUpdate(
          msg.chat,
          membersToPromote,
          "promote"
        );
        const promoted = response
          .filter((r) => r.status === "200")
          .map((r) => normalizeJid(r.jid));
        if (promoted.length) {
          await msg.reply(
            `Berhasil mempromosikan: ${promoted.join(", ")} menjadi admin`,
            { mentions: membersToPromote }
          );
        } else {
          await msg.reply(
            "Gagal mempromosikan anggota. Pastikan nomor ada di grup."
          );
        }
      } else {
        response = await msg.sock.groupMakeAdmin(msg.chat, membersToPromote);
        await msg.reply(
          `Berhasil mempromosikan: ${membersToPromote
            .map(normalizeJid)
            .join(", ")} menjadi admin`,
          { mentions: membersToPromote }
        );
      }
    } catch (error) {
      botLogger.error("Error in promote:", error);
      await msg.reply(`Gagal mempromosikan anggota: ${error.message}`);
    }
  },
});

global.Oblixn.cmd({
  name: "demote",
  alias: ["turunkanadmin", "downadmin"],
  desc: "Menurunkan admin menjadi anggota biasa",
  category: "group",
  async exec(msg, { args }) {
    if (!msg.isGroup)
      return await msg.reply("Perintah ini hanya bisa digunakan di grup!");
    if (!msg.isBotAdmin)
      return await msg.reply("Bot harus menjadi admin untuk melakukan ini!");
    if (!msg.isAdmin)
      return await msg.reply("Hanya admin yang bisa mendemote admin lain!");

    if (!args.length)
      return await msg.reply(
        "Masukkan nomor admin yang akan diturunkan!\nContoh: !demote 6281234567890"
      );

    try {
      const membersToDemote = args.map((num) => {
        const cleanNum = num.replace(/[^0-9]/g, "");
        return cleanNum.startsWith("0")
          ? `62${cleanNum.slice(1)}@s.whatsapp.net`
          : `${cleanNum}@s.whatsapp.net`;
      });

      let response;
      if (msg.sock.groupParticipantsUpdate) {
        response = await msg.sock.groupParticipantsUpdate(
          msg.chat,
          membersToDemote,
          "demote"
        );
        const demoted = response
          .filter((r) => r.status === "200")
          .map((r) => normalizeJid(r.jid));
        if (demoted.length) {
          await msg.reply(
            `Berhasil mendemote: ${demoted.join(", ")} dari admin`,
            { mentions: membersToDemote }
          );
        } else {
          await msg.reply(
            "Gagal mendemote admin. Pastikan nomor adalah admin."
          );
        }
      } else {
        response = await msg.sock.groupDemoteAdmin(msg.chat, membersToDemote);
        await msg.reply(
          `Berhasil mendemote: ${membersToDemote
            .map(normalizeJid)
            .join(", ")} dari admin`,
          { mentions: membersToDemote }
        );
      }
    } catch (error) {
      botLogger.error("Error in demote:", error);
      await msg.reply(`Gagal mendemote admin: ${error.message}`);
    }
  },
});

global.Oblixn.cmd({
  name: "lockgroup",
  alias: ["kuncigrup", "groupmode"],
  desc: "Mengunci atau membuka grup (hanya admin yang bisa mengedit)",
  category: "group",
  async exec(msg, { args }) {
    if (!msg.isGroup)
      return await msg.reply("Perintah ini hanya bisa digunakan di grup!");
    if (!msg.isBotAdmin)
      return await msg.reply("Bot harus menjadi admin untuk melakukan ini!");
    if (!msg.isAdmin)
      return await msg.reply("Hanya admin yang bisa mengunci/membuka grup!");

    if (!args[0] || !["open", "close"].includes(args[0].toLowerCase())) {
      return await msg.reply(
        "Gunakan: !lockgroup [open/close]\nContoh: !lockgroup close"
      );
    }

    try {
      const action = args[0].toLowerCase() === "open" ? "unlocked" : "locked";
      await msg.sock.groupSettingUpdate(msg.chat, action);
      await msg.reply(
        `Grup telah ${action === "locked" ? "dikunci" : "dibuka"}!`
      );
    } catch (error) {
      botLogger.error("Error in lockgroup:", error);
      await msg.reply(`Gagal mengatur grup: ${error.message}`);
    }
  },
});

global.Oblixn.cmd({
  name: "invite",
  alias: ["undang", "groupinvite"],
  desc: "Membuat tautan undangan grup",
  category: "group",
  async exec(msg) {
    if (!msg.isGroup)
      return await msg.reply("Perintah ini hanya bisa digunakan di grup!");
    if (!msg.isBotAdmin)
      return await msg.reply("Bot harus menjadi admin untuk membuat undangan!");

    try {
      const inviteCode = await msg.sock.groupInviteCode(msg.chat);
      const inviteLink = `https://chat.whatsapp.com/${inviteCode}`;
      await msg.reply(`Tautan undangan grup: ${inviteLink}`);
    } catch (error) {
      botLogger.error("Error in invite:", error);
      await msg.reply(`Gagal membuat tautan undangan: ${error.message}`);
    }
  },
});

global.Oblixn.cmd({
  name: "revokeinvite",
  alias: ["batalkanundangan", "resetinvite"],
  desc: "Membatalkan tautan undangan grup saat ini",
  category: "group",
  async exec(msg) {
    if (!msg.isGroup)
      return await msg.reply("Perintah ini hanya bisa digunakan di grup!");
    if (!msg.isBotAdmin)
      return await msg.reply("Bot harus menjadi admin untuk melakukan ini!");
    if (!msg.isAdmin)
      return await msg.reply("Hanya admin yang bisa membatalkan undangan!");

    try {
      await msg.sock.groupRevokeInvite(msg.chat);
      await msg.reply(
        "Tautan undangan grup telah dibatalkan dan diganti dengan yang baru!"
      );
    } catch (error) {
      botLogger.error("Error in revokeinvite:", error);
      await msg.reply(`Gagal membatalkan undangan: ${error.message}`);
    }
  },
});

global.Oblixn.cmd({
  name: "groupphoto",
  alias: ["setgroupphoto", "fotogrup"],
  desc: "Mengatur foto profil grup (kirim gambar dengan command)",
  category: "group",
  async exec(msg) {
    if (!msg.isGroup)
      return await msg.reply("Perintah ini hanya bisa digunakan di grup!");
    if (!msg.isBotAdmin)
      return await msg.reply("Bot harus menjadi admin untuk melakukan ini!");
    if (!msg.isAdmin)
      return await msg.reply("Hanya admin yang bisa mengatur foto grup!");

    if (!msg.message.imageMessage) {
      return await msg.reply(
        "Kirim gambar dengan caption !groupphoto untuk mengatur foto grup!"
      );
    }

    try {
      const media = await msg.downloadMedia();
      await msg.sock.updateProfilePicture(msg.chat, media);
      await msg.reply("Foto profil grup berhasil diperbarui!");
    } catch (error) {
      botLogger.error("Error in groupphoto:", error);
      await msg.reply(`Gagal mengatur foto grup: ${error.message}`);
    }
  },
});
// src/commands/groupInfo.js (tambahkan di bagian bawah)

// Command: hidetag
global.Oblixn.cmd({
  name: "hidetag",
  alias: ["htag", "hidden"],
  desc: "Menyebutkan semua anggota grup secara tersembunyi",
  category: "group",
  async exec(msg, { args }) {
    if (!msg.isGroup) return await msg.reply("Perintah ini hanya bisa digunakan di grup!");
    if (!msg.isBotAdmin) return await msg.reply("Bot harus menjadi admin untuk melakukan ini!");
    if (!msg.isAdmin) return await msg.reply("Hanya admin yang bisa menggunakan perintah ini!");

    try {
      if (!msg.sock) {
        botLogger.error("Socket tidak tersedia pada msg di hidetag");
        throw new Error("Socket tidak tersedia. Silakan coba lagi nanti.");
      }

      const metadata = await msg.sock.groupMetadata(msg.chat);
      const participants = metadata.participants.map(p => p.id);

      const message = args.length ? args.join(" ") : "Pesan tersembunyi untuk semua anggota.";
      await msg.sock.sendMessage(msg.chat, { text: message, mentions: participants }, { quoted: msg });
      botLogger.info("Hidetag berhasil dikirim ke grup:", msg.chat);
    } catch (error) {
      botLogger.error("Error in hidetag:", error);
      await msg.reply(`Gagal melakukan hidetag: ${error.message}`);
    }
  }
});

// Command: tagall
global.Oblixn.cmd({
  name: "tagall",
  alias: ["tall", "mentionall"],
  desc: "Menyebutkan semua anggota grup secara eksplisit (opsional dengan pesan menggunakan -msg)",
  category: "group",
  async exec(msg, { args }) {
    if (!msg.isGroup) return await msg.reply("Perintah ini hanya bisa digunakan di grup!");
    if (!msg.isBotAdmin) return await msg.reply("Bot harus menjadi admin untuk melakukan ini!");
    if (!msg.isAdmin) return await msg.reply("Hanya admin yang bisa menggunakan perintah ini!");

    try {
      if (!msg.sock) {
        botLogger.error("Socket tidak tersedia pada msg di tagall");
        throw new Error("Socket tidak tersedia. Silakan coba lagi nanti.");
      }

      const metadata = await msg.sock.groupMetadata(msg.chat);
      const participants = metadata.participants;

      // Parsing argumen untuk mendeteksi flag -msg
      let customMessage = "Daftar anggota grup:";
      const msgIndex = args.indexOf("-msg");
      if (msgIndex !== -1 && msgIndex + 1 < args.length) {
        customMessage = args.slice(msgIndex + 1).join(" ");
        args.splice(msgIndex); // Hapus -msg dan pesan dari args
      }

      const mentionList = participants.map((p, i) => {
        const role = p.admin ? `(${p.admin})` : "";
        return `${i + 1}. @${normalizeJid(p.id)}${role}`;
      }).join("\n");

      const finalMessage = `${customMessage}\n\n${mentionList}`;
      await msg.sock.sendMessage(msg.chat, { text: finalMessage, mentions: participants.map(p => p.id) }, { quoted: msg });
      botLogger.info("Tagall berhasil dikirim ke grup:", msg.chat);
    } catch (error) {
      botLogger.error("Error in tagall:", error);
      await msg.reply(`Gagal melakukan tagall: ${error.message}`);
    }
  }
});