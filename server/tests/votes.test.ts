import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { app, createCandidates, createUser, loginAs, resetDatabase, setElection } from './helpers.js';

const HOUR = 60 * 60 * 1000;
let candidateIds: number[];

beforeEach(async () => {
  await resetDatabase();
  await setElection();
  candidateIds = (await createCandidates()).map((c) => c.id);
  await createUser('2001');
});

afterAll(() => prisma.$disconnect());

async function vote(nis: string, candidateId: number) {
  const { agent, token } = await loginAs(nis);
  return { agent, token, res: await agent.post('/api/votes').set('x-csrf-token', token).send({ candidateId }) };
}

describe('POST /api/votes — satu suara per siswa', () => {
  it('suara pertama tersimpan (201) dalam satu transaksi', async () => {
    const { res, agent } = await vote('2001', candidateIds[0]!);
    expect(res.status).toBe(201);
    expect(res.body.vote.receiptCode).toMatch(/^VT-\d{4}-[A-Z2-9]{8}$/);
    // Respons tidak membocorkan kandidat yang dipilih.
    expect(JSON.stringify(res.body)).not.toContain('candidate');

    const user = await prisma.user.findUniqueOrThrow({ where: { nis: '2001' } });
    expect(user.hasVoted).toBe(true);
    expect(await prisma.vote.count({ where: { userId: user.id } })).toBe(1);

    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'vote.cast' } });
    expect(audit.status).toBe('success');
    expect(JSON.stringify(audit.metadata)).not.toContain(String(candidateIds[0]));

    const me = await agent.get('/api/auth/me');
    expect(me.body.hasVoted).toBe(true);
    expect(me.body.vote.receiptCode).toBe(res.body.vote.receiptCode);
  });

  it('percobaan kedua ditolak 409 dan tercatat di audit log', async () => {
    const first = await vote('2001', candidateIds[0]!);
    expect(first.res.status).toBe(201);

    const second = await first.agent.post('/api/votes').set('x-csrf-token', first.token).send({ candidateId: candidateIds[1] });
    expect(second.status).toBe(409);
    expect(second.body.code).toBe('ALREADY_VOTED');
    expect(second.body.message).toMatch(/hanya dapat memilih satu kali/);

    expect(await prisma.vote.count()).toBe(1);
    const rejected = await prisma.auditLog.findFirstOrThrow({ where: { action: 'vote.rejected' } });
    expect(rejected).toMatchObject({ status: 'rejected', actor: '2001' });
    expect(rejected.metadata).toMatchObject({ reason: 'already_voted' });
  });

  it('request paralel (double submit) hanya menghasilkan satu suara', async () => {
    const { agent, token } = await loginAs('2001');
    const attempts = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        agent.post('/api/votes').set('x-csrf-token', token).send({ candidateId: candidateIds[i % 2] }),
      ),
    );
    const statuses = attempts.map((r) => r.status).sort();
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(4);
    expect(await prisma.vote.count()).toBe(1);
  });

  it('flag has_voted yang dimanipulasi tetap ditahan UNIQUE(user_id) di database', async () => {
    const first = await vote('2001', candidateIds[0]!);
    expect(first.res.status).toBe(201);
    await prisma.user.update({ where: { nis: '2001' }, data: { hasVoted: false } });

    const again = await first.agent.post('/api/votes').set('x-csrf-token', first.token).send({ candidateId: candidateIds[1] });
    expect(again.status).toBe(409);
    expect(await prisma.vote.count()).toBe(1);
  });
});

describe('POST /api/votes — jadwal', () => {
  it('sebelum jadwal dimulai → 403 dan tercatat', async () => {
    await setElection({ startDate: new Date(Date.now() + 24 * HOUR), endDate: new Date(Date.now() + 48 * HOUR) });
    const { res } = await vote('2001', candidateIds[0]!);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('VOTING_NOT_OPEN');
    expect(await prisma.vote.count()).toBe(0);

    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: 'vote.rejected' } });
    expect(log.metadata).toMatchObject({ reason: 'outside_schedule', phase: 'upcoming' });
  });

  it('setelah jadwal berakhir → 403', async () => {
    await setElection({ startDate: new Date(Date.now() - 48 * HOUR), endDate: new Date(Date.now() - 24 * HOUR) });
    const { res } = await vote('2001', candidateIds[0]!);
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/berakhir/);
  });

  it('ditutup panitia (status closed) → 403 walau masih dalam rentang waktu', async () => {
    await setElection({ status: 'closed' });
    const { res } = await vote('2001', candidateIds[0]!);
    expect(res.status).toBe(403);
    expect(await prisma.user.count({ where: { hasVoted: true } })).toBe(0);
  });
});

describe('POST /api/votes — validasi & akses', () => {
  it('tanpa login → 401', async () => {
    const res = await request(app).post('/api/votes').send({ candidateId: candidateIds[0] });
    // CSRF dicek lebih dulu untuk request tanpa cookie.
    expect([401, 403]).toContain(res.status);
    expect(await prisma.vote.count()).toBe(0);
  });

  it('panitia tidak dapat memberikan suara → 403', async () => {
    await createUser('admin.uji', 'admin');
    const { res } = await vote('admin.uji', candidateIds[0]!);
    expect(res.status).toBe(403);
  });

  it('kandidat tidak ada → 404 dan has_voted tidak berubah', async () => {
    const { res } = await vote('2001', 999_999);
    expect(res.status).toBe(404);
    const user = await prisma.user.findUniqueOrThrow({ where: { nis: '2001' } });
    expect(user.hasVoted).toBe(false);
  });

  it('payload tidak valid → 400', async () => {
    const { agent, token } = await loginAs('2001');
    const res = await agent.post('/api/votes').set('x-csrf-token', token).send({ candidateId: '1; DROP TABLE votes' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});
