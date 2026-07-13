-- AlterTable
ALTER TABLE `assignment_submissions`
  ADD COLUMN `github_url` VARCHAR(191) NULL,
  ADD COLUMN `index_status` VARCHAR(191) NOT NULL DEFAULT 'pending',
  ADD COLUMN `index_error` LONGTEXT NULL,
  ADD COLUMN `indexed_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `swinlearn_messages`
  ADD COLUMN `metadata` JSON NULL;
