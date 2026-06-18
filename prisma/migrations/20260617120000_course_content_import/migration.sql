-- AlterTable
ALTER TABLE `assignments`
    ADD COLUMN `source_export_id` VARCHAR(191) NULL,
    ADD COLUMN `content_html` LONGTEXT NULL,
    ADD COLUMN `submission_types` TEXT NULL,
    ADD COLUMN `points_possible` DOUBLE NULL,
    ADD COLUMN `lock_at` DATETIME(3) NULL,
    ADD COLUMN `unlock_at` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `course_content_packages` (
    `id` VARCHAR(191) NOT NULL,
    `course_id` VARCHAR(191) NULL,
    `offering_id` VARCHAR(191) NULL,
    `scope` VARCHAR(191) NOT NULL,
    `import_id` VARCHAR(191) NOT NULL,
    `source_title` VARCHAR(191) NOT NULL,
    `source_last_download` DATETIME(3) NULL,
    `original_file_name` VARCHAR(191) NULL,
    `language` VARCHAR(191) NULL,
    `imported_by` VARCHAR(191) NULL,
    `imported_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `course_content_modules` (
    `id` VARCHAR(191) NOT NULL,
    `package_id` VARCHAR(191) NOT NULL,
    `source_id` VARCHAR(191) NULL,
    `source_export_id` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `unlock_at` DATETIME(3) NULL,
    `sequential` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `course_content_items` (
    `id` VARCHAR(191) NOT NULL,
    `package_id` VARCHAR(191) NOT NULL,
    `module_id` VARCHAR(191) NULL,
    `assignment_id` VARCHAR(191) NULL,
    `asset_id` VARCHAR(191) NULL,
    `source_id` VARCHAR(191) NULL,
    `source_export_id` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `item_type` VARCHAR(191) NOT NULL,
    `content_html` LONGTEXT NULL,
    `indent` INTEGER NOT NULL DEFAULT 0,
    `position` INTEGER NOT NULL DEFAULT 0,
    `locked` BOOLEAN NOT NULL DEFAULT false,
    `completed` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `course_content_assets` (
    `id` VARCHAR(191) NOT NULL,
    `package_id` VARCHAR(191) NOT NULL,
    `source_path` TEXT NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `mime_type` VARCHAR(191) NULL,
    `size` INTEGER NULL,
    `stored_path` TEXT NOT NULL,
    `public_url` TEXT NOT NULL,
    `file_type` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `assignments_source_export_id_idx` ON `assignments`(`source_export_id`);

-- CreateIndex
CREATE INDEX `assignments_offering_id_source_export_id_idx` ON `assignments`(`offering_id`, `source_export_id`);

-- CreateIndex
CREATE INDEX `course_content_packages_course_id_scope_idx` ON `course_content_packages`(`course_id`, `scope`);

-- CreateIndex
CREATE INDEX `course_content_packages_offering_id_scope_idx` ON `course_content_packages`(`offering_id`, `scope`);

-- CreateIndex
CREATE INDEX `course_content_modules_package_id_position_idx` ON `course_content_modules`(`package_id`, `position`);

-- CreateIndex
CREATE INDEX `course_content_modules_source_export_id_idx` ON `course_content_modules`(`source_export_id`);

-- CreateIndex
CREATE INDEX `course_content_items_package_id_position_idx` ON `course_content_items`(`package_id`, `position`);

-- CreateIndex
CREATE INDEX `course_content_items_module_id_position_idx` ON `course_content_items`(`module_id`, `position`);

-- CreateIndex
CREATE INDEX `course_content_items_assignment_id_idx` ON `course_content_items`(`assignment_id`);

-- CreateIndex
CREATE INDEX `course_content_items_asset_id_idx` ON `course_content_items`(`asset_id`);

-- CreateIndex
CREATE INDEX `course_content_items_source_export_id_idx` ON `course_content_items`(`source_export_id`);

-- CreateIndex
CREATE INDEX `course_content_assets_package_id_idx` ON `course_content_assets`(`package_id`);

-- AddForeignKey
ALTER TABLE `course_content_packages` ADD CONSTRAINT `course_content_packages_course_id_fkey` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `course_content_packages` ADD CONSTRAINT `course_content_packages_offering_id_fkey` FOREIGN KEY (`offering_id`) REFERENCES `course_offerings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `course_content_modules` ADD CONSTRAINT `course_content_modules_package_id_fkey` FOREIGN KEY (`package_id`) REFERENCES `course_content_packages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `course_content_items` ADD CONSTRAINT `course_content_items_package_id_fkey` FOREIGN KEY (`package_id`) REFERENCES `course_content_packages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `course_content_items` ADD CONSTRAINT `course_content_items_module_id_fkey` FOREIGN KEY (`module_id`) REFERENCES `course_content_modules`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `course_content_items` ADD CONSTRAINT `course_content_items_assignment_id_fkey` FOREIGN KEY (`assignment_id`) REFERENCES `assignments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `course_content_items` ADD CONSTRAINT `course_content_items_asset_id_fkey` FOREIGN KEY (`asset_id`) REFERENCES `course_content_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `course_content_assets` ADD CONSTRAINT `course_content_assets_package_id_fkey` FOREIGN KEY (`package_id`) REFERENCES `course_content_packages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
