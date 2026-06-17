-- AlterTable
ALTER TABLE `courses` ADD COLUMN `credit_points` DOUBLE NOT NULL DEFAULT 12.5;

-- CreateTable
CREATE TABLE `course_prerequisite_groups` (
    `id` VARCHAR(191) NOT NULL,
    `course_id` VARCHAR(191) NOT NULL,
    `requirement_type` ENUM('completed_credit_points', 'course_alternatives') NOT NULL,
    `minimum_credit_points` DOUBLE NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `course_prerequisite_groups_course_id_idx`(`course_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `course_prerequisite_options` (
    `id` VARCHAR(191) NOT NULL,
    `group_id` VARCHAR(191) NOT NULL,
    `required_course_id` VARCHAR(191) NOT NULL,
    `requirement_mode` ENUM('passed', 'passed_or_concurrent') NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `course_prerequisite_options_group_id_idx`(`group_id`),
    INDEX `course_prerequisite_options_required_course_id_idx`(`required_course_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `student_course_completions` (
    `id` VARCHAR(191) NOT NULL,
    `student_id` VARCHAR(191) NOT NULL,
    `course_id` VARCHAR(191) NOT NULL,
    `completed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` VARCHAR(191) NULL,

    INDEX `student_course_completions_course_id_idx`(`course_id`),
    INDEX `student_course_completions_created_by_idx`(`created_by`),
    UNIQUE INDEX `student_course_completions_student_id_course_id_key`(`student_id`, `course_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `course_prerequisite_groups` ADD CONSTRAINT `course_prerequisite_groups_course_id_fkey` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `course_prerequisite_options` ADD CONSTRAINT `course_prerequisite_options_group_id_fkey` FOREIGN KEY (`group_id`) REFERENCES `course_prerequisite_groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `course_prerequisite_options` ADD CONSTRAINT `course_prerequisite_options_required_course_id_fkey` FOREIGN KEY (`required_course_id`) REFERENCES `courses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_course_completions` ADD CONSTRAINT `student_course_completions_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_course_completions` ADD CONSTRAINT `student_course_completions_course_id_fkey` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_course_completions` ADD CONSTRAINT `student_course_completions_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
