-- Hasil terbuka otomatis saat pemungutan suara selesai atau semua pemilih sudah memilih.
-- Kolom ini dipakai bila panitia menahan pengumuman.
ALTER TABLE `election_settings` ADD COLUMN `results_withheld` BOOLEAN NOT NULL DEFAULT false;
