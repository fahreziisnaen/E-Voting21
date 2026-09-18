import { z } from 'zod';
import { HttpError } from '../lib/http-error.js';
import { prisma } from '../lib/prisma.js';
import { removeUpload } from '../lib/uploads.js';
import { resetCompletionCache } from './election.js';

/** Dinaikkan bila bentuk berkas cadangan berubah dan tidak lagi kompatibel. */
export const BACKUP_VERSION = 1;
export const BACKUP_APP = 'evoting-osis-sman21';

const jsonArray = z.array(z.string());
const isoDate = z.iso.datetime({ offset: true }).transform((value) => new Date(value));

/**
 * Bentuk berkas cadangan. Seluruh id ikut disimpan agar relasi (dan tanda terima suara)
 * tetap sama persis setelah dipulihkan.
 */
const backupSchema = z.object({
  app: z.literal(BACKUP_APP, { error: 'Berkas ini bukan cadangan E-Voting OSIS.' }),
  version: z.literal(BACKUP_VERSION, { error: 'Versi berkas cadangan tidak didukung aplikasi ini.' }),
  createdAt: isoDate,
  election: z
    .object({
      electionName: z.string(),
      startDate: isoDate,
      endDate: isoDate,
      status: z.enum(['draft', 'open', 'closed']),
      heroPhotoUrl: z.string().nullable(),
      resultsPublishedAt: isoDate.nullable(),
      resultsWithheld: z.boolean(),
    })
    .nullable(),
  classes: z.array(
    z.object({ id: z.number().int(), name: z.string(), gradeLevel: z.number().int().nullable(), createdAt: isoDate }),
  ),
  users: z.array(
    z.object({
      id: z.number().int(),
      nis: z.string(),
      name: z.string(),
      classId: z.number().int().nullable(),
      passwordHash: z.string(),
      role: z.enum(['student', 'teacher', 'admin']),
      tokenVersion: z.number().int(),
      createdAt: isoDate,
    }),
  ),
  categories: z.array(
    z.object({
      id: z.number().int(),
      name: z.string(),
      description: z.string().nullable(),
      voterScope: z.enum(['all', 'student', 'teacher']),
      sortOrder: z.number().int(),
      createdAt: isoDate,
    }),
  ),
  candidates: z.array(
    z.object({
      id: z.number().int(),
      categoryId: z.number().int(),
      candidateNumber: z.number().int(),
      userId: z.number().int(),
      photoUrl: z.string().nullable(),
      vision: z.string(),
      mission: jsonArray,
      programs: jsonArray,
      organizationHistory: jsonArray,
      createdAt: isoDate,
    }),
  ),
  votes: z.array(
    z.object({
      id: z.number().int(),
      userId: z.number().int(),
      categoryId: z.number().int(),
      candidateId: z.number().int(),
      receiptCode: z.string(),
      votedAt: isoDate,
      ipAddress: z.string().nullable(),
      userAgent: z.string().nullable(),
    }),
  ),
  auditLogs: z.array(
    z.object({
      id: z.number().int(),
      userId: z.number().int().nullable(),
      actor: z.string().nullable(),
      action: z.string(),
      status: z.enum(['success', 'rejected', 'failed']),
      metadata: z.unknown().nullable(),
      timestamp: isoDate,
    }),
  ),
});

export type BackupFile = z.infer<typeof backupSchema>;

const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []);

/** Seluruh isi database dalam satu objek JSON (foto tetap berupa berkas di folder uploads). */
export async function createBackup() {
  const [election, classes, users, categories, candidates, votes, auditLogs] = await Promise.all([
    prisma.electionSettings.findUnique({ where: { id: 1 } }),
    prisma.schoolClass.findMany({ orderBy: { id: 'asc' } }),
    prisma.user.findMany({ orderBy: { id: 'asc' } }),
    prisma.category.findMany({ orderBy: { id: 'asc' } }),
    prisma.candidate.findMany({ orderBy: { id: 'asc' } }),
    prisma.vote.findMany({ orderBy: { id: 'asc' } }),
    prisma.auditLog.findMany({ orderBy: { id: 'asc' } }),
  ]);

  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    election: election && {
      electionName: election.electionName,
      startDate: election.startDate.toISOString(),
      endDate: election.endDate.toISOString(),
      status: election.status,
      heroPhotoUrl: election.heroPhotoUrl,
      resultsPublishedAt: election.resultsPublishedAt?.toISOString() ?? null,
      resultsWithheld: election.resultsWithheld,
    },
    classes: classes.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
    users: users.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
    categories: categories.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
    candidates: candidates.map((item) => ({
      ...item,
      mission: strings(item.mission),
      programs: strings(item.programs),
      organizationHistory: strings(item.organizationHistory),
      createdAt: item.createdAt.toISOString(),
    })),
    votes: votes.map((item) => ({ ...item, votedAt: item.votedAt.toISOString() })),
    auditLogs: auditLogs.map((item) => ({ ...item, metadata: item.metadata ?? null, timestamp: item.timestamp.toISOString() })),
  };
}

export function parseBackup(input: unknown): BackupFile {
  const parsed = backupSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new HttpError(400, first?.message ?? 'Berkas cadangan tidak dapat dibaca.', 'BACKUP_INVALID');
  }
  const backup = parsed.data;
  const userIds = new Set(backup.users.map((user) => user.id));
  const classIds = new Set(backup.classes.map((item) => item.id));
  const categoryIds = new Set(backup.categories.map((item) => item.id));
  const candidateIds = new Set(backup.candidates.map((item) => item.id));

  const broken =
    backup.users.some((user) => user.classId !== null && !classIds.has(user.classId)) ||
    backup.candidates.some((c) => !categoryIds.has(c.categoryId) || !userIds.has(c.userId)) ||
    backup.votes.some((v) => !userIds.has(v.userId) || !categoryIds.has(v.categoryId) || !candidateIds.has(v.candidateId));
  if (broken) {
    throw new HttpError(400, 'Isi berkas cadangan tidak konsisten (ada relasi yang hilang).', 'BACKUP_INVALID');
  }
  if (!backup.users.some((user) => user.role === 'admin')) {
    throw new HttpError(400, 'Berkas cadangan tidak memuat akun panitia, sehingga tidak dapat dipulihkan.', 'BACKUP_NO_ADMIN');
  }
  return backup;
}

/** Ringkasan untuk ditampilkan sebelum panitia mengonfirmasi pemulihan. */
export function summarizeBackup(backup: BackupFile) {
  return {
    createdAt: backup.createdAt.toISOString(),
    electionName: backup.election?.electionName ?? null,
    classes: backup.classes.length,
    students: backup.users.filter((user) => user.role === 'student').length,
    teachers: backup.users.filter((user) => user.role === 'teacher').length,
    admins: backup.users.filter((user) => user.role === 'admin').length,
    categories: backup.categories.length,
    candidates: backup.candidates.length,
    votes: backup.votes.length,
    auditLogs: backup.auditLogs.length,
  };
}

/** Urutan hapus & isi ulang mengikuti relasi antar tabel. */
async function wipe(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) {
  await tx.auditLog.deleteMany();
  await tx.vote.deleteMany();
  await tx.candidate.deleteMany();
  await tx.category.deleteMany();
  await tx.user.deleteMany();
  await tx.schoolClass.deleteMany();
  await tx.electionSettings.deleteMany();
}

/** Mengganti SELURUH isi database dengan isi berkas cadangan. */
export async function restoreBackup(backup: BackupFile) {
  await prisma.$transaction(
    async (tx) => {
      await wipe(tx);
      if (backup.classes.length) await tx.schoolClass.createMany({ data: backup.classes });
      if (backup.users.length) await tx.user.createMany({ data: backup.users });
      if (backup.categories.length) await tx.category.createMany({ data: backup.categories });
      if (backup.candidates.length) await tx.candidate.createMany({ data: backup.candidates });
      if (backup.votes.length) await tx.vote.createMany({ data: backup.votes });
      if (backup.auditLogs.length) {
        await tx.auditLog.createMany({
          data: backup.auditLogs.map((log) => ({ ...log, metadata: (log.metadata ?? null) as never })),
        });
      }
      if (backup.election) await tx.electionSettings.create({ data: { id: 1, ...backup.election } });
    },
    { timeout: 120_000, maxWait: 20_000 },
  );
  resetCompletionCache();
  return summarizeBackup(backup);
}

/**
 * Mengosongkan seluruh data pemilihan dan menyisakan satu akun panitia (yang menjalankan reset)
 * beserta jadwal kosong berstatus draf. Foto kandidat & gedung ikut dihapus dari folder uploads.
 */
export async function factoryReset(adminId: number) {
  const admin = await prisma.user.findUniqueOrThrow({ where: { id: adminId } });
  const [photos, settings] = await Promise.all([
    prisma.candidate.findMany({ where: { photoUrl: { not: null } }, select: { photoUrl: true } }),
    prisma.electionSettings.findUnique({ where: { id: 1 } }),
  ]);

  const now = new Date();
  const start = new Date(now);
  start.setHours(7, 0, 0, 0);
  const end = new Date(start.getTime() + 8 * 60 * 60 * 1000);

  await prisma.$transaction(
    async (tx) => {
      await wipe(tx);
      await tx.user.create({
        data: {
          id: admin.id,
          nis: admin.nis,
          name: admin.name,
          passwordHash: admin.passwordHash,
          role: 'admin',
          // Sesi panitia lain dicabut; sesi yang sedang berjalan diterbitkan ulang oleh route.
          tokenVersion: admin.tokenVersion + 1,
        },
      });
      await tx.electionSettings.create({
        data: { id: 1, electionName: 'Pemilihan Baru', startDate: start, endDate: end, status: 'draft' },
      });
    },
    { timeout: 60_000, maxWait: 20_000 },
  );

  await Promise.all([...photos.map((c) => removeUpload(c.photoUrl)), removeUpload(settings?.heroPhotoUrl)]);
  resetCompletionCache();
  return prisma.user.findUniqueOrThrow({ where: { id: admin.id } });
}
