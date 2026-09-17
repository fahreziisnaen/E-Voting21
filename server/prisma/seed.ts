/**
 * Seeder data contoh. Satu-satunya sumber data kandidat & siswa awal —
 * setelah itu semua data dikelola lewat panel panitia.
 *
 *   npm run db:seed          (idempoten: aman dijalankan ulang)
 *   npm run db:reset         (hapus semua data, migrasi ulang, lalu seed)
 */
import 'dotenv/config';
import { detectGradeLevel } from '../src/lib/grade.js';
import { hashPassword } from '../src/lib/password.js';
import { prisma } from '../src/lib/prisma.js';
import { wibDateKey } from '../src/lib/time.js';
import { generateReceiptCode } from '../src/services/votes.js';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} wajib diisi di server/.env sebelum menjalankan seed.`);
  return value;
}

const CANDIDATES = [
  {
    candidateNumber: 1,
    nis: '0021440',
    name: 'Andi Pratama',
    className: 'XII IPA 1',
    vision: 'Mewujudkan OSIS yang aktif, kreatif, dan berintegritas untuk SMAN 21 yang lebih baik.',
    mission: [
      'Membuka kanal aspirasi siswa yang mudah diakses setiap kelas.',
      'Menghidupkan kembali ekstrakurikuler yang kurang aktif.',
      'Transparansi anggaran kegiatan OSIS setiap semester.',
    ],
    programs: ['Pekan Kreativitas Siswa', 'OSIS Menyapa Kelas', 'Laporan Anggaran Terbuka'],
    organizationHistory: [
      'Ketua MPK 2024/2025',
      'Anggota Ekstrakurikuler Jurnalistik',
      'Koordinator Panitia Class Meeting 2024',
    ],
  },
  {
    candidateNumber: 2,
    nis: '0021441',
    name: 'Siti Nurhaliza',
    className: 'XII IPS 2',
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
    name: 'Rizky Ramadhan',
    className: 'XII IPA 3',
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
    name: 'Nadya Putri',
    className: 'XII IPS 1',
    vision: 'Kolaborasi, inovasi, dan aksi nyata untuk SMAN 21 yang lebih baik.',
    mission: [
      'Kolaborasi lintas ekstrakurikuler dalam satu kalender kegiatan.',
      'Kampanye sekolah bersih dan bebas sampah plastik.',
      'Pengembangan media sosial OSIS sebagai kanal informasi resmi.',
    ],
    programs: ['Kalender Kegiatan Terpadu', 'SMAN 21 Bersih', 'Media Center OSIS'],
    organizationHistory: [
      'Koordinator Bidang Publikasi OSIS 2024/2025',
      'Ketua Panitia Pentas Seni 2024',
      'Anggota English Club',
    ],
  },
];

// [NIS, nama, kelas] — siswa pertama dipakai sebagai akun demo di README.
// Kandidat di atas juga siswa (NIS 0021440–0021443) dan dibuat terpisah.
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
];

/** Akun yang dibiarkan belum memilih agar alur voting bisa dicoba. */
const KEEP_UNVOTED = new Set(['0021453', '0021401', '0021402', '0021403', '0021404']);

async function main() {
  const adminUsername = requireEnv('SEED_ADMIN_USERNAME');
  const adminPassword = requireEnv('SEED_ADMIN_PASSWORD');
  const studentPassword = requireEnv('SEED_STUDENT_PASSWORD');
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
  const startDate = new Date(`${dayOffset(-1)}T00:00:00+07:00`);
  const endDate = new Date(`${dayOffset(2)}T23:59:00+07:00`);
  const year = Number(today.slice(0, 4));

  const existingElection = await prisma.electionSettings.findUnique({ where: { id: 1 } });
  if (!existingElection) {
    await prisma.electionSettings.create({
      data: { id: 1, electionName: `Pemilihan Ketua OSIS ${year}`, startDate, endDate, status: 'open' },
    });
  }

  await prisma.user.upsert({
    where: { nis: adminUsername },
    create: { nis: adminUsername, name: 'Panitia OSIS', role: 'admin', passwordHash: await hashPassword(adminPassword) },
    // Tidak menimpa kata sandi yang sudah diganti panitia lewat Pengaturan Sistem.
    update: {},
  });

  // Kelas dari seluruh siswa contoh (termasuk kandidat).
  const allStudents: Array<[string, string, string]> = [
    ...STUDENTS,
    ...CANDIDATES.map((c): [string, string, string] => [c.nis, c.name, c.className]),
  ];
  const classNames = [...new Set(allStudents.map(([, , className]) => className))];
  await prisma.schoolClass.createMany({
    data: classNames.map((name) => ({ name, gradeLevel: detectGradeLevel(name) })),
    skipDuplicates: true,
  });
  const classIds = new Map(
    (await prisma.schoolClass.findMany({ select: { id: true, name: true } })).map((c) => [c.name, c.id]),
  );

  for (const [nis, name, className] of allStudents) {
    if (await prisma.user.findUnique({ where: { nis }, select: { id: true } })) continue;
    await prisma.user.create({
      data: {
        nis,
        name,
        classId: classIds.get(className)!,
        role: 'student',
        passwordHash: await hashPassword(studentPassword),
      },
    });
  }

  // Kandidat dipilih dari siswa yang sudah terdaftar.
  for (const { nis, name: _name, className: _className, ...profile } of CANDIDATES) {
    if (await prisma.candidate.findUnique({ where: { candidateNumber: profile.candidateNumber } })) continue;
    const student = await prisma.user.findUniqueOrThrow({ where: { nis }, select: { id: true, candidacy: true } });
    if (student.candidacy) continue;
    await prisma.candidate.create({ data: { ...profile, userId: student.id } });
  }

  let demoVotes = 0;
  if (withDemoVotes && (await prisma.vote.count()) === 0) {
    const candidates = await prisma.candidate.findMany({ orderBy: { candidateNumber: 'asc' } });
    const students = await prisma.user.findMany({ where: { role: 'student', nis: { notIn: [...KEEP_UNVOTED] } } });
    const weights = [0.34, 0.3, 0.22, 0.14];
    const voters = students.filter((_, index) => index % 3 !== 2); // ± dua pertiga siswa

    const now = Date.now();
    for (const [index, student] of voters.entries()) {
      // Sebar waktu memilih di antara jam 07:00 WIB hari ini sampai sekarang.
      const opening = new Date(`${today}T07:00:00+07:00`).getTime();
      const windowStart = Math.min(opening, now - 60 * 60 * 1000);
      const votedAt = new Date(windowStart + ((index + 1) / (voters.length + 1)) * (now - windowStart));

      let roll = (index * 7919) % 100 / 100;
      let candidate = candidates[candidates.length - 1]!;
      for (const [i, weight] of weights.entries()) {
        if (roll < weight && candidates[i]) {
          candidate = candidates[i];
          break;
        }
        roll -= weight;
      }

      await prisma.$transaction([
        prisma.vote.create({
          data: {
            userId: student.id,
            candidateId: candidate.id,
            receiptCode: generateReceiptCode(votedAt),
            votedAt,
            ipAddress: '127.0.0.1',
            userAgent: 'seed',
          },
        }),
        prisma.user.update({ where: { id: student.id }, data: { hasVoted: true } }),
        prisma.auditLog.create({
          data: { action: 'vote.cast', status: 'success', userId: student.id, actor: student.nis, timestamp: votedAt },
        }),
      ]);
      demoVotes++;
    }
  }

  console.log('Seed selesai:');
  console.log(
    `  • ${classNames.length} kelas, ${allStudents.length} siswa (${CANDIDATES.length} di antaranya kandidat), 1 akun panitia (${adminUsername})`,
  );
  console.log(`  • ${demoVotes} suara contoh dibuat${withDemoVotes ? '' : ' (SEED_DEMO_VOTES=false)'}`);
  console.log(`  • Akun demo siswa: NIS ${STUDENTS[0]![0]} dengan kode akses dari SEED_STUDENT_PASSWORD`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
