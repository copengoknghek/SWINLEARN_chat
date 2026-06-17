-- AlterTable
ALTER TABLE `users` ADD COLUMN `main_major_id` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `users_main_major_id_idx` ON `users`(`main_major_id`);

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_main_major_id_fkey` FOREIGN KEY (`main_major_id`) REFERENCES `main_majors`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
