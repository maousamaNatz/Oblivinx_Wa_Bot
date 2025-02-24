const { botLogger } = require("../utils/logger");
const { pool } = require("../../config/dbConf/database");

module.exports = (Oblixn) => {
  Oblixn.cmd({
    name: "register",
    alias: ["daftar", "reg"],
    desc: "Mendaftarkan diri sebagai pengguna bot",
    category: "general",
    async exec(msg, { args }) {
      try {
        const userId = msg.sender.split("@")[0];
        let username = args ? args.join(" ") : msg.pushName || userId;

        // Cek apakah user sudah terdaftar
        const [existingUser] = await pool.execute(
          'SELECT * FROM users WHERE user_id = ?',
          [userId]
        );

        if (existingUser.length > 0) {
          return msg.reply(`❌ Kamu sudah terdaftar dengan username: *${existingUser[0].username}*\n\nGunakan command !profile untuk melihat profilmu.`);
        }

        // Validasi username
        if (username.length < 3 || username.length > 15) {
          return msg.reply("❌ Username harus antara 3-15 karakter!");
        }

        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
          return msg.reply("❌ Username hanya boleh mengandung huruf, angka, dan underscore!");
        }

        // Cek apakah username sudah dipakai
        const [existingUsername] = await pool.execute(
          'SELECT * FROM users WHERE username = ?',
          [username]
        );

        if (existingUsername.length > 0) {
          return msg.reply("❌ Username sudah dipakai! Silakan pilih username lain.");
        }

        // Daftarkan user baru
        await pool.execute(`
          INSERT INTO users (
            user_id,
            username,
            registered_at,
            level,
            experience,
            total_xp,
            daily_xp,
            weekly_xp,
            last_daily,
            last_message_xp
          ) VALUES (?, ?, NOW(), 1, 0, 0, 0, 0, NULL, NOW())
        `, [userId, username]);

        const welcomeMessage = `
🎉 *Registrasi Berhasil* 🎉

Selamat datang *${username}*!
Kamu telah terdaftar sebagai pengguna bot.

📝 *Detail Akun:*
• ID: ${userId}
• Username: ${username}
• Level: 1
• XP: 0

Gunakan command berikut:
• !help - Melihat daftar command
• !level - Cek level dan XP
• !daily - Klaim hadiah harian
• !profile - Lihat profil lengkap

Selamat bermain! 🎮
        `;

        await msg.reply(welcomeMessage);

        // Log registrasi baru
        botLogger.info(`New user registered: ${username} (${userId})`);
      } catch (error) {
        botLogger.error("Error in register command:", error);
        msg.reply("❌ Terjadi kesalahan saat mendaftar. Silakan coba lagi nanti.");
      }
    }
  });

  // Command profile untuk melihat profil user
  Oblixn.cmd({
    name: "profile",
    alias: ["profil", "me"],
    desc: "Melihat profil pengguna",
    category: "general",
    async exec(msg) {
      try {
        const userId = msg.sender.split("@")[0];
        
        const [user] = await pool.execute(`
          SELECT u.*, 
                 COUNT(a.achievement_id) as achievements,
                 RANK() OVER (ORDER BY u.experience DESC) as rank
          FROM users u
          LEFT JOIN user_achievements a ON u.user_id = a.user_id
          WHERE u.user_id = ?
          GROUP BY u.user_id
        `, [userId]);

        if (!user[0]) {
          return msg.reply(`❌ Kamu belum terdaftar!\n\nGunakan command *!register <username>* untuk mendaftar.`);
        }

        const userData = user[0];
        const nextLevelXP = config.leveling.levelFormula(userData.level);
        const progress = (userData.experience / nextLevelXP) * 100;
        const progressBar = createProgressBar(progress);
        const registeredDate = new Date(userData.registered_at).toLocaleDateString('id-ID');

        const profileMessage = `
👤 *PROFIL PENGGUNA* 👤

📝 *Username:* ${userData.username}
🆔 *User ID:* ${userData.user_id}
📅 *Terdaftar:* ${registeredDate}

📊 *Statistik:*
• Level: ${userData.level}
• XP: ${userData.experience}/${nextLevelXP}
• Progress: ${progressBar} (${Math.floor(progress)}%)
• Rank: #${userData.rank}
• Total XP: ${userData.total_xp}
• Achievement: ${userData.achievements}

📈 *XP Harian:* ${userData.daily_xp}
📊 *XP Mingguan:* ${userData.weekly_xp}

Gunakan command !leaderboard untuk melihat peringkat global!
        `;

        await msg.reply(profileMessage);
      } catch (error) {
        botLogger.error("Error in profile command:", error);
        msg.reply("❌ Terjadi kesalahan saat mengambil profil.");
      }
    }
  });
};

function createProgressBar(percentage) {
  const filled = Math.floor(percentage / 10);
  const empty = 10 - filled;
  return "▰".repeat(filled) + "▱".repeat(empty);
} 