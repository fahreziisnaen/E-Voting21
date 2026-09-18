import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { isUniqueViolation, prisma } from '../src/lib/prisma.js';
import { app, createCandidates, createUser, loginAs, resetDatabase, setElection } from './helpers.js';

const HOUR = 60 * 60 * 1000;
let osis: number[];
let mpk: number[];

beforeEach(async () => {
  await resetDatabase();
  await setElection();
  osis = (await createCandidates('Ketua OSIS')).map((c) => c.id);
  mpk = (await createCandidates('Ketua MPK')).map((c) => c.id);
  await createUser('2001');
  await createUser('G001', 'teacher', 'Guru Uji');
});

afterAll(() => prisma.$disconnect());

async function vote(nis: string, candidateId: number) {
  const { agent, token } = await loginAs(nis);
  return { agent, token, res: await agent.post('/api/votes').set('x-csrf-token', token).send({ candidateId }) };
}

describe('POST /api/votes — satu suara per pemilih per kategori', () => {
  it('suara pertama tersimpan (201) beserta kategorinya', async () => {
    const { res, agent } = await vote('2001', osis[0]!);
    expect(res.status).toBe(201);
    expect(res.body.vote).toMatchObject({ categoryName: 'Ketua OSIS' });
    expect(res.body.vote.receiptCode).toMatch(/^VT-\d{4}-[A-Z2-9]{8}$/);
    // Respons tidak membocorkan kandidat yang dipilih.
    expect(JSON.stringify(res.body)).not.toContain('candidateId');

    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'vote.cast' } });
    expect(audit.metadata).toMatchObject({ category: 'Ketua OSIS' });
    expect(JSON.stringify(audit.metadata)).not.toMatch(/candidate/i);

    const me = await agent.get('/api/auth/me');
    expect(me.body.votes).toEqual([
      expect.objectContaining({ categoryName: 'Ketua OSIS', receiptCode: res.body.vote.receiptCode }),
    ]);
  });

  it('kategori berbeda boleh dipilih; kategori yang sama ditolak 409 dan tercatat', async () => {
    const first = await vote('2001', osis[0]!);
    const post = (candidateId: number) => first.agent.post('/api/votes').set('x-csrf-token', first.token).send({ candidateId });

    expect((await post(mpk[1]!)).status).toBe(201);

    const again = await post(osis[1]!);
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('ALREADY_VOTED');
    expect(again.body.message).toMatch(/kategori Ketua OSIS/);
    expect(again.body.message).toMatch(/satu kali per kategori/);

    expect(await prisma.vote.count()).toBe(2);
    const rejected = await prisma.auditLog.findFirstOrThrow({ where: { action: 'vote.rejected' } });
    expect(rejected).toMatchObject({ status: 'rejected', actor: '2001' });
    expect(rejected.metadata).toMatchObject({ reason: 'already_voted', category: 'Ketua OSIS' });
  });

  it('request paralel (double submit) hanya menghasilkan satu suara per kategori', async () => {
    const { agent, token } = await loginAs('2001');
    const attempts = await Promise.all(
      [osis[0], osis[1], osis[0], mpk[0], mpk[1], mpk[0]].map((candidateId) =>
        agent.post('/api/votes').set('x-csrf-token', token).send({ candidateId }),
      ),
    );
    const statuses = attempts.map((r) => r.status);
    expect(statuses.filter((s) => s === 201)).toHaveLength(2);
    expect(statuses.filter((s) => s === 409)).toHaveLength(4);
    const votes = await prisma.vote.findMany({ select: { categoryId: true } });
    expect(new Set(votes.map((v) => v.categoryId)).size).toBe(2);
  });

  it('UNIQUE(user_id, category_id) di database menolak suara ganda walau aplikasi dilewati', async () => {
    const { res } = await vote('2001', osis[0]!);
    expect(res.status).toBe(201);
    const existing = await prisma.vote.findFirstOrThrow();
    const attempt = prisma.vote.create({
      data: { userId: existing.userId, categoryId: existing.categoryId, candidateId: osis[1]!, receiptCode: 'VT-UJI-GANDA' },
    });
    await expect(attempt).rejects.toSatisfy(isUniqueViolation);
  });
});

describe('POST /api/votes — guru & hak memilih per kategori', () => {
  it('guru dapat memilih di kategori untuk semua pemilih', async () => {
    const { res } = await vote('G001', osis[0]!);
    expect(res.status).toBe(201);
  });

  it('kategori khusus siswa menolak guru (403) dan tercatat', async () => {
    const favorit = await createCandidates('Guru Favorit', 'student');
    const { res } = await vote('G001', favorit[0]!.id);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('NOT_ELIGIBLE');
    expect(res.body.message).toMatch(/hanya dapat dipilih oleh siswa/);
    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: 'vote.rejected' } });
    expect(log.metadata).toMatchObject({ reason: 'not_eligible', category: 'Guru Favorit' });

    // Siswa tetap boleh.
    expect((await vote('2001', favorit[0]!.id)).res.status).toBe(201);
  });

  it('kategori khusus guru menolak siswa', async () => {
    const khusus = await createCandidates('Pilihan Guru', 'teacher');
    const { res } = await vote('2001', khusus[0]!.id);
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/hanya dapat dipilih oleh guru/);
  });
});

describe('POST /api/votes — jadwal', () => {
  it('sebelum jadwal dimulai → 403 dan tercatat', async () => {
    await setElection({ startDate: new Date(Date.now() + 24 * HOUR), endDate: new Date(Date.now() + 48 * HOUR) });
    const { res } = await vote('2001', osis[0]!);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('VOTING_NOT_OPEN');
    expect(await prisma.vote.count()).toBe(0);

    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: 'vote.rejected' } });
    expect(log.metadata).toMatchObject({ reason: 'outside_schedule', phase: 'upcoming' });
  });

  it('setelah jadwal berakhir → 403', async () => {
    await setElection({ startDate: new Date(Date.now() - 48 * HOUR), endDate: new Date(Date.now() - 24 * HOUR) });
    const { res } = await vote('2001', osis[0]!);
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/berakhir/);
  });

  it('ditutup panitia (status closed) → 403 walau masih dalam rentang waktu', async () => {
    await setElection({ status: 'closed' });
    const { res } = await vote('G001', osis[0]!);
    expect(res.status).toBe(403);
    expect(await prisma.vote.count()).toBe(0);
  });
});

describe('POST /api/votes — validasi & akses', () => {
  it('tanpa login → ditolak', async () => {
    const res = await request(app).post('/api/votes').send({ candidateId: osis[0] });
    // CSRF dicek lebih dulu untuk request tanpa cookie.
    expect([401, 403]).toContain(res.status);
    expect(await prisma.vote.count()).toBe(0);
  });

  it('panitia tidak dapat memberikan suara → 403', async () => {
    await createUser('admin.uji', 'admin');
    const { res } = await vote('admin.uji', osis[0]!);
    expect(res.status).toBe(403);
  });

  it('kandidat tidak ada → 404', async () => {
    const { res } = await vote('2001', 999_999);
    expect(res.status).toBe(404);
    expect(await prisma.vote.count()).toBe(0);
  });

  it('payload tidak valid → 400', async () => {
    const { agent, token } = await loginAs('2001');
    const res = await agent.post('/api/votes').set('x-csrf-token', token).send({ candidateId: '1; DROP TABLE votes' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});
