import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { createCandidates, createClass, createUser, loginAs, resetDatabase, setElection } from './helpers.js';

beforeEach(async () => {
  await resetDatabase();
  await setElection();
  await createCandidates();
  await createUser('admin.uji', 'admin');
  await createUser('3001');
  await createUser('3002');
});

afterAll(() => prisma.$disconnect());

describe('RBAC /api/admin/*', () => {
  it('siswa ditolak 403 di semua endpoint admin', async () => {
    const { agent, token } = await loginAs('3001');
    for (const path of ['/api/admin/stats', '/api/admin/audit-logs', '/api/admin/students', '/api/admin/results/export.csv']) {
      expect((await agent.get(path)).status).toBe(403);
    }
    const create = await agent.post('/api/admin/students').set('x-csrf-token', token).send({});
    expect(create.status).toBe(403);
  });
});

describe('statistik & hasil', () => {
  it('hanya mengembalikan agregat, bukan siapa memilih siapa', async () => {
    const candidates = await prisma.candidate.findMany({ orderBy: { candidateNumber: 'asc' } });
    const student = await loginAs('3001');
    await student.agent.post('/api/votes').set('x-csrf-token', student.token).send({ candidateId: candidates[0]!.id });

    const { agent } = await loginAs('admin.uji');
    const stats = await agent.get('/api/admin/stats');
    expect(stats.status).toBe(200);
    // 2 siswa biasa + 2 siswa yang menjadi kandidat.
    expect(stats.body.totals).toMatchObject({ students: 4, voted: 1, notVoted: 3, turnout: 25, totalVotes: 1 });
    expect(stats.body.perCandidate[0]).toMatchObject({ candidateNumber: 1, votes: 1, percentage: 100 });
    expect(stats.body.perHour).toHaveLength(24);

    const body = JSON.stringify(stats.body);
    expect(body).not.toContain('3001');
    expect(body).not.toContain('userId');

    const csv = await agent.get('/api/admin/results/export.csv');
    expect(csv.status).toBe(200);
    expect(csv.headers['content-type']).toMatch(/text\/csv/);
    expect(csv.text).toContain('Kandidat Satu,XII IPA 1,1,100');
    expect(await prisma.auditLog.count({ where: { action: 'results.exported' } })).toBe(1);
  });
});

describe('kelola data', () => {
  it('membuat siswa, NIS duplikat → 409, dan siswa yang sudah memilih tidak bisa dihapus', async () => {
    const { agent, token } = await loginAs('admin.uji');
    const classX1 = await createClass('X-1', 10);
    const payload = { nis: '3003', name: 'Siswa Baru', classId: classX1.id, password: 'kode123' };
    expect((await agent.post('/api/admin/students').set('x-csrf-token', token).send(payload)).status).toBe(201);
    expect((await agent.post('/api/admin/students').set('x-csrf-token', token).send(payload)).status).toBe(409);

    const voter = await prisma.user.update({ where: { nis: '3001' }, data: { hasVoted: true } });
    const del = await agent.delete(`/api/admin/students/${voter.id}`).set('x-csrf-token', token);
    expect(del.status).toBe(409);
  });

  it('impor CSV: 1000 baris diterima walau melebihi batas body 100kb global, NIS lama dilewati', async () => {
    const { agent, token } = await loginAs('admin.uji');
    const students = Array.from({ length: 1000 }, (_, i) => ({
      nis: i === 0 ? '3001' : `9${String(i).padStart(6, '0')}`,
      name: `Siswa Impor Dengan Nama Cukup Panjang ${i}`,
      className: 'XII IPS 3',
      password: `kode-akses-${i}`,
    }));
    const res = await agent
      .post('/api/admin/students/import')
      .set('x-csrf-token', token)
      .send({ students, createMissingClasses: true });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ received: 1000, created: 999, skipped: 1, createdClasses: ['XII IPS 3'] });
    expect(res.body.createdNis).toHaveLength(999);
    expect(res.body.createdNis).not.toContain('3001');
    expect(await prisma.user.count({ where: { schoolClass: { name: 'XII IPS 3' } } })).toBe(999);

    const tooMany = await agent
      .post('/api/admin/students/import')
      .set('x-csrf-token', token)
      .send({ students: [...students, ...students.slice(0, 1)], createMissingClasses: true });
    expect(tooMany.status).toBe(400);
  }, 120_000);

  it('endpoint lain tetap dibatasi 100kb', async () => {
    const { agent, token } = await loginAs('admin.uji');
    const res = await agent
      .post('/api/admin/students')
      .set('x-csrf-token', token)
      .send({ nis: '3009', name: 'x'.repeat(150_000), classId: 1, password: 'kode123' });
    expect(res.status).toBe(413);
  });

  it('reset kode akses mencabut sesi siswa', async () => {
    const student = await loginAs('3002');
    const { agent, token } = await loginAs('admin.uji');
    const target = await prisma.user.findUniqueOrThrow({ where: { nis: '3002' } });

    const update = await agent
      .put(`/api/admin/students/${target.id}`)
      .set('x-csrf-token', token)
      .send({ nis: '3002', name: target.name, classId: target.classId, password: 'kode-baru-123' });
    expect(update.status).toBe(200);
    expect((await student.agent.get('/api/auth/me')).status).toBe(401);
  });

  it('menambah kandidat saat pemungutan suara berlangsung ditolak', async () => {
    const { agent, token } = await loginAs('admin.uji');
    const student = await prisma.user.findUniqueOrThrow({ where: { nis: '3001' } });
    const res = await agent.post('/api/admin/candidates').set('x-csrf-token', token).send({
      candidateNumber: 3,
      studentId: student.id,
      vision: 'Visi baru kandidat.',
      mission: ['Misi'],
      programs: [],
      organizationHistory: [],
    });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ELECTION_IN_PROGRESS');
  });

  it('perubahan jadwal tervalidasi dan tercatat di audit log', async () => {
    const { agent, token } = await loginAs('admin.uji');
    const invalid = await agent.put('/api/admin/election').set('x-csrf-token', token).send({
      electionName: 'Pemilihan Uji',
      startDate: '2025-09-14T07:00:00+07:00',
      endDate: '2025-09-12T15:00:00+07:00',
      status: 'open',
    });
    expect(invalid.status).toBe(400);

    const valid = await agent.put('/api/admin/election').set('x-csrf-token', token).send({
      electionName: 'Pemilihan Uji',
      startDate: '2025-09-12T07:00:00+07:00',
      endDate: '2025-09-14T15:00:00+07:00',
      status: 'closed',
    });
    expect(valid.status).toBe(200);
    expect(valid.body.election).toMatchObject({ status: 'closed', phase: 'closed', isVotingOpen: false });
    expect(await prisma.auditLog.count({ where: { action: 'election.updated' } })).toBe(1);
  });
});
