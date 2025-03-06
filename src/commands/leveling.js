const { botLogger } = require("../utils/logger");
const db = require("../../database/confLowDb/lowdb"); // Impor database AJV
const { formatNumber } = require("../utils/helper");

// XP Configuration
const XP_CONFIG = {
  MESSAGE: {
    BASE: 5,
    COOLDOWN: 60, // detik
    DAILY_CAP: 200,
  },
  COMMAND: {
    BASE: 10,
    DAILY_CAP: 100,
  },
  GAME: {
    WIN: 50,
    LOSE: 10,
  },
};

// Fungsi untuk menghitung XP yang dibutuhkan untuk level berikutnya
const getRequiredXP = (level) => {
  return Math.floor(100 * Math.pow(1.5, level - 1)); // Formula sederhana: 100 * (1.5^(level-1))
};

// Fungsi untuk update XP user
async function updateUserXP(userId, xp, activityType) {
  try {
    let user = await db.getUser(userId);
    if (!user) {
      const result = await db.addUser({ user_id: userId });
      user = result.data;
    }

    // Update XP sesuai jenis aktivitas
    user.experience = (user.experience || 0) + xp;
    user.total_xp = (user.total_xp || 0) + xp;
    user.daily_xp = (user.daily_xp || 0) + xp;
    user.weekly_xp = (user.weekly_xp || 0) + xp;
    user.last_message_xp = new Date().toISOString();

    // Cek level up
    let requiredXP = getRequiredXP(user.level);
    while (user.experience >= requiredXP) {
      user.experience -= requiredXP;
      user.level += 1;
      requiredXP = getRequiredXP(user.level);
      botLogger.info(`User ${userId} naik ke level ${user.level}`);
    }

    await db.updateUser(userId, {
      experience: user.experience,
      total_xp: user.total_xp,
      daily_xp: user.daily_xp,
      weekly_xp: user.weekly_xp,
      level: user.level,
      last_message_xp: user.last_message_xp,
      updated_at: new Date().toISOString(),
    });

    return true;
  } catch (error) {
    botLogger.error("Leveling error:", error);
    return false;
  }
}

// Fungsi untuk cek dan berikan achievement
async function checkAchievements(userId, activityType) {
  try {
    const allAchievements = await db
      .readDatabase()
      .then((data) => data.user_achievements || []);
    const userAchievements = allAchievements.filter(
      (ua) => ua.user_id === userId
    );

    // Contoh achievement sederhana (bisa diperluas di database)
    const achievements = [
      { id: 1, type: "message", target: 100, reward_xp: 50 },
      { id: 2, type: "command", target: 50, reward_xp: 30 },
      { id: 3, type: "game", target: 10, reward_xp: 100 },
    ].filter((a) => a.type === activityType);

    for (const achievement of achievements) {
      const userAch = userAchievements.find(
        (ua) => ua.achievement_id === achievement.id
      );
      const progress = (userAch?.progress || 0) + 1;

      if (progress >= achievement.target && !userAch?.completed) {
        await db.writeDatabase({
          user_achievements: [
            ...allAchievements.filter(
              (ua) =>
                !(ua.user_id === userId && ua.achievement_id === achievement.id)
            ),
            {
              user_id: userId,
              achievement_id: achievement.id,
              progress,
              completed: 1,
              completed_at: new Date().toISOString(),
            },
          ],
        });

        await updateUserXP(userId, achievement.reward_xp, "achievement");
        botLogger.info(
          `User ${userId} menyelesaikan achievement ${achievement.id}`
        );
      }
    }
  } catch (error) {
    botLogger.error("Achievement error:", error);
  }
}

// Fungsi untuk membuat progress bar
function createProgressBar(percentage) {
  const filled = Math.floor(percentage / 10);
  const empty = 10 - filled;
  return "▰".repeat(filled) + "▱".repeat(empty);
}

// Fungsi untuk mendapatkan ranking
async function getRank(userId) {
  try {
    const users = await db.readDatabase().then((data) => data.users || []);
    const sortedUsers = users.sort(
      (a, b) => (b.experience || 0) - (a.experience || 0)
    );
    const rank = sortedUsers.findIndex((u) => u.user_id === userId) + 1;
    return rank > 0 ? rank : "N/A";
  } catch (error) {
    botLogger.error("Error getting rank:", error);
    return "N/A";
  }
}

// Command: !level
global.Oblixn.cmd({
  name: "level",
  alias: ["rank", "xp"],
  desc: "Melihat level dan XP kamu",
  category: "rpg",
  async exec(msg) {
    try {
      const userId = msg.sender;
      const user = await db.getUser(userId);

      if (!user) {
        return await msg.reply(
          "❌ Kamu belum terdaftar! Silakan kirim pesan terlebih dahulu untuk mendaftar."
        );
      }

      const rank = await getRank(userId);
      const nextLevelXP = getRequiredXP(user.level);
      const progress = (user.experience / nextLevelXP) * 100;
      const progressBar = createProgressBar(progress);

      const levelInfo = `
🎮 *Level Info* 🎮

👤 *Username:* ${msg.pushName || userId.split("@")[0]}
📊 *Level:* ${user.level}
⭐ *XP:* ${user.experience}/${nextLevelXP}
📈 *Progress:* ${progressBar} ${Math.floor(progress)}%
🏆 *Rank:* #${rank}

💫 *Total XP:* ${user.total_xp || 0}
📅 *Daily XP:* ${user.daily_xp || 0}
📊 *Weekly XP:* ${user.weekly_xp || 0}
        `;

      await msg.reply(levelInfo);
    } catch (error) {
      botLogger.error("Error dalam command level:", error);
      await msg.reply("❌ Terjadi kesalahan saat mengambil data level.");
    }
  },
});

// Command: !leaderboard
global.Oblixn.cmd({
  name: "leaderboard",
  alias: ["lb", "top"],
  desc: "Lihat peringkat top user",
  category: "game",
  async exec(msg) {
    try {
      const users = await db.readDatabase().then((data) => data.users || []);
      const topUsers = users
        .sort((a, b) => (b.experience || 0) - (a.experience || 0))
        .slice(0, 10);

      let leaderboard = "🏆 *Leaderboard Global* 🏆\n\n";
      topUsers.forEach((user, index) => {
        leaderboard += `${index + 1}. ${
          user.username || user.user_id.split("@")[0]
        } - Level ${user.level} (${formatNumber(user.experience || 0)} XP)\n`;
      });

      await msg.reply(leaderboard);
    } catch (error) {
      botLogger.error("Leaderboard error:", error);
      await msg.reply("❌ Gagal mengambil leaderboard");
    }
  },
});

// Command: !daily
global.Oblixn.cmd({
  name: "daily",
  desc: "Klaim daily reward XP",
  category: "game",
  async exec(msg) {
    try {
      const userId = msg.sender;
      const user = await db.getUser(userId);

      if (!user) {
        return await msg.reply("❌ Kamu belum terdaftar!");
      }

      const now = new Date();
      const lastDaily = user.last_daily ? new Date(user.last_daily) : null;

      if (lastDaily && now.toDateString() === lastDaily.toDateString()) {
        return await msg.reply(
          "❌ Kamu sudah mengklaim daily reward hari ini!"
        );
      }

      const dailyXP = 100; // XP reward tetap
      await updateUserXP(userId, dailyXP, "daily");
      await db.updateUser(userId, {
        last_daily: now.toISOString(),
        updated_at: now.toISOString(),
      });

      await msg.reply(`🎁 Daily Reward!\n\n+${dailyXP} XP`);
    } catch (error) {
      botLogger.error("Daily reward error:", error);
      await msg.reply("❌ Gagal mengklaim daily reward");
    }
  },
});
