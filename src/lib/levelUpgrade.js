const { botLogger } = require("../utils/logger");
const { getRandomEmoji, formatNumber } = require("../utils/helper");
const db = require("../../database/confLowDb/lowdb");
const canvas = require("canvas");
const fs = require("fs").promises;
const path = require("path");

// Fungsi untuk membuat progress bar
function createProgressBar(percentage) {
  const filled = Math.floor(percentage / 10);
  const empty = 10 - filled;
  return "▰".repeat(filled) + "▱".repeat(empty);
}

// Fungsi untuk membuat template level up standar
function createLevelUpText(type, data) {
  const emojis = {
    user: ["🎮", "🏆", "⭐", "🌟", "✨", "🔥", "💯", "🚀"],
    group: ["🌐", "🏰", "🔮", "💎", "👥", "🌈", "✅", "🎯"],
  };
  
  const emoji1 = getRandomEmoji(emojis[type]);
  const emoji2 = getRandomEmoji(emojis[type]);
  
  if (type === "user") {
    return `
${emoji1} *LEVEL UP!* ${emoji2}

🎊 Selamat! Kamu naik ke level ${data.newLevel}!
👤 *${data.username || 'User'}*
📊 *Level Baru:* ${data.newLevel}
💫 *XP:* ${formatNumber(data.experience)}/${formatNumber(data.requiredXP)}
📈 *Progress:* ${createProgressBar(data.progress)} ${Math.round(data.progress)}%

${data.rewards ? `🎁 *Reward:* ${data.rewards}\n` : ''}
Lanjutkan aktivitas untuk terus naik level!
    `;
  } else {
    return `
${emoji1} *GROUP LEVEL UP!* ${emoji2}

🎊 Selamat! Grup ini naik ke level ${data.newLevel}!
👥 *${data.groupName || 'Group'}*
📊 *Level Baru:* ${data.newLevel}
💫 *XP:* ${formatNumber(data.experience)}/${formatNumber(data.requiredXP)}
📈 *Progress:* ${createProgressBar(data.progress)} ${Math.round(data.progress)}%

${data.rewards ? `🎁 *Reward:* ${data.rewards}\n` : ''}
Lanjutkan aktivitas untuk terus naik level grup!
    `;
  }
}

// Fungsi untuk mengirim notifikasi level up user
async function sendUserLevelUpNotification(sock, userId, oldLevel, newLevel, groupId = null) {
  try {
    const userData = await db.getUser(userId);
    if (!userData) {
      botLogger.warn(`User ${userId} tidak ditemukan untuk notifikasi level up`);
      return false;
    }
    
    // Dapatkan nama pengguna
    let username = userData.username || userId.split('@')[0];
    if (sock && typeof sock.getContactById === 'function') {
      try {
        const contact = await sock.getContactById(userId);
        username = contact.pushname || contact.name || username;
      } catch (error) {
        botLogger.error(`Error getting username for ${userId}:`, error);
      }
    }
    
    // Kalkulasi data level
    const requiredXP = getRequiredXP(newLevel);
    const experience = userData.experience || 0;
    const progress = (experience / requiredXP) * 100;
    
    // Dapatkan rewards jika ada (misalnya dari sistem level roles)
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
    
    // Periksa apakah role baru diperoleh
    let newRole = null;
    for (const role of LEVEL_ROLES) {
      if (newLevel >= role.level && oldLevel < role.level) {
        newRole = role;
        break;
      }
    }
    
    // Buat teks rewards jika ada
    let rewards = null;
    if (newRole) {
      rewards = `Role Baru: ${newRole.emoji} ${newRole.role} (+${newRole.bonus}% XP Bonus)`;
    }
    
    // Buat pesan level up
    const levelUpData = {
      username,
      oldLevel,
      newLevel,
      experience,
      requiredXP,
      progress,
      rewards
    };
    
    const levelUpMessage = createLevelUpText("user", levelUpData);
    
    // Mengirim pesan
    if (groupId) {
      // Kirim ke grup jika ada groupId
      await sock.sendMessage(groupId, { text: levelUpMessage });
    } else {
      // Kirim ke pengguna secara personal
      await sock.sendMessage(userId, { text: levelUpMessage });
    }
    
    botLogger.info(`Level up notification sent to ${username} (${userId}), Level: ${oldLevel} -> ${newLevel}`);
    return true;
  } catch (error) {
    botLogger.error("Error sending level up notification:", error);
    return false;
  }
}

// Fungsi untuk menghitung XP yang dibutuhkan untuk level berikutnya
function getRequiredXP(level) {
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

// Fungsi untuk mengirim notifikasi level up grup
async function sendGroupLevelUpNotification(sock, groupId, oldLevel, newLevel) {
  try {
    const groupData = await db.getGroup(groupId);
    if (!groupData) {
      botLogger.warn(`Group ${groupId} tidak ditemukan untuk notifikasi level up`);
      return false;
    }
    
    // Dapatkan nama grup
    let groupName = groupData.group_name || groupId.split('@')[0];
    if (sock && typeof sock.getGroupMetadata === 'function') {
      try {
        const metadata = await sock.getGroupMetadata(groupId);
        groupName = metadata.subject || groupName;
      } catch (error) {
        botLogger.error(`Error getting group name for ${groupId}:`, error);
      }
    }
    
    // Kalkulasi data level
    const requiredXP = getRequiredXP(newLevel);
    const experience = groupData.current_xp || 0;
    const progress = (experience / requiredXP) * 100;
    
    // Dapatkan rewards jika ada (misalnya fitur baru yang terbuka)
    let rewards = null;
    
    // Level-based rewards for groups
    const groupRewards = {
      5: "Akses ke perintah game tambahan",
      10: "Bonus XP group +5%",
      15: "Akses ke sistem ranking khusus",
      20: "Bonus XP group +10%",
      25: "Fitur moderasi lanjutan"
    };
    
    if (groupRewards[newLevel]) {
      rewards = groupRewards[newLevel];
    }
    
    // Buat pesan level up
    const levelUpData = {
      groupName,
      oldLevel,
      newLevel,
      experience,
      requiredXP,
      progress,
      rewards
    };
    
    const levelUpMessage = createLevelUpText("group", levelUpData);
    
    // Mengirim pesan ke grup
    await sock.sendMessage(groupId, { text: levelUpMessage });
    
    botLogger.info(`Group level up notification sent to ${groupName} (${groupId}), Level: ${oldLevel} -> ${newLevel}`);
    return true;
  } catch (error) {
    botLogger.error("Error sending group level up notification:", error);
    return false;
  }
}

// Fungsi untuk melacak XP dan level up otomatis
async function trackActivity(userId, groupId, activityType, amount = 1) {
  try {
    // Normalisasi user ID
    const normalizedId = userId.split('@')[0];
    
    // Update aktivitas user
    await global.Oblixn.trackUserActivity(userId, activityType, amount);
    
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
      default:
        xpAmount = 2; // XP default untuk aktivitas lain
    }
    
    // Update XP untuk user
    const userXpResult = await global.Oblixn.updateUserXP(userId, xpAmount, activityType);
    
    // Update XP untuk grup jika ada
    let groupXpResult = null;
    if (groupId) {
      // Dapatkan grup atau buat jika belum ada
      let group = await db.getGroup(groupId);
      if (!group) {
        // Buat grup baru jika belum ada
        try {
          await db.addGroup({
            group_id: groupId,
            owner_id: "system", // Placeholder
            group_name: null
          });
          group = await db.getGroup(groupId);
        } catch (error) {
          botLogger.error(`Error creating group ${groupId}:`, error);
        }
      }
      
      if (group) {
        // Update XP grup
        const currentXP = group.current_xp || 0;
        const totalXP = group.total_xp || 0;
        const level = group.level || 1;
        
        // Tentukan XP yang dibutuhkan untuk level berikutnya
        const xpRequired = getRequiredXP(level);
        
        // Tambahkan XP
        let newCurrentXP = currentXP + Math.floor(xpAmount / 2); // Grup mendapat setengah XP
        let newLevel = level;
        let leveledUp = false;
        
        // Cek level up
        if (newCurrentXP >= xpRequired) {
          newCurrentXP -= xpRequired;
          newLevel += 1;
          leveledUp = true;
          
          // Simpan informasi level up untuk notifikasi
          groupXpResult = { 
            leveledUp, 
            oldLevel: level, 
            newLevel 
          };
        }
        
        // Update grup di database
        await db.updateGroup(groupId, {
          current_xp: newCurrentXP,
          total_xp: totalXP + Math.floor(xpAmount / 2),
          level: newLevel,
          xp_to_next_level: getRequiredXP(newLevel)
        });
      }
    }
    
    return {
      userXpResult,
      groupXpResult
    };
  } catch (error) {
    botLogger.error("Error tracking activity:", error);
    return { userXpResult: null, groupXpResult: null };
  }
}

module.exports = {
  sendUserLevelUpNotification,
  sendGroupLevelUpNotification,
  trackActivity,
  getRequiredXP,
  createProgressBar
};
