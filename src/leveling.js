const fs = require('fs');
const path = require('path');

// Lokasi file untuk menyimpan data leveling secara sederhana (JSON)
const LEVELING_DATA_FILE = path.join(__dirname, 'levelingData.json');

// Gunakan Map untuk menampung data leveling selama runtime
let levelingData = new Map();

// Muat data leveling dari file jika tersedia
if (fs.existsSync(LEVELING_DATA_FILE)) {
  try {
    const data = JSON.parse(fs.readFileSync(LEVELING_DATA_FILE, 'utf8'));
    for (const userId in data) {
      levelingData.set(userId, data[userId]);
    }
  } catch (error) {
    console.error("Gagal memuat data leveling:", error);
  }
}

// Fungsi untuk menyimpan data leveling ke file
function saveLevelingData() {
  const obj = {};
  for (const [userId, data] of levelingData.entries()) {
    obj[userId] = data;
  }
  fs.writeFileSync(LEVELING_DATA_FILE, JSON.stringify(obj, null, 2));
}

// Fungsi untuk menghitung XP yang dibutuhkan agar user naik level
function getRequiredXP(level) {
  // Misalnya, level 1 membutuhkan 100 XP, dan setiap level berikutnya naik 1.5x
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

// Fungsi untuk mendapatkan data user; jika belum ada, buat dengan nilai default
function getUserData(userId) {
  if (!levelingData.has(userId)) {
    levelingData.set(userId, { level: 1, xp: 0 });
  }
  return levelingData.get(userId);
}

// Fungsi untuk menambah XP user dan menangani proses level up
function addXP(userId, xpToAdd) {
  const userData = getUserData(userId);
  userData.xp += xpToAdd;
  let requiredXP = getRequiredXP(userData.level);

  // Jika XP cukup untuk naik level, lakukan iterasi level up berulang kali
  while (userData.xp >= requiredXP) {
    userData.xp -= requiredXP;
    userData.level += 1;
    requiredXP = getRequiredXP(userData.level);
    console.log(`User ${userId} naik ke level ${userData.level}`);
    // Di sini Anda bisa menambahkan notifikasi, misalnya mengirim pesan ke user
  }

  levelingData.set(userId, userData);
  saveLevelingData();
  return userData;
}

// Fungsi untuk mengambil data leveling (optional, untuk keperluan monitoring)
function getLevelingData() {
  return levelingData;
}

module.exports = {
  getRequiredXP,
  getUserData,
  addXP,
  getLevelingData,
}; 