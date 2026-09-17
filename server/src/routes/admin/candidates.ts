import { Router } from 'express';
import { z } from 'zod';
import { HttpError } from '../../lib/http-error.js';
import { isUniqueViolation, prisma } from '../../lib/prisma.js';
import { photoUpload, removeUpload, saveImage } from '../../lib/uploads.js';
import { currentUser } from '../../middleware/auth.js';
import { AUDIT, recordAudit } from '../../services/audit.js';
import { candidateInclude, serializeAdminCandidate } from '../../services/candidates.js';
import { computeElectionPhase } from '../../services/election.js';

export const adminCandidatesRouter = Router();

const idParam = z.coerce.number().int().positive('ID tidak valid.');

const textList = (label: string, min: number) =>
  z
    .array(z.string().trim().min(1).max(300, `Setiap butir ${label} maksimal 300 karakter.`))
    .min(min, `${label} minimal ${min} butir.`)
    .max(10, `${label} maksimal 10 butir.`);

const candidateSchema = z.object({
  candidateNumber: z.coerce
    .number({ error: 'Nomor urut wajib diisi.' })
    .int('Nomor urut harus bilangan bulat.')
    .min(1, 'Nomor urut minimal 1.')
    .max(99, 'Nomor urut maksimal 99.'),
  studentId: z.coerce.number({ error: 'Pilih siswa sebagai kandidat.' }).int().positive('Pilih siswa sebagai kandidat.'),
  vision: z.string().trim().min(5, 'Visi minimal 5 karakter.').max(1000, 'Visi maksimal 1000 karakter.'),
  mission: textList('Misi', 1),
  programs: textList('Program kerja', 0),
  organizationHistory: textList('Riwayat organisasi', 0),
});

type CandidateInput = z.infer<typeof candidateSchema>;

async function electionInProgress(): Promise<boolean> {
  const settings = await prisma.electionSettings.findUnique({ where: { id: 1 } });
  if (!settings) return false;
  const phase = computeElectionPhase(settings);
  return phase === 'active' || phase === 'outside_hours';
}

async function findCandidate(id: number) {
  const candidate = await prisma.candidate.findUnique({ where: { id }, include: candidateInclude });
  if (!candidate) throw new HttpError(404, 'Kandidat tidak ditemukan.', 'CANDIDATE_NOT_FOUND');
  return candidate;
}

/** Pesan yang jelas untuk nomor urut / siswa yang sudah dipakai kandidat lain. */
async function assertAvailable(input: CandidateInput, currentId?: number) {
  const student = await prisma.user.findFirst({
    where: { id: input.studentId, role: 'student' },
    select: { id: true, candidacy: { select: { id: true, candidateNumber: true } } },
  });
  if (!student) {
    throw new HttpError(400, 'Siswa yang dipilih tidak ditemukan.', 'VALIDATION_ERROR', [
      { path: 'studentId', message: 'Siswa yang dipilih tidak ditemukan.' },
    ]);
  }
  if (student.candidacy && student.candidacy.id !== currentId) {
    const message = `Siswa ini sudah terdaftar sebagai kandidat No. ${student.candidacy.candidateNumber}.`;
    throw new HttpError(409, message, 'STUDENT_ALREADY_CANDIDATE', [{ path: 'studentId', message }]);
  }
  const sameNumber = await prisma.candidate.findUnique({
    where: { candidateNumber: input.candidateNumber },
    select: { id: true },
  });
  if (sameNumber && sameNumber.id !== currentId) {
    const message = 'Nomor urut sudah dipakai kandidat lain.';
    throw new HttpError(409, message, 'DUPLICATE_CANDIDATE_NUMBER', [{ path: 'candidateNumber', message }]);
  }
}

function toData(input: CandidateInput) {
  const { studentId, ...rest } = input;
  return { ...rest, userId: studentId };
}

const RACE_MESSAGE = 'Nomor urut atau siswa baru saja dipakai kandidat lain. Muat ulang lalu coba lagi.';

adminCandidatesRouter.get('/', async (_req, res) => {
  const candidates = await prisma.candidate.findMany({
    orderBy: { candidateNumber: 'asc' },
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
    const candidate = await prisma.candidate.create({ data: toData(input), include: candidateInclude });
    await recordAudit({
      action: AUDIT.CANDIDATE_CREATED,
      status: 'success',
      userId: admin.id,
      actor: admin.nis,
      metadata: { candidateId: candidate.id, candidateNumber: candidate.candidateNumber, name: candidate.user.name },
    });
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
  const identityChanged = existing.candidateNumber !== input.candidateNumber || existing.userId !== input.studentId;
  if (identityChanged && (await electionInProgress())) {
    throw new HttpError(
      409,
      'Nomor urut dan siswa kandidat tidak dapat diubah saat masa pemungutan suara berlangsung.',
      'ELECTION_IN_PROGRESS',
    );
  }
  await assertAvailable(input, id);
  try {
    const candidate = await prisma.candidate.update({ where: { id }, data: toData(input), include: candidateInclude });
    await recordAudit({
      action: AUDIT.CANDIDATE_UPDATED,
      status: 'success',
      userId: admin.id,
      actor: admin.nis,
      metadata: { candidateId: id, candidateNumber: candidate.candidateNumber, name: candidate.user.name },
    });
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
  // Hanya status kandidat yang dihapus; data siswanya tetap ada.
  await prisma.candidate.delete({ where: { id } });
  await removeUpload(candidate.photoUrl);
  await recordAudit({
    action: AUDIT.CANDIDATE_DELETED,
    status: 'success',
    userId: admin.id,
    actor: admin.nis,
    metadata: { candidateId: id, candidateNumber: candidate.candidateNumber, name: candidate.user.name },
  });
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
    metadata: { candidateId: id, name: candidate.user.name },
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
    metadata: { candidateId: id, name: candidate.user.name, removed: true },
  });
  res.json({ candidate: serializeAdminCandidate(candidate) });
});
