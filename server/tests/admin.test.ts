import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { createCandidates, createCategory, createClass, createUser, loginAs, resetDatabase, setElection } from './helpers.js';

beforeEach(async () => {
  await resetDatabase();
  await setElection();
  await createCandidates();
  await createUser('admin.uji', 'admin');
  await createUser('3001');
  await createUser('3002');
  await createUser('G100', 'teacher', 'Guru Pemilih');
});

afterAll(() => prisma.$disconnect());

describe('RBAC /api/admin/*', () => {
  it('siswa & guru ditolak 403 di semua endpoint admin', async () => {
    for (const nis of ['3001', 'G100']) {
      const { agent, token } = await loginAs(nis);
      for (const path of [
        '/api/admin/stats',
        '/api/admin/audit-logs',
        '/api/admin/students',
        '/api/admin/teachers',
        '/api/admin/categories',
        '/api/admin/results/export.csv',
      ]) {
        expect((await agent.get(path)).status).toBe(403);
      }
      expect((await agent.post('/api/admin/students').set('x-csrf-token', token).send({})).status).toBe(403);
      expect((await agent.put('/api/admin/election/results-publication').set('x-csrf-token', token).send({ published: true })).status).toBe(403);
    }
  });
});

describe('statistik & hasil', () => {
  it('agregat per kategori, bukan siapa memilih siapa', async () => {
    const mpk = await createCandidates('Ketua MPK');
    const favorit = await createCandidates('Guru Favorit', 'student');
    const [osisFirst] = await prisma.candidate.findMany({ where: { category: { name: 'Ketua OSIS' } }, orderBy: { candidateNumber: 'asc' } });

    const student = await loginAs('3001');
    const post = (session: Awaited<ReturnType<typeof loginAs>>, candidateId: number) =>
      session.agent.post('/api/votes').set('x-csrf-token', session.token).send({ candidateId });
    expect((await post(student, osisFirst!.id)).status).toBe(201);
    expect((await post(student, favorit[0]!.id)).status).toBe(201);
    const teacher = await loginAs('G100');
    expect((await post(teacher, mpk[1]!.id)).status).toBe(201);

    const { agent } = await loginAs('admin.uji');
    const stats = await agent.get('/api/admin/stats');
    expect(stats.status).toBe(200);
    // 2 siswa biasa + 6 siswa kandidat (3 kategori × 2), 1 guru.
    expect(stats.body.totals).toMatchObject({ students: 8, teachers: 1, voters: 9, participated: 2, totalVotes: 3 });
    expect(stats.body.perHour).toHaveLength(24);

    const byName = Object.fromEntries(stats.body.categories.map((c: { name: string }) => [c.name, c]));
    expect(byName['Ketua OSIS']).toMatchObject({ eligible: 9, totalVotes: 1, tie: false, winnerIds: [osisFirst!.id] });
    expect(byName['Ketua OSIS'].candidates[0]).toMatchObject({ candidateNumber: 1, votes: 1, percentage: 100 });
    // Guru Favorit hanya dipilih siswa → guru tidak dihitung sebagai pemilih.
    expect(byName['Guru Favorit']).toMatchObject({ eligible: 8, totalVotes: 1 });
    expect(byName['Ketua MPK'].winnerIds).toEqual([mpk[1]!.id]);

    const body = JSON.stringify(stats.body);
    expect(body).not.toContain('3001');
    expect(body).not.toContain('userId');

    const csv = await agent.get('/api/admin/results/export.csv');
    expect(csv.status).toBe(200);
    expect(csv.headers['content-type']).toMatch(/text\/csv/);
    expect(csv.text).toContain('Kategori,Ketua OSIS');
    expect(csv.text).toContain('Ketua OSIS Satu,XII IPA 1,1,100');
    expect(csv.text).toContain('Terpilih,Ketua MPK Dua');
    expect(await prisma.auditLog.count({ where: { action: 'results.exported' } })).toBe(1);
  });
});

describe('kelola data', () => {
  it('membuat siswa, NIS duplikat → 409, dan pemilih yang sudah memilih tidak bisa dihapus', async () => {
    const { agent, token } = await loginAs('admin.uji');
    const classX1 = await createClass('X-1', 10);
    const payload = { nis: '3003', name: 'Siswa Baru', classId: classX1.id, password: 'kode123' };
    expect((await agent.post('/api/admin/students').set('x-csrf-token', token).send(payload)).status).toBe(201);
    expect((await agent.post('/api/admin/students').set('x-csrf-token', token).send(payload)).status).toBe(409);

    const [candidate] = await prisma.candidate.findMany();
    const voter = await loginAs('3001');
    await voter.agent.post('/api/votes').set('x-csrf-token', voter.token).send({ candidateId: candidate!.id });
    const target = await prisma.user.findUniqueOrThrow({ where: { nis: '3001' } });
    const del = await agent.delete(`/api/admin/students/${target.id}`).set('x-csrf-token', token);
    expect(del.status).toBe(409);
    expect(del.body.code).toBe('VOTER_HAS_VOTED');

    const list = await agent.get('/api/admin/students?q=3001');
    expect(list.body).toMatchObject({ eligibleCategories: 1 });
    expect(list.body.voters[0]).toMatchObject({ nis: '3001', votedCount: 1 });
  });

  it('impor 1000 baris diterima walau melebihi batas body 100kb global, NIS lama dilewati', async () => {
    const { agent, token } = await loginAs('admin.uji');
    const rows = Array.from({ length: 1000 }, (_, i) => ({
      nis: i === 0 ? '3001' : `9${String(i).padStart(6, '0')}`,
      name: `Siswa Impor Dengan Nama Cukup Panjang ${i}`,
      className: 'XII IPS 3',
      password: `kode-akses-${i}`,
    }));
    const res = await agent.post('/api/admin/students/import').set('x-csrf-token', token).send({ rows, createMissingClasses: true });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ received: 1000, created: 999, skipped: 1, createdClasses: ['XII IPS 3'] });
    expect(res.body.createdNis).toHaveLength(999);
    expect(res.body.createdNis).not.toContain('3001');
    expect(await prisma.user.count({ where: { schoolClass: { name: 'XII IPS 3' } } })).toBe(999);

    const tooMany = await agent
      .post('/api/admin/students/import')
      .set('x-csrf-token', token)
      .send({ rows: [...rows, ...rows.slice(0, 1)], createMissingClasses: true });
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
    const category = await createCategory('Ketua OSIS');
    const res = await agent.post('/api/admin/candidates').set('x-csrf-token', token).send({
      categoryId: category.id,
      candidateNumber: 3,
      userId: student.id,
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
