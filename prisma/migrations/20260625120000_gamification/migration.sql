-- Idempotent gamification migration (safe when schema was already applied via db push)

SET @add_gold_balance = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'users'
        AND COLUMN_NAME = 'gold_balance'
    ),
    'SELECT 1',
    'ALTER TABLE `users` ADD COLUMN `gold_balance` INTEGER NOT NULL DEFAULT 0'
  )
);
PREPARE add_gold_balance_stmt FROM @add_gold_balance;
EXECUTE add_gold_balance_stmt;
DEALLOCATE PREPARE add_gold_balance_stmt;

CREATE TABLE IF NOT EXISTS `gold_transactions` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `amount` INTEGER NOT NULL,
    `reason` ENUM('like_received', 'comment_received', 'share_received', 'weekly_badge', 'reversal') NOT NULL,
    `source_type` VARCHAR(191) NULL,
    `source_id` VARCHAR(191) NULL,
    `week_key` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `gold_transactions_user_id_created_at_idx`(`user_id`, `created_at`),
    INDEX `gold_transactions_source_type_source_id_idx`(`source_type`, `source_id`),
    INDEX `gold_transactions_user_id_week_key_reason_idx`(`user_id`, `week_key`, `reason`),
    PRIMARY KEY (`id`),
    CONSTRAINT `gold_transactions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `share_events` (
    `id` VARCHAR(191) NOT NULL,
    `post_id` VARCHAR(191) NOT NULL,
    `shared_by_id` VARCHAR(191) NOT NULL,
    `recipient_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `share_events_post_id_idx`(`post_id`),
    INDEX `share_events_shared_by_id_idx`(`shared_by_id`),
    UNIQUE INDEX `share_events_post_id_shared_by_id_recipient_id_key`(`post_id`, `shared_by_id`, `recipient_id`),
    PRIMARY KEY (`id`),
    CONSTRAINT `share_events_post_id_fkey` FOREIGN KEY (`post_id`) REFERENCES `community_posts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `share_events_shared_by_id_fkey` FOREIGN KEY (`shared_by_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `student_badges` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `type` ENUM('FAN_FAVORITE', 'SUPER_SUPPORTER', 'GOLD_KING', 'TRENDING_CREATOR') NOT NULL,
    `since` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `week_key` VARCHAR(191) NULL,

    UNIQUE INDEX `student_badges_type_key`(`type`),
    INDEX `student_badges_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`),
    CONSTRAINT `student_badges_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
