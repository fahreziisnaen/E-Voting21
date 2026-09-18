import { Router } from 'express';
import { z } from 'zod';
import { HttpError } from '../lib/http-error.js';
import { prisma } from '../lib/prisma.js';
import { currentUser, requireAuth, requireRole } from '../middleware/auth.js';
import { voteLimiter } from '../middleware/rate-limit.js';
import { candidateInclude, serializeCandidate } from '../services/candidates.js';
import { categoryOrderBy, serializeCategory } from '../services/categories.js';
import { electionView } from '../services/election.js';
import { getResults } from '../services/stats.js';
import { castVote } from '../services/votes.js';

const idParam = z.coerce.number({ error: 'ID tidak valid.' }).int().positive('ID tidak valid.');

export const electionRouter = Router();

electionRouter.get('/settings', async (_req, res) => {
  res.json({ election: (await electionView()).election });
});

/** Publik: kategori beserta kandidatnya boleh dilihat tanpa login (tanpa NIS/username). */
export const categoriesRouter = Router();

categoriesRouter.get('/', async (_req, res) => {
  const categories = await prisma.category.findMany({
    orderBy: [...categoryOrderBy],
    include: { candidates: { orderBy: { candidateNumber: 'asc' }, include: candidateInclude } },
  });
  res.json({
    categories: categories.map(({ candidates, ...category }) => ({
      ...serializeCategory(category),
      candidates: candidates.map(serializeCandidate),
    })),
  });
});

export const candidatesRouter = Router();

candidatesRouter.get('/', async (_req, res) => {
  const candidates = await prisma.candidate.findMany({
    orderBy: [{ category: { sortOrder: 'asc' } }, { categoryId: 'asc' }, { candidateNumber: 'asc' }],
    include: candidateInclude,
  });
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

/**
 * Publik: perolehan suara & kandidat terpilih per kategori. Berisi data hanya setelah hasil terbuka —
 * yaitu masa pemungutan suara selesai/ditutup atau semua pemilih sudah memilih — dan tidak ditahan panitia.
 */
export const resultsRouter = Router();

resultsRouter.get('/', async (_req, res) => {
  const { publication } = await electionView();
  if (!publication.published) {
    res.json({ published: false, publishedAt: null, categories: [] });
    return;
  }
  const { categories } = await getResults();
  res.json({
    published: true,
    publishedAt: publication.publishedAt?.toISOString() ?? null,
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      description: category.description,
      totalVotes: category.totalVotes,
      tie: category.tie,
      winnerIds: category.winnerIds,
      candidates: category.candidates,
    })),
  });
});

export const votesRouter = Router();

const voteSchema = z.object({
  candidateId: z.number({ error: 'Pilih kandidat terlebih dahulu.' }).int().positive('Pilih kandidat terlebih dahulu.'),
});

votesRouter.post('/', requireAuth, requireRole('student', 'teacher'), voteLimiter, async (req, res) => {
  const { candidateId } = voteSchema.parse(req.body);
  const vote = await castVote({
    user: currentUser(req),
    candidateId,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });
  res.status(201).json({ message: `Suara Anda untuk kategori ${vote.categoryName} berhasil direkam.`, vote });
});
