import { randomInt } from 'node:crypto';
import { HttpError } from '../lib/http-error.js';
import { isUniqueViolation, prisma } from '../lib/prisma.js';
import { wibYear } from '../lib/time.js';
import type { SessionUser } from '../middleware/auth.js';
import { AUDIT, recordAudit } from './audit.js';
import { computeElectionPhase, getElectionSettings, PHASE_REJECTION_MESSAGE } from './election.js';

const RECEIPT_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateReceiptCode(now: Date = new Date()): string {
  let suffix = '';
  for (let i = 0; i < 8; i++) suffix += RECEIPT_ALPHABET[randomInt(RECEIPT_ALPHABET.length)];
  return `VT-${wibYear(now)}-${suffix}`;
}

export const ALREADY_VOTED_MESSAGE =
  'Anda sudah memberikan suara. Setiap siswa hanya dapat memilih satu kali.';

class AlreadyVotedError extends Error {}

interface CastVoteInput {
  user: SessionUser;
  candidateId: number;
  ipAddress?: string;
  userAgent?: string;
}

async function reject(user: SessionUser, reason: string, extra: Record<string, unknown> = {}) {
  await recordAudit({
    action: AUDIT.VOTE_REJECTED,
    status: 'rejected',
    userId: user.id,
    actor: user.nis,
    metadata: { reason, ...extra },
  });
}

/**
 * Urutan: jadwal aktif (server) → transaksi [klaim has_voted secara atomik, insert vote,
 * audit log]. `votes.user_id` UNIQUE menjadi pengaman terakhir terhadap race condition.
 */
export async function castVote({ user, candidateId, ipAddress, userAgent }: CastVoteInput) {
  const settings = await getElectionSettings();
  const phase = computeElectionPhase(settings);
  if (phase !== 'active') {
    await reject(user, 'outside_schedule', { phase });
    throw new HttpError(403, PHASE_REJECTION_MESSAGE[phase], 'VOTING_NOT_OPEN');
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const candidate = await tx.candidate.findUnique({ where: { id: candidateId }, select: { id: true } });
      if (!candidate) {
        throw new HttpError(404, 'Kandidat tidak ditemukan. Muat ulang halaman lalu pilih kembali.', 'CANDIDATE_NOT_FOUND');
      }

      // UPDATE ... WHERE has_voted = false mengunci baris; transaksi paralel akan mendapat count = 0.
      const claimed = await tx.user.updateMany({
        where: { id: user.id, role: 'student', hasVoted: false },
        data: { hasVoted: true },
      });
      if (claimed.count !== 1) throw new AlreadyVotedError();

      const vote = await tx.vote.create({
        data: {
          userId: user.id,
          candidateId,
          receiptCode: generateReceiptCode(),
          ipAddress: ipAddress?.slice(0, 64),
          userAgent: userAgent?.slice(0, 255),
        },
        select: { receiptCode: true, votedAt: true },
      });

      // Metadata sengaja TIDAK memuat kandidat pilihan (kerahasiaan suara).
      await recordAudit(
        {
          action: AUDIT.VOTE_CAST,
          status: 'success',
          userId: user.id,
          actor: user.nis,
          metadata: { receiptCode: vote.receiptCode },
        },
        tx,
      );
      return vote;
    });
  } catch (err) {
    if (err instanceof HttpError && err.code === 'CANDIDATE_NOT_FOUND') {
      await reject(user, 'invalid_candidate', { candidateId });
      throw err;
    }
    if (err instanceof AlreadyVotedError || isUniqueViolation(err)) {
      const existing = await prisma.vote.findUnique({ where: { userId: user.id }, select: { id: true } });
      if (existing || err instanceof AlreadyVotedError) {
        await reject(user, 'already_voted');
        throw new HttpError(409, ALREADY_VOTED_MESSAGE, 'ALREADY_VOTED');
      }
      // Tabrakan kode tanda terima (sangat jarang) — aman untuk dicoba lagi.
      throw new HttpError(409, 'Suara belum tersimpan karena gangguan sesaat. Silakan coba lagi.', 'VOTE_RETRY');
    }
    throw err;
  }
}
