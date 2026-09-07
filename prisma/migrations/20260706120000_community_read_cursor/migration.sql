-- CreateTable
CREATE TABLE `community_read_cursors` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `offering_id` VARCHAR(191) NOT NULL,
    `last_read_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `community_read_cursors_user_id_offering_id_key`(`user_id`, `offering_id`),
    INDEX `community_read_cursors_offering_id_idx`(`offering_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `community_read_cursors` ADD CONSTRAINT `community_read_cursors_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `community_read_cursors` ADD CONSTRAINT `community_read_cursors_offering_id_fkey` FOREIGN KEY (`offering_id`) REFERENCES `course_offerings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
