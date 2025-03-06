const db = require("../../database/confLowDb/lowdb"); // Impor database AJV dari lowdb.js
const { botLogger } = require("../utils/logger");

// Fungsi untuk menghitung XP yang dibutuhkan agar user naik level
function getRequiredXP(level) {
  // Misalnya, level 1 membutuhkan 100 XP, dan setiap level berikutnya naik 1.5x
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

// Fungsi untuk mendapatkan data user dari database; jika belum ada, buat dengan nilai default
async function getUserData(userId) {
  try {
    let userData = await db.getUser(userId);
    if (!userData) {
      // Jika user belum ada, tambahkan dengan default
      const result = await db.addUser({
        user_id: userId,
        username: null, // Nama akan diisi oleh bot jika tersedia
        level: 1,
        experience: 0,
        total_messages: 0,
      });
      userData = result.data;
      botLogger.info(`User ${userId} ditambahkan ke database untuk leveling`);
    }
    return userData;
  } catch (error) {
    botLogger.error(`Gagal mendapatkan data user ${userId}:`, error);
    throw error;
  }
}

// Fungsi untuk menambah XP user dan menangani proses level up
async function addXP(userId, xpToAdd) {
  try {
    const userData = await getUserData(userId);
    userData.experience = (userData.experience || 0) + xpToAdd;
    let requiredXP = getRequiredXP(userData.level);

    // Jika XP cukup untuk naik level, lakukan iterasi level up berulang kali
    while (userData.experience >= requiredXP) {
      userData.experience -= requiredXP;
      userData.level += 1;
      requiredXP = getRequiredXP(userData.level);
      botLogger.info(`User ${userId} naik ke level ${userData.level}`);
    }

    // Perbarui data user di database
    await db.updateUser(userId, {
      experience: userData.experience,
      level: userData.level,
      updated_at: new Date().toISOString(),
    });

    return userData;
  } catch (error) {
    botLogger.error(`Gagal menambahkan XP untuk user ${userId}:`, error);
    throw error;
  }
}

// Fungsi untuk mengambil semua data leveling (optional, untuk monitoring)
async function getLevelingData() {
  try {
    const users = await db.readDatabase().then((data) => data.users || []);
    const levelingMap = new Map();
    users.forEach((user) => {
      levelingMap.set(user.user_id, {
        level: user.level || 1,
        xp: user.experience || 0,
      });
    });
    return levelingMap;
  } catch (error) {
    botLogger.error("Gagal mengambil data leveling:", error);
    throw error;
  }
}

module.exports = {
  getRequiredXP,
  getUserData,
  addXP,
  getLevelingData,
};