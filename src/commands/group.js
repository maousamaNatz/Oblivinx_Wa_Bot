const { getGroupAdminInfo, normalizeJid } = require("../handler/permission");
const { botLogger } = require("../utils/logger");
const db = require("../../database/confLowDb/lowdb");
const axios = require("axios");
const https = require("https"); // Tambahkan untuk mengabaikan sertifikat

// Command: groupinfo
global.Oblixn.cmd({
  name: "groupinfo",
  alias: ["infogroup", "groupstats"],
  desc: "Menampilkan semua informasi grup",
  category: "group",
  async exec(msg, { args }) {
    if (!msg.isGroup) {
      return await msg.reply("Perintah ini hanya bisa digunakan di grup!");
    }

    try {
      // Pastikan metadata grup diambil dengan benar
      const metadata = await msg.sock.groupMetadata(msg.chat);
      if (!metadata || !metadata.subject) {
        throw new Error("Gagal mengambil metadata grup dari WhatsApp");
      }

      // Ambil informasi admin dan status bot
      const groupInfo = await getGroupAdminInfo(msg.sock, msg.chat);

      // Ambil data grup dari database
      let group = await db.getGroup(msg.chat);

      // Jika grup belum ada di database, tambahkan dengan data dari metadata
      if (!group) {
        const newGroup = await db.addGroup({
          group_id: msg.chat,
          group_name: metadata.subject || "Unnamed Group",
          owner_id: metadata.owner || msg.sender,
          total_members: metadata.participants?.length || 0,
          bot_is_admin: groupInfo?.isBotAdmin ? 1 : 0,
          created_at: metadata.creation ? new Date(metadata.creation * 1000).toISOString() : new Date().toISOString(),
        });
        botLogger.info(`Grup baru ditambahkan ke database: ${msg.chat}`);
        group = newGroup.data;
      }

      // Ambil URL foto profil grup, dengan fallback jika tidak ada
      const profilePictureUrl = await msg.sock.profilePictureUrl(msg.chat, "image").catch(() => "https://i.ibb.co/m4VjmBp/Profile.jpg");

      // Unduh gambar dengan axios, abaikan verifikasi sertifikat
      const agent = new https.Agent({
        rejectUnauthorized: false, // Abaikan verifikasi sertifikat
      });
      const response = await axios.get(profilePictureUrl, {
        responseType: "arraybuffer",
        httpsAgent: agent,
      });
      const imageBuffer = Buffer.from(response.data, "binary");

      // Bangun informasi teks
      let textResponse = [
        `📊 *Informasi Grup*`,
        `Nama: ${metadata.subject || group.group_name || "Tidak diketahui"}`,
        `ID Grup: ${msg.chat}`,
        `Total Member: ${metadata.participants?.length || group.total_members || "Tidak diketahui"}`,
        `Deskripsi: ${metadata.desc || "Tidak ada deskripsi"}`,
        `Dibuat oleh: ${normalizeJid(metadata.owner || group.owner_id) || "Tidak diketahui"}`,
        `Tanggal Dibuat: ${metadata.creation ? new Date(metadata.creation * 1000).toLocaleString("id-ID") : "Tidak diketahui"}`,
        `Admin List (${groupInfo?.adminList?.length || 0}):`,
        ...(groupInfo?.adminList?.length > 0
          ? groupInfo.adminList.map((admin, i) => `${i + 1}. ${normalizeJid(admin.id)} (${admin.admin || "unknown"})`)
          : ["- Tidak ada admin terdeteksi"]),
      ];

      if (group) {
        textResponse.push(
          `\n*Informasi dari Database*`,
          `ID di Database: ${group.id}`,
          `Nama Grup: ${group.group_name || "Tidak ada"}`,
          `Owner ID: ${normalizeJid(group.owner_id)}`,
          `Total Member (DB): ${group.total_members || 0}`,
          `Tanggal Dibuat (DB): ${new Date(group.created_at).toLocaleString("id-ID")}`,
          `Bot adalah Admin: ${group.bot_is_admin === 1 ? "Ya" : "Tidak"}`,
          `Tanggal Registrasi: ${new Date(group.registration_date).toLocaleString("id-ID")}`,
          `Status Premium: ${group.premium_status === 1 ? "Ya" : "Tidak"}`,
          `Status Sewa: ${group.sewa_status === 1 ? "Ya" : "Tidak"}`,
          `Bahasa: ${group.language || "id"}`,
          `Peringkat Leaderboard: ${group.leaderboard_rank || "Tidak ada"}`,
          `Level: ${group.level || 1}`,
          `Total XP: ${group.total_xp || 0}`,
          `XP Saat Ini: ${group.current_xp || 0}`,
          `XP untuk Level Berikutnya: ${group.xp_to_next_level || 1000}`,
          `Anti Bot: ${group.anti_bot === 1 ? "Aktif" : "Tidak aktif"}`,
          `Anti Delete Message: ${group.anti_delete_message === 1 ? "Aktif" : "Tidak aktif"}`,
          `Anti Hidden Tag: ${group.anti_hidden_tag === 1 ? "Aktif" : "Tidak aktif"}`,
          `Anti Group Link: ${group.anti_group_link === 1 ? "Aktif" : "Tidak aktif"}`,
          `Anti View Once: ${group.anti_view_once === 1 ? "Aktif" : "Tidak aktif"}`,
          `Auto Sticker: ${group.auto_sticker === 1 ? "Aktif" : "Tidak aktif"}`,
          `Log Detection: ${group.log_detection === 1 ? "Aktif" : "Tidak aktif"}`,
          `Auto Level Up: ${group.auto_level_up === 1 ? "Aktif" : "Tidak aktif"}`,
          `Mute Bot: ${group.mute_bot === 1 ? "Aktif" : "Tidak aktif"}`,
          `Anti Country: ${group.anti_country === 1 ? "Aktif" : "Tidak aktif"}`,
          `Welcome Message: ${group.welcome_message === 1 ? "Aktif" : "Tidak aktif"}`,
          `Goodbye Message: ${group.goodbye_message === 1 ? "Aktif" : "Tidak aktif"}`,
          `Warnings: ${group.warnings || 0}`
        );
      }

      const finalText = textResponse.join("\n");

      // Kirim pesan dengan gambar dan teks
      await msg.sock.sendMessage(
        msg.chat,
        {
          image: imageBuffer,
          caption: finalText,
        },
        { quoted: msg }
      );

      botLogger.info(`Group info sent for ${msg.chat}`);
    } catch (error) {
      botLogger.error(`Error in groupinfo command: ${error.message}`, error.stack);
      await msg.reply(`Gagal mendapatkan informasi grup: ${error.message}`);
    }
  },
});
// Command: checkadmin
global.Oblixn.cmd({
  name: "checkadmin",
  alias: ["amadmin", "adminsaya"],
  desc: "Memeriksa apakah pengguna adalah admin",
  category: "group",
  async exec(msg, { args }) {
    if (!msg.isGroup) {
      return await msg.reply("Perintah ini hanya bisa digunakan di grup!");
    }

    try {
      const target = args[0] ? `${args[0]}@s.whatsapp.net` : msg.sender;
      const groupInfo =
        msg.groupInfo || (await getGroupAdminInfo(msg.sock, msg.chat));
      const normalizedTarget = normalizeJid(target);
      const isAdmin =
        groupInfo?.adminList?.some(
          (admin) => normalizeJid(admin.id) === normalizedTarget
        ) || false;

      const response = isAdmin
        ? `✅ @${normalizedTarget.split("@")[0]} adalah admin di grup ini`
        : `❌ @${normalizedTarget.split("@")[0]} bukan admin di grup ini`;

      await msg.reply(response, { mentions: [target] });
    } catch (error) {
      botLogger.error(
        `Error in checkadmin command: ${error.message}`,
        error.stack
      );
      await msg.reply(`Gagal memeriksa status admin: ${error.message}`);
    }
  },
});

// Command: settinggroup
global.Oblixn.cmd({
  name: "settinggroup",
  alias: ["setgroup", "pengaturangrup"],
  desc: "Mengatur pengaturan grup (nama, deskripsi, dll)",
  category: "group",
  async exec(msg, { args }) {
    if (!msg.isGroup) {
      return await msg.reply("Perintah ini hanya bisa digunakan di grup!");
    }
    if (!msg.isBotAdmin) {
      return await msg.reply("Bot harus menjadi admin untuk melakukan ini!");
    }
    if (!msg.isAdmin) {
      return await msg.reply("Hanya admin yang bisa mengatur grup!");
    }

    if (!args[0]) {
      return await msg.reply(
        "Gunakan: !settinggroup [nama/deskripsi] [nilai]\nContoh: !settinggroup nama Grup Baru"
      );
    }

    try {
      const setting = args[0].toLowerCase();
      const value = args.slice(1).join(" ");

      switch (setting) {
        case "nama":
          if (!value) return await msg.reply("Masukkan nama grup baru!");
          await msg.sock.groupUpdateSubject(msg.chat, value);
          await db.updateGroup(msg.chat, {
            group_name: value,
            updated_at: new Date().toISOString(),
          });
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
      botLogger.error(
        `Error in settinggroup command: ${error.message}`,
        error.stack
      );
      await msg.reply(`Gagal mengatur grup: ${error.message}`);
    }
  },
});

// Command: addmember
global.Oblixn.cmd({
  name: "addmember",
  alias: ["tambahmember", "addanggota", "add"],
  desc: "Menambahkan anggota ke grup",
  category: "group",
  async exec(msg, { args }) {
    if (!msg.isGroup) {
      return await msg.reply("Perintah ini hanya bisa digunakan di grup!");
    }
    if (!msg.isBotAdmin) {
      return await msg.reply("Bot harus menjadi admin untuk melakukan ini!");
    }
    if (!msg.isAdmin) {
      return await msg.reply("Hanya admin yang bisa menambah anggota!");
    }

    if (!args.length) {
      return await msg.reply(
        "Masukkan nomor yang akan ditambahkan!\nContoh: !add 6281234567890"
      );
    }

    try {
      if (!msg.sock) throw new Error("Socket tidak tersedia pada msg");

      const membersToAdd = args.map((num) => {
        const cleanNum = num.replace(/[^0-9]/g, "");
        return cleanNum.startsWith("0")
          ? `62${cleanNum.slice(1)}@s.whatsapp.net`
          : `${cleanNum}@s.whatsapp.net`;
      });

      const response = await msg.sock.groupParticipantsUpdate(
        msg.chat,
        membersToAdd,
        "add"
      );
      const added = response
        .filter((r) => r.status === "200")
        .map((r) => normalizeJid(r.jid));

      if (added.length) {
        const group = await db.getGroup(msg.chat);
        if (group) {
          const metadata = await msg.sock.groupMetadata(msg.chat);
          await db.updateGroup(msg.chat, {
            total_members: metadata.participants.length,
            updated_at: new Date().toISOString(),
          });
        }
        await msg.reply(`Berhasil menambahkan: ${added.join(", ")}`, {
          mentions: membersToAdd,
        });
      } else {
        await msg.reply(
          "Gagal menambahkan anggota. Pastikan nomor valid dan belum ada di grup."
        );
      }
    } catch (error) {
      botLogger.error("Error in addmember:", error);
      await msg.reply(`Gagal menambahkan anggota: ${error.message}`);
    }
  },
});

// Command: removemember
global.Oblixn.cmd({
  name: "removemember",
  alias: ["hapusmember", "removeanggota", "kick"],
  desc: "Menghapus anggota dari grup",
  category: "group",
  async exec(msg, { args }) {
    if (!msg.isGroup) {
      return await msg.reply("Perintah ini hanya bisa digunakan di grup!");
    }
    if (!msg.isBotAdmin) {
      return await msg.reply("Bot harus menjadi admin untuk melakukan ini!");
    }
    if (!msg.isAdmin) {
      return await msg.reply("Hanya admin yang bisa menghapus anggota!");
    }

    if (!args.length) {
      return await msg.reply(
        "Masukkan nomor yang akan dihapus!\nContoh: !kick 6281234567890"
      );
    }

    try {
      const membersToRemove = args.map((num) => {
        const cleanNum = num.replace(/[^0-9]/g, "");
        return cleanNum.startsWith("0")
          ? `62${cleanNum.slice(1)}@s.whatsapp.net`
          : `${cleanNum}@s.whatsapp.net`;
      });

      const response = await msg.sock.groupParticipantsUpdate(
        msg.chat,
        membersToRemove,
        "remove"
      );
      const removed = response
        .filter((r) => r.status === "200")
        .map((r) => normalizeJid(r.jid));

      if (removed.length) {
        const group = await db.getGroup(msg.chat);
        if (group) {
          const metadata = await msg.sock.groupMetadata(msg.chat);
          await db.updateGroup(msg.chat, {
            total_members: metadata.participants.length,
            updated_at: new Date().toISOString(),
          });
        }
        await msg.reply(`Berhasil menghapus: ${removed.join(", ")}`, {
          mentions: membersToRemove,
        });
      } else {
        await msg.reply("Gagal menghapus anggota. Pastikan nomor ada di grup.");
      }
    } catch (error) {
      botLogger.error("Error in removemember:", error);
      await msg.reply(`Gagal menghapus anggota: ${error.message}`);
    }
  },
});

// Command: listmembers
global.Oblixn.cmd({
  name: "listmembers",
  alias: ["daftarmember", "anggotalist"],
  desc: "Menampilkan daftar semua anggota grup",
  category: "group",
  async exec(msg) {
    if (!msg.isGroup) {
      return await msg.reply("Perintah ini hanya bisa digunakan di grup!");
    }

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
      botLogger.error(
        `Error in listmembers command: ${error.message}`,
        error.stack
      );
      await msg.reply(`Gagal mendapatkan daftar anggota: ${error.message}`);
    }
  },
});

// Command: promote
global.Oblixn.cmd({
  name: "promote",
  alias: ["jadikanadmin", "upadmin"],
  desc: "Mempromosikan anggota menjadi admin",
  category: "group",
  async exec(msg, { args }) {
    if (!msg.isGroup) {
      return await msg.reply("Perintah ini hanya bisa digunakan di grup!");
    }
    if (!msg.isBotAdmin) {
      return await msg.reply("Bot harus menjadi admin untuk melakukan ini!");
    }
    if (!msg.isAdmin) {
      return await msg.reply("Hanya admin yang bisa mempromosikan anggota!");
    }

    if (!args.length) {
      return await msg.reply(
        "Masukkan nomor yang akan dipromosikan!\nContoh: !promote 6281234567890"
      );
    }

    try {
      const membersToPromote = args.map((num) => {
        const cleanNum = num.replace(/[^0-9]/g, "");
        return cleanNum.startsWith("0")
          ? `62${cleanNum.slice(1)}@s.whatsapp.net`
          : `${cleanNum}@s.whatsapp.net`;
      });

      const response = await msg.sock.groupParticipantsUpdate(
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
          "Gagal mempromosikan anggota. Pastikan nomor ada di grup dan bukan admin."
        );
      }
    } catch (error) {
      botLogger.error("Error in promote:", error);
      await msg.reply(`Gagal mempromosikan anggota: ${error.message}`);
    }
  },
});

// Command: demote
global.Oblixn.cmd({
  name: "demote",
  alias: ["turunkanadmin", "downadmin"],
  desc: "Menurunkan admin menjadi anggota biasa",
  category: "group",
  async exec(msg, { args }) {
    if (!msg.isGroup) {
      return await msg.reply("Perintah ini hanya bisa digunakan di grup!");
    }
    if (!msg.isBotAdmin) {
      return await msg.reply("Bot harus menjadi admin untuk melakukan ini!");
    }
    if (!msg.isAdmin) {
      return await msg.reply("Hanya admin yang bisa mendemote admin lain!");
    }

    if (!args.length) {
      return await msg.reply(
        "Masukkan nomor admin yang akan diturunkan!\nContoh: !demote 6281234567890"
      );
    }

    try {
      const membersToDemote = args.map((num) => {
        const cleanNum = num.replace(/[^0-9]/g, "");
        return cleanNum.startsWith("0")
          ? `62${cleanNum.slice(1)}@s.whatsapp.net`
          : `${cleanNum}@s.whatsapp.net`;
      });

      const response = await msg.sock.groupParticipantsUpdate(
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
        await msg.reply("Gagal mendemote admin. Pastikan nomor adalah admin.");
      }
    } catch (error) {
      botLogger.error("Error in demote:", error);
      await msg.reply(`Gagal mendemote admin: ${error.message}`);
    }
  },
});

// Command: lockgroup
global.Oblixn.cmd({
  name: "lockgroup",
  alias: ["kuncigrup", "groupmode"],
  desc: "Mengunci atau membuka grup (hanya admin yang bisa mengedit)",
  category: "group",
  async exec(msg, { args }) {
    if (!msg.isGroup) {
      return await msg.reply("Perintah ini hanya bisa digunakan di grup!");
    }
    if (!msg.isBotAdmin) {
      return await msg.reply("Bot harus menjadi admin untuk melakukan ini!");
    }
    if (!msg.isAdmin) {
      return await msg.reply("Hanya admin yang bisa mengunci/membuka grup!");
    }

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

// Command: invite
global.Oblixn.cmd({
  name: "invite",
  alias: ["undang", "groupinvite"],
  desc: "Membuat tautan undangan grup",
  category: "group",
  async exec(msg) {
    if (!msg.isGroup) {
      return await msg.reply("Perintah ini hanya bisa digunakan di grup!");
    }
    if (!msg.isBotAdmin) {
      return await msg.reply("Bot harus menjadi admin untuk membuat undangan!");
    }

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

// Command: revokeinvite
global.Oblixn.cmd({
  name: "revokeinvite",
  alias: ["batalkanundangan", "resetinvite"],
  desc: "Membatalkan tautan undangan grup saat ini",
  category: "group",
  async exec(msg) {
    if (!msg.isGroup) {
      return await msg.reply("Perintah ini hanya bisa digunakan di grup!");
    }
    if (!msg.isBotAdmin) {
      return await msg.reply("Bot harus menjadi admin untuk melakukan ini!");
    }
    if (!msg.isAdmin) {
      return await msg.reply("Hanya admin yang bisa membatalkan undangan!");
    }

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

// Command: groupphoto
global.Oblixn.cmd({
  name: "groupphoto",
  alias: ["setgroupphoto", "fotogrup"],
  desc: "Mengatur foto profil grup (kirim gambar dengan command)",
  category: "group",
  async exec(msg) {
    if (!msg.isGroup) {
      return await msg.reply("Perintah ini hanya bisa digunakan di grup!");
    }
    if (!msg.isBotAdmin) {
      return await msg.reply("Bot harus menjadi admin untuk melakukan ini!");
    }
    if (!msg.isAdmin) {
      return await msg.reply("Hanya admin yang bisa mengatur foto grup!");
    }

    if (!msg.message?.imageMessage) {
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

// Command: hidetag
global.Oblixn.cmd({
  name: "hidetag",
  alias: ["htag", "hidden"],
  desc: "Menyebutkan semua anggota grup secara tersembunyi",
  category: "group",
  async exec(msg, { args }) {
    if (!msg.isGroup) {
      return await msg.reply("Perintah ini hanya bisa digunakan di grup!");
    }
    if (!msg.isBotAdmin) {
      return await msg.reply("Bot harus menjadi admin untuk melakukan ini!");
    }
    if (!msg.isAdmin) {
      return await msg.reply("Hanya admin yang bisa menggunakan perintah ini!");
    }

    try {
      if (!msg.sock) throw new Error("Socket tidak tersedia pada msg");

      const metadata = await msg.sock.groupMetadata(msg.chat);
      const participants = metadata.participants.map((p) => p.id);

      const message = args.length
        ? args.join(" ")
        : "Pesan tersembunyi untuk semua anggota.";
      await msg.sock.sendMessage(
        msg.chat,
        { text: message, mentions: participants },
        { quoted: msg }
      );
      botLogger.info("Hidetag berhasil dikirim ke grup:", msg.chat);
    } catch (error) {
      botLogger.error("Error in hidetag:", error);
      await msg.reply(`Gagal melakukan hidetag: ${error.message}`);
    }
  },
});

// Command: tagall
global.Oblixn.cmd({
  name: "tagall",
  alias: ["tall", "mentionall"],
  desc: "Menyebutkan semua anggota grup secara eksplisit (opsional dengan pesan menggunakan -msg)",
  category: "group",
  async exec(msg, { args }) {
    if (!msg.isGroup) {
      return await msg.reply("Perintah ini hanya bisa digunakan di grup!");
    }
    if (!msg.isBotAdmin) {
      return await msg.reply("Bot harus menjadi admin untuk melakukan ini!");
    }
    if (!msg.isAdmin) {
      return await msg.reply("Hanya admin yang bisa menggunakan perintah ini!");
    }

    try {
      if (!msg.sock) throw new Error("Socket tidak tersedia pada msg");

      const metadata = await msg.sock.groupMetadata(msg.chat);
      const participants = metadata.participants;

      let customMessage = "Daftar anggota grup:";
      const msgIndex = args.indexOf("-msg");
      if (msgIndex !== -1 && msgIndex + 1 < args.length) {
        customMessage = args.slice(msgIndex + 1).join(" ");
        args.splice(msgIndex); // Hapus -msg dan pesan dari args
      }

      const mentionList = participants
        .map((p, i) => {
          const role = p.admin ? `(${p.admin})` : "";
          return `${i + 1}. @${normalizeJid(p.id)}${role}`;
        })
        .join("\n");

      const finalMessage = `${customMessage}\n\n${mentionList}`;
      await msg.sock.sendMessage(
        msg.chat,
        { text: finalMessage, mentions: participants.map((p) => p.id) },
        { quoted: msg }
      );
      botLogger.info("Tagall berhasil dikirim ke grup:", msg.chat);
    } catch (error) {
      botLogger.error("Error in tagall:", error);
      await msg.reply(`Gagal melakukan tagall: ${error.message}`);
    }
  },
});

// Command: mute
global.Oblixn.cmd({
  name: "mute",
  alias: ["muteon", "muteoff"],
  desc: "Mengaktifkan atau menonaktifkan mode mute bot di grup",
  category: "group",
  async exec(msg, { args }) {
    if (!msg.isGroup) {
      return await msg.reply("Perintah ini hanya bisa digunakan di grup!");
    }
    if (!msg.isBotAdmin) {
      return await msg.reply("Bot harus menjadi admin untuk melakukan ini!");
    }
    if (!msg.isAdmin) {
      return await msg.reply("Hanya admin yang bisa mengatur mode mute!");
    }

    if (!args[0] || !["on", "off"].includes(args[0].toLowerCase())) {
      return await msg.reply("Gunakan: !mute [on/off]\nContoh: !mute on");
    }

    try {
      const muteStatus = args[0].toLowerCase() === "on" ? 1 : 0;
      await db.updateGroup(msg.chat, {
        mute_bot: muteStatus,
        updated_at: new Date().toISOString(),
      });
      await msg.reply(
        `Mode mute bot telah ${
          muteStatus === 1 ? "diaktifkan" : "dinonaktifkan"
        } di grup ini!`
      );
    } catch (error) {
      botLogger.error("Error in mute command:", error);
      await msg.reply(`Gagal mengatur mode mute: ${error.message}`);
    }
  },
});

// Command: welcome
global.Oblixn.cmd({
  name: "welcome",
  alias: ["welcomeon", "welcomeoff"],
  desc: "Mengaktifkan atau menonaktifkan pesan selamat datang di grup",
  category: "group",
  async exec(msg, { args }) {
    if (!msg.isGroup) {
      return await msg.reply("Perintah ini hanya bisa digunakan di grup!");
    }
    if (!msg.isBotAdmin) {
      return await msg.reply("Bot harus menjadi admin untuk melakukan ini!");
    }
    if (!msg.isAdmin) {
      return await msg.reply(
        "Hanya admin yang bisa mengatur pesan selamat datang!"
      );
    }

    if (!args[0] || !["on", "off"].includes(args[0].toLowerCase())) {
      return await msg.reply("Gunakan: !welcome [on/off]\nContoh: !welcome on");
    }

    try {
      const welcomeStatus = args[0].toLowerCase() === "on" ? 1 : 0;
      await db.updateGroup(msg.chat, {
        welcome_message: welcomeStatus,
        updated_at: new Date().toISOString(),
      });
      await msg.reply(
        `Pesan selamat datang telah ${
          welcomeStatus === 1 ? "diaktifkan" : "dinonaktifkan"
        } di grup ini!`
      );
    } catch (error) {
      botLogger.error("Error in welcome command:", error);
      await msg.reply(`Gagal mengatur pesan selamat datang: ${error.message}`);
    }
  },
});

// Command: goodbye
global.Oblixn.cmd({
  name: "goodbye",
  alias: ["goodbyeon", "goodbyeoff"],
  desc: "Mengaktifkan atau menonaktifkan pesan perpisahan di grup",
  category: "group",
  async exec(msg, { args }) {
    if (!msg.isGroup) {
      return await msg.reply("Perintah ini hanya bisa digunakan di grup!");
    }
    if (!msg.isBotAdmin) {
      return await msg.reply("Bot harus menjadi admin untuk melakukan ini!");
    }
    if (!msg.isAdmin) {
      return await msg.reply(
        "Hanya admin yang bisa mengatur pesan perpisahan!"
      );
    }

    if (!args[0] || !["on", "off"].includes(args[0].toLowerCase())) {
      return await msg.reply("Gunakan: !goodbye [on/off]\nContoh: !goodbye on");
    }

    try {
      const goodbyeStatus = args[0].toLowerCase() === "on" ? 1 : 0;
      await db.updateGroup(msg.chat, {
        goodbye_message: goodbyeStatus,
        updated_at: new Date().toISOString(),
      });
      await msg.reply(
        `Pesan perpisahan telah ${
          goodbyeStatus === 1 ? "diaktifkan" : "dinonaktifkan"
        } di grup ini!`
      );
    } catch (error) {
      botLogger.error("Error in goodbye command:", error);
      await msg.reply(`Gagal mengatur pesan perpisahan: ${error.message}`);
    }
  },
});

// Command: antispam
global.Oblixn.cmd({
  name: "antispam",
  alias: ["spamoff", "spamon"],
  desc: "Mengaktifkan atau menonaktifkan fitur anti-spam di grup",
  category: "group",
  async exec(msg, { args }) {
    if (!msg.isGroup) {
      return await msg.reply("Perintah ini hanya bisa digunakan di grup!");
    }
    if (!msg.isBotAdmin) {
      return await msg.reply("Bot harus menjadi admin untuk melakukan ini!");
    }
    if (!msg.isAdmin) {
      return await msg.reply("Hanya admin yang bisa mengatur anti-spam!");
    }

    if (!args[0] || !["on", "off"].includes(args[0].toLowerCase())) {
      return await msg.reply(
        "Gunakan: !antispam [on/off]\nContoh: !antispam on"
      );
    }

    try {
      const antispamStatus = args[0].toLowerCase() === "on" ? 1 : 0;
      await db.updateGroup(msg.chat, {
        anti_bot: antispamStatus,
        updated_at: new Date().toISOString(),
      });
      await msg.reply(
        `Fitur anti-spam telah ${
          antispamStatus === 1 ? "diaktifkan" : "dinonaktifkan"
        } di grup ini!`
      );
    } catch (error) {
      botLogger.error("Error in antispam command:", error);
      await msg.reply(`Gagal mengatur anti-spam: ${error.message}`);
    }
  },
});

// Command: groupstats
global.Oblixn.cmd({
  name: "groupstats",
  alias: ["statistikgrup", "grpstats"],
  desc: "Menampilkan statistik aktivitas grup",
  category: "group",
  async exec(msg) {
    if (!msg.isGroup) {
      return await msg.reply("Perintah ini hanya bisa digunakan di grup!");
    }

    try {
      const group = await db.getGroup(msg.chat);
      if (!group) {
        return await msg.reply("Grup belum terdaftar di database!");
      }

      const stats = [
        `📈 *Statistik Grup*`,
        `Nama: ${group.group_name || "Tidak diketahui"}`,
        `Total Member: ${group.total_members || 0}`,
        `Level: ${group.level || 1}`,
        `Total XP: ${group.total_xp || 0}`,
        `XP Saat Ini: ${group.current_xp || 0}`,
        `XP untuk Level Berikutnya: ${group.xp_to_next_level || 1000}`,
        `Warnings: ${group.warnings || 0}`,
        `Status Premium: ${group.premium_status === 1 ? "Ya" : "Tidak"}`,
      ];

      await msg.reply(stats.join("\n"));
    } catch (error) {
      botLogger.error("Error in groupstats command:", error);
      await msg.reply(`Gagal mendapatkan statistik grup: ${error.message}`);
    }
  },
});
