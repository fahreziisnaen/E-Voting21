# Handoff: E-Voting Pemilihan Ketua OSIS — SMAN 21 Kota Surabaya

## Overview
Platform voting digital untuk pemilihan Ketua OSIS SMAN 21 Kota Surabaya. Tiga peran pengguna: siswa (memilih), panitia OSIS/admin (mengelola & memantau), dan admin sekolah. Alur inti: login siswa → melihat daftar kandidat dan informasi voting → membuka detail kandidat → konfirmasi pilihan → halaman sukses. Satu siswa = satu suara, divalidasi di backend.

**Mulai dari `PROMPT.md`** — itu prompt siap tempel untuk Claude Code. Dokumen ini adalah spesifikasi desain presisinya.

## About the Design Files
File di folder `design/` adalah **referensi desain yang dibuat dalam HTML** — prototipe yang menunjukkan tampilan dan perilaku yang diinginkan, **bukan kode produksi untuk dicopy langsung**. Tugas developer adalah **membuat ulang desain ini di codebase target** (React/TypeScript/Vite/Tailwind sesuai `PROMPT.md`, atau stack yang sudah ada di project) menggunakan pola dan library yang berlaku di codebase tersebut.

`E-Voting OSIS SMAN 21.dc.html` berisi seluruh layar dalam satu file dengan switcher "Demo" di kiri bawah (Login / Dashboard / Sukses / Admin / Reset suara). Buka langsung di browser (butuh `support.js` dan folder `assets/` di sebelahnya).

## Fidelity
**High-fidelity.** Warna, tipografi, spacing, radius, dan interaksi sudah final. Recreate presisi; gunakan nilai di bagian Design Tokens.

## Design Tokens

**Warna**
| Peran | Hex |
|---|---|
| Navy primary | `#0F1F38` |
| Navy hover / surface gelap | `#152A4A`, `#1C3457`, `#172C4A` |
| Blue | `#0B5CAB` (hover `#1769AA`) |
| Gold | `#F4C20D` (teks di atas gold: `#16233B`) |
| Red identitas | `#E31E24` |
| Background app | `#F5F8FC` · Surface: `#FFFFFF` |
| Border | `#E4ECF6` (card), `#D8E2EF` (input/outline button), `#EEF3F9` (divider) |
| Teks | `#16233B` / `#64748B` / `#94A3B8` · di atas navy: `#FFFFFF`, `#C7D6EA`, `#8FA6C6` |
| Success | `#16A34A`, teks `#15803D`, bg `#ECFDF3`, border `#A7F3C4` |
| Warning | `#F59E0B`, teks `#B45309` |
| Danger | `#DC2626`, teks `#991B1B`, bg `#FEF2F2`, border `#FCD5D5` |

**Tipografi** — Plus Jakarta Sans (400/500/600/700/800).
- H1 login 46px/1.05 w800 `-0.02em` · H1 sukses & admin 26–28px w800
- Hero: eyebrow 22px w700 `0.14em` uppercase · "SMAN 21" 62px/0.98 w800 gold · "KOTA SURABAYA" 34px w800 `0.02em` · tagline 19px w600 italic
- Section title 24px w800 · card title 15–17px w800 · nama kandidat 17px w800
- Body 14–15px/1.55–1.6 · meta 13px · label uppercase 11px w800 `0.1em` · mono (ID suara, timestamp) `ui-monospace`

**Spacing / bentuk**
- Container `max-width: 1380px`, padding 28px · grid utama `minmax(0,1fr) 340px`, gap 24px
- Grid kandidat `repeat(auto-fit, minmax(210px,1fr))`, gap 18px · sidebar gap 16px
- Radius: card 14px, card besar/modal 16–18px, input & button 9–10px, badge/chip 999px
- Tinggi: navbar 76px, input 48px, primary button 50px (dashboard 40–46px), badge nomor 40px (modal 46px)
- Shadow: hover card `0 14px 30px rgba(15,31,56,.12)`; toast `0 14px 34px rgba(15,31,56,.3)`; badge nomor `0 4px 12px` warna aksen 35%

**Aksen dekoratif** — blok diagonal `transform: rotate(38deg)`: merah (200×200, opacity .9) dan gold (240×46) di kiri-atas hero & panel login, mirror di kanan-bawah footer.

## Screens / Views

### 1. Login (`/login`)
Split `1.05fr 1fr`, min-height 100vh.
- **Kiri (navy `#0F1F38`, padding 56px)**: logo 58px + "SMAN 21" / "KOTA SURABAYA"; pill outline gold "PEMILIHAN KETUA OSIS 2025"; H1 "E-Voting OSIS"; paragraf "Pemilihan Ketua OSIS SMAN 21 Kota Surabaya. Satu siswa, satu suara, tercatat aman."; garis gold 72×3px; kutipan italic "“Suaramu Menentukan Masa Depan Sekolah”"; footer motto "Berkarakter / Berprestasi / Berwawasan Global" 12px uppercase `#8FA6C6`. Lingkaran outline gold 380px di kanan-bawah (opacity rendah).
- **Kanan (putih, form max-width 396px, animasi fadeUp .5s)**: H2 "Masuk sebagai siswa", sub "Gunakan NIS dan kode akses yang dibagikan panitia OSIS."; field **NIS / Username** dan **Kode Akses** (label 13px w700, input 48px border `#D8E2EF`, focus `#0B5CAB` + ring `rgba(11,92,171,.14)`); button navy 50px "Masuk" (hover `#152A4A` + `translateY(-1px)`); info box `#F5F8FC` dengan ikon "i" biru: "Setiap siswa hanya dapat memberikan **satu suara**. Pilihan yang sudah dikonfirmasi tidak dapat diubah."; baris bawah "Butuh bantuan? Hubungi panitia." + link "Masuk sebagai panitia".

### 2. Dashboard siswa (`/`)
- **Navbar** (putih, sticky, border-bottom `#E4ECF6`, tinggi 76px): logo 48px + nama sekolah; nav "Beranda" (aktif: w700 navy + border-bottom 3px gold), "Kandidat", "Tata Cara Voting" (`#64748B`, hover navy); kanan chip profil pill (avatar inisial 34px navy, "Ahmad Setiawan", "XII IPA 2 · NIS 0021453", tombol "Keluar" hover merah).
- **Hero** (navy, padding 44px 28px, flex gap 36px): logo 172px dengan drop-shadow → garis gold 3px vertikal → blok teks (eyebrow / SMAN 21 gold / KOTA SURABAYA / tagline dengan border-bottom gold 3px). Sisi kanan (dari 52% lebar) = **slot foto gedung sekolah**: saat ini placeholder bergaris diagonal + label mono "foto gedung sekolah", ditumpuk overlay `linear-gradient(90deg, #0F1F38, rgba(15,31,56,.25))` agar teks tetap kontras saat foto asli dipasang.
- **Kolom kiri**: card putih "Daftar Kandidat Ketua OSIS" + subtitle, grid 4 card kandidat.
  - Card: border `#E4ECF6`, radius 14, hover `translateY(-3px)` + shadow. Foto aspect 4:5 (placeholder bergaris, label mono "foto kandidat"), badge nomor 40px lingkaran di `top/left: 12px`. Isi: nama (center 17px w800), kelas (13px `#64748B` center), divider, label "VISI" berwarna aksen kandidat, kutipan visi 13px/1.5 `#475569`, lalu tombol "Lihat Detail" (outline 40px, hover border+teks `#0B5CAB`) dan "Pilih Kandidat" (solid aksen 42px, hover `brightness(.93)`).
  - Aksen per kandidat: 1 `#E31E24`, 2 `#F4C20D` (angka & label teks `#16233B` / `#B08600`), 3 `#0B5CAB`, 4 `#0F1F38`.
- **Sidebar 340px**: (a) *Jadwal Pemungutan Suara* — ikon kotak 34px `#EAF2FB`, dua baris label/nilai: Tanggal "12 – 14 September 2025", Waktu "07:00 – 15:00 WIB"; (b) *Status Voting* — badge pill "Aktif" hijau, teks status 15px w700 (belum: `#B45309` "Anda belum memberikan suara" + hint; sudah: `#15803D` "Anda sudah memberikan suara" + "Terima kasih telah berpartisipasi. Pilihan tidak dapat diubah."); (c) *Tata Cara Voting* — 5 langkah bernomor lingkaran 22px navy (langkah 5 hijau): Login menggunakan akun siswa / Pilih salah satu kandidat / Periksa kembali pilihan Anda / Konfirmasi suara / Selesai; (d) *Notice* merah — "Setiap siswa hanya dapat memilih satu kali. Pastikan pilihan Anda sudah benar sebelum konfirmasi."
- **Footer** navy: logo 42px + nama, motto di tengah, "© 2025 SMAN 21 Kota Surabaya" di kanan, aksen diagonal merah+gold di kanan-bawah.

### 3. Modal detail kandidat
Backdrop `rgba(15,31,56,.55)` + blur 2px (fade .2s). Panel max-width 860px, radius 18, `max-height: 90vh` scroll, animasi pop .28s. Grid `300px minmax(0,1fr)`: kiri foto + badge nomor 46px; kanan padding 28–30px: nama 25px w800, "Kandidat No. X · Kelas", lalu blok **Visi** (paragraf 15px), **Misi** (ul 3 item), **Program Kerja Unggulan** (chip pill `#F5F8FC` border `#E4ECF6`), **Riwayat Organisasi** (ul 3 item); tombol ✕ 34px di kanan-atas; footer aksi: "Tutup" (outline) + "Pilih Kandidat Ini" (navy, flex-1).

### 4. Modal konfirmasi
Max-width 440px, center, padding 30px. H2 "Konfirmasi Pilihan Anda", "Anda memilih:", kartu kandidat (badge 44px + nama 17px w800 + kelas), box merah "Pilihan yang sudah dikonfirmasi tidak dapat diubah.", tombol "Kembali" (outline, flex 1) + "Konfirmasi Suara" (navy, flex 1.3; label berubah "Menyimpan…" saat submit).

### 5. Voting sukses (`/voting/berhasil`)
Card 520px center, radius 18, padding 44/36. Ring hijau 92px (`#ECFDF3` + border `#A7F3C4`, animasi ring .4s) berisi bulatan `#16A34A` 58px dengan ✓ 30px. H1 "Suara Anda Berhasil Direkam!", subtitle "Terima kasih telah berpartisipasi dalam Pemilihan Ketua OSIS SMAN 21 Kota Surabaya.", box detail (Waktu voting, ID suara mono, Status "Tercatat & terverifikasi" hijau), catatan 13px "Pilihan Anda bersifat rahasia. Hasil pemilihan diumumkan panitia setelah masa pemungutan suara ditutup.", tombol "Kembali ke Beranda" (navy) + "Logout" (outline). **Tidak ada hasil sementara kandidat.**

### 6. Admin / panel panitia (`/admin`)
Grid `252px minmax(0,1fr)`. Sidebar navy: header "Panel Panitia / SMAN 21", 8 item nav (aktif `#1C3457`), tombol "Keluar" di bawah (hover border+teks gold). Konten padding 28/32:
- Header "Dashboard Overview" + "Pemilihan Ketua OSIS 2025 · 12 – 14 September 2025" + badge hijau "PEMUNGUTAN SUARA BERLANGSUNG".
- 4 stat card (`repeat(auto-fit, minmax(210px,1fr))`): Total Siswa Terdaftar 1.248 · Sudah Voting 912 (border-top hijau) · Belum Voting 336 (border-top `#F59E0B`) · Partisipasi 73,1% (border-top biru + progress bar 8px).
- Grid `1.35fr 1fr`: *Perolehan Suara per Kandidat* — bar horizontal 12px warna aksen kandidat (Andi 312/34,2%, Siti 271/29,7%, Rizky 198/21,7%, Nadya 131/14,4%) + catatan "Angka bersifat internal panitia dan belum dipublikasikan ke siswa."; *Partisipasi per Jam* — bar vertikal 07–14 (jam 12 diredam `#94A3B8`).
- *Audit Log Terbaru* — tabel 4 kolom `150px 1fr 130px 120px`: Waktu (mono) / Aksi / Aktor / Status (Sukses hijau, Ditolak `#B45309`). Contoh baris termasuk "Percobaan voting kedua ditolak".
- Tombol "Lihat tampilan siswa".

## Interactions & Behavior
- "Pilih Kandidat" **tidak** langsung submit → selalu modal konfirmasi. Jika siswa sudah memilih, tombol memunculkan toast: "Anda sudah memberikan suara. Setiap siswa hanya dapat memilih satu kali."
- "Konfirmasi Suara" → state submitting (label "Menyimpan…", tombol disabled) → sukses → redirect halaman sukses, status sidebar berubah "sudah memberikan suara".
- Modal tertutup oleh backdrop click, ✕, tombol Tutup/Kembali; tambahkan Esc + focus trap + kembalikan fokus ke pemicu (prototipe belum melakukannya).
- Toast: kanan-bawah, navy, auto-hide 3.2s.
- Animasi: `fadeUp` 0.5s (section), `pop` 0.26–0.35s (modal/card sukses), `ring` 0.4s, hover card 0.18s ease, hover button `filter`/`background` 0.15–0.18s.
- Loading: skeleton card kandidat saat fetch; error state dengan pesan Indonesia + tombol coba lagi.

## State Management
`session.user` (nis, name, class, role) · `hasVoted` (dari server, bukan localStorage) · `candidates[]` · `selectedCandidateId` · `detailOpen`, `confirmOpen` · `submitting` · `toast` · hasil vote (`votedAt`, `voteId`) · admin: `stats`, `perCandidate`, `perHour`, `auditLogs`. Server-state pakai TanStack Query; `hasVoted` di-invalidate setelah vote sukses.

## Assets
- `design/assets/logo-sman21.png` (584×740, transparan) — diekstrak dari gambar referensi; **gunakan proporsi asli, jangan diubah**. Ganti dengan file logo resmi sekolah jika tersedia.
- `design/assets/reference.png` — gambar referensi desain dari klien.
- Foto kandidat & foto gedung sekolah **belum ada** — semua masih placeholder bergaris dengan label mono. Sediakan slot upload di admin (rasio 4:5 untuk kandidat, landscape ≥1600px untuk hero).
- Ikon: gunakan `lucide-react` (calendar, clock, check-circle, info, alert-triangle, users, vote, log-out). Prototipe memakai glyph teks sederhana sebagai pengganti.

## Files
- `PROMPT.md` — prompt siap tempel untuk Claude Code (stack, API, schema, fase, definition of done).
- `design/E-Voting OSIS SMAN 21.dc.html` — prototipe semua layar (buka di browser).
- `design/support.js` — runtime prototipe; tidak perlu dibawa ke codebase produksi.
- `design/assets/` — logo + gambar referensi.
