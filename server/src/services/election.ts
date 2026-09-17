import type { ElectionSettings, ElectionStatus } from '../generated/prisma/client.js';
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

export function serializeElection(settings: ElectionSettings, now: Date = new Date()) {
  const phase = computeElectionPhase(settings, now);
  return {
    electionName: settings.electionName,
    startDate: settings.startDate.toISOString(),
    endDate: settings.endDate.toISOString(),
    status: settings.status as ElectionStatus,
    phase,
    isVotingOpen: phase === 'active',
    heroPhotoUrl: settings.heroPhotoUrl,
    serverTime: now.toISOString(),
  };
}
