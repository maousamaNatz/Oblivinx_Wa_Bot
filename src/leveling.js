const db = require("../../database/confLowDb/lowdb"); // Impor database AJV dari lowdb.js
const { botLogger } = require("../utils/logger");
const levelUpgrade = require("../lib/levelUpgrade");

// Fungsi untuk menghitung XP yang dibutuhkan agar user naik level
function getRequiredXP(level) {
  // Formula: level 1 membutuhkan 100 XP, dan setiap level berikutnya naik 1.5x
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

// Fungsi untuk normalisasi ID (menghilangkan @s.whatsapp.net)
function normalizeUserId(userId) {
  if (!userId) return null;
  return userId.split('@')[0];
}

// Fungsi untuk mendapatkan data user dari database; jika belum ada, buat dengan nilai default
async function getUserData(userId) {
  try {
    // Normalisasi ID
    const normalizedId = normalizeUserId(userId);
    if (!normalizedId) {
      botLogger.error("Invalid userId for getUserData");
      throw new Error("Invalid user ID");
    }
    
    let userData = await db.getUser(normalizedId);
    if (!userData) {
      // Jika user belum ada, tambahkan dengan default
      const result = await db.addUser({
        user_id: normalizedId,
        username: null, // Nama akan diisi oleh bot jika tersedia
        level: 1,
        experience: 0,
        total_messages: 0,
        total_xp: 0,
        daily_xp: 0,
        weekly_xp: 0,
        last_message_xp: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      userData = result.data;
      botLogger.info(`User ${normalizedId} ditambahkan ke database untuk leveling`);
    }
    return userData;
  } catch (error) {
    botLogger.error(`Gagal mendapatkan data user ${userId}:`, error);
    throw error;
  }
}

// Fungsi untuk menambah XP user dan menangani proses level up
async function addXP(userId, xpToAdd, sock = null, groupId = null) {
  try {
    // Normalisasi ID
    const normalizedId = normalizeUserId(userId);
    if (!normalizedId) {
      botLogger.error("Invalid userId for addXP");
      throw new Error("Invalid user ID");
    }
    
    const userData = await getUserData(normalizedId);
    userData.experience = (userData.experience || 0) + xpToAdd;
    userData.total_xp = (userData.total_xp || 0) + xpToAdd;
    userData.daily_xp = (userData.daily_xp || 0) + xpToAdd;
    userData.weekly_xp = (userData.weekly_xp || 0) + xpToAdd;
    
    let requiredXP = getRequiredXP(userData.level || 1);
    let oldLevel = userData.level || 1;
    let newLevel = oldLevel;
    let leveledUp = false;

    // Jika XP cukup untuk naik level, lakukan iterasi level up berulang kali
    while (userData.experience >= requiredXP) {
      userData.experience -= requiredXP;
      newLevel += 1;
      leveledUp = true;
      requiredXP = getRequiredXP(newLevel);
      botLogger.info(`User ${normalizedId} naik ke level ${newLevel}`);
    }

    // Perbarui data user di database
    await db.updateUser(normalizedId, {
      experience: userData.experience,
      level: newLevel,
      total_xp: userData.total_xp,
      daily_xp: userData.daily_xp,
      weekly_xp: userData.weekly_xp,
      last_message_xp: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    
    // Kirim notifikasi level up jika user naik level
    if (leveledUp && sock) {
      await levelUpgrade.sendUserLevelUpNotification(sock, userId, oldLevel, newLevel, groupId);
      
      // Cek achievement setelah level up
      if (global.Oblixn && global.Oblixn.checkAchievements) {
        await global.Oblixn.checkAchievements(normalizedId, 'level');
      }
    }

    return {
      ...userData,
      level: newLevel,
      leveledUp,
      oldLevel,
      newLevel
    };
  } catch (error) {
    botLogger.error(`Gagal menambahkan XP untuk user ${userId}:`, error);
    throw error;
  }
}

// Fungsi untuk menambah XP grup dan menangani level up
async function addGroupXP(groupId, xpToAdd, sock = null) {
  try {
    if (!groupId) {
      botLogger.error("Invalid groupId for addGroupXP");
      throw new Error("Invalid group ID");
    }
    
    // Dapatkan data grup
    let groupData = await db.getGroup(groupId);
    
    // Jika grup tidak ada di database, buat baru
    if (!groupData) {
      try {
        const result = await db.addGroup({
          group_id: groupId,
          owner_id: "system", // Placeholder
          group_name: null,
          level: 1,
          current_xp: 0,
          total_xp: 0,
          xp_to_next_level: getRequiredXP(1),
          created_at: new Date().toISOString()
        });
        groupData = result.data;
      } catch (error) {
        botLogger.error(`Gagal menambahkan grup baru: ${error.message}`);
        return null;
      }
    }
    
    // Update XP
    const currentXP = (groupData.current_xp || 0) + xpToAdd;
    const totalXP = (groupData.total_xp || 0) + xpToAdd;
    const oldLevel = groupData.level || 1;
    let newLevel = oldLevel;
    
    // Periksa level up
    let requiredXP = getRequiredXP(oldLevel);
    let remainingXP = currentXP;
    let leveledUp = false;
    
    while (remainingXP >= requiredXP) {
      remainingXP -= requiredXP;
      newLevel++;
      leveledUp = true;
      requiredXP = getRequiredXP(newLevel);
    }
    
    // Update grup di database
    await db.updateGroup(groupId, {
      level: newLevel,
      current_xp: remainingXP,
      total_xp: totalXP,
      xp_to_next_level: requiredXP
    });
    
    // Kirim notifikasi level up jika grup naik level
    if (leveledUp && sock) {
      await levelUpgrade.sendGroupLevelUpNotification(sock, groupId, oldLevel, newLevel);
    }
    
    return {
      leveledUp,
      oldLevel,
      newLevel,
      currentXP: remainingXP,
      totalXP
    };
  } catch (error) {
    botLogger.error(`Gagal menambahkan XP untuk grup ${groupId}:`, error);
    throw error;
  }
}

// Fungsi untuk melacak aktivitas dan memberikan XP
async function trackActivityXP(userId, groupId, activityType, amount = 1, sock = null) {
  try {
    // Tentukan XP berdasarkan jenis aktivitas
    let xpAmount = 0;
    
    switch (activityType) {
      case 'message':
        xpAmount = 5; // XP dasar untuk pesan
        break;
      case 'command':
        xpAmount = 10; // XP untuk penggunaan command
        break;
      case 'game':
        xpAmount = 20; // XP untuk bermain game
        break;
      case 'win':
        xpAmount = 50; // XP untuk memenangkan game
        break;
      case 'daily':
        xpAmount = 20; // XP untuk daily login
        break;
      default:
        xpAmount = 2; // XP default untuk aktivitas lain
    }
    
    // Lacak aktivitas untuk achievement
    if (global.Oblixn && global.Oblixn.trackUserActivity) {
      await global.Oblixn.trackUserActivity(userId, activityType, amount);
    }
    
    // Tambah XP user
    const userResult = await addXP(userId, xpAmount, sock, groupId);
    
    // Tambah XP grup jika dalam grup
    let groupResult = null;
    if (groupId) {
      groupResult = await addGroupXP(groupId, Math.floor(xpAmount / 2), sock);
    }
    
    return {
      user: userResult,
      group: groupResult
    };
  } catch (error) {
    botLogger.error(`Error tracking activity XP: ${error.message}`);
    return { 
      user: null, 
      group: null 
    };
  }
}

// Fungsi untuk mendapatkan data leaderboard
async function getLeaderboard(limit = 10) {
  try {
    const users = await db.readDatabase().then((data) => data.users || []);
    
    // Sortir berdasarkan total XP
    const sortedUsers = users
      .filter(user => user.total_xp != null)
      .sort((a, b) => (b.total_xp || 0) - (a.total_xp || 0))
      .slice(0, limit);
      
    return sortedUsers.map(user => ({
      user_id: user.user_id,
      username: user.username || 'User',
      level: user.level || 1,
      total_xp: user.total_xp || 0,
      experience: user.experience || 0
    }));
  } catch (error) {
    botLogger.error("Gagal mengambil data leaderboard:", error);
    return [];
  }
}

// Fungsi untuk mengambil semua data leveling (untuk monitoring)
async function getLevelingData() {
  try {
    const users = await db.readDatabase().then((data) => data.users || []);
    const levelingMap = new Map();
    users.forEach((user) => {
      levelingMap.set(user.user_id, {
        level: user.level || 1,
        xp: user.experience || 0,
        total_xp: user.total_xp || 0,
        daily_xp: user.daily_xp || 0,
        weekly_xp: user.weekly_xp || 0
      });
    });
    return levelingMap;
  } catch (error) {
    botLogger.error("Gagal mengambil data leveling:", error);
    throw error;
  }
}

// Tambah fungsi handler untuk integrasi dengan sistem pesan
function setupMessageHandler(sock) {
  // Daftarkan handler untuk pesan
  if (global.Oblixn && global.Oblixn.ev) {
    global.Oblixn.ev.on('messages.upsert', async ({ messages }) => {
      for (const msg of messages) {
        // Pastikan ini pesan baru (bukan status/notifikasi)
        if (msg.key.remoteJid && !msg.key.fromMe && msg.message) {
          const sender = msg.key.participant || msg.key.remoteJid;
          const isGroup = msg.key.remoteJid.endsWith('@g.us');
          const groupId = isGroup ? msg.key.remoteJid : null;
          
          // Tambahkan XP untuk aktivitas pesan
          await trackActivityXP(sender, groupId, 'message', 1, sock);
        }
      }
    });
  }
}

module.exports = {
  getRequiredXP,
  getUserData,
  addXP,
  addGroupXP,
  trackActivityXP,
  getLevelingData,
  getLeaderboard,
  setupMessageHandler,
  normalizeUserId
};