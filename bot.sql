-- Nonaktifkan pengecekan foreign key untuk menghindari error saat menghapus tabel
SET FOREIGN_KEY_CHECKS = 0;

-- Hapus tabel-tabel yang sudah ada, urutannya disusun untuk menghindari konflik constraint
DROP TABLE IF EXISTS `orders`;
DROP TABLE IF EXISTS `level_roles`;
DROP TABLE IF EXISTS `user_achievements`;
DROP TABLE IF EXISTS `achievements`;
DROP TABLE IF EXISTS `guilds`;
DROP TABLE IF EXISTS `user_activities`;
DROP TABLE IF EXISTS `level_config`;
DROP TABLE IF EXISTS `user_leveling`;
DROP TABLE IF EXISTS `bot_qr_codes`;
DROP TABLE IF EXISTS `bot_instances`;
DROP TABLE IF EXISTS `banned_users`;
DROP TABLE IF EXISTS `group_settings`;
DROP TABLE IF EXISTS `leaderboard`;
DROP TABLE IF EXISTS `user_activity_logs`;
DROP TABLE IF EXISTS `groups`;
DROP TABLE IF EXISTS `users`;

-- Aktifkan kembali pengecekan foreign key
SET FOREIGN_KEY_CHECKS = 1;

-- Buat tabel 'users'
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `user_id` VARCHAR(255) NOT NULL UNIQUE, -- berisi phone number user
  `username` VARCHAR(255) DEFAULT NULL,   -- berisi username user
  `is_premium` TINYINT(1) DEFAULT 0,
  `is_banned` TINYINT(1) DEFAULT 0,         -- untuk cek apakah user di-banned oleh admin
  `is_blocked` TINYINT(1) DEFAULT 0,        -- untuk cek apakah user diblokir oleh bot
  `coins` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `experience` INT(11) NOT NULL DEFAULT 0,
  `level` INT(11) DEFAULT 1,
  `ranking` INT(11) DEFAULT NULL,
  `total_messages` INT(11) DEFAULT 0,
  `messages_per_day` INT(11) DEFAULT 0,
  `feature_first_used` VARCHAR(255) DEFAULT 'unknown',
  `feature_last_used` VARCHAR(255) DEFAULT 'unknown',
  `total_feature_usage` INT(11) DEFAULT 0,
  `daily_feature_average` INT(11) DEFAULT 0,
  `blocked_status` TINYINT(1) DEFAULT 0,
  `is_sewa` TINYINT(1) DEFAULT 0,
  `language` VARCHAR(50) DEFAULT 'id',
  `anti_delete_message` TINYINT(1) DEFAULT 0,
  `anti_hidden_tag` TINYINT(1) DEFAULT 0,
  `anti_group_link` TINYINT(1) DEFAULT 0,
  `anti_view_once` TINYINT(1) DEFAULT 0,
  `auto_sticker` TINYINT(1) DEFAULT 0,
  `log_detection` TINYINT(1) DEFAULT 0,
  `auto_level_up` TINYINT(1) DEFAULT 0,
  `mute_bot` TINYINT(1) DEFAULT 0,          -- untuk mengecek apakah bot di-mute oleh user
  `warnings` INT(11) DEFAULT 0,             -- untuk mengecek apakah user diwarn oleh bot
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `daily_xp` INT DEFAULT 0,
  `last_message` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `achievements` JSON DEFAULT NULL,
  `last_message_xp` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `weekly_xp` INT DEFAULT 0,
  `total_xp` INT DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Buat tabel 'groups'
CREATE TABLE IF NOT EXISTS `groups` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `group_id` VARCHAR(255) NOT NULL UNIQUE,
  `group_name` VARCHAR(255) DEFAULT NULL,
  `owner_id` VARCHAR(255) NOT NULL,
  `total_members` INT(11) DEFAULT 0,
  `created_at` DATETIME NOT NULL,
  `bot_is_admin` TINYINT(1) DEFAULT 0,
  `registration_date` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `premium_status` TINYINT(1) DEFAULT 0,
  `sewa_status` TINYINT(1) DEFAULT 0,
  `language` VARCHAR(50) DEFAULT 'id',
  `leaderboard_rank` INT(11) DEFAULT NULL,
  `level` INT(11) DEFAULT 1,
  `total_xp` INT(11) DEFAULT 0,
  `current_xp` INT(11) DEFAULT 0,
  `xp_to_next_level` INT(11) DEFAULT 1000,
  `anti_bot` TINYINT(1) DEFAULT 0,
  `anti_delete_message` TINYINT(1) DEFAULT 0,
  `anti_hidden_tag` TINYINT(1) DEFAULT 0,
  `anti_group_link` TINYINT(1) DEFAULT 0,
  `anti_view_once` TINYINT(1) DEFAULT 0,
  `auto_sticker` TINYINT(1) DEFAULT 0,
  `log_detection` TINYINT(1) DEFAULT 0,
  `auto_level_up` TINYINT(1) DEFAULT 0,
  `mute_bot` TINYINT(1) DEFAULT 0,
  `anti_country` TINYINT(1) DEFAULT 0,
  `welcome_message` TINYINT(1) DEFAULT 0,
  `goodbye_message` TINYINT(1) DEFAULT 0,
  `warnings` INT(11) DEFAULT 0,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`owner_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Buat tabel 'user_activity_logs'
CREATE TABLE IF NOT EXISTS `user_activity_logs` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `user_id` VARCHAR(255) NOT NULL,
  `activity` ENUM('FARM_EXP', 'SPEND_COINS', 'EARN_COINS', 'LEVEL_UP') NOT NULL,
  `value` INT(11) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Buat tabel 'leaderboard'
CREATE TABLE IF NOT EXISTS `leaderboard` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `group_id` VARCHAR(255) NOT NULL,
  `user_id` VARCHAR(255) NOT NULL,
  `rank` INT(11) NOT NULL,
  `level` INT(11) NOT NULL,
  `total_xp` INT(11) NOT NULL,
  `coins` INT(11) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`group_id`) REFERENCES `groups`(`group_id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Buat tabel 'group_settings'
CREATE TABLE IF NOT EXISTS `group_settings` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `group_id` VARCHAR(255) NOT NULL,
  `setting_key` VARCHAR(255) NOT NULL,
  `setting_value` TEXT DEFAULT NULL,
  `is_premium_only` TINYINT(1) DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`group_id`) REFERENCES `groups`(`group_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Buat tabel 'banned_users'
CREATE TABLE IF NOT EXISTS `banned_users` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `user_id` VARCHAR(255) NOT NULL,
  `reason` TEXT DEFAULT NULL,
  `banned_by` VARCHAR(255) NOT NULL,
  `is_system_block` TINYINT(1) DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Buat tabel 'bot_instances'
CREATE TABLE IF NOT EXISTS `bot_instances` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `number` VARCHAR(20) NOT NULL UNIQUE,
  `credentials` TEXT NOT NULL,
  `status` ENUM('active','inactive') DEFAULT 'inactive',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Hapus entri yang tidak valid dari tabel 'bot_instances'
DELETE FROM `bot_instances`
WHERE `number` LIKE '%@%' OR `number` = '';

-- Buat tabel 'bot_qr_codes'
CREATE TABLE IF NOT EXISTS `bot_qr_codes` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `number` VARCHAR(20) UNIQUE NOT NULL,
  `qr_data` TEXT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Buat tabel 'user_leveling'
CREATE TABLE IF NOT EXISTS `user_leveling` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `user_id` VARCHAR(255) NOT NULL,
  `level` INT(11) DEFAULT 1,
  `total_xp` INT(11) DEFAULT 0,
  `daily_xp` INT(11) DEFAULT 0,
  `last_activity` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `rank_position` INT(11) DEFAULT NULL,
  `prestige` INT(11) DEFAULT 0,
  `daily_challenges` JSON DEFAULT NULL,
  `weekly_streak` INT DEFAULT 0,
  `guild_id` VARCHAR(255) DEFAULT NULL,
  `title` VARCHAR(50) DEFAULT 'Newbie',
  PRIMARY KEY (`id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE,
  INDEX `idx_rank` (`rank_position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Buat tabel 'level_config'
CREATE TABLE IF NOT EXISTS `level_config` (
  `level` INT(11) PRIMARY KEY,
  `xp_required` INT(11) NOT NULL,
  `reward_coins` INT(11) NOT NULL,
  `badge` VARCHAR(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Buat tabel 'user_activities'
CREATE TABLE IF NOT EXISTS `user_activities` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `user_id` VARCHAR(255) NOT NULL,
  `activity_type` ENUM('message', 'command', 'game', 'achievement') NOT NULL,
  `xp_earned` INT(11) NOT NULL,
  `timestamp` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Masukkan data awal ke tabel 'level_config'
INSERT INTO `level_config` (`level`, `xp_required`, `reward_coins`, `badge`) VALUES
  (1, 0, 0, '🥉'),
  (2, 100, 50, '🥉'),
  (3, 300, 100, '🥉'),
  (4, 600, 150, '🥈'),
  (5, 1000, 200, '🥈'),
  (6, 1500, 250, '🥈'),
  (7, 2100, 300, '🥇'),
  (8, 2800, 350, '🥇'),
  (9, 3600, 400, '🥇'),
  (10, 4500, 500, '💎');

-- Buat tabel 'guilds'
CREATE TABLE IF NOT EXISTS `guilds` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(50) NOT NULL,
  `leader_id` VARCHAR(255) NOT NULL,
  `level` INT DEFAULT 1,
  `total_xp` INT DEFAULT 0,
  `members` JSON NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`leader_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Buat tabel 'achievements'
CREATE TABLE IF NOT EXISTS `achievements` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(50) NOT NULL,
  `description` TEXT NOT NULL,
  `reward_xp` INT NOT NULL,
  `reward_coins` INT NOT NULL,
  `target` INT NOT NULL,
  `type` ENUM('message', 'command', 'game', 'social') NOT NULL,
  `badge` VARCHAR(50) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Buat tabel 'user_achievements'
CREATE TABLE IF NOT EXISTS `user_achievements` (
  `user_id` VARCHAR(255) NOT NULL,
  `achievement_id` INT(11) NOT NULL,
  `progress` INT DEFAULT 0,
  `completed` TINYINT DEFAULT 0,
  `completed_at` TIMESTAMP NULL,
  PRIMARY KEY (`user_id`, `achievement_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE,
  FOREIGN KEY (`achievement_id`) REFERENCES `achievements`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Masukkan data awal ke tabel 'achievements'
INSERT INTO `achievements`
  (`name`, `description`, `reward_xp`, `reward_coins`, `target`, `type`, `badge`)
VALUES
  ('Pecandu Chat', 'Kirim 1000 pesan', 500, 100, 1000, 'message', '💬'),
  ('Gamer Sejati', 'Menang 50 game', 1000, 200, 50, 'game', '🎮'),
  ('Sosialita', 'Bergabung dengan 5 guild', 300, 50, 5, 'social', '🤝'),
  ('Kolektor XP', 'Kumpulkan 10,000 XP', 2000, 500, 10000, 'message', '🏅'),
  ('Prestige Master', 'Capai prestige level 5', 5000, 1000, 5, 'social', '🌟');

-- Buat tabel 'level_roles'
CREATE TABLE IF NOT EXISTS `level_roles` (
  `role_id` INT AUTO_INCREMENT PRIMARY KEY,
  `role_name` VARCHAR(50) NOT NULL,
  `required_level` INT NOT NULL,
  `xp_boost` DECIMAL(5,2) DEFAULT 1.0,
  `badge_icon` VARCHAR(50)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Buat tabel 'orders'
CREATE TABLE IF NOT EXISTS `orders` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `user_id` VARCHAR(255) NOT NULL,
  `tanggal` DATETIME NOT NULL,
  `total_harga` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `status` ENUM('pending','completed','cancelled') NOT NULL DEFAULT 'pending',
  PRIMARY KEY (`id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Pastikan nilai default dan tipe data konsisten pada tabel 'users' dan 'orders'
ALTER TABLE `users`
  MODIFY COLUMN `coins` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  MODIFY COLUMN `experience` INT(11) NOT NULL DEFAULT 0;

ALTER TABLE `orders`
  MODIFY COLUMN `total_harga` DECIMAL(10,2) NOT NULL DEFAULT 0.00;
