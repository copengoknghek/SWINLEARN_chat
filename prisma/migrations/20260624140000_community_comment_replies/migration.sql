-- AlterTable
ALTER TABLE `community_comments` ADD COLUMN `parent_id` VARCHAR(191) NULL,
    ADD COLUMN `gif_url` TEXT NULL;

-- CreateIndex
CREATE INDEX `community_comments_parent_id_created_at_idx` ON `community_comments`(`parent_id`, `created_at`);

-- CreateTable
CREATE TABLE `community_comment_likes` (
    `id` VARCHAR(191) NOT NULL,
    `comment_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `community_comment_likes_user_id_idx`(`user_id`),
    UNIQUE INDEX `community_comment_likes_comment_id_user_id_key`(`comment_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `community_comment_images` (
    `id` VARCHAR(191) NOT NULL,
    `comment_id` VARCHAR(191) NOT NULL,
    `original_name` VARCHAR(191) NOT NULL,
    `mime_type` VARCHAR(191) NULL,
    `size` INTEGER NOT NULL,
    `stored_path` TEXT NOT NULL,
    `public_url` TEXT NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `community_comment_images_comment_id_sort_order_idx`(`comment_id`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `community_comments` ADD CONSTRAINT `community_comments_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `community_comments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `community_comment_likes` ADD CONSTRAINT `community_comment_likes_comment_id_fkey` FOREIGN KEY (`comment_id`) REFERENCES `community_comments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `community_comment_likes` ADD CONSTRAINT `community_comment_likes_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `community_comment_images` ADD CONSTRAINT `community_comment_images_comment_id_fkey` FOREIGN KEY (`comment_id`) REFERENCES `community_comments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
