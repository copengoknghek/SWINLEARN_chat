-- CreateTable
CREATE TABLE `course_registration_requests` (
    `id` VARCHAR(191) NOT NULL,
    `offering_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `status` ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    `requested_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `decided_at` DATETIME(3) NULL,
    `decided_by` VARCHAR(191) NULL,

    INDEX `course_registration_requests_user_id_idx`(`user_id`),
    INDEX `course_registration_requests_decided_by_idx`(`decided_by`),
    UNIQUE INDEX `course_registration_requests_offering_id_user_id_key`(`offering_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `course_registration_requests` ADD CONSTRAINT `course_registration_requests_offering_id_fkey` FOREIGN KEY (`offering_id`) REFERENCES `course_offerings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `course_registration_requests` ADD CONSTRAINT `course_registration_requests_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `course_registration_requests` ADD CONSTRAINT `course_registration_requests_decided_by_fkey` FOREIGN KEY (`decided_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
