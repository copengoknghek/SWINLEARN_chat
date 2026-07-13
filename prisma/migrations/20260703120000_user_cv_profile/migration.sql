-- CreateTable
CREATE TABLE `user_cv_profiles` (
    `user_id` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `certifications` TEXT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `user_cv_profiles` ADD CONSTRAINT `user_cv_profiles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
