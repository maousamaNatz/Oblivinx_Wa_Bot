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

// Fungsi untuk normalisasi ID (menghilangkan @s.whatsapp.net)
function normalizeUserId(userId) {
  if (!userId) return null;
  return userId.split('@')[0];
}

// Fungsi untuk update XP user
async function updateUserXP(userId, xp, activityType) {
  try {
    // Normalisasi ID
    const normalizedId = normalizeUserId(userId);
    if (!normalizedId) {
      botLogger.error("Invalid userId for XP update");
      return false;
    }
    
    let user = await db.getUser(normalizedId);
    if (!user) {
      const result = await db.addUser({ user_id: normalizedId });
      user = result.data;
      botLogger.info(`Created new user ${normalizedId} for XP tracking`);
    }

    // Update XP sesuai jenis aktivitas
    user.experience = (user.experience || 0) + xp;
    user.total_xp = (user.total_xp || 0) + xp;
    user.daily_xp = (user.daily_xp || 0) + xp;
    user.weekly_xp = (user.weekly_xp || 0) + xp;
    user.last_message_xp = new Date().toISOString();

    // Cek level up
    let requiredXP = getRequiredXP(user.level || 1);
    let leveledUp = false;
    let newLevel = user.level || 1;
    
    while (user.experience >= requiredXP) {
      user.experience -= requiredXP;
      newLevel += 1;
      leveledUp = true;
      requiredXP = getRequiredXP(newLevel);
      botLogger.info(`User ${normalizedId} naik ke level ${newLevel}`);
    }

    // Update user data
    await db.updateUser(normalizedId, {
      experience: user.experience,
      total_xp: user.total_xp,
      daily_xp: user.daily_xp,
      weekly_xp: user.weekly_xp,
      level: newLevel,
      last_message_xp: user.last_message_xp,
      updated_at: new Date().toISOString(),
    });

    return { success: true, leveledUp, newLevel };
  } catch (error) {
    botLogger.error("Leveling error:", error);
    return { success: false, error: error.message };
  }
}

// Fungsi untuk update data user di user_leveling
async function ensureUserLeveling(userId) {
  try {
    // Normalisasi ID
    const normalizedId = normalizeUserId(userId);
    if (!normalizedId) {
      botLogger.error("Invalid userId for ensureUserLeveling");
      return false;
    }
    
    // Dapatkan user dari database
    const user = await db.getUser(normalizedId);
    if (!user) {
      botLogger.warn(`User ${normalizedId} tidak ditemukan untuk ditambahkan ke user_leveling`);
      
      // Buat user baru jika tidak ada
      try {
        const newUser = {
          user_id: normalizedId,
          username: normalizedId,
          experience: 0,
          level: 1,
          total_xp: 0,
          daily_xp: 0,
          weekly_xp: 0,
          total_messages: 0,
          total_feature_usage: 0,
          game_played: 0,
          daily_streak: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        
        await db.addUser(newUser);
        botLogger.info(`Created new user ${normalizedId} in ensureUserLeveling`);
        return true;
      } catch (addError) {
        botLogger.error(`Error creating user: ${addError.message}`);
        return false;
      }
    }
    
    return true;
  } catch (error) {
    botLogger.error("Error ensuring user leveling data:", error);
    return false;
  }
}

// Fungsi alternatif untuk mendapatkan semua user
async function getAllUsersAlternative() {
  try {
    // Coba menggunakan fungsi getAllUsers jika tersedia
    if (typeof db.getAllUsers === 'function') {
      const users = await db.getAllUsers();
      return users;
    }
    
    // Coba menggunakan fungsi getUsers jika tersedia
    if (typeof db.getUsers === 'function') {
      const users = await db.getUsers();
      return users;
    }
    
    // Fallback: coba dapatkan daftar user IDs dari database langsung
    // Catatan: ini tergantung pada implementasi database
    if (typeof db.getUserIds === 'function') {
      const userIds = await db.getUserIds();
      const users = [];
      for (const id of userIds) {
        const user = await db.getUser(id);
        if (user) users.push(user);
      }
      return users;
    }
    
    // Fallback terakhir: cek di struktur database lain
    // Log error dan gunakan array kosong jika tidak ada opsi lain
    botLogger.warn("Tidak ada metode yang tersedia untuk mendapatkan semua user!");
    return [];
  } catch (error) {
    botLogger.error("Error getting all users:", error);
    return [];
  }
}

// Fungsi untuk mendapatkan ranking
async function getRank(userId) {
  try {
    // Normalisasi ID
    const normalizedId = normalizeUserId(userId);
    if (!normalizedId) return "N/A";
    
    // Dapatkan semua user
    const users = await getAllUsersAlternative();
    if (!users || users.length === 0) {
      botLogger.warn("getAllUsers returned empty data, ranking tidak dapat ditentukan");
      return "N/A";
    }
    
    // Urutkan berdasarkan total_xp
    const sortedUsers = users.sort(
      (a, b) => (b.total_xp || 0) - (a.total_xp || 0)
    );
    
    // Cari peringkat user
    const rank = sortedUsers.findIndex((u) => normalizeUserId(u.user_id) === normalizedId) + 1;
    return rank > 0 ? rank : "N/A";
  } catch (error) {
    botLogger.error("Error getting rank:", error);
    return "N/A";
  }
}

// Sistem Achievement
const ACHIEVEMENTS = [
  { id: "msg100", name: "Chatter Box", type: "message", target: 100, reward_xp: 50, description: "Kirim 100 pesan" },
  { id: "msg500", name: "Social Butterfly", type: "message", target: 500, reward_xp: 150, description: "Kirim 500 pesan" },
  { id: "msg1000", name: "Komunikator", type: "message", target: 1000, reward_xp: 300, description: "Kirim 1000 pesan" },
  { id: "cmd50", name: "Command Master", type: "command", target: 50, reward_xp: 100, description: "Gunakan 50 perintah" },
  { id: "cmd100", name: "Power User", type: "command", target: 100, reward_xp: 200, description: "Gunakan 100 perintah" },
  { id: "game10", name: "Casual Gamer", type: "game", target: 10, reward_xp: 80, description: "Mainkan game 10 kali" },
  { id: "game50", name: "Game Addict", type: "game", target: 50, reward_xp: 200, description: "Mainkan game 50 kali" },
  { id: "game100", name: "Pro Gamer", type: "game", target: 100, reward_xp: 350, description: "Mainkan game 100 kali" },
  { id: "daily7", name: "Week Streak", type: "daily", target: 7, reward_xp: 300, description: "Klaim daily reward 7 hari berturut-turut" },
  { id: "daily30", name: "Month Streak", type: "daily", target: 30, reward_xp: 1000, description: "Klaim daily reward 30 hari berturut-turut" },
  { id: "lvl5", name: "Apprentice", type: "level", target: 5, reward_xp: 200, description: "Capai level 5" },
  { id: "lvl10", name: "Expert", type: "level", target: 10, reward_xp: 500, description: "Capai level 10" },
];

// Fungsi untuk cek dan berikan achievement
async function checkAchievements(userId, activityType) {
  try {
    // Normalisasi ID
    const normalizedId = normalizeUserId(userId);
    if (!normalizedId) {
      botLogger.error("Invalid userId for checkAchievements");
      return { earned: false, error: "Invalid user ID" };
    }
    
    // Dapatkan data user
    const user = await db.getUser(normalizedId);
    if (!user) {
      botLogger.warn(`User ${normalizedId} tidak ditemukan untuk checkAchievements`);
      return { earned: false, error: "User not found" };
    }
    
    // Dapatkan atau buat objek achievements user
    const userAchievements = user.achievements || {};
    
    // Siapkan data aktivitas user dengan nilai default jika tidak ada
    const activityCount = {
      message: user.total_messages || 0,
      command: user.total_feature_usage || 0,
      game: user.game_played || 0,
      daily: user.daily_streak || 0,
      level: user.level || 1
    };
    
    // Log data aktivitas untuk debugging
    botLogger.info(`Activity check for ${normalizedId} - Type: ${activityType}, Count: ${activityCount[activityType]}`);
    
    // Filter achievement berdasarkan tipe aktivitas
    let eligibleAchievements = [];
    if (activityType === 'all') {
      // Periksa semua jenis achievement
      eligibleAchievements = ACHIEVEMENTS;
    } else {
      // Hanya periksa achievement sesuai tipe aktivitas
      eligibleAchievements = ACHIEVEMENTS.filter(a => a.type === activityType);
    }
    
    let earnedXP = 0;
    let newAchievements = [];
    
    for (const achievement of eligibleAchievements) {
      // Skip jika achievement sudah diperoleh
      if (userAchievements[achievement.id]) continue;
      
      // Cek apakah target tercapai
      const activityValue = activityCount[achievement.type] || 0;
      
      if (activityValue >= achievement.target) {
        // Tandai achievement sebagai diperoleh
        userAchievements[achievement.id] = {
          earned: true,
          earned_at: new Date().toISOString()
        };
        
        earnedXP += achievement.reward_xp;
        newAchievements.push(achievement);
        
        botLogger.info(`User ${normalizedId} earned achievement: ${achievement.name} (${achievement.type}: ${activityValue}/${achievement.target})`);
      }
    }
    
    // Update database jika ada achievement baru
    if (newAchievements.length > 0) {
      await db.updateUser(normalizedId, {
        achievements: userAchievements,
        updated_at: new Date().toISOString()
      });
      
      // Berikan XP reward
      if (earnedXP > 0) {
        await updateUserXP(normalizedId, earnedXP, "achievement");
      }
      
      return {
        earned: true,
        achievements: newAchievements,
        xp: earnedXP
      };
    }
    
    return { earned: false };
  } catch (error) {
    botLogger.error("Achievement error:", error);
    return { earned: false, error: error.message };
  }
}

// Fungsi untuk membuat progress bar
function createProgressBar(percentage) {
  const filled = Math.floor(percentage / 10);
  const empty = 10 - filled;
  return "▰".repeat(filled) + "▱".repeat(empty);
}

// Fungsi untuk mencatat aktivitas user
async function trackUserActivity(userId, activityType, amount = 1) {
  try {
    // Normalisasi ID
    const normalizedId = normalizeUserId(userId);
    if (!normalizedId) return { updated: false, error: "Invalid user ID" };
    
    // Dapatkan user dari database
    const user = await db.getUser(normalizedId);
    if (!user) {
      botLogger.warn(`User ${normalizedId} tidak ditemukan untuk tracking aktivitas`);
      // Buat user baru
      await ensureUserLeveling(normalizedId);
      return { updated: false, error: "User not found" };
    }
    
    // Update counter sesuai tipe aktivitas
    const update = {};
    
    switch(activityType) {
      case 'message':
        update.total_messages = (user.total_messages || 0) + amount;
        break;
      case 'command':
        update.total_feature_usage = (user.total_feature_usage || 0) + amount;
        break;
      case 'game':
        update.game_played = (user.game_played || 0) + amount;
        break;
      case 'daily':
        update.daily_streak = (user.daily_streak || 0) + amount;
        break;
    }
    
    // Update terakhir digunakan
    update.updated_at = new Date().toISOString();
    
    // Update database
    await db.updateUser(normalizedId, update);
    
    // Cek achievement setiap kali ada aktivitas
    const achievementResult = await checkAchievements(normalizedId, activityType);
    
    // Berikan notifikasi jika mendapat achievement baru
    if (achievementResult.earned && achievementResult.achievements.length > 0) {
      return {
        updated: true,
        achievements: achievementResult.achievements,
        xp: achievementResult.xp
      };
    }
    
    return { updated: true };
  } catch (error) {
    botLogger.error(`Error tracking ${activityType} activity:`, error);
    return { updated: false, error: error.message };
  }
}

// Command: !level
global.Oblixn.cmd({
  name: "level",
  alias: ["rank", "xp"],
  desc: "Melihat level dan XP kamu",
  category: "rpg",
  async exec(msg, { args, sock }) {
    try {
      const userId = msg.sender;
      const normalizedId = normalizeUserId(userId);
      
      if (!normalizedId) {
        return await msg.reply("❌ Format ID tidak valid!");
      }
      
      // Pastikan data user ada di database
      await ensureUserLeveling(normalizedId);
      
      // Ambil data user
      const user = await db.getUser(normalizedId);
      if (!user) {
        return await msg.reply(
          "❌ Kamu belum terdaftar! Silakan kirim pesan terlebih dahulu untuk mendaftar."
        );
      }

      // Dapatkan data tambahan
      const rank = await getRank(normalizedId);
      const nextLevelXP = getRequiredXP(user.level || 1);
      const currentXP = user.experience || 0;
      const progress = (currentXP / nextLevelXP) * 100;
      const progressBar = createProgressBar(progress);

      const levelInfo = `
🎮 *Level Info* 🎮

👤 *Username:* ${msg.pushName || normalizedId}
📊 *Level:* ${user.level || 1}
⭐ *XP:* ${currentXP}/${nextLevelXP}
📈 *Progress:* ${progressBar} ${Math.floor(progress)}%
🏆 *Rank:* #${rank}

💫 *Total XP:* ${user.total_xp || 0}
📅 *Daily XP:* ${user.daily_xp || 0}
📊 *Weekly XP:* ${user.weekly_xp || 0}

🎯 *Aktivitas:*
📝 Pesan: ${user.total_messages || 0}
🎮 Games: ${user.game_played || 0}
⌨️ Commands: ${user.total_feature_usage || 0}
        `;

      await msg.reply(levelInfo);
    } catch (error) {
      botLogger.error("Error dalam command level:", error);
      await msg.reply("❌ Terjadi kesalahan saat mengambil data level: " + error.message);
    }
  },
});

// Command: !leaderboard
global.Oblixn.cmd({
  name: "leaderboard",
  alias: ["lb", "top"],
  desc: "Lihat peringkat top level pengguna",
  category: "game",
  async exec(msg, { args, sock }) {
    try {
      // Pastikan data pengirim ada di database
      const normalizedId = normalizeUserId(msg.sender);
      if (normalizedId) {
        await ensureUserLeveling(normalizedId);
      }
      
      // Dapatkan semua user
      const users = await getAllUsersAlternative();
      
      if (!users || users.length === 0) {
        return await msg.reply("❌ Belum ada data leaderboard yang tersedia");
      }
      
      // Urutkan user berdasarkan level dan total XP
      const topUsers = users
        .sort((a, b) => {
          // Prioritas utama: level
          const levelDiff = (b.level || 0) - (a.level || 0);
          // Jika level sama, sortir berdasarkan total XP
          return levelDiff !== 0 ? levelDiff : (b.total_xp || 0) - (a.total_xp || 0);
        })
        .slice(0, 10);

      if (topUsers.length === 0) {
        return await msg.reply("❌ Belum ada data di leaderboard");
      }

      // Buat judul untuk leaderboard
      let leaderboard = `🏆 *TOP LEVEL LEADERBOARD* 🏆\n\n`;
      
      // Cek peringkat pengirim pesan
      let senderRank = "N/A";
      if (normalizedId) {
        const allSorted = [...users].sort((a, b) => {
          const levelDiff = (b.level || 0) - (a.level || 0);
          return levelDiff !== 0 ? levelDiff : (b.total_xp || 0) - (a.total_xp || 0);
        });
        
        senderRank = allSorted.findIndex(u => normalizeUserId(u.user_id) === normalizedId) + 1;
      }
      
      // Tambahkan emoji sesuai peringkat
      const rankEmojis = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];
      
      // Tampilkan 10 user teratas
      topUsers.forEach((user, index) => {
        // Pastikan semua nilai ada
        const username = user.username || normalizeUserId(user.user_id) || `User ${index + 1}`;
        const level = user.level || 1;
        const totalXp = formatNumber(user.total_xp || 0);
        const rankEmoji = rankEmojis[index] || `${index + 1}.`;
        
        // Tampilkan informasi tambahan
        const nextLevelXP = getRequiredXP(level);
        const progress = Math.floor((user.experience || 0) / nextLevelXP * 100);
        
        // Highlight user yang sedang melihat leaderboard
        const isCurrentUser = normalizedId && normalizeUserId(user.user_id) === normalizedId;
        const userPrefix = isCurrentUser ? '👉 ' : '';
        
        // Format entri leaderboard
        leaderboard += `${userPrefix}${rankEmoji} *${username}*\n`;
        leaderboard += `   Level: ${level} | XP: ${totalXp}\n`;
        leaderboard += `   Progress: ${progress}% ke Level ${level + 1}\n\n`;
      });
      
      // Tambahkan peringkat pengirim pesan jika tidak masuk top 10
      if (normalizedId && senderRank > 10) {
        const senderUser = users.find(u => normalizeUserId(u.user_id) === normalizedId);
        if (senderUser) {
          const level = senderUser.level || 1;
          const totalXp = formatNumber(senderUser.total_xp || 0);
          const nextLevelXP = getRequiredXP(level);
          const progress = Math.floor((senderUser.experience || 0) / nextLevelXP * 100);
          
          leaderboard += `\n...\n\n`;
          leaderboard += `👉 *Peringkatmu: #${senderRank}*\n`;
          leaderboard += `   Level: ${level} | XP: ${totalXp}\n`;
          leaderboard += `   Progress: ${progress}% ke Level ${level + 1}\n`;
        }
      }
      
      // Tambahkan tips
      leaderboard += `\n💡 *Tips*: Dapatkan XP dengan mengirim pesan, bermain game, dan menggunakan perintah bot.`;

      await msg.reply(leaderboard);
    } catch (error) {
      botLogger.error("Leaderboard error:", error);
      await msg.reply("❌ Gagal mengambil leaderboard: " + error.message);
    }
  },
});

// Command: !daily
global.Oblixn.cmd({
  name: "daily",
  desc: "Klaim daily reward XP",
  category: "game",
  async exec(msg, { args, sock }) {
    try {
      const userId = msg.sender;
      const normalizedId = normalizeUserId(userId);
      
      if (!normalizedId) {
        return await msg.reply("❌ Format ID tidak valid!");
      }
      
      // Pastikan data user ada di user_leveling
      await ensureUserLeveling(normalizedId);
      
      const user = await db.getUser(normalizedId);
      if (!user) {
        return await msg.reply("❌ Kamu belum terdaftar!");
      }

      const now = new Date();
      const lastDaily = user.last_daily ? new Date(user.last_daily) : null;

      if (lastDaily && now.toDateString() === lastDaily.toDateString()) {
        // Hitung waktu reset (besok pukul 00:00)
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        
        const timeLeft = tomorrow - now;
        const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
        const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        
        return await msg.reply(
          `❌ Kamu sudah mengklaim daily reward hari ini!\nCoba lagi dalam ${hoursLeft} jam ${minutesLeft} menit.`
        );
      }

      // Periksa daily streak
      let streak = 1;
      let streakBonus = 0;
      
      if (lastDaily) {
        // Periksa apakah daily reward diklaim kemarin
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (lastDaily.toDateString() === yesterday.toDateString()) {
          // Streak berlanjut
          streak = (user.daily_streak || 0) + 1;
          // Bonus 10 XP per hari streak, maksimal 100
          streakBonus = Math.min(streak * 10, 100);
        } else {
          // Streak terputus
          streak = 1;
          botLogger.info(`Daily streak reset for ${normalizedId} - last claim: ${lastDaily.toDateString()}`);
        }
      }

      // Basic XP + streak bonus
      const dailyXP = 100 + streakBonus; 
      
      // Update XP dan data user secara bersamaan
      const xpResult = await updateUserXP(normalizedId, dailyXP, "daily");
      
      // Update data user
      await db.updateUser(normalizedId, {
        last_daily: now.toISOString(),
        daily_streak: streak,
        updated_at: now.toISOString(),
      });
      
      // Track aktivitas daily untuk achievement
      const activityResult = await trackUserActivity(normalizedId, "daily");
      
      // Buat pesan reward
      let rewardMessage = `🎁 *Daily Reward!*\n\n`;
      rewardMessage += `💰 XP Dasar: +100\n`;
      
      if (streakBonus > 0) {
        rewardMessage += `🔥 Streak Bonus (${streak} hari): +${streakBonus}\n`;
      }
      
      rewardMessage += `📊 Total: +${dailyXP} XP\n`;
      
      // Pesan streak
      if (streak > 1) {
        rewardMessage += `\n🔄 Streak saat ini: ${streak} hari\n`;
        
        // Tampilkan informasi streak selanjutnya jika ada
        const nextStreakAchievement = ACHIEVEMENTS.find(a => 
          a.type === 'daily' && a.target > streak && 
          (!userAchievements || !userAchievements[a.id])
        );
        
        if (nextStreakAchievement) {
          const daysLeft = nextStreakAchievement.target - streak;
          rewardMessage += `🎯 ${daysLeft} hari lagi untuk achievement "${nextStreakAchievement.name}"!\n`;
        }
      }
      
      // Tampilkan achievement yang diperoleh
      if (activityResult.achievements && activityResult.achievements.length > 0) {
        rewardMessage += `\n🏆 *Achievement Baru!*\n`;
        for (const ach of activityResult.achievements) {
          rewardMessage += `✨ ${ach.name}: +${ach.reward_xp} XP\n`;
        }
      }
      
      // Notifikasi level up jika ada
      if (xpResult.leveledUp) {
        rewardMessage += `\n🎖️ *LEVEL UP!* 🎖️\n`;
        rewardMessage += `Selamat! Level kamu naik menjadi *Level ${xpResult.newLevel}*\n`;
        
        // Periksa achievement level
        await checkAchievements(normalizedId, 'level');
      }

      await msg.reply(rewardMessage);
    } catch (error) {
      botLogger.error("Daily reward error:", error);
      await msg.reply("❌ Gagal mengklaim daily reward: " + error.message);
    }
  },
});

// Command: !achievements
global.Oblixn.cmd({
  name: "achievements",
  alias: ["achievement", "ach"],
  desc: "Lihat achievement yang kamu dapatkan",
  category: "rpg",
  async exec(msg, { args, sock }) {
    try {
      const userId = msg.sender;
      const normalizedId = normalizeUserId(userId);
      
      if (!normalizedId) {
        return await msg.reply("❌ Format ID tidak valid!");
      }
      
      await ensureUserLeveling(normalizedId);
      
      const user = await db.getUser(normalizedId);
      if (!user) {
        return await msg.reply("❌ Kamu belum terdaftar!");
      }
      
      // Dapatkan achievement user
      const userAchievements = user.achievements || {};
      
      // Buat pesan
      let message = "🏆 *Achievement List* 🏆\n\n";
      
      // Hitung jumlah achievement yang sudah diperoleh
      let earnedCount = 0;
      
      // Grupkan achievements berdasarkan kategori
      const categories = {
        message: "💬 Pesan",
        command: "⌨️ Perintah",
        game: "🎮 Game",
        daily: "📅 Daily",
        level: "📊 Level"
      };
      
      // Buat grup
      const groupedAchievements = {};
      for (const type in categories) {
        groupedAchievements[type] = ACHIEVEMENTS.filter(a => a.type === type);
      }
      
      // Loop setiap kategori
      for (const type in categories) {
        const achievements = groupedAchievements[type];
        if (achievements.length > 0) {
          message += `\n*${categories[type]}*\n`;
          
          // Loop achievements dalam kategori
          for (const ach of achievements) {
            const isEarned = userAchievements[ach.id]?.earned || false;
            if (isEarned) earnedCount++;
            
            // Tampilkan status achievement
            message += `${isEarned ? '✅' : '❌'} *${ach.name}*\n`;
            message += `   ${ach.description}\n`;
            
            // Tampilkan progres jika belum dicapai
            if (!isEarned) {
              const activityType = ach.type;
              const currentValue = user[{
                message: 'total_messages',
                command: 'total_feature_usage',
                game: 'game_played',
                daily: 'daily_streak',
                level: 'level'
              }[activityType]] || 0;
              
              const progress = Math.min(Math.floor((currentValue / ach.target) * 100), 99);
              message += `   Progres: ${currentValue}/${ach.target} (${progress}%)\n`;
            }
            
            message += `   Reward: ${ach.reward_xp} XP\n\n`;
          }
        }
      }
      
      // Tampilkan progres keseluruhan
      message += `\n📈 *Progress Total*: ${earnedCount}/${ACHIEVEMENTS.length} (${Math.floor(earnedCount / ACHIEVEMENTS.length * 100)}%)`;
      
      await msg.reply(message);
    } catch (error) {
      botLogger.error("Achievement command error:", error);
      await msg.reply("❌ Gagal mengambil data achievement: " + error.message);
    }
  }
});

// Command: !resetlevel (admin only)
global.Oblixn.cmd({
  name: "resetlevel",
  desc: "Reset level pengguna (admin only)",
  category: "owner",
  async exec(msg, { args, sock }) {
    try {
      // Cek apakah pengguna adalah admin
      if (!global.Oblixn.isOwner(msg.sender)) {
        return await msg.reply("❌ Hanya admin yang dapat menggunakan perintah ini!");
      }
      
      // Cek apakah ada target user
      if (!args || args.length === 0) {
        return await msg.reply("❌ Format: !resetlevel <user_id>");
      }
      
      // Ambil target user
      let targetUser = args[0];
      if (targetUser.includes("@")) {
        targetUser = normalizeUserId(targetUser);
      }
      
      // Reset level dan XP user
      await db.updateUser(targetUser, {
        experience: 0,
        level: 1,
        total_xp: 0,
        daily_xp: 0,
        weekly_xp: 0,
        updated_at: new Date().toISOString(),
      });
      
      await msg.reply(`✅ Level dan XP user ${targetUser} telah direset ke level 1`);
    } catch (error) {
      botLogger.error("Reset level error:", error);
      await msg.reply("❌ Gagal reset level: " + error.message);
    }
  }
});

// Ekspor fungsi untuk digunakan di file lain
global.Oblixn.trackUserActivity = trackUserActivity;
global.Oblixn.updateUserXP = updateUserXP;
global.Oblixn.getRequiredXP = getRequiredXP;
global.Oblixn.checkAchievements = checkAchievements;

// Sistem Level Roles - Tingkatan berdasarkan level user
const LEVEL_ROLES = [
  { level: 1, role: "Pemula", emoji: "🌱", bonus: 0 },
  { level: 5, role: "Petualang", emoji: "🗺️", bonus: 5 },
  { level: 10, role: "Veteran", emoji: "⚔️", bonus: 10 },
  { level: 15, role: "Master", emoji: "🎯", bonus: 15 },
  { level: 20, role: "Grand Master", emoji: "👑", bonus: 20 },
  { level: 25, role: "Legend", emoji: "🏆", bonus: 25 },
  { level: 30, role: "Mythical", emoji: "🌟", bonus: 30 },
  { level: 40, role: "Immortal", emoji: "⚡", bonus: 40 },
  { level: 50, role: "Divine", emoji: "🔱", bonus: 50 },
];

// Fungsi untuk mendapatkan role berdasarkan level
function getLevelRole(level) {
  // Default role
  let role = LEVEL_ROLES[0];
  
  // Temukan role tertinggi yang dimiliki
  for (let i = LEVEL_ROLES.length - 1; i >= 0; i--) {
    if (level >= LEVEL_ROLES[i].level) {
      role = LEVEL_ROLES[i];
      break;
    }
  }
  
  return role;
}

// Command: !roles - Menampilkan daftar role dan benefitnya
global.Oblixn.cmd({
  name: "roles",
  alias: ["levelroles", "ranks"],
  desc: "Lihat daftar role berdasarkan level",
  category: "rpg",
  async exec(msg, { args, sock }) {
    try {
      const userId = msg.sender;
      const normalizedId = normalizeUserId(userId);
      
      // Pastikan data user ada di database
      if (normalizedId) {
        await ensureUserLeveling(normalizedId);
      }
      
      // Ambil data user untuk menunjukkan role saat ini
      let userRole = null;
      if (normalizedId) {
        const user = await db.getUser(normalizedId);
        if (user) {
          userRole = getLevelRole(user.level || 1);
        }
      }
      
      // Buat pesan daftar role
      let rolesMessage = "🔰 *DAFTAR LEVEL ROLES* 🔰\n\n";
      rolesMessage += "Level up untuk mendapatkan role yang lebih tinggi dan bonus XP!\n\n";
      
      for (const role of LEVEL_ROLES) {
        const isUserRole = userRole && userRole.level === role.level;
        const prefix = isUserRole ? "👉 " : "   ";
        
        rolesMessage += `${prefix}${role.emoji} *${role.role}* (Level ${role.level}+)\n`;
        rolesMessage += `   Bonus XP: +${role.bonus}% untuk semua aktivitas\n\n`;
      }
      
      if (userRole) {
        rolesMessage += `\n🎖️ *Role Kamu Saat Ini:* ${userRole.emoji} ${userRole.role}\n`;
        rolesMessage += `📊 Bonus XP: +${userRole.bonus}%\n`;
      }

      await msg.reply(rolesMessage);
    } catch (error) {
      botLogger.error("Level roles error:", error);
      await msg.reply("❌ Gagal mendapatkan daftar roles: " + error.message);
    }
  }
});

// Sistem Prestige - Reset level untuk mendapatkan bonus permanen
// Command: !prestige - Mereset level menjadi 1 dengan bonus XP permanen
global.Oblixn.cmd({
  name: "prestige",
  alias: ["ascend", "rebirth"],
  desc: "Reset level untuk mendapatkan bonus XP permanen (Level 50+)",
  category: "rpg",
  async exec(msg, { args, sock }) {
    try {
      const userId = msg.sender;
      const normalizedId = normalizeUserId(userId);
      
      if (!normalizedId) {
        return await msg.reply("❌ Format ID tidak valid!");
      }
      
      // Pastikan data user ada di database
      await ensureUserLeveling(normalizedId);
      
      // Ambil data user
      const user = await db.getUser(normalizedId);
      if (!user) {
        return await msg.reply("❌ Kamu belum terdaftar!");
      }
      
      // Periksa level user
      const currentLevel = user.level || 1;
      const requiredLevel = 50; // Minimal level 50 untuk prestige
      
      if (currentLevel < requiredLevel) {
        return await msg.reply(`❌ Level kamu masih terlalu rendah! Kamu butuh minimal Level ${requiredLevel} untuk Prestige. Level kamu saat ini: ${currentLevel}`);
      }
      
      // Konfirmasi prestige
      if (!args || args.length === 0 || args[0].toLowerCase() !== "confirm") {
        const confirmMessage = `⚠️ *KONFIRMASI PRESTIGE* ⚠️\n\n` +
          `Kamu akan melakukan RESET level dari Level ${currentLevel} kembali ke Level 1.\n\n` +
          `Sebagai gantinya kamu akan mendapatkan:\n` +
          `• Prestige +1 (Total: ${(user.prestige || 0) + 1})\n` +
          `• Bonus XP permanen +10% untuk semua aktivitas\n` +
          `• Lencana Prestige eksklusif di profil\n\n` +
          `Semua XP, achievement, dan statistik lainnya tetap dipertahankan.\n\n` +
          `Untuk mengonfirmasi, ketik: *!prestige confirm*`;
        
        return await msg.reply(confirmMessage);
      }
      
      // Lakukan prestige
      const newPrestigeLevel = (user.prestige || 0) + 1;
      
      // Update data user
      await db.updateUser(normalizedId, {
        level: 1,
        experience: 0,
        prestige: newPrestigeLevel,
        updated_at: new Date().toISOString(),
      });
      
      // Kirim pesan berhasil
      const successMessage = `🌟 *PRESTIGE BERHASIL!* 🌟\n\n` +
        `Kamu telah melakukan Prestige dan kembali ke Level 1.\n\n` +
        `✅ Prestige Level baru: ${newPrestigeLevel}\n` +
        `✅ Bonus XP permanen: +${newPrestigeLevel * 10}%\n\n` +
        `Gunakan bonus XP ini untuk naik level lebih cepat!\n` +
        `Gunakan !level atau !rankcard untuk melihat status barumu.`;
      
      await msg.reply(successMessage);
    } catch (error) {
      botLogger.error("Prestige error:", error);
      await msg.reply("❌ Gagal melakukan prestige: " + error.message);
    }
  }
});

// Command: !rankcard (tampilan level yang lebih menarik)
global.Oblixn.cmd({
  name: "rankcard",
  alias: ["rc", "levelcard"],
  desc: "Tampilkan kartu level kamu dengan gaya menarik",
  category: "rpg",
  async exec(msg, { args, sock }) {
    try {
      const userId = msg.sender;
      const normalizedId = normalizeUserId(userId);
      
      if (!normalizedId) {
        return await msg.reply("❌ Format ID tidak valid!");
      }
      
      // Pastikan data user ada di database
      await ensureUserLeveling(normalizedId);
      
      // Ambil data user
      const user = await db.getUser(normalizedId);
      if (!user) {
        return await msg.reply("❌ Kamu belum terdaftar!");
      }

      // Dapatkan data tambahan
      const rank = await getRank(normalizedId);
      const nextLevelXP = getRequiredXP(user.level || 1);
      const currentXP = user.experience || 0;
      const progress = (currentXP / nextLevelXP) * 100;
      
      // Buat kartu level dengan emoji
      const usernameDisplay = msg.pushName || normalizedId;
      const levelBar = createProgressBar(progress);
      const totalXp = formatNumber(user.total_xp || 0);
      
      const playerTitles = [
        { level: 1, title: "Pemula" },
        { level: 5, title: "Petualang" },
        { level: 10, title: "Veteran" },
        { level: 15, title: "Master" },
        { level: 20, title: "Grand Master" },
        { level: 25, title: "Legend" },
        { level: 30, title: "Mythical" },
        { level: 40, title: "Immortal" },
        { level: 50, title: "Divine" },
      ];
      
      // Tentukan title berdasarkan level
      let playerTitle = "Pemula";
      for (let i = playerTitles.length - 1; i >= 0; i--) {
        if ((user.level || 1) >= playerTitles[i].level) {
          playerTitle = playerTitles[i].title;
          break;
        }
      }
      
      // Format kartu rank
      const rankCard = `
╭─「 🎮 *RANK CARD* 🎮 」
│ 
│ 👤 *${usernameDisplay}*
│ 🏆 *Rank:* #${rank}
│ 📊 *Level:* ${user.level || 1} [${playerTitle}]
│ ⭐ *XP:* ${currentXP}/${nextLevelXP}
│ 
│ 📈 *Progress Bar:*
│ ${levelBar} ${Math.floor(progress)}%
│ 
│ 🔰 *Stats:*
│ 💫 Total XP: ${totalXp}
│ 📝 Pesan: ${user.total_messages || 0}
│ 🎮 Games: ${user.game_played || 0}
│ ⌨️ Commands: ${user.total_feature_usage || 0}
│ 
╰─「 👑 *LEVEL SYSTEM* 👑 」
      `;

      await msg.reply(rankCard);
    } catch (error) {
      botLogger.error("Rankcard error:", error);
      await msg.reply("❌ Terjadi kesalahan saat membuat rank card: " + error.message);
    }
  },
});
