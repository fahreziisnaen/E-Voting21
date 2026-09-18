-- Kategori pemilihan, guru sebagai pemilih, satu suara per pemilih PER KATEGORI, dan pengumuman hasil.
-- Aman untuk database yang sudah berisi data: kandidat & suara lama dimasukkan ke kategori "Ketua OSIS".

-- 1. Kategori
CREATE TABLE `categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(80) NOT NULL,
    `description` VARCHAR(300) NULL,
    `voter_scope` ENUM('all', 'student', 'teacher') NOT NULL DEFAULT 'all',
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `categories_name_key`(`name`),
    INDEX `categories_sort_order_idx`(`sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `categories` (`name`, `voter_scope`, `sort_order`)
SELECT 'Ketua OSIS', 'all', 1 FROM DUAL
WHERE EXISTS (SELECT 1 FROM `candidates`) OR EXISTS (SELECT 1 FROM `votes`);

-- 2. Peran guru. Status "sudah memilih" kini dihitung dari tabel votes per kategori.
DROP INDEX `users_role_has_voted_idx` ON `users`;

ALTER TABLE `users` DROP COLUMN `has_voted`,
    MODIFY `role` ENUM('student', 'teacher', 'admin') NOT NULL DEFAULT 'student';

CREATE INDEX `users_role_idx` ON `users`(`role`);

-- 3. Kandidat per kategori (nomor urut & siswa unik per kategori)
ALTER TABLE `candidates` ADD COLUMN `category_id` INTEGER NULL;

UPDATE `candidates` SET `category_id` = (SELECT `id` FROM `categories` WHERE `name` = 'Ketua OSIS');

ALTER TABLE `candidates` MODIFY `category_id` INTEGER NOT NULL;

-- Index baru dibuat lebih dulu agar foreign key user_id tetap punya index saat index lama dihapus.
CREATE INDEX `candidates_user_id_idx` ON `candidates`(`user_id`);

DROP INDEX `candidates_candidate_number_key` ON `candidates`;

DROP INDEX `candidates_user_id_key` ON `candidates`;

CREATE UNIQUE INDEX `candidates_category_id_candidate_number_key` ON `candidates`(`category_id`, `candidate_number`);

CREATE UNIQUE INDEX `candidates_category_id_user_id_key` ON `candidates`(`category_id`, `user_id`);

ALTER TABLE `candidates` ADD CONSTRAINT `candidates_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4. Suara per kategori
ALTER TABLE `votes` ADD COLUMN `category_id` INTEGER NULL;

UPDATE `votes` v
    JOIN `candidates` k ON k.`id` = v.`candidate_id`
SET v.`category_id` = k.`category_id`;

ALTER TABLE `votes` MODIFY `category_id` INTEGER NOT NULL;

CREATE UNIQUE INDEX `votes_user_id_category_id_key` ON `votes`(`user_id`, `category_id`);

DROP INDEX `votes_user_id_key` ON `votes`;

CREATE INDEX `votes_category_id_idx` ON `votes`(`category_id`);

ALTER TABLE `votes` ADD CONSTRAINT `votes_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- 5. Pengumuman hasil
ALTER TABLE `election_settings` ADD COLUMN `results_published_at` DATETIME(3) NULL;
