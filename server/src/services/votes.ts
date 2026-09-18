import { randomInt } from 'node:crypto';
import { HttpError } from '../lib/http-error.js';
import { isUniqueViolation, prisma } from '../lib/prisma.js';
import { wibYear } from '../lib/time.js';
import type { SessionUser } from '../middleware/auth.js';
import { AUDIT, recordAudit } from './audit.js';
import { canVoteInCategory, VOTER_SCOPE_LABEL } from './categories.js';
import { computeElectionPhase, getElectionSettings, PHASE_REJECTION_MESSAGE, resetCompletionCache } from './election.js';

const RECEIPT_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateReceiptCode(now: Date = new Date()): string {
  let suffix = '';
  for (let i = 0; i < 8; i++) suffix += RECEIPT_ALPHABET[randomInt(RECEIPT_ALPHABET.length)];
  return `VT-${wibYear(now)}-${suffix}`;
}

export function alreadyVotedMessage(categoryName: string): string {
  return `Anda sudah memberikan suara untuk kategori ${categoryName}. Setiap pemilih hanya dapat memilih satu kali per kategori.`;
}

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
 * Urutan: jadwal aktif (server) → kandidat & hak memilih di kategorinya → transaksi
 * [insert vote + audit log]. UNIQUE(user_id, category_id) menjamin satu suara per kategori,
 * termasuk saat ada request paralel.
 */
export async function castVote({ user, candidateId, ipAddress, userAgent }: CastVoteInput) {
  const settings = await getElectionSettings();
  const phase = computeElectionPhase(settings);
  if (phase !== 'active') {
    await reject(user, 'outside_schedule', { phase });
    throw new HttpError(403, PHASE_REJECTION_MESSAGE[phase], 'VOTING_NOT_OPEN');
  }

  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    select: { id: true, category: { select: { id: true, name: true, voterScope: true } } },
  });
  if (!candidate) {
    await reject(user, 'invalid_candidate', { candidateId });
    throw new HttpError(404, 'Kandidat tidak ditemukan. Muat ulang halaman lalu pilih kembali.', 'CANDIDATE_NOT_FOUND');
  }
  const { category } = candidate;
  const categoryMeta = { categoryId: category.id, category: category.name };

  if (!canVoteInCategory(user.role, category.voterScope)) {
    await reject(user, 'not_eligible', categoryMeta);
    throw new HttpError(
      403,
      `Kategori ${category.name} hanya dapat dipilih oleh ${VOTER_SCOPE_LABEL[category.voterScope]}.`,
      'NOT_ELIGIBLE',
    );
  }

  try {
    const vote = await prisma.$transaction(async (tx) => {
      const created = await tx.vote.create({
        data: {
          userId: user.id,
          categoryId: category.id,
          candidateId: candidate.id,
          receiptCode: generateReceiptCode(),
          ipAddress: ipAddress?.slice(0, 64),
          userAgent: userAgent?.slice(0, 255),
        },
        select: { receiptCode: true, votedAt: true, categoryId: true },
      });
      // Metadata sengaja TIDAK memuat kandidat pilihan (kerahasiaan suara).
      await recordAudit(
        {
          action: AUDIT.VOTE_CAST,
          status: 'success',
          userId: user.id,
          actor: user.nis,
          metadata: { receiptCode: created.receiptCode, ...categoryMeta },
        },
        tx,
      );
      return created;
    });
    // Suara baru bisa melengkapi partisipasi seluruh pemilih → hitung ulang status pengumuman hasil.
    resetCompletionCache();
    return { ...vote, categoryName: category.name };
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    const existing = await prisma.vote.findUnique({
      where: { userId_categoryId: { userId: user.id, categoryId: category.id } },
      select: { id: true },
    });
    if (existing) {
      await reject(user, 'already_voted', categoryMeta);
      throw new HttpError(409, alreadyVotedMessage(category.name), 'ALREADY_VOTED');
    }
    // Tabrakan kode tanda terima (sangat jarang) — aman untuk dicoba lagi.
    throw new HttpError(409, 'Suara belum tersimpan karena gangguan sesaat. Silakan coba lagi.', 'VOTE_RETRY');
  }
}
