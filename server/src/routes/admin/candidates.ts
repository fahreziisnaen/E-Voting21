import { Router } from 'express';
import { z } from 'zod';
import { HttpError } from '../../lib/http-error.js';
import { isUniqueViolation, prisma } from '../../lib/prisma.js';
import { photoUpload, removeUpload, saveImage } from '../../lib/uploads.js';
import { currentUser } from '../../middleware/auth.js';
import { AUDIT, recordAudit } from '../../services/audit.js';
import { candidateInclude, serializeAdminCandidate } from '../../services/candidates.js';
import { electionInProgress } from '../../services/election.js';

export const adminCandidatesRouter = Router();

const idParam = z.coerce.number().int().positive('ID tidak valid.');

const textList = (label: string, min: number) =>
  z
    .array(z.string().trim().min(1).max(300, `Setiap butir ${label} maksimal 300 karakter.`))
    .min(min, `${label} minimal ${min} butir.`)
    .max(10, `${label} maksimal 10 butir.`);

const candidateSchema = z.object({
  categoryId: z.coerce.number({ error: 'Pilih kategori.' }).int().positive('Pilih kategori.'),
  candidateNumber: z.coerce
    .number({ error: 'Nomor urut wajib diisi.' })
    .int('Nomor urut harus bilangan bulat.')
    .min(1, 'Nomor urut minimal 1.')
    .max(99, 'Nomor urut maksimal 99.'),
  userId: z.coerce.number({ error: 'Pilih siswa atau guru sebagai kandidat.' }).int().positive('Pilih siswa atau guru sebagai kandidat.'),
  vision: z.string().trim().min(5, 'Visi minimal 5 karakter.').max(1000, 'Visi maksimal 1000 karakter.'),
  mission: textList('Misi', 1),
  programs: textList('Program kerja', 0),
  organizationHistory: textList('Riwayat organisasi', 0),
});

const listQuery = z.object({ categoryId: z.coerce.number().int().positive().optional() });

type CandidateInput = z.infer<typeof candidateSchema>;

async function findCandidate(id: number) {
  const candidate = await prisma.candidate.findUnique({ where: { id }, include: candidateInclude });
  if (!candidate) throw new HttpError(404, 'Kandidat tidak ditemukan.', 'CANDIDATE_NOT_FOUND');
  return candidate;
}

function conflict(status: number, code: string, path: string, message: string): HttpError {
  return new HttpError(status, message, code, [{ path, message }]);
}

/** Pesan yang jelas untuk kategori, nomor urut, atau orang yang sudah dipakai di kategori yang sama. */
async function assertAvailable(input: CandidateInput, currentId?: number) {
  const category = await prisma.category.findUnique({ where: { id: input.categoryId }, select: { id: true, name: true } });
  if (!category) throw conflict(400, 'VALIDATION_ERROR', 'categoryId', 'Kategori yang dipilih tidak ditemukan.');

  const person = await prisma.user.findFirst({
    where: { id: input.userId, role: { in: ['student', 'teacher'] } },
    select: { candidacies: { where: { categoryId: input.categoryId }, select: { id: true, candidateNumber: true } } },
  });
  if (!person) throw conflict(400, 'VALIDATION_ERROR', 'userId', 'Siswa/guru yang dipilih tidak ditemukan.');
  const existing = person.candidacies[0];
  if (existing && existing.id !== currentId) {
    throw conflict(
      409,
      'ALREADY_CANDIDATE',
      'userId',
      `Orang ini sudah terdaftar sebagai kandidat No. ${existing.candidateNumber} di kategori ${category.name}.`,
    );
  }

  const sameNumber = await prisma.candidate.findUnique({
    where: { categoryId_candidateNumber: { categoryId: input.categoryId, candidateNumber: input.candidateNumber } },
    select: { id: true },
  });
  if (sameNumber && sameNumber.id !== currentId) {
    throw conflict(409, 'DUPLICATE_CANDIDATE_NUMBER', 'candidateNumber', `Nomor urut sudah dipakai di kategori ${category.name}.`);
  }
}

const RACE_MESSAGE = 'Nomor urut atau kandidat baru saja dipakai di kategori ini. Muat ulang lalu coba lagi.';

function auditMeta(candidate: Awaited<ReturnType<typeof findCandidate>>) {
  return {
    candidateId: candidate.id,
    categoryId: candidate.category.id,
    category: candidate.category.name,
    candidateNumber: candidate.candidateNumber,
    name: candidate.user.name,
  };
}

adminCandidatesRouter.get('/', async (req, res) => {
  const { categoryId } = listQuery.parse(req.query);
  const candidates = await prisma.candidate.findMany({
    where: categoryId ? { categoryId } : undefined,
    orderBy: [{ category: { sortOrder: 'asc' } }, { categoryId: 'asc' }, { candidateNumber: 'asc' }],
    include: { ...candidateInclude, _count: { select: { votes: true } } },
  });
  res.json({
    candidates: candidates.map(({ _count, ...candidate }) => ({
      ...serializeAdminCandidate(candidate),
      hasVotes: _count.votes > 0,
    })),
  });
});

adminCandidatesRouter.post('/', async (req, res) => {
  const admin = currentUser(req);
  const input = candidateSchema.parse(req.body);
  if (await electionInProgress()) {
    throw new HttpError(409, 'Kandidat tidak dapat ditambahkan saat masa pemungutan suara berlangsung.', 'ELECTION_IN_PROGRESS');
  }
  await assertAvailable(input);
  try {
    const candidate = await prisma.candidate.create({ data: input, include: candidateInclude });
    await recordAudit({ action: AUDIT.CANDIDATE_CREATED, status: 'success', userId: admin.id, actor: admin.nis, metadata: auditMeta(candidate) });
    res.status(201).json({ candidate: serializeAdminCandidate(candidate) });
  } catch (err) {
    if (isUniqueViolation(err)) throw new HttpError(409, RACE_MESSAGE, 'CANDIDATE_CONFLICT');
    throw err;
  }
});

adminCandidatesRouter.put('/:id', async (req, res) => {
  const admin = currentUser(req);
  const id = idParam.parse(req.params.id);
  const input = candidateSchema.parse(req.body);
  const existing = await findCandidate(id);
  const identityChanged =
    existing.categoryId !== input.categoryId ||
    existing.candidateNumber !== input.candidateNumber ||
    existing.userId !== input.userId;
  if (identityChanged && (await electionInProgress())) {
    throw new HttpError(
      409,
      'Kategori, nomor urut, dan orang kandidat tidak dapat diubah saat masa pemungutan suara berlangsung.',
      'ELECTION_IN_PROGRESS',
    );
  }
  if (identityChanged && existing.categoryId !== input.categoryId && (await prisma.vote.count({ where: { candidateId: id } })) > 0) {
    throw new HttpError(409, 'Kandidat yang sudah memperoleh suara tidak dapat dipindah ke kategori lain.', 'CANDIDATE_HAS_VOTES');
  }
  await assertAvailable(input, id);
  try {
    const candidate = await prisma.candidate.update({ where: { id }, data: input, include: candidateInclude });
    await recordAudit({ action: AUDIT.CANDIDATE_UPDATED, status: 'success', userId: admin.id, actor: admin.nis, metadata: auditMeta(candidate) });
    res.json({ candidate: serializeAdminCandidate(candidate) });
  } catch (err) {
    if (isUniqueViolation(err)) throw new HttpError(409, RACE_MESSAGE, 'CANDIDATE_CONFLICT');
    throw err;
  }
});

adminCandidatesRouter.delete('/:id', async (req, res) => {
  const admin = currentUser(req);
  const id = idParam.parse(req.params.id);
  const candidate = await findCandidate(id);
  if (await electionInProgress()) {
    throw new HttpError(409, 'Kandidat tidak dapat dihapus saat masa pemungutan suara berlangsung.', 'ELECTION_IN_PROGRESS');
  }
  if ((await prisma.vote.count({ where: { candidateId: id } })) > 0) {
    throw new HttpError(409, 'Kandidat yang sudah memperoleh suara tidak dapat dihapus.', 'CANDIDATE_HAS_VOTES');
  }
  // Hanya status kandidat yang dihapus; data siswa/gurunya tetap ada.
  await prisma.candidate.delete({ where: { id } });
  await removeUpload(candidate.photoUrl);
  await recordAudit({ action: AUDIT.CANDIDATE_DELETED, status: 'success', userId: admin.id, actor: admin.nis, metadata: auditMeta(candidate) });
  res.status(204).end();
});

adminCandidatesRouter.post('/:id/photo', photoUpload, async (req, res) => {
  const admin = currentUser(req);
  const id = idParam.parse(req.params.id);
  const existing = await findCandidate(id);
  const photoUrl = await saveImage(req.file, 'candidates');
  const candidate = await prisma.candidate.update({ where: { id }, data: { photoUrl }, include: candidateInclude });
  await removeUpload(existing.photoUrl);
  await recordAudit({
    action: AUDIT.CANDIDATE_PHOTO_UPDATED,
    status: 'success',
    userId: admin.id,
    actor: admin.nis,
    metadata: auditMeta(candidate),
  });
  res.json({ candidate: serializeAdminCandidate(candidate) });
});

adminCandidatesRouter.delete('/:id/photo', async (req, res) => {
  const admin = currentUser(req);
  const id = idParam.parse(req.params.id);
  const existing = await findCandidate(id);
  const candidate = await prisma.candidate.update({ where: { id }, data: { photoUrl: null }, include: candidateInclude });
  await removeUpload(existing.photoUrl);
  await recordAudit({
    action: AUDIT.CANDIDATE_PHOTO_UPDATED,
    status: 'success',
    userId: admin.id,
    actor: admin.nis,
    metadata: { ...auditMeta(candidate), removed: true },
  });
  res.json({ candidate: serializeAdminCandidate(candidate) });
});
