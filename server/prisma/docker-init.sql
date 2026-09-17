-- Dijalankan sekali saat volume MySQL pertama kali dibuat (docker compose).
-- `prisma migrate dev` membutuhkan shadow database, dan `npm test` memakai evoting_test.
CREATE DATABASE IF NOT EXISTS evoting_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON *.* TO 'evoting'@'%';
FLUSH PRIVILEGES;
