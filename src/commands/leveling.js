const { botLogger } = require("../utils/logger");
const { pool } = require('../../config/dbConf/database');
const { formatNumber } = require('../utils/helper');
const { config } = require("../../config/config");

// XP Configuration
const XP_CONFIG = {
  MESSAGE: {
    BASE: 5,
    COOLDOWN: 60, // detik
    DAILY_CAP: 200
  },
  COMMAND: {
    BASE: 10,
    DAILY_CAP: 100
  },
  GAME: {
    WIN: 50,
    LOSE: 10
  }
};

// Fungsi untuk update XP user
async function updateUserXP(userId, xp, activityType) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Update leveling data
    await connection.execute(`
      UPDATE users 
      SET 
        experience = experience + ?,
        total_xp = total_xp + ?,
        daily_xp = daily_xp + ?,
        weekly_xp = weekly_xp + ?,
        last_message_xp = NOW()
      WHERE user_id = ?
    `, [xp, xp, xp, xp, userId]);

    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    botLogger.error('Leveling error:', error);
    return false;
  } finally {
    connection.release();
  }
}

// Fungsi untuk cek dan berikan achievement
async function checkAchievements(userId, activityType) {
  try {
    const [achievements] = await pool.execute(`
      SELECT a.*, ua.progress 
      FROM achievements a
      LEFT JOIN user_achievements ua 
        ON a.id = ua.achievement_id AND ua.user_id = ?
      WHERE a.type = ?
    `, [userId, activityType]);

    for (const achievement of achievements) {
      if (!achievement.progress) continue;
      
      const newProgress = achievement.progress + 1;
      if (newProgress >= achievement.target && !achievement.completed) {
        await pool.execute(`
          INSERT INTO user_achievements 
          (user_id, achievement_id, progress, completed, completed_at)
          VALUES (?, ?, ?, 1, NOW())
          ON DUPLICATE KEY UPDATE
          progress = VALUES(progress),
          completed = VALUES(completed),
          completed_at = VALUES(completed_at)
        `, [userId, achievement.id, newProgress]);

        // Berikan reward XP
        await updateUserXP(userId, achievement.reward_xp, 'achievement');
      }
    }
  } catch (error) {
    botLogger.error('Achievement error:', error);
  }
}

function createProgressBar(percentage) {
  const filled = Math.floor(percentage / 10);
  const empty = 10 - filled;
  return "▰".repeat(filled) + "▱".repeat(empty);
}

async function getRank(userId) {
  const [ranks] = await pool.execute(`
    SELECT user_id, RANK() OVER (ORDER BY experience DESC) as rank
    FROM users
  `);
  
  const userRank = ranks.find(r => r.user_id === userId);
  return userRank ? userRank.rank : "N/A";
}

module.exports = (Oblixn) => {
  // Command: !level
  Oblixn.cmd({
    name: "level",
    alias: ["rank", "xp"],
    desc: "Melihat level dan XP kamu",
    category: "rpg",
    async exec(msg) {
      try {
        const userId = msg.sender.split("@")[0];
        const [user] = await pool.execute(
          'SELECT * FROM users WHERE user_id = ?',
          [userId]
        );

        if (!user) {
          return msg.reply("❌ Kamu belum terdaftar! Silakan kirim pesan terlebih dahulu untuk mendaftar.");
        }

        const rank = await getRank(userId);
        const nextLevelXP = config.leveling.levelFormula(user.level);
        const progress = (user.experience / nextLevelXP) * 100;
        const progressBar = createProgressBar(progress);

        const levelInfo = `
🎮 *Level Info* 🎮

👤 *Username:* ${msg.pushName || userId}
📊 *Level:* ${user.level}
⭐ *XP:* ${user.experience}/${nextLevelXP}
📈 *Progress:* ${progressBar} ${Math.floor(progress)}%
🏆 *Rank:* #${rank}

💫 *Total XP:* ${user.total_xp}
📅 *Daily XP:* ${user.daily_xp}
📊 *Weekly XP:* ${user.weekly_xp}
        `;

        await msg.reply(levelInfo);
      } catch (error) {
        botLogger.error("Error dalam command level:", error);
        await msg.reply("❌ Terjadi kesalahan saat mengambil data level.");
      }
    }
  });

  // Command: !leaderboard
  Oblixn.cmd({
    name: "leaderboard",
    alias: ["lb", "top"],
    desc: "Lihat peringkat top user",
    category: "game",
    async exec(msg) {
      try {
        const [topUsers] = await pool.execute(`
          SELECT username, level, experience as total_xp
          FROM users
          ORDER BY experience DESC
          LIMIT 10
        `);

        let leaderboard = "🏆 *Leaderboard Global* 🏆\n\n";
        topUsers.forEach((user, index) => {
          leaderboard += `${index + 1}. ${user.username || 'User'} - Level ${user.level} (${formatNumber(user.total_xp)} XP)\n`;
        });

        await msg.reply(leaderboard);
      } catch (error) {
        botLogger.error('Leaderboard error:', error);
        msg.reply("❌ Gagal mengambil leaderboard");
      }
    }
  });

  // Command: !daily
  Oblixn.cmd({
    name: "daily",
    desc: "Klaim daily reward XP",
    category: "game",
    async exec(msg) {
      try {
        const userId = msg.sender.split("@")[0];
        const [user] = await pool.execute(
          'SELECT last_daily FROM users WHERE user_id = ?',
          [userId]
        );

        if (!user) {
          return msg.reply("❌ Kamu belum terdaftar!");
        }

        const now = new Date();
        const lastDaily = user.last_daily ? new Date(user.last_daily) : null;
        
        if (lastDaily && now.getDate() === lastDaily.getDate()) {
          return msg.reply("❌ Kamu sudah mengklaim daily reward hari ini!");
        }

        const dailyXP = 100; // XP reward tetap
        await updateUserXP(userId, dailyXP, 'daily');
        await pool.execute(
          'UPDATE users SET last_daily = NOW() WHERE user_id = ?',
          [userId]
        );

        await msg.reply(`🎁 Daily Reward!\n\n+${dailyXP} XP`);
      } catch (error) {
        botLogger.error('Daily reward error:', error);
        msg.reply("❌ Gagal mengklaim daily reward");
      }
    }
  });
}; 