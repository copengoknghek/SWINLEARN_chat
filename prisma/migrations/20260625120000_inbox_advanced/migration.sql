-- AlterTable
ALTER TABLE `inbox_threads` ADD COLUMN `is_group` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `inbox_threads` ADD COLUMN `color` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `inbox_thread_participants` ADD COLUMN `nickname` VARCHAR(191) NULL;
ALTER TABLE `inbox_thread_participants` ADD COLUMN `hidden_at` DATETIME(3) NULL;
