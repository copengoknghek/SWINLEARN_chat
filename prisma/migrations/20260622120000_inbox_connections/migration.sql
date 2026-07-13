-- AlterTable
ALTER TABLE `inbox_threads` ADD COLUMN `pair_key` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `inbox_connections` (
    `id` VARCHAR(191) NOT NULL,
    `user_a_id` VARCHAR(191) NOT NULL,
    `user_b_id` VARCHAR(191) NOT NULL,
    `requested_by` VARCHAR(191) NOT NULL,
    `status` ENUM('pending', 'accepted', 'declined') NOT NULL DEFAULT 'pending',
    `requested_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `decided_at` DATETIME(3) NULL,

    INDEX `inbox_connections_user_b_id_idx`(`user_b_id`),
    INDEX `inbox_connections_requested_by_idx`(`requested_by`),
    UNIQUE INDEX `inbox_connections_user_a_id_user_b_id_key`(`user_a_id`, `user_b_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `inbox_threads_pair_key_key` ON `inbox_threads`(`pair_key`);

-- AddForeignKey
ALTER TABLE `inbox_connections` ADD CONSTRAINT `inbox_connections_user_a_id_fkey` FOREIGN KEY (`user_a_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inbox_connections` ADD CONSTRAINT `inbox_connections_user_b_id_fkey` FOREIGN KEY (`user_b_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
