# E-Voting OSIS — SMAN 21 Kota Surabaya

Aplikasi pemungutan suara digital untuk pemilihan di SMAN 21 Kota Surabaya: **beberapa kategori sekaligus**
(mis. Ketua OSIS, Ketua MPK, Guru Favorit) dengan **siswa dan guru** sebagai pemilih.
Siapa pun bisa membuka beranda dan halaman kandidat **tanpa login**. Pemilih baru diminta masuk (NIS untuk siswa
atau username untuk guru + kode akses) saat menekan *Pilih Kandidat*, lalu memberikan **satu suara di setiap kategori**
yang divalidasi di server. Panitia mengelola kategori/kandidat/siswa/guru/kelas/jadwal, memantau partisipasi,
mengumumkan hasil, mengekspor rekap, dan memeriksa audit log.

| Halaman | Akses | Isi |
|---|---|---|
| `/` Beranda | Publik | Hero, tab kategori + kandidatnya, detail kandidat, jadwal, status voting per kategori, tata cara, tombol *Masuk untuk Memilih*; perolehan suara tiap kandidat muncul setelah hasil terbuka |
| `/kandidat` | Publik | Profil lengkap tiap kandidat per kategori dalam slide otomatis (8 detik; berhenti saat kursor di atas slide, fokus keyboard, atau modal terbuka; bisa dijeda, digeser di ponsel, dan dipilih langsung) |
| `/terpilih` | Publik | Pemenang & perolehan suara setiap kategori — terbuka otomatis saat pemungutan suara selesai atau semua pemilih sudah memilih; sebelum itu tampil pesan menunggu |
| `/login` | Publik | Masuk pemilih (NIS siswa / username guru); setelah masuk kembali ke halaman asal dan konfirmasi kandidat yang dipilih langsung terbuka |
| `/voting/berhasil` | Siswa & guru | Bukti suara per kategori + kategori yang belum dipilih |
| `/admin/*` | Panitia | Panel panitia |

Desain acuan ada di [`design_handoff_evoting_osis/`](design_handoff_evoting_osis/README.md).

| Bagian | Teknologi |
|---|---|
| Frontend (`client/`) | React 19, TypeScript, Vite, Tailwind CSS 4, React Router, TanStack Query, lucide-react, Recharts |
| Backend (`server/`) | Node.js, Express 5, TypeScript, Zod, Prisma 7 |
| Database | MySQL 8 (lihat [catatan database](#catatan-database)) |
| Auth | JWT di cookie httpOnly (access + refresh), argon2id, RBAC `student` / `teacher` / `admin`, CSRF double-submit |
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
| Guru (belum memilih) | Username `guru.agus` | nilai `SEED_STUDENT_PASSWORD` |
| Panitia | `SEED_ADMIN_USERNAME` (default `admin.osis`) | nilai `SEED_ADMIN_PASSWORD` |

Seeder membuat 13 kelas, 47 siswa, 6 guru, 1 akun panitia, 3 kategori contoh (Ketua OSIS & Ketua MPK untuk siswa dan
guru, Guru Favorit khusus siswa) dengan 10 kandidat, jadwal contoh yang **sedang berlangsung** (kemarin s/d lusa,
00:00–23:59 WIB), dan sebagian suara contoh agar grafik panitia terisi (`SEED_DEMO_VOTES=false` untuk mematikan).
Seeder aman dijalankan ulang: data yang sudah ada tidak ditimpa.

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

Jalankan `npm test` saat `npm run dev` **tidak** aktif: di Windows, dev server Vite yang berjalan bersamaan membuat
Vitest gagal mengumpulkan berkas test ("no tests").

## Struktur folder

```
client/
  src/
    assets/logo-sman21.png   ← logo sekolah (ganti file ini saja)
    components/              Modal (focus trap, Esc), Toast, guard route, logo, foto/badge kandidat
    features/student/        Navbar, hero, tab kategori, kartu kandidat, sidebar, modal detail & konfirmasi, footer
    features/admin/          Kartu statistik, grafik per kategori, tabel audit, halaman pemilih (siswa/guru), pemilih kandidat
    pages/                   Login, beranda, kandidat, terpilih, halaman sukses, pages/admin/* (12 menu panitia)
    hooks/                   TanStack Query: sesi, kategori & kandidat, jadwal, hasil, data panitia
    lib/                     API client (CSRF + refresh token), format WIB, CSV, warna kandidat, aturan hak memilih
    index.css                Design tokens Tailwind (warna, radius, font, animasi)
server/
  prisma/                    schema.prisma, migrations/, seed.ts, docker-init.sql
  src/
    routes/                  auth, publik (kategori, kandidat, jadwal, hasil, vote), admin/*
    services/                votes (satu suara per kategori), categories, election (jadwal + publikasi hasil), stats, audit,
                             backup (cadangan/pemulihan/reset pabrik)
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

Urutan yang disarankan: **atur kategori → impor siswa & guru → cek kelas → pilih kandidat → atur jadwal**.

- **Kategori** — Panel Panitia → *Data Kategori*: nama, deskripsi, urutan tampil, dan **siapa yang boleh memilih**
  (siswa & guru / khusus siswa / khusus guru). Selama pemungutan suara berlangsung, kategori tidak bisa
  ditambah/dihapus dan hak memilihnya tidak bisa diubah. Kategori yang sudah memiliki suara tidak bisa dihapus.
- **Siswa** — *Data Siswa* → *Impor Siswa*. Berkas **Excel (.xlsx)** atau **CSV** (pemisah `,`/`;`)
  dengan kolom `nis`, `nama`, `kelas`, dan opsional `kode_akses` (template tersedia di dialog).
  - Pratinjau menampilkan baris bermasalah, kelas baru, dan jumlah kode akses yang dibuat otomatis sebelum disimpan.
  - Kode akses yang kosong dibuat otomatis (8 karakter). Setelah impor, **unduh daftar kode akses (CSV)** untuk
    dibagikan — kode akses disimpan ter-hash dan tidak bisa ditampilkan lagi.
  - NIS yang sudah terdaftar dilewati. Di Excel, format kolom NIS sebagai *Teks* agar angka 0 di depan tidak hilang.
  - Data dikirim per 500 baris; impor bisa diulang dengan aman bila terputus.
  - Tambah/edit satu siswa, pindah kelas, atau reset kode akses lewat tombol *Edit*.
- **Guru** — *Data Guru*: sama seperti siswa, tetapi memakai kolom `username`, `nama`, dan opsional `kode_akses`
  (tanpa kelas). **NIP sengaja tidak dipakai** karena bersifat rahasia: panitia membuatkan username login (mis.
  `guru.budi`) beserta kode aksesnya, dan berkas impor dengan kolom `nip` ditolak. Kolom status menampilkan berapa
  kategori yang sudah dipilih dari yang menjadi haknya.
- **Kelas** — *Data Kelas*: tambah, ganti nama, atur tingkat (X/XI/XII/Lainnya), dan lihat partisipasi per kelas.
  Mengganti nama kelas otomatis berlaku untuk semua siswanya. Kelas yang masih berisi siswa tidak bisa dihapus.
  Saat impor, kelas yang belum ada bisa dibuat otomatis dan tingkatnya dikenali dari nama (`XII IPA 1` → XII).
- **Kandidat** — *Data Kandidat* → *Tambah Kandidat*: pilih **kategori**, lalu **pilih dari siswa atau guru terdaftar**
  (cari NIS/username/nama, filter tingkat dan kelas untuk siswa), lalu isi nomor urut (unik per kategori), visi, misi,
  program, riwayat organisasi, dan unggah foto (rasio 4:5, JPG/PNG/WEBP, maks. 3 MB). Nama & kelas kandidat selalu
  mengikuti data pemilih. Satu orang hanya bisa menjadi satu kandidat **per kategori** (boleh di kategori berbeda),
  dan orang yang menjadi kandidat tidak bisa dihapus. Selama masa pemungutan suara, kandidat tidak bisa
  ditambah/dihapus dan kategori, nomor urut, maupun orangnya tidak bisa diganti. Data contoh ada di
  `server/prisma/seed.ts`.
- **Jadwal** — *Jadwal Voting*: satu jadwal berlaku untuk semua kategori — tanggal mulai–selesai, jam buka–tutup
  harian (WIB), dan status Draf/Dibuka/Ditutup.
- **Pengumuman hasil** — otomatis. Perolehan suara terbuka untuk umum begitu **salah satu** syarat terpenuhi:
  jadwal berakhir / status diubah menjadi Ditutup, **atau** semua pemilih terdaftar sudah memilih di semua kategori
  yang menjadi haknya (kategori tanpa kandidat tidak dihitung). Sesudah itu beranda menampilkan persentase tiap
  kandidat dan menu *Terpilih* menampilkan pemenang per kategori (ditandai *Hasil seri* bila suara tertinggi sama).
  Panitia tetap memegang kendali di *Hasil Voting*: *Tahan pengumuman* menyembunyikan hasil kembali (mis. ada
  sengketa), *Umumkan hasil* membukanya lagi. Mengubah jadwal kembali ke masa pemungutan suara otomatis menutup
  hasil dan mereset status “ditahan”.
- **Foto gedung sekolah (hero)** — *Pengaturan Sistem* → unggah foto landscape ≥ 1600 px.
- **Logo** — ganti `client/src/assets/logo-sman21.png` (dan `client/public/favicon.png`) dengan file resmi.
  Tampilan selalu menjaga proporsi asli logo. File sumber beresolusi penuh ada di `design_handoff_evoting_osis/design/assets/`.
- **Kata sandi panitia** — *Pengaturan Sistem*. Menjalankan ulang seeder **tidak** menimpa kata sandi yang sudah diganti.

## Cadangan, pemulihan, dan reset

Panel Panitia → **Cadangan & Reset**.

| Tindakan | Yang terjadi |
|---|---|
| **Unduh Cadangan (JSON)** | Satu berkas berisi jadwal, kategori, kandidat, kelas, seluruh akun (siswa/guru/panitia beserta hash kode akses), suara, dan audit log. Seluruh id ikut disimpan sehingga relasi dan ID suara tetap sama setelah dipulihkan. |
| **Pulihkan dari Cadangan** | Berkas diperiksa dulu (versi, relasi, keberadaan akun panitia), ringkasannya ditampilkan, lalu **seluruh isi database diganti** dalam satu transaksi. Karena akun panitia ikut diganti, sesi ditutup dan panitia masuk ulang. |
| **Reset Pabrik** | Menghapus semua data pemilihan **dan** foto yang diunggah, menyisakan akun panitia yang menjalankannya, lalu mengembalikan jadwal ke draf. Sesi panitia lain dicabut. |

Pengaman untuk dua tindakan merusak: harus mengetik kata kunci (`PULIHKAN` / `RESET`), memasukkan **kata sandi panitia**, dan
pemungutan suara **tidak sedang berjalan** (tutup dulu di *Jadwal Voting*). Semuanya dicatat di audit log, termasuk percobaan
dengan kata sandi salah.

> **Foto tidak ikut di dalam berkas JSON.** Salin juga folder `server/uploads/` (Docker: volume
> `evoting-osis_evoting-uploads`). Berkas cadangan memuat data pribadi pemilih dan hash kode akses — perlakukan seperti dokumen
> rahasia sekolah.

Untuk cadangan tingkat server (mis. sebelum upgrade), `mysqldump` di bagian [Docker](#menjalankan-dengan-docker-server) tetap
cara yang paling lengkap karena ikut menyalin struktur tabel.

## Bagaimana "satu suara per kategori" dijamin

`POST /api/votes` (hanya peran `student` dan `teacher`):

1. Sesi divalidasi dan data user dimuat ulang dari database — status memilih tidak pernah diambil dari klien.
2. Jadwal diperiksa **di server** (status + rentang tanggal + jam harian WIB). Di luar jadwal → `403`.
3. Kategori kandidat diambil dari database, lalu hak memilih diperiksa: kategori `student`/`teacher` hanya untuk
   peran tersebut, panitia tidak pernah boleh memilih. Tidak berhak → `403` `NOT_ELIGIBLE`.
4. Satu transaksi database: `INSERT votes (user_id, category_id, candidate_id, receipt_code…)` → `INSERT audit_logs`.
5. `UNIQUE(user_id, category_id)` menjadi pengaman terakhir — termasuk untuk request paralel. Pelanggaran → `409`
   dengan pesan *"Anda sudah memberikan suara untuk kategori X. Setiap pemilih hanya dapat memilih satu kali per
   kategori."* dan dicatat di audit log.

Di sisi UI, tombol *Pilih Kandidat* selalu membuka modal konfirmasi (dengan nama kategorinya), dan tombol
*Konfirmasi Suara* dinonaktifkan selama menyimpan. Test mencakup suara ganda di kategori yang sama, memilih di
kategori berbeda, request paralel (hasil: tepat 1 suara per kategori), guru di kategori khusus siswa,
sebelum/sesudah jadwal, status ditutup, publikasi hasil, dan RBAC.

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
- Audit log: login (sukses/gagal), suara tersimpan (kategori + ID suara), penolakan suara (beserta alasan, termasuk
  *tidak berhak*), perubahan jadwal, kategori, kandidat, siswa, guru, foto, publikasi/penarikan hasil, ekspor hasil.
  Metadata **tidak** memuat pilihan kandidat.
- Panel panitia hanya menampilkan agregat; tidak ada tampilan "siapa memilih siapa".
- Pemulihan cadangan dan reset pabrik memerlukan kata kunci ketik-ulang + kata sandi panitia, ditolak selama pemungutan suara
  berjalan, dan tercatat di audit log (berhasil maupun gagal). Berkas cadangan hanya bisa diunduh oleh panitia yang sudah masuk.
- Data publik (tanpa login) terbatas pada kategori, profil kandidat (tanpa NIS/username), jadwal, dan status pemungutan
  suara. `GET /api/results` membalas `{ published: false, categories: [] }` selama hasil belum terbuka, jadi
  perolehan suara tidak pernah bocor selama pemungutan suara masih berjalan — termasuk untuk pemilih yang sudah
  memberikan suara. `POST /api/votes` tetap wajib login sebagai siswa/guru.
  `GET /api/auth/me` tanpa cookie sesi membalas `{ user: null, votes: [] }` agar pengunjung beranda tidak memicu
  percobaan refresh token.

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
5. Cadangkan database dan folder `server/uploads/` secara berkala — atau pakai menu **Cadangan & Reset** di panel panitia
   untuk mengunduh berkas JSON (foto tetap perlu disalin terpisah).

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
- **Dirancang untuk ponsel.** Mayoritas pemilih memakai HP, jadi setiap halaman diuji pada lebar 360, 390, dan 768 px:
  tidak ada halaman yang dapat digeser ke samping, tombol aksi utama setinggi 46 px, tombol pada modal menempel di bawah layar,
  tabel panjang di panel panitia digeser sendiri (utility `table-scroll`, wajib memakai `contain: paint` agar halaman tidak
  ikut bergeser di Chrome/Edge), dan rekapitulasi hasil tampil sebagai daftar batang — bukan tabel — di layar kecil.
- **Hasil baru terbuka setelah pemungutan suara selesai.** Menampilkan perolehan suara sementara dapat memengaruhi
  pemilih yang belum memilih (efek ikut-ikutan), sehingga halaman publik hanya menampilkan jadwal, kandidat, dan
  jumlah partisipasi selama voting berjalan. Hasil terbuka otomatis saat jadwal selesai/ditutup atau saat seluruh
  pemilih sudah memilih — kondisi terakhir membuat pemilihan yang sudah tuntas tidak perlu menunggu jadwal habis.
  Status “semua sudah memilih” dihitung ulang setiap kali ada suara baru (di-cache 5 detik untuk pembacaan berulang).
- **Guru login dengan username, bukan NIP.** NIP adalah data kepegawaian yang bersifat rahasia, jadi identitas login
  guru dibuat panitia (mis. `guru.budi`) — sama seperti akun panitia. Kolom `users.nis` dipakai bersama untuk NIS
  siswa, username guru, dan username panitia, sehingga tidak ada perubahan skema. Database yang terlanjur memakai NIP
  bisa diperbaiki lewat *Data Guru* → *Edit* tanpa kehilangan suara yang sudah masuk.
- **Satu jadwal untuk semua kategori.** Panitia sekolah membuka seluruh kategori bersamaan, sehingga jadwal tetap
  satu baris `election_settings` — bukan per kategori. Kategori mengatur *siapa* yang boleh memilih, bukan *kapan*.
- **Perubahan dari skema awal:** tabel `classes` (kelas + tingkat) dengan `users.class_id` menggantikan teks
  `users.class`; `candidates.user_id` menggantikan `candidates.name`/`class` sehingga kandidat selalu orang
  terdaftar; tabel `categories` (nama, deskripsi, `voter_scope`, urutan) dengan `candidates.category_id` dan
  `votes.category_id`; `users.has_voted` dihapus — status memilih dihitung dari tabel `votes`; peran `teacher`
  ditambahkan ke enum `users.role`. Kunci unik: `candidates(category_id, candidate_number)`,
  `candidates(category_id, user_id)`, dan `votes(user_id, category_id)`. Kolom tambahan: `users.token_version`
  (pencabutan sesi), `candidates.organization_history` (modal detail), `votes.receipt_code` (ID suara acak, tidak
  memuat pilihan), `audit_logs.status` & `actor`, `election_settings.hero_photo_url`,
  `election_settings.results_published_at` (waktu hasil pertama kali terbuka) dan
  `election_settings.results_withheld` (panitia menahan pengumuman).
- **Migrasi database lama** (`20260917100000_kelas_kandidat_dari_siswa`, berjalan otomatis): teks kelas lama
  dipindahkan ke tabel `classes`, dan setiap kandidat dihubungkan ke siswa dengan nama & kelas yang sama. Kandidat
  yang tidak ditemukan di data siswa dibuatkan akun siswa dengan NIS sementara `KANDIDAT-<nomor urut>` tanpa kode
  akses — ganti NIS dan atur kode aksesnya di *Data Siswa*.
- **Migrasi publikasi otomatis** (`20260918120000_publikasi_hasil_otomatis`, berjalan otomatis): menambahkan kolom
  `election_settings.results_withheld` (default `false`), tanpa mengubah data lain.
- **Migrasi kategori & guru** (`20260918090000_kategori_guru_hasil`, berjalan otomatis): database yang sudah berisi
  kandidat atau suara mendapat kategori **"Ketua OSIS"**, dan seluruh kandidat serta suara lama dipindahkan ke
  kategori tersebut — tidak ada data yang hilang. Setelah migrasi, ganti nama kategori itu bila perlu dan tambahkan
  kategori lain di *Data Kategori*.
- **Aksesibilitas warna.** Beberapa teks kecil memakai warna sedikit lebih gelap dari prototipe agar lolos kontras
  4.5:1 (label "Visi" kandidat 2 `#946F00`, teks bantu `#64748B`, lingkaran langkah 5 `#15803D`).
