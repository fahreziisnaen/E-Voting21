-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nis` VARCHAR(64) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `class` VARCHAR(40) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `role` ENUM('student', 'admin') NOT NULL DEFAULT 'student',
    `has_voted` BOOLEAN NOT NULL DEFAULT false,
    `token_version` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `users_nis_key`(`nis`),
    INDEX `users_role_has_voted_idx`(`role`, `has_voted`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `candidates` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `candidate_number` INTEGER NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `class` VARCHAR(40) NOT NULL,
    `photo_url` VARCHAR(255) NULL,
    `vision` TEXT NOT NULL,
    `mission` JSON NOT NULL,
    `programs` JSON NOT NULL,
    `organization_history` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `candidates_candidate_number_key`(`candidate_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `votes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `candidate_id` INTEGER NOT NULL,
    `receipt_code` VARCHAR(32) NOT NULL,
    `voted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ip_address` VARCHAR(64) NULL,
    `user_agent` VARCHAR(255) NULL,

    UNIQUE INDEX `votes_user_id_key`(`user_id`),
    UNIQUE INDEX `votes_receipt_code_key`(`receipt_code`),
    INDEX `votes_candidate_id_idx`(`candidate_id`),
    INDEX `votes_voted_at_idx`(`voted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `election_settings` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `election_name` VARCHAR(160) NOT NULL,
    `start_date` DATETIME(3) NOT NULL,
    `end_date` DATETIME(3) NOT NULL,
    `status` ENUM('draft', 'open', 'closed') NOT NULL DEFAULT 'draft',
    `hero_photo_url` VARCHAR(255) NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NULL,
    `actor` VARCHAR(64) NULL,
    `action` VARCHAR(64) NOT NULL,
    `status` ENUM('success', 'rejected', 'failed') NOT NULL,
    `metadata` JSON NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_timestamp_idx`(`timestamp`),
    INDEX `audit_logs_action_idx`(`action`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `votes` ADD CONSTRAINT `votes_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `votes` ADD CONSTRAINT `votes_candidate_id_fkey` FOREIGN KEY (`candidate_id`) REFERENCES `candidates`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
