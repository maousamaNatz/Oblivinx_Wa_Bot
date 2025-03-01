const { isAdmin, isBotAdmin, checkAdminStatus } = require('../handler/permission');
const { botLogger } = require('../utils/logger');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const prefix = process.env.PREFIX;
const langId = require('../i18n/langId');

// Map untuk cooldown
const cooldowns = new Map();

// Fungsi untuk mengecek cooldown
function checkCooldown(userId, command, cooldownTime = 3000) {
    if (cooldowns.has(`${userId}-${command}`)) {
        const cooldownExpires = cooldowns.get(`${userId}-${command}`);
        if (Date.now() < cooldownExpires) {
            return Math.ceil((cooldownExpires - Date.now()) / 1000);
        }
    }
    cooldowns.set(`${userId}-${command}`, Date.now() + cooldownTime);
    return false;
}

Oblixn.cmd({
    name: 'group',
    alias: ['grup'],
    desc: 'Mengelola pengaturan grup',
    category: 'admin',
    async exec(m, t) {
        try {
            const groupId = m.key?.remoteJid;
            if (!groupId?.endsWith('@g.us')) {
                return m.reply('Perintah ini hanya dapat digunakan dalam grup!');
            }

            const senderId = m.key?.participant || m.sender;

            // Cek cooldown
            const cooldownTime = checkCooldown(senderId, 'group');
            if (cooldownTime) {
                return m.reply(`⏳ Mohon tunggu ${cooldownTime} detik sebelum menggunakan command ini lagi.`);
            }

            // Cek status admin menggunakan fungsi baru
            const { isUserAdmin, isBotAdmin } = await checkAdminStatus(groupId, senderId);

            if (!isBotAdmin || !isUserAdmin) {
                return m.reply('❌ Bot harus menjadi admin untuk menjalankan perintah ini!');
            }

            // Dapatkan nama pengguna dari metadata grup
            if (!Oblixn.sock) {
                botLogger.error('Socket is not initialized.');
                return m.reply('❌ Bot tidak terhubung. Silakan coba lagi nanti.');
            }

            const metadata = await Oblixn.sock.groupMetadata(groupId);
            if (!metadata) {
                botLogger.error('Failed to retrieve group metadata.');
                return m.reply('❌ Gagal mendapatkan metadata grup.');
            }
            const participant = metadata.participants.find(p => p.id === senderId);
            const username = participant?.notify || participant?.pushname || senderId.split('@')[0];

            const args = t.args;
            if (!args.length) {
                await m.reply(langId.commands.group.menu
                    .replace('{username}', username)
                    .replace(/{prefix}/g, prefix)
                );
                return;
            }

            const command = args[0].toLowerCase();
            switch (command) {
                case 'open':
                case 'buka':
                    await Oblixn.sock.groupSettingUpdate(groupId, 'not_announcement');
                    await m.reply('✅ Grup telah dibuka!');
                    break;

                case 'close':
                case 'tutup':
                    await Oblixn.sock.groupSettingUpdate(groupId, 'announcement');
                    await m.reply('✅ Grup telah ditutup!');
                    break;

                case 'link':
                    const code = await Oblixn.sock.groupInviteCode(groupId);
                    await m.reply(`🔗 Link grup: https://chat.whatsapp.com/${code}`);
                    break;

                case 'revoke':
                    await Oblixn.sock.groupRevokeInvite(groupId);
                    await m.reply('✅ Link grup telah direset!');
                    break;

                case 'name':
                    if (args.length < 2) {
                        return m.reply('❌ Masukkan nama baru untuk grup!');
                    }
                    const newName = args.slice(1).join(' ');
                    await Oblixn.sock.groupUpdateSubject(groupId, newName);
                    await m.reply(`✅ Nama grup telah diubah menjadi: ${newName}`);
                    break;

                case 'desc':
                    if (args.length < 2) {
                        return m.reply('❌ Masukkan deskripsi baru untuk grup!');
                    }
                    const newDesc = args.slice(1).join(' ');
                    await Oblixn.sock.groupUpdateDescription(groupId, newDesc);
                    await m.reply('✅ Deskripsi grup telah diubah!');
                    break;

                default:
                    await m.reply(`📝 Penggunaan command grup:
▢ ${prefix}group open - Membuka grup
▢ ${prefix}group close - Menutup grup
▢ ${prefix}group link - Mendapatkan link grup
▢ ${prefix}group revoke - Mereset link grup
▢ ${prefix}group name <text> - Mengubah nama grup
▢ ${prefix}group desc <text> - Mengubah deskripsi grup`);
            }

        } catch (error) {
            botLogger.error('Error in group command:', error);
            m.reply('❌ Terjadi kesalahan saat menjalankan perintah.');
        }   
    }
}); 
// Perintah kick yang diperbaiki
Oblixn.cmd({
    name: 'kick',
    desc: 'Mengeluarkan anggota dari grup',
    category: 'admin',
    async exec(m, t) {
        try {
            const groupId = m.key?.remoteJid;
            const senderId = m.key?.participant || m.sender;
            const normalizedSenderId = senderId || '';

            if (!groupId?.endsWith('@g.us')) 
                return m.reply('Perintah ini hanya untuk grup!');
            
            const isGroupAdmin = await isAdmin(groupId, normalizedSenderId);
            const botId = m.botNumber;
            const normalizedBotId = botId || '';
            const botAdmin = await isAdmin(groupId, normalizedBotId);
            
            if (!isGroupAdmin) return m.reply('Anda harus menjadi admin!');
            if (!botAdmin) return m.reply('Bot harus menjadi admin!');
            
            if (!m.mentions?.length) return m.reply('Tag anggota yang ingin dikeluarkan!');
            
            await Oblixn.sock.groupParticipantsUpdate(groupId, m.mentions, 'remove');
            m.reply('✅ Anggota telah dikeluarkan dari grup.');
            
        } catch (error) {
            console.error('Error in kick command:', error);
            m.reply('❌ Gagal mengeluarkan anggota.');
        }
    }
});

// Command untuk hidetag yang diperbaiki
Oblixn.cmd({
    name: 'hidetag',
    alias: ['h'],
    desc: 'Mention semua member dengan pesan tersembunyi',
    category: 'admin',
    async exec(m, t) {
        try {
            const groupId = m.key?.remoteJid;
            const senderId = m.key?.participant || m.sender;
            const normalizedSenderId = senderId || '';

            if (!groupId?.endsWith('@g.us')) {
                return m.reply('Perintah ini hanya dapat digunakan di dalam grup!');
            }

            // Cek apakah pengirim adalah admin
            const isGroupAdmin = await isAdmin(groupId, normalizedSenderId);
            if (!isGroupAdmin) {
                return m.reply('Anda harus menjadi admin untuk menggunakan perintah ini!');
            }

            if (!t.args.length) {
                return m.reply('Masukkan pesan yang ingin disampaikan!');
            }

            const message = t.args.join(' ');
            const metadata = await Oblixn.sock.groupMetadata(groupId);
            const mentions = metadata.participants.map(p => p.id);
            
            await Oblixn.sock.sendMessage(groupId, { 
                text: message,
                mentions: mentions 
            });

        } catch (error) {
            console.error('Error in hidetag command:', error);
            m.reply('❌ Terjadi kesalahan saat menjalankan perintah.');
        }
    }
});

// Command untuk tagall yang diperbaiki
Oblixn.cmd({
    name: 'tagall',
    alias: ['all', 'everyone'],
    desc: 'Mention semua member dengan pesan dan daftar member',
    category: 'admin',
    async exec(m, t) {
        try {
            const groupId = m.key?.remoteJid;
            const senderId = m.key?.participant || m.sender;
            const normalizedSenderId = senderId || '';

            if (!groupId?.endsWith('@g.us')) {
                return m.reply('Perintah ini hanya dapat digunakan di dalam grup!');
            }

            // Cek apakah pengirim adalah admin
            const isGroupAdmin = await isAdmin(groupId, normalizedSenderId);
            if (!isGroupAdmin) {
                return m.reply('Anda harus menjadi admin untuk menggunakan perintah ini!');
            }

            const metadata = await Oblixn.sock.groupMetadata(groupId);
            const mentions = metadata.participants.map(p => p.id);
            
            let message = t.args.length ? t.args.join(' ') + '\n\n' : '';
            message += '👥 *Daftar Member:*\n';
            
            metadata.participants.forEach((participant, i) => {
                message += `${i + 1}. @${participant.id.split('@')[0]}\n`;
            });

            await Oblixn.sock.sendMessage(groupId, { 
                text: message,
                mentions: mentions 
            });

        } catch (error) {
            console.error('Error in tagall command:', error);
            m.reply('❌ Terjadi kesalahan saat menjalankan perintah.');
        }
    }
});

// Command untuk tag admin yang diperbaiki
Oblixn.cmd({
    name: 'tagadmin',
    alias: ['admin', 'admins'],
    desc: 'Mention semua admin grup',
    category: 'group',
    async exec(m, t) {
        try {
            const groupId = m.key?.remoteJid;

            if (!groupId?.endsWith('@g.us')) {
                return m.reply('Perintah ini hanya dapat digunakan di dalam grup!');
            }

            const metadata = await Oblixn.sock.groupMetadata(groupId);
            const admins = metadata.participants.filter(p => p.admin);
            const mentions = admins.map(a => a.id);
            
            let message = t.args.length ? t.args.join(' ') + '\n\n' : '';
            message += '👑 *Daftar Admin:*\n';
            
            admins.forEach((admin, i) => {
                message += `${i + 1}. @${admin.id.split('@')[0]}\n`;
            });

            await Oblixn.sock.sendMessage(groupId, { 
                text: message,
                mentions: mentions 
            });

        } catch (error) {
            console.error('Error in tagadmin command:', error);
            m.reply('❌ Terjadi kesalahan saat menjalankan perintah.');
        }
    }
});

// Command mute yang diperbaiki
Oblixn.cmd({
    name: 'mute',
    desc: 'Mengatur notifikasi grup',
    category: 'admin',
    async exec(m, t) {
        try {
            const groupId = m.key?.remoteJid;
            const senderId = m.key?.participant || m.sender;
            const normalizedSenderId = senderId || '';

            if (!groupId?.endsWith('@g.us')) 
                return m.reply('Perintah ini hanya untuk grup!');
            
            const isGroupAdmin = await isAdmin(groupId, normalizedSenderId);
            if (!isGroupAdmin) return m.reply('Anda harus menjadi admin!');

            // Check if sock object exists
            if (!Oblixn.sock) {
                botLogger.error('Sock object is undefined');
                return m.reply('❌ Terjadi kesalahan sistem. Bot tidak terhubung dengan benar.');
            }

            // Check if the method exists
            if (typeof Oblixn.sock.groupSettingUpdate !== 'function') {
                botLogger.error('Fungsi groupSettingUpdate tidak tersedia pada client.');
                return m.reply('❌ Fitur pengaturan grup tidak tersedia. Gunakan perintah "group open" atau "group close" sebagai alternatif.');
            }

            if (!t.args[0]) {
                return m.reply(`📝 *Penggunaan:*
▢ ${prefix}mute on - Mengaktifkan mode senyap
▢ ${prefix}mute off - Menonaktifkan mode senyap`);
            }

            const option = t.args[0].toLowerCase();
            if (option === 'on') {
                await Oblixn.sock.groupSettingUpdate(groupId, 'announcement');
                m.reply('✅ Mode senyap grup telah diaktifkan!');
            } else if (option === 'off') {
                await Oblixn.sock.groupSettingUpdate(groupId, 'not_announcement');
                m.reply('✅ Mode senyap grup telah dinonaktifkan!');
            } else {
                m.reply(`Opsi tidak valid. Gunakan '${prefix}mute on' atau '${prefix}mute off'`);
            }
        } catch (error) {
            console.error('Error in mute command:', error);
            m.reply('❌ Terjadi kesalahan saat mengatur mode senyap: ' + error.message);
            botLogger.error(error);
        }
    }
});
// Command chatmode yang diperbaiki
Oblixn.cmd({
    name: 'chatmode',
    desc: 'Mengatur siapa yang bisa mengirim pesan',
    category: 'admin',
    async exec(m, t) {
        try {
            const groupId = m.key?.remoteJid;
            const senderId = m.key?.participant || m.sender;
            const normalizedSenderId = senderId || '';

            if (!groupId?.endsWith('@g.us')) 
                return m.reply('Perintah ini hanya untuk grup!');
            
            const isGroupAdmin = await isAdmin(groupId, normalizedSenderId);
            if (!isGroupAdmin) return m.reply('Anda harus menjadi admin!');

            if (!t.args[0]) {
                return m.reply(`📝 *Penggunaan:*
▢ ${prefix}chatmode admin - Hanya admin yang bisa chat
▢ ${prefix}chatmode all - Semua member bisa chat`);
            }

            const option = t.args[0].toLowerCase();
            if (option === 'admin') {
                await Oblixn.sock.groupSettingUpdate(groupId, 'announcement');
                m.reply('✅ Sekarang hanya admin yang dapat mengirim pesan!');
            } else if (option === 'all') {
                await Oblixn.sock.groupSettingUpdate(groupId, 'not_announcement');
                m.reply('✅ Sekarang semua member dapat mengirim pesan!');
            } else {
                m.reply(`Opsi tidak valid. Gunakan '${prefix}chatmode admin' atau '${prefix}chatmode all'`);
            }
        } catch (error) {
            console.error('Error in chatmode command:', error);
            m.reply('❌ Terjadi kesalahan saat mengatur mode chat.');
        }
    }
});

// Command setppgc (set profile pic group) yang diperbaiki
Oblixn.cmd({
    name: 'setppgc',
    desc: 'Mengubah foto profil grup',
    category: 'admin',
    async exec(m, t) {
        try {
            const groupId = m.key?.remoteJid;
            
            // Validasi bahwa pesan diterima dalam grup
            if (!groupId?.endsWith('@g.us')) {
                return m.reply('Perintah ini hanya dapat digunakan dalam grup!');
            }

            // Cek permission admin
            const senderId = m.key?.participant || m.sender;
            const normalizedSenderId = senderId || '';
            const botId = m.botNumber;
            const normalizedBotId = botId || '';
            
            const [isGroupAdmin, botAdmin] = await Promise.all([
                isAdmin(groupId, normalizedSenderId),
                isAdmin(groupId, normalizedBotId)
            ]);
            
            if (!isGroupAdmin) return m.reply('Anda harus menjadi admin!');
            if (!botAdmin) return m.reply('Bot harus menjadi admin!');

            let msg;
            
            // Validasi bahwa pesan berisi media gambar
            if (m.message?.imageMessage) {
                msg = m;
            } else if (m.quoted?.message?.imageMessage) {
                msg = m.quoted;
            } else {
                return m.reply(`Kirim atau reply gambar yang ingin dijadikan foto profil grup dengan caption ${prefix}setppgc`);
            }

            m.reply('⏳ Sedang memproses gambar...');

            // Download media menggunakan fungsi downloadMediaMessage
            const mediaBuffer = await downloadMediaMessage(msg, 'buffer', {});

            if (!mediaBuffer) {
                throw new Error('Gagal mengunduh media.');
            }

            // Update foto profil grup
            await Oblixn.sock.updateProfilePicture(groupId, mediaBuffer);
            
            m.reply('✅ Foto profil grup berhasil diubah!');
            
        } catch (error) {
            console.error('Error in setppgc command:', error);
            m.reply('❌ Terjadi kesalahan saat mengubah foto profil grup: ' + error.message);
            botLogger.error(error);
        }
    }
});

// Command add yang diperbaiki
Oblixn.cmd({
    name: "add",
    alias: ["invite"],
    desc: "Menambahkan anggota ke grup",
    category: "admin",
    async exec(m, t) {
        try {
            const groupId = m.key?.remoteJid;
            
            if (!groupId?.endsWith('@g.us')) {
                return m.reply('Perintah ini hanya dapat digunakan dalam grup!');
            }
            
            // Cek permission admin
            const senderId = m.key?.participant || m.sender;
            const normalizedSenderId = senderId || '';
            const botId = m.botNumber;
            const normalizedBotId = botId || '';
            
            const [isGroupAdmin, botAdmin] = await Promise.all([
                isAdmin(groupId, normalizedSenderId),
                isAdmin(groupId, normalizedBotId)
            ]);
            
            if (!isGroupAdmin) return m.reply('Anda harus menjadi admin!');
            if (!botAdmin) return m.reply('Bot harus menjadi admin!');
            
            // Validasi input nomor
            if (!t.args[0]) return m.reply(`❌ Masukkan nomor yang akan ditambahkan! Contoh: ${prefix}add 628123456789`);

            let number = t.args[0].replace(/[^0-9]/g, '');
            
            // Tambahkan awalan 62 jika belum ada
            if (!number.startsWith('62')) {
                number = '62' + (number.startsWith('0') ? number.slice(1) : number);
            }

            // Validasi nomor WhatsApp
            const [result] = await Oblixn.sock.onWhatsApp(`${number}@s.whatsapp.net`);
            if (!result?.exists) {
                return m.reply(`❌ Nomor ${number} tidak terdaftar di WhatsApp!`);
            }

            // Tambahkan ke grup
            try {
                const response = await Oblixn.sock.groupParticipantsUpdate(
                    groupId,
                    [`${number}@s.whatsapp.net`],
                    "add"
                );

                // Handle response
                if (response[0].status === "200") {
                    m.reply(
                        `✅ Berhasil menambahkan @${number} ke dalam grup!`,
                        { mentions: [`${number}@s.whatsapp.net`] }
                    );
                } else if (response[0].status === "403") {
                    m.reply(`❌ Gagal menambahkan @${number}! Nomor tersebut mungkin telah mengatur privasi grup.`);
                } else if (response[0].status === "408") {
                    m.reply(`❌ Gagal menambahkan @${number}! Nomor tersebut tidak merespons undangan.`);
                } else if (response[0].status === "409") {
                    m.reply(`❌ @${number} sudah berada dalam grup ini.`);
                } else {
                    m.reply(`❌ Gagal menambahkan @${number}! Status: ${response[0].status}`);
                }
            } catch (err) {
                m.reply(`❌ Gagal menambahkan anggota: ${err.message}`);
                botLogger.error("Add command error:", err);
            }
        } catch (error) {
            console.error("Error in add command:", error);
            return m.reply(`❌ Terjadi kesalahan: ${error.message}`);
        }
    }
});