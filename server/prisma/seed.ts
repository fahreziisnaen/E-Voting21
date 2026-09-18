/**
 * Seeder data contoh. Satu-satunya sumber data kategori, kandidat, siswa & guru awal —
 * setelah itu semua data dikelola lewat panel panitia.
 *
 *   npm run db:seed          (idempoten: aman dijalankan ulang)
 *   npm run db:reset         (hapus semua data, migrasi ulang, lalu seed)
 */
import 'dotenv/config';
import type { VoterScope } from '../src/generated/prisma/client.js';
import { detectGradeLevel } from '../src/lib/grade.js';
import { hashPassword } from '../src/lib/password.js';
import { prisma } from '../src/lib/prisma.js';
import { wibDateKey } from '../src/lib/time.js';
import { canVoteInCategory } from '../src/services/categories.js';
import { generateReceiptCode } from '../src/services/votes.js';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} wajib diisi di server/.env sebelum menjalankan seed.`);
  return value;
}

interface SeedCandidate {
  candidateNumber: number;
  /** NIS siswa atau username guru yang sudah ada di daftar STUDENTS/TEACHERS. */
  nis: string;
  vision: string;
  mission: string[];
  programs: string[];
  organizationHistory: string[];
}

interface SeedCategory {
  name: string;
  description: string;
  voterScope: VoterScope;
  sortOrder: number;
  candidates: SeedCandidate[];
}

// [NIS, nama, kelas] — siswa pertama dipakai sebagai akun demo di README.
const STUDENTS: Array<[string, string, string]> = [
  ['0021453', 'Ahmad Setiawan', 'XII IPA 2'],
  ['0021401', 'Aisyah Rahmawati', 'X-1'],
  ['0021402', 'Bagus Prasetyo', 'X-1'],
  ['0021403', 'Citra Dewi Lestari', 'X-1'],
  ['0021404', 'Dimas Saputra', 'X-2'],
  ['0021405', 'Eka Wulandari', 'X-2'],
  ['0021406', 'Fajar Nugroho', 'X-2'],
  ['0021407', 'Gita Permatasari', 'X-3'],
  ['0021408', 'Hendra Kurniawan', 'X-3'],
  ['0021409', 'Indah Puspitasari', 'X-3'],
  ['0021410', 'Joko Santoso', 'XI IPA 1'],
  ['0021411', 'Kartika Sari', 'XI IPA 1'],
  ['0021412', 'Lutfi Hakim', 'XI IPA 1'],
  ['0021413', 'Maya Anggraini', 'XI IPA 2'],
  ['0021414', 'Naufal Arya Pratama', 'XI IPA 2'],
  ['0021415', 'Oktaviani Putri', 'XI IPA 2'],
  ['0021416', 'Putra Wijaya', 'XI IPS 1'],
  ['0021417', 'Qonita Azzahra', 'XI IPS 1'],
  ['0021418', 'Rangga Firmansyah', 'XI IPS 1'],
  ['0021419', 'Salsabila Nur Aini', 'XI IPS 2'],
  ['0021420', 'Taufik Hidayat', 'XI IPS 2'],
  ['0021421', 'Umi Kalsum', 'XI IPS 2'],
  ['0021422', 'Vino Aditya', 'XII IPA 1'],
  ['0021423', 'Wulan Sari Dewi', 'XII IPA 1'],
  ['0021424', 'Yoga Pratama', 'XII IPA 1'],
  ['0021425', 'Zahra Amelia', 'XII IPA 2'],
  ['0021426', 'Arif Budiman', 'XII IPA 2'],
  ['0021427', 'Bella Safitri', 'XII IPA 3'],
  ['0021428', 'Cahyo Wibowo', 'XII IPA 3'],
  ['0021429', 'Dinda Maharani', 'XII IPA 3'],
  ['0021430', 'Erlangga Putra', 'XII IPS 1'],
  ['0021431', 'Fitri Handayani', 'XII IPS 1'],
  ['0021432', 'Galih Ramadhan', 'XII IPS 1'],
  ['0021433', 'Hana Pertiwi', 'XII IPS 2'],
  ['0021434', 'Ilham Maulana', 'XII IPS 2'],
  ['0021435', 'Jihan Khairunnisa', 'XII IPS 2'],
  ['0021436', 'Kevin Sanjaya', 'X-4'],
  ['0021437', 'Laras Ayu Ningtyas', 'X-4'],
  ['0021438', 'Muhammad Rizal', 'X-4'],
  ['0021439', 'Nabila Zahirah', 'X-4'],
  ['0021440', 'Andi Pratama', 'XII IPA 1'],
  ['0021441', 'Siti Nurhaliza', 'XII IPS 2'],
  ['0021442', 'Rizky Ramadhan', 'XII IPA 3'],
  ['0021443', 'Nadya Putri', 'XII IPS 1'],
  ['0021444', 'Bima Satria', 'XI IPA 1'],
  ['0021445', 'Clarissa Anindya', 'XI IPS 2'],
  ['0021446', 'Daffa Alfarizi', 'XI IPA 2'],
];

// [username, nama] — guru tidak memakai NIP karena nomor tersebut bersifat rahasia.
const TEACHERS: Array<[string, string]> = [
  ['guru.retno', 'Dra. Retno Wulandari'],
  ['guru.budi', 'Budi Santoso, S.Pd.'],
  ['guru.ratna', 'Ratna Kusuma, M.Pd.'],
  ['guru.hadi', 'Hadi Purnomo, S.Si.'],
  ['guru.dewi', 'Dewi Lestari, S.Pd.'],
  ['guru.agus', 'Agus Riyanto, S.Kom.'],
];

const CATEGORIES: SeedCategory[] = [
  {
    name: 'Ketua OSIS',
    description: 'Memimpin pengurus OSIS dan program kerja siswa selama satu periode.',
    voterScope: 'all',
    sortOrder: 1,
    candidates: [
      {
        candidateNumber: 1,
        nis: '0021440',
        vision: 'Mewujudkan OSIS yang aktif, kreatif, dan berintegritas untuk SMAN 21 yang lebih baik.',
        mission: [
          'Membuka kanal aspirasi siswa yang mudah diakses setiap kelas.',
          'Menghidupkan kembali ekstrakurikuler yang kurang aktif.',
          'Transparansi anggaran kegiatan OSIS setiap semester.',
        ],
        programs: ['Pekan Kreativitas Siswa', 'OSIS Menyapa Kelas', 'Laporan Anggaran Terbuka'],
        organizationHistory: ['Ketua MPK 2024/2025', 'Anggota Ekstrakurikuler Jurnalistik', 'Koordinator Panitia Class Meeting 2024'],
      },
      {
        candidateNumber: 2,
        nis: '0021441',
        vision: 'Bersama kita wujudkan OSIS yang peduli, inovatif, dan berprestasi.',
        mission: [
          'Program mentoring belajar antar angkatan.',
          'Kegiatan sosial rutin bersama warga sekitar sekolah.',
          'Digitalisasi administrasi dan proposal kegiatan OSIS.',
        ],
        programs: ['Kakak Asuh Belajar', 'Jumat Peduli', 'Arsip Digital OSIS'],
        organizationHistory: ['Sekretaris OSIS 2024/2025', 'Ketua Panitia Bakti Sosial 2024', 'Anggota PMR'],
      },
      {
        candidateNumber: 3,
        nis: '0021442',
        vision: 'OSIS yang solid, responsif, dan menjadi wadah aspirasi seluruh siswa.',
        mission: [
          'Rapat terbuka bulanan bersama perwakilan kelas.',
          'Respons aspirasi maksimal 7 hari kerja.',
          'Pembinaan kaderisasi pengurus OSIS baru.',
        ],
        programs: ['Forum Kelas Bulanan', 'Kotak Aspirasi Digital', 'Pelatihan Kepemimpinan'],
        organizationHistory: ['Ketua Ekstrakurikuler Basket', 'Wakil Ketua MPK 2023/2024', 'Anggota Rohis'],
      },
      {
        candidateNumber: 4,
        nis: '0021443',
        vision: 'Kolaborasi, inovasi, dan aksi nyata untuk SMAN 21 yang lebih baik.',
        mission: [
          'Kolaborasi lintas ekstrakurikuler dalam satu kalender kegiatan.',
          'Kampanye sekolah bersih dan bebas sampah plastik.',
          'Pengembangan media sosial OSIS sebagai kanal informasi resmi.',
        ],
        programs: ['Kalender Kegiatan Terpadu', 'SMAN 21 Bersih', 'Media Center OSIS'],
        organizationHistory: ['Koordinator Bidang Publikasi OSIS 2024/2025', 'Ketua Panitia Pentas Seni 2024', 'Anggota English Club'],
      },
    ],
  },
  {
    name: 'Ketua MPK',
    description: 'Memimpin Majelis Perwakilan Kelas yang mengawasi dan menyalurkan aspirasi kelas.',
    voterScope: 'all',
    sortOrder: 2,
    candidates: [
      {
        candidateNumber: 1,
        nis: '0021444',
        vision: 'MPK yang dekat dengan kelas dan tegas mengawal program OSIS.',
        mission: ['Rapat perwakilan kelas setiap bulan.', 'Evaluasi program OSIS secara terbuka.'],
        programs: ['Suara Kelas', 'Rapor Program OSIS'],
        organizationHistory: ['Perwakilan Kelas XI IPA 1', 'Anggota Pramuka'],
      },
      {
        candidateNumber: 2,
        nis: '0021445',
        vision: 'Menjadi jembatan aspirasi yang jujur antara siswa, OSIS, dan sekolah.',
        mission: ['Kanal aspirasi anonim untuk setiap kelas.', 'Laporan tindak lanjut aspirasi setiap bulan.'],
        programs: ['Kotak Aspirasi Kelas', 'MPK Mendengar'],
        organizationHistory: ['Sekretaris MPK 2024/2025', 'Anggota Paduan Suara'],
      },
      {
        candidateNumber: 3,
        nis: '0021446',
        vision: 'MPK yang aktif, transparan, dan melibatkan seluruh perwakilan kelas.',
        mission: ['Pelatihan perwakilan kelas.', 'Pengawasan anggaran kegiatan siswa.'],
        programs: ['Sekolah Perwakilan Kelas', 'Transparansi Anggaran'],
        organizationHistory: ['Bendahara Kelas XI IPA 2', 'Anggota KIR'],
      },
    ],
  },
  {
    name: 'Guru Favorit',
    description: 'Apresiasi siswa untuk guru yang paling menginspirasi tahun ini. Dipilih oleh siswa.',
    voterScope: 'student',
    sortOrder: 3,
    candidates: [
      {
        candidateNumber: 1,
        nis: 'guru.retno',
        vision: 'Belajar yang menyenangkan membuat siswa berani bertanya.',
        mission: ['Kelas diskusi terbuka setiap pekan.', 'Pendampingan olimpiade sains.'],
        programs: ['Klub Diskusi Sains'],
        organizationHistory: ['Pembina OSIS 2022–2024', 'Wali kelas XII IPA 1'],
      },
      {
        candidateNumber: 2,
        nis: 'guru.budi',
        vision: 'Setiap siswa punya potensi yang layak didengar.',
        mission: ['Program literasi pagi.', 'Pendampingan karya tulis siswa.'],
        programs: ['Pojok Literasi'],
        organizationHistory: ['Pembina Ekstrakurikuler Jurnalistik', 'Wali kelas XI IPS 2'],
      },
      {
        candidateNumber: 3,
        nis: 'guru.ratna',
        vision: 'Disiplin dan kepedulian tumbuh dari keteladanan.',
        mission: ['Bimbingan belajar sore gratis.', 'Kegiatan bakti sosial bersama siswa.'],
        programs: ['Bimbel Sore'],
        organizationHistory: ['Pembina PMR', 'Wali kelas X-2'],
      },
    ],
  },
];

/** Akun yang dibiarkan belum memilih agar alur voting bisa dicoba. */
const KEEP_UNVOTED = new Set(['0021453', '0021401', '0021402', '0021403', '0021404', 'guru.agus']);

async function main() {
  const adminUsername = requireEnv('SEED_ADMIN_USERNAME');
  const adminPassword = requireEnv('SEED_ADMIN_PASSWORD');
  const voterPassword = requireEnv('SEED_STUDENT_PASSWORD');
  const withDemoVotes = (process.env.SEED_DEMO_VOTES ?? 'true') === 'true';

  // Dipakai container Docker saat start: jangan mengembalikan data contoh yang sudah dihapus panitia.
  if (process.env.SEED_ONLY_IF_EMPTY === 'true' && (await prisma.user.count()) > 0) {
    console.log('Database sudah berisi data — seeder dilewati.');
    return;
  }

  // Jadwal contoh: kemarin s/d lusa, dibuka sepanjang hari agar demo langsung bisa dicoba.
  // Atur jadwal sebenarnya (mis. 07:00–15:00) di Panel Panitia → Jadwal Voting.
  const today = wibDateKey(new Date());
  const dayOffset = (days: number) => wibDateKey(new Date(Date.now() + days * 86_400_000));
  const year = Number(today.slice(0, 4));
  if (!(await prisma.electionSettings.findUnique({ where: { id: 1 } }))) {
    await prisma.electionSettings.create({
      data: {
        id: 1,
        electionName: `Pemilihan Raya ${year}`,
        startDate: new Date(`${dayOffset(-1)}T00:00:00+07:00`),
        endDate: new Date(`${dayOffset(2)}T23:59:00+07:00`),
        status: 'open',
      },
    });
  }

  await prisma.user.upsert({
    where: { nis: adminUsername },
    create: { nis: adminUsername, name: 'Panitia Pemilihan', role: 'admin', passwordHash: await hashPassword(adminPassword) },
    // Tidak menimpa kata sandi yang sudah diganti panitia lewat Pengaturan Sistem.
    update: {},
  });

  const classNames = [...new Set(STUDENTS.map(([, , className]) => className))];
  await prisma.schoolClass.createMany({
    data: classNames.map((name) => ({ name, gradeLevel: detectGradeLevel(name) })),
    skipDuplicates: true,
  });
  const classIds = new Map((await prisma.schoolClass.findMany({ select: { id: true, name: true } })).map((c) => [c.name, c.id]));

  const people: Array<{ nis: string; name: string; role: 'student' | 'teacher'; classId: number | null }> = [
    ...STUDENTS.map(([nis, name, className]) => ({ nis, name, role: 'student' as const, classId: classIds.get(className)! })),
    ...TEACHERS.map(([nis, name]) => ({ nis, name, role: 'teacher' as const, classId: null })),
  ];
  for (const person of people) {
    if (await prisma.user.findUnique({ where: { nis: person.nis }, select: { id: true } })) continue;
    await prisma.user.create({ data: { ...person, passwordHash: await hashPassword(voterPassword) } });
  }

  let candidateCount = 0;
  for (const { candidates, ...categoryData } of CATEGORIES) {
    const category = await prisma.category.upsert({ where: { name: categoryData.name }, create: categoryData, update: {} });
    for (const { nis, ...profile } of candidates) {
      const person = await prisma.user.findUnique({ where: { nis }, select: { id: true } });
      // Salah tulis identitas di daftar kandidat harus terlihat, bukan diam-diam dilewati.
      if (!person) throw new Error(`Kandidat "${nis}" di kategori ${category.name} tidak ada di daftar STUDENTS/TEACHERS.`);
      const taken = await prisma.candidate.findFirst({
        where: { categoryId: category.id, OR: [{ candidateNumber: profile.candidateNumber }, { userId: person.id }] },
      });
      if (taken) continue;
      await prisma.candidate.create({ data: { ...profile, categoryId: category.id, userId: person.id } });
      candidateCount++;
    }
  }

  let demoVotes = 0;
  if (withDemoVotes && (await prisma.vote.count()) === 0) {
    const categories = await prisma.category.findMany({
      include: { candidates: { orderBy: { candidateNumber: 'asc' }, select: { id: true } } },
      orderBy: { sortOrder: 'asc' },
    });
    const voters = await prisma.user.findMany({
      where: { role: { in: ['student', 'teacher'] }, nis: { notIn: [...KEEP_UNVOTED] } },
      orderBy: { id: 'asc' },
    });
    const now = Date.now();
    const opening = new Date(`${today}T07:00:00+07:00`).getTime();
    const windowStart = Math.min(opening, now - 60 * 60 * 1000);

    for (const [index, voter] of voters.entries()) {
      if (index % 3 === 2) continue; // ± dua pertiga pemilih sudah memilih
      for (const [categoryIndex, category] of categories.entries()) {
        if (!category.candidates.length || !canVoteInCategory(voter.role, category.voterScope)) continue;
        // Sebagian pemilih belum menyelesaikan semua kategori.
        if (categoryIndex > 0 && (index + categoryIndex) % 4 === 0) continue;
        const votedAt = new Date(windowStart + ((index + 1) / (voters.length + 1)) * (now - windowStart));
        const pick = category.candidates[(index * 7 + categoryIndex * 3) % category.candidates.length]!;
        await prisma.$transaction([
          prisma.vote.create({
            data: {
              userId: voter.id,
              categoryId: category.id,
              candidateId: pick.id,
              receiptCode: generateReceiptCode(votedAt),
              votedAt,
              ipAddress: '127.0.0.1',
              userAgent: 'seed',
            },
          }),
          prisma.auditLog.create({
            data: {
              action: 'vote.cast',
              status: 'success',
              userId: voter.id,
              actor: voter.nis,
              timestamp: votedAt,
              metadata: { categoryId: category.id, category: category.name },
            },
          }),
        ]);
        demoVotes++;
      }
    }
  }

  console.log('Seed selesai:');
  console.log(`  • ${CATEGORIES.length} kategori, ${candidateCount} kandidat baru, ${classNames.length} kelas`);
  console.log(`  • ${STUDENTS.length} siswa, ${TEACHERS.length} guru, 1 akun panitia (${adminUsername})`);
  console.log(`  • ${demoVotes} suara contoh dibuat${withDemoVotes ? '' : ' (SEED_DEMO_VOTES=false)'}`);
  console.log(`  • Akun demo: siswa NIS ${STUDENTS[0]![0]}, guru ${TEACHERS[5]![0]} — kode akses dari SEED_STUDENT_PASSWORD`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
