import type { VoterScope } from '../generated/prisma/client.js';
import { prisma } from '../lib/prisma.js';
import { wibDateKey, wibDayStart, wibHour } from '../lib/time.js';
import { categoryOrderBy } from './categories.js';

const round1 = (value: number) => Math.round(value * 10) / 10;
const percent = (part: number, whole: number) => (whole ? round1((part / whole) * 100) : 0);

/**
 * Rekap agregat per kategori. Tidak pernah memuat hubungan pemilih ↔ kandidat.
 * Pemenang = perolehan suara terbanyak; lebih dari satu pemenang berarti seri.
 */
export async function getResults() {
  const [students, teachers, participated, categories, votesByCandidate, votersByCategory] = await Promise.all([
    prisma.user.count({ where: { role: 'student' } }),
    prisma.user.count({ where: { role: 'teacher' } }),
    prisma.user.count({ where: { role: { in: ['student', 'teacher'] }, votes: { some: {} } } }),
    prisma.category.findMany({
      orderBy: [...categoryOrderBy],
      include: {
        candidates: {
          orderBy: { candidateNumber: 'asc' },
          select: {
            id: true,
            candidateNumber: true,
            photoUrl: true,
            user: { select: { name: true, role: true, schoolClass: { select: { name: true } } } },
          },
        },
      },
    }),
    prisma.vote.groupBy({ by: ['candidateId'], _count: { _all: true } }),
    prisma.vote.groupBy({ by: ['categoryId'], _count: { _all: true } }),
  ]);

  const candidateVotes = new Map(votesByCandidate.map((row) => [row.candidateId, row._count._all]));
  const categoryVotes = new Map(votersByCategory.map((row) => [row.categoryId, row._count._all]));
  const eligibleFor = (scope: VoterScope) => (scope === 'all' ? students + teachers : scope === 'student' ? students : teachers);
  const voters = students + teachers;

  const categoryResults = categories.map((category) => {
    const totalVotes = categoryVotes.get(category.id) ?? 0;
    const eligible = eligibleFor(category.voterScope);
    const candidates = category.candidates.map(({ user, ...candidate }) => {
      const votes = candidateVotes.get(candidate.id) ?? 0;
      return {
        ...candidate,
        name: user.name,
        role: user.role,
        className: user.schoolClass?.name ?? '',
        votes,
        percentage: percent(votes, totalVotes),
      };
    });
    const topVotes = Math.max(0, ...candidates.map((c) => c.votes));
    const winnerIds = topVotes > 0 ? candidates.filter((c) => c.votes === topVotes).map((c) => c.id) : [];
    return {
      id: category.id,
      name: category.name,
      description: category.description,
      voterScope: category.voterScope,
      eligible,
      totalVotes,
      turnout: percent(totalVotes, eligible),
      candidates,
      winnerIds,
      tie: winnerIds.length > 1,
    };
  });

  // Kategori tanpa kandidat tidak mungkin dipilih, jadi tidak ikut dihitung sebagai suara yang ditunggu.
  const expectedVotes = categoryResults
    .filter((category) => category.candidates.length > 0)
    .reduce((sum, category) => sum + category.eligible, 0);
  const totalVotes = votesByCandidate.reduce((sum, row) => sum + row._count._all, 0);

  return {
    totals: {
      students,
      teachers,
      voters,
      /** Pemilih yang sudah memilih di minimal satu kategori. */
      participated,
      notParticipated: Math.max(voters - participated, 0),
      turnout: percent(participated, voters),
      totalVotes,
      /** Jumlah suara bila semua pemilih memilih di semua kategori yang menjadi haknya. */
      expectedVotes,
      /** Semua pemilih sudah memilih di semua kategori — syarat hasil terbuka otomatis. */
      completed: expectedVotes > 0 && totalVotes >= expectedVotes,
    },
    categories: categoryResults,
  };
}

/** Jumlah suara per jam (WIB) untuk satu tanggal "YYYY-MM-DD", semua kategori. */
export async function getHourlyParticipation(dateKey: string = wibDateKey(new Date())) {
  const start = wibDayStart(dateKey);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const votes = await prisma.vote.findMany({
    where: { votedAt: { gte: start, lt: end } },
    select: { votedAt: true },
  });
  const perHour = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
  for (const vote of votes) perHour[wibHour(vote.votedAt)]!.count++;
  return { date: dateKey, perHour };
}
