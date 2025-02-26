const { botLogger } = require('../utils/logger');
let sock = null;

/**
 * Memeriksa apakah pengguna adalah admin dalam grup
 * @param {string} groupId - ID grup
 * @param {string} userId - ID pengguna yang akan diperiksa
 * @param {boolean} verbose - Apakah perlu menampilkan log detail
 * @returns {Promise<boolean>} - true jika pengguna adalah admin
 */
async function isAdmin(groupId, userId, verbose = false) {
    try {
        // Dapatkan metadata grup
        const metadata = await sock.groupMetadata(groupId);
        
        if (verbose) {
            botLogger.info('Group Information:', metadata);
        }

        // Normalisasi ID pengguna dengan toLowerCase
        const normalizedUserId = userId.split('@')[0].toLowerCase();

        // Cari peserta dengan perbandingan ID case-insensitive
        const participant = metadata.participants.find(p => {
            return p.id.split('@')[0].toLowerCase() === normalizedUserId;
        });
        
        return participant && (participant.admin === 'admin' || participant.admin === 'superadmin');
    } catch (error) {
        botLogger.error('Error checking admin status:', error);
        return false;
    }
}

// Fungsi untuk mengatur instance sock
function setup(sockInstance) {
    sock = sockInstance;
    botLogger.info('Permission handler setup completed');
}

function registerCommand(config) {
    botLogger.info(`Registering command: ${config.name}`);
}

async function checkStalkUsage(userId) {
    // Fungsi stub: izinkan semua penggunaan
    return true;
}

async function checkAIUsage(userId) {
    // Fungsi stub: izinkan semua penggunaan
    return true;
}

// Definisikan permissionHandler sebagai sebuah objek yang berisi semua fungsi
const permissionHandler = { isAdmin, setup, registerCommand, checkStalkUsage, checkAIUsage };

// Ubah module.exports untuk mendukung impor langsung dan terdestrukturisasi
module.exports = Object.assign({}, permissionHandler, { permissionHandler });