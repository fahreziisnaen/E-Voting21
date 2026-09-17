# ULTIMATE PROMPT — tempel ini ke Claude Code

> Cara pakai: taruh folder `design_handoff_evoting_osis/` di root project kosong (atau project existing),
> buka Claude Code di folder itu, lalu tempel seluruh blok di bawah ini sebagai pesan pertama.
> File `design/E-Voting OSIS SMAN 21.dc.html` adalah **referensi desain** (prototipe HTML), bukan kode produksi.
> Baca juga `README.md` untuk spesifikasi visual yang presisi.

---

Kamu adalah Senior Full-Stack Engineer. Bangun aplikasi **E-Voting Pemilihan Ketua OSIS SMAN 21 Kota Surabaya** yang production-ready.

## 0. Aturan kerja

1. **Sebelum menulis kode:** baca `design_handoff_evoting_osis/README.md` (spesifikasi desain presisi) dan buka `design_handoff_evoting_osis/design/E-Voting OSIS SMAN 21.dc.html` di browser untuk melihat prototipe. File HTML itu adalah referensi tampilan/perilaku — **recreate** di stack di bawah, jangan di-copy mentah, jangan diserve apa adanya.
2. Inspect dulu isi folder. Jika sudah ada stack/framework, ikuti yang ada; jangan ganti framework tanpa alasan kuat. Jika folder masih kosong, pakai stack di bagian 1.
3. Kerjakan **bertahap per fase** (bagian 8). Setelah setiap fase: jalankan build/test, laporkan ringkas apa yang dibuat, lalu lanjut.
4. Jangan membuat abstraksi yang tidak perlu. Data kandidat/siswa jangan di-hardcode di banyak tempat — satu sumber (seeder DB + service layer).
5. Setiap fase harus bisa dijalankan dengan `npm run dev` tanpa langkah manual tersembunyi. Tulis `README.md` project berisi cara setup, env, dan seed.

## 1. Stack

- Frontend: **React + TypeScript + Vite + Tailwind CSS**, React Router, TanStack Query, `lucide-react` untuk ikon, Recharts untuk chart admin.
- Backend: **Node.js + Express + TypeScript**, Zod untuk validasi, Prisma ORM.
- Database: **PostgreSQL** (fallback MySQL jika lingkungan tidak punya Postgres).
- Auth: **JWT httpOnly cookie** + refresh, bcrypt/argon2 untuk password hash, role-based access control (`student` | `admin`).
- Testing: Vitest (unit) + Supertest (API). Minimal test untuk aturan satu-suara-per-siswa.
- Monorepo sederhana: `client/` dan `server/`, plus `docker-compose.yml` untuk database.

## 2. Identitas visual (WAJIB dipatuhi)

Ambil nilai presisi dari README, ringkasnya:

- Navy: `#0F1F38`, `#152A4A` · Blue: `#0B5CAB`, `#1769AA` · Gold: `#F4C20D`, `#FFC107` · Red: `#E31E24`
- Background: `#F5F8FC` dan `#FFFFFF` · Border: `#E4ECF6` / `#D8E2EF`
- Teks: `#16233B` (primary), `#64748B` (secondary), `#94A3B8` (muted)
- Status: success `#16A34A`, warning `#F59E0B`, danger `#DC2626`
- Font: **Plus Jakarta Sans** (400–800), heading `font-weight: 800`, `letter-spacing: -0.01em`
- Radius: card 14–18px, input/button 9–10px · Border 1px solid `#E4ECF6`
- Nomor kandidat = badge lingkaran 40px dengan warna per kandidat: 1 merah, 2 gold (teks navy), 3 blue, 4 navy
- Aksen dekoratif: potongan diagonal merah & kuning (rotate 38deg) di hero, footer, dan panel login — subtle, jangan berlebihan
- Logo: pakai `design/assets/logo-sman21.png`, **proporsi asli**, jangan diubah warna/bentuk/distorsi. Simpan di `client/src/assets/`. Jika sekolah memberi file logo resmi, ganti file ini saja.
- Hindari: gradient berlebihan, neon, glassmorphism, animasi mengganggu, tampilan seperti marketplace atau template admin generik.

Animasi ringan saja: fade-up saat section masuk (200–500ms), hover card `translateY(-3px)` + shadow, transisi modal scale+fade 260–350ms, success ring pop.

## 3. Halaman & flow yang harus dibuat

**Siswa**

1. `/login` — split layout: panel navy kiri (logo, "E-Voting OSIS", subtitle "Pemilihan Ketua OSIS SMAN 21 Kota Surabaya", tagline "Suaramu Menentukan Masa Depan Sekolah"), form kanan (NIS / Username, Kode Akses, tombol "Masuk", info box "setiap siswa hanya dapat memberikan satu suara", link "Masuk sebagai panitia").
2. `/` Dashboard — navbar sticky (logo + SMAN 21 / Kota Surabaya, nav Beranda / Kandidat / Tata Cara Voting, chip profil siswa + logout), hero banner navy (logo besar, garis gold vertikal, "PEMILIHAN KETUA OSIS" / "SMAN 21" gold 62px / "KOTA SURABAYA" / tagline italic bergaris gold, slot foto gedung sekolah), lalu grid dua kolom: `minmax(0,1fr) 340px`.
   - Kiri: card "Daftar Kandidat Ketua OSIS" + subtitle "Kenali visi, misi, dan program kerja dari setiap kandidat." + grid kandidat `repeat(auto-fit, minmax(210px,1fr))`.
   - Card kandidat: foto 4:5, badge nomor, nama, kelas, label "Visi" berwarna aksen kandidat, kutipan visi 3 baris, tombol "Lihat Detail" (outline) dan "Pilih Kandidat" (solid aksen).
   - Kanan (sidebar): Jadwal Pemungutan Suara (tanggal, waktu), Status Voting (badge "Aktif" + "Anda belum/sudah memberikan suara"), Tata Cara Voting (5 langkah bernomor), notice merah "Setiap siswa hanya dapat memilih satu kali."
   - Footer navy: logo, "Berkarakter · Berprestasi · Berwawasan Global", copyright.
3. Modal detail kandidat — dua kolom (foto 300px + konten): nama, "Kandidat No. X · Kelas", Visi, Misi (list), Program Kerja Unggulan (chip), Riwayat Organisasi, tombol Tutup + "Pilih Kandidat Ini". Tutup via backdrop, tombol ✕, dan tombol Esc. Fokus terperangkap di dalam modal.
4. Modal konfirmasi — "Konfirmasi Pilihan Anda" / "Anda memilih:" + kartu kandidat + peringatan merah "Pilihan yang sudah dikonfirmasi tidak dapat diubah." + tombol "Kembali" (secondary) dan "Konfirmasi Suara" (primary, state loading "Menyimpan…"). **Tidak ada submit tanpa modal ini.**
5. `/voting/berhasil` — ikon centang besar (ring hijau), heading "Suara Anda Berhasil Direkam!", subtitle ucapan terima kasih, detail waktu voting + ID suara + status "Tercatat & terverifikasi", catatan bahwa hasil diumumkan panitia, tombol "Kembali ke Beranda" dan "Logout". **Jangan tampilkan hasil sementara ke siswa.**

**Panitia/Admin** (`/admin`, sidebar navy: Dashboard Overview, Monitoring Voting, Data Kandidat, Data Siswa, Jadwal Voting, Hasil Voting, Audit Log, Pengaturan Sistem)

- Overview: 4 stat card (Total Siswa Terdaftar, Sudah Voting, Belum Voting, Partisipasi + progress bar).
- Monitoring: bar horizontal perolehan suara per kandidat (warna aksen kandidat) + chart partisipasi per jam (Recharts).
- Audit Log: tabel Waktu / Aksi / Aktor / Status.
- Data Kandidat & Data Siswa: CRUD (kandidat: nomor, nama, kelas, foto upload, visi, misi, program). Jadwal Voting: set start/end + status. Hasil Voting: rekap + export CSV.

## 4. Data model (Prisma)

```
users(id, nis unique, name, class, password_hash, role, has_voted, created_at)
candidates(id, candidate_number unique, name, class, photo_url, vision, mission, programs, created_at)
votes(id, user_id unique -> users, candidate_id -> candidates, voted_at, ip_address, user_agent)
election_settings(id, election_name, start_date, end_date, status)
audit_logs(id, user_id, action, metadata, timestamp)
```

`votes.user_id` **UNIQUE** = penjamin satu suara per siswa di level database. `mission`/`programs` boleh `String[]`/JSON.

Seed: 4 kandidat dummy (Andi Pratama XII IPA 1, Siti Nurhaliza XII IPS 2, Rizky Ramadhan XII IPA 3, Nadya Putri XII IPS 1) dengan visi/misi/program dari README, 1 admin, dan ±40 siswa contoh. Semua data mudah diganti lewat seeder/CRUD admin.

## 5. API

```
POST /api/auth/login          { nis, password } -> set cookie, return { user }
POST /api/auth/logout
GET  /api/auth/me             -> { user, hasVoted }
GET  /api/candidates          -> daftar kandidat (public setelah login)
GET  /api/candidates/:id
POST /api/votes               { candidateId } -> 201 | 409 (sudah memilih) | 403 (di luar jadwal)
GET  /api/election/settings
GET  /api/admin/stats         (admin) -> totals, turnout, per-candidate, per-hour
GET  /api/admin/audit-logs    (admin)
CRUD /api/admin/candidates, /api/admin/students, /api/admin/election
```

`POST /api/votes` wajib: cek sesi → cek jadwal aktif di server → **database transaction** (insert vote + set `has_voted` + insert audit log) → tangani unique-violation sebagai `409` dengan pesan ramah siswa. Rate limit ketat di endpoint login dan voting.

## 6. Keamanan (non-negotiable)

- Password di-hash (argon2id atau bcrypt cost ≥ 12).
- **Jangan percaya status voting dari frontend** — `has_voted` selalu divalidasi server-side; frontend hanya menampilkan.
- RBAC middleware; semua endpoint `/api/admin/*` hanya role admin.
- Validasi & sanitasi input dengan Zod di setiap endpoint.
- Cookie `httpOnly`, `secure`, `sameSite=strict`; CSRF token jika pakai cookie session.
- Idempoten/anti double-submit: unique constraint + tombol disabled saat submitting.
- Audit log untuk login, vote, penolakan vote, perubahan jadwal/kandidat.
- Suara tetap rahasia dari siswa lain; admin hanya melihat agregat (jangan tampilkan "siapa memilih siapa" di UI).

## 7. Responsive & aksesibilitas

- Desktop (≥1280px): navbar penuh, dua kolom, kandidat 4 kolom. Tablet (768–1279px): kandidat 2 kolom, sidebar turun ke bawah konten. Mobile (<768px): hamburger menu, kandidat 1 kolom, tombol full width, sidebar jadi stacked cards. Pakai breakpoint Tailwind (`sm/md/lg/xl`).
- Kontras teks minimal 4.5:1; jangan pakai warna sebagai satu-satunya penanda status (selalu ada label teks/ikon).
- Semua tombol punya label jelas, `alt` untuk foto kandidat, label untuk setiap field, focus ring terlihat, modal bisa ditutup dengan Esc dan mengembalikan fokus.
- Loading state + skeleton untuk daftar kandidat; toast untuk feedback (sukses/gagal); pesan error berbahasa Indonesia yang mudah dipahami siswa.

## 8. Fase pengerjaan

- **Fase 1** — Inspect folder, tentukan stack, buat rencana singkat, scaffold monorepo + Tailwind theme (warna, font, radius) dari design tokens.
- **Fase 2** — Layout utama siswa: navbar, hero, candidate cards, sidebar voting, footer (data dummy dari service layer).
- **Fase 3** — Login flow, modal detail, modal konfirmasi, halaman sukses, toast, loading/error state.
- **Fase 4** — Backend: Prisma schema + migrasi + seed, auth, voting API dengan transaction & one-vote validation, audit log; sambungkan frontend.
- **Fase 5** — Admin dashboard: stats, monitoring chart, CRUD kandidat/siswa, jadwal, hasil + export CSV, audit log.
- **Fase 6** — Testing (unit + API, termasuk kasus double-vote dan di luar jadwal), responsive check, security review, polish UI, optimasi performa.

## 9. Definition of done

- `docker compose up` + `npm run dev` menjalankan app; seed menghasilkan akun siswa & admin yang bisa dipakai login.
- Siswa hanya bisa memilih sekali; percobaan kedua ditolak server dengan pesan jelas dan tercatat di audit log.
- Tampilan sesuai README (warna, tipografi, spacing, hierarki) di desktop, tablet, mobile.
- Tidak ada credential/secret hardcoded; `.env.example` tersedia.
- README project menjelaskan setup, struktur folder, dan cara mengganti data kandidat/logo/foto.
