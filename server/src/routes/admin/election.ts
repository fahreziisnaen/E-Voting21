import { Router } from 'express';
import { z } from 'zod';
import { HttpError } from '../../lib/http-error.js';
import { prisma } from '../../lib/prisma.js';
import { photoUpload, removeUpload, saveImage } from '../../lib/uploads.js';
import { currentUser } from '../../middleware/auth.js';
import { AUDIT, recordAudit } from '../../services/audit.js';
import {
  computeElectionPhase,
  electionView,
  getElectionSettings,
  isVotingInProgress,
  resetCompletionCache,
} from '../../services/election.js';

export const adminElectionRouter = Router();

const isoDate = (label: string) =>
  z.iso.datetime({ offset: true, error: `${label} tidak valid.` }).transform((value) => new Date(value));

const electionSchema = z
  .object({
    electionName: z.string().trim().min(5, 'Nama pemilihan minimal 5 karakter.').max(160),
    startDate: isoDate('Waktu mulai'),
    endDate: isoDate('Waktu selesai'),
    status: z.enum(['draft', 'open', 'closed'], { error: 'Status tidak valid.' }),
  })
  .refine((data) => data.endDate > data.startDate, {
    message: 'Waktu selesai harus setelah waktu mulai.',
    path: ['endDate'],
  });

adminElectionRouter.get('/', async (_req, res) => {
  res.json({ election: (await electionView()).election });
});

adminElectionRouter.put('/', async (req, res) => {
  const admin = currentUser(req);
  const data = electionSchema.parse(req.body);
  const before = await prisma.electionSettings.findUnique({ where: { id: 1 } });
  // Jadwal dibuka kembali → pengumuman hasil ditarik dan status "ditahan" direset, sehingga hasil
  // kembali terbuka otomatis saat pemungutan suara selesai lagi.
  const reopened = isVotingInProgress(computeElectionPhase(data));
  const withdrawResults = reopened && (Boolean(before?.resultsPublishedAt) || Boolean(before?.resultsWithheld));
  const settings = await prisma.electionSettings.upsert({
    where: { id: 1 },
    create: { id: 1, ...data },
    update: { ...data, ...(reopened ? { resultsPublishedAt: null, resultsWithheld: false } : {}) },
  });
  await recordAudit({
    action: AUDIT.ELECTION_UPDATED,
    status: 'success',
    userId: admin.id,
    actor: admin.nis,
    metadata: {
      before: before && {
        status: before.status,
        startDate: before.startDate.toISOString(),
        endDate: before.endDate.toISOString(),
      },
      after: { status: settings.status, startDate: settings.startDate.toISOString(), endDate: settings.endDate.toISOString() },
      resultsWithdrawn: withdrawResults || undefined,
    },
  });
  res.json({ election: (await electionView()).election });
});

const publicationSchema = z.object({ published: z.boolean({ error: 'Nilai published wajib diisi.' }) });

/**
 * Tahan / buka kembali pengumuman hasil. Hasil terbuka otomatis saat syaratnya terpenuhi, jadi
 * endpoint ini dipakai panitia untuk menahan hasil (mis. ada sengketa) atau membukanya kembali.
 */
adminElectionRouter.put('/results-publication', async (req, res) => {
  const admin = currentUser(req);
  const { published } = publicationSchema.parse(req.body);
  resetCompletionCache();
  const { publication } = await electionView();
  if (published && !publication.unlocked) {
    throw new HttpError(
      409,
      'Hasil baru dapat diumumkan setelah masa pemungutan suara selesai, ditutup panitia, atau semua pemilih sudah memilih.',
      'VOTING_NOT_FINISHED',
    );
  }
  await prisma.electionSettings.update({
    where: { id: 1 },
    data: published ? { resultsWithheld: false } : { resultsWithheld: true, resultsPublishedAt: null },
  });
  await recordAudit({
    action: published ? AUDIT.RESULTS_PUBLISHED : AUDIT.RESULTS_UNPUBLISHED,
    status: 'success',
    userId: admin.id,
    actor: admin.nis,
  });
  res.json({ election: (await electionView()).election });
});

adminElectionRouter.post('/hero-photo', photoUpload, async (req, res) => {
  const admin = currentUser(req);
  const existing = await getElectionSettings();
  const heroPhotoUrl = await saveImage(req.file, 'hero');
  await prisma.electionSettings.update({ where: { id: 1 }, data: { heroPhotoUrl } });
  await removeUpload(existing.heroPhotoUrl);
  await recordAudit({ action: AUDIT.HERO_PHOTO_UPDATED, status: 'success', userId: admin.id, actor: admin.nis });
  res.json({ election: (await electionView()).election });
});

adminElectionRouter.delete('/hero-photo', async (req, res) => {
  const admin = currentUser(req);
  const existing = await getElectionSettings();
  await prisma.electionSettings.update({ where: { id: 1 }, data: { heroPhotoUrl: null } });
  await removeUpload(existing.heroPhotoUrl);
  await recordAudit({
    action: AUDIT.HERO_PHOTO_UPDATED,
    status: 'success',
    userId: admin.id,
    actor: admin.nis,
    metadata: { removed: true },
  });
  res.json({ election: (await electionView()).election });
});
