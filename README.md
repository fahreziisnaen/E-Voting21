# E-Voting OSIS — SMAN 21 Kota Surabaya

Aplikasi pemungutan suara digital untuk Pemilihan Ketua OSIS SMAN 21 Kota Surabaya.
Siswa masuk dengan NIS + kode akses, melihat profil kandidat, lalu memberikan **satu suara** yang
divalidasi di server. Panitia memantau partisipasi, mengelola kandidat/siswa/jadwal, mengekspor hasil,
dan memeriksa audit log.

Desain acuan ada di [`design_handoff_evoting_osis/`](design_handoff_evoting_osis/README.md).

| Bagian | Teknologi |
|---|---|
| Frontend (`client/`) | React 19, TypeScript, Vite, Tailwind CSS 4, React Router, TanStack Query, lucide-react, Recharts |
| Backend (`server/`) | Node.js, Express 5, TypeScript, Zod, Prisma 7 |
| Database | MySQL 8 (lihat [catatan database](#catatan-database)) |
| Auth | JWT di cookie httpOnly (access + refresh), argon2id, RBAC `student` / `admin`, CSRF double-submit |
| Test | Vitest + Supertest (API, MySQL sungguhan), Vitest + Testing Library (UI) |

---

## Menjalankan dengan Docker (server)

Seluruh aplikasi (web + API dalam satu container) dan MySQL dijalankan oleh `docker-compose.yml`.

| Layanan | Port host | Keterangan |
|---|---|---|
| `app` | **8021** (ubah lewat `APP_PORT`) | `http://<IP-server>:8021` |
| `db` | — | MySQL 8.4 hanya dapat diakses dari jaringan internal compose |

```bash
cp .env.example .env
# Isi nilai kosong di .env. Buat nilai acak dengan:  openssl rand -hex 32
#   DB_PASSWORD, DB_ROOT_PASSWORD, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, SEED_ADMIN_PASSWORD

docker compose up -d --build
docker compose logs -f app             # tunggu "E-Voting OSIS berjalan di …"
```

Saat container `app` start, otomatis: `prisma migrate deploy` → seeder (**hanya jika database masih kosong**,
sehingga data yang dihapus panitia tidak muncul lagi) → server. Nama project compose `evoting-osis`, jadi container,
network, dan volume tidak bentrok dengan stack lain di server yang sama.

| Keperluan | Perintah |
|---|---|
| Update setelah kode berubah | `docker compose up -d --build` |
| Log aplikasi | `docker compose logs -f app` |
| Backup database | `docker compose exec -T db sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" evoting' > backup.sql` |
| Restore database | `docker compose exec -T db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" evoting' < backup.sql` |
| Hentikan | `docker compose down` (data tetap di volume `evoting-osis_evoting-db` & `evoting-osis_evoting-uploads`) |

**HTTP vs HTTPS.** `.env.example` memakai `COOKIE_SECURE=false` agar bisa langsung dicoba lewat
`http://IP:8021` (browser tidak menyimpan cookie `Secure` di http). Untuk pemilihan sungguhan, pasang HTTPS lewat
reverse proxy, lalu set `COOKIE_SECURE=true` dan `TRUST_PROXY=1`, kemudian `docker compose up -d`.
Contoh bila Caddy sudah berjalan di server (container lain), tambahkan ke Caddyfile:

```
evoting.domain-sekolah.sch.id {
    reverse_proxy <IP-LAN-server>:8021
}
```

Setelah HTTPS aktif, sebaiknya port 8021 hanya dibuka untuk proxy (firewall), bukan untuk publik.

## Menjalankan secara lokal (pengembangan)

**Prasyarat:** Node.js ≥ 22 dan salah satu dari: Docker, **atau** MySQL 8 lokal (mis. Laragon/XAMPP).

```bash
# 1. Konfigurasi
cp server/.env.example server/.env      # lalu isi JWT_*_SECRET dengan string acak (lihat komentar di file)

# 2. Database (pilih salah satu)
cp .env.example .env && npm run db:up   # MySQL di 127.0.0.1:3306 + database evoting_test;
#                                         samakan DB_PASSWORD (.env) dengan password di server/.env
#   — atau gunakan MySQL lokal: buat database `evoting` & `evoting_test`, lalu sesuaikan
#     DATABASE_URL / TEST_DATABASE_URL di server/.env

# 3. Dependensi, migrasi, data contoh
npm install
npm run setup                           # prisma migrate deploy + seed

# 4. Jalankan
npm run dev                             # API http://localhost:4000 · Web http://localhost:5173
```

`npm run dev` otomatis menjalankan `prisma generate` dan `prisma migrate deploy` sebelum server hidup.

### Akun demo (dari seeder)

| Peran | Login | Kode akses / kata sandi |
|---|---|---|
| Siswa (belum memilih) | NIS `0021453`, `0021401` – `0021404` | nilai `SEED_STUDENT_PASSWORD` (default `osis2025`) |
| Panitia | `SEED_ADMIN_USERNAME` (default `admin.osis`) | nilai `SEED_ADMIN_PASSWORD` |

Seeder membuat 13 kelas, 44 siswa (4 di antaranya kandidat), 1 akun panitia, jadwal contoh yang **sedang berlangsung**
(kemarin s/d lusa, 00:00–23:59 WIB), dan ± dua pertiga suara contoh agar grafik panitia terisi
(`SEED_DEMO_VOTES=false` untuk mematikan). Seeder aman dijalankan ulang: data yang sudah ada tidak ditimpa.

Uji dari ponsel di jaringan yang sama: `npm run dev -w client -- --host`, lalu buka `http://<IP-komputer>:5173`
(biarkan `COOKIE_SECURE=false` untuk pengujian lokal via http).

## Perintah

| Perintah (dari root) | Fungsi |
|---|---|
| `npm run dev` | Server + client dalam mode pengembangan |
| `npm test` | Test server (butuh database test) lalu test client |
| `npm run typecheck` | Pemeriksaan TypeScript server & client |
| `npm run build` / `npm start` | Build produksi; server menyajikan API **dan** hasil build React |
| `npm run setup` | Terapkan migrasi + seed |
| `npm run db:migrate` | Buat migrasi baru setelah mengubah `server/prisma/schema.prisma` |
| `npm run db:seed` | Jalankan seeder |
| `npm run db:reset` | ⚠️ Hapus seluruh data, migrasi ulang, lalu seed (hanya untuk development) |

## Struktur folder

```
client/
  src/
    assets/logo-sman21.png   ← logo sekolah (ganti file ini saja)
    components/              Modal (focus trap, Esc), Toast, guard route, logo, foto/badge kandidat
    features/student/        Navbar, hero, kartu kandidat, sidebar, modal detail & konfirmasi, footer
    features/admin/          Kartu statistik, grafik, tabel audit, komponen panel
    pages/                   Login, beranda siswa, halaman sukses, pages/admin/* (9 menu panitia)
    hooks/                   TanStack Query: sesi, kandidat, jadwal, data panitia
    lib/                     API client (CSRF + refresh token), format WIB, CSV, warna kandidat
    index.css                Design tokens Tailwind (warna, radius, font, animasi)
server/
  prisma/                    schema.prisma, migrations/, seed.ts, docker-init.sql
  src/
    routes/                  auth, publik (kandidat, jadwal, vote), admin/*
    services/                votes (transaksi satu suara), election (jadwal), stats, audit
    middleware/              auth + RBAC, CSRF, rate limit, error handler
    lib/                     prisma, token/cookie, argon2, upload foto, CSV, waktu WIB
  tests/                     Test API & unit
  uploads/                   Foto kandidat & gedung (dibuat otomatis, jangan di-commit)
Dockerfile                   Image produksi (build client + server, runtime Node 24)
docker/start.sh              Migrasi → seed bila kosong → start server
docker-compose.yml           Aplikasi + MySQL (server)
docker-compose.dev.yml       Override pengembangan: buka MySQL ke localhost + database test
.env.example                 Variabel untuk Docker Compose
```

## Mengganti data

Urutan yang disarankan: **impor siswa → cek kelas → pilih kandidat → atur jadwal**.

- **Siswa** — Panel Panitia → *Data Siswa* → *Impor Siswa*. Berkas **Excel (.xlsx)** atau **CSV** (pemisah `,`/`;`)
  dengan kolom `nis`, `nama`, `kelas`, dan opsional `kode_akses` (template tersedia di dialog).
  - Pratinjau menampilkan baris bermasalah, kelas baru, dan jumlah kode akses yang dibuat otomatis sebelum disimpan.
  - Kode akses yang kosong dibuat otomatis (8 karakter). Setelah impor, **unduh daftar kode akses (CSV)** untuk
    dibagikan — kode akses disimpan ter-hash dan tidak bisa ditampilkan lagi.
  - NIS yang sudah terdaftar dilewati. Di Excel, format kolom NIS sebagai *Teks* agar angka 0 di depan tidak hilang.
  - Data dikirim per 500 baris; impor bisa diulang dengan aman bila terputus.
  - Tambah/edit satu siswa, pindah kelas, atau reset kode akses lewat tombol *Edit*.
- **Kelas** — *Data Kelas*: tambah, ganti nama, atur tingkat (X/XI/XII/Lainnya), dan lihat partisipasi per kelas.
  Mengganti nama kelas otomatis berlaku untuk semua siswanya. Kelas yang masih berisi siswa tidak bisa dihapus.
  Saat impor, kelas yang belum ada bisa dibuat otomatis dan tingkatnya dikenali dari nama (`XII IPA 1` → XII).
- **Kandidat** — *Data Kandidat* → *Tambah Kandidat*: **pilih dari siswa terdaftar** (cari NIS/nama, filter tingkat
  dan kelas), lalu isi nomor urut, visi, misi, program, riwayat organisasi, dan unggah foto (rasio 4:5, JPG/PNG/WEBP,
  maks. 3 MB). Nama & kelas kandidat selalu mengikuti data siswa. Satu siswa hanya bisa menjadi satu kandidat, dan
  siswa yang menjadi kandidat tidak bisa dihapus. Selama masa pemungutan suara, kandidat tidak bisa ditambah/dihapus
  dan nomor urut maupun siswanya tidak bisa diganti. Data contoh ada di `server/prisma/seed.ts`.
- **Jadwal** — *Jadwal Voting*: tanggal mulai–selesai, jam buka–tutup harian (WIB), dan status Draf/Dibuka/Ditutup.
- **Foto gedung sekolah (hero)** — *Pengaturan Sistem* → unggah foto landscape ≥ 1600 px.
- **Logo** — ganti `client/src/assets/logo-sman21.png` (dan `client/public/favicon.png`) dengan file resmi.
  Tampilan selalu menjaga proporsi asli logo. File sumber beresolusi penuh ada di `design_handoff_evoting_osis/design/assets/`.
- **Kata sandi panitia** — *Pengaturan Sistem*. Menjalankan ulang seeder **tidak** menimpa kata sandi yang sudah diganti.

## Bagaimana "satu siswa, satu suara" dijamin

`POST /api/votes` (hanya peran `student`):

1. Sesi divalidasi dan data user dimuat ulang dari database — `has_voted` tidak pernah diambil dari klien.
2. Jadwal diperiksa **di server** (status + rentang tanggal + jam harian WIB). Di luar jadwal → `403`.
3. Satu transaksi database: `UPDATE users SET has_voted = true WHERE id = ? AND has_voted = false`
   (mengunci baris; request paralel mendapat 0 baris) → `INSERT votes` → `INSERT audit_logs`.
4. `votes.user_id` **UNIQUE** menjadi pengaman terakhir. Pelanggaran → `409` dengan pesan
   *"Anda sudah memberikan suara. Setiap siswa hanya dapat memilih satu kali."* dan dicatat di audit log.

Di sisi UI, tombol *Pilih Kandidat* selalu membuka modal konfirmasi, dan tombol *Konfirmasi Suara* dinonaktifkan
selama menyimpan. Test mencakup suara ganda berurutan, 5 request paralel (hasil: tepat 1 suara), flag `has_voted`
yang dimanipulasi, sebelum/sesudah jadwal, status ditutup, dan RBAC.

## Keamanan

- Password/kode akses: argon2id (m=19 MiB, t=2). Pesan login gagal identik untuk NIS salah & kode salah.
- Cookie `httpOnly` + `SameSite=Strict`; `Secure` saat `COOKIE_SECURE=true` (**wajib** untuk akses HTTPS; server
  menulis peringatan di log bila production berjalan dengan `false`). Access token 15 menit, refresh token 12 jam.
  Logout / reset kode akses / ganti kata sandi mencabut semua sesi akun tersebut.
- CSRF double-submit token di semua request non-GET. Helmet (CSP, nosniff; HSTS dan `upgrade-insecure-requests` hanya
  saat `COOKIE_SECURE=true`). Semua input divalidasi Zod.
- Rate limit: login per (IP + NIS) — sengaja tidak per-IP saja karena satu lab sekolah berbagi IP — ditambah batas
  longgar per IP; voting per akun.
- Upload foto divalidasi dari *magic bytes*, nama file acak, maks. 3 MB. Export CSV aman dari formula injection.
- Audit log: login (sukses/gagal), suara tersimpan, penolakan suara (beserta alasan), perubahan jadwal, kandidat,
  siswa, foto, ekspor hasil. Metadata **tidak** memuat pilihan kandidat.
- Panel panitia hanya menampilkan agregat; tidak ada tampilan "siapa memilih siapa".

**Batasan yang perlu diketahui**

- Sesuai skema yang diminta, tabel `votes` menyimpan `user_id` dan `candidate_id` dalam satu baris. Siapa pun yang
  punya akses langsung ke database dapat menghubungkan siswa dengan pilihannya. Batasi akses database hanya untuk
  admin server, dan jangan bagikan dump database.
- `npm audit` melaporkan advisori pada `mariadb` (driver yang dipakai adapter Prisma, belum ada versi perbaikan) terkait
  koneksi TLS dan charset Asia Timur, serta pada `mysql2`/`deepmerge-ts` di Prisma CLI (hanya dev). Aplikasi memakai
  utf8mb4; jalankan database di localhost/jaringan privat, bukan lewat internet.

## Deploy produksi (ringkas)

Cara yang disarankan adalah [Docker](#menjalankan-dengan-docker-server). Tanpa Docker:

1. Server Linux dengan Node ≥ 22 dan MySQL 8. Buat `server/.env` dengan `NODE_ENV=production`, secret JWT baru,
   kredensial database kuat, `COOKIE_SECURE=true`, `TRUST_PROXY=1` jika di belakang reverse proxy.
2. `npm ci && npm run build && npm run db:deploy`, lalu seed sekali (atau impor data asli).
3. Jalankan `npm start` dengan process manager (systemd/pm2). Server menyajikan API dan aplikasi web di satu port.
4. Pasang reverse proxy dengan **HTTPS**. Batasi ukuran body di proxy ≥ 4 MB untuk upload foto.
5. Cadangkan database dan folder `server/uploads/` secara berkala.

Sebelum hari pemilihan: ganti data contoh (hapus kandidat/siswa contoh, impor siswa asli), atur jadwal asli
(mis. 07:00–15:00 WIB), aktifkan HTTPS + `COOKIE_SECURE=true`, dan pastikan jam server tepat (NTP).

## Catatan keputusan

<a id="catatan-database"></a>
- **MySQL, bukan PostgreSQL.** Lingkungan pengembangan tidak memiliki PostgreSQL maupun Docker, sehingga dipakai
  fallback MySQL sesuai spesifikasi. `mission`, `programs`, `organization_history` disimpan sebagai JSON.
  Pindah ke PostgreSQL: ganti `provider` di `schema.prisma`, ganti adapter di `server/src/lib/prisma.ts`
  ke `@prisma/adapter-pg`, lalu buat ulang migrasi.
- **Jam pemungutan suara harian.** Karena UI menampilkan *Tanggal* dan *Waktu* terpisah ("12–14 September",
  "07:00–15:00 WIB"), server menafsirkannya sebagai jam buka harian, bukan satu rentang kontinu. Jika jam buka ≥ jam
  tutup, rentang dianggap kontinu.
- **Perubahan dari skema awal:** tabel `classes` (kelas + tingkat) dengan `users.class_id` menggantikan teks
  `users.class`; `candidates.user_id` (UNIQUE) menggantikan `candidates.name`/`class` sehingga kandidat selalu siswa
  terdaftar. Kolom tambahan: `users.token_version` (pencabutan sesi), `candidates.organization_history` (modal
  detail), `votes.receipt_code` (ID suara acak, tidak memuat pilihan), `audit_logs.status` & `actor`,
  `election_settings.hero_photo_url`.
- **Migrasi database lama** (`20260917100000_kelas_kandidat_dari_siswa`, berjalan otomatis): teks kelas lama
  dipindahkan ke tabel `classes`, dan setiap kandidat dihubungkan ke siswa dengan nama & kelas yang sama. Kandidat
  yang tidak ditemukan di data siswa dibuatkan akun siswa dengan NIS sementara `KANDIDAT-<nomor urut>` tanpa kode
  akses — ganti NIS dan atur kode aksesnya di *Data Siswa*.
- **Aksesibilitas warna.** Beberapa teks kecil memakai warna sedikit lebih gelap dari prototipe agar lolos kontras
  4.5:1 (label "Visi" kandidat 2 `#946F00`, teks bantu `#64748B`, lingkaran langkah 5 `#15803D`).
