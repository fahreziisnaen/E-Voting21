import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '../../generated/prisma/client.js';
import { toCsv } from '../../lib/csv.js';
import { prisma } from '../../lib/prisma.js';
import { formatWib, wibDateKey } from '../../lib/time.js';
import { currentUser } from '../../middleware/auth.js';
import { AUDIT, recordAudit } from '../../services/audit.js';
import { computeElectionPhase, getElectionSettings } from '../../services/election.js';
import { getHourlyParticipation, getResults } from '../../services/stats.js';

export const adminReportsRouter = Router();

const statsQuery = z.object({
  date: z.iso.date({ error: 'Tanggal tidak valid.' }).optional(),
});

adminReportsRouter.get('/stats', async (req, res) => {
  const { date } = statsQuery.parse(req.query);
  const [results, hourly] = await Promise.all([getResults(), getHourlyParticipation(date)]);
  res.json({ ...results, ...hourly, generatedAt: new Date().toISOString() });
});

adminReportsRouter.get('/results', async (_req, res) => {
  res.json({ ...(await getResults()), generatedAt: new Date().toISOString() });
});

const PHASE_LABEL = {
  draft: 'Draf',
  upcoming: 'Belum dimulai',
  active: 'Berlangsung',
  outside_hours: 'Berlangsung (di luar jam voting)',
  ended: 'Selesai',
  closed: 'Ditutup panitia',
} as const;

adminReportsRouter.get('/results/export.csv', async (req, res) => {
  const admin = currentUser(req);
  const [settings, results] = await Promise.all([getElectionSettings(), getResults()]);
  const now = new Date();
  const { totals } = results;

  const csv = toCsv([
    [settings.electionName],
    ['Diekspor pada', formatWib(now)],
    ['Status pemungutan suara', PHASE_LABEL[computeElectionPhase(settings, now)]],
    [],
    ['No. Urut', 'Nama Kandidat', 'Kelas', 'Jumlah Suara', 'Persentase (%)'],
    ...results.perCandidate.map((c) => [c.candidateNumber, c.name, c.className, c.votes, c.percentage]),
    [],
    ['Total suara masuk', totals.totalVotes],
    ['Total siswa terdaftar', totals.students],
    ['Belum memilih', totals.notVoted],
    ['Partisipasi (%)', totals.turnout],
  ]);

  await recordAudit({ action: AUDIT.RESULTS_EXPORTED, status: 'success', userId: admin.id, actor: admin.nis });
  res
    .status(200)
    .type('text/csv; charset=utf-8')
    .attachment(`hasil-voting-osis-${wibDateKey(now)}.csv`)
    .send(csv);
});

const auditQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(25),
  action: z.string().trim().max(64).optional(),
  status: z.enum(['success', 'rejected', 'failed']).optional(),
  q: z.string().trim().max(64).optional(),
});

adminReportsRouter.get('/audit-logs', async (req, res) => {
  const query = auditQuery.parse(req.query);
  const where: Prisma.AuditLogWhereInput = {
    ...(query.action ? { action: query.action } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.q ? { actor: { contains: query.q } } : {}),
  };
  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: { id: true, timestamp: true, action: true, actor: true, status: true, metadata: true },
    }),
  ]);
  res.json({ logs, total, page: query.page, pageSize: query.pageSize });
});
