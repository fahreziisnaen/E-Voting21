import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { app, createCandidates, createCategory, createUser, loginAs, resetDatabase, setElection } from './helpers.js';

const HOUR = 60 * 60 * 1000;

beforeEach(async () => {
  await resetDatabase();
  await setElection({ status: 'draft' });
  await createUser('admin.uji', 'admin');
});

afterAll(() => prisma.$disconnect());

describe('manajemen kategori', () => {
  it('CRUD kategori dengan urutan, hak memilih, dan nama unik', async () => {
    const { agent, token } = await loginAs('admin.uji');
    const post = (body: object) => agent.post('/api/admin/categories').set('x-csrf-token', token).send(body);

    const mpk = await post({ name: '  Ketua   MPK ', description: 'Majelis Perwakilan Kelas', voterScope: 'all', sortOrder: 2 });
    expect(mpk.status).toBe(201);
    expect(mpk.body.category).toMatchObject({ name: 'Ketua MPK', voterScope: 'all', sortOrder: 2 });
    expect((await post({ name: 'Ketua OSIS', voterScope: 'all', sortOrder: 1 })).status).toBe(201);
    expect((await post({ name: 'ketua mpk', voterScope: 'all' })).status).toBe(409);
    expect((await post({ name: 'Guru Favorit', voterScope: 'semua' })).status).toBe(400);

    const list = await agent.get('/api/admin/categories');
    expect(list.body.categories.map((c: { name: string }) => c.name)).toEqual(['Ketua OSIS', 'Ketua MPK']);

    const updated = await agent
      .put(`/api/admin/categories/${mpk.body.category.id}`)
      .set('x-csrf-token', token)
      .send({ name: 'Ketua MPK', description: '', voterScope: 'student', sortOrder: 2 });
    expect(updated.status).toBe(200);
    expect(updated.body.category).toMatchObject({ voterScope: 'student', description: null });

    expect((await agent.delete(`/api/admin/categories/${mpk.body.category.id}`).set('x-csrf-token', token)).status).toBe(204);
    expect(await prisma.auditLog.count({ where: { action: { startsWith: 'category.' } } })).toBe(4);
  });

  it('kategori berisi kandidat tidak bisa dihapus; hak memilih dikunci selama pemungutan suara', async () => {
    const [candidate] = await createCandidates('Ketua OSIS');
    const { agent, token } = await loginAs('admin.uji');
    const categoryId = candidate!.categoryId;

    const blocked = await agent.delete(`/api/admin/categories/${categoryId}`).set('x-csrf-token', token);
    expect(blocked.status).toBe(409);
    expect(blocked.body.code).toBe('CATEGORY_NOT_EMPTY');

    await setElection({ status: 'open' });
    const scopeChange = await agent
      .put(`/api/admin/categories/${categoryId}`)
      .set('x-csrf-token', token)
      .send({ name: 'Ketua OSIS', voterScope: 'student', sortOrder: 1 });
    expect(scopeChange.status).toBe(409);
    expect(scopeChange.body.code).toBe('ELECTION_IN_PROGRESS');

    const rename = await agent
      .put(`/api/admin/categories/${categoryId}`)
      .set('x-csrf-token', token)
      .send({ name: 'Ketua OSIS 2026', voterScope: 'all', sortOrder: 1 });
    expect(rename.status).toBe(200);

    expect((await agent.post('/api/admin/categories').set('x-csrf-token', token).send({ name: 'Baru', voterScope: 'all' })).status).toBe(409);
  });
});

describe('guru sebagai pemilih', () => {
  it('CRUD & impor guru tanpa kelas; guru hasil impor bisa login', async () => {
    const { agent, token } = await loginAs('admin.uji');
    const created = await agent
      .post('/api/admin/teachers')
      .set('x-csrf-token', token)
      .send({ nis: 'guru.pak', name: 'Pak Guru', password: 'kode-guru-1' });
    expect(created.status).toBe(201);
    expect(created.body.voter).toMatchObject({ nis: 'guru.pak', className: null, classId: null });

    const duplicate = await agent
      .post('/api/admin/teachers')
      .set('x-csrf-token', token)
      .send({ nis: 'guru.pak', name: 'Pak Guru', password: 'kode-guru-1' });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.message).toMatch(/Username sudah terdaftar/);

    const imported = await agent
      .post('/api/admin/teachers/import')
      .set('x-csrf-token', token)
      .send({ rows: [{ nis: 'guru.bu', name: 'Bu Guru', password: 'kode-guru-2' }] });
    expect(imported.status).toBe(201);
    expect(imported.body).toMatchObject({ created: 1, createdNis: ['guru.bu'], createdClasses: [] });

    // Guru tidak muncul di daftar siswa dan sebaliknya.
    expect((await agent.get('/api/admin/students')).body.total).toBe(0);
    expect((await agent.get('/api/admin/teachers')).body.total).toBe(2);

    const login = await loginAs('guru.bu', 'kode-guru-2');
    expect(login.login.status).toBe(200);
    expect(login.login.body.user).toMatchObject({ role: 'teacher', className: null });
    expect((await login.agent.get('/api/auth/me')).body).toMatchObject({ votes: [] });
  });
});

describe('pengumuman hasil (menu Terpilih)', () => {
  it('hasil tertutup selama voting, hanya bisa diumumkan setelah selesai, dan ditarik bila voting dibuka lagi', async () => {
    const osis = await createCandidates('Ketua OSIS');
    const mpk = await createCandidates('Ketua MPK');
    await setElection({ status: 'open' });
    await createUser('7001');
    await createUser('7002');
    await createUser('G700', 'teacher');

    const cast = async (nis: string, candidateId: number) => {
      const session = await loginAs(nis);
      const res = await session.agent.post('/api/votes').set('x-csrf-token', session.token).send({ candidateId });
      expect(res.status).toBe(201);
    };
    await cast('7001', osis[0]!.id);
    await cast('7002', osis[0]!.id);
    await cast('G700', osis[1]!.id);
    await cast('7001', mpk[0]!.id);
    await cast('7002', mpk[1]!.id);

    const hidden = await request(app).get('/api/results');
    expect(hidden.body).toEqual({ published: false, publishedAt: null, categories: [] });

    const { agent, token } = await loginAs('admin.uji');
    const publish = (published: boolean) =>
      agent.put('/api/admin/election/results-publication').set('x-csrf-token', token).send({ published });

    const tooEarly = await publish(true);
    expect(tooEarly.status).toBe(409);
    expect(tooEarly.body.code).toBe('VOTING_NOT_FINISHED');

    await setElection({ status: 'closed' });
    const published = await publish(true);
    expect(published.status).toBe(200);
    expect(published.body.election).toMatchObject({ resultsPublished: true });

    const results = await request(app).get('/api/results');
    expect(results.body.published).toBe(true);
    const [osisResult, mpkResult] = results.body.categories;
    expect(osisResult).toMatchObject({ name: 'Ketua OSIS', totalVotes: 3, tie: false, winnerIds: [osis[0]!.id] });
    expect(osisResult.candidates[0]).toMatchObject({ name: 'Ketua OSIS Satu', votes: 2, percentage: 66.7 });
    expect(mpkResult).toMatchObject({ name: 'Ketua MPK', tie: true, winnerIds: [mpk[0]!.id, mpk[1]!.id] });
    expect(JSON.stringify(results.body)).not.toMatch(/7001|7002|G700|K\d+-\d/);

    // Jadwal dibuka lagi → pengumuman otomatis ditarik.
    const reopen = await agent.put('/api/admin/election').set('x-csrf-token', token).send({
      electionName: 'Pemilihan Uji',
      startDate: new Date(Date.now() - 48 * HOUR).toISOString(),
      endDate: new Date(Date.now() + 48 * HOUR).toISOString(),
      status: 'open',
    });
    expect(reopen.body.election).toMatchObject({ phase: 'active', resultsPublished: false });
    expect((await request(app).get('/api/results')).body.published).toBe(false);

    expect(await prisma.auditLog.count({ where: { action: 'results.published' } })).toBe(1);
  });

  it('pengumuman yang tersimpan tetap tersembunyi bila fase kembali aktif (lapisan pengaman kedua)', async () => {
    await setElection({ status: 'open', resultsPublishedAt: new Date() });
    const res = await request(app).get('/api/results');
    expect(res.body.published).toBe(false);
    expect((await request(app).get('/api/election/settings')).body.election.resultsPublished).toBe(false);
  });

  it('kategori tanpa suara tidak memiliki pemenang', async () => {
    await createCategory('Kosong');
    await setElection({ status: 'closed', resultsPublishedAt: new Date() });
    const res = await request(app).get('/api/results');
    expect(res.body.categories[0]).toMatchObject({ name: 'Kosong', totalVotes: 0, winnerIds: [], tie: false });
  });

  it('hasil terbuka otomatis saat pemungutan suara ditutup, tanpa aksi panitia', async () => {
    const osis = await createCandidates('Ketua OSIS');
    await setElection({ status: 'open' });
    const voter = await loginAs((await createUser('7010')).nis);
    await voter.agent.post('/api/votes').set('x-csrf-token', voter.token).send({ candidateId: osis[0]!.id });
    expect((await request(app).get('/api/results')).body.published).toBe(false);

    await setElection({ status: 'closed' });
    const results = await request(app).get('/api/results');
    expect(results.body.published).toBe(true);
    expect(results.body.publishedAt).toEqual(expect.any(String));
    expect(results.body.categories[0]).toMatchObject({ name: 'Ketua OSIS', totalVotes: 1, winnerIds: [osis[0]!.id] });
    // Waktu pengumuman dicatat sekali, lalu tidak berubah pada permintaan berikutnya.
    expect((await request(app).get('/api/results')).body.publishedAt).toBe(results.body.publishedAt);
    expect((await request(app).get('/api/election/settings')).body.election).toMatchObject({
      resultsPublished: true,
      resultsUnlocked: true,
      resultsWithheld: false,
    });
  });

  it('hasil terbuka otomatis saat semua pemilih sudah memilih meski jadwal masih berjalan', async () => {
    const osis = await createCandidates('Ketua OSIS');
    const favorit = await createCategory('Guru Favorit', 'student');
    await prisma.candidate.create({
      data: {
        categoryId: favorit.id,
        candidateNumber: 1,
        userId: (await createUser('G710', 'teacher')).id,
        vision: 'Visi',
        mission: [],
        programs: [],
        organizationHistory: [],
      },
    });
    await setElection({ status: 'open' });

    // Pemilih = 2 kandidat Ketua OSIS (siswa) + 1 guru kandidat Guru Favorit + 1 siswa biasa.
    const kandidat = await prisma.user.findMany({ where: { id: { in: osis.map((c) => c.userId) } }, select: { nis: true } });
    const siswa = [...kandidat.map((u) => u.nis), (await createUser('7011')).nis];
    const guru = 'G710';
    expect((await request(app).get('/api/results')).body.published).toBe(false);

    for (const nis of [...siswa, guru]) {
      const session = await loginAs(nis);
      const osisVote = await session.agent.post('/api/votes').set('x-csrf-token', session.token).send({ candidateId: osis[0]!.id });
      expect(osisVote.status).toBe(201);
      if (nis !== guru) {
        // Guru Favorit hanya untuk siswa.
        const favoritVote = await session.agent
          .post('/api/votes')
          .set('x-csrf-token', session.token)
          .send({ candidateId: (await prisma.candidate.findFirstOrThrow({ where: { categoryId: favorit.id } })).id });
        expect(favoritVote.status).toBe(201);
      }
    }

    const settings = await request(app).get('/api/election/settings');
    expect(settings.body.election).toMatchObject({ phase: 'active', resultsPublished: true, resultsUnlocked: true });
    expect((await request(app).get('/api/results')).body.published).toBe(true);
  });

  it('panitia dapat menahan hasil yang sudah terbuka otomatis, lalu membukanya lagi', async () => {
    const osis = await createCandidates('Ketua OSIS');
    await setElection({ status: 'closed' });
    expect((await request(app).get('/api/results')).body.published).toBe(true);

    const { agent, token } = await loginAs('admin.uji');
    const publish = (published: boolean) =>
      agent.put('/api/admin/election/results-publication').set('x-csrf-token', token).send({ published });

    const withheld = await publish(false);
    expect(withheld.status).toBe(200);
    expect(withheld.body.election).toMatchObject({ resultsPublished: false, resultsUnlocked: true, resultsWithheld: true });
    expect((await request(app).get('/api/results')).body).toEqual({ published: false, publishedAt: null, categories: [] });

    const reopened = await publish(true);
    expect(reopened.body.election).toMatchObject({ resultsPublished: true, resultsWithheld: false });
    const results = await request(app).get('/api/results');
    expect(results.body.categories[0]).toMatchObject({ name: 'Ketua OSIS', winnerIds: [] });
    expect(osis).toHaveLength(2);
    expect(await prisma.auditLog.count({ where: { action: 'results.unpublished' } })).toBe(1);
  });
});
