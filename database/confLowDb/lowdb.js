  const Ajv = require("ajv");
  const addFormats = require("ajv-formats");
  const fs = require("fs").promises;
  const path = require("path");
  const achievementsDB = require("./connect/achievements");
  const levelConfigDB = require("./connect/configlv");
  const { log } = require('../../src/utils/logger');

  // Tentukan path folder database
  const dbFolder = path.resolve(process.cwd(), "Oblivinx_bot_Db_1");
  const dbFile = path.join(dbFolder, "database.json");

  // Inisialisasi AJV dengan format tambahan
  const ajv = new Ajv({ allErrors: true });
  addFormats(ajv);
  // Fungsi untuk memastikan folder dan file database ada
  async function initializeDatabase() {
    try {
      await fs.mkdir(dbFolder, { recursive: true });
      const fileExists = await fs.stat(dbFile).catch(() => false);
      if (!fileExists) {
        const initialData = {
          users: [],
          groups: [],
          user_activity_logs: [],
          leaderboard: [],
          group_settings: [],
          banned_users: [],
          bot_instances: [],
          bot_qr_codes: [],
          user_leveling: [],
          user_activities: [],
          guilds: [],
          user_achievements: [],
          level_roles: [],
          orders: [],
        };
        await fs.writeFile(dbFile, JSON.stringify(initialData, null, 2), "utf8");
        log(`Database initialized successfully at ${dbFile}`, 'info');
      }
    } catch (error) {
      log("Error initializing database: " + error.message, 'error');
      throw error;
    }
  }

  // Fungsi internal untuk membaca data dari file JSON
  async function readDatabase() {
    try {
      // Baca file database
      const data = await fs.readFile(dbFile, 'utf8');
      
      // Tambahkan validasi dan pembersihan data
      let cleanedData = data;
      try {
        // Coba parse untuk verifikasi
        JSON.parse(cleanedData);
      } catch (error) {
        log('Database JSON rusak, mencoba perbaikan otomatis...', 'warn');
        
        // Opsi 1: Gunakan backup jika tersedia
        const backupExists = await fs.stat(`${dbFile}.backup`).catch(() => false);
        if (backupExists) {
          log('Menggunakan file backup...', 'info');
          cleanedData = await fs.readFile(`${dbFile}.backup`, 'utf8');
        } else {
          // Opsi 2: Coba bersihkan karakter tidak valid
          log('Membersihkan karakter tidak valid...', 'info');
          // Menghapus karakter kontrol dan non-whitespace yang potensial menyebabkan error
          cleanedData = data.replace(/[^\x20-\x7E\s]/g, '');
        }
        
        // Coba parse lagi setelah pembersihan
        try {
          JSON.parse(cleanedData);
          log('Berhasil memperbaiki data JSON', 'info');
        } catch (parseError) {
          log('Gagal memperbaiki data JSON, menggunakan struktur kosong...', 'error');
          cleanedData = JSON.stringify({
            users: [],
            groups: [],
            user_activity_logs: [],
            leaderboard: [],
            group_settings: [],
            banned_users: [],
            bot_instances: [],
            bot_qr_codes: [],
            user_leveling: [],
            user_activities: [],
            guilds: [],
            user_achievements: [],
            level_roles: [],
            orders: [],
          });
        }
      }
      
      // Buat backup sebelum parsing final
      await fs.writeFile(`${dbFile}.backup`, cleanedData, 'utf8');
      
      return JSON.parse(cleanedData);
    } catch (error) {
      log('Error reading database: ' + error.message, 'error');
      // Kembalikan objek kosong jika masih gagal
      return {
        users: [],
        groups: [],
        user_activity_logs: [],
        leaderboard: [],
        group_settings: [],
        banned_users: [],
        bot_instances: [],
        bot_qr_codes: [],
        user_leveling: [],
        user_activities: [],
        guilds: [],
        user_achievements: [],
        level_roles: [],
        orders: [],
      };
    }
  }
  // Fungsi internal untuk menulis data ke file JSON
  async function writeDatabase(data) {
    try {
      await fs.writeFile(dbFile, JSON.stringify(data, null, 2), "utf8");
      log(`Database written successfully to ${dbFile}`, 'info');
      return true;
    } catch (error) {
      log("Error writing to database: " + error.message, 'error');
      throw error;
    }
  }
  // Skema untuk validasi data user
  const userSchema = {
    type: "object",
    properties: {
      id: { type: "integer", minimum: 1 },
      user_id: { type: "string", minLength: 1 },
      username: { type: ["string", "null"] },
      is_premium: { type: "integer", enum: [0, 1], default: 0 },
      is_banned: { type: "integer", enum: [0, 1], default: 0 },
      is_blocked: { type: "integer", enum: [0, 1], default: 0 },
      coins: { type: "number", minimum: 0, default: 0.0 },
      experience: { type: "integer", minimum: 0, default: 0 },
      level: { type: "integer", minimum: 1, default: 1 },
      ranking: { type: ["integer", "null"], minimum: 1 },
      total_messages: { type: "integer", minimum: 0, default: 0 },
      messages_per_day: { type: "integer", minimum: 0, default: 0 },
      feature_first_used: { type: "string", default: "unknown" },
      feature_last_used: { type: "string", default: "unknown" },
      total_feature_usage: { type: "integer", minimum: 0, default: 0 },
      daily_feature_average: { type: "integer", minimum: 0, default: 0 },
      blocked_status: { type: "integer", enum: [0, 1], default: 0 },
      is_sewa: { type: "integer", enum: [0, 1], default: 0 },
      language: { type: "string", minLength: 1, default: "id" },
      anti_delete_message: { type: "integer", enum: [0, 1], default: 0 },
      anti_hidden_tag: { type: "integer", enum: [0, 1], default: 0 },
      anti_group_link: { type: "integer", enum: [0, 1], default: 0 },
      anti_view_once: { type: "integer", enum: [0, 1], default: 0 },
      auto_sticker: { type: "integer", enum: [0, 1], default: 0 },
      log_detection: { type: "integer", enum: [0, 1], default: 0 },
      auto_level_up: { type: "integer", enum: [0, 1], default: 0 },
      mute_bot: { type: "integer", enum: [0, 1], default: 0 },
      warnings: { type: "integer", minimum: 0, default: 0 },
      created_at: { type: "string", format: "date-time" },
      updated_at: { type: "string", format: "date-time" },
      daily_xp: { type: "integer", minimum: 0, default: 0 },
      last_message: { type: "string", format: "date-time" },
      achievements: { type: ["object", "null"] },
      last_message_xp: { type: "string", format: "date-time" },
      weekly_xp: { type: "integer", minimum: 0, default: 0 },
      total_xp: { type: "integer", minimum: 0, default: 0 },
    },
    required: ["id", "user_id"],
    additionalProperties: false,
  };

  // Skema untuk ban user
  const banUserSchema = {
    type: "object",
    properties: {
      userId: { type: "string", minLength: 1 },
      reason: { type: ["string", "null"] },
      bannedBy: { type: "string", minLength: 1 },
    },
    required: ["userId", "bannedBy"],
    additionalProperties: false,
  };

  // Skema untuk group
  const groupSchema = {
    type: "object",
    properties: {
      id: { type: "integer", minimum: 1 },
      group_id: { type: "string", minLength: 1 },
      group_name: { type: ["string", "null"] },
      owner_id: { type: "string", minLength: 1 },
      total_members: { type: "integer", minimum: 0, default: 0 },
      created_at: { type: "string", format: "date-time" },
      bot_is_admin: { type: "integer", enum: [0, 1], default: 0 },
      registration_date: { type: "string", format: "date-time" },
      premium_status: { type: "integer", enum: [0, 1], default: 0 },
      sewa_status: { type: "integer", enum: [0, 1], default: 0 },
      language: { type: "string", minLength: 1, default: "id" },
      leaderboard_rank: { type: ["integer", "null"], minimum: 1 },
      level: { type: "integer", minimum: 1, default: 1 },
      total_xp: { type: "integer", minimum: 0, default: 0 },
      current_xp: { type: "integer", minimum: 0, default: 0 },
      xp_to_next_level: { type: "integer", minimum: 0, default: 1000 },
      anti_bot: { type: "integer", enum: [0, 1], default: 0 },
      anti_delete_message: { type: "integer", enum: [0, 1], default: 0 },
      anti_hidden_tag: { type: "integer", enum: [0, 1], default: 0 },
      anti_group_link: { type: "integer", enum: [0, 1], default: 0 },
      anti_view_once: { type: "integer", enum: [0, 1], default: 0 },
      auto_sticker: { type: "integer", enum: [0, 1], default: 0 },
      log_detection: { type: "integer", enum: [0, 1], default: 0 },
      auto_level_up: { type: "integer", enum: [0, 1], default: 0 },
      mute_bot: { type: "integer", enum: [0, 1], default: 0 },
      anti_country: { type: "integer", enum: [0, 1], default: 0 },
      welcome_message: { type: "integer", enum: [0, 1], default: 0 },
      goodbye_message: { type: "integer", enum: [0, 1], default: 0 },
      warnings: { type: "integer", minimum: 0, default: 0 },
      updated_at: { type: "string", format: "date-time" },
      description: { type: ["string", "null"] },
    },
    required: ["id", "group_id", "owner_id"],
    additionalProperties: false,
  };

  // Skema untuk order
  const orderSchema = {
    type: "object",
    properties: {
      user_id: { type: "string", minLength: 1 },
      total_harga: { type: "number", minimum: 0 },
      status: { type: "string", enum: ["pending", "completed", "cancelled"] },
    },
    required: ["user_id"],
    additionalProperties: false,
  };

  // Skema untuk QR code
  const qrCodeSchema = {
    type: "object",
    properties: {
      qrData: { type: "string", minLength: 1 },
      phoneNumber: { type: "string", minLength: 1 },
    },
    required: ["qrData", "phoneNumber"],
    additionalProperties: false,
  };

  // Kompilasi skema
  const validateUser = ajv.compile(userSchema);
  const validateBanUser = ajv.compile(banUserSchema);
  const validateGroup = ajv.compile(groupSchema);
  const validateOrder = ajv.compile(orderSchema);
  const validateQrCode = ajv.compile(qrCodeSchema);

  // Fungsi untuk mendapatkan ID baru
  const getNewId = (items) => {
    return items.length > 0 ? Math.max(...items.map((item) => item.id)) + 1 : 1;
  };

  // Fungsi untuk mendapatkan data user
  async function getUser(userId) {
    try {
      if (typeof userId !== "string" || userId.length === 0) {
        throw new Error("Invalid userId: must be a non-empty string");
      }
      const data = await readDatabase();
      log(`Fetching user with ID: ${userId}`, 'debug');
      const user = data.users.find((user) => user.user_id === userId) || null;
      log(`User found: ${JSON.stringify(user)}`, 'debug');
      return user;
    } catch (error) {
      log("Error getting user: " + error.message, 'error');
      throw error;
    }
  }

  // Fungsi untuk memperbarui data user
  async function updateUser(userId, updatedData) {
    try {
      if (typeof userId !== "string" || userId.length === 0) {
        throw new Error("Invalid userId: must be a non-empty string");
      }
      const data = await readDatabase();
      const userIndex = data.users.findIndex((user) => user.user_id === userId);
      if (userIndex === -1) {
        throw new Error(`User not found: ${userId}`);
      }
      const updatedUser = { ...data.users[userIndex], ...updatedData };
      if (!validateUser(updatedUser)) {
        throw new Error(
          "Invalid updated user data: " + ajv.errorsText(validateUser.errors)
        );
      }
      data.users[userIndex] = updatedUser;
      log(`Updating user ${userId} with data: ${JSON.stringify(updatedUser)}`, 'debug');
      await writeDatabase(data);
      return { success: true, data: updatedUser };
    } catch (error) {
      log("Error updating user: " + error.message, 'error');
      throw error;
    }
  }

  // Fungsi untuk mendapatkan data group
  async function getGroup(groupId) {
    try {
      if (typeof groupId !== "string" || groupId.length === 0) {
        throw new Error("Invalid groupId: must be a non-empty string");
      }
      const data = await readDatabase();
      log(`Fetching group with ID: ${groupId}`, 'debug');
      const group = data.groups.find((group) => group.group_id === groupId) || null;
      log(`Group found: ${JSON.stringify(group)}`, 'debug');
      return group;
    } catch (error) {
      log("Error getting group: " + error.message, 'error');
      throw error;
    }
  }

  // Fungsi untuk memperbarui data group
  async function updateGroup(groupId, groupData) {
    try {
      if (typeof groupId !== "string" || groupId.length === 0) {
        throw new Error("Invalid groupId: must be a non-empty string");
      }
      
      const data = await readDatabase();
      const groupIndex = data.groups.findIndex(
        (group) => group.group_id === groupId
      );
      
      if (groupIndex === -1) {
        // Grup belum ada, coba tambahkan
        if (!groupData.owner_id) {
          log(`Tidak dapat menambahkan grup baru ${groupId} tanpa owner_id`, 'warn');
          return { success: false, message: "Missing owner_id for new group" };
        }
        
        const result = await addGroup({
          group_id: groupId,
          owner_id: groupData.owner_id,
          group_name: groupData.group_name || "Unnamed Group",
          ...groupData
        });
        
        return result;
      }
      
      // Update grup yang sudah ada
      const updatedGroup = { ...data.groups[groupIndex], ...groupData };
      
      // Pastikan field yang wajib tidak diubah jadi null/undefined
      updatedGroup.group_id = updatedGroup.group_id || groupId;
      updatedGroup.owner_id = updatedGroup.owner_id || data.groups[groupIndex].owner_id;
      updatedGroup.id = data.groups[groupIndex].id;
      
      // Tambahkan timestamp update
      updatedGroup.updated_at = new Date().toISOString();
      
      // Validasi data yang diupdate
      if (!validateGroup(updatedGroup)) {
        log(`Invalid updated group data: ${ajv.errorsText(validateGroup.errors)}`, 'error');
        return { 
          success: false, 
          message: "Invalid updated data: " + ajv.errorsText(validateGroup.errors)
        };
      }
      
      // Simpan perubahan
      data.groups[groupIndex] = updatedGroup;
      log(`Updating group ${groupId} with data: ${JSON.stringify(updatedGroup)}`, 'debug');
      await writeDatabase(data);
      
      return { success: true, data: updatedGroup };
    } catch (error) {
      log("Error updating group: " + error.message, 'error');
      throw error;
    }
  }

  // Fungsi untuk menambah user dengan validasi AJV
  async function addUser(userData) {
    try {
      const minimalUserData = {
        user_id: userData.user_id,
        username: userData.username || null,
      };
      if (!validateUser({ ...minimalUserData, id: 1 })) {
        throw new Error("Invalid user data: " + ajv.errorsText(validateUser.errors));
      }

      const data = await readDatabase();
      const defaultUser = {
        id: getNewId(data.users),
        user_id: userData.user_id,
        username: userData.username || null,
        is_premium: userData.is_premium || 0,
        is_banned: userData.is_banned || 0,
        is_blocked: userData.is_blocked || 0,
        coins: userData.coins || 0.0,
        experience: userData.experience || 0,
        level: userData.level || 1,
        ranking: userData.ranking || null,
        total_messages: userData.total_messages || 0,
        messages_per_day: userData.messages_per_day || 0,
        feature_first_used: userData.feature_first_used || "unknown",
        feature_last_used: userData.feature_last_used || "unknown",
        total_feature_usage: userData.total_feature_usage || 0,
        daily_feature_average: userData.daily_feature_average || 0,
        blocked_status: userData.blocked_status || 0,
        is_sewa: userData.is_sewa || 0,
        language: userData.language || "id",
        anti_delete_message: userData.anti_delete_message || 0,
        anti_hidden_tag: userData.anti_hidden_tag || 0,
        anti_group_link: userData.anti_group_link || 0,
        anti_view_once: userData.anti_view_once || 0,
        auto_sticker: userData.auto_sticker || 0,
        log_detection: userData.log_detection || 0,
        auto_level_up: userData.auto_level_up || 0,
        mute_bot: userData.mute_bot || 0,
        warnings: userData.warnings || 0,
        created_at: userData.created_at || new Date().toISOString(),
        updated_at: userData.updated_at || new Date().toISOString(),
        daily_xp: userData.daily_xp || 0,
        last_message: userData.last_message || new Date().toISOString(),
        achievements: userData.achievements || null,
        last_message_xp: userData.last_message_xp || new Date().toISOString(),
        weekly_xp: userData.weekly_xp || 0,
        total_xp: userData.total_xp || 0,
      };

      if (!validateUser(defaultUser)) {
        throw new Error("Invalid user data after defaults: " + ajv.errorsText(validateUser.errors));
      }

      if (data.users.some((user) => user.user_id === userData.user_id)) {
        log(`User with user_id ${userData.user_id} already exists`, 'warn');
        return { success: false, message: "User with this user_id already exists" };
      }

      data.users.push(defaultUser);
      log(`Adding user: ${JSON.stringify(defaultUser)}`, 'debug');
      await writeDatabase(data);
      return { success: true, data: defaultUser };
    } catch (error) {
      log("Error adding user: " + error.message, 'error');
      throw error;
    }
  }

  // Fungsi untuk ban user dengan validasi AJV
  async function banUser(userId, reason, bannedBy) {
    try {
      const banData = { userId, reason, bannedBy };
      if (!validateBanUser(banData)) {
        throw new Error("Invalid ban data: " + ajv.errorsText(validateBanUser.errors));
      }

      const data = await readDatabase();
      let user = data.users.find((user) => user.user_id === userId);
      if (!user) {
        const result = await addUser({ user_id: userId });
        user = result.data;
      }
      user.is_banned = 1;
      user.updated_at = new Date().toISOString();

      data.banned_users = data.banned_users.filter((ban) => ban.user_id !== userId);
      const banEntry = {
        id: getNewId(data.banned_users),
        user_id: userId,
        reason: reason || "Tidak ada alasan",
        banned_by: bannedBy,
        is_system_block: 0,
        created_at: new Date().toISOString(),
      };
      data.banned_users.push(banEntry);

      log(`Banning user ${userId}: ${JSON.stringify(banEntry)}`, 'info');
      await writeDatabase(data);
      return { success: true, message: "User berhasil diban" };
    } catch (error) {
      log("Error banning user: " + error.message, 'error');
      throw error;
    }
  }

  // Fungsi untuk unban user
  async function unbanUser(userId) {
    try {
      if (typeof userId !== "string" || userId.length === 0) {
        throw new Error("Invalid userId: must be a non-empty string");
      }

      const data = await readDatabase();
      const bannedUser = data.banned_users.find(
        (ban) => ban.user_id === userId && ban.is_system_block === 0
      );
      if (!bannedUser) {
        log(`User ${userId} not found in banned list`, 'warn');
        return {
          success: false,
          message: "User tidak ditemukan dalam daftar banned",
          wasUnbanned: false,
        };
      }
      data.banned_users = data.banned_users.filter(
        (ban) => ban.user_id !== userId || ban.is_system_block !== 0
      );
      const user = data.users.find((user) => user.user_id === userId);
      if (user) {
        user.is_banned = 0;
        user.updated_at = new Date().toISOString();
        await updateUser(userId, { is_banned: 0, updated_at: user.updated_at });
      }

      log(`Unbanning user ${userId}`, 'info');
      await writeDatabase(data);
      return {
        success: true,
        message: `User ${userId} berhasil diunban`,
        wasUnbanned: true,
      };
    } catch (error) {
      log("Error unbanning user: " + error.message, 'error');
      throw error;
    }
  }

  // Fungsi untuk cek status user
  async function checkUserStatus(userId) {
    try {
      if (typeof userId !== "string" || userId.length === 0) {
        throw new Error("Invalid userId: must be a non-empty string");
      }

      const data = await readDatabase();
      const user = await getUser(userId);
      const bannedInfo = data.banned_users.find((ban) => ban.user_id === userId);

      if (user) {
        log(`User status for ${userId}: ${JSON.stringify(user)}`, 'debug');
        return {
          isBanned: user.is_banned === 1,
          isBlocked: user.is_blocked === 1,
          warnings: user.warnings,
          banReason: bannedInfo?.reason || null,
          bannedBy: bannedInfo?.banned_by || null,
          isSystemBlock: bannedInfo?.is_system_block === 1 || false,
        };
      }

      log(`No user found for ${userId}, returning default status`, 'debug');
      return {
        isBanned: false,
        isBlocked: false,
        warnings: 0,
        banReason: null,
        bannedBy: null,
        isSystemBlock: false,
      };
    } catch (error) {
      log("Error checking user status: " + error.message, 'error');
      throw error;
    }
  }

  // Fungsi untuk blokir user oleh sistem
  async function blockUserBySystem(userId) {
    try {
      if (typeof userId !== "string" || userId.length === 0) {
        throw new Error("Invalid userId: must be a non-empty string");
      }

      const data = await readDatabase();
      let user = await getUser(userId);
      if (!user) {
        const result = await addUser({ user_id: userId });
        user = result.data;
      }
      user.is_blocked = 1;
      user.updated_at = new Date().toISOString();
      await updateUser(userId, { is_blocked: 1, updated_at: user.updated_at });

      data.banned_users = data.banned_users.filter((ban) => ban.user_id !== userId);
      const banEntry = {
        id: getNewId(data.banned_users),
        user_id: userId,
        reason: "Blocked by system",
        banned_by: "SYSTEM",
        is_system_block: 1,
        created_at: new Date().toISOString(),
      };
      data.banned_users.push(banEntry);

      log(`Blocking user ${userId} by system: ${JSON.stringify(banEntry)}`, 'info');
      await writeDatabase(data);
      return { success: true, message: "User berhasil diblokir oleh sistem" };
    } catch (error) {
      log("Error blocking user: " + error.message, 'error');
      throw error;
    }
  }

  // Fungsi untuk mendapatkan daftar user yang dibanned
  async function getListBannedUsers() {
    try {
      const data = await readDatabase();
      const bannedUsers = data.banned_users.filter((ban) => ban.is_system_block === 0);

      if (bannedUsers.length === 0) {
        log("No banned users found", 'info');
        return {
          success: true,
          message: "Tidak ada user yang dibanned",
          data: [],
        };
      }

      const formattedUsers = bannedUsers.map((banned) => {
        const user = data.users.find((user) => user.user_id === banned.user_id);
        const banDate = new Date(banned.created_at).toLocaleString("id-ID", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });

        return {
          userId: banned.user_id,
          username: user?.username || "Tidak diketahui",
          reason: banned.reason || "Tidak ada alasan",
          bannedBy: banned.banned_by,
          banDate: banDate,
        };
      });

      formattedUsers.sort((a, b) => new Date(b.banDate) - new Date(a.banDate));
      log(`Fetched banned users: ${JSON.stringify(formattedUsers)}`, 'debug');
      return {
        success: true,
        message: "Daftar user yang dibanned berhasil diambil",
        data: formattedUsers,
      };
    } catch (error) {
      log("Error getting banned users list: " + error.message, 'error');
      throw error;
    }
  }

// Fungsi untuk menambah group dengan validasi AJV
async function addGroup(groupData) {
  try {
    const minimalGroupData = {
      group_id: groupData.group_id,
      owner_id: groupData.owner_id,
      group_name: groupData.group_name || null,
    };
    if (!validateGroup({ ...minimalGroupData, id: 1 })) {
      throw new Error("Invalid group data: " + ajv.errorsText(validateGroup.errors));
    }

    const data = await readDatabase();
    const defaultGroup = {
      id: getNewId(data.groups),
      group_id: groupData.group_id,
      group_name: groupData.group_name || null,
      owner_id: groupData.owner_id,
      total_members: groupData.total_members || 0,
      created_at: groupData.created_at || new Date().toISOString(),
      updated_at: groupData.updated_at || new Date().toISOString(),
      bot_is_admin: groupData.bot_is_admin || 0,
      registration_date: groupData.registration_date || new Date().toISOString(),
      premium_status: groupData.premium_status || 0,
      sewa_status: groupData.sewa_status || 0,
      language: groupData.language || "id",
      leaderboard_rank: groupData.leaderboard_rank || null,
      level: groupData.level || 1,
      total_xp: groupData.total_xp || 0,
      current_xp: groupData.current_xp || 0,
      xp_to_next_level: groupData.xp_to_next_level || (await levelConfigDB.getLevelConfig(1))?.xp_required || 1000,
      anti_bot: groupData.anti_bot || 0,
      anti_delete_message: groupData.anti_delete_message || 0,
      anti_hidden_tag: groupData.anti_hidden_tag || 0,
      anti_group_link: groupData.anti_group_link || 0,
      anti_view_once: groupData.anti_view_once || 0,
      auto_sticker: groupData.auto_sticker || 0,
      log_detection: groupData.log_detection || 0,
      auto_level_up: groupData.auto_level_up || 0,
      mute_bot: groupData.mute_bot || 0,
      anti_country: groupData.anti_country || 0,
      welcome_message: groupData.welcome_message || 0,
      goodbye_message: groupData.goodbye_message || 0,
      warnings: groupData.warnings || 0,
      description: groupData.description || null,
    };

    if (!validateGroup(defaultGroup)) {
      throw new Error("Invalid group data after defaults: " + ajv.errorsText(validateGroup.errors));
    }

    if (data.groups.some((group) => group.group_id === groupData.group_id)) {
      log(`Group with group_id ${groupData.group_id} already exists`, 'warn');
      return { success: false, message: "Group with this group_id already exists" };
    }

    // Pemeriksaan foreign key dihapus
    data.groups.push(defaultGroup);
    log(`Adding group: ${JSON.stringify(defaultGroup)}`, 'debug');
    await writeDatabase(data);
    return { success: true, data: defaultGroup };
  } catch (error) {
    log("Error adding group: " + error.message, 'error');
    throw error;
  }
}
  // Fungsi untuk reset database
  async function resetDatabase() {
    try {
      const initialData = {
        users: [],
        groups: [],
        user_activity_logs: [],
        leaderboard: [],
        group_settings: [],
        banned_users: [],
        bot_instances: [],
        bot_qr_codes: [],
        user_leveling: [],
        user_activities: [],
        guilds: [],
        user_achievements: [],
        level_roles: [],
        orders: [],
      };
      log("Resetting database to initial state", 'info');
      console.log("Resetting database to initial state");
      await writeDatabase(initialData);
      return { success: true, message: "Main database reset successfully" };
    } catch (error) {
      console.error("Error resetting database:", error.message, error.stack);
      throw error;
    }
  }

  // Fungsi untuk menambah order dengan validasi AJV
  async function addOrder(orderData) {
    try {
      if (!validateOrder(orderData)) {
        throw new Error("Invalid order data: " + ajv.errorsText(validateOrder.errors));
      }

      const data = await readDatabase();
      const newOrder = {
        id: getNewId(data.orders),
        user_id: orderData.user_id,
        tanggal: new Date().toISOString(),
        total_harga: orderData.total_harga || 0.0,
        status: orderData.status || "pending",
      };

      data.orders.push(newOrder);
      console.log(`Adding order: ${JSON.stringify(newOrder)}`);
      await writeDatabase(data);
      return { success: true, data: newOrder };
    } catch (error) {
      console.error("Error adding order:", error.message, error.stack);
      throw error;
    }
  }

  // Fungsi untuk memeriksa foreign key
  async function checkForeignKey(collection, key, value) {
    try {
      if (
        typeof collection !== "string" ||
        typeof key !== "string" ||
        typeof value !== "string" ||
        !["users", "groups"].includes(collection)
      ) {
        throw new Error(
          "Invalid input: collection must be 'users' or 'groups', key and value must be strings"
        );
      }

      const data = await readDatabase();
      if (collection === "users") {
        const exists = !!data.users.find((user) => user.user_id === value);
        console.log(`Checking foreign key ${key}=${value} in ${collection}: ${exists}`);
        return exists;
      }
      if (collection === "groups") {
        const exists = !!data.groups.find((group) => group.group_id === value);
        console.log(`Checking foreign key ${key}=${value} in ${collection}: ${exists}`);
        return exists;
      }
      return false;
    } catch (error) {
      console.error("Error checking foreign key:", error.message, error.stack);
      throw error;
    }
  }

  // Fungsi untuk menangani QR code dengan validasi AJV
  async function handleQrCode(qrData, phoneNumber) {
    try {
      const qrCodeData = { qrData, phoneNumber };
      if (!validateQrCode(qrCodeData)) {
        throw new Error("Invalid QR code data: " + ajv.errorsText(validateQrCode.errors));
      }

      const data = await readDatabase();
      data.bot_qr_codes = data.bot_qr_codes.filter((qr) => qr.number !== phoneNumber);
      const qrEntry = {
        id: getNewId(data.bot_qr_codes),
        number: phoneNumber,
        qr_data: qrData,
        created_at: new Date().toISOString(),
      };
      data.bot_qr_codes.push(qrEntry);
      console.log(`Saving QR code for ${phoneNumber}: ${JSON.stringify(qrEntry)}`);
      await writeDatabase(data);
      return true;
    } catch (error) {
      console.error("Error saving QR code:", error.message, error.stack);
      throw error;
    }
  }

  // Fungsi untuk mendapatkan bot_instances
  async function getBotInstances() {
    try {
      const data = await readDatabase();
      return data.bot_instances;
    } catch (error) {
      console.error("Error getting bot instances:", error.message, error.stack);
      throw error;
    }
  }

  // Fungsi untuk mendapatkan data level pengguna
  async function getUserLevel(userId, groupId) {
    try {
      const db = await readDatabase();
      
      if (!db.leveling) {
        db.leveling = {};
      }
      
      const key = `${groupId}_${userId}`;
      
      if (!db.leveling[key]) {
        // Buat data level pengguna baru jika belum ada
        const LevelingModel = require('./models/leveling');
        db.leveling[key] = LevelingModel.createUserLevel(userId, groupId);
        await writeDatabase(db);
      }
      
      return db.leveling[key];
    } catch (error) {
      console.error('Error getting user level:', error);
      return null;
    }
  }

  // Fungsi untuk mengupdate XP dan level pengguna
  async function updateUserLevel(userId, groupId, xpToAdd) {
    try {
      const db = await readDatabase();
      const LevelingModel = require('./models/leveling');
      
      if (!db.leveling) {
        db.leveling = {};
      }
      
      // Cek apakah grup sudah ada di database
      if (!db.groups) {
        db.groups = {};
      }
      
      if (!db.groups[groupId]) {
        db.groups[groupId] = {
          id: groupId,
          name: '',
          members: [],
          topUsers: [],
          settings: {
            levelingEnabled: true
          },
          lastUpdate: new Date().toISOString()
        };
      }
      
      const key = `${groupId}_${userId}`;
      
      // Ambil atau buat data level pengguna
      let userData = db.leveling[key];
      if (!userData) {
        userData = LevelingModel.createUserLevel(userId, groupId);
      }
      
      // Update XP dan hitung level baru
      userData.xp += xpToAdd;
      userData.messages += 1;
      userData.lastMessageTime = new Date().toISOString();
      
      // Update hari aktif untuk streak
      const today = new Date().toISOString().split('T')[0];
      if (!userData.activeDays) userData.activeDays = {};
      userData.activeDays[today] = (userData.activeDays[today] || 0) + 1;
      
      // Hitung streak harian
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayKey = yesterday.toISOString().split('T')[0];
      
      if (userData.activeDays[yesterdayKey]) {
        userData.streak += 1;
      } else {
        userData.streak = 1;
      }
      
      // Cek apakah naik level
      const oldLevel = userData.level;
      const xpForNextLevel = LevelingModel.xpNeededForLevel(userData.level);
      
      let leveledUp = false;
      
      while (userData.xp >= xpForNextLevel) {
        userData.level += 1;
        leveledUp = true;
        userData.xp -= xpForNextLevel;
      }
      
      // Update data grup jika user naik level
      if (leveledUp && db.groups[groupId]) {
        // Tambahkan data user ke daftar top user grup
        if (!db.groups[groupId].topUsers) db.groups[groupId].topUsers = [];
        
        // Cek apakah user sudah ada di daftar
        const userIndex = db.groups[groupId].topUsers.findIndex(u => u.userId === userId);
        
        if (userIndex >= 0) {
          // Update data user
          db.groups[groupId].topUsers[userIndex] = {
            userId,
            level: userData.level,
            xp: userData.xp,
            username: userData.username || '',
            messages: userData.messages,
            lastUpdated: new Date().toISOString()
          };
        } else {
          // Tambahkan user baru
          db.groups[groupId].topUsers.push({
            userId,
            level: userData.level,
            xp: userData.xp,
            username: userData.username || '',
            messages: userData.messages,
            lastUpdated: new Date().toISOString()
          });
        }
        
        // Urutkan berdasarkan level dan XP
        db.groups[groupId].topUsers.sort((a, b) => {
          if (a.level !== b.level) return b.level - a.level;
          return b.xp - a.xp;
        });
        
        // Batasi jumlah top users
        db.groups[groupId].topUsers = db.groups[groupId].topUsers.slice(0, 10);
        
        // Update waktu terakhir
        db.groups[groupId].lastUpdate = new Date().toISOString();
      }
      
      // Update data dan simpan
      userData.lastUpdated = new Date().toISOString();
      db.leveling[key] = userData;
      await writeDatabase(db);
      
      return {
        userData,
        leveledUp,
        oldLevel,
        newLevel: userData.level
      };
    } catch (error) {
      console.error('Error updating user level:', error);
      return null;
    }
  }

  // Fungsi untuk mendapatkan daftar top users di grup
  async function getGroupLeaderboard(groupId, limit = 10) {
    try {
      const db = await readDatabase();
      
      if (!db.leveling) {
        return [];
      }
      
      // Filter pengguna di grup tertentu
      const groupUsers = Object.values(db.leveling)
        .filter(user => user.groupId === groupId)
        .sort((a, b) => {
          // Sort berdasarkan level dan XP
          if (a.level !== b.level) return b.level - a.level;
          return b.xp - a.xp;
        })
        .slice(0, limit);
      
      return groupUsers;
    } catch (error) {
      console.error('Error getting group leaderboard:', error);
      return [];
    }
  }
  const fiturPermissionGroup = async (groupId) => {
    try {
      const db = await readDatabase();
      if (!db.groups) {
        return { success: false, message: "Tidak ada data grup", activeFeatures: [] };
      }
      
      const group = db.groups.find((group) => group.group_id === groupId);
      if (!group) {
        return { success: false, message: "Grup tidak ditemukan", activeFeatures: [] };
      }
      
      // Filter hanya fitur yang aktif (bernilai 1)
      const activeFeatures = {};
      const featureKeys = [
        "anti_bot", "anti_delete_message", "anti_hidden_tag", 
        "anti_group_link", "anti_view_once", "auto_sticker", 
        "log_detection", "auto_level_up", "mute_bot", 
        "anti_country", "welcome_message", "goodbye_message"
      ];
      
      featureKeys.forEach(key => {
        if (group[key] === 1) {
          activeFeatures[key] = true;
        }
      });
      
      return { 
        success: true, 
        groupInfo: {
          id: group.id,
          group_id: group.group_id,
          group_name: group.group_name,
          owner_id: group.owner_id,
          total_members: group.total_members,
          bot_is_admin: group.bot_is_admin === 1,
          premium_status: group.premium_status === 1,
          sewa_status: group.sewa_status === 1,
          language: group.language,
          level: group.level || 1,
          total_xp: group.total_xp || 0,
          current_xp: group.current_xp || 0,
          xp_to_next_level: group.xp_to_next_level || 1000,
          description: group.description || null,
          created_at: group.created_at,
          updated_at: group.updated_at || group.created_at
        },
        activeFeatures 
      };
    } catch (error) {
      log("Error mengambil data fitur grup: " + error.message, 'error');
      return { success: false, message: "Error mengambil data fitur grup", activeFeatures: [] };
    }
  }
  

  initializeDatabase().catch((err) => {
    console.error("Failed to initialize database on module load:", err);
    process.exit(1);
  });
  // Export semua fungsi
  module.exports = {
    addUser,
    banUser,
    unbanUser,
    checkUserStatus,
    initializeDatabase,
    blockUserBySystem,
    getListBannedUsers,
    addGroup,
    resetDatabase,
    addOrder,
    checkForeignKey,
    getNewId,
    handleQrCode,
    getBotInstances,
    getUser,
    updateUser,
    getGroup,
    updateGroup,
    ...achievementsDB,
    ...levelConfigDB,
    getUserLevel,
    updateUserLevel,
    getGroupLeaderboard,
    fiturPermissionGroup,
    readDatabase,
    writeDatabase,
  };