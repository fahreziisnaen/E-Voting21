-- Manajemen kelas + kandidat dipilih dari data siswa.
-- Aman untuk database yang sudah berisi data: teks kelas lama dipindahkan ke tabel `classes`,
-- dan setiap kandidat lama dihubungkan ke akun siswanya.

-- 1. Tabel kelas
CREATE TABLE `classes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(40) NOT NULL,
    `grade_level` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `classes_name_key`(`name`),
    INDEX `classes_grade_level_idx`(`grade_level`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2. Isi kelas dari teks kelas siswa & kandidat yang sudah ada. Tingkat dikenali dari awalan
--    X / XI / XII (atau 10 / 11 / 12); selain itu dibiarkan kosong.
INSERT IGNORE INTO `classes` (`name`, `grade_level`)
SELECT src.`name`,
    CASE
        WHEN src.`name` REGEXP '^(XII|12)([^0-9A-Za-z]|$)' THEN 12
        WHEN src.`name` REGEXP '^(XI|11)([^0-9A-Za-z]|$)' THEN 11
        WHEN src.`name` REGEXP '^(X|10)([^0-9A-Za-z]|$)' THEN 10
        ELSE NULL
    END
FROM (
    SELECT TRIM(`class`) AS `name` FROM `users` WHERE `role` = 'student' AND TRIM(`class`) <> ''
    UNION
    SELECT TRIM(`class`) FROM `candidates` WHERE TRIM(`class`) <> ''
) AS src;

-- 3. Hubungkan siswa ke kelas
ALTER TABLE `users` ADD COLUMN `class_id` INTEGER NULL;

UPDATE `users` u
    JOIN `classes` c ON c.`name` = TRIM(u.`class`)
SET u.`class_id` = c.`id`
WHERE u.`role` = 'student';

-- 4. Hubungkan kandidat ke siswa dengan nama & kelas yang sama
ALTER TABLE `candidates` ADD COLUMN `user_id` INTEGER NULL;

UPDATE `candidates` k
    JOIN `users` u ON u.`role` = 'student' AND u.`name` = k.`name` AND TRIM(u.`class`) = TRIM(k.`class`)
SET k.`user_id` = u.`id`;

-- 5. Kandidat lama yang belum terdaftar sebagai siswa dibuatkan akun siswa. Akun ini belum bisa login
--    (NIS sementara "KANDIDAT-<nomor>", tanpa kode akses): lengkapi lewat Panel Panitia → Data Siswa.
INSERT INTO `users` (`nis`, `name`, `class`, `class_id`, `password_hash`, `role`, `has_voted`, `token_version`)
SELECT CONCAT('KANDIDAT-', k.`candidate_number`), k.`name`, k.`class`, c.`id`, '!kode-akses-belum-diatur', 'student', false, 0
FROM `candidates` k
    LEFT JOIN `classes` c ON c.`name` = TRIM(k.`class`)
WHERE k.`user_id` IS NULL;

UPDATE `candidates` k
    JOIN `users` u ON u.`nis` = CONCAT('KANDIDAT-', k.`candidate_number`)
SET k.`user_id` = u.`id`
WHERE k.`user_id` IS NULL;

-- 6. Hapus kolom teks lama dan pasang constraint
ALTER TABLE `users` DROP COLUMN `class`;

ALTER TABLE `candidates` DROP COLUMN `class`,
    DROP COLUMN `name`,
    MODIFY `user_id` INTEGER NOT NULL;

CREATE INDEX `users_class_id_idx` ON `users`(`class_id`);

CREATE UNIQUE INDEX `candidates_user_id_key` ON `candidates`(`user_id`);

ALTER TABLE `users` ADD CONSTRAINT `users_class_id_fkey` FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `candidates` ADD CONSTRAINT `candidates_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
