import { prisma } from '../lib/prisma.js';
import { wibDateKey, wibDayStart, wibHour } from '../lib/time.js';

const round1 = (value: number) => Math.round(value * 10) / 10;

/** Rekap agregat. Tidak pernah memuat hubungan siswa ↔ kandidat. */
export async function getResults() {
  const [students, voted, candidates, grouped] = await Promise.all([
    prisma.user.count({ where: { role: 'student' } }),
    prisma.user.count({ where: { role: 'student', hasVoted: true } }),
    prisma.candidate.findMany({
      orderBy: { candidateNumber: 'asc' },
      select: {
        id: true,
        candidateNumber: true,
        photoUrl: true,
        user: { select: { name: true, schoolClass: { select: { name: true } } } },
      },
    }),
    prisma.vote.groupBy({ by: ['candidateId'], _count: { _all: true } }),
  ]);

  const votesByCandidate = new Map(grouped.map((g) => [g.candidateId, g._count._all]));
  const totalVotes = grouped.reduce((sum, g) => sum + g._count._all, 0);

  return {
    totals: {
      students,
      voted,
      notVoted: Math.max(students - voted, 0),
      turnout: students ? round1((voted / students) * 100) : 0,
      totalVotes,
    },
    perCandidate: candidates.map(({ user, ...candidate }) => {
      const votes = votesByCandidate.get(candidate.id) ?? 0;
      return {
        ...candidate,
        name: user.name,
        className: user.schoolClass?.name ?? '',
        votes,
        percentage: totalVotes ? round1((votes / totalVotes) * 100) : 0,
      };
    }),
  };
}

/** Jumlah suara per jam (WIB) untuk satu tanggal "YYYY-MM-DD". */
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
