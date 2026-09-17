import { Router } from 'express';
import { z } from 'zod';
import { HttpError } from '../lib/http-error.js';
import { prisma } from '../lib/prisma.js';
import { currentUser, requireAuth, requireRole } from '../middleware/auth.js';
import { voteLimiter } from '../middleware/rate-limit.js';
import { candidateInclude, serializeCandidate } from '../services/candidates.js';
import { getElectionSettings, serializeElection } from '../services/election.js';
import { castVote } from '../services/votes.js';

const idParam = z.coerce.number({ error: 'ID tidak valid.' }).int().positive('ID tidak valid.');

export const electionRouter = Router();

electionRouter.get('/settings', async (_req, res) => {
  res.json({ election: serializeElection(await getElectionSettings()) });
});

export const candidatesRouter = Router();

candidatesRouter.use(requireAuth);

candidatesRouter.get('/', async (_req, res) => {
  const candidates = await prisma.candidate.findMany({ orderBy: { candidateNumber: 'asc' }, include: candidateInclude });
  res.json({ candidates: candidates.map(serializeCandidate) });
});

candidatesRouter.get('/:id', async (req, res) => {
  const candidate = await prisma.candidate.findUnique({
    where: { id: idParam.parse(req.params.id) },
    include: candidateInclude,
  });
  if (!candidate) throw new HttpError(404, 'Kandidat tidak ditemukan.', 'CANDIDATE_NOT_FOUND');
  res.json({ candidate: serializeCandidate(candidate) });
});

export const votesRouter = Router();

const voteSchema = z.object({
  candidateId: z.number({ error: 'Pilih kandidat terlebih dahulu.' }).int().positive('Pilih kandidat terlebih dahulu.'),
});

votesRouter.post('/', requireAuth, requireRole('student'), voteLimiter, async (req, res) => {
  const { candidateId } = voteSchema.parse(req.body);
  const vote = await castVote({
    user: currentUser(req),
    candidateId,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });
  res.status(201).json({ message: 'Suara Anda berhasil direkam.', vote });
});
