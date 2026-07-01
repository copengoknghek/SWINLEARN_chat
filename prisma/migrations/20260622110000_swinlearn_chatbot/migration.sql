CREATE TABLE `swinlearn_threads` (
    `id` VARCHAR(191) NOT NULL,
    `student_id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `selected_offering_ids` JSON NOT NULL,
    `openai_vector_store_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `swinlearn_threads_student_id_updated_at_idx`(`student_id`, `updated_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `swinlearn_messages` (
    `id` VARCHAR(191) NOT NULL,
    `thread_id` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL,
    `content` LONGTEXT NOT NULL,
    `citations` JSON NULL,
    `selected_offering_ids` JSON NOT NULL,
    `model` VARCHAR(191) NULL,
    `openai_response_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `swinlearn_messages_thread_id_created_at_idx`(`thread_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `swinlearn_attachments` (
    `id` VARCHAR(191) NOT NULL,
    `thread_id` VARCHAR(191) NOT NULL,
    `message_id` VARCHAR(191) NULL,
    `original_name` VARCHAR(191) NOT NULL,
    `mime_type` VARCHAR(191) NULL,
    `size` INTEGER NOT NULL,
    `stored_path` TEXT NOT NULL,
    `file_kind` VARCHAR(191) NOT NULL,
    `supported_by_file_search` BOOLEAN NOT NULL DEFAULT false,
    `openai_file_id` VARCHAR(191) NULL,
    `vector_store_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `swinlearn_attachments_thread_id_idx`(`thread_id`),
    INDEX `swinlearn_attachments_message_id_idx`(`message_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `swinlearn_knowledge_indexes` (
    `id` VARCHAR(191) NOT NULL,
    `offering_id` VARCHAR(191) NOT NULL,
    `package_id` VARCHAR(191) NULL,
    `vector_store_id` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `error_message` TEXT NULL,
    `indexed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `swinlearn_knowledge_indexes_offering_id_key`(`offering_id`),
    INDEX `swinlearn_knowledge_indexes_package_id_idx`(`package_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `swinlearn_threads` ADD CONSTRAINT `swinlearn_threads_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `swinlearn_messages` ADD CONSTRAINT `swinlearn_messages_thread_id_fkey` FOREIGN KEY (`thread_id`) REFERENCES `swinlearn_threads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `swinlearn_attachments` ADD CONSTRAINT `swinlearn_attachments_thread_id_fkey` FOREIGN KEY (`thread_id`) REFERENCES `swinlearn_threads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `swinlearn_attachments` ADD CONSTRAINT `swinlearn_attachments_message_id_fkey` FOREIGN KEY (`message_id`) REFERENCES `swinlearn_messages`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `swinlearn_knowledge_indexes` ADD CONSTRAINT `swinlearn_knowledge_indexes_offering_id_fkey` FOREIGN KEY (`offering_id`) REFERENCES `course_offerings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `swinlearn_knowledge_indexes` ADD CONSTRAINT `swinlearn_knowledge_indexes_package_id_fkey` FOREIGN KEY (`package_id`) REFERENCES `course_content_packages`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
