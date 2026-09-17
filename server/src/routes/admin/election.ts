import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { photoUpload, removeUpload, saveImage } from '../../lib/uploads.js';
import { currentUser } from '../../middleware/auth.js';
import { AUDIT, recordAudit } from '../../services/audit.js';
import { getElectionSettings, serializeElection } from '../../services/election.js';

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
  res.json({ election: serializeElection(await getElectionSettings()) });
});

adminElectionRouter.put('/', async (req, res) => {
  const admin = currentUser(req);
  const data = electionSchema.parse(req.body);
  const before = await prisma.electionSettings.findUnique({ where: { id: 1 } });
  const settings = await prisma.electionSettings.upsert({
    where: { id: 1 },
    create: { id: 1, ...data },
    update: data,
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
    },
  });
  res.json({ election: serializeElection(settings) });
});

adminElectionRouter.post('/hero-photo', photoUpload, async (req, res) => {
  const admin = currentUser(req);
  const existing = await getElectionSettings();
  const heroPhotoUrl = await saveImage(req.file, 'hero');
  const settings = await prisma.electionSettings.update({ where: { id: 1 }, data: { heroPhotoUrl } });
  await removeUpload(existing.heroPhotoUrl);
  await recordAudit({ action: AUDIT.HERO_PHOTO_UPDATED, status: 'success', userId: admin.id, actor: admin.nis });
  res.json({ election: serializeElection(settings) });
});

adminElectionRouter.delete('/hero-photo', async (req, res) => {
  const admin = currentUser(req);
  const existing = await getElectionSettings();
  const settings = await prisma.electionSettings.update({ where: { id: 1 }, data: { heroPhotoUrl: null } });
  await removeUpload(existing.heroPhotoUrl);
  await recordAudit({
    action: AUDIT.HERO_PHOTO_UPDATED,
    status: 'success',
    userId: admin.id,
    actor: admin.nis,
    metadata: { removed: true },
  });
  res.json({ election: serializeElection(settings) });
});
