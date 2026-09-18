import type { ElectionSettings, ElectionStatus, VoterScope } from '../generated/prisma/client.js';
import { HttpError } from '../lib/http-error.js';
import { prisma, type DbClient } from '../lib/prisma.js';
import { wibMinutesOfDay } from '../lib/time.js';

export type ElectionPhase = 'draft' | 'upcoming' | 'active' | 'outside_hours' | 'ended' | 'closed';

type Schedule = Pick<ElectionSettings, 'status' | 'startDate' | 'endDate'>;

/**
 * Jadwal dibaca seperti yang ditampilkan ke siswa: rentang TANGGAL dari startDate s/d endDate,
 * dan setiap harinya dibuka dari JAM startDate s/d JAM endDate (WIB).
 * Jika jam mulai >= jam selesai (lintas tengah malam), rentang dianggap kontinu.
 */
export function computeElectionPhase(schedule: Schedule, now: Date = new Date()): ElectionPhase {
  if (schedule.status === 'draft') return 'draft';
  if (schedule.status === 'closed') return 'closed';
  if (now < schedule.startDate) return 'upcoming';
  if (now >= schedule.endDate) return 'ended';

  const opens = wibMinutesOfDay(schedule.startDate);
  const closes = wibMinutesOfDay(schedule.endDate);
  const current = wibMinutesOfDay(now);
  if (opens < closes && (current < opens || current >= closes)) return 'outside_hours';
  return 'active';
}

export const PHASE_REJECTION_MESSAGE: Record<Exclude<ElectionPhase, 'active'>, string> = {
  draft: 'Pemungutan suara belum dibuka oleh panitia.',
  upcoming: 'Pemungutan suara belum dimulai. Silakan kembali sesuai jadwal.',
  outside_hours: 'Saat ini di luar jam pemungutan suara. Silakan kembali pada jam yang telah ditentukan.',
  ended: 'Masa pemungutan suara telah berakhir.',
  closed: 'Pemungutan suara telah ditutup oleh panitia.',
};

export async function getElectionSettings(db: DbClient = prisma): Promise<ElectionSettings> {
  const settings = await db.electionSettings.findUnique({ where: { id: 1 } });
  if (!settings) {
    throw new HttpError(503, 'Jadwal pemilihan belum diatur. Hubungi panitia.', 'ELECTION_NOT_CONFIGURED');
  }
  return settings;
}

/** Masa pemungutan suara belum selesai (termasuk di luar jam harian). */
export function isVotingInProgress(phase: ElectionPhase): boolean {
  return phase === 'active' || phase === 'outside_hours';
}

export async function electionInProgress(db: DbClient = prisma): Promise<boolean> {
  const settings = await db.electionSettings.findUnique({ where: { id: 1 } });
  return settings ? isVotingInProgress(computeElectionPhase(settings)) : false;
}

/** Jadwal pemungutan suara sudah selesai atau ditutup panitia. */
export function scheduleFinished(phase: ElectionPhase): boolean {
  return phase === 'ended' || phase === 'closed';
}

/**
 * Semua pemilih terdaftar sudah memberikan suara di seluruh kategori yang menjadi haknya.
 * Kategori tanpa kandidat diabaikan karena tidak mungkin dipilih.
 */
export async function everyoneHasVoted(db: DbClient = prisma): Promise<boolean> {
  const [students, teachers, categories, totalVotes] = await Promise.all([
    db.user.count({ where: { role: 'student' } }),
    db.user.count({ where: { role: 'teacher' } }),
    db.category.findMany({ select: { voterScope: true, _count: { select: { candidates: true } } } }),
    db.vote.count(),
  ]);
  const eligibleFor = (scope: VoterScope) => (scope === 'all' ? students + teachers : scope === 'student' ? students : teachers);
  const expected = categories
    .filter((category) => category._count.candidates > 0)
    .reduce((sum, category) => sum + eligibleFor(category.voterScope), 0);
  return expected > 0 && totalVotes >= expected;
}

// Dipanggil setiap kali halaman publik memuat jadwal; ditahan sebentar agar tidak menghitung ulang
// untuk setiap pengunjung. Status "semua sudah memilih" hanya berubah saat ada suara baru masuk.
const COMPLETION_TTL_MS = 5_000;
let completionCache: { value: boolean; at: number } | null = null;

export function resetCompletionCache() {
  completionCache = null;
}

async function everyoneHasVotedCached(db: DbClient): Promise<boolean> {
  const now = Date.now();
  if (completionCache && now - completionCache.at < COMPLETION_TTL_MS) return completionCache.value;
  const value = await everyoneHasVoted(db);
  completionCache = { value, at: now };
  return value;
}

export interface ResultsPublication {
  /** Hasil boleh terbuka: jadwal selesai/ditutup, atau semua pemilih sudah memilih. */
  unlocked: boolean;
  /** Panitia menahan pengumuman meski syarat sudah terpenuhi. */
  withheld: boolean;
  published: boolean;
  publishedAt: Date | null;
}

/**
 * Hasil terbuka **otomatis** begitu pemungutan suara selesai atau semua pemilih sudah memilih,
 * kecuali panitia menahannya. Waktu pengumuman dicatat sekali saat hasil pertama kali terbuka,
 * dan dihapus lagi bila hasil kembali tertutup (mis. jadwal dibuka ulang).
 */
export async function resolveResultsPublication(
  settings: ElectionSettings,
  db: DbClient = prisma,
  now: Date = new Date(),
): Promise<ResultsPublication> {
  const phase = computeElectionPhase(settings, now);
  const unlocked = scheduleFinished(phase) || (await everyoneHasVotedCached(db));
  const published = unlocked && !settings.resultsWithheld;

  if (published && !settings.resultsPublishedAt) {
    await db.electionSettings.update({ where: { id: 1 }, data: { resultsPublishedAt: now } });
    return { unlocked, withheld: false, published, publishedAt: now };
  }
  if (!published && settings.resultsPublishedAt) {
    await db.electionSettings.update({ where: { id: 1 }, data: { resultsPublishedAt: null } });
    return { unlocked, withheld: settings.resultsWithheld, published, publishedAt: null };
  }
  return { unlocked, withheld: settings.resultsWithheld, published, publishedAt: settings.resultsPublishedAt };
}

export function serializeElection(settings: ElectionSettings, publication: ResultsPublication, now: Date = new Date()) {
  const phase = computeElectionPhase(settings, now);
  return {
    electionName: settings.electionName,
    startDate: settings.startDate.toISOString(),
    endDate: settings.endDate.toISOString(),
    status: settings.status as ElectionStatus,
    phase,
    isVotingOpen: phase === 'active',
    heroPhotoUrl: settings.heroPhotoUrl,
    resultsPublished: publication.published,
    resultsPublishedAt: publication.publishedAt?.toISOString() ?? null,
    /** Syarat pengumuman sudah terpenuhi (selesai/ditutup atau semua sudah memilih). */
    resultsUnlocked: publication.unlocked,
    /** Panitia menahan pengumuman. */
    resultsWithheld: publication.withheld,
    serverTime: now.toISOString(),
  };
}

/** Jadwal + status publikasi hasil dalam satu bentuk siap kirim ke klien. */
export async function electionView(db: DbClient = prisma, now: Date = new Date()) {
  const settings = await getElectionSettings(db);
  const publication = await resolveResultsPublication(settings, db, now);
  return { settings, publication, election: serializeElection(settings, publication, now) };
}
